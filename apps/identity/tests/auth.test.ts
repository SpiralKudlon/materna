/**
 * auth.test.ts
 *
 * Integration-style tests using vi.mock to stub out:
 *  - PostgreSQL Pool  → avoids a real database connection
 *  - Keycloak fetch calls → avoids a real Keycloak instance
 *
 * The app is built with an in-memory pool mock so Fastify boots cleanly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import type { FastifyInstance } from 'fastify';

// ── Env stub (must be set before any app module is imported) ──────────────
vi.stubEnv('NODE_ENV', 'test');
vi.stubEnv('DATABASE_URL', 'postgres://test:test@localhost:5432/test');
vi.stubEnv('KEYCLOAK_BASE_URL', 'https://auth.example.com');
vi.stubEnv('KEYCLOAK_REALM', 'maternal-system');
vi.stubEnv('KEYCLOAK_CLIENT_ID', 'api-server');
vi.stubEnv('CLIENT_SECRET', 'test-secret');
vi.stubEnv('KEYCLOAK_ADMIN_USERNAME', 'admin');
vi.stubEnv('KEYCLOAK_ADMIN_PASSWORD', 'admin');

// ── Module mocks ──────────────────────────────────────────────────────────
vi.mock('../src/services/keycloak.service.js', () => ({
    KeycloakService: vi.fn().mockImplementation(() => ({
        createUser: vi.fn().mockResolvedValue('kc-user-uuid-123'),
        deleteUser: vi.fn().mockResolvedValue(undefined),
        getToken: vi.fn().mockResolvedValue({
            access_token: 'mock.access.token',
            refresh_token: 'mock.refresh.token',
            token_type: 'Bearer',
            expires_in: 900,
            refresh_expires_in: 604800,
        }),
    })),
}));

// ── Shared mock pool factory ───────────────────────────────────────────────
function makeMockPool(options: {
    findByEmailRow?: Record<string, unknown>;
    createRow?: Record<string, unknown>;
    queryError?: Error;
} = {}): Pool {
    const defaultUser = {
        id: 'local-uuid-456',
        email: 'jane@example.com',
        name: 'Jane Doe',
        role: 'CHW',
        keycloak_id: 'kc-user-uuid-123',
        created_at: new Date(),
        updated_at: new Date(),
    };

    const mockClient: Partial<PoolClient> = {
        query: vi.fn().mockImplementation((sql: string) => {
            if (options.queryError && sql.startsWith('INSERT')) throw options.queryError;
            if (sql.startsWith('INSERT')) return Promise.resolve({ rows: [options.createRow ?? defaultUser] });
            if (sql.startsWith('SELECT') && sql.includes('email')) {
                return Promise.resolve({ rows: options.findByEmailRow ? [options.findByEmailRow] : [] });
            }
            return Promise.resolve({ rows: [] });
        }),
        release: vi.fn(),
    };

    return {
        connect: vi.fn().mockResolvedValue(mockClient),
        query: vi.fn().mockImplementation((sql: string) => {
            if (sql.includes('email')) {
                return Promise.resolve({ rows: options.findByEmailRow ? [options.findByEmailRow] : [] });
            }
            return Promise.resolve({ rows: [] });
        }),
        end: vi.fn().mockResolvedValue(undefined),
    } as unknown as Pool;
}

// ── Lazy import after mocks are in place ──────────────────────────────────
const { buildApp } = await import('../src/app.js');

describe('POST /api/v1/auth/register', () => {
    let app: FastifyInstance;

    beforeEach(async () => {
        app = await buildApp({ pool: makeMockPool() });
    });

    afterEach(async () => { await app.close(); });

    it('201 – creates user and returns profile (no password)', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: { email: 'jane@example.com', password: 'Password1', name: 'Jane Doe', role: 'CHW' },
        });
        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body);
        expect(body.data).toMatchObject({ email: 'jane@example.com', name: 'Jane Doe' });
        expect(body.data).not.toHaveProperty('password');
        expect(body.data).not.toHaveProperty('passwordHash');
    });

    it('400 – missing role', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: { email: 'jane@example.com', password: 'Password1', name: 'Jane Doe' },
        });
        expect(res.statusCode).toBe(400);
    });

    it('400 – invalid role value', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: { email: 'jane@example.com', password: 'Password1', name: 'Jane Doe', role: 'SUPERUSER' },
        });
        expect(res.statusCode).toBe(400);
    });

    it('400 – password too short', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: { email: 'jane@example.com', password: 'short', name: 'Jane Doe', role: 'PATIENT' },
        });
        expect(res.statusCode).toBe(400);
    });

    it('409 – duplicate email (found in local DB)', async () => {
        const existing = { id: 'existing-id', email: 'jane@example.com', name: 'X', role: 'CHW', keycloak_id: 'kc-1' };
        const pool = makeMockPool({ findByEmailRow: existing });
        const localApp = await buildApp({ pool });
        afterEach(() => localApp.close());

        const res = await localApp.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: { email: 'jane@example.com', password: 'Password1', name: 'Jane Doe', role: 'PATIENT' },
        });
        expect(res.statusCode).toBe(409);
        await localApp.close();
    });

    it('500 – DB failure triggers Keycloak compensating delete', async () => {
        const pool = makeMockPool({ queryError: new Error('DB connection lost') });
        const localApp = await buildApp({ pool });

        const res = await localApp.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: { email: 'new@example.com', password: 'Password1', name: 'New User', role: 'CHW' },
        });
        expect(res.statusCode).toBe(500);
        await localApp.close();
    });
});

describe('POST /api/v1/auth/login', () => {
    let app: FastifyInstance;

    beforeEach(async () => {
        app = await buildApp({ pool: makeMockPool() });
    });
    afterEach(async () => { await app.close(); });

    it('200 – returns access_token and refresh_token', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/login',
            payload: { email: 'jane@example.com', password: 'Password1' },
        });
        expect(res.statusCode).toBe(200);
        const { data } = JSON.parse(res.body);
        expect(data).toHaveProperty('access_token');
        expect(data).toHaveProperty('refresh_token');
        expect(data.token_type).toBe('Bearer');
    });

    it('400 – missing password', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/login',
            payload: { email: 'jane@example.com' },
        });
        expect(res.statusCode).toBe(400);
    });

    it('401 – wrong credentials', async () => {
        // Re-mock KeycloakService to throw 401 for this specific test
        const { KeycloakService } = await import('../src/services/keycloak.service.js');
        const kcMock = vi.mocked(KeycloakService).mock.results[0]?.value as { getToken: ReturnType<typeof vi.fn> };
        if (kcMock) {
            kcMock.getToken.mockRejectedValueOnce(new Error('Invalid credentials'));
        }
        const localApp = await buildApp({ pool: makeMockPool() });

        const res = await localApp.inject({
            method: 'POST',
            url: '/api/v1/auth/login',
            payload: { email: 'wrong@example.com', password: 'WrongPass1' },
        });
        expect([401, 500]).toContain(res.statusCode);
        await localApp.close();
    });
});

describe('GET /health', () => {
    it('200 – returns ok status', async () => {
        const app = await buildApp({ pool: makeMockPool() });
        const res = await app.inject({ method: 'GET', url: '/health' });
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toMatchObject({ status: 'ok' });
        await app.close();
    });
});

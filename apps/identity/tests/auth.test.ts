/**
 * auth.test.ts
 *
 * Integration-style tests using vi.mock to stub out:
 *  - PostgreSQL Pool  → avoids a real database connection
 *  - Keycloak fetch calls → avoids a real Keycloak instance
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
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

// Mock ioredis (may not be installed offline)
vi.mock('ioredis', () => ({
    default: vi.fn().mockImplementation(() => ({
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue('OK'),
        del: vi.fn().mockResolvedValue(0),
        incr: vi.fn().mockResolvedValue(1),
        pipeline: vi.fn(() => ({
            set: vi.fn().mockReturnThis(),
            exec: vi.fn().mockResolvedValue([]),
        })),
        quit: vi.fn().mockResolvedValue('OK'),
    })),
}));

// ── Mock Keycloak service ─────────────────────────────────────────────────
const mockCreateUser = vi.fn().mockResolvedValue('kc-user-uuid-123');
const mockDeleteUser = vi.fn().mockResolvedValue(undefined);
const mockGetToken = vi.fn().mockResolvedValue({
    access_token: 'mock.access.token',
    refresh_token: 'mock.refresh.token',
    token_type: 'Bearer',
    expires_in: 900,
    refresh_expires_in: 604800,
});

vi.mock('../src/services/keycloak.service.js', () => ({
    KeycloakService: vi.fn().mockImplementation(() => ({
        createUser: mockCreateUser,
        deleteUser: mockDeleteUser,
        getToken: mockGetToken,
    })),
}));

// ── Shared mock pool factory ───────────────────────────────────────────────
const defaultUser = {
    id: 'local-uuid-456',
    email: 'jane@example.com',
    name: 'Jane Doe',
    role: 'CHV',
    keycloak_id: 'kc-user-uuid-123',
    created_at: new Date(),
    updated_at: new Date(),
};

function makeMockPool(options: {
    existingRowOnEmailLookup?: Record<string, unknown>;
    insertError?: Error;
} = {}): Pool {
    let txStarted = false;

    const mockClient = {
        query: vi.fn().mockImplementation((sql: string) => {
            if (typeof sql === 'string' && sql.trim() === 'BEGIN') {
                txStarted = true;
                return Promise.resolve({ rows: [] });
            }
            if (typeof sql === 'string' && (sql.trim() === 'COMMIT' || sql.trim() === 'ROLLBACK')) {
                return Promise.resolve({ rows: [] });
            }
            if (typeof sql === 'string' && sql.startsWith('INSERT')) {
                if (options.insertError) return Promise.reject(options.insertError);
                return Promise.resolve({ rows: [defaultUser] });
            }
            return Promise.resolve({ rows: [] });
        }),
        release: vi.fn(),
    } as unknown as PoolClient;

    return {
        connect: vi.fn().mockResolvedValue(mockClient),
        // Pool-level query (used by findByEmail pre-flight check)
        query: vi.fn().mockImplementation((sql: string) => {
            if (typeof sql === 'string' && sql.includes('email')) {
                return Promise.resolve({
                    rows: options.existingRowOnEmailLookup ? [options.existingRowOnEmailLookup] : [],
                });
            }
            return Promise.resolve({ rows: [] });
        }),
        end: vi.fn().mockResolvedValue(undefined),
    } as unknown as Pool;
}

// ── Import app after mocks are set up ────────────────────────────────────
const { buildApp } = await import('../src/app.js');

// ─────────────────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/register', () => {
    let app: FastifyInstance;

    beforeEach(async () => {
        vi.clearAllMocks();
        app = await buildApp({ pool: makeMockPool() });
    });
    afterEach(async () => { await app.close(); });

    it('201 – creates user and returns profile (no password)', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: {
                email: 'jane@example.com',
                password: 'Password1',
                name: 'Jane Doe',
                role: 'CHV',              // valid enum value
            },
        });
        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.body);
        expect(body.data).toMatchObject({ email: 'jane@example.com', name: 'Jane Doe', role: 'CHV' });
        expect(body.data).not.toHaveProperty('password');
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

    it('409 – duplicate email found in local DB', async () => {
        const pool = makeMockPool({ existingRowOnEmailLookup: defaultUser });
        const localApp = await buildApp({ pool });

        const res = await localApp.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: { email: 'jane@example.com', password: 'Password1', name: 'Jane Doe', role: 'PATIENT' },
        });
        expect(res.statusCode).toBe(409);
        await localApp.close();
    });

    it('500 + compensating delete – DB INSERT fails after Keycloak success', async () => {
        const pool = makeMockPool({ insertError: new Error('DB connection lost') });
        const localApp = await buildApp({ pool });

        const res = await localApp.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            payload: { email: 'new@example.com', password: 'Password1', name: 'New User', role: 'CHV' },
        });
        expect(res.statusCode).toBe(500);
        // Keycloak compensating delete must have been called
        expect(mockDeleteUser).toHaveBeenCalledWith('kc-user-uuid-123');
        await localApp.close();
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/login', () => {
    let app: FastifyInstance;

    beforeEach(async () => {
        vi.clearAllMocks();
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
        expect(data).toHaveProperty('access_token', 'mock.access.token');
        expect(data).toHaveProperty('refresh_token', 'mock.refresh.token');
        expect(data.token_type).toBe('Bearer');
        expect(data.expires_in).toBe(900);
        expect(data.refresh_expires_in).toBe(604800);
    });

    it('400 – missing password', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/login',
            payload: { email: 'jane@example.com' },
        });
        expect(res.statusCode).toBe(400);
    });

    it('401 – wrong credentials from Keycloak', async () => {
        mockGetToken.mockRejectedValueOnce(new Error('Invalid credentials'));

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/login',
            payload: { email: 'wrong@example.com', password: 'WrongPass1' },
        });
        expect(res.statusCode).toBe(401);
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe('GET /health', () => {
    it('200 – returns ok and timestamp', async () => {
        const app = await buildApp({ pool: makeMockPool() });
        const res = await app.inject({ method: 'GET', url: '/health' });
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toMatchObject({ status: 'ok' });
        await app.close();
    });
});

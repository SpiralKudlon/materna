/**
 * security.test.ts — Tests for the JWT, RBAC, and Gatekeeper middleware.
 *
 * Strategy:
 *  - Tests use the built app WITH security enabled (skipSecurity: false)
 *  - We mock the global `fetch` to simulate JWKS and token exchanges
 *  - We generate real RS256 JWT tokens using Node crypto for end-to-end verification
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import * as crypto from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { FastifyInstance } from 'fastify';

// ── Env stubs ─────────────────────────────────────────────────────────────
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

// ── Generate real RSA key pair for JWT signing in tests ───────────────────
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
});

const jwk = publicKey.export({ format: 'jwk' }) as {
    n: string;
    e: string;
    kty: string;
};

const KID = 'test-key-id';

// ── JWT helpers ───────────────────────────────────────────────────────────
function base64url(input: Buffer | string): string {
    const buf = typeof input === 'string' ? Buffer.from(input) : input;
    return buf.toString('base64url');
}

function createTestJwt(payload: Record<string, unknown>, options?: { kid?: string }): string {
    const header = { alg: 'RS256', typ: 'JWT', kid: options?.kid ?? KID };
    const headerB64 = base64url(JSON.stringify(header));
    const payloadB64 = base64url(JSON.stringify(payload));
    const signedData = `${headerB64}.${payloadB64}`;
    const signature = crypto.createSign('RSA-SHA256').update(signedData).sign(privateKey);
    return `${signedData}.${base64url(signature)}`;
}

function validTokenPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    const now = Math.floor(Date.now() / 1000);
    return {
        sub: 'user-uuid-123',
        email: 'jane@example.com',
        name: 'Jane Doe',
        preferred_username: 'jane',
        iss: 'https://auth.example.com/realms/maternal-system',
        aud: 'api-server',
        azp: 'api-server',
        exp: now + 900,
        iat: now,
        realm_access: { roles: ['chv'] },
        ...overrides,
    };
}

// ── Mock KeycloakService to avoid real HTTP ───────────────────────────────
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

// ── Mock global fetch for JWKS ────────────────────────────────────────────
const originalFetch = globalThis.fetch;

function mockFetchForJwks(): void {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (typeof url === 'string' && url.includes('/certs')) {
            return new Response(
                JSON.stringify({
                    keys: [
                        {
                            kid: KID,
                            kty: jwk.kty,
                            n: jwk.n,
                            e: jwk.e,
                            alg: 'RS256',
                            use: 'sig',
                        },
                    ],
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } },
            );
        }
        // Fallback for any Keycloak admin calls
        return new Response(JSON.stringify({ access_token: 'admin-token' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    });
}

// ── Mock pool ─────────────────────────────────────────────────────────────
function makeMockPool(): Pool {
    const defaultUser = {
        id: 'local-uuid-456',
        email: 'jane@example.com',
        name: 'Jane Doe',
        role: 'CHV',
        keycloak_id: 'kc-user-uuid-123',
        created_at: new Date(),
        updated_at: new Date(),
    };

    const mockClient = {
        query: vi.fn().mockImplementation((sql: string) => {
            if (typeof sql === 'string' && sql.startsWith('INSERT')) {
                return Promise.resolve({ rows: [defaultUser] });
            }
            return Promise.resolve({ rows: [] });
        }),
        release: vi.fn(),
    } as unknown as PoolClient;

    return {
        connect: vi.fn().mockResolvedValue(mockClient),
        query: vi.fn().mockResolvedValue({ rows: [] }),
        end: vi.fn().mockResolvedValue(undefined),
    } as unknown as Pool;
}

// ── Import app after mocks ────────────────────────────────────────────────
const { buildApp } = await import('../src/app.js');

// ─────────────────────────────────────────────────────────────────────────
describe('Security Middleware', () => {
    beforeAll(() => { mockFetchForJwks(); });
    afterAll(() => { globalThis.fetch = originalFetch; });

    // ── Gatekeeper: default-deny ──────────────────────────────────────────
    describe('Gatekeeper (default-deny)', () => {
        let app: FastifyInstance;
        beforeEach(async () => { app = await buildApp({ pool: makeMockPool() }); });

        it('allows /health without auth', async () => {
            const res = await app.inject({ method: 'GET', url: '/health' });
            expect(res.statusCode).toBe(200);
            await app.close();
        });

        it('allows /api/v1/auth/register without auth', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/register',
                payload: { email: 'new@example.com', password: 'Password1', name: 'Test', role: 'PATIENT' },
            });
            // Should reach the handler (201 or 409), not be blocked by gatekeeper
            expect([201, 409]).toContain(res.statusCode);
            await app.close();
        });

        it('allows /api/v1/auth/login without auth', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/login',
                payload: { email: 'jane@example.com', password: 'Password1' },
            });
            // Should reach handler (200), not be blocked
            expect(res.statusCode).toBe(200);
            await app.close();
        });

        it('blocks unknown routes without a token → 401', async () => {
            const res = await app.inject({ method: 'GET', url: '/api/v1/users' });
            expect(res.statusCode).toBe(401);
            await app.close();
        });

        it('blocks unknown routes with an invalid token → 401', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/api/v1/users',
                headers: { Authorization: 'Bearer not.a.real.token' },
            });
            expect(res.statusCode).toBe(401);
            await app.close();
        });
    });

    // ── JWT validation ────────────────────────────────────────────────────
    describe('JWT validation', () => {
        it('accepts a valid token and populates request.user', async () => {
            const app = await buildApp({ pool: makeMockPool() });

            // Register a protected test route
            app.get('/api/v1/me', async (request) => {
                return { user: request.user };
            });

            const token = createTestJwt(validTokenPayload());
            const res = await app.inject({
                method: 'GET',
                url: '/api/v1/me',
                headers: { Authorization: `Bearer ${token}` },
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.body);
            expect(body.user.sub).toBe('user-uuid-123');
            expect(body.user.email).toBe('jane@example.com');
            expect(body.user.roles).toContain('chv');
            await app.close();
        });

        it('rejects an expired token → 401', async () => {
            const app = await buildApp({ pool: makeMockPool() });
            app.get('/api/v1/me', async (request) => ({ user: request.user }));

            const token = createTestJwt(validTokenPayload({
                exp: Math.floor(Date.now() / 1000) - 60, // expired 60s ago
            }));

            const res = await app.inject({
                method: 'GET',
                url: '/api/v1/me',
                headers: { Authorization: `Bearer ${token}` },
            });
            expect(res.statusCode).toBe(401);
            await app.close();
        });

        it('rejects a token with wrong issuer → 401', async () => {
            const app = await buildApp({ pool: makeMockPool() });
            app.get('/api/v1/me', async (request) => ({ user: request.user }));

            const token = createTestJwt(validTokenPayload({
                iss: 'https://evil.example.com/realms/fake',
            }));

            const res = await app.inject({
                method: 'GET',
                url: '/api/v1/me',
                headers: { Authorization: `Bearer ${token}` },
            });
            expect(res.statusCode).toBe(401);
            await app.close();
        });
    });

    // ── RBAC guard ────────────────────────────────────────────────────────
    describe('RBAC guard', () => {
        it('allows access when user has the required role', async () => {
            const app = await buildApp({ pool: makeMockPool() });
            const { rbac } = await import('../src/plugins/rbac.guard.js');

            app.get('/api/v1/admin/users', { preHandler: rbac('ADMIN', 'CHV') }, async () => {
                return { ok: true };
            });

            const token = createTestJwt(validTokenPayload({ realm_access: { roles: ['chv'] } }));
            const res = await app.inject({
                method: 'GET',
                url: '/api/v1/admin/users',
                headers: { Authorization: `Bearer ${token}` },
            });

            expect(res.statusCode).toBe(200);
            await app.close();
        });

        it('denies access when user lacks the required role → 403', async () => {
            const app = await buildApp({ pool: makeMockPool() });
            const { rbac } = await import('../src/plugins/rbac.guard.js');

            app.get('/api/v1/admin/users', { preHandler: rbac('ADMIN') }, async () => {
                return { ok: true };
            });

            const token = createTestJwt(validTokenPayload({ realm_access: { roles: ['patient'] } }));
            const res = await app.inject({
                method: 'GET',
                url: '/api/v1/admin/users',
                headers: { Authorization: `Bearer ${token}` },
            });

            expect(res.statusCode).toBe(403);
            const body = JSON.parse(res.body);
            expect(body.error).toBe('Forbidden');
            await app.close();
        });
    });
});

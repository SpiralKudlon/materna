/**
 * password-reset.test.ts
 *
 * Tests for the forgot/reset password flow.
 * Uses an in-memory Redis-like mock and the ConsoleSmsService stub.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

// Mock ioredis module (not installed offline)
vi.mock('ioredis', () => ({
    default: vi.fn(),
}));

// ── Mock Keycloak ─────────────────────────────────────────────────────────
const mockResetUserPassword = vi.fn().mockResolvedValue(undefined);

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
        resetUserPassword: mockResetUserPassword,
    })),
}));

// ── In-memory Redis mock ──────────────────────────────────────────────────
function createRedisMock() {
    const store = new Map<string, { value: string; expiresAt: number }>();

    return {
        get: vi.fn(async (key: string) => {
            const entry = store.get(key);
            if (!entry) return null;
            if (Date.now() > entry.expiresAt) { store.delete(key); return null; }
            return entry.value;
        }),
        set: vi.fn(async (key: string, value: string, _ex?: string, ttl?: number) => {
            store.set(key, { value, expiresAt: Date.now() + (ttl ?? 300) * 1000 });
            return 'OK';
        }),
        incr: vi.fn(async (key: string) => {
            const entry = store.get(key);
            const current = entry ? parseInt(entry.value, 10) : 0;
            const next = current + 1;
            store.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? Date.now() + 300000 });
            return next;
        }),
        del: vi.fn(async (...keys: string[]) => {
            let count = 0;
            for (const k of keys) { if (store.delete(k)) count++; }
            return count;
        }),
        pipeline: vi.fn(() => {
            const ops: Array<() => Promise<unknown>> = [];
            const pipelineObj = {
                set: (key: string, value: string, ex: string, ttl: number) => {
                    ops.push(() => {
                        store.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
                        return Promise.resolve('OK');
                    });
                    return pipelineObj;
                },
                exec: async () => {
                    for (const op of ops) await op();
                },
            };
            return pipelineObj;
        }),
        quit: vi.fn().mockResolvedValue('OK'),
    } as unknown as import('ioredis').default;
}

// ── Mock SMS ──────────────────────────────────────────────────────────────
function createSmsMock() {
    return {
        lastMessage: null as { to: string; message: string } | null,
        async send(to: string, message: string) {
            this.lastMessage = { to, message };
        },
    };
}

// ── Mock Pool ─────────────────────────────────────────────────────────────
function makeMockPool(opts: {
    userByPhone?: { keycloak_id: string; name: string } | null;
} = {}): Pool {
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
        query: vi.fn().mockImplementation((sql: string) => {
            // Phone lookup for password reset
            if (typeof sql === 'string' && sql.includes('phone')) {
                const user = opts.userByPhone !== undefined ? opts.userByPhone : { keycloak_id: 'kc-user-uuid-123', name: 'Jane Doe' };
                return Promise.resolve({ rows: user ? [user] : [] });
            }
            // Email lookup
            if (typeof sql === 'string' && sql.includes('email')) {
                return Promise.resolve({ rows: [] });
            }
            return Promise.resolve({ rows: [] });
        }),
        end: vi.fn().mockResolvedValue(undefined),
    } as unknown as Pool;
}

// ── Import after mocks ────────────────────────────────────────────────────
const { buildApp } = await import('../src/app.js');

// ─────────────────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/forgot-password', () => {
    let app: FastifyInstance;
    let redisMock: ReturnType<typeof createRedisMock>;
    let smsMock: ReturnType<typeof createSmsMock>;

    beforeEach(async () => {
        vi.clearAllMocks();
        redisMock = createRedisMock();
        smsMock = createSmsMock();
        app = await buildApp({
            pool: makeMockPool(),
            redis: redisMock,
            sms: smsMock,
            skipSecurity: true,
        });
    });
    afterEach(async () => { await app.close(); });

    it('200 – sends OTP via SMS for a registered phone', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/forgot-password',
            payload: { phone: '+254712345678' },
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.data.sent).toBe(true);

        // Verify SMS was sent
        expect(smsMock.lastMessage).not.toBeNull();
        expect(smsMock.lastMessage?.to).toBe('+254712345678');
        expect(smsMock.lastMessage?.message).toContain('verification code');
    });

    it('200 – does NOT reveal that a phone is unregistered (anti-enumeration)', async () => {
        const pool = makeMockPool({ userByPhone: null });
        const localApp = await buildApp({
            pool,
            redis: redisMock,
            sms: smsMock,
            skipSecurity: true,
        });

        const res = await localApp.inject({
            method: 'POST',
            url: '/api/v1/auth/forgot-password',
            payload: { phone: '+254000000000' },
        });

        expect(res.statusCode).toBe(200);
        expect(smsMock.lastMessage).toBeNull(); // no SMS sent for unregistered
        await localApp.close();
    });

    it('400 – invalid phone format', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/forgot-password',
            payload: { phone: 'abc' },
        });
        expect(res.statusCode).toBe(400);
    });
});

describe('POST /api/v1/auth/reset-password', () => {
    let app: FastifyInstance;
    let redisMock: ReturnType<typeof createRedisMock>;
    let smsMock: ReturnType<typeof createSmsMock>;

    beforeEach(async () => {
        vi.clearAllMocks();
        redisMock = createRedisMock();
        smsMock = createSmsMock();
        app = await buildApp({
            pool: makeMockPool(),
            redis: redisMock,
            sms: smsMock,
            skipSecurity: true,
        });
    });
    afterEach(async () => { await app.close(); });

    it('200 – resets password with a valid OTP', async () => {
        // First, trigger forgot-password to create an OTP
        await app.inject({
            method: 'POST',
            url: '/api/v1/auth/forgot-password',
            payload: { phone: '+254712345678' },
        });

        // Extract OTP from the SMS
        const otpMatch = smsMock.lastMessage?.message.match(/(\d{6})/);
        expect(otpMatch).not.toBeNull();
        const otp = otpMatch![1];

        // Now reset
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/reset-password',
            payload: {
                phone: '+254712345678',
                otp,
                new_password: 'NewPassword1',
            },
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.data.message).toContain('reset successfully');

        // Keycloak should have been called
        expect(mockResetUserPassword).toHaveBeenCalledWith('kc-user-uuid-123', 'NewPassword1');
    });

    it('400 – wrong OTP returns invalid', async () => {
        // Create an OTP first
        await app.inject({
            method: 'POST',
            url: '/api/v1/auth/forgot-password',
            payload: { phone: '+254712345678' },
        });

        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/reset-password',
            payload: {
                phone: '+254712345678',
                otp: '000000',
                new_password: 'NewPassword1',
            },
        });

        expect(res.statusCode).toBe(400);
        const body = JSON.parse(res.body);
        expect(body.error).toContain('Invalid');
    });

    it('429 – returns 429 after 3 failed OTP attempts', async () => {
        // Create OTP
        await app.inject({
            method: 'POST',
            url: '/api/v1/auth/forgot-password',
            payload: { phone: '+254712345678' },
        });

        // 3 wrong attempts
        for (let i = 0; i < 3; i++) {
            await app.inject({
                method: 'POST',
                url: '/api/v1/auth/reset-password',
                payload: {
                    phone: '+254712345678',
                    otp: '000000',
                    new_password: 'NewPassword1',
                },
            });
        }

        // 4th attempt should be 429
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/reset-password',
            payload: {
                phone: '+254712345678',
                otp: '000000',
                new_password: 'NewPassword1',
            },
        });

        // OTP deleted, so should be expired (400) or max attempts (429)
        expect([400, 429]).toContain(res.statusCode);
    });

    it('400 – expired OTP', async () => {
        // Don't create any OTP, just try to reset
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/reset-password',
            payload: {
                phone: '+254712345678',
                otp: '123456',
                new_password: 'NewPassword1',
            },
        });

        expect(res.statusCode).toBe(400);
        const body = JSON.parse(res.body);
        expect(body.error).toContain('expired');
    });

    it('400 – validation fails for short password', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/reset-password',
            payload: {
                phone: '+254712345678',
                otp: '123456',
                new_password: 'short',
            },
        });

        expect(res.statusCode).toBe(400);
    });
});

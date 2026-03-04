/**
 * app.ts — Fastify application factory.
 *
 * Wires together:
 *  - Pino structured logging (built into Fastify)
 *  - @fastify/rate-limit     (if installed)
 *  - JWT validation plugin   (Keycloak JWKS)
 *  - Gatekeeper plugin       (default-deny, public whitelist)
 *  - PostgreSQL pool         (via pg)
 *  - Redis                   (via ioredis — OTP storage)
 *  - Africa's Talking SMS    (or console stub in dev/test)
 *  - AuthService             (injected into routes)
 *  - PasswordResetService    (injected into routes)
 *  - Auth routes             (under /api/v1/auth)
 */
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { env } from './config/env.js';
import { KeycloakService } from './services/keycloak.service.js';
import { AuthService } from './services/auth.service.js';
import { OtpStore } from './services/otp.store.js';
import { PasswordResetService } from './services/password-reset.service.js';
import type { SmsGateway } from './services/sms.service.js';
import { ConsoleSmsService } from './services/sms.service.js';
import { authRoutes } from './routes/auth.routes.js';
import jwtPlugin from './plugins/jwt.plugin.js';
import gatekeeperPlugin from './plugins/gatekeeper.plugin.js';

// ── Public paths whitelist ────────────────────────────────────────────────
const PUBLIC_PATHS = [
    '/health',
    '/api/v1/auth/register',
    '/api/v1/auth/login',
    '/api/v1/auth/forgot-password',
    '/api/v1/auth/reset-password',
];

export interface AppOptions {
    /** Override the PostgreSQL pool (useful for test isolation) */
    pool?: Pool;
    /** Override the Redis instance (useful for test isolation) */
    redis?: import('ioredis').default;
    /** Override the SMS gateway (useful for test isolation) */
    sms?: SmsGateway;
    /** Skip security plugins (useful in unit tests that mock Keycloak) */
    skipSecurity?: boolean;
}

export async function buildApp(opts: AppOptions = {}): Promise<FastifyInstance> {
    // ── Pino structured logger ────────────────────────────────────────────
    const app = Fastify({
        logger: env.NODE_ENV !== 'test'
            ? {
                level: 'info',
                transport:
                    env.NODE_ENV === 'development'
                        ? { target: 'pino-pretty', options: { colorize: true } }
                        : undefined,
                serializers: {
                    req(request) {
                        return {
                            method: request.method,
                            url: request.url,
                            requestId: request.id,
                        };
                    },
                    res(reply) {
                        return { statusCode: reply.statusCode };
                    },
                },
                genReqId: () => crypto.randomUUID(),
            }
            : false,
    });

    // ── Rate limiting ──────────────────────────────────────────────────────
    await app.register(async (instance) => {
        try {
            const { default: rateLimit } = await import('@fastify/rate-limit');
            await instance.register(rateLimit, {
                max: 10,
                timeWindow: '15 minutes',
                errorResponseBuilder: () => ({
                    error: 'Too Many Requests',
                    message: 'Rate limit exceeded. Please try again later.',
                }),
            });
        } catch {
            instance.log.warn(
                '@fastify/rate-limit not installed — rate limiting DISABLED.',
            );
        }
    });

    // ── Security: JWT + Gatekeeper ─────────────────────────────────────────
    if (!opts.skipSecurity) {
        await app.register(jwtPlugin, {
            jwksUri: `${env.KEYCLOAK_BASE_URL}/realms/${env.KEYCLOAK_REALM}/protocol/openid-connect/certs`,
            issuer: `${env.KEYCLOAK_BASE_URL}/realms/${env.KEYCLOAK_REALM}`,
            audience: env.KEYCLOAK_CLIENT_ID,
            publicPaths: PUBLIC_PATHS,
        });

        await app.register(gatekeeperPlugin, {
            publicPaths: PUBLIC_PATHS,
        });
    }

    // ── PostgreSQL pool ────────────────────────────────────────────────────
    const pool =
        opts.pool ??
        new Pool({
            connectionString: env.DATABASE_URL,
            max: 20,
            idleTimeoutMillis: 30_000,
            connectionTimeoutMillis: 5_000,
        });

    if (!opts.pool) {
        const client = await pool.connect();
        client.release();
    }

    app.addHook('onClose', async () => {
        await pool.end();
    });

    // ── Redis ──────────────────────────────────────────────────────────────
    let redis: import('ioredis').default;
    if (opts.redis) {
        redis = opts.redis;
    } else {
        const { default: Redis } = await import('ioredis');
        redis = new Redis(env.REDIS_URL);
    }

    app.addHook('onClose', async () => {
        await redis.quit();
    });

    // ── OTP store ──────────────────────────────────────────────────────────
    const otpStore = new OtpStore(redis);

    // ── SMS gateway ────────────────────────────────────────────────────────
    let sms: SmsGateway;
    if (opts.sms) {
        sms = opts.sms;
    } else if (env.NODE_ENV === 'production') {
        const { AfricasTalkingSmsService } = await import('./services/sms.service.js');
        sms = new AfricasTalkingSmsService(
            env.AT_API_KEY,
            env.AT_USERNAME,
            env.AT_SENDER_ID,
        );
    } else {
        sms = new ConsoleSmsService();
    }

    // ── Keycloak service ───────────────────────────────────────────────────
    const keycloak = new KeycloakService(
        env.KEYCLOAK_BASE_URL,
        env.KEYCLOAK_REALM,
        env.KEYCLOAK_CLIENT_ID,
        env.CLIENT_SECRET,
        env.KEYCLOAK_ADMIN_USERNAME,
        env.KEYCLOAK_ADMIN_PASSWORD,
        env.KEYCLOAK_ADMIN_CLIENT_ID,
    );

    // ── Services ───────────────────────────────────────────────────────────
    const authService = new AuthService(pool, keycloak);
    const passwordResetService = new PasswordResetService(pool, otpStore, sms, keycloak);

    // ── Health endpoint (public) ───────────────────────────────────────────
    app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

    // ── Routes ─────────────────────────────────────────────────────────────
    await app.register(authRoutes, {
        prefix: '/api/v1/auth',
        authService,
        passwordResetService,
    });

    return app;
}

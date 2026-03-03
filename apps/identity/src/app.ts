/**
 * app.ts — Fastify application factory.
 *
 * Wires together:
 *  - @fastify/rate-limit  (if installed)
 *  - PostgreSQL pool      (via pg)
 *  - AuthService          (injected into routes)
 *  - Auth routes          (under /api/v1/auth)
 */
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { env } from './config/env.js';
import { KeycloakService } from './services/keycloak.service.js';
import { AuthService } from './services/auth.service.js';
import { authRoutes } from './routes/auth.routes.js';

export interface AppOptions {
    /** Override the PostgreSQL pool (useful for test isolation) */
    pool?: Pool;
}

export async function buildApp(opts: AppOptions = {}): Promise<FastifyInstance> {
    const app = Fastify({ logger: env.NODE_ENV !== 'test' });

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

    // ── PostgreSQL pool ────────────────────────────────────────────────────
    const pool =
        opts.pool ??
        new Pool({
            connectionString: env.DATABASE_URL,
            max: 20,
            idleTimeoutMillis: 30_000,
            connectionTimeoutMillis: 5_000,
        });

    // Verify connection on startup (fail fast)
    if (!opts.pool) {
        const client = await pool.connect();
        client.release();
    }

    app.addHook('onClose', async () => {
        await pool.end();
    });

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

    // ── Auth service ───────────────────────────────────────────────────────
    const authService = new AuthService(pool, keycloak);

    // ── Health endpoint ────────────────────────────────────────────────────
    app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

    // ── Routes ─────────────────────────────────────────────────────────────
    await app.register(authRoutes, {
        prefix: '/api/v1/auth',
        authService,
    });

    return app;
}

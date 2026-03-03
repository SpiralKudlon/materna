import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { authRoutes } from './routes/auth.routes.js';

export function buildApp(): FastifyInstance {
    const app = Fastify({
        logger: true,
    });

    // 🟢 Rate-limit: max 10 registration attempts per IP per 15 minutes.
    // The import is done dynamically so the app still starts when the package
    // hasn't been installed yet (e.g. during offline CI). In production this
    // MUST be installed: npm install @fastify/rate-limit
    app.register(
        async (instance) => {
            try {
                const { default: rateLimit } = await import('@fastify/rate-limit');
                await instance.register(rateLimit, {
                    max: 10,
                    timeWindow: '15 minutes',
                    errorResponseBuilder: () => ({
                        error: 'Too Many Requests',
                        message: 'Registration rate limit exceeded. Please try again later.',
                    }),
                });
            } catch {
                instance.log.warn(
                    '@fastify/rate-limit is not installed — rate limiting is DISABLED. ' +
                    'Run `npm install @fastify/rate-limit` before deploying to production.'
                );
            }
        }
    );

    app.register(authRoutes, { prefix: '/api/v1/auth' });

    return app;
}

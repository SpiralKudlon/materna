import fastify, { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import { env } from './config/env.js';
import { notifyRoutes } from './routes/notify.routes.js';

// Import workers to ensure they start listening
import './workers/notification.worker.js';
import './workers/emergency.worker.js';
import './workers/digest.worker.js';
import { scheduleDigestJob } from './queues/digest.queue.js';
import { registry } from './lib/metrics.js';

export async function buildApp(): Promise<FastifyInstance> {
    const app = fastify({
        logger: {
            level: env.NODE_ENV === 'development' ? 'debug' : 'info',
        },
    });

    // ── Security headers (Mozilla Observatory A+) ─────────────────────────
    await app.register(helmet, {
        contentSecurityPolicy: {
            directives: {
                'default-src': ["'none'"],
                'frame-ancestors': ["'none'"],
                'form-action': ["'none'"],
                'upgrade-insecure-requests': [],
            },
        },
        strictTransportSecurity: { maxAge: 63_072_000, includeSubDomains: true, preload: true },
        xContentTypeOptions: true,
        xFrameOptions: { action: 'deny' },
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
        crossOriginOpenerPolicy: { policy: 'same-origin' },
        crossOriginResourcePolicy: { policy: 'same-origin' },
        crossOriginEmbedderPolicy: false,
        hidePoweredBy: true,
    });
    app.addHook('onSend', async (_req, reply) => {
        reply.header('Permissions-Policy',
            'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    });

    app.register(notifyRoutes);

    app.get('/metrics', async (_request, reply) => {
        const metrics = await registry.metrics();
        reply.type(registry.contentType).send(metrics);
    });

    app.get('/health', async () => {
        return { status: 'ok', service: 'notification-engine' };
    });

    return app;
}

// Ensure the cron runs at startup in background
scheduleDigestJob().catch(err => {
    console.error('Failed to schedule digest job:', err);
});

// Global process exiting handled dynamically in prod, this is just a stub since workers run in background
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

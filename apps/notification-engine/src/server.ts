import fastify, { FastifyInstance } from 'fastify';
import { env } from './config/env.js';
import { notifyRoutes } from './routes/notify.routes.js';

// Import workers to ensure they start listening
import './workers/notification.worker.js';
import './workers/emergency.worker.js';
import './workers/digest.worker.js';
import { scheduleDigestJob } from './queues/digest.queue.js';

export async function buildApp(): Promise<FastifyInstance> {
    const app = fastify({
        logger: {
            level: env.NODE_ENV === 'development' ? 'debug' : 'info',
        },
    });

    app.register(notifyRoutes);

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

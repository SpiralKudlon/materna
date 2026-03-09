import fastify, { FastifyInstance } from 'fastify';
import formbody from '@fastify/formbody';
import { env } from './config/env.js';
import { getSmsSecrets } from './config/vault.js';
import { AfricasTalkingProvider, TwilioProvider } from './services/sms.strategy.js';
import { SmsBridgeService } from './services/sms-bridge.service.js';
import { smsRoutes } from './routes/sms.routes.js';
import { inboundSmsRoutes } from './routes/inbound-sms.routes.js';
import { ussdRoutes } from './routes/ussd.routes.js';
import { metricsRegistry } from './config/metrics.js';
import pg from 'pg';


export async function buildApp(): Promise<FastifyInstance> {
    const app = fastify({
        logger: {
            level: env.NODE_ENV === 'development' ? 'debug' : 'info',
        },
    });

    await app.register(formbody);

    // We fetch secrets early to fail fast on startup if missing.
    // In next steps we'll pass these secrets to the sms orchestrator/strategy.
    app.log.info('Fetching SMS provider secrets from HashiCorp Vault...');
    let secrets;
    try {
        secrets = await getSmsSecrets();
        app.log.info('Successfully loaded secrets from Vault.');
    } catch (e: any) {
        app.log.error('Vault initialization failed.');
        throw e;
    }

    const dbPool = new pg.Pool({ connectionString: env.DATABASE_URL });

    // Initialize Strategy Providers and Orchestrator
    const atProvider = new AfricasTalkingProvider(secrets);
    const twilioProvider = new TwilioProvider(secrets);
    const smsService = new SmsBridgeService(atProvider, twilioProvider, app.log);

    // Register Routes
    app.register(smsRoutes, { dbPool, smsService });
    app.register(inboundSmsRoutes);
    app.register(ussdRoutes);

    app.get('/health', async () => {
        return { status: 'ok', service: 'sms-bridge' };
    });

    app.get('/metrics', async (request, reply) => {
        const metrics = await metricsRegistry.metrics();
        reply.header('Content-Type', metricsRegistry.contentType);
        return metrics;
    });


    return app;
}

// Ensure process exits gracefully
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

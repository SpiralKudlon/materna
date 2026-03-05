/**
 * server.ts — Entry point for the maternal-records service.
 */
import pg from 'pg';
import { buildApp } from './app.js';
import { env } from './config/env.js';

const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

const app = await buildApp({ pool });

try {
    await app.listen({ port: env.PORT, host: env.HOST });
    console.log(`🏥 maternal-records listening on ${env.HOST}:${env.PORT}`);
} catch (err) {
    app.log.error(err);
    process.exit(1);
}

// Graceful shutdown
const shutdown = async () => {
    await app.close();
    await pool.end();
    process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

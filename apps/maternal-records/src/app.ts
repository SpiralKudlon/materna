/**
 * app.ts — Fastify application factory
 *
 * Accepts dependencies (pool) for testability.
 */
import Fastify from 'fastify';
import type { Pool } from 'pg';
import { PatientRepository } from './repositories/patient.repository.js';
import { VisitRepository } from './repositories/visit.repository.js';
import { MedicationRepository } from './repositories/medication.repository.js';
import { patientRoutes } from './routes/patient.routes.js';
import { visitRoutes } from './routes/visit.routes.js';
import { medicationRoutes } from './routes/medication.routes.js';

export interface BuildAppOptions {
    pool: Pool;
}

export async function buildApp(opts: BuildAppOptions) {
    const app = Fastify({
        logger: {
            level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
        },
    });

    // Repositories
    const patientRepo = new PatientRepository(opts.pool);
    const visitRepo = new VisitRepository(opts.pool);
    const medicationRepo = new MedicationRepository(opts.pool);

    // Ensure medication_logs table exists (idempotent)
    if (process.env.NODE_ENV !== 'test') {
        await medicationRepo.ensureTable();
    }

    // Health check
    app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

    // ── Patient CRUD: /api/v1/patients ─────────────────────────────────
    await app.register(patientRoutes, {
        prefix: '/api/v1/patients',
        patientRepo,
    });

    // ── ANC visits: /api/v1/patients/:id/anc-visits ───────────────────
    await app.register(visitRoutes, {
        prefix: '/api/v1/patients/:id/anc-visits',
        visitRepo,
        patientRepo,
    });

    // ── Medication log: /api/v1/patients/:id/medications/log ──────────
    await app.register(medicationRoutes, {
        prefix: '/api/v1/patients/:id/medications/log',
        medicationRepo,
    });

    // Global error handler
    app.setErrorHandler((error, _request, reply) => {
        app.log.error(error);
        const statusCode = error.statusCode ?? 500;
        reply.code(statusCode).send({
            error: statusCode < 500 ? error.message : 'Internal server error',
        });
    });

    return app;
}

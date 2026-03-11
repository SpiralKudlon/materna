/**
 * app.ts — Fastify application factory
 *
 * Accepts dependencies (pool) for testability.
 */
import Fastify from 'fastify';
import type { Pool } from 'pg';
import helmet from '@fastify/helmet';
import { PatientRepository } from './repositories/patient.repository.js';
import { VisitRepository } from './repositories/visit.repository.js';
import { MedicationRepository } from './repositories/medication.repository.js';
import { patientRoutes } from './routes/patient.routes.js';
import { visitRoutes } from './routes/visit.routes.js';
import { medicationRoutes } from './routes/medication.routes.js';
import { dashboardRoutes } from './routes/dashboard.routes.js';
import { referralRoutes } from './routes/referral.routes.js';
import { facilityRoutes } from './routes/facility.routes.js';

export interface BuildAppOptions {
    pool: Pool;
}

export async function buildApp(opts: BuildAppOptions) {
    const app = Fastify({
        logger: {
            level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
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

    // ── Dashboards: /api/v1 ───────────────────────────────────────────
    await app.register(dashboardRoutes, {
        prefix: '/api/v1',
        pool: opts.pool,
    });

    // ── Referrals: /api/v1/referrals ──────────────────────────────────
    await app.register(referralRoutes, {
        prefix: '/api/v1/referrals',
        pool: opts.pool,
    });

    // ── Facilities: /api/v1/facilities ────────────────────────────────
    await app.register(facilityRoutes, {
        prefix: '/api/v1/facilities',
        db: opts.pool,
    });

    // Global error handler
    app.setErrorHandler((error: any, _request, reply) => {
        app.log.error(error);
        const statusCode = error.statusCode ?? 500;
        reply.code(statusCode).send({
            error: statusCode < 500 ? error.message : 'Internal server error',
        });
    });

    return app;
}

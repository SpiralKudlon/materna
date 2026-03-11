/**
 * patient.routes.ts — CRUD endpoints for /patients
 *
 * Passes request.ip and the User-Agent header into each repository call so
 * the audit trigger (record_audit_event) can capture full request provenance.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { PatientRepository } from '../repositories/patient.repository.js';
import { createPatientSchema, updatePatientSchema } from '../schemas/index.js';
import type { AuditContext } from '../services/audit-context.service.js';

export interface PatientRouteOptions {
    prefix: string;
    patientRepo: PatientRepository;
}

export async function patientRoutes(app: FastifyInstance, opts: PatientRouteOptions) {
    const repo = opts.patientRepo;

    // ── Helpers ────────────────────────────────────────────────────────
    function getUserContext(request: FastifyRequest) {
        const tenantId = (request.headers['x-tenant-id'] as string | undefined) ?? '';
        const userId = (request.headers['x-user-id'] as string | undefined) ?? '';
        return { tenantId, userId };
    }

    function getAuditContext(request: FastifyRequest, userId: string, tenantId: string): AuditContext {
        return {
            userId,
            tenantId,
            ip: request.ip,
            userAgent: (request.headers['user-agent'] as string | undefined) ?? null,
        };
    }

    // ── POST /patients ─────────────────────────────────────────────────
    app.post('/', async (request, reply) => {
        const { tenantId, userId } = getUserContext(request);
        if (!tenantId || !userId) return reply.code(401).send({ error: 'Missing tenant/user context' });

        const parsed = createPatientSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
        }

        const patient = await repo.create(
            tenantId, userId, parsed.data,
            getAuditContext(request, userId, tenantId),
        );
        return reply.code(201).send({ data: patient });
    });

    // ── GET /patients ──────────────────────────────────────────────────
    app.get('/', async (request, reply) => {
        const { tenantId, userId } = getUserContext(request);
        if (!tenantId) return reply.code(401).send({ error: 'Missing tenant context' });

        const query = request.query as { limit?: string; offset?: string };
        const limit = Math.min(parseInt(query.limit ?? '50', 10), 100);
        const offset = parseInt(query.offset ?? '0', 10);

        const patients = await repo.listByTenant(
            tenantId, limit, offset,
            getAuditContext(request, userId, tenantId),
        );
        return reply.send({ data: patients, meta: { limit, offset, count: patients.length } });
    });

    // ── GET /patients/:id ──────────────────────────────────────────────
    app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
        const { tenantId, userId } = getUserContext(request);
        if (!tenantId || !userId) return reply.code(401).send({ error: 'Missing tenant/user context' });

        try {
            const patient = await repo.findById(
                tenantId, userId, request.params.id,
                getAuditContext(request, userId, tenantId),
            );
            if (!patient) return reply.code(404).send({ error: 'Patient not found' });
            return reply.send({ data: patient });
        } catch (err: unknown) {
            if (isCodedError(err) && err.code === 'FORBIDDEN') {
                return reply.code(403).send({ error: err.message });
            }
            throw err;
        }
    });

    // ── PATCH /patients/:id ────────────────────────────────────────────
    app.patch<{ Params: { id: string } }>('/:id', async (request, reply) => {
        const { tenantId, userId } = getUserContext(request);
        if (!tenantId || !userId) return reply.code(401).send({ error: 'Missing tenant/user context' });

        const parsed = updatePatientSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
        }

        try {
            const patient = await repo.update(
                tenantId, userId, request.params.id, parsed.data,
                getAuditContext(request, userId, tenantId),
            );
            return reply.send({ data: patient });
        } catch (err: unknown) {
            if (isCodedError(err) && err.code === 'FORBIDDEN') {
                return reply.code(403).send({ error: err.message });
            }
            throw err;
        }
    });

    // ── DELETE /patients/:id ───────────────────────────────────────────
    app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
        const { tenantId, userId } = getUserContext(request);
        if (!tenantId || !userId) return reply.code(401).send({ error: 'Missing tenant/user context' });

        try {
            const deleted = await repo.delete(
                tenantId, userId, request.params.id,
                getAuditContext(request, userId, tenantId),
            );
            if (!deleted) return reply.code(404).send({ error: 'Patient not found' });
            return reply.code(204).send();
        } catch (err: unknown) {
            if (isCodedError(err) && err.code === 'FORBIDDEN') {
                return reply.code(403).send({ error: err.message });
            }
            throw err;
        }
    });
}

function isCodedError(err: unknown): err is Error & { code: string } {
    return err instanceof Error && 'code' in err;
}

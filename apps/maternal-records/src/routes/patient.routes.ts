/**
 * patient.routes.ts — CRUD endpoints for /patients
 */
import type { FastifyInstance } from 'fastify';
import { PatientRepository } from '../repositories/patient.repository.js';
import { createPatientSchema, updatePatientSchema } from '../schemas/index.js';

export interface PatientRouteOptions {
    prefix: string;
    patientRepo: PatientRepository;
}

export async function patientRoutes(app: FastifyInstance, opts: PatientRouteOptions) {
    const repo = opts.patientRepo;

    // ── Helpers ────────────────────────────────────────────────────────
    function getUserContext(request: { headers: Record<string, string | undefined> }) {
        // In production these come from JWT claims (set by the gateway / jwt plugin)
        const tenantId = request.headers['x-tenant-id'] ?? '';
        const userId = request.headers['x-user-id'] ?? '';
        return { tenantId, userId };
    }

    // ── POST /patients ─────────────────────────────────────────────────
    app.post('/', async (request, reply) => {
        const { tenantId, userId } = getUserContext(request);
        if (!tenantId || !userId) return reply.code(401).send({ error: 'Missing tenant/user context' });

        const parsed = createPatientSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
        }

        const patient = await repo.create(tenantId, userId, parsed.data);
        return reply.code(201).send({ data: patient });
    });

    // ── GET /patients ──────────────────────────────────────────────────
    app.get('/', async (request, reply) => {
        const { tenantId } = getUserContext(request);
        if (!tenantId) return reply.code(401).send({ error: 'Missing tenant context' });

        const query = request.query as { limit?: string; offset?: string };
        const limit = Math.min(parseInt(query.limit ?? '50', 10), 100);
        const offset = parseInt(query.offset ?? '0', 10);

        const patients = await repo.listByTenant(tenantId, limit, offset);
        return reply.send({ data: patients, meta: { limit, offset, count: patients.length } });
    });

    // ── GET /patients/:id ──────────────────────────────────────────────
    app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
        const { tenantId, userId } = getUserContext(request);
        if (!tenantId || !userId) return reply.code(401).send({ error: 'Missing tenant/user context' });

        try {
            const patient = await repo.findById(tenantId, userId, request.params.id);
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
            const patient = await repo.update(tenantId, userId, request.params.id, parsed.data);
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
            const deleted = await repo.delete(tenantId, userId, request.params.id);
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

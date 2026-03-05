/**
 * visit.routes.ts — ANC visit creation endpoint
 */
import type { FastifyInstance } from 'fastify';
import { VisitRepository } from '../repositories/visit.repository.js';
import { PatientRepository } from '../repositories/patient.repository.js';
import { createAncVisitSchema } from '../schemas/index.js';

export interface VisitRouteOptions {
    prefix: string;
    visitRepo: VisitRepository;
    patientRepo: PatientRepository;
}

export async function visitRoutes(app: FastifyInstance, opts: VisitRouteOptions) {
    const visitRepo = opts.visitRepo;
    const patientRepo = opts.patientRepo;

    function getUserContext(request: { headers: Record<string, string | undefined> }) {
        const tenantId = request.headers['x-tenant-id'] ?? '';
        const userId = request.headers['x-user-id'] ?? '';
        return { tenantId, userId };
    }

    // ── POST /patients/:id/anc-visits ──────────────────────────────────
    app.post<{ Params: { id: string } }>('/', async (request, reply) => {
        const { tenantId, userId } = getUserContext(request);
        if (!tenantId || !userId) return reply.code(401).send({ error: 'Missing tenant/user context' });

        // Validate input
        const parsed = createAncVisitSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
        }

        const patientId = request.params.id;

        // Verify patient exists and user has access
        try {
            const patient = await patientRepo.findById(tenantId, userId, patientId);
            if (!patient) return reply.code(404).send({ error: 'Patient not found' });
        } catch (err: unknown) {
            if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'FORBIDDEN') {
                return reply.code(403).send({ error: err.message });
            }
            throw err;
        }

        // Create the visit — DB trigger computes next_visit_date
        const visit = await visitRepo.create(tenantId, patientId, userId, parsed.data);

        return reply.code(201).send({
            data: {
                ...visit,
                // Explicitly highlight the computed field
                next_visit_date: visit.next_visit_date,
            },
        });
    });

    // ── GET /patients/:id/anc-visits ───────────────────────────────────
    app.get<{ Params: { id: string } }>('/', async (request, reply) => {
        const { tenantId } = getUserContext(request);
        if (!tenantId) return reply.code(401).send({ error: 'Missing tenant context' });

        const visits = await visitRepo.listByPatient(tenantId, request.params.id);
        return reply.send({ data: visits });
    });
}

/**
 * medication.routes.ts — Medication adherence log endpoint
 */
import type { FastifyInstance } from 'fastify';
import { MedicationRepository } from '../repositories/medication.repository.js';
import { logMedicationSchema } from '../schemas/index.js';

export interface MedicationRouteOptions {
    prefix: string;
    medicationRepo: MedicationRepository;
}

export async function medicationRoutes(app: FastifyInstance, opts: MedicationRouteOptions) {
    const repo = opts.medicationRepo;

    function getUserContext(request: { headers: Record<string, string | undefined> }) {
        const tenantId = request.headers['x-tenant-id'] ?? '';
        const userId = request.headers['x-user-id'] ?? '';
        return { tenantId, userId };
    }

    // ── POST /patients/:id/medications/log ─────────────────────────────
    app.post<{ Params: { id: string } }>('/', async (request, reply) => {
        const { tenantId, userId } = getUserContext(request);
        if (!tenantId || !userId) return reply.code(401).send({ error: 'Missing tenant/user context' });

        const parsed = logMedicationSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
        }

        const patientId = request.params.id;
        const result = await repo.log(tenantId, patientId, parsed.data);

        return reply.code(201).send({
            data: {
                log_entry: result.entry,
                adherence_7d: {
                    medication: result.adherence.medication_name,
                    total_doses: result.adherence.total_logs_7d,
                    taken: result.adherence.taken_count,
                    skipped: result.adherence.skipped_count,
                    rate: result.adherence.adherence_rate_7d,
                    rate_percent: `${Math.round(result.adherence.adherence_rate_7d * 100)}%`,
                },
            },
        });
    });
}

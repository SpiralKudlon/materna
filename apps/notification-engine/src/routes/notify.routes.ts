import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { notificationsQueue, emergencySosQueue } from '../queues/index.js';
import type { HighRiskAlertData, AncReminderData } from '../workers/notification.worker.js';
import type { EmergencySosData } from '../workers/emergency.worker.js';

const highRiskSchema = z.object({
    patientId: z.string().uuid(),
    patientPhone: z.string().min(1),
    chvPhone: z.string().min(1),
    chvFcmToken: z.string().optional(),
    facilityId: z.string().uuid(),
    riskScore: z.number(),
    riskTier: z.literal('HIGH'),
    contributingFactors: z.array(z.any()),
});

const ancReminderSchema = z.object({
    patientId: z.string().uuid(),
    patientPhone: z.string().min(1),
    visitDate: z.string().datetime(), // ISO 8601 string
});

const sosSchema = z.object({
    patientId: z.string().uuid(),
    patientPhone: z.string().min(1),
    chvPhone: z.string().min(1),
});

export const notifyRoutes: FastifyPluginAsync = async (app) => {

    app.post('/api/v1/notify/high-risk', async (request, reply) => {
        const parsed = highRiskSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
        }

        const data = parsed.data as HighRiskAlertData;

        // Enqueue immediately for HIGH RISK
        const job = await notificationsQueue.add('HIGH_RISK_ALERT', data, {
            priority: 1, // Highest priority within notifications queue
        });

        app.log.info(`Enqueued HIGH_RISK_ALERT job ${job.id}`);
        return reply.code(202).send({ message: 'High risk alert enqueued', jobId: job.id });
    });

    app.post('/api/v1/notify/anc-reminder', async (request, reply) => {
        const parsed = ancReminderSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
        }

        const data = parsed.data;
        const targetDate = new Date(data.visitDate);
        const now = new Date();

        // Calculate delays
        const t72Delay = targetDate.getTime() - (72 * 60 * 60 * 1000) - now.getTime();
        const t24Delay = targetDate.getTime() - (24 * 60 * 60 * 1000) - now.getTime();

        const jobs = [];

        // Enqueue T-72h if it's in the future
        if (t72Delay > 0) {
            const job72 = await notificationsQueue.add(
                'ANC_REMINDER',
                { ...data, reminderType: 'T-72H' } as AncReminderData,
                { delay: t72Delay, jobId: `reminder-72-${data.patientId}-${data.visitDate}` } // avoid exact duplicates
            );
            jobs.push({ type: 'T-72H', delayMs: t72Delay, jobId: job72.id });
        }

        // Enqueue T-24h if it's in the future
        if (t24Delay > 0) {
            const job24 = await notificationsQueue.add(
                'ANC_REMINDER',
                { ...data, reminderType: 'T-24H' } as AncReminderData,
                { delay: t24Delay, jobId: `reminder-24-${data.patientId}-${data.visitDate}` }
            );
            jobs.push({ type: 'T-24H', delayMs: t24Delay, jobId: job24.id });
        }

        app.log.info(`Enqueued ${jobs.length} ANC reminders for patient ${data.patientId}`);
        return reply.code(202).send({ message: 'Reminders enqueued', scheduled: jobs });
    });

    app.post('/patients/:id/sos', async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = request.body as any;

        const parsed = sosSchema.safeParse({ ...body, patientId: id });
        if (!parsed.success) {
            return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
        }

        const data = parsed.data as EmergencySosData;

        // Enqueue to the dedicated extreme high-priority queue that bypasses normal flow
        const job = await emergencySosQueue.add('SOS_VOICE_CALL', data, {
            lifo: true, // Emergency goes strictly to the front of the queue
        });

        app.log.info(`Enqueued SOS_VOICE_CALL job ${job.id}`);
        return reply.code(202).send({ message: 'Emergency SOS initiated', jobId: job.id });
    });
};

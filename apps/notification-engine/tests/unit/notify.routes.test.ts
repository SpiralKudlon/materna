import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Queue } from 'bullmq';

// Mock BullMQ Queues before they are imported by routes
vi.mock('../../src/queues/index.js', () => ({
    notificationsQueue: {
        add: vi.fn(),
    },
    emergencySosQueue: {
        add: vi.fn(),
    },
}));

import fastify, { FastifyInstance } from 'fastify';
import { notifyRoutes } from '../../src/routes/notify.routes.js';
import { notificationsQueue, emergencySosQueue } from '../../src/queues/index.js';

describe('NotificationEngine Routes', () => {
    let app: FastifyInstance;

    beforeEach(async () => {
        vi.clearAllMocks();
        app = fastify();
        app.register(notifyRoutes);
        await app.ready();
    });

    describe('POST /api/v1/notify/high-risk', () => {
        it('enqueues a high-risk alert properly', async () => {
            (notificationsQueue.add as any).mockResolvedValueOnce({ id: 'job-123' });

            const payload = {
                patientId: '123e4567-e89b-12d3-a456-426614174000',
                patientPhone: '+254700000001',
                chvPhone: '+254700000002',
                facilityId: '123e4567-e89b-12d3-a456-426614174001',
                riskScore: 85,
                riskTier: 'HIGH',
                contributingFactors: [],
            };

            const res = await app.inject({
                method: 'POST',
                url: '/api/v1/notify/high-risk',
                payload,
            });

            expect(res.statusCode).toBe(202);
            expect(notificationsQueue.add).toHaveBeenCalledWith(
                'HIGH_RISK_ALERT',
                payload,
                { priority: 1 }
            );
        });
    });

    describe('POST /api/v1/notify/anc-reminder', () => {
        it('enqueues delayed reminder jobs', async () => {
            (notificationsQueue.add as any).mockResolvedValue({ id: 'delayed-job' });

            // Set visit date exactly 4 days from now
            const targetDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);

            const payload = {
                patientId: '123e4567-e89b-12d3-a456-426614174000',
                patientPhone: '+254700000001',
                visitDate: targetDate.toISOString(),
            };

            const res = await app.inject({
                method: 'POST',
                url: '/api/v1/notify/anc-reminder',
                payload,
            });

            expect(res.statusCode).toBe(202);
            expect(notificationsQueue.add).toHaveBeenCalledTimes(2);

            // T-72h Check
            const call72 = (notificationsQueue.add as any).mock.calls[0];
            expect(call72[0]).toBe('ANC_REMINDER');
            expect(call72[1].reminderType).toBe('T-72H');
            expect(call72[2].delay).toBeGreaterThan(0);

            // T-24h Check
            const call24 = (notificationsQueue.add as any).mock.calls[1];
            expect(call24[0]).toBe('ANC_REMINDER');
            expect(call24[1].reminderType).toBe('T-24H');
            expect(call24[2].delay).toBeGreaterThan(call72[2].delay);
        });
    });

    describe('POST /patients/:id/sos', () => {
        it('enqueues SOS voice call to emergency queue with lifo priority', async () => {
            (emergencySosQueue.add as any).mockResolvedValueOnce({ id: 'sos-job-999' });

            const payload = {
                patientPhone: '+254700000001',
                chvPhone: '+254700000002',
            };

            const res = await app.inject({
                method: 'POST',
                url: '/patients/123e4567-e89b-12d3-a456-426614174000/sos',
                payload,
            });

            expect(res.statusCode).toBe(202);
            expect(emergencySosQueue.add).toHaveBeenCalledWith(
                'SOS_VOICE_CALL',
                {
                    patientId: '123e4567-e89b-12d3-a456-426614174000',
                    ...payload,
                },
                { lifo: true }
            );
        });
    });
});

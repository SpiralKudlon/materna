import { describe, it, expect, vi, beforeEach, afterAll, beforeAll } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import pg from 'pg';
import { smsRoutes } from '../../src/routes/sms.routes.js';
import type { SendResult } from '../../src/services/sms.strategy.js';

// Mock DB Pool
const mockQuery = vi.fn();
const mockRelease = vi.fn();
const mockConnect = vi.fn().mockResolvedValue({ query: mockQuery, release: mockRelease });
const mockPool = { connect: mockConnect } as unknown as pg.Pool;

// Mock SmsBridgeService
const mockSendWithFallback = vi.fn();
const mockSmsService = { sendWithFallback: mockSendWithFallback } as any;

describe('SMS Routes Integration', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = fastify();
        await app.register(smsRoutes, { dbPool: mockPool, smsService: mockSmsService });
        await app.ready();
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('POST /api/v1/sms/send', () => {
        it('validates payload and rejects missing fields', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/api/v1/sms/send',
                payload: { to: '+254700000000' }, // missing message
            });

            expect(res.statusCode).toBe(400);
            const json = res.json();
            expect(json.error).toBe('Validation failed');
        });

        it('orchestrates sending and saves pending state to DB', async () => {
            const sendResult: SendResult = { messageId: 'AT-123', provider: 'AfricasTalking', status: 'Success' };
            mockSendWithFallback.mockResolvedValueOnce(sendResult);
            mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // INSERT

            const payload = { to: '+254700000000', message: 'Hello' };
            const res = await app.inject({
                method: 'POST',
                url: '/api/v1/sms/send',
                payload,
            });

            expect(res.statusCode).toBe(201);
            expect(res.json().data).toEqual(sendResult);

            expect(mockSendWithFallback).toHaveBeenCalledWith(payload.to, payload.message);
            // Verify DB insert called safely and released
            expect(mockConnect).toHaveBeenCalled();
            expect(mockQuery).toHaveBeenCalled();
            const queryCall = mockQuery.mock.calls[0];
            expect(queryCall[0]).toContain('INSERT INTO notifications');
            expect(queryCall[1]).toEqual(['AfricasTalking', 'AT-123', '+254700000000', 'Success']);
            expect(mockRelease).toHaveBeenCalled();
        });

        it('returns 500 if DB insert fails but allows SMS to send (in this impl SMS already sent)', async () => {
            const sendResult: SendResult = { messageId: 'AT-999', provider: 'AfricasTalking', status: 'Success' };
            mockSendWithFallback.mockResolvedValueOnce(sendResult);
            // DB insert fails
            mockQuery.mockRejectedValueOnce(new Error('Connection lost'));

            const res = await app.inject({
                method: 'POST',
                url: '/api/v1/sms/send',
                payload: { to: '+254700000000', message: 'Hello' },
            });

            expect(res.statusCode).toBe(500);
            expect(mockRelease).toHaveBeenCalled(); // Should still release
        });
    });

    describe('POST /webhooks/sms/delivery', () => {
        it("updates status to Delivered for Africa's Talking payload", async () => {
            mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'uuid-1' }] });

            const payload = { id: 'AT-123', status: 'Success' };
            const res = await app.inject({
                method: 'POST',
                url: '/webhooks/sms/delivery',
                payload,
            });

            expect(res.statusCode).toBe(200);

            expect(mockConnect).toHaveBeenCalled();
            const queryCall = mockQuery.mock.calls[0];
            expect(queryCall[0]).toContain('UPDATE notifications SET status = $1 WHERE message_id = $2');
            expect(queryCall[1]).toEqual(['Success', 'AT-123']);
            expect(mockRelease).toHaveBeenCalled();
        });

        it('updates status to failed for Twilio payload', async () => {
            mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'uuid-2' }] });

            const payload = { MessageSid: 'SM123', MessageStatus: 'undelivered' };
            const res = await app.inject({
                method: 'POST',
                url: '/webhooks/sms/delivery',
                payload,
            });

            expect(res.statusCode).toBe(200);

            const queryCall = mockQuery.mock.calls[0];
            expect(queryCall[1]).toEqual(['undelivered', 'SM123']);
        });

        it('returns 400 for unknown webhook schema', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/webhooks/sms/delivery',
                payload: { unknownData: 'whodis' },
            });

            expect(res.statusCode).toBe(400);
            expect(mockConnect).not.toHaveBeenCalled();
        });
    });
});

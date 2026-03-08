import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Pool } from 'pg';
import type { SmsBridgeService } from '../services/sms-bridge.service.js';

export interface SmsRouteOptions {
    dbPool: Pool;
    smsService: SmsBridgeService;
}

const sendSchema = z.object({
    to: z.string().min(1),
    message: z.string().min(1),
});

// Africa's Talking Delivery Receipt
const atWebhookSchema = z.object({
    id: z.string(), // message_id
    status: z.string(), // Success, Failed, Rejected
});

// Twilio Delivery Receipt (Form Url Encoded usually, but if parsed as object)
const twilioWebhookSchema = z.object({
    MessageSid: z.string(),
    MessageStatus: z.string(), // delivered, failed, undelivered
});

export const smsRoutes: FastifyPluginAsync<SmsRouteOptions> = async (app, opts) => {
    const { dbPool, smsService } = opts;

    app.post('/api/v1/sms/send', async (request, reply) => {
        const parsed = sendSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
        }

        const { to, message } = parsed.data;

        try {
            // Call strategy pattern orchestrator
            const result = await smsService.sendWithFallback(to, message);

            // Record into notifications DB
            const { messageId, provider, status } = result;
            const dbClient = await dbPool.connect();
            try {
                await dbClient.query(
                    `INSERT INTO notifications (provider, message_id, phone, status)
                     VALUES ($1, $2, $3, $4)`,
                    [provider, messageId, to, status]
                );
            } finally {
                dbClient.release();
            }

            return reply.code(201).send({ data: result });
        } catch (error: any) {
            app.log.error(`Failed to send SMS to ${to}: ${error.message}`);
            return reply.code(500).send({ error: 'SMS delivery failed' });
        }
    });

    // Unified Webhook endpoint for Delivery Receipts
    app.post('/webhooks/sms/delivery', async (request, reply) => {
        const body = request.body as any;

        let messageId: string | undefined;
        let finalStatus: string | undefined;

        // Detect AT webhook vs Twilio webhook
        const atParsed = atWebhookSchema.safeParse(body);
        const twilioParsed = twilioWebhookSchema.safeParse(body);

        if (atParsed.success) {
            messageId = atParsed.data.id;
            finalStatus = atParsed.data.status;
        } else if (twilioParsed.success) {
            messageId = twilioParsed.data.MessageSid;
            finalStatus = twilioParsed.data.MessageStatus;
        } else {
            app.log.warn('Received unrecognized webhook payload');
            return reply.code(400).send({ error: 'Unrecognized payload' });
        }

        try {
            const dbClient = await dbPool.connect();
            try {
                // Update the notification status based on message_id
                const result = await dbClient.query(
                    `UPDATE notifications SET status = $1 WHERE message_id = $2 RETURNING id`,
                    [finalStatus, messageId]
                );

                if (result.rowCount === 0) {
                    app.log.warn(`Webhook received for unknown message_id: ${messageId}`);
                } else {
                    app.log.info(`Updated message ${messageId} to status ${finalStatus}`);
                }
            } finally {
                dbClient.release();
            }

            // Always return 200 OK so provider stops retrying the webhook
            return reply.code(200).send({ status: 'ok' });
        } catch (error: any) {
            app.log.error(`Webhook DB update failed: ${error.message}`);
            return reply.code(500).send({ error: 'Internal Server Error' });
        }
    });
};

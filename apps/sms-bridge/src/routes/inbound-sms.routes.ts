import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { SmsParserService } from '../services/sms-parser.service.js';

/**
 * Africa's Talking Inbound SMS Payload Schema
 * Content-Type: application/x-www-form-urlencoded
 */
const inboundSmsSchema = z.object({
    from: z.string(),
    to: z.string(),
    text: z.string(),
    date: z.string(),
    id: z.string(),
});

export const inboundSmsRoutes: FastifyPluginAsync = async (app) => {
    app.post('/api/v1/sms/inbound', async (request, reply) => {
        const payload = inboundSmsSchema.parse(request.body);

        // Parse the raw generic string
        const command = SmsParserService.parseIncomingSms(payload.text);

        let responseMsg = '';

        if (command.type === 'STATUS') {
            // Mock implicit backend check
            responseMsg = 'Your current Pregnancy Risk Status is LOW. Keep taking your supplements.';
        } else if (command.type === 'LOG_SYMPTOM') {
            // Process the symptom mapping
            responseMsg = `Alert received: Logged symptom ${command.symptom} (${command.severity || 'UNKNOWN'}). A CHV will review shortly.`;
        } else {
            responseMsg = `Command unknown. Reply with "STATUS" or "LOG <symptom> <severity>".`;
        }

        // Africa's Talking requires a 200 OK for Webhooks.
        // It does not automatically send 'responseMsg' back natively out-of-band via just HTTP text,
        // but for some configurations or gateways, returning application/json or plain text handles it.
        // We will just log it and return 200 OK. Typically, an outbound SMS API call is fired here to reply.
        console.log(`[INBOUND SMS] From: ${payload.from} | Command: ${JSON.stringify(command)}`);

        // Simulating the outbound response triggered automatically:
        console.log(`[OUTBOUND SMS] To: ${payload.from} | Msg: ${responseMsg}`);

        return reply.code(200).send({ success: true, message: 'Inbound processed' });
    });
};

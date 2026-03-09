import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { UssdService } from '../services/ussd.service.js';

/**
 * Africa's Talking USSD Payload Schema
 * Content-Type: application/x-www-form-urlencoded
 */
const ussdPayloadSchema = z.object({
    sessionId: z.string(),
    phoneNumber: z.string(),
    networkCode: z.string(),
    serviceCode: z.string(),
    text: z.string().optional().default(''),
});

export const ussdRoutes: FastifyPluginAsync = async (app) => {

    // AT expects form-urlencoded. Fastify requires `@fastify/formbody` plugin which is already in the server
    app.post('/api/v1/ussd/callback', async (request, reply) => {
        console.log('[USSD RAW BODY]', request.body);
        const payload = ussdPayloadSchema.parse(request.body);

        const responseText = await UssdService.handleUssdCallback(
            payload.sessionId,
            payload.phoneNumber,
            payload.text
        );

        // Africa's Talking USSD explicitly requires Content-Type: text/plain
        // and the physical body MUST begin with CON or END.
        return reply
            .header('Content-Type', 'text/plain')
            .send(responseText);
    });
};

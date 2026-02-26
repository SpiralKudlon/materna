import type { FastifyRequest, FastifyReply } from 'fastify';
import { authService } from '../services/auth.service.js';
import { registerSchema } from '../schemas/auth.schema.js';

export const registerController = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const data = registerSchema.parse(request.body);
        const user = await authService.register(data);
        return reply.code(201).send({ data: user });
    } catch (error: any) {
        if (error.name === 'ZodError') {
            return reply.code(400).send({ error: 'Validation failed', details: error.errors });
        }
        if (error.message === 'User already exists') {
            return reply.code(409).send({ error: error.message });
        }
        request.log.error(error);
        return reply.code(500).send({ error: 'Internal server error' });
    }
};

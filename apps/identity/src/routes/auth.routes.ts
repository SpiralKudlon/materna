import type { FastifyInstance } from 'fastify';
import { registerController } from '../controllers/auth.controller.js';

export async function authRoutes(fastify: FastifyInstance) {
    fastify.post('/register', registerController);
}

import type { FastifyInstance } from 'fastify';
import type { AuthService } from '../services/auth.service.js';
import { makeAuthController } from '../controllers/auth.controller.js';

export async function authRoutes(
    fastify: FastifyInstance,
    opts: { authService: AuthService },
) {
    const { register, login } = makeAuthController(opts.authService);

    // POST /api/v1/auth/register
    fastify.post('/register', {
        schema: {
            body: {
                type: 'object',
                required: ['email', 'password', 'name', 'role'],
                properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 8 },
                    name: { type: 'string', minLength: 2 },
                    role: { type: 'string', enum: ['PATIENT', 'CHV', 'PROVIDER', 'ADMIN'] },
                },
            },
            response: {
                201: {
                    type: 'object',
                    properties: {
                        data: {
                            type: 'object',
                            properties: {
                                id: { type: 'string' },
                                email: { type: 'string' },
                                name: { type: 'string' },
                                role: { type: 'string' },
                                keycloak_id: { type: 'string' },
                            },
                        },
                    },
                },
            },
        },
    }, register);

    // POST /api/v1/auth/login
    fastify.post('/login', {
        schema: {
            body: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 1 },
                },
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        data: {
                            type: 'object',
                            properties: {
                                access_token: { type: 'string' },
                                refresh_token: { type: 'string' },
                                token_type: { type: 'string' },
                                expires_in: { type: 'number' },
                                refresh_expires_in: { type: 'number' },
                            },
                        },
                    },
                },
            },
        },
    }, login);
}

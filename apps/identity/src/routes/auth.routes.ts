import type { FastifyInstance } from 'fastify';
import type { AuthService } from '../services/auth.service.js';
import type { PasswordResetService } from '../services/password-reset.service.js';
import { makeAuthController } from '../controllers/auth.controller.js';
import { makePasswordResetController } from '../controllers/password-reset.controller.js';

export async function authRoutes(
    fastify: FastifyInstance,
    opts: { authService: AuthService; passwordResetService: PasswordResetService },
) {
    const { register, login } = makeAuthController(opts.authService);
    const { forgotPassword, resetPassword } = makePasswordResetController(
        opts.passwordResetService,
    );

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

    // POST /api/v1/auth/forgot-password
    fastify.post('/forgot-password', {
        schema: {
            body: {
                type: 'object',
                required: ['phone'],
                properties: {
                    phone: { type: 'string', minLength: 10 },
                },
            },
        },
    }, forgotPassword);

    // POST /api/v1/auth/reset-password
    fastify.post('/reset-password', {
        schema: {
            body: {
                type: 'object',
                required: ['phone', 'otp', 'new_password'],
                properties: {
                    phone: { type: 'string', minLength: 10 },
                    otp: { type: 'string', minLength: 6, maxLength: 6 },
                    new_password: { type: 'string', minLength: 8 },
                },
            },
        },
    }, resetPassword);
}

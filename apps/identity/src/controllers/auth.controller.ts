import type { FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { registerSchema, loginSchema } from '../schemas/auth.schema.js';
import { AuthService, ConflictError, UnauthorizedError } from '../services/auth.service.js';

// ─── Controller factory ───────────────────────────────────────────────────
// The AuthService is constructed by app.ts and injected here at route
// registration time, keeping controllers free of global singletons.

export function makeAuthController(authService: AuthService) {
    // ── POST /api/v1/auth/register ─────────────────────────────────────────
    const register = async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const input = registerSchema.parse(request.body);
            const user = await authService.register(input);
            return reply.code(201).send({ data: user });
        } catch (err: unknown) {
            if (err instanceof ZodError) {
                return reply.code(400).send({
                    error: 'Validation failed',
                    details: err.errors.map((e) => ({
                        field: e.path.join('.'),
                        message: e.message,
                    })),
                });
            }
            if (err instanceof ConflictError) {
                return reply.code(409).send({ error: err.message });
            }
            request.log.error({ err }, 'register failed');
            return reply.code(500).send({ error: 'Internal server error' });
        }
    };

    // ── POST /api/v1/auth/login ────────────────────────────────────────────
    const login = async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const input = loginSchema.parse(request.body);
            const tokens = await authService.login(input);
            return reply.code(200).send({ data: tokens });
        } catch (err: unknown) {
            if (err instanceof ZodError) {
                return reply.code(400).send({
                    error: 'Validation failed',
                    details: err.errors.map((e) => ({
                        field: e.path.join('.'),
                        message: e.message,
                    })),
                });
            }
            if (err instanceof UnauthorizedError) {
                return reply.code(401).send({ error: err.message });
            }
            request.log.error({ err }, 'login failed');
            return reply.code(500).send({ error: 'Internal server error' });
        }
    };

    return { register, login };
}

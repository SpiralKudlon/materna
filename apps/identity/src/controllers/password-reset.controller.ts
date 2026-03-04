/**
 * password-reset.controller.ts — Controller for forgot/reset password endpoints.
 */
import type { FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { forgotPasswordSchema, resetPasswordSchema } from '../schemas/auth.schema.js';
import type { PasswordResetService } from '../services/password-reset.service.js';

export function makePasswordResetController(service: PasswordResetService) {
    // ── POST /api/v1/auth/forgot-password ──────────────────────────────────
    const forgotPassword = async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const input = forgotPasswordSchema.parse(request.body);
            const result = await service.forgotPassword(input);
            return reply.code(200).send({
                data: {
                    sent: result.sent,
                    message: 'If the phone number is registered, an OTP has been sent.',
                },
            });
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
            request.log.error({ err }, 'forgot-password failed');
            return reply.code(500).send({ error: 'Internal server error' });
        }
    };

    // ── POST /api/v1/auth/reset-password ───────────────────────────────────
    const resetPassword = async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const input = resetPasswordSchema.parse(request.body);
            const result = await service.resetPassword(input);

            if (!result.success) {
                // Map OTP failure reasons to HTTP status codes
                const statusMap: Record<string, number> = {
                    'OTP expired or not found': 400,
                    'Invalid OTP': 400,
                    'Maximum OTP attempts exceeded': 429,
                    'User not found': 404,
                };
                const status = statusMap[result.reason ?? ''] ?? 400;
                return reply.code(status).send({ error: result.reason });
            }

            return reply.code(200).send({
                data: { message: 'Password has been reset successfully.' },
            });
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
            request.log.error({ err }, 'reset-password failed');
            return reply.code(500).send({ error: 'Internal server error' });
        }
    };

    return { forgotPassword, resetPassword };
}

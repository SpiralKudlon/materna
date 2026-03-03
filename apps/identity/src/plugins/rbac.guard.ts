/**
 * rbac.guard.ts — Role-Based Access Control decorator for Fastify routes.
 *
 * Usage in route definitions:
 *
 *   fastify.get(
 *     '/admin/users',
 *     { preHandler: rbac('ADMIN') },
 *     controller.listUsers,
 *   );
 *
 *   // Multiple allowed roles (OR logic):
 *   fastify.get(
 *     '/patients',
 *     { preHandler: rbac('PROVIDER', 'ADMIN') },
 *     controller.listPatients,
 *   );
 */
import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import type { UserRole } from '../schemas/auth.schema.js';

/**
 * Returns a Fastify preHandler hook that verifies `request.user.roles`
 * contains **at least one** of the required roles.
 *
 * If `request.user` is not populated (JWT plugin was skipped, e.g. on a
 * public route), it returns 401 immediately.
 */
export function rbac(...allowedRoles: UserRole[]) {
    return function rbacGuard(
        request: FastifyRequest,
        reply: FastifyReply,
        done: HookHandlerDoneFunction,
    ): void {
        // If JWT plugin did not populate the user, treat as unauthenticated
        if (!request.user) {
            request.log.warn(
                { requestId: request.id, path: request.url },
                'RBAC_DENIED: No authenticated user on a protected route',
            );
            reply.code(401).send({ error: 'Authentication required' });
            return;
        }

        const userRoles = request.user.roles.map((r) => r.toUpperCase());
        const hasRole = allowedRoles.some((role) => userRoles.includes(role));

        if (!hasRole) {
            request.log.warn(
                {
                    requestId: request.id,
                    userId: request.user.sub,
                    userRoles: request.user.roles,
                    requiredRoles: allowedRoles,
                    path: request.url,
                },
                'RBAC_DENIED: Insufficient permissions',
            );
            reply.code(403).send({
                error: 'Forbidden',
                message: `One of the following roles is required: ${allowedRoles.join(', ')}`,
            });
            return;
        }

        done();
    };
}

/**
 * gatekeeper.plugin.ts — Default-deny authentication gatekeeper.
 *
 * ALL routes are protected by JWT verification by default.
 * Only explicitly whitelisted paths (e.g. /health, /api/v1/auth/login,
 * /api/v1/auth/register) are accessible without a valid token.
 *
 * This is registered as a Fastify onRequest hook (runs before any handler).
 */
import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export interface GatekeeperOptions {
    /**
     * Exact route URLs that skip JWT verification.
     * Supports both exact paths and prefix matching (ending with `/*`).
     *
     * Example: ['/health', '/api/v1/auth/*']
     */
    publicPaths: string[];
}

function isPublic(url: string, publicPaths: string[]): boolean {
    for (const pattern of publicPaths) {
        if (pattern.endsWith('/*')) {
            const prefix = pattern.slice(0, -1); // remove trailing *
            if (url.startsWith(prefix) || url === prefix.slice(0, -1)) return true;
        } else {
            if (url === pattern) return true;
        }
    }
    return false;
}

async function gatekeeperPlugin(
    fastify: FastifyInstance,
    opts: GatekeeperOptions,
): Promise<void> {
    fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
        // Strip query string for matching
        const urlPath = request.url.split('?')[0] ?? request.url;

        if (isPublic(urlPath, opts.publicPaths)) {
            return; // whitelisted — skip JWT
        }

        // Delegate to the JWT plugin's verifyJwtToken decorator
        const verifyJwtToken = (fastify as unknown as {
            verifyJwtToken: (req: FastifyRequest, rep: FastifyReply) => Promise<void>;
        }).verifyJwtToken;

        if (typeof verifyJwtToken !== 'function') {
            request.log.error(
                'GATEKEEPER: JWT plugin not registered — cannot verify tokens. Blocking request.',
            );
            return reply.code(500).send({ error: 'Authentication service misconfigured' });
        }

        await verifyJwtToken(request, reply);
    });
}

export default fp(gatekeeperPlugin, {
    name: 'gatekeeper',
    fastify: '4.x',
    dependencies: ['jwt-keycloak'],
});

/**
 * jwt.plugin.ts — Fastify plugin for Keycloak JWT verification.
 *
 * Uses the JWKS endpoint to fetch Keycloak's public signing keys at runtime,
 * so the service never needs a hard-coded REALM_PUBLIC_KEY. Keys are cached
 * with an automatic rotation check (jwks-rsa handles the refresh).
 *
 * On every request the plugin:
 *   1. Extracts the Bearer token from the Authorization header.
 *   2. Decodes the JWT header to find the `kid`.
 *   3. Fetches the matching public key from the JWKS endpoint.
 *   4. Verifies signature, issuer, audience, and expiration.
 *   5. Decodes realm roles from the token and attaches them to `request.user`.
 */
import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as crypto from 'node:crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export interface JwtUser {
    sub: string;
    email: string;
    name: string;
    preferred_username: string;
    roles: string[];
    /** Raw decoded token payload for advanced checks */
    raw: Record<string, unknown>;
}

declare module 'fastify' {
    interface FastifyRequest {
        user: JwtUser;
    }
}

export interface JwtPluginOptions {
    /** Full URL to the Keycloak realm JWKS endpoint */
    jwksUri: string;
    /** Expected `iss` claim */
    issuer: string;
    /** Expected `aud` claim (api-server client_id) */
    audience: string;
    /** Route prefixes / paths that skip JWT verification */
    publicPaths?: string[];
}

// ── Minimal JWKS client ────────────────────────────────────────────────────
// We avoid heavy deps by implementing a tiny JWKS fetcher with caching.

interface JwksKey {
    kid: string;
    kty: string;
    n: string;
    e: string;
    alg: string;
    use: string;
}

class JwksClient {
    private keys: Map<string, crypto.KeyObject> = new Map();
    private lastFetch = 0;
    private readonly cacheTtlMs = 10 * 60 * 1000; // 10 min

    constructor(private readonly jwksUri: string) { }

    async getSigningKey(kid: string): Promise<crypto.KeyObject> {
        const cached = this.keys.get(kid);
        if (cached && Date.now() - this.lastFetch < this.cacheTtlMs) {
            return cached;
        }

        const res = await fetch(this.jwksUri);
        if (!res.ok) throw new Error(`JWKS fetch failed (${res.status})`);

        const data = (await res.json()) as { keys: JwksKey[] };
        this.keys.clear();

        for (const key of data.keys) {
            if (key.kty !== 'RSA' || key.use !== 'sig') continue;
            const publicKey = crypto.createPublicKey({
                key: {
                    kty: key.kty,
                    n: key.n,
                    e: key.e,
                },
                format: 'jwk',
            });
            this.keys.set(key.kid, publicKey);
        }

        this.lastFetch = Date.now();

        const signingKey = this.keys.get(kid);
        if (!signingKey) throw new Error(`Signing key ${kid} not found in JWKS response`);
        return signingKey;
    }
}

// ── Base64url helpers ─────────────────────────────────────────────────────

function base64urlDecode(str: string): Buffer {
    const padded = str.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(padded, 'base64');
}

function decodeJwtPart(part: string): Record<string, unknown> {
    return JSON.parse(base64urlDecode(part).toString('utf8')) as Record<string, unknown>;
}

// ── Manual JWT verification ───────────────────────────────────────────────

function verifyJwt(
    token: string,
    publicKey: crypto.KeyObject,
    options: { issuer: string; audience: string },
): Record<string, unknown> {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Malformed JWT – expected 3 segments');

    const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];
    const header = decodeJwtPart(headerB64);
    const payload = decodeJwtPart(payloadB64);

    // Algorithm check
    if (header.alg !== 'RS256') throw new Error(`Unsupported algorithm: ${String(header.alg)}`);

    // Signature verification
    const signedData = `${headerB64}.${payloadB64}`;
    const signature = base64urlDecode(signatureB64);
    const isValid = crypto.createVerify('RSA-SHA256')
        .update(signedData)
        .verify(publicKey, signature);
    if (!isValid) throw new Error('Invalid JWT signature');

    // Expiration
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === 'number' && payload.exp < now) {
        throw new Error('Token expired');
    }

    // Not-before
    if (typeof payload.nbf === 'number' && payload.nbf > now) {
        throw new Error('Token not yet valid');
    }

    // Issuer
    if (payload.iss !== options.issuer) {
        throw new Error(`Invalid issuer: ${String(payload.iss)}`);
    }

    // Audience — Keycloak puts audience in `aud` (string or array)
    const aud = payload.aud;
    const audArray = Array.isArray(aud) ? aud : [aud];
    if (!audArray.includes(options.audience)) {
        // Also check azp (authorized party) as Keycloak sometimes uses it
        if (payload.azp !== options.audience) {
            throw new Error(`Invalid audience: ${String(payload.aud)}`);
        }
    }

    return payload;
}

// ── Plugin ─────────────────────────────────────────────────────────────────

async function jwtPlugin(fastify: FastifyInstance, opts: JwtPluginOptions): Promise<void> {
    const jwks = new JwksClient(opts.jwksUri);
    const publicPaths = new Set(opts.publicPaths ?? []);

    // Expose a `verifyJwtToken` decorator for route-level use
    fastify.decorate('verifyJwtToken', async function verify(
        request: FastifyRequest,
        reply: FastifyReply,
    ) {
        // Skip public paths
        if (publicPaths.has(request.routeOptions.url ?? request.url)) return;

        const authHeader = request.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            request.log.warn({ requestId: request.id }, 'AUTH_FAILED: Missing Bearer token');
            return reply.code(401).send({ error: 'Missing or malformed Authorization header' });
        }

        const token = authHeader.slice(7);

        try {
            // Decode header to get kid
            const headerPart = token.split('.')[0];
            if (!headerPart) throw new Error('Malformed JWT');
            const header = decodeJwtPart(headerPart);
            const kid = header.kid as string | undefined;
            if (!kid) throw new Error('JWT header missing kid');

            const publicKey = await jwks.getSigningKey(kid);
            const payload = verifyJwt(token, publicKey, {
                issuer: opts.issuer,
                audience: opts.audience,
            });

            // Extract Keycloak realm roles
            const realmAccess = payload.realm_access as { roles?: string[] } | undefined;
            const roles = realmAccess?.roles ?? [];

            request.user = {
                sub: payload.sub as string,
                email: (payload.email ?? '') as string,
                name: (payload.name ?? '') as string,
                preferred_username: (payload.preferred_username ?? '') as string,
                roles,
                raw: payload,
            };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Token verification failed';
            request.log.warn(
                { requestId: request.id, error: message },
                `AUTH_FAILED: ${message}`,
            );
            return reply.code(401).send({ error: 'Invalid or expired token' });
        }
    });
}

export default fp(jwtPlugin, {
    name: 'jwt-keycloak',
    fastify: '4.x',
});

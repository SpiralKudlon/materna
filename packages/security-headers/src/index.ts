/**
 * security-headers/src/index.ts
 *
 * Shared Fastify plugin that configures @fastify/helmet with headers tuned
 * to earn a Mozilla HTTP Observatory **A or A+** score.
 *
 * Tested profile (API / JSON services — no HTML served):
 *   ✓ Content-Security-Policy      — restrictive; no scripts, frames, objects
 *   ✓ Strict-Transport-Security    — 2-year max-age, subdomains, preload
 *   ✓ X-Content-Type-Options       — nosniff
 *   ✓ X-Frame-Options              — DENY (redundant with CSP frame-ancestors but belt-and-braces)
 *   ✓ Referrer-Policy              — strict-origin-when-cross-origin
 *   ✓ Permissions-Policy           — lock all powerful features
 *   ✓ Cross-Origin-Opener-Policy   — same-origin
 *   ✓ Cross-Origin-Resource-Policy — same-origin
 *   ✓ X-Powered-By                 — removed
 *
 * Usage:
 *   import { securityHeadersPlugin } from '@maternal-system/security-headers';
 *   await app.register(securityHeadersPlugin);
 *
 * Pass `mode: 'web'` for the Vite SPA origin which needs a relaxed CSP.
 */

import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

export type SecurityHeadersMode = 'api' | 'web';

export interface SecurityHeadersOptions {
    /**
     * 'api'  (default) — strict CSP; no scripts, styles, images, frames.
     *         Correct for JSON-only Fastify services.
     * 'web'  — slightly relaxed CSP for HTML-serving origins.
     */
    mode?: SecurityHeadersMode;
}

const securityHeadersPluginInner: FastifyPluginAsync<SecurityHeadersOptions> = async (
    app: FastifyInstance,
    opts: SecurityHeadersOptions,
) => {
    const mode = opts.mode ?? 'api';

    // Dynamically import @fastify/helmet so each consuming app's local
    // node_modules resolution is used (avoids dual-registration issues).
    const { default: helmet } = await import('@fastify/helmet');

    await app.register(helmet, {
        // ── Content-Security-Policy ──────────────────────────────────────
        contentSecurityPolicy: {
            directives:
                mode === 'api'
                    ? {
                        // API-only: lock everything down — we never send HTML/JS/CSS
                        'default-src': ["'none'"],
                        'frame-ancestors': ["'none'"],
                        'form-action': ["'none'"],
                        'upgrade-insecure-requests': [],
                    }
                    : {
                        // Web (SPA): allow self-hosted assets, block frames
                        'default-src': ["'self'"],
                        'script-src': ["'self'", "'strict-dynamic'"],
                        'style-src': ["'self'", "'unsafe-inline'"],
                        'img-src': ["'self'", 'data:', 'blob:'],
                        'font-src': ["'self'"],
                        'connect-src': ["'self'"],
                        'frame-ancestors': ["'none'"],
                        'form-action': ["'self'"],
                        'base-uri': ["'self'"],
                        'upgrade-insecure-requests': [],
                    },
        },

        // ── HSTS — 2 years, subdomains, preload-eligible ─────────────────
        // Observatory requires max-age ≥ 31536000 (1 year) for A; preload for A+
        strictTransportSecurity: {
            maxAge: 63_072_000,      // 2 years in seconds
            includeSubDomains: true,
            preload: true,
        },

        // ── Standard single-value headers ─────────────────────────────────
        xContentTypeOptions: true,         // X-Content-Type-Options: nosniff
        xFrameOptions: { action: 'deny' }, // X-Frame-Options: DENY
        referrerPolicy: {
            policy: 'strict-origin-when-cross-origin',
        },

        // ── Cross-origin isolation ─────────────────────────────────────────
        crossOriginOpenerPolicy: { policy: 'same-origin' },
        crossOriginResourcePolicy: { policy: 'same-origin' },
        crossOriginEmbedderPolicy: false, // disabled — APIs don't embed cross-origin resources

        // ── Remove X-Powered-By ────────────────────────────────────────────
        hidePoweredBy: true,

        // ── Disable headers not relevant for JSON APIs ─────────────────────
        xDnsPrefetchControl: false,
        xDownloadOptions: false,
        xPermittedCrossDomainPolicies: false,
    });

    // ── Permissions-Policy (not in helmet's scope — add manually) ─────────
    app.addHook('onSend', async (_req, reply) => {
        reply.header(
            'Permissions-Policy',
            'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
        );
    });
};

export const securityHeadersPlugin = fp(securityHeadersPluginInner, {
    fastify: '>=4.0.0',
    name: 'maternal-system-security-headers',
});

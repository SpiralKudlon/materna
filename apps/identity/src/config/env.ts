/**
 * env.ts — centralised, Zod-validated environment configuration.
 * All secrets are read from process.env; the app refuses to start if any
 * required variable is absent or mis-formatted.
 */
import { z } from 'zod';

const envSchema = z.object({
    /** Fastify */
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(3000),
    HOST: z.string().default('0.0.0.0'),

    /** PostgreSQL (Sprint-1 instance) */
    DATABASE_URL: z
        .string()
        .url()
        .describe('Full Postgres connection string: postgres://user:pass@host:5432/dbname'),

    /** Keycloak */
    KEYCLOAK_BASE_URL: z
        .string()
        .url()
        .describe('e.g. https://auth.maternal-system.example.com'),
    KEYCLOAK_REALM: z.string().default('maternal-system'),
    KEYCLOAK_CLIENT_ID: z.string().default('api-server'),
    CLIENT_SECRET: z
        .string()
        .min(1)
        .describe('Confidential client secret from Keycloak / ExternalSecret'),
    /** Admin credentials — only needed for user provisioning in Keycloak */
    KEYCLOAK_ADMIN_CLIENT_ID: z.string().default('admin-cli'),
    KEYCLOAK_ADMIN_USERNAME: z.string().min(1),
    KEYCLOAK_ADMIN_PASSWORD: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
        console.error('❌  Invalid environment variables:\n', result.error.format());
        process.exit(1);
    }
    return result.data;
}

export const env = loadEnv();

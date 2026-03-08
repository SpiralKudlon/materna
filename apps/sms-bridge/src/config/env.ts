import { z } from 'zod';

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(3003),
    HOST: z.string().default('0.0.0.0'),

    /** PostgreSQL (for storing delivery webhooks) */
    DATABASE_URL: z
        .string()
        .url()
        .describe('Postgres connection string: postgres://user:pass@host:5432/dbname'),

    /** HashiCorp Vault */
    VAULT_ADDR: z.string().url().default('http://127.0.0.1:8200'),
    VAULT_TOKEN: z.string().min(1, 'Vault token is required for sms-bridge'),
    VAULT_SECRET_PATH: z.string().default('secret/data/maternal-system/sms'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
    // In actual deployment, if variables are missing, process.env parsing will fail
    // For test environments, we allow overriding via process.env directly
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
        console.error('❌ Invalid environment variables:\n', result.error.format());
        process.exit(1);
    }
    return result.data;
}

export const env = loadEnv();

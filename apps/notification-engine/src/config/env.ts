import { z } from 'zod';

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(3004),
    HOST: z.string().default('0.0.0.0'),

    // Redis for BullMQ
    REDIS_URL: z.string().default('redis://localhost:6379'),

    // Postgres Template DB
    DATABASE_URL: z.string().url().describe('Postgres connection string: postgres://user:pass@host:5432/dbname'),

    // AT configurations
    AT_API_KEY: z.string().min(1, "Africa's Talking API key required"),
    AT_USERNAME: z.string().min(1, "Africa's Talking Username required"),
    AT_VIRTUAL_NUMBER: z.string().optional().describe('Used for voice calls/sender ID'),

    // Firebase configurations
    FIREBASE_PROJECT_ID: z.string().optional(),
    FIREBASE_PRIVATE_KEY: z.string().optional(),
    FIREBASE_CLIENT_EMAIL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
    // During tests, allow overriding without strict checks breaking the runner
    if (process.env.NODE_ENV === 'test') {
        const result = envSchema.safeParse(process.env);
        return result.success ? result.data : (process.env as any);
    }

    const result = envSchema.safeParse(process.env);
    if (!result.success) {
        console.error('❌  Invalid environment variables:\n', result.error.format());
        process.exit(1);
    }
    return result.data;
}

export const env = loadEnv();

import { z } from 'zod';

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3001),
    HOST: z.string().default('0.0.0.0'),
    DATABASE_URL: z.string().url(),
    KAFKA_BROKERS: z.string().optional().describe('Comma-separated list of Kafka brokers'),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;

import { Redis } from 'ioredis';
import { env } from './env.js';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
    if (!redisClient) {
        redisClient = new Redis(env.REDIS_URL, {
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            retryStrategy(times: number) {
                const delay = Math.min(times * 50, 2000);
                return delay;
            }
        });

        redisClient.on('error', (err: any) => {
            console.error('Redis Client Error', err);
        });

        redisClient.on('ready', () => {
            console.log('Redis Client Ready');
        });
    }

    return redisClient;
}

export async function closeRedisClient(): Promise<void> {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
    }
}

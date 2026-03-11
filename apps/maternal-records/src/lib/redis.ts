/**
 * redis.ts — singleton ioredis client
 * Imports the named `Redis` class which resolves correctly under Node16 moduleResolution.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Redis } = require('ioredis') as { Redis: typeof import('ioredis').Redis };

let _client: import('ioredis').Redis | null = null;

export function getRedisClient(): import('ioredis').Redis {
  if (!_client) {
    _client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      lazyConnect: false,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times: number) => Math.min(times * 100, 3000),
    });

    _client.on('error', (err: Error) => {
      console.error('[Redis] connection error', err.message);
    });
  }
  return _client;
}

export async function closeRedisClient(): Promise<void> {
  if (_client) {
    await _client.quit();
    _client = null;
  }
}

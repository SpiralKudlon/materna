/**
 * cache.service.ts — typed Redis cache helper
 */
import type { Redis } from 'ioredis';

export class CacheService {
  constructor(private readonly redis: Redis) {}

  async getOrSet<T>(key: string, ttlSec: number, fetcher: () => Promise<T>): Promise<T> {
    try {
      const cached = await this.redis.get(key);
      if (cached !== null) {
        return JSON.parse(cached) as T;
      }
    } catch (err: unknown) {
      console.warn(`[Cache] read error for key "${key}":`, (err as Error).message);
    }

    const value = await fetcher();

    this.redis.set(key, JSON.stringify(value), 'EX', ttlSec).catch((err: unknown) => {
      console.warn(`[Cache] write error for key "${key}":`, (err as Error).message);
    });

    return value;
  }

  async invalidate(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (err: unknown) {
      console.warn(`[Cache] invalidate error for key "${key}":`, (err as Error).message);
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor, 'MATCH', pattern, 'COUNT', 100,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } while (cursor !== '0');
    } catch (err: unknown) {
      console.warn(`[Cache] invalidatePattern error for "${pattern}":`, (err as Error).message);
    }
  }
}

export const CacheKeys = {
  patient: (tenantId: string, patientId: string) => `patient:${tenantId}:${patientId}`,
  chvDashboard: (chvId: string) => `chv:dashboard:${chvId}`,
  facilityNearest: (tenantId: string, lat: number, lon: number, limit: number) =>
    `facility:nearest:${tenantId}:${lat}:${lon}:${limit}`,
  facilityDashboard: (facilityId: string) => `facility:dashboard:${facilityId}`,
  facilityNearestPattern: (tenantId: string) => `facility:nearest:${tenantId}:*`,
} as const;

export const CacheTTL = {
  PATIENT: 300,
  CHV_DASHBOARD: 60,
  FACILITY: 600,
} as const;

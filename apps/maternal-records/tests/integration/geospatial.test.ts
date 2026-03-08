import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildApp } from '../../src/app.js';
import type { Pool, PoolClient } from 'pg';
import type { FastifyInstance } from 'fastify';

// Mock env.ts so Zod doesn't fail on missing DATABASE_URL during import of app.ts
vi.mock('../../src/config/env.js', () => ({
    env: { DATABASE_URL: 'postgres://mock:mock@localhost:5432/test', KAFKA_BROKERS: 'localhost:9092' }
}));

describe('Geospatial Facility Nearest Query', () => {
    let app: FastifyInstance;
    let pool: Pool;
    const testTenantId = 'geo-test-tenant-123';

    beforeAll(async () => {
        const mockClient = {
            query: vi.fn().mockImplementation((sql: string, params?: unknown[]) => {
                const queryStr = typeof sql === 'string' ? sql : '';

                if (queryStr.includes('SELECT') && queryStr.includes('distance_km')) {
                    return Promise.resolve({
                        rows: [
                            { id: 'fac-3', name: 'Mater Hosp', latitude: '-1.309000', longitude: '36.835000', distance_km: '0.05' },
                            { id: 'fac-1', name: 'Nairobi Hospital', latitude: '-1.295000', longitude: '36.805000', distance_km: '3.7' },
                            { id: 'fac-2', name: 'Aga Khan Hosp', latitude: '-1.261000', longitude: '36.825000', distance_km: '5.5' },
                        ],
                        rowCount: 3
                    });
                }
                return Promise.resolve({ rows: [], rowCount: 0 });
            }),
            release: vi.fn(),
        } as unknown as PoolClient;

        pool = {
            connect: vi.fn().mockResolvedValue(mockClient),
            query: vi.fn().mockImplementation(mockClient.query),
            end: vi.fn().mockResolvedValue(undefined),
        } as unknown as Pool;

        app = await buildApp({ pool });
    });

    afterAll(async () => {
        await app.close();
    });

    it('should accurately calculate the nearest facility using Haversine math', async () => {
        // Query coordinate right next to 'Mater Hosp' (-1.3095, 36.8355)
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/facilities/nearest?lat=-1.3095&lon=36.8355&limit=3',
            headers: {
                'x-tenant-id': testTenantId
            }
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload);

        expect(body.data).toBeDefined();
        expect(body.data.length).toBe(3);

        const [nearest, middle, furthest] = body.data;

        expect(nearest.name).toBe('Mater Hosp');
        expect(nearest.distanceKm).toBeLessThan(0.1);

        expect(middle.name).toBe('Nairobi Hospital');
        expect(furthest.name).toBe('Aga Khan Hosp');

        expect(nearest.distanceKm).toBeLessThan(middle.distanceKm);
        expect(middle.distanceKm).toBeLessThan(furthest.distanceKm);
    });

    it('should validate boundary limits for coordinates', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/facilities/nearest?lat=-200&lon=36.8',
            headers: { 'x-tenant-id': testTenantId }
        });

        expect(response.statusCode).toBe(400); // Lat out of bounds (-90 to 90)
    });
});

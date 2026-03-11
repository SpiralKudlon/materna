import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { Pool } from 'pg';
import { z } from 'zod';
import { CacheService, CacheKeys, CacheTTL } from '../services/cache.service.js';
import { getRedisClient } from '../lib/redis.js';

export interface FacilityRouteOptions {
    db: Pool;
}

export const facilityRoutes: FastifyPluginAsync<FacilityRouteOptions> = async (
    app: FastifyInstance,
    opts: FacilityRouteOptions
) => {
    const { db } = opts;
    const cache = new CacheService(getRedisClient());

    // GET /api/v1/facilities/nearest?lat=&lon=
    app.get('/nearest', async (request, reply) => {
        const tenantId = (request.headers['x-tenant-id'] as string) ?? '';

        const querySchema = z.object({
            lat: z.coerce.number().min(-90).max(90),
            lon: z.coerce.number().min(-180).max(180),
            limit: z.coerce.number().optional().default(1),
        });

        const queryResult = querySchema.safeParse(request.query);
        if (!queryResult.success) {
            return reply.code(400).send({ error: 'Invalid coordinates' });
        }

        const { lat, lon, limit } = queryResult.data;
        const cacheKey = CacheKeys.facilityNearest(tenantId, lat, lon, limit);

        try {
            const rows = await cache.getOrSet(cacheKey, CacheTTL.FACILITY, async () => {
                // Haversine formula: great-circle distance between two points
                const query = `
                    SELECT
                        id,
                        name,
                        latitude,
                        longitude,
                        (
                            6371 * acos(
                                cos(radians($1)) * cos(radians(latitude)) *
                                cos(radians(longitude) - radians($2)) +
                                sin(radians($1)) * sin(radians(latitude))
                            )
                        ) AS distance_km
                    FROM facilities
                    WHERE tenant_id = $3
                    ORDER BY distance_km ASC
                    LIMIT $4;
                `;
                const result = await db.query(query, [lat, lon, tenantId, limit]);
                return result.rows.map(row => ({
                    id: row.id,
                    name: row.name,
                    latitude: parseFloat(row.latitude),
                    longitude: parseFloat(row.longitude),
                    distanceKm: parseFloat(row.distance_km),
                }));
            });

            if (rows.length === 0) {
                return reply.code(404).send({ error: 'No facilities found in this tenant' });
            }

            return reply.send({ data: rows });
        } catch (error) {
            app.log.error(error);
            return reply.code(500).send({ error: 'Database error executing geospatial query' });
        }
    });
};

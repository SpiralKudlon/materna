import type { FastifyPluginAsync } from 'fastify';
import type { Pool } from 'pg';
import { CacheService, CacheKeys, CacheTTL } from '../services/cache.service.js';
import { getRedisClient } from '../lib/redis.js';

export interface DashboardRouteOptions {
    pool: Pool;
}

export const dashboardRoutes: FastifyPluginAsync<DashboardRouteOptions> = async (app, opts) => {
    const { pool } = opts;
    const cache = new CacheService(getRedisClient());

    // ── GET /chv/:id/dashboard ──────────────────────────────────────────────
    app.get('/chv/:id/dashboard', async (request, reply) => {
        const { id: chvId } = request.params as { id: string };
        const cacheKey = CacheKeys.chvDashboard(chvId);

        const data = await cache.getOrSet(cacheKey, CacheTTL.CHV_DASHBOARD, async () => {
            const client = await pool.connect();
            try {
                // 1. Risk tier distribution for this CHV's active patients
                const riskTierQuery = `
                    WITH LatestRisks AS (
                        SELECT DISTINCT ON (patient_id) patient_id, tier
                        FROM risk_scores
                        ORDER BY patient_id, created_at DESC
                    )
                    SELECT COALESCE(lr.tier, 'UNSCORED') as tier, COUNT(c.patient_id) as count
                    FROM chv_assignments c
                    LEFT JOIN LatestRisks lr ON c.patient_id = lr.patient_id
                    WHERE c.chv_id = $1 AND c.status = 'ACTIVE'
                    GROUP BY lr.tier
                `;
                const riskTiersResult = await client.query(riskTierQuery, [chvId]);
                const tiers = riskTiersResult.rows.reduce((acc, row) => {
                    acc[row.tier] = parseInt(row.count, 10);
                    return acc;
                }, {} as Record<string, number>);

                // 2. Urgent actions (overdue ANC, recent HIGH risk)
                const urgentQuery = `
                    WITH LatestRisks AS (
                        SELECT DISTINCT ON (patient_id) patient_id, tier, created_at
                        FROM risk_scores
                        ORDER BY patient_id, created_at DESC
                    ),
                    LatestANC AS (
                        SELECT patient_id, MAX(next_visit_date) as next_visit_date
                        FROM anc_visits
                        GROUP BY patient_id
                    )
                    SELECT c.patient_id, 'OVERDUE_ANC' as reason, la.next_visit_date as details
                    FROM chv_assignments c
                    JOIN LatestANC la ON c.patient_id = la.patient_id
                    WHERE c.chv_id = $1 AND c.status = 'ACTIVE' AND la.next_visit_date < now()

                    UNION ALL

                    SELECT c.patient_id, 'NEW_HIGH_RISK' as reason, lr.created_at::text as details
                    FROM chv_assignments c
                    JOIN LatestRisks lr ON c.patient_id = lr.patient_id
                    WHERE c.chv_id = $1 AND c.status = 'ACTIVE' AND lr.tier = 'HIGH'
                      AND lr.created_at > now() - INTERVAL '3 days'
                `;
                const urgentResult = await client.query(urgentQuery, [chvId]);

                return { chvId, riskDistribution: tiers, urgentActions: urgentResult.rows };
            } finally {
                client.release();
            }
        });

        return reply.send(data);
    });

    // ── GET /facilities/:id/dashboard ───────────────────────────────────────
    app.get('/facilities/:id/dashboard', async (request, reply) => {
        const { id: facilityId } = request.params as { id: string };
        const cacheKey = CacheKeys.facilityDashboard(facilityId);

        const data = await cache.getOrSet(cacheKey, CacheTTL.FACILITY, async () => {
            const client = await pool.connect();
            try {
                const referralsQuery = `
                    SELECT status, COUNT(*) as count
                    FROM referrals
                    WHERE to_facility_id = $1 AND status IN ('PENDING', 'ACCEPTED')
                    GROUP BY status
                `;
                const referralsResult = await client.query(referralsQuery, [facilityId]);
                const activeReferrals = referralsResult.rows.reduce((acc, row) => {
                    acc[row.status] = parseInt(row.count, 10);
                    return acc;
                }, {} as Record<string, number>);

                const catchmentRiskQuery = `
                    WITH FacilityTenant AS (
                        SELECT tenant_id FROM facilities WHERE id = $1
                    ),
                    LatestRisks AS (
                        SELECT DISTINCT ON (patient_id) patient_id, tier
                        FROM risk_scores
                        WHERE tenant_id = (SELECT tenant_id FROM FacilityTenant)
                        ORDER BY patient_id, created_at DESC
                    )
                    SELECT COALESCE(tier, 'UNSCORED') as tier, COUNT(*) as count
                    FROM LatestRisks
                    GROUP BY tier
                `;
                const catchmentResult = await client.query(catchmentRiskQuery, [facilityId]);
                const catchmentRisks = catchmentResult.rows.reduce((acc, row) => {
                    acc[row.tier] = parseInt(row.count, 10);
                    return acc;
                }, {} as Record<string, number>);

                return { facilityId, activeReferrals, catchmentRiskDistribution: catchmentRisks };
            } finally {
                client.release();
            }
        });

        return reply.send(data);
    });
};

import type { FastifyPluginAsync } from 'fastify';
import type { Pool } from 'pg';

export interface DashboardRouteOptions {
    pool: Pool;
}

export const dashboardRoutes: FastifyPluginAsync<DashboardRouteOptions> = async (app, opts) => {
    const { pool } = opts;

    app.get('/chv/:id/dashboard', async (request, reply) => {
        const { id: chvId } = request.params as { id: string };

        const client = await pool.connect();
        try {
            // 1. Get risk tier distribution for this CHV's active patients
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

            // 2. Get Urgent Actions (Overdue ANC, Recent HIGH risk)
            // Note: Since patients.full_name is encrypted, it's decrypted transparently 
            // by Postgres if the app.encryption_key is set (managed by gatekeeper plugin upstream)
            // For dashboard aggregations, we return patient IDs to avoid needing decryption contexts 
            // unless strictly necessary. We will return patient_id and reason.
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

            return reply.send({
                chvId,
                riskDistribution: tiers,
                urgentActions: urgentResult.rows
            });
        } finally {
            client.release();
        }
    });

    app.get('/facilities/:id/dashboard', async (request, reply) => {
        const { id: facilityId } = request.params as { id: string };

        const client = await pool.connect();
        try {
            // 1. Active referral queues (incoming to this facility)
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

            // 2. Aggregate risk distribution across catchment area 
            // (all patients assigned to ANY CHV that belongs to this facility's theoretical network,
            // but for simplicity, we count ALL patients referred here or assigned in the tenant if this is a global dashboard.
            // Let's approximate catchment by checking patients who have had visits or referrals here, or just simple tenant scoping.)
            // Assuming a simpler relation: Risk scores in the whole system for now as a 'catchment' proxy,
            // or we join by facility's tenant_id if we want the facility's isolated tenant view.

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

            return reply.send({
                facilityId,
                activeReferrals,
                catchmentRiskDistribution: catchmentRisks
            });
        } finally {
            client.release();
        }
    });
};

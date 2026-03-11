-- ────────────────────────────────────────────────────────────────────────────
-- 0015_perf_indexes.sql
--
-- Composite indexes targeting the top 5 slowest query patterns identified
-- via EXPLAIN ANALYZE on the maternal-records service.
-- All indexes are created CONCURRENTLY so they do NOT lock the table
-- during a live deployment.
-- ────────────────────────────────────────────────────────────────────────────

-- 1. CHV Dashboard – risk_scores CTE (DISTINCT ON patient_id ORDER BY created_at DESC)
--    Without this index Postgres must sort a full seqscan of risk_scores for every
--    CHV dashboard request.  With it, the DISTINCT ON uses an index-only scan.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_risk_scores_patient_created
    ON risk_scores (patient_id, created_at DESC);

-- 2. CHV Dashboard – ANC urgency CTE (MAX(next_visit_date) GROUP BY patient_id)
--    Postgres currently does an aggregate over a seqscan.  This index lets it
--    use an index scan for the GROUP BY and the WHERE next_visit_date < now().
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_anc_visits_patient_next
    ON anc_visits (patient_id, next_visit_date);

-- 3. Patient list with RLS – listByTenant (ORDER BY created_at DESC LIMIT n)
--    RLS applies tenant_id filtering first; without this index every paginated
--    list triggers a seqscan + filesort.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_tenant_created
    ON patients (tenant_id, created_at DESC);

-- 4. Facility dashboard – referral queue (WHERE to_facility_id = $1 AND status IN (…))
--    A composite index on (to_facility_id, status) enables an index-only scan for
--    the COUNT(*) GROUP BY status aggregation.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_referrals_facility_status
    ON referrals (to_facility_id, status);

-- 5. CHV dashboard – assignment lookup (WHERE chv_id = $1 AND status = 'ACTIVE')
--    Both risk-tier and urgency CTEs filter on this condition; without the index
--    both queries do separate seqscans over the full assignments table.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chv_assignments_chv_status
    ON chv_assignments (chv_id, status);

-- ── Expected impact ───────────────────────────────────────────────────────────
-- Query                              | Before (est.) | After (est.)
-- CHV dashboard (risk CTE)           |  ~800ms        | ~12ms
-- CHV dashboard (ANC urgency)        |  ~600ms        | ~8ms
-- Patient list (tenant + pagination) |  ~400ms        | ~5ms
-- Referral queue COUNT               |  ~350ms        | ~4ms
-- CHV assignment lookup              |  ~500ms        | ~6ms
-- Combined p95 dashboard request     |  ~2.1s         | ~30ms  (+ 60s cache hit → <2ms)

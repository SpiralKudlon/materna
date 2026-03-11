-- 1. Population Risk Distribution
-- Calculates the percentage of patients in each risk tier (LOW, MODERATE, HIGH)
-- Since we use ReplacingMergeTree, we use FINAL to get the latest score per patient in a real scenario,
-- but for performance over millions of rows, we can optimize using argMax.
SELECT
    tier,
    COUNT(DISTINCT patient_id) AS patient_count,
    ROUND(COUNT(DISTINCT patient_id) * 100.0 / SUM(COUNT(DISTINCT patient_id)) OVER(), 2) AS percentage
FROM (
    SELECT
        patient_id,
        argMax(tier, updated_at) AS tier
    FROM risk_scores
    GROUP BY patient_id
) latest_scores
GROUP BY tier
ORDER BY
    CASE tier
        WHEN 'HIGH' THEN 1
        WHEN 'MODERATE' THEN 2
        WHEN 'LOW' THEN 3
        ELSE 4
    END;

-- 2. ANC Adherence Percentages
-- Calculates the adherence rate based on completed vs missed past visits
SELECT
    tenant_id,
    COUNTIf(status = 'COMPLETED') AS completed_visits,
    COUNTIf(status = 'MISSED') AS missed_visits,
    ROUND(COUNTIf(status = 'COMPLETED') * 100.0 / NULLIF(COUNTIf(status IN ('COMPLETED', 'MISSED')), 0), 2) AS adherence_percentage
FROM (
    SELECT
        id,
        argMax(tenant_id, updated_at) AS tenant_id,
        argMax(status, updated_at) AS status
    FROM anc_visits
    WHERE status IN ('COMPLETED', 'MISSED')
    GROUP BY id
) latest_visits
GROUP BY tenant_id
ORDER BY adherence_percentage ASC;

-- 3. Geographic Heat Maps
-- Joins latest facility coordinates with the count of HIGH-risk patients per facility
-- Useful for rendering dynamic maps
SELECT
    f.name AS facility_name,
    f.latitude,
    f.longitude,
    count(DISTINCT r.patient_id) AS high_risk_patients_count
FROM (
    SELECT
        tenant_id,
        argMax(name, updated_at) AS name,
        argMax(latitude, updated_at) AS latitude,
        argMax(longitude, updated_at) AS longitude
    FROM facilities
    GROUP BY tenant_id
) f
LEFT JOIN (
    SELECT
        patient_id,
        tenant_id,
        argMax(tier, updated_at) AS tier
    FROM risk_scores
    GROUP BY patient_id, tenant_id
    HAVING argMax(tier, updated_at) = 'HIGH'
) r ON f.tenant_id = r.tenant_id
GROUP BY f.name, f.latitude, f.longitude
HAVING high_risk_patients_count > 0
ORDER BY high_risk_patients_count DESC;

-- Optional: 4. Daily Symptom Reports Count by Source (App vs SMS vs CHV)
SELECT
    toDate(created_at) AS log_date,
    source,
    count() AS report_count
FROM symptom_logs
GROUP BY log_date, source
ORDER BY log_date DESC, report_count DESC;

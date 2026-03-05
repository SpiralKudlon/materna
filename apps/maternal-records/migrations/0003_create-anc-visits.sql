-- Migration 0003: Create the anc_visits table
--
-- Design decisions:
--   • Vitals (BP systolic/diastolic, weight_kg) are stored as numeric
--     columns with CHECK constraints for physiological bounds.
--   • gestational_age_weeks is stored explicitly (not computed from LMP)
--     because CHVs may record it from ultrasound or clinical estimation.
--   • next_visit_date is auto-computed by a BEFORE INSERT trigger that
--     adds 4 weeks to the visit_date (WHO-recommended ANC interval).
--   • A visit_number is auto-incremented per patient using a sequence
--     subquery so we can track ANC1, ANC2, … ANC8+.
-- ────────────────────────────────────────────────────────────────────────

-- Visit status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'visit_status') THEN
        CREATE TYPE visit_status AS ENUM (
            'SCHEDULED',
            'COMPLETED',
            'MISSED',
            'CANCELLED'
        );
    END IF;
END$$;

CREATE TABLE anc_visits (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id              UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,

    -- Visit metadata
    visit_number            INTEGER NOT NULL,
    visit_date              DATE NOT NULL DEFAULT CURRENT_DATE,
    status                  visit_status NOT NULL DEFAULT 'SCHEDULED',
    provider_id             UUID,            -- FK → identity.users(id)  (the clinician)

    -- ── Vitals ─────────────────────────────────────────────────────────
    bp_systolic             SMALLINT CHECK (bp_systolic BETWEEN 60 AND 260),
    bp_diastolic            SMALLINT CHECK (bp_diastolic BETWEEN 30 AND 160),
    weight_kg               NUMERIC(5,2) CHECK (weight_kg BETWEEN 20 AND 300),
    height_cm               NUMERIC(5,1) CHECK (height_cm BETWEEN 100 AND 250),
    fundal_height_cm        NUMERIC(4,1),
    fetal_heart_rate        SMALLINT CHECK (fetal_heart_rate BETWEEN 80 AND 220),

    -- ── Pregnancy specifics ────────────────────────────────────────────
    gestational_age_weeks   SMALLINT NOT NULL CHECK (gestational_age_weeks BETWEEN 1 AND 45),

    -- Auto-computed: visit_date + 28 days (4-week interval)
    next_visit_date         DATE,

    -- Clinical notes (free text)
    notes                   TEXT,

    -- Risk flags (computed by the application or trigger)
    is_high_risk            BOOLEAN NOT NULL DEFAULT FALSE,

    -- Audit
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Auto-compute next_visit_date ───────────────────────────────────────
-- WHO recommends 4-week intervals for routine ANC.  After 36 weeks
-- the interval shortens to 2 weeks, and after 40 weeks to 1 week.
CREATE OR REPLACE FUNCTION compute_next_visit()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-set visit_number if not provided
    IF NEW.visit_number IS NULL OR NEW.visit_number = 0 THEN
        SELECT COALESCE(MAX(visit_number), 0) + 1
          INTO NEW.visit_number
          FROM anc_visits
         WHERE patient_id = NEW.patient_id;
    END IF;

    -- Compute next_visit_date based on gestational age
    IF NEW.next_visit_date IS NULL THEN
        IF NEW.gestational_age_weeks >= 40 THEN
            -- Weekly visits post-term
            NEW.next_visit_date := NEW.visit_date + INTERVAL '7 days';
        ELSIF NEW.gestational_age_weeks >= 36 THEN
            -- Bi-weekly in the last month
            NEW.next_visit_date := NEW.visit_date + INTERVAL '14 days';
        ELSE
            -- Standard 4-week interval
            NEW.next_visit_date := NEW.visit_date + INTERVAL '28 days';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_compute_next_visit
    BEFORE INSERT ON anc_visits
    FOR EACH ROW EXECUTE FUNCTION compute_next_visit();

-- Reuse the updated_at trigger function from migration 0001
CREATE TRIGGER trg_visits_updated_at
    BEFORE UPDATE ON anc_visits
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Auto-flag high-risk pregnancies ────────────────────────────────────
-- Flags: BP ≥140/90 (pre-eclampsia risk) OR gestational age >42 weeks
CREATE OR REPLACE FUNCTION flag_high_risk()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.bp_systolic IS NOT NULL AND NEW.bp_systolic >= 140)
       OR (NEW.bp_diastolic IS NOT NULL AND NEW.bp_diastolic >= 90)
       OR (NEW.gestational_age_weeks > 42) THEN
        NEW.is_high_risk := TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_flag_high_risk
    BEFORE INSERT OR UPDATE ON anc_visits
    FOR EACH ROW EXECUTE FUNCTION flag_high_risk();

-- ── Indexes ────────────────────────────────────────────────────────────
CREATE INDEX idx_visits_patient       ON anc_visits (patient_id);
CREATE INDEX idx_visits_tenant        ON anc_visits (tenant_id);
CREATE INDEX idx_visits_date          ON anc_visits (visit_date DESC);
CREATE INDEX idx_visits_next          ON anc_visits (next_visit_date)
    WHERE status = 'SCHEDULED';
CREATE INDEX idx_visits_high_risk     ON anc_visits (is_high_risk)
    WHERE is_high_risk = TRUE;
CREATE INDEX idx_visits_gestational   ON anc_visits (gestational_age_weeks);

-- Unique: one visit_number per patient
CREATE UNIQUE INDEX idx_visits_patient_number
    ON anc_visits (patient_id, visit_number);

-- ── Row-Level Security ─────────────────────────────────────────────────
ALTER TABLE anc_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE anc_visits FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_select ON anc_visits
    FOR SELECT
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_insert ON anc_visits
    FOR INSERT
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_update ON anc_visits
    FOR UPDATE
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_delete ON anc_visits
    FOR DELETE
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Grants
GRANT SELECT, INSERT, UPDATE ON anc_visits TO maternal_app;

-- ── Materialized view: Upcoming visits dashboard ───────────────────────
-- Refreshed periodically (e.g. via pg_cron) for the CHV scheduling UI.
CREATE MATERIALIZED VIEW IF NOT EXISTS upcoming_visits AS
SELECT
    v.id            AS visit_id,
    v.patient_id,
    v.tenant_id,
    v.visit_number,
    v.next_visit_date,
    v.gestational_age_weeks,
    v.is_high_risk,
    v.status
FROM anc_visits v
WHERE v.status = 'SCHEDULED'
  AND v.next_visit_date >= CURRENT_DATE
ORDER BY v.next_visit_date ASC;

CREATE UNIQUE INDEX idx_upcoming_visit_id ON upcoming_visits (visit_id);

GRANT SELECT ON upcoming_visits TO maternal_app;

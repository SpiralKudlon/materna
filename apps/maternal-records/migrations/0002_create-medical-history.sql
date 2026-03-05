-- Migration 0002: Create the medical_history table
--
-- Design decisions:
--   • conditions and obstetric_history use JSONB to allow flexible,
--     schema-less partial updates (PATCH via jsonb_set / || operator).
--   • GIN indexes on both JSONB columns enable fast key-existence and
--     containment queries (e.g. find all patients with hypertension).
--   • blood_type uses a CHECK constraint for valid ABO+Rh values.
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE medical_history (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id          UUID NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,

    -- Static clinical facts
    blood_type          TEXT CHECK (blood_type IN (
                            'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'
                        )),
    hiv_status          TEXT CHECK (hiv_status IN (
                            'POSITIVE', 'NEGATIVE', 'UNKNOWN'
                        )),
    allergies           TEXT[],

    -- ── JSONB: Flexible condition tracking ─────────────────────────────
    -- Example:
    -- {
    --   "hypertension": { "diagnosed": "2023-01-10", "severity": "stage_1", "on_treatment": true },
    --   "gestational_diabetes": { "diagnosed": "2025-06-20", "on_treatment": false }
    -- }
    conditions          JSONB NOT NULL DEFAULT '{}'::JSONB,

    -- ── JSONB: Obstetric history ───────────────────────────────────────
    -- Example:
    -- {
    --   "gravida": 3,
    --   "para": 2,
    --   "abortions": 0,
    --   "previous_deliveries": [
    --     { "year": 2020, "mode": "SVD", "outcome": "live_birth", "birth_weight_kg": 3.2 },
    --     { "year": 2022, "mode": "CS",  "outcome": "live_birth", "birth_weight_kg": 3.8 }
    --   ],
    --   "last_menstrual_period": "2025-10-01",
    --   "estimated_due_date": "2026-07-08"
    -- }
    obstetric_history   JSONB NOT NULL DEFAULT '{}'::JSONB,

    -- Audit
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_mh_patient      ON medical_history (patient_id);
CREATE INDEX idx_mh_tenant       ON medical_history (tenant_id);
CREATE INDEX idx_mh_conditions   ON medical_history USING GIN (conditions);
CREATE INDEX idx_mh_obstetric    ON medical_history USING GIN (obstetric_history);
CREATE INDEX idx_mh_blood        ON medical_history (blood_type);
CREATE INDEX idx_mh_hiv          ON medical_history (hiv_status);

-- Reuse the same updated_at trigger function from migration 0001
CREATE TRIGGER trg_mh_updated_at
    BEFORE UPDATE ON medical_history
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Row-Level Security ─────────────────────────────────────────────────
ALTER TABLE medical_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_history FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_select ON medical_history
    FOR SELECT
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_insert ON medical_history
    FOR INSERT
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_update ON medical_history
    FOR UPDATE
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_delete ON medical_history
    FOR DELETE
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Grants
GRANT SELECT, INSERT, UPDATE ON medical_history TO maternal_app;

-- ── Helper: Partial JSONB update ───────────────────────────────────────
-- Usage:  SELECT merge_medical_jsonb('conditions', id, '{"asthma": {"severity": "mild"}}');
--
-- This function merges (||) a JSON patch into an existing JSONB column,
-- enabling partial updates without replacing the entire document.
CREATE OR REPLACE FUNCTION merge_medical_jsonb(
    col_name TEXT,
    record_id UUID,
    patch JSONB
) RETURNS VOID AS $$
BEGIN
    IF col_name = 'conditions' THEN
        UPDATE medical_history
           SET conditions = conditions || patch,
               updated_at = now()
         WHERE id = record_id;
    ELSIF col_name = 'obstetric_history' THEN
        UPDATE medical_history
           SET obstetric_history = obstetric_history || patch,
               updated_at = now()
         WHERE id = record_id;
    ELSE
        RAISE EXCEPTION 'Invalid column: %', col_name;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION merge_medical_jsonb(TEXT, UUID, JSONB) TO maternal_app;

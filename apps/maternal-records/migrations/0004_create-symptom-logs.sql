-- Migration 0004: Create the symptom_logs table
--
-- Design decisions:
--   • symptoms is stored as JSONB to allow flexible, schema-less arrays
--     of symptom objects (e.g. { name, severity, onset_date }).
--   • source is constrained via CHECK to one of APP, SMS, or CHV_PROXY
--     rather than using an ENUM so that new sources can be added without
--     a migration (ALTER TYPE … ADD VALUE is irreversible in a transaction).
--   • patient_id references patients(id) with CASCADE delete — if a
--     patient record is removed, their symptom logs go with it.
--   • tenant_id enforces multi-tenant isolation via RLS, matching the
--     pattern in migrations 0001–0003.
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE symptom_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,

    -- ── Symptom data ──────────────────────────────────────────────────
    -- JSONB array of symptom objects, e.g.:
    -- [
    --   { "name": "headache", "severity": "MODERATE", "onset_date": "2026-03-01" },
    --   { "name": "blurred_vision", "severity": "SEVERE" }
    -- ]
    symptoms        JSONB NOT NULL DEFAULT '[]'::JSONB,

    -- ── Source of the log ─────────────────────────────────────────────
    -- APP       = Patient self-reported via mobile app
    -- SMS       = Received via Africa's Talking SMS gateway
    -- CHV_PROXY = CHV entered on behalf of the patient during a home visit
    source          TEXT NOT NULL
                    CHECK (source IN ('APP', 'SMS', 'CHV_PROXY')),

    -- Optional: CHV or provider who recorded this entry
    reported_by     UUID,    -- FK → identity.users(id)

    -- Free-text notes from the reporter
    notes           TEXT,

    -- ── Audit timestamps ──────────────────────────────────────────────
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at (reuses set_updated_at() from migration 0001)
CREATE TRIGGER trg_symptom_logs_updated_at
    BEFORE UPDATE ON symptom_logs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Indexes ────────────────────────────────────────────────────────────
CREATE INDEX idx_symptom_logs_patient    ON symptom_logs (patient_id);
CREATE INDEX idx_symptom_logs_tenant     ON symptom_logs (tenant_id);
CREATE INDEX idx_symptom_logs_source     ON symptom_logs (source);
CREATE INDEX idx_symptom_logs_created    ON symptom_logs (created_at DESC);

-- GIN index on symptoms JSONB for containment queries
-- e.g. SELECT * FROM symptom_logs WHERE symptoms @> '[{"name":"headache"}]'
CREATE INDEX idx_symptom_logs_symptoms   ON symptom_logs USING GIN (symptoms);

-- ── Row-Level Security ─────────────────────────────────────────────────
ALTER TABLE symptom_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE symptom_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_select ON symptom_logs
    FOR SELECT
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_insert ON symptom_logs
    FOR INSERT
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_update ON symptom_logs
    FOR UPDATE
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_delete ON symptom_logs
    FOR DELETE
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Grants
GRANT SELECT, INSERT, UPDATE ON symptom_logs TO maternal_app;

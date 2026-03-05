-- Migration 0001: Create the patients table
--
-- Design decisions:
--   • full_name & phone are stored as BYTEA — encrypted at the application
--     layer using AES-256-GCM before INSERT/UPDATE.  A symmetric key (from
--     AWS Secrets Manager / Vault) is injected via env var so the DB engine
--     never sees plaintext PII.
--   • tenant_id + Row-Level Security (RLS) ensures CHVs can only see
--     patients belonging to their own facility/tenant.
--   • date_of_birth is stored as DATE (not encrypted) so the DB can index
--     and range-query it for age-based risk calculations.
-- ────────────────────────────────────────────────────────────────────────

-- 1. pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. tenants lookup ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. patients ───────────────────────────────────────────────────────────
CREATE TABLE patients (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,

    -- Encrypted at the application layer (AES-256-GCM → BYTEA)
    full_name_enc   BYTEA NOT NULL,
    phone_enc       BYTEA NOT NULL,

    -- Plaintext metadata safe for indexing
    date_of_birth   DATE,
    sex             TEXT CHECK (sex IN ('F', 'M', 'OTHER')),
    national_id     TEXT UNIQUE,

    -- The CHV who registered this patient
    registered_by   UUID,            -- FK → identity.users(id)

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_patients_tenant     ON patients (tenant_id);
CREATE INDEX idx_patients_registered ON patients (registered_by);
CREATE INDEX idx_patients_dob        ON patients (date_of_birth);

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_patients_updated_at
    BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Row-Level Security ─────────────────────────────────────────────────
-- Enable RLS on the patients table
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners (safety net in dev)
ALTER TABLE patients FORCE ROW LEVEL SECURITY;

-- Policy: CHVs can only SELECT/INSERT/UPDATE patients in their tenant.
-- The application sets `app.current_tenant_id` via:
--   SET LOCAL app.current_tenant_id = '<uuid>';
-- at the start of each transaction.

CREATE POLICY tenant_isolation_select ON patients
    FOR SELECT
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_insert ON patients
    FOR INSERT
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_update ON patients
    FOR UPDATE
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_delete ON patients
    FOR DELETE
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ── Application role ───────────────────────────────────────────────────
-- Create a non-superuser role that the app connects as.
-- RLS policies above will govern its access.
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'maternal_app') THEN
        CREATE ROLE maternal_app LOGIN;
    END IF;
END$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON patients TO maternal_app;
GRANT SELECT, INSERT ON tenants TO maternal_app;

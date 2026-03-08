-- Migration 0008: Create chv_assignments table
--
-- Maps patients to Community Health Volunteers (CHVs).
-- Includes a trigger to ensure a CHV cannot have more than 50 active assignments.

CREATE TABLE chv_assignments (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    patient_id              UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    
    -- chv_id references the external identity system (Keycloak), so we store it as a UUID
    chv_id                  UUID NOT NULL,
    
    status                  TEXT NOT NULL DEFAULT 'ACTIVE'
                            CHECK (status IN ('ACTIVE', 'INACTIVE')),

    assigned_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    unassigned_at           TIMESTAMPTZ,
    
    -- Audit timestamps
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger function to enforce the burnout-prevention limit (max 50 active patients)
CREATE OR REPLACE FUNCTION check_chv_assignment_limit()
RETURNS TRIGGER AS $$
DECLARE
    active_count INTEGER;
BEGIN
    -- Only check limit if we are creating or updating an assignment to 'ACTIVE'
    IF NEW.status = 'ACTIVE' THEN
        SELECT curr_count INTO active_count FROM (
            SELECT COUNT(*) AS curr_count FROM chv_assignments 
            WHERE chv_id = NEW.chv_id 
              AND status = 'ACTIVE'
              AND tenant_id = NEW.tenant_id
              -- Exclude the current row if this is an update
              AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
        ) AS count_query;

        IF active_count >= 50 THEN
            RAISE EXCEPTION 'Maximum of 50 active patients per CHV exceeded to prevent burnout.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_chv_limit
    BEFORE INSERT OR UPDATE OF status ON chv_assignments
    FOR EACH ROW EXECUTE FUNCTION check_chv_assignment_limit();

-- Auto-update updated_at
CREATE TRIGGER trg_chv_assignments_updated_at
    BEFORE UPDATE ON chv_assignments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Indexes ────────────────────────────────────────────────────────────
-- Partial index to quickly find active assignments per CHV / Patient
CREATE INDEX idx_chv_assignments_active ON chv_assignments(chv_id, patient_id) WHERE status = 'ACTIVE';
CREATE INDEX idx_chv_assignments_tenant ON chv_assignments(tenant_id);

-- ── Row-Level Security ─────────────────────────────────────────────────
ALTER TABLE chv_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE chv_assignments FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_select ON chv_assignments
    FOR SELECT
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_insert ON chv_assignments
    FOR INSERT
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_update ON chv_assignments
    FOR UPDATE
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_delete ON chv_assignments
    FOR DELETE
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON chv_assignments TO maternal_app;

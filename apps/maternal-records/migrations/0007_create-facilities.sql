-- Migration 0007: Create the facilities table
--
-- Adds geospatial coordinates as DECIMAL(9,6) to support
-- distance calculations for the nearest clinic.

CREATE TABLE facilities (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    
    name                    TEXT NOT NULL,
    type                    TEXT NOT NULL CHECK (type IN ('DISPENSARY', 'HEALTH_CENTER', 'HOSPITAL')),
    
    -- Geospatial coordinates (up to ~11cm precision)
    latitude                DECIMAL(9,6) NOT NULL,
    longitude               DECIMAL(9,6) NOT NULL,

    -- Audit timestamps
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at (reuses set_updated_at() from 0001)
CREATE TRIGGER trg_facilities_updated_at
    BEFORE UPDATE ON facilities
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Indexes ────────────────────────────────────────────────────────────
CREATE INDEX idx_facilities_tenant ON facilities(tenant_id);
-- Index on coordinates for fast bounding box or distance queries
CREATE INDEX idx_facilities_location ON facilities(latitude, longitude);

-- ── Row-Level Security ─────────────────────────────────────────────────
ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE facilities FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_select ON facilities
    FOR SELECT
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_insert ON facilities
    FOR INSERT
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_update ON facilities
    FOR UPDATE
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_delete ON facilities
    FOR DELETE
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON facilities TO maternal_app;

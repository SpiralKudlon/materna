-- Down migration: Drop patients table and related objects

-- Revoke grants
REVOKE ALL ON patients FROM maternal_app;
REVOKE ALL ON tenants FROM maternal_app;

-- Drop policies
DROP POLICY IF EXISTS tenant_isolation_select ON patients;
DROP POLICY IF EXISTS tenant_isolation_insert ON patients;
DROP POLICY IF EXISTS tenant_isolation_update ON patients;
DROP POLICY IF EXISTS tenant_isolation_delete ON patients;

-- Drop trigger and function
DROP TRIGGER IF EXISTS trg_patients_updated_at ON patients;
DROP FUNCTION IF EXISTS set_updated_at();

-- Drop tables
DROP TABLE IF EXISTS patients;
DROP TABLE IF EXISTS tenants;

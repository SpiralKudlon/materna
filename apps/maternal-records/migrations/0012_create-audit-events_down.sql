-- Rollback 0012: Drop audit event log

-- 1. Drop triggers (must drop before the function)
DROP TRIGGER IF EXISTS trg_audit_patients         ON patients;
DROP TRIGGER IF EXISTS trg_audit_medical_history  ON medical_history;
DROP TRIGGER IF EXISTS trg_audit_anc_visits       ON anc_visits;
DROP TRIGGER IF EXISTS trg_audit_referrals        ON referrals;

-- 2. Drop the trigger function
DROP FUNCTION IF EXISTS record_audit_event();

-- 3. Drop the table (CASCADE removes indexes automatically)
DROP TABLE IF EXISTS audit_events CASCADE;

-- 4. Drop the read-only compliance role (only if no other objects depend on it)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'audit_reader') THEN
        DROP ROLE audit_reader;
    END IF;
END$$;

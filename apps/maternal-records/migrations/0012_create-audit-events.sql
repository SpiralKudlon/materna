-- Migration 0012: Global Audit Event Log
--
-- Design decisions:
--   • AFTER triggers on patients, medical_history, anc_visits, and referrals
--     fire for every mutating DML operation.
--   • Request context (ip_address, user_agent, user_id, tenant_id) is injected
--     by the application layer via SET LOCAL before each transaction; the trigger
--     reads them with current_setting('app.X', true) — the boolean flag means
--     the call returns '' rather than raising if the var is not set (e.g. in
--     migration tooling or direct psql sessions).
--   • old_values / new_values capture the full row snapshot as JSONB.
--     Encrypted BYTEA columns appear as base64 blobs — intentional (proves the
--     field changed without leaking decrypted PII).
--   • The table is append-only for the maternal_app role: INSERT only.
--     A separate audit_reader role is created for compliance queries.
--   • The trigger function runs SECURITY DEFINER so it can always write to
--     audit_events regardless of the caller's row-level-security context.
-- ────────────────────────────────────────────────────────────────────────

-- ── 1. audit_events table ─────────────────────────────────────────────

CREATE TABLE audit_events (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),

    -- When
    occurred_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),

    -- Who (from SET LOCAL session vars set by the application before BEGIN)
    user_id       TEXT,
    tenant_id     UUID,
    ip_address    INET,
    user_agent    TEXT,

    -- What
    action        TEXT         NOT NULL  CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    resource_type TEXT         NOT NULL,   -- table name: patients, anc_visits …
    resource_id   UUID,                    -- the row's primary key

    -- Before / after snapshot (NULL where not applicable)
    old_values    JSONB,                   -- NULL on INSERT
    new_values    JSONB                    -- NULL on DELETE
);

COMMENT ON TABLE audit_events IS
    'Immutable audit log. Application role has INSERT only; no UPDATE or DELETE allowed.';

-- ── 2. Indexes ────────────────────────────────────────────────────────

CREATE INDEX idx_audit_occurred_at   ON audit_events (occurred_at DESC);
CREATE INDEX idx_audit_user_id       ON audit_events (user_id)
    WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_resource      ON audit_events (resource_type, resource_id);
CREATE INDEX idx_audit_tenant        ON audit_events (tenant_id)
    WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_audit_action        ON audit_events (action);

-- ── 3. Trigger function ───────────────────────────────────────────────
-- SECURITY DEFINER: runs as the function owner (superuser/migration role)
-- so it can always write to audit_events irrespective of the caller's RLS
-- context or role.

CREATE OR REPLACE FUNCTION record_audit_event()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id    TEXT;
    v_tenant_id  TEXT;
    v_ip         TEXT;
    v_ua         TEXT;
    v_action     TEXT;
    v_old        JSONB;
    v_new        JSONB;
    v_row_id     UUID;
BEGIN
    -- Read session variables injected by the application layer.
    -- The second argument (true) prevents errors when the variable is not set.
    v_user_id   := nullif(current_setting('app.current_user_id',   true), '');
    v_tenant_id := nullif(current_setting('app.current_tenant_id', true), '');
    v_ip        := nullif(current_setting('app.client_ip',         true), '');
    v_ua        := nullif(current_setting('app.client_user_agent', true), '');

    -- Determine DML action
    v_action := TG_OP;  -- 'INSERT', 'UPDATE', or 'DELETE'

    -- Build JSONB snapshots
    IF TG_OP = 'DELETE' THEN
        v_old    := to_jsonb(OLD);
        v_new    := NULL;
        v_row_id := OLD.id;
    ELSIF TG_OP = 'INSERT' THEN
        v_old    := NULL;
        v_new    := to_jsonb(NEW);
        v_row_id := NEW.id;
    ELSE  -- UPDATE
        v_old    := to_jsonb(OLD);
        v_new    := to_jsonb(NEW);
        v_row_id := NEW.id;
    END IF;

    INSERT INTO audit_events (
        user_id,
        tenant_id,
        ip_address,
        user_agent,
        action,
        resource_type,
        resource_id,
        old_values,
        new_values
    ) VALUES (
        v_user_id,
        v_tenant_id::UUID,
        v_ip::INET,
        v_ua,
        v_action,
        TG_TABLE_NAME,
        v_row_id,
        v_old,
        v_new
    );

    -- AFTER triggers must return NULL (the row has already been mutated)
    RETURN NULL;

EXCEPTION
    -- Never let the audit trigger abort the primary transaction.
    -- Log the failure to pg_log and continue.
    WHEN OTHERS THEN
        RAISE WARNING '[audit] record_audit_event failed on %.%: %',
            TG_TABLE_NAME, TG_OP, SQLERRM;
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 4. Attach triggers to each audited table ──────────────────────────

CREATE TRIGGER trg_audit_patients
    AFTER INSERT OR UPDATE OR DELETE ON patients
    FOR EACH ROW EXECUTE FUNCTION record_audit_event();

CREATE TRIGGER trg_audit_medical_history
    AFTER INSERT OR UPDATE OR DELETE ON medical_history
    FOR EACH ROW EXECUTE FUNCTION record_audit_event();

CREATE TRIGGER trg_audit_anc_visits
    AFTER INSERT OR UPDATE OR DELETE ON anc_visits
    FOR EACH ROW EXECUTE FUNCTION record_audit_event();

CREATE TRIGGER trg_audit_referrals
    AFTER INSERT OR UPDATE OR DELETE ON referrals
    FOR EACH ROW EXECUTE FUNCTION record_audit_event();

-- ── 5. Permissions — append-only ─────────────────────────────────────

-- Application role: INSERT only (cannot read, update, or delete audit rows).
-- Rows are written exclusively by the SECURITY DEFINER trigger function.
GRANT INSERT ON audit_events TO maternal_app;
REVOKE UPDATE, DELETE ON audit_events FROM PUBLIC;

-- Sequence grant so gen_random_uuid() + serial default work correctly
GRANT USAGE ON SEQUENCE audit_events_id_seq TO maternal_app;

-- audit_reader role: compliance / SIEM queries, no writes ever
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'audit_reader') THEN
        CREATE ROLE audit_reader;
    END IF;
END$$;

GRANT SELECT ON audit_events TO audit_reader;

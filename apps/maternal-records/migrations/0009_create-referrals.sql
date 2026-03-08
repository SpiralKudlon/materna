-- Migration 0009: Create referrals table
--
-- Tracks patient referrals between facilities. Includes a strict
-- state machine trigger to prevent invalid status transitions.

CREATE TABLE referrals (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    patient_id              UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    
    from_facility_id        UUID NOT NULL REFERENCES facilities(id) ON DELETE RESTRICT,
    to_facility_id          UUID NOT NULL REFERENCES facilities(id) ON DELETE RESTRICT,
    
    reason                  TEXT NOT NULL,
    notes                   TEXT,
    
    -- Valid states: PENDING, ACCEPTED, TRANSFERRED, CLOSED
    status                  TEXT NOT NULL DEFAULT 'PENDING'
                            CHECK (status IN ('PENDING', 'ACCEPTED', 'TRANSFERRED', 'CLOSED')),

    -- Audit timestamps
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger function to enforce the state machine
CREATE OR REPLACE FUNCTION enforce_referral_state_machine()
RETURNS TRIGGER AS $$
BEGIN
    -- If status hasn't changed, let the update pass
    IF NEW.status = OLD.status THEN
        RETURN NEW;
    END IF;

    -- Valid transitions from PENDING
    IF OLD.status = 'PENDING' THEN
        IF NEW.status NOT IN ('ACCEPTED', 'CLOSED') THEN
            RAISE EXCEPTION 'Invalid transition from PENDING to %', NEW.status;
        END IF;
    
    -- Valid transitions from ACCEPTED
    ELSIF OLD.status = 'ACCEPTED' THEN
        IF NEW.status NOT IN ('TRANSFERRED', 'CLOSED') THEN
            RAISE EXCEPTION 'Invalid transition from ACCEPTED to %', NEW.status;
        END IF;

    -- Valid transitions from TRANSFERRED
    ELSIF OLD.status = 'TRANSFERRED' THEN
        IF NEW.status NOT IN ('CLOSED') THEN
            RAISE EXCEPTION 'Invalid transition from TRANSFERRED to %', NEW.status;
        END IF;

    -- Standard safeguard: CLOSED is terminal
    ELSIF OLD.status = 'CLOSED' THEN
        RAISE EXCEPTION 'Cannot update status of a CLOSED referral.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_referral_state_machine
    BEFORE UPDATE OF status ON referrals
    FOR EACH ROW EXECUTE FUNCTION enforce_referral_state_machine();

-- Auto-update updated_at
CREATE TRIGGER trg_referrals_updated_at
    BEFORE UPDATE ON referrals
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Indexes ────────────────────────────────────────────────────────────
CREATE INDEX idx_referrals_patient ON referrals(patient_id);
CREATE INDEX idx_referrals_from_facility ON referrals(from_facility_id);
CREATE INDEX idx_referrals_to_facility ON referrals(to_facility_id);
CREATE INDEX idx_referrals_status ON referrals(status);
CREATE INDEX idx_referrals_tenant ON referrals(tenant_id);

-- ── Row-Level Security ─────────────────────────────────────────────────
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_select ON referrals
    FOR SELECT
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_insert ON referrals
    FOR INSERT
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_update ON referrals
    FOR UPDATE
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_delete ON referrals
    FOR DELETE
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Grants
GRANT SELECT, INSERT, UPDATE ON referrals TO maternal_app;
-- Typically referrals shouldn't be deleted, but we'll grant it for symmetry if needed.
GRANT DELETE ON referrals TO maternal_app;

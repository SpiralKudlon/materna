-- Migration 0006: Create the notifications table
--
-- This table tracks notifications sent via various channels for auditing and
-- historical display within the patient profile.

CREATE TABLE notifications (
    notification_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id              UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,

    -- ── Notification Details ─────────────────────────────────────────
    -- The medium through which the notification was dispatched
    channel                 TEXT NOT NULL
                            CHECK (channel IN ('SMS', 'PUSH', 'IN_APP')),

    -- Delivery status tracking
    status                  TEXT NOT NULL DEFAULT 'PENDING'
                            CHECK (status IN ('PENDING', 'DELIVERED', 'FAILED')),

    -- Number of delivery attempts
    retry_count             INTEGER NOT NULL DEFAULT 0,

    -- JSONB metadata to store provider-specific response IDs for auditing
    -- e.g., { "provider": "africastalking", "messageId": "ATXid_12345" }
    metadata                JSONB NOT NULL DEFAULT '{}'::JSONB,

    -- ── Timestamps ───────────────────────────────────────────────────
    -- When the notification was actually dispatched/completed
    sent_at                 TIMESTAMPTZ,

    -- System audit timestamps
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at re-using set_updated_at() from 0001
CREATE TRIGGER trg_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Indexes ─────────────────────────────────────────────────────────
-- Required index on (patient_id, sent_at) to optimize history lookups
-- for the patient profile view, where we usually sort notifications by sending time.
CREATE INDEX idx_notifications_patient_sent_at ON notifications (patient_id, sent_at DESC);

-- Standard indexes
CREATE INDEX idx_notifications_tenant          ON notifications (tenant_id);
CREATE INDEX idx_notifications_status          ON notifications (status);
CREATE INDEX idx_notifications_channel         ON notifications (channel);
CREATE INDEX idx_notifications_created         ON notifications (created_at DESC);

-- GIN index for checking specific provider message IDs inside metadata
CREATE INDEX idx_notifications_metadata        ON notifications USING GIN (metadata);

-- ── Row-Level Security ──────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_select ON notifications
    FOR SELECT
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_insert ON notifications
    FOR INSERT
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_update ON notifications
    FOR UPDATE
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_delete ON notifications
    FOR DELETE
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Grants
GRANT SELECT, INSERT, UPDATE ON notifications TO maternal_app;

-- Migration 0010: i18n Notifications and Preferences
--
-- This migration enhances the schema to natively support string interpolation
-- and multi-language template rendering (e.g. Swahili and English).
-- ────────────────────────────────────────────────────────────────────────

-- 1. Extend Patient and User Preferences
-- Default missing profiles to 'en' (English) to maintain backward compatibility.
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'en' NOT NULL;

-- 2. Create the Notification Templates dictionary table
CREATE TABLE IF NOT EXISTS notification_templates (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(50) NOT NULL,
    language    VARCHAR(10) NOT NULL,
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Prevent duplicates of identical translations
    CONSTRAINT uni_template_name_lang UNIQUE (name, language)
);

-- Index the lookups
CREATE INDEX idx_notification_template_lookup ON notification_templates (name, language);

-- Insert Default Baseline Templates for testing and immediate ops usage
INSERT INTO notification_templates (name, language, content) VALUES
('HIGH_RISK_ALERT', 'en', 'EMERGENCY: Patient {{patientName}} has triggered a HIGH risk state. Please review immediately.'),
('HIGH_RISK_ALERT', 'sw', 'DHARURA: Mgonjwa {{patientName}} ameleta hali ya hatari KUBWA. Tafadhali chunguza mara moja.'),

('ANC_REMINDER', 'en', 'Hello {{patientName}}, your next ANC visit is scheduled for {{date}}.'),
('ANC_REMINDER', 'sw', 'Hujambo {{patientName}}, ziara yako inayofuata ya ANC imepangwa mnamo {{date}}.'),

('DAILY_DIGEST', 'en', 'Good morning {{chvName}}, you currently have {{highRiskCount}} HIGH risk patients out of your {{totalCount}} caseload today.'),
('DAILY_DIGEST', 'sw', 'Habari za asubuhi {{chvName}}, kwa sasa una wagonjwa {{highRiskCount}} walio hatarini sana kati ya wagonjwa {{totalCount}} leo.')
ON CONFLICT (name, language) DO UPDATE 
SET content = EXCLUDED.content, updated_at = now();

-- updated_at trigger for templates
CREATE OR REPLACE FUNCTION set_updated_at_templates()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_templates_updated_at
    BEFORE UPDATE ON notification_templates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_templates();

-- 3. Application roles mapping -- Give engine access
GRANT SELECT, INSERT, UPDATE, DELETE ON notification_templates TO maternal_app;

-- Down Migration 0010: Revert i18n Notifications and Preferences

DROP TRIGGER IF EXISTS trg_templates_updated_at ON notification_templates;
DROP FUNCTION IF EXISTS set_updated_at_templates();

DROP TABLE IF EXISTS notification_templates;

ALTER TABLE patients
DROP COLUMN IF EXISTS preferred_language;

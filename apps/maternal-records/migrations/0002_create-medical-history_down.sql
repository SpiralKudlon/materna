-- Down migration: Drop medical_history and related objects

DROP FUNCTION IF EXISTS merge_medical_jsonb(TEXT, UUID, JSONB);
DROP TRIGGER IF EXISTS trg_mh_updated_at ON medical_history;
DROP TABLE IF EXISTS medical_history;

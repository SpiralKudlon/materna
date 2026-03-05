-- Down migration: Drop anc_visits and related objects

DROP MATERIALIZED VIEW IF EXISTS upcoming_visits;
DROP TRIGGER IF EXISTS trg_flag_high_risk ON anc_visits;
DROP FUNCTION IF EXISTS flag_high_risk();
DROP TRIGGER IF EXISTS trg_compute_next_visit ON anc_visits;
DROP FUNCTION IF EXISTS compute_next_visit();
DROP TRIGGER IF EXISTS trg_visits_updated_at ON anc_visits;
DROP TABLE IF EXISTS anc_visits;
DROP TYPE IF EXISTS visit_status;

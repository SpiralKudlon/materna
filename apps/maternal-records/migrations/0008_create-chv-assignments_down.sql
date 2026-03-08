-- Down migration for 0008: Create chv_assignments table

DROP TRIGGER IF EXISTS trg_chv_limit ON chv_assignments;
DROP FUNCTION IF EXISTS check_chv_assignment_limit();
DROP TABLE IF EXISTS chv_assignments CASCADE;

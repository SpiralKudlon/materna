-- Migration 0001 DOWN: Drop notifications table

DROP TABLE IF EXISTS notifications CASCADE;
DROP FUNCTION IF EXISTS set_updated_at CASCADE;

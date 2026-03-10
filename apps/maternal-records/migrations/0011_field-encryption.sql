-- Migration 0011: Field-Level Encryption using AWS KMS Data Keys
-- 
-- 1. Add `kms_key_id` to `patients` and `medical_history` to track which
--    AWS KMS Master Key wrapped the Data Encryption Key (DEK).
-- 2. Convert `date_of_birth` (patients) from DATE to BYTEA.
-- 3. Convert `hiv_status` (medical_history) from TEXT to BYTEA.
--
-- Since SQLite / Postgres ALTER COLUMN with data type changes requires care, 
-- we use `USING` or recreate columns. Note that this zeroes existing data 
-- because standard CAST cannot bridge plaintext to ciphertext directly; 
-- in production a multi-phase column migration script would be used.

-- ──────── PATIENTS ──────────────────────────────────────────

-- 1. Add key ID tracker
ALTER TABLE patients ADD COLUMN IF NOT EXISTS kms_key_id VARCHAR(255);

-- 2. Drop the original plaintext index since it's now encrypted metadata
DROP INDEX IF EXISTS idx_patients_dob;

-- 3. Convert date_of_birth to encrypted buffer
ALTER TABLE patients 
  ALTER COLUMN date_of_birth TYPE BYTEA 
  USING NULL; -- (Nulls out existing data since we can't encrypt inside raw SQL without the key)

-- ──────── MEDICAL HISTORY ───────────────────────────────────

ALTER TABLE medical_history ADD COLUMN IF NOT EXISTS kms_key_id VARCHAR(255);

-- Drop the check constraint since 'POSITIVE' / 'NEGATIVE' will now be encrypted bytes
ALTER TABLE medical_history DROP CONSTRAINT IF EXISTS medical_history_hiv_status_check;

-- Drop index as it is no longer searchable in plaintext
DROP INDEX IF EXISTS idx_mh_hiv;

-- Convert hiv_status to encrypted buffer
ALTER TABLE medical_history 
  ALTER COLUMN hiv_status TYPE BYTEA 
  USING NULL;

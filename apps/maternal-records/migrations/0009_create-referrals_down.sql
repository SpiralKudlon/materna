-- Down migration for 0009: Create referrals table

DROP TRIGGER IF EXISTS trg_referral_state_machine ON referrals;
DROP FUNCTION IF EXISTS enforce_referral_state_machine();
DROP TABLE IF EXISTS referrals CASCADE;

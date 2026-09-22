-- =========================================================================
-- 029  A deadline on verification, and a reason when access is withdrawn.
--
-- The policy: onboard a doctor immediately, check her registration against
-- the council register in the background, and withdraw access if it does not
-- check out. Migration 014 already made that safe - an unverified doctor runs
-- her whole clinic but cannot publish under our name, print a registration
-- number we have not seen, or reach into another clinic's records.
--
-- What 014 did not give her is a DATE. "We will get to it" is how an
-- unverified account is still unverified a year later, and how a doctor
-- discovers a deadline existed at the moment it is enforced against her.
--
-- Two things here:
--
--   a deadline she is told about at the start, and which the console can
--   sort on, so the work is visible before it is overdue rather than after
--
--   a reason recorded when access is withdrawn, shown to HER. "This account
--   is suspended. Contact TCOS support." tells a doctor with patients in the
--   waiting room nothing she can act on. If we are going to withdraw access
--   we owe her the sentence explaining why.
--
-- NOT DONE HERE, and needing Vijay's decision: what happens to the PATIENT
-- RECORDS of a clinic that is removed. Today a patient's own access link
-- keeps working when a clinic is suspended, which is the right instinct -
-- the records are the patient's history, not the doctor's property, and a
-- patient losing her results because her doctor's paperwork failed is a
-- second wrong. That behaviour is preserved deliberately.
-- =========================================================================

-- When her registration must be verified by. Set at approval, and null for
-- an account that is already verified.
ALTER TABLE doctors ADD COLUMN verify_by TEXT;

-- Told once, so a reminder is not sent on every admin page load.
ALTER TABLE doctors ADD COLUMN verify_reminded_at TEXT;

-- Why access was withdrawn, in words the doctor reads. Separate from
-- verification_note, which is what the reviewer wrote for other reviewers.
ALTER TABLE doctors ADD COLUMN suspended_reason TEXT;
ALTER TABLE doctors ADD COLUMN suspended_at TEXT;
ALTER TABLE doctors ADD COLUMN suspended_by TEXT;

-- The console's queue: who is unverified, ordered by how close they are.
CREATE INDEX IF NOT EXISTS idx_doctors_verify_by
  ON doctors(verification_status, verify_by);

-- Existing unverified accounts get sixty days from today rather than a date
-- already behind them. Nobody should be overdue because of a migration.
UPDATE doctors
   SET verify_by = date('now', '+60 days')
 WHERE verify_by IS NULL
   AND verification_status IN ('unverified', 'pending');

-- =========================================================================
-- 044  One consultation attempt, one visit and one prescription draft.
--
-- A clinic connection can fail after D1 commits but before the browser sees
-- the response. Retrying must return the record that already won, not create
-- a second visit or prescription for the same consultation.
-- =========================================================================

ALTER TABLE visits ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_visits_idempotency
  ON visits(doctor_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE prescriptions ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_prescriptions_idempotency
  ON prescriptions(doctor_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

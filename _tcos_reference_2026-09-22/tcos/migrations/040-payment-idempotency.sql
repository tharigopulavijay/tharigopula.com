-- =========================================================================
-- 040  One payment action, one receipt.
--
-- A browser retry or a double-click must not record the same cash twice.
-- The client creates a key when the payment box opens and reuses it until
-- that attempt succeeds. The database, not timing, decides uniqueness.
-- =========================================================================

ALTER TABLE payments ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotency
  ON payments(doctor_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

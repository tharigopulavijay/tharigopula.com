-- =========================================================================
-- 041  One online request can become only one appointment.
--
-- The UI may retry and two front-desk users may click Accept together. The
-- request id is the permanent idempotency key; uniqueness belongs in the
-- database, not in button timing.
-- =========================================================================

ALTER TABLE appointments ADD COLUMN request_id TEXT
  REFERENCES appointment_requests(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_one_per_request
  ON appointments(doctor_id, request_id)
  WHERE request_id IS NOT NULL;

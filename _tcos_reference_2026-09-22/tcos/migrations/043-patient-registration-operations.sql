-- =========================================================================
-- 043  One patient registration, one person/list entry/number.
--
-- Patient identity is shared but a clinic's patient number is local. The
-- operation row is the retry boundary joining those two facts. A browser
-- retry returns the first registration instead of creating an orphan person
-- or advancing the clinic counter a second time.
-- =========================================================================

CREATE TABLE IF NOT EXISTS patient_registration_operations (
  id             TEXT PRIMARY KEY,
  doctor_id      TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  operation_key  TEXT NOT NULL,
  patient_id     TEXT REFERENCES patients(id) ON DELETE SET NULL,
  local_ref      TEXT,
  actor          TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (doctor_id, operation_key)
);

CREATE INDEX IF NOT EXISTS idx_patient_registration_doctor
  ON patient_registration_operations(doctor_id, created_at);

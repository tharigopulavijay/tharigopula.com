-- =========================================================================
-- How a patient reaches their own record.
--
-- THE DECISION, and the reasoning, because this is the first thing in TCOS
-- that is not doctor-only:
--
-- A patient login was the obvious idea and is the wrong one for v1. It needs
-- OTP delivery (no provider is configured), it needs password support for
-- people who will never call support, and it asks a 60-year-old patient in
-- Kukatpally to keep an account for something they look at twice a year.
--
-- Instead the doctor shares a link. The patient taps it on WhatsApp and sees
-- their record. No app, no password, nothing to remember.
--
-- WHAT THAT LINK IS, honestly: the link IS the credential, exactly like the
-- paper prescription it replaces. Anyone holding it can read the record.
-- That is the same exposure as the printout the patient already carries
-- home, so it is an acceptable trade - but it must not pretend to be more:
--
--   * the token is 32 random bytes and stored only as a hash
--   * it expires, and the doctor can revoke it at any time
--   * it grants READ of one patient's record from one doctor. Nothing else.
--     There is no patient write path anywhere in TCOS and there will not be.
--   * every open is counted and timestamped, so unusual access is visible
--
-- When SMS or email is live, add an OTP step in front of this without
-- changing the model: the link identifies the record, the code proves the
-- phone. The column for that is already here.
-- =========================================================================

CREATE TABLE IF NOT EXISTS patient_access_links (
  id             TEXT PRIMARY KEY,
  token_hash     TEXT NOT NULL UNIQUE,
  patient_id     TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id      TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  created_by     TEXT NOT NULL,
  requires_otp   INTEGER NOT NULL DEFAULT 0,  -- switched on when SMS is live
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at     TEXT NOT NULL,
  revoked_at     TEXT,
  opened_count   INTEGER NOT NULL DEFAULT 0,
  last_opened_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_pal_patient ON patient_access_links(patient_id);
CREATE INDEX IF NOT EXISTS idx_pal_doctor ON patient_access_links(doctor_id);

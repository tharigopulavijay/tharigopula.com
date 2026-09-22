-- =========================================================================
-- 028  The national health identifiers, so a record can leave this system.
--
-- ABDM is India's health data exchange: every patient can have an ABHA
-- number, every doctor an HPR id, every clinic an HFR id. Software that
-- cannot hold those three cannot participate, and a clinic outside the
-- ecosystem loses access to state insurance schemes and Ayushman Bharat
-- empanelment.
--
-- This migration adds the FIELDS only. It claims no integration and enables
-- none: nothing here talks to a government gateway, and TCOS must not say
-- "ABDM ready" until the National Health Authority has actually certified
-- milestones M1, M2 and M3.
--
-- Doing the columns first is deliberate. A clinic can start collecting ABHA
-- numbers today, by hand if necessary, and the day the integration is
-- certified the data is already there. The alternative - waiting for
-- certification, then asking every clinic to go back and capture the
-- identifier for every patient - is a migration nobody ever finishes.
-- =========================================================================

-- ----------------------------------------------------------- the patient --
-- Two different things, both called "ABHA" in conversation:
--   the NUMBER   14 digits, e.g. 91-1234-5678-9012
--   the ADDRESS  a handle like vijay@abdm, which is what a patient types
ALTER TABLE patients ADD COLUMN abha_number TEXT;
ALTER TABLE patients ADD COLUMN abha_address TEXT;

-- unverified | verified | not_available
--
-- "not_available" is a real answer and needs to be recordable: plenty of
-- patients do not have an ABHA and are not obliged to get one. Without this
-- state the front desk would be asked the same question at every visit for a
-- patient who has already said no.
ALTER TABLE patients ADD COLUMN abha_status TEXT NOT NULL DEFAULT 'unverified';
ALTER TABLE patients ADD COLUMN abha_verified_at TEXT;

CREATE INDEX IF NOT EXISTS idx_patients_abha ON patients(abha_number);

-- ------------------------------------------------------------ the doctor --
-- HPR is the Healthcare Professionals Registry. A doctor who is not on it is
-- functionally outside ABDM whatever their clinic software does, so this is
-- recorded against the person, not the account.
ALTER TABLE doctors ADD COLUMN hpr_id TEXT;
ALTER TABLE doctors ADD COLUMN hpr_verified_at TEXT;

-- HFR is the Health Facility Registry - the clinic rather than the doctor.
-- Kept on the doctor row because in TCOS a doctor row already means "the
-- practice": it owns the stock, the diary and the patient list.
ALTER TABLE doctors ADD COLUMN hfr_id TEXT;
ALTER TABLE doctors ADD COLUMN hfr_verified_at TEXT;

-- A practitioner inside a multi-doctor clinic has their own HPR id. The
-- prescription carries the practitioner who signed it, so it must carry the
-- right registry id too.
ALTER TABLE clinic_users ADD COLUMN hpr_id TEXT;

-- ------------------------------------------------------------- the links --
-- ABDM calls a linkable record a "care context": one visit, one prescription,
-- one diagnostic report, offered to the patient's health locker.
--
-- Recorded here rather than derived, because linking is a conversation with a
-- gateway that can fail halfway. A row that says "we tried, it failed, here
-- is why" is the difference between a retry and a record silently absent from
-- the patient's national health history.
CREATE TABLE IF NOT EXISTS abdm_care_contexts (
  id            TEXT PRIMARY KEY,
  doctor_id     TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id    TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  -- visit | prescription | diagnostic_report
  record_type   TEXT NOT NULL,
  record_id     TEXT NOT NULL,

  -- What ABDM knows it as, and what the patient sees in their locker.
  reference     TEXT NOT NULL,
  display       TEXT NOT NULL,

  -- pending | linked | failed | withdrawn
  status        TEXT NOT NULL DEFAULT 'pending',
  linked_at     TEXT,
  last_error    TEXT,
  attempts      INTEGER NOT NULL DEFAULT 0,

  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cc_doctor ON abdm_care_contexts(doctor_id, status);
CREATE INDEX IF NOT EXISTS idx_cc_patient ON abdm_care_contexts(doctor_id, patient_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cc_record
  ON abdm_care_contexts(doctor_id, record_type, record_id);

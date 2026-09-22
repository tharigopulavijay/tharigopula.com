-- ---------------------------------------------------------------------------
-- 008  A patient number a human can actually say out loud.
--
-- Until now a patient's visible code was 'P-bc5dc4ffd8' - a slice of an
-- internal id. Nobody can repeat that over a phone.
--
-- The number is per clinic, not per platform, and TCOS assigns it - never the
-- doctor. Two reasons for per clinic:
--
--   1. Four digits across the whole platform is 10,000 patients in total,
--      which we would exhaust with our tenth doctor. Four digits per clinic
--      is 10,000 patients EACH, which a solo practice will never reach.
--   2. A single global counter tells every doctor how small we are. Her first
--      patient being number 3 is not the impression we want to make.
--
-- Every clinic therefore starts at 1001 and the prefix keeps them apart:
-- SAHC-1001 at Sri Ashwin, NFC-1001 at Nirmal Family Clinic. When a clinic
-- passes 9999 the number simply becomes five digits - nothing to migrate.
--
-- The number is not a secret and is not used to authenticate anything. A
-- patient's own view is opened by an unguessable token, so the fact that
-- these run in sequence gives an outsider nothing.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS patient_sequences (
  doctor_id TEXT PRIMARY KEY REFERENCES doctors(id) ON DELETE CASCADE,
  next_no   INTEGER NOT NULL DEFAULT 1000    -- first handed out is 1001
);

-- Two patients at one clinic must never share a number. Without this a
-- double-add would silently produce two SAHC-1004s and the doctor would have
-- no way of knowing which chart she opened.
CREATE UNIQUE INDEX IF NOT EXISTS idx_dp_local_ref
  ON doctor_patients(doctor_id, local_ref) WHERE local_ref IS NOT NULL;

-- ---- backfill -------------------------------------------------------------
-- Existing patients are renumbered into the new scheme in the order they were
-- first seen, so the oldest patient gets the lowest number.

-- rowid is the row's insertion order, which is exactly "the order she added
-- them" and is always present - first_seen_on is nullable and would sort
-- unpredictably where it was never filled in.
UPDATE doctor_patients
   SET local_ref = (
     SELECT d.patient_prefix || '-' || (
       1000 + (SELECT COUNT(*)
                 FROM doctor_patients dp2
                WHERE dp2.doctor_id = doctor_patients.doctor_id
                  AND dp2.rowid <= doctor_patients.rowid)
     )
     FROM doctors d WHERE d.id = doctor_patients.doctor_id
   )
 WHERE EXISTS (SELECT 1 FROM doctors d
                WHERE d.id = doctor_patients.doctor_id
                  AND d.patient_prefix IS NOT NULL);

-- Start each clinic's counter above whatever the backfill just used.
-- The WHERE is not redundant: without it SQLite cannot tell this ON CONFLICT
-- from a join constraint on the SELECT, and refuses to parse the statement.
INSERT INTO patient_sequences (doctor_id, next_no)
SELECT id, 1000 + (SELECT COUNT(*) FROM doctor_patients dp WHERE dp.doctor_id = doctors.id)
  FROM doctors
 WHERE true
    ON CONFLICT(doctor_id) DO UPDATE SET next_no = excluded.next_no;

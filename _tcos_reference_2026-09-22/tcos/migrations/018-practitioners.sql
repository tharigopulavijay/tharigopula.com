-- =========================================================================
-- 018  More than one doctor in a clinic.
--
-- Five doctors who open a place together is a real customer - the
-- application form asks about it - and until now TCOS could not sell to
-- them. A `doctors` row IS the tenant, so five doctors meant five separate
-- accounts with five patient lists, five stocks, five diaries and five sets
-- of bills. Nobody wants that; they are one practice.
--
-- THE OBVIOUS FIX IS THE WRONG ONE. Introducing a `clinics` table and
-- moving the tenant boundary from doctor to clinic means adding clinic_id
-- to thirteen clinical tables, backfilling it, and rewriting every
-- WHERE doctor_id = ? in the codebase. That is the one column every safety
-- rule in TCOS rests on, proved by a test that reads every SQL statement in
-- every module. Rewriting it wholesale to add a feature is how a patient
-- ends up visible to the wrong practice.
--
-- SO THE TENANT DOES NOT MOVE. A `doctors` row already means "the practice"
-- everywhere except in our heads - it owns the stock, the diary, the bills
-- and the patient list. This migration makes that explicit: additional
-- practitioners are people who work inside that practice, in clinic_users,
-- which already exists and already carries per-person capabilities.
--
-- What that buys:
--   * one patient list, one stock, one diary, one set of books - which is
--     what a shared clinic actually wants
--   * isolation untouched. Every query still says doctor_id, and every test
--     still means what it meant this morning
--   * no backfill, no rewrite, no window where the boundary is half-moved
--
-- What it costs, honestly: everyone in the clinic shares one clinical
-- record per patient. Dr A can read Dr B's note on a patient they both see.
-- For a practice that chose to work together that is correct and is the
-- point. For a building where unrelated doctors rent rooms it is not - and
-- those should be separate TCOS accounts, which they can be, today.
--
-- WHO A PRACTITIONER IS. Not staff with extra ticks. A practitioner writes
-- clinical notes and issues prescriptions under their OWN registration
-- number, so they carry their own qualification, their own council number
-- and their own verification - and TCOS checks them exactly as it checks
-- the doctor who owns the clinic. Rule 2 is unchanged: no member of staff
-- can open a clinical record. A practitioner is not staff.
-- =========================================================================

-- Their own credentials, because their own number prints on their own
-- prescriptions. NULL for front desk, pharmacy and assistants.
ALTER TABLE clinic_users ADD COLUMN qualification TEXT;
ALTER TABLE clinic_users ADD COLUMN registration_no TEXT;
ALTER TABLE clinic_users ADD COLUMN council TEXT;

-- Same states, same meaning, same gate as a doctor's. A practitioner who is
-- not verified can work inside the clinic; what they cannot do is have a
-- registration number we have never seen printed on a document.
ALTER TABLE clinic_users ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'unverified';
ALTER TABLE clinic_users ADD COLUMN verified_at TEXT;
ALTER TABLE clinic_users ADD COLUMN verified_by TEXT;

-- WHO SAW THE PATIENT. Without this a shared clinic cannot tell which
-- doctor wrote a note, which is unacceptable in a record that has to be
-- defensible - and it makes per-doctor reporting impossible, which is the
-- first thing a five-doctor clinic asks for.
--
-- NULL means the doctor who owns the clinic, so every existing row is
-- already correct and nothing needs backfilling.
ALTER TABLE visits ADD COLUMN practitioner_id TEXT REFERENCES clinic_users(id);
ALTER TABLE prescriptions ADD COLUMN practitioner_id TEXT REFERENCES clinic_users(id);
ALTER TABLE lab_reports ADD COLUMN practitioner_id TEXT REFERENCES clinic_users(id);

CREATE INDEX IF NOT EXISTS idx_visits_practitioner
  ON visits(doctor_id, practitioner_id, visited_on);
CREATE INDEX IF NOT EXISTS idx_rx_practitioner
  ON prescriptions(doctor_id, practitioner_id, issued_on);

-- What kind of place this is. Set from the application, and it decides
-- whether the Team screen offers to add a practitioner at all - a
-- single-doctor clinic should never be shown that.
ALTER TABLE doctors ADD COLUMN facility_type TEXT NOT NULL DEFAULT 'clinic';

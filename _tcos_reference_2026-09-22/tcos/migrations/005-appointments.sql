-- =========================================================================
-- Appointments.
--
-- What the design is built around, from how these clinics actually run:
--
-- 1. THE FOLLOW-UP DATE ALREADY EXISTS AND DOES NOTHING. Every consultation
--    records "next review", and until now that was dead data. Issuing a
--    prescription now creates the appointment, so the doctor's diary fills
--    itself from the work they were already doing.
--
-- 2. MANY INDIAN CLINICS ARE WALK-IN. A day is a list of people, not a grid
--    of fifteen-minute slots. Time is optional; order is what matters.
--
-- 3. THE STATUSES ARE THE ONES THAT HAPPEN. Booked, they turned up, they
--    were seen, they did not come, it was called off. Nothing else.
--
-- Deliberately not built: multi-doctor calendars, recurring series, patient
-- self-booking. The first two belong to the clinic product; the third is the
-- website connection, and neither should shape a solo doctor's diary.
-- =========================================================================

CREATE TABLE IF NOT EXISTS appointments (
  id             TEXT PRIMARY KEY,
  doctor_id      TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id     TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  scheduled_on   TEXT NOT NULL,          -- the day
  scheduled_at   TEXT,                   -- HH:MM, optional: walk-in clinics
  duration_mins  INTEGER NOT NULL DEFAULT 15,

  reason         TEXT,
  source         TEXT NOT NULL DEFAULT 'manual',  -- manual | follow_up | phone
  from_visit_id  TEXT REFERENCES visits(id) ON DELETE SET NULL,

  status         TEXT NOT NULL DEFAULT 'scheduled',
                 -- scheduled | arrived | completed | no_show | cancelled
  arrived_at     TEXT,
  completed_at   TEXT,
  cancel_reason  TEXT,

  notes          TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT
);

-- The query that runs on every page load: this doctor, this day.
CREATE INDEX IF NOT EXISTS idx_appt_day ON appointments(doctor_id, scheduled_on, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appt_patient ON appointments(patient_id, scheduled_on);
CREATE INDEX IF NOT EXISTS idx_appt_status ON appointments(doctor_id, status, scheduled_on);

-- One follow-up per visit. Issuing the same prescription twice must not put
-- the patient in the diary twice.
CREATE UNIQUE INDEX IF NOT EXISTS idx_appt_one_per_visit
  ON appointments(from_visit_id) WHERE from_visit_id IS NOT NULL;

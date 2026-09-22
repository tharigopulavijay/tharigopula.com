-- =========================================================================
-- 013  Doctor applications - how a doctor actually joins.
--
-- There was a self-signup route (POST /auth/signup/verify) that created a
-- LIVE doctor account from a form and an SMS code. Two things were wrong
-- with it: it needed an SMS provider that does not exist, so it could never
-- complete; and if it had completed, anyone could have created a working
-- clinical account by typing a name. Nobody checked a registration number.
--
-- This table replaces it. An application is NOT an account. It holds what
-- the doctor typed and nothing more - no password, no session, no access to
-- anything. Someone at Tharigopula reads it, checks the registration number
-- against the council, and only then does approving it create the doctor.
--
-- That ordering is the product: a prescription issued through TCOS carries
-- our name, so we verify the person before they can issue one.
--
-- No doctor_id column constraint until approval: the row exists precisely
-- because there is no doctor yet.
-- =========================================================================

CREATE TABLE IF NOT EXISTS doctor_applications (
  id               TEXT PRIMARY KEY,

  -- What the doctor typed. Kept exactly as submitted, so that when the
  -- council register disagrees we can see which of the two is wrong.
  full_name        TEXT NOT NULL,
  mobile           TEXT NOT NULL,
  email            TEXT,
  qualification    TEXT,
  registration_no  TEXT,
  council          TEXT,                -- which register to check them against
  clinic_name      TEXT NOT NULL,
  city             TEXT,
  state            TEXT,

  -- Which product they are applying for. Decides the workspace they get on
  -- approval, and it is checked against the qualification: a BHMS asking
  -- for AlloCOS is the exact case a human needs to look at.
  discipline       TEXT NOT NULL DEFAULT 'ayurcos',

  -- "How many people work here" turned out to be two different questions.
  -- Five doctors who opened a place together is a completely different sale
  -- from one doctor with five staff: different pricing, different number of
  -- workspaces, and only one of them needs a shared appointment diary.
  facility_type    TEXT,                -- 'clinic' | 'multi_doctor' | 'hospital'
  doctor_count     INTEGER,             -- practitioners who will see patients
  staff_count      INTEGER,             -- front desk, pharmacy, assistants

  message          TEXT,                -- anything else they want to say
  source           TEXT,                -- which page or campaign sent them

  -- new -> reviewing -> approved | rejected. Nothing is deleted: a rejected
  -- application is evidence that we looked, and a doctor who reapplies
  -- should meet the same history.
  status           TEXT NOT NULL DEFAULT 'new',
  review_note      TEXT,                -- internal, never shown to the doctor
  rejection_reason TEXT,                -- what we would tell them
  reviewed_by      TEXT,                -- platform_team email
  reviewed_at      TEXT,

  -- Set when approved, linking the application to the account it created.
  doctor_id        TEXT REFERENCES doctors(id) ON DELETE SET NULL,

  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_applications_status
  ON doctor_applications(status, created_at DESC);

-- One open application per mobile. A doctor who submits the form three
-- times because nothing appeared to happen should not produce three rows
-- for somebody to review, and should not be able to flood the queue.
CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_open_mobile
  ON doctor_applications(mobile) WHERE status IN ('new', 'reviewing');

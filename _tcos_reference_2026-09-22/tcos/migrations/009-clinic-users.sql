-- ---------------------------------------------------------------------------
-- 009  Staff accounts, created by the doctor.
--
-- Until now a clinic had exactly one login: hers. Sharing it is what actually
-- happens in a real practice, and a shared password means the audit log is
-- fiction - every line says "the doctor" even when the receptionist typed it.
--
-- A staff account belongs to exactly one doctor. That is the tenant boundary
-- and it does not change: every clinical query still filters by doctor_id.
-- What changes is that a session now also remembers WHICH PERSON is using it,
-- and what that person is allowed to do.
--
-- The roles, and the one rule that matters:
--
--   front_desk  - appointments and patient details. No clinical notes.
--   pharmacist  - stock, batches and dispensing. No clinical notes.
--   assistant   - appointments, patients and vitals. No clinical notes.
--
-- Nobody except the doctor reads a note, a diagnosis or a prescription. That
-- is the difference between giving someone access to your practice and
-- handing over the record, and it is enforced in the router, not in the
-- interface - hiding a button is not a permission.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS clinic_users (
  id            TEXT PRIMARY KEY,
  doctor_id     TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  mobile        TEXT NOT NULL UNIQUE,   -- how they sign in; one clinic each
  role          TEXT NOT NULL,          -- front_desk | pharmacist | assistant
  password_hash TEXT,
  password_salt TEXT,

  -- Every staff account starts on a temporary password. It is shown to the
  -- doctor once, never stored in readable form, and must be replaced before
  -- anything opens.
  must_change_password INTEGER NOT NULL DEFAULT 1,

  status        TEXT NOT NULL DEFAULT 'active',   -- active | revoked
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_sign_in_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_clinic_users_doctor ON clinic_users(doctor_id, status);

-- A session already knew which clinic it belonged to. Now it also knows who
-- is holding it. NULL means the doctor herself, so every existing session
-- keeps working and keeps full rights.
ALTER TABLE sessions ADD COLUMN user_id TEXT;

-- The audit log stops saying "the doctor" for work someone else did.
ALTER TABLE audit_events ADD COLUMN actor_user_id TEXT;

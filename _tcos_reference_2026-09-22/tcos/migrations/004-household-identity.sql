-- =========================================================================
-- A mobile number is a household, not a person.
--
-- THE BUG THIS FIXES: patients.mobile was UNIQUE, so I had modelled a phone
-- number as one human being. Adding a second family member on the same
-- number did not error - upsert() found the existing row and returned it.
-- The doctor believed they had added the wife; every prescription, report
-- and visit from that moment attached to the husband's chart, and nothing
-- on screen looked wrong.
--
-- SQLite cannot drop a UNIQUE constraint, so the table is rebuilt. Foreign
-- keys are held off for the swap, otherwise dropping patients cascades and
-- takes every clinical record with it.
--
-- What replaces it:
--   * several people may share one contact number
--   * each person carries their own stable code, so their record survives
--     the number changing
--   * (mobile, full_name) is unique, which stops the same person being
--     entered twice by accident while still allowing the whole family
-- =========================================================================

PRAGMA foreign_keys = OFF;

CREATE TABLE patients_rebuilt (
  id              TEXT PRIMARY KEY,
  patient_code    TEXT UNIQUE,          -- the person's own identifier
  mobile          TEXT NOT NULL,        -- the household's contact number
  mobile_verified INTEGER NOT NULL DEFAULT 0,
  full_name       TEXT NOT NULL,
  sex             TEXT,
  date_of_birth   TEXT,
  blood_group     TEXT,
  relation        TEXT,                 -- self, spouse, child, parent, other
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO patients_rebuilt
  (id, patient_code, mobile, mobile_verified, full_name, sex, date_of_birth, blood_group, relation, created_at)
SELECT id,
       'P-' || substr(replace(id, 'pat_', ''), 1, 10),
       mobile, mobile_verified, full_name, sex, date_of_birth, blood_group,
       'self', created_at
  FROM patients;

DROP TABLE patients;
ALTER TABLE patients_rebuilt RENAME TO patients;

CREATE INDEX IF NOT EXISTS idx_patients_mobile ON patients(mobile);
CREATE INDEX IF NOT EXISTS idx_patients_code ON patients(patient_code);

-- The same person twice on one number is a mistake; the family is not.
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_household
  ON patients(mobile, full_name);

PRAGMA foreign_keys = ON;

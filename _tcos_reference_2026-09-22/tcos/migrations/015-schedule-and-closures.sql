-- =========================================================================
-- 015  A schedule that matches how clinics actually open.
--
-- weekly_hours held ONE open/close pair per weekday. Almost no Indian clinic
-- runs that way: the normal shape is a morning sitting and an evening
-- sitting with the afternoon shut, and a single pair cannot say that. A
-- doctor who works 9-1 and 5-8 had to either publish 9-8 (wrong, and
-- patients arrive at 3pm) or 9-1 (wrong, and the evening looks closed).
--
-- New shape, per day:
--
--   {"mon": {"closed": false,
--            "sessions": [{"open":"09:00","close":"13:00"},
--                         {"open":"17:00","close":"20:00"}]},
--    "sun": {"closed": true, "sessions": []}}
--
-- The old shape is migrated below rather than being read at runtime, so
-- there is exactly one shape in the code.
--
-- Closures are separate and deliberately so. "I am at a wedding on the 14th"
-- is not a change to the weekly pattern - it is an exception to it, and
-- folding it into weekly_hours would mean editing the pattern twice: once to
-- close and once to put it back. A doctor who has to remember to undo a
-- setting will forget, and then the clinic looks shut for a month.
-- =========================================================================

CREATE TABLE IF NOT EXISTS clinic_closures (
  id         TEXT PRIMARY KEY,
  doctor_id  TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,

  -- Inclusive range. A single day is the same date twice, so the diary and
  -- the public page need only one rule to read.
  starts_on  TEXT NOT NULL,
  ends_on    TEXT NOT NULL,

  -- Shown to patients on the public page, so it is written for them:
  -- "Closed for Diwali", not "leave". Optional.
  reason     TEXT,

  -- A half day rather than a full closure: the clinic opens, but on these
  -- hours instead of the weekly ones. NULL means closed all day.
  sessions   TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_closures_doctor
  ON clinic_closures(doctor_id, starts_on, ends_on);

-- No bulk UPDATE here on purpose. Rewriting the old shape in SQL needs a
-- seven-branch UNION per row, and D1 rejects that with "too many terms in
-- compound SELECT" - a limit lower than SQLite's own, which is why the same
-- statement passes locally under node:sqlite and fails on the real database.
--
-- worker/schedule.js upgrades the old shape when it reads it instead:
-- {"open":"09:00","close":"18:00"} becomes a single session. That costs
-- nothing, cannot half-apply the way a failed bulk UPDATE can, and means a
-- row written by an older deploy is still readable by a newer one.

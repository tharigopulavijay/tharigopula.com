-- =========================================================================
-- 021  Warn, then a reserve tank, then stop.
--
-- The previous version stopped at the limit. Vijay's correction is better,
-- and it is better for both sides: a doctor mid-consultation who hits a wall
-- blames the software and leaves; a doctor who is told "you are close, and
-- you have three days" pays. The few rupees of overage during those three
-- days cost far less than the churn a wall causes.
--
-- Four states, and the doctor sees which one she is in:
--
--   ok           under 80% of the allowance. Nothing shown.
--   approaching  80-100%. "You have used 812 of 1,000 messages."
--   over         past it, inside the reserve. Everything still works, and
--                it says how many days are left.
--   expired      the three days ran out. NOW it stops.
--
-- The reserve starts the moment a limit is first exceeded, not at the start
-- of the month, so it is genuinely three days of warning rather than an
-- accident of the calendar. Paying, or usage falling back under the line,
-- resolves it - and resolving CLEARS the row, so the next breach next month
-- gets a fresh three days rather than a stop.
--
-- Seat limits are excluded on purpose. Adding a fifth staff account is not
-- work in progress and nobody is waiting on it, so it stops at the limit as
-- before. The reserve is for things a doctor is in the middle of.
-- =========================================================================

CREATE TABLE IF NOT EXISTS plan_grace (
  doctor_id    TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  limit_key    TEXT NOT NULL,
  started_at   TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at   TEXT NOT NULL,
  -- What they were over by when it started, so support can see whether this
  -- was a busy week or a plan that no longer fits.
  usage_at_start INTEGER NOT NULL DEFAULT 0,
  notified_at  TEXT,
  PRIMARY KEY (doctor_id, limit_key)
);

CREATE INDEX IF NOT EXISTS idx_grace_expiry ON plan_grace(expires_at);

-- How long the reserve lasts, editable without a deploy - three days is a
-- guess about human behaviour, not a fact, and it will want tuning once
-- there are real customers to watch.
INSERT OR REPLACE INTO cost_rates (id, label, category, unit, paise_per_unit, note) VALUES
 ('grace_days','Reserve days past a limit','platform','each',3,
  'Not money: the number of days a clinic keeps working after passing an allowance. Stored here so it can be changed without a deploy.');

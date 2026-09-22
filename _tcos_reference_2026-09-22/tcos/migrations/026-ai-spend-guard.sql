-- =========================================================================
-- 026  The thing that watches what the AI is spending.
--
-- WHY THIS EXISTS. TCOS sells FIXED monthly plans and pays VARIABLE per-call
-- costs. That is the oldest way for software like this to fail: revenue is
-- capped and cost is not. One clinic bulk-uploading, one retry loop, one
-- pathological 300-page PDF, and a month's margin is gone in an afternoon.
-- Nobody notices until the card statement arrives.
--
-- A per-plan allowance does not solve it. Allowances are counted in
-- DOCUMENTS; the bill is in TOKENS, and the two come apart precisely when
-- something is wrong - a hundred documents is fine, a hundred RETRIES of the
-- same document is not, and both count as a hundred.
--
-- So three tables:
--
--   ai_spend    every model call, whether it worked or not. A call that
--               fails still burns tokens, and a ledger that only records
--               successes under-reports exactly when things are going wrong.
--
--   ai_breaker  whether AI is allowed to run right now, per clinic and
--               platform-wide. Something has to be able to say no.
--
--   ai_queue    documents parked while it is saying no. The work is not
--               lost and not silently dropped; it waits and is retried.
-- =========================================================================

-- --------------------------------------------------------------- ledger --
CREATE TABLE IF NOT EXISTS ai_spend (
  id            TEXT PRIMARY KEY,
  doctor_id     TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,

  kind          TEXT NOT NULL,        -- preflight | extraction
  model         TEXT,

  -- Recorded even when outcome is not 'ok'. Tokens spent on a call that
  -- then failed to parse are still tokens somebody paid for.
  input_tokens  INTEGER NOT NULL DEFAULT 0,
  cached_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_paise    INTEGER NOT NULL DEFAULT 0,

  -- ok        the call returned something usable
  -- failed    the provider errored, or the answer could not be used
  -- refused   the model declined
  -- blocked   the guard stopped it BEFORE calling, so cost_paise is 0
  outcome       TEXT NOT NULL DEFAULT 'ok',
  detail        TEXT,
  duration_ms   INTEGER,

  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The two questions asked on every single call: what has this clinic spent
-- recently, and what has the whole platform spent recently.
CREATE INDEX IF NOT EXISTS idx_spend_doctor_time ON ai_spend(doctor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_spend_time        ON ai_spend(created_at DESC);

-- -------------------------------------------------------------- breaker --
CREATE TABLE IF NOT EXISTS ai_breaker (
  -- 'platform', or 'doctor:<id>'. One row per thing that can be stopped
  -- independently, so one clinic's runaway does not stop every other clinic.
  scope         TEXT PRIMARY KEY,

  -- closed     normal
  -- open       stopped; calls are refused and documents are queued
  -- half_open  one call allowed through to see whether it is safe again
  state         TEXT NOT NULL DEFAULT 'closed',

  reason        TEXT,                 -- in words an admin can act on
  tripped_at    TEXT,
  -- When to try again on its own. A breaker that only a human can reset
  -- becomes a breaker nobody resets, and the feature stays dead all weekend.
  resets_at     TEXT,
  window_paise  INTEGER,              -- what was spent in the window that tripped it
  notified_at   TEXT,                 -- so the admin is told once, not every call
  cleared_at    TEXT,
  cleared_by    TEXT
);

-- ---------------------------------------------------------------- queue --
CREATE TABLE IF NOT EXISTS ai_queue (
  id            TEXT PRIMARY KEY,
  doctor_id     TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id    TEXT REFERENCES patients(id) ON DELETE SET NULL,
  file_id       TEXT REFERENCES files(id) ON DELETE SET NULL,
  kind          TEXT NOT NULL DEFAULT 'preflight',

  -- waiting | done | abandoned
  status        TEXT NOT NULL DEFAULT 'waiting',
  attempts      INTEGER NOT NULL DEFAULT 0,
  last_error    TEXT,

  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_queue_waiting ON ai_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_queue_doctor  ON ai_queue(doctor_id, status);

-- ---------------------------------------------------------------- rates --
-- The numbers the guard trips on. Held as rows rather than constants in the
-- code so a limit can be raised at 11pm without a deploy - which is when
-- somebody will need to raise one.
CREATE TABLE IF NOT EXISTS ai_limits (
  key           TEXT PRIMARY KEY,
  value_paise   INTEGER NOT NULL,
  note          TEXT
);

INSERT OR REPLACE INTO ai_limits (key, value_paise, note) VALUES
  ('call_ceiling',      2500,
   'Most a single document may cost. A normal report is 300-500 paise; 2500 means something is wrong with the document, not with the clinic.'),
  ('clinic_hour',       15000,
   'Most one clinic may spend in a rolling hour. About 40 reports - more than any real clinic reads in an hour.'),
  ('clinic_day',        60000,
   'Most one clinic may spend in a rolling day.'),
  ('platform_hour',    100000,
   'Most every clinic together may spend in a rolling hour. This is the one that catches a bug in OUR code rather than misuse in theirs.'),
  ('platform_day',     400000,
   'Most every clinic together may spend in a rolling day. Roughly a month of expected volume, so tripping it means something is badly wrong.');

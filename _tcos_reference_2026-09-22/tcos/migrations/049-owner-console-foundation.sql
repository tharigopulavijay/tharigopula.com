-- =========================================================================
-- 049  Owner console: accountable support, delegated access and real costs.
--
-- The original console could show a support subject, a role and unit rates.
-- It could not show a conversation, assign work, grant narrow access, or
-- record the salaries and software subscriptions that actually decide
-- whether TCOS is profitable. These additions are operational metadata only;
-- they do not give the platform team access to clinical content.
-- =========================================================================

ALTER TABLE platform_team ADD COLUMN capabilities TEXT;
ALTER TABLE platform_team ADD COLUMN invited_by TEXT;
ALTER TABLE platform_team ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;

ALTER TABLE doctors ADD COLUMN plan_source TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE doctors ADD COLUMN plan_override_reason TEXT;
ALTER TABLE doctors ADD COLUMN plan_updated_at TEXT;

ALTER TABLE support_requests ADD COLUMN assigned_to TEXT
  REFERENCES platform_team(email);
ALTER TABLE support_requests ADD COLUMN first_response_at TEXT;
ALTER TABLE support_requests ADD COLUMN resolved_at TEXT;

CREATE TABLE IF NOT EXISTS support_messages (
  id            TEXT PRIMARY KEY,
  request_id    TEXT NOT NULL REFERENCES support_requests(id) ON DELETE CASCADE,
  author_type   TEXT NOT NULL, -- clinic | platform
  author_ref    TEXT NOT NULL,
  body          TEXT NOT NULL,
  internal      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (author_type IN ('clinic','platform')),
  CHECK (internal IN (0,1))
);
CREATE INDEX IF NOT EXISTS idx_support_messages_request
  ON support_messages(request_id, created_at, id);

-- Preserve every existing opening message as the first item in its thread.
INSERT OR IGNORE INTO support_messages
  (id, request_id, author_type, author_ref, body, internal, created_at)
SELECT 'opening_' || id, id, 'clinic', created_by, message, 0, created_at
  FROM support_requests;

-- A cost is deliberately independent from a provider usage rate. It covers
-- people, subscriptions, professional services and one-time purchases. A
-- shared Tharigopula cost can allocate only the percentage that belongs to
-- TCOS; an imputed cost (for example the owner's time) is kept separate from
-- cash leaving the bank while still appearing in true economic margin.
CREATE TABLE IF NOT EXISTS business_costs (
  id                  TEXT PRIMARY KEY,
  label               TEXT NOT NULL,
  category            TEXT NOT NULL,
  vendor              TEXT,
  scope               TEXT NOT NULL DEFAULT 'tcos',
  doctor_id           TEXT REFERENCES doctors(id) ON DELETE SET NULL,
  amount_paise        INTEGER NOT NULL,
  cadence             TEXT NOT NULL DEFAULT 'monthly',
  cash_type           TEXT NOT NULL DEFAULT 'cash',
  allocation_percent  INTEGER NOT NULL DEFAULT 100,
  starts_on           TEXT NOT NULL,
  ends_on             TEXT,
  note                TEXT,
  active              INTEGER NOT NULL DEFAULT 1,
  created_by          TEXT NOT NULL,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (scope IN ('shared','tcos','clinic')),
  CHECK (cadence IN ('monthly','yearly','one_time')),
  CHECK (cash_type IN ('cash','imputed')),
  CHECK (amount_paise >= 0),
  CHECK (allocation_percent BETWEEN 0 AND 100),
  CHECK ((scope = 'clinic' AND doctor_id IS NOT NULL) OR
         (scope <> 'clinic' AND doctor_id IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_business_costs_period
  ON business_costs(active, starts_on, ends_on);

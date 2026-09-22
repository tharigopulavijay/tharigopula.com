-- =========================================================================
-- 038  Subscription payments that change access without a person doing it.
--
-- Razorpay keeps mandates and card details. TCOS keeps only provider ids,
-- amounts, status and the entitlement decision they produced. A successful
-- signed event changes doctors.plan immediately; a failed renewal opens a
-- three-day reserve; expiry falls back to Free without deleting one byte of
-- clinical data.
--
-- Provider plan ids are data rather than environment variables. Prices can
-- change by creating a new immutable provider plan while old subscriptions
-- continue to point at the price they authorised.
-- =========================================================================

CREATE TABLE IF NOT EXISTS subscription_plan_catalog (
  id                TEXT PRIMARY KEY,
  provider          TEXT NOT NULL DEFAULT 'razorpay',
  plan              TEXT NOT NULL,
  cadence           TEXT NOT NULL,
  price_paise       INTEGER NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'INR',
  provider_plan_id  TEXT,
  active            INTEGER NOT NULL DEFAULT 1,
  synced_at         TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (provider, provider_plan_id),
  UNIQUE (provider, plan, cadence, price_paise),
  CHECK (plan IN ('starter','pro','pro_plus')),
  CHECK (cadence IN ('monthly','yearly')),
  CHECK (price_paise > 0)
);

-- Never REPLACE these rows: doing so would erase the provider-plan mapping
-- used by existing subscribers if a migration ledger were ever repaired or
-- replayed. A new price gets a new versioned id instead.
INSERT OR IGNORE INTO subscription_plan_catalog
  (id, provider, plan, cadence, price_paise, currency, active) VALUES
  ('rzp_starter_monthly_v1','razorpay','starter','monthly',  89900,'INR',1),
  ('rzp_starter_yearly_v1','razorpay','starter','yearly',  899000,'INR',1),
  ('rzp_pro_monthly_v1','razorpay','pro','monthly',     219900,'INR',1),
  ('rzp_pro_yearly_v1','razorpay','pro','yearly',    2199000,'INR',1),
  ('rzp_pro_plus_monthly_v1','razorpay','pro_plus','monthly',449900,'INR',1),
  ('rzp_pro_plus_yearly_v1','razorpay','pro_plus','yearly',4499000,'INR',1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_catalog_one_active
  ON subscription_plan_catalog(provider, plan, cadence) WHERE active = 1;

CREATE TABLE IF NOT EXISTS subscriptions (
  id                        TEXT PRIMARY KEY,
  doctor_id                 TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  provider                  TEXT NOT NULL DEFAULT 'razorpay',
  provider_subscription_id  TEXT NOT NULL,
  provider_plan_id          TEXT NOT NULL,
  plan                      TEXT NOT NULL,
  cadence                   TEXT NOT NULL,
  price_paise               INTEGER NOT NULL,
  currency                  TEXT NOT NULL DEFAULT 'INR',
  status                    TEXT NOT NULL DEFAULT 'created',
  checkout_url              TEXT,
  current_start             TEXT,
  current_end               TEXT,
  access_until              TEXT,
  cancel_at_cycle_end       INTEGER NOT NULL DEFAULT 0,
  last_provider_event_at    INTEGER,
  created_at                TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (provider, provider_subscription_id),
  CHECK (plan IN ('starter','pro','pro_plus')),
  CHECK (cadence IN ('monthly','yearly')),
  CHECK (status IN ('created','authenticated','active','pending','halted',
                    'paused','cancelled','completed','expired'))
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_doctor
  ON subscriptions(doctor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_access
  ON subscriptions(status, access_until);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_one_open
  ON subscriptions(doctor_id)
  WHERE status IN ('created','authenticated','active','pending','halted','paused');

-- Raw webhook bodies are deliberately not retained. The hash proves which
-- payload was acted on without keeping customer/payment metadata twice.
CREATE TABLE IF NOT EXISTS payment_webhook_events (
  provider          TEXT NOT NULL,
  event_id          TEXT NOT NULL,
  event_type        TEXT NOT NULL,
  payload_sha256    TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'received',
  attempts          INTEGER NOT NULL DEFAULT 0,
  last_error        TEXT,
  received_at       TEXT NOT NULL DEFAULT (datetime('now')),
  last_attempt_at   TEXT,
  processed_at      TEXT,
  PRIMARY KEY (provider, event_id),
  CHECK (status IN ('received','processing','processed','ignored','failed'))
);

CREATE INDEX IF NOT EXISTS idx_payment_events_retry
  ON payment_webhook_events(status, last_attempt_at);

CREATE TABLE IF NOT EXISTS subscription_payments (
  id                    TEXT PRIMARY KEY,
  doctor_id             TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  subscription_id       TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  provider              TEXT NOT NULL DEFAULT 'razorpay',
  provider_payment_id   TEXT NOT NULL,
  provider_invoice_id   TEXT,
  amount_paise          INTEGER NOT NULL DEFAULT 0,
  currency              TEXT NOT NULL DEFAULT 'INR',
  status                TEXT NOT NULL,
  occurred_at           TEXT,
  recorded_at           TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (provider, provider_payment_id)
);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_doctor
  ON subscription_payments(doctor_id, occurred_at DESC);

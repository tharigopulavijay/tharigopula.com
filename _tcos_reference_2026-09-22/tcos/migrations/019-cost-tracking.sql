-- =========================================================================
-- 019  What each clinic actually costs to run.
--
-- Vijay's question was "how much am I paying, and is it measurable". It has
-- to be, because the answer decides pricing - and the intuition people
-- start with is almost always wrong in the same direction: they assume
-- storage is the cost and it is a rounding error, while the thing that
-- actually scales with customers is messages.
--
-- usage_events already records what happens (patient_created, rx_issued,
-- lab_report_recorded...) and has an estimated_cost column nothing fills
-- in. This supplies the missing half: what a unit of each thing costs.
--
-- Rates live in the database rather than in code because they change
-- without us - Cloudflare adjusts prices, a WhatsApp provider changes its
-- per-conversation rate, the rupee moves. Editing a row should not need a
-- deploy.
--
-- Everything is integer paise, rule 5. A rate of 130 means ₹1.30.
-- =========================================================================

CREATE TABLE IF NOT EXISTS cost_rates (
  id              TEXT PRIMARY KEY,     -- matches usage_events.event_type where it can
  label           TEXT NOT NULL,        -- what this is, in words
  category        TEXT NOT NULL,        -- storage | database | messaging | ai | platform
  unit            TEXT NOT NULL,        -- each | per_1000 | gb_month | month
  paise_per_unit  INTEGER NOT NULL DEFAULT 0,
  note            TEXT,                 -- where the number came from
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seeded from Cloudflare's published prices at ~₹88/USD, and from typical
-- Indian provider rates. They are ESTIMATES and are meant to be edited -
-- the note on each row says where it came from so a stale one is obvious.
INSERT OR REPLACE INTO cost_rates (id, label, category, unit, paise_per_unit, note) VALUES
 ('storage_gb_month','File storage','storage','gb_month',132,
  'Cloudflare R2 $0.015/GB-month. First 10GB free ACROSS THE ACCOUNT, not per clinic.'),
 ('class_a_1k','File uploads','storage','per_1000',40,
  'R2 Class A $4.50/million. 1 million free per month.'),
 ('class_b_1k','File reads','storage','per_1000',4,
  'R2 Class B $0.36/million. 10 million free per month.'),

 ('rows_written_1k','Database writes','database','per_1000',9,
  'D1 $1.00 per million rows written. 50 million included on Workers Paid.'),
 ('rows_read_1k','Database reads','database','per_1000',1,
  'D1 $0.001 per million rows read. 25 billion included. Effectively free.'),

 -- The one that actually scales with customers. A clinic messaging every
 -- patient costs more than its storage, database and compute combined.
 ('whatsapp_message','WhatsApp message','messaging','each',55,
  'Meta conversation pricing via a BSP, India utility template. Varies 30-80 paise.'),
 ('sms_message','SMS','messaging','each',20,
  'Typical Indian transactional SMS. Excludes one-time DLT registration.'),

 ('ai_document','AI reading a document','ai','each',200,
  'OCR plus extraction of one lab report. Rough - depends on model and page count.'),

 -- Fixed monthly costs that exist whether there is one clinic or a hundred.
 -- Held here so the margin view can spread them rather than pretending
 -- they are zero.
 ('platform_workers','Cloudflare Workers Paid','platform','month',44000,
  '$5/month flat. Covers 10 million requests.'),
 ('platform_messaging_bsp','WhatsApp provider platform fee','platform','month',0,
  'Gupshup / Interakt / AiSensy monthly fee. Set once chosen; 0 until then.'),
 ('platform_domain','Domains','platform','month',400,
  'About ₹1,000-1,200 a year for .com plus .in, spread monthly.');

-- What a clinic is billed. plan prices live in js/tcos-plans.js for display,
-- but margin has to be computed server-side from a number that cannot be
-- edited in the browser.
CREATE TABLE IF NOT EXISTS plan_prices (
  plan           TEXT PRIMARY KEY,
  paise_monthly  INTEGER NOT NULL DEFAULT 0,
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR REPLACE INTO plan_prices (plan, paise_monthly) VALUES
 ('basic', 0), ('pro', 99900), ('pro_plus', 249900), ('clinic', 99900);

CREATE INDEX IF NOT EXISTS idx_usage_month
  ON usage_events(occurred_at, doctor_id, event_type);

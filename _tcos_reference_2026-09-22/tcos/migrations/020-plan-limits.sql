-- =========================================================================
-- 020  Every plan says exactly what it includes, and the code enforces it.
--
-- The rule this exists to make true: A FREE CLINIC MUST COST US NOTHING.
-- Not "a little". Nothing. The way to get there is not a small allowance of
-- the expensive things - it is none of them. Free gets no messages and no
-- AI at all, which are the only two costs that scale with use. What is left
-- is a couple of hundred megabytes of storage, which rounds to zero.
--
-- A "generous free tier" that includes 50 messages does not cost zero, it
-- costs ₹27.50 per signup forever, and free signups are the ones that
-- arrive in volume.
--
-- The second rule: NOTHING IS UNLIMITED, and the doctor is told the number
-- before she buys, not after she exceeds it.
--
--   hard_stop = 1   the action is refused at the limit, the way ChatGPT
--                   stops rather than quietly billing more. Used where an
--                   overage would be a surprise on an invoice.
--   hard_stop = 0   allowed and charged at overage_paise. Used where
--                   stopping would be worse than the charge - refusing to
--                   register a patient mid-consultation is not acceptable
--                   behaviour from clinical software.
--
-- The distinction matters. A free clinic hitting its patient cap is told to
-- upgrade. A paying clinic hitting its message allowance keeps working and
-- pays ₹1.50 a message.
-- =========================================================================

CREATE TABLE IF NOT EXISTS plan_limits (
  plan           TEXT NOT NULL,
  limit_key      TEXT NOT NULL,   -- patients | staff | doctors | messages | ai_documents | storage_mb
  included       INTEGER NOT NULL DEFAULT 0,
  overage_paise  INTEGER NOT NULL DEFAULT 0,   -- per unit beyond `included`
  hard_stop      INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (plan, limit_key)
);

-- FREE - costs us ₹0 because the two metered things are zero.
INSERT OR REPLACE INTO plan_limits (plan, limit_key, included, overage_paise, hard_stop) VALUES
 ('basic','patients',100,0,1),
 ('basic','staff',1,0,1),
 ('basic','doctors',1,0,1),
 ('basic','messages',0,0,1),
 ('basic','ai_documents',0,0,1),
 ('basic','storage_mb',200,0,1),

-- STARTER ₹499 - costs us ~₹98 fully used.
 ('starter','patients',1000,0,0),
 ('starter','staff',3,0,1),
 ('starter','doctors',1,0,1),
 ('starter','messages',100,150,0),
 ('starter','ai_documents',20,400,0),
 ('starter','storage_mb',2048,0,0),

-- CLINIC ₹1,499 - costs us ~₹488 fully used.
 ('pro','patients',5000,0,0),
 ('pro','staff',10,0,1),
 ('pro','doctors',1,0,1),
 ('pro','messages',500,150,0),
 ('pro','ai_documents',100,400,0),
 ('pro','storage_mb',10240,0,0),

-- PRACTICE ₹3,499 - costs us ~₹1,458 fully used.
 ('pro_plus','patients',25000,0,0),
 ('pro_plus','staff',25,0,1),
 ('pro_plus','doctors',5,0,1),
 ('pro_plus','messages',1500,150,0),
 ('pro_plus','ai_documents',300,400,0),
 ('pro_plus','storage_mb',25600,0,0),

-- The old 'clinic' plan some demo rows still carry. Same as Clinic so
-- nothing already onboarded loses access the day this ships.
 ('clinic','patients',5000,0,0),
 ('clinic','staff',10,0,1),
 ('clinic','doctors',1,0,1),
 ('clinic','messages',500,150,0),
 ('clinic','ai_documents',100,400,0),
 ('clinic','storage_mb',10240,0,0);

-- Prices to match. Starter is new; the two existing ones move to the
-- numbers the cost model supports.
INSERT OR REPLACE INTO plan_prices (plan, paise_monthly) VALUES
 ('basic', 0), ('starter', 49900), ('pro', 149900),
 ('pro_plus', 349900), ('clinic', 149900);

-- =========================================================================
-- Coupons.
--
-- Vijay: "i want to have coupons management here like i can add a coupon id
-- and add the % discount and able to add more flexibility and able to delete
-- also like any festival offer and i can add and delete or uncheck it so
-- that people can use while purchasing - currently add TCOS10 for 10%
-- DISCOUNT but it should be editable and i can be able to add so on."
--
-- THE ONE THING THAT MAKES THIS REAL RATHER THAN A SCREEN.
-- Razorpay charges the card against a plan. A percentage typed into TCOS
-- changes nothing on their side: the doctor would read "10% off", agree, and
-- be charged the full amount. The only way the discount actually happens is
-- Razorpay's own Offer, referenced by offer_id when the subscription is
-- created - and offers can only be made in the Razorpay dashboard, not over
-- the API.
--
-- So a coupon here is a PAIRING: a code a doctor can remember and rules we
-- enforce, bolted to a Razorpay offer that does the discounting. A coupon
-- with no provider_offer_id cannot be switched on. That is enforced in
-- worker/coupons.js and asserted in test/coupons.test.js, because "nothing
-- advertised that is not built" has to include money.
-- =========================================================================

CREATE TABLE coupons (
  id            TEXT PRIMARY KEY,

  -- What she types. Stored upper case and compared upper case, because
  -- nobody types "tcos10" the same way twice and a coupon that works only in
  -- capitals is a support call on every festival.
  code          TEXT NOT NULL UNIQUE,

  -- What it is called in the console: "Diwali 2026". Never shown as the code.
  label         TEXT,

  -- Whole percent, 1-100. Integer, like every other number in TCOS that
  -- touches money - 0.1 + 0.2 is how a day's takings stop matching the cash
  -- box. This is what we DISPLAY; what is CHARGED comes from the offer below,
  -- and coupons.js refuses to let the two disagree silently.
  percent_off   INTEGER NOT NULL,

  -- Razorpay's offer id (offer_xxxxxxxx), made in their dashboard. Without
  -- it the discount is decorative, so `active` cannot be set while this is
  -- null.
  provider_offer_id TEXT,

  -- Off by default. A coupon is created, checked, and only then switched on -
  -- which is also the "uncheck it" Vijay asked for, so a festival offer can
  -- be turned off without deleting it and losing what it earned.
  active        INTEGER NOT NULL DEFAULT 0,

  -- Optional window. Null means no bound at that end.
  starts_on     TEXT,
  ends_on       TEXT,

  -- JSON array of plan ids it applies to, or null for every paid plan. Lets
  -- a Group-only offer exist without a second mechanism.
  plans         TEXT,

  -- Null means unlimited. Counted against redemptions, not against clicks.
  max_redemptions INTEGER,
  times_redeemed  INTEGER NOT NULL DEFAULT 0,

  -- One use per clinic, for a "new customers" offer.
  once_per_clinic INTEGER NOT NULL DEFAULT 0,

  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  created_by    TEXT,
  note          TEXT
);

CREATE INDEX idx_coupons_active ON coupons(active, code);

-- Who used what, and on which subscription.
--
-- Kept as rows rather than only a counter because "how did Diwali do" is the
-- question that decides whether to run it again, and a number that only goes
-- up cannot answer it. It is also what makes once_per_clinic enforceable.
CREATE TABLE coupon_redemptions (
  id            TEXT PRIMARY KEY,
  coupon_id     TEXT NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  doctor_id     TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  subscription_id TEXT,
  plan          TEXT,
  cadence       TEXT,
  percent_off   INTEGER,
  redeemed_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_coupon_redemption_once
  ON coupon_redemptions(coupon_id, doctor_id);
CREATE INDEX idx_coupon_redemptions_coupon ON coupon_redemptions(coupon_id);

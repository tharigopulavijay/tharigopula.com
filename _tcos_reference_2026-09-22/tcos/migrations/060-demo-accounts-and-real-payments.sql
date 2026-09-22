-- =========================================================================
-- Demo accounts, and a payment that is a payment rather than a tick.
--
-- Vijay, 19 Sep 2026:
--   "if i select demo then it should be demo, all features of that package
--    should be present without any payment related thing... if payment is
--    not received then it should move to free automatically"
--   "i should be able to check paid — it doesnot mean i check paid it is
--    paid — should be through out: i select the payment date and save, and
--    tell you monthly or yearly, accordingly the expiry date will come"
--
-- THE TICK IS THE PROBLEM HE IS NAMING.
-- `plan_source = 'manual_override'` already existed and did exactly what he
-- is warning against: an owner set a plan by hand, it had no date on it and
-- nothing ever took it away. Six months later nobody could say whether that
-- clinic had paid, when, how much, or until when. A grant with no end date
-- is not a payment record, it is a memory.
--
-- So an offline payment now writes the same two rows a Razorpay payment
-- writes - a subscription with an end date, and a payment with an amount,
-- a date, a method and a reference - and the nightly sweep expires it like
-- any other. The only difference is which provider sent the money.
--
-- ONE CLOCK FOR THREE SITUATIONS. `plan_paid_until` is the whole of it:
--   a trial       set at approval, to approval + the trial window
--   a payment     set to the payment date + one month or one year
--   a renewal     pushed forward by the provider's webhook
-- Everything downstream reads one column, so a trial running out and a
-- card failing cannot behave differently by accident.
-- =========================================================================

-- 'live' | 'demo'.
--
-- A demo account has every feature of its package and no payment machinery
-- at all: no trial clock, no grace, no downgrade, no billing screen. It
-- exists to be shown and to be walked through, and a demo that nags for a
-- card mid-demonstration is worse than no demo.
--
-- Defaulting to 'live' is deliberate. A row that forgets to say what it is
-- must be the one that gets billed, never the one that is free forever.
ALTER TABLE doctors ADD COLUMN account_type TEXT NOT NULL DEFAULT 'live';

-- When the current paid or trial period ends. NULL means no clock is
-- running: a Free clinic, a demo, or a legacy row from before this existed.
--
-- NULL IS NOT "EXPIRED". Reading an absent date as a lapsed one would drop
-- every existing clinic to Free on the first nightly sweep after this
-- migration - which is precisely the silent, total failure this column is
-- supposed to prevent.
ALTER TABLE doctors ADD COLUMN plan_paid_until TEXT;

-- Why she is on this plan, for the owner console to show without guessing:
-- trial | payment | manual_payment | comp | payment_expired
ALTER TABLE doctors ADD COLUMN plan_note TEXT;

-- ---- an offline payment is a real payment record --------------------------

-- How the money actually arrived, when a doctor paid by UPI because the card
-- failed. Razorpay payments leave these NULL; it knows its own methods.
ALTER TABLE subscription_payments ADD COLUMN method TEXT;

-- The UPI reference, the bank transaction id, the cheque number. This is the
-- field that makes the record checkable against a bank statement, which is
-- the entire difference between a payment and somebody's recollection.
ALTER TABLE subscription_payments ADD COLUMN reference TEXT;

-- Which owner-console account recorded it. An offline payment is a human
-- assertion that money arrived, so the human is part of the record.
ALTER TABLE subscription_payments ADD COLUMN recorded_by TEXT;

-- What the money bought: the period this payment covers. Razorpay carries
-- this on the subscription; an offline payment has to state it, because the
-- owner chose "monthly" or "yearly" when he entered it.
ALTER TABLE subscription_payments ADD COLUMN covers_from TEXT;
ALTER TABLE subscription_payments ADD COLUMN covers_until TEXT;

-- Finding a clinic's payment history, and the nightly sweep's scan.
CREATE INDEX IF NOT EXISTS idx_sub_payments_doctor
  ON subscription_payments(doctor_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_doctors_paid_until
  ON doctors(plan_paid_until)
  WHERE plan_paid_until IS NOT NULL;

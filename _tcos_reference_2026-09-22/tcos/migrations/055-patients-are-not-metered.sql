-- =========================================================================
-- Patients stop being metered.
--
-- Vijay, 11 September 2026: "let's keep unlimited patients, why limiting
-- patients, it does not cost us right - only what we are costed is something
-- we can charge. A person paying 2,000 having a limit of 10,000 is not good."
--
-- He is right, and the old numbers were charging for something we do not
-- pay for. A patient row in D1 is a few hundred bytes; ten thousand of them
-- is a rounding error on the bill. Metering them meant the doctor who hit
-- the wall first was the one with the busiest clinic - the best customer we
-- have, told to pay more for the crime of working hard.
--
-- WHAT STAYS METERED, AND WHY
--   ai_documents  a model reads a report. That is about ₹3 of real money
--                 every time, and it is the one line where a heavy month
--                 genuinely costs us more than a light one.
--   storage_mb    bytes held in R2, billed by the gigabyte-month.
--   messages      an SMS or WhatsApp template costs per send. Not built
--                 yet; the rows stay so the plan shape is ready.
--   doctors,      not a cost at all. Kept because seats are honest value
--   staff         and they are what actually stops a hospital running a
--                 fifty-person practice on the ₹899 plan. Patients never
--                 did that job - seats and features did.
--
-- -1 IS "NOT METERED", not a very large allowance. worker/quota.js returns
-- before it counts anything when `included` is negative. A huge number
-- would have looked equivalent and was not: it still does arithmetic, so
-- the usage panel would have read "3 of 2,000,000,000" and would have begun
-- warning her at eighty per cent of two billion patients.
--
-- The free plan is included deliberately. It is already held to one doctor,
-- one staff login, 200 MB and none of the paid features - those walls do
-- the work, and a patient count on top was a second wall that cost us
-- nothing to remove and made the free plan look mean.
-- =========================================================================

UPDATE plan_limits
   SET included = -1,
       hard_stop = 0,
       overage_paise = 0
 WHERE limit_key = 'patients';

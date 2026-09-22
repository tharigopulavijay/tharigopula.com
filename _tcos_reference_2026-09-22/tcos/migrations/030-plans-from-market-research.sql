-- =========================================================================
-- 030  Plans priced against what the market actually charges.
--
-- Migration 020 set ₹499 / ₹1,499 / ₹3,499 from a cost model and nothing
-- else. Published competitor pricing, checked 5 Sep 2026:
--
--   DocPulse            from ₹500/mo
--   Halemind Starter    ₹7,500/yr  = ₹625/mo
--   Adrine              ₹999/mo    including an AI scribe and ABDM
--   Halemind Standard   ₹19,990/yr = ₹1,666/mo
--   MocDoc              from ₹2,500/mo
--   HealthRay           ₹3,000/mo
--   Practo Ray          ₹1,000-4,000/mo PLUS ₹1,500-3,000/mo in
--                       per-appointment fees
--
-- Two things follow.
--
-- AI IS NOT A PREMIUM ADD-ON ANY MORE. Adrine bundles an AI scribe at ₹999.
-- Charging separately for AI on top of a subscription is now above the
-- market for the same idea. And the reason to meter it has gone: a report
-- costs about ₹3 to read, not the ₹77 an incorrect rate table reported for
-- days. At ₹3, metering buys nothing and costs adoption - a doctor who has
-- to think about price before uploading a report does not form the habit,
-- and the habit is the product.
--
-- So AI reading is INCLUDED, generously, in every paid plan. Top-ups exist
-- for the clinic that genuinely runs out, at ₹5 rather than ₹4: still a
-- large margin on a ₹3 cost, and cheap enough that nobody argues about it.
--
-- ₹899 IS DELIBERATE. It sits under Adrine's ₹999 and over Halemind's ₹625.
-- Undercutting by a hundred rupees is a weak reason to be chosen, but it
-- removes price as a reason to be dismissed, which lets the conversation be
-- about the shared patient record and about taking no cut of a consultation.
--
-- Margins below assume EVERY included reading is used, which will almost
-- never happen. Real margin runs well above these.
-- =========================================================================

-- FREE - still genuinely free, and still costs us ₹0, because the metered
-- things are the ones left out. Not a trial: nothing expires.
INSERT OR REPLACE INTO plan_limits (plan, limit_key, included, overage_paise, hard_stop) VALUES
 ('basic','patients',100,0,1),
 ('basic','staff',1,0,1),
 ('basic','doctors',1,0,1),
 ('basic','messages',0,0,1),
 ('basic','ai_documents',0,0,1),
 ('basic','storage_mb',200,0,1),

-- PRACTICE ₹899 - AI at full use ≈ ₹180. About 80% margin.
 ('starter','patients',2000,0,0),
 ('starter','staff',3,0,1),
 ('starter','doctors',1,0,1),
 ('starter','messages',100,150,0),
 ('starter','ai_documents',60,500,0),
 ('starter','storage_mb',5120,0,0),

-- CLINIC ₹2,199 - AI at full use ≈ ₹750. About 66% margin.
 ('pro','patients',10000,0,0),
 ('pro','staff',8,0,1),
 ('pro','doctors',3,0,1),
 ('pro','messages',500,150,0),
 ('pro','ai_documents',250,500,0),
 ('pro','storage_mb',20480,0,0),

-- GROUP ₹4,499 - AI at full use ≈ ₹2,100. About 53% margin.
 ('pro_plus','patients',50000,0,0),
 ('pro_plus','staff',50,0,1),
 ('pro_plus','doctors',25,0,1),
 ('pro_plus','messages',1500,150,0),
 ('pro_plus','ai_documents',700,500,0),
 ('pro_plus','storage_mb',51200,0,0),

-- The legacy 'clinic' key some rows still carry. Kept identical to Clinic so
-- nobody already onboarded loses anything the day this ships.
 ('clinic','patients',10000,0,0),
 ('clinic','staff',8,0,1),
 ('clinic','doctors',3,0,1),
 ('clinic','messages',500,150,0),
 ('clinic','ai_documents',250,500,0),
 ('clinic','storage_mb',20480,0,0);

INSERT OR REPLACE INTO plan_prices (plan, paise_monthly) VALUES
 ('basic', 0), ('starter', 89900), ('pro', 219900),
 ('pro_plus', 449900), ('clinic', 219900);

-- Reading a document is metered like messages, but the meter now exists to
-- catch a runaway rather than to bill an ordinary clinic - almost nobody
-- reaches their allowance, and the spend guard in ai_limits is what actually
-- protects the business.
UPDATE cost_rates
   SET note = 'One report read on gpt-5.4-mini, five pages per call: about ₹3 typical, ₹17 for a 21-page master check-up on the batch route. Measured, not estimated, and recorded per read on the draft.'
 WHERE id = 'ai_document';

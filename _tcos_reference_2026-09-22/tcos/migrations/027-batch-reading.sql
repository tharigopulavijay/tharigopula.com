-- =========================================================================
-- 027  Overnight reading: half price, same model, same answer.
--
-- The Batch API bills at exactly 50% of standard for identical work. The
-- only thing given up is immediacy - up to 24 hours instead of at once.
--
-- That is close to free here, because the instant route is not instant
-- either. The first real read took 294 seconds; nobody was going to sit and
-- watch it. A doctor uploads today and reads at the next visit, and a
-- patient scanning a QR code in the waiting room has fifteen minutes.
--
-- ai_queue already existed to park documents when the spend guard said no.
-- It becomes the same queue for work waiting on a batch, because both are
-- the same thing from the clinic's side: a document accepted, not yet read,
-- and definitely not lost.
-- =========================================================================

-- The provider's batch id, so a waiting document can be matched to the job
-- that will answer it.
ALTER TABLE ai_queue ADD COLUMN batch_id TEXT;

-- validating | in_progress | completed | failed | expired | cancelled
-- Their word, stored unchanged. Translating it into ours here would mean
-- guessing at states we have not seen yet.
ALTER TABLE ai_queue ADD COLUMN provider_status TEXT;

-- Which preflight approved this document. The extraction needs the page list
-- the preflight produced, and re-running preflight to get it back would pay
-- for the same decision twice.
ALTER TABLE ai_queue ADD COLUMN preflight_id TEXT;

-- Whether the doctor asked for it now or was happy to wait. Recorded rather
-- than inferred, because the price differs and the Money screen should be
-- able to say which reads were charged at which rate.
ALTER TABLE ai_queue ADD COLUMN urgency TEXT NOT NULL DEFAULT 'normal';

-- What it became once it arrived.
ALTER TABLE ai_queue ADD COLUMN draft_id TEXT;

CREATE INDEX IF NOT EXISTS idx_queue_batch ON ai_queue(batch_id);

-- The spend ledger records whether a call was batched, so the cost report
-- reflects what was actually billed rather than list price.
ALTER TABLE ai_spend ADD COLUMN batched INTEGER NOT NULL DEFAULT 0;

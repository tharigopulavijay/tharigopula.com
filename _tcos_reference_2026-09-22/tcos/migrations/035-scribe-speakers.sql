-- =========================================================================
-- 035  Who the scribe thought was speaking, and how sure it was.
--
-- The transcript arrives unlabelled: the model returns words, not speakers.
-- Roles are worked out from CONTENT - one person asks the questions and
-- names the medicines, the other describes what is wrong - which is a
-- stronger signal than a voice print and survives a doctor with a cold, a
-- different phone, or a noisy room.
--
-- It can still be wrong, so it says when it might be. `speakers` is the
-- one-line account shown to the doctor; `speaker_confidence` is clear,
-- mixed or unclear, and anything the model did not answer is stored as
-- unclear rather than assumed fine. A note attributed to the wrong person
-- is worse than one that admits it could not tell.
-- =========================================================================

ALTER TABLE consult_notes ADD COLUMN speakers TEXT;
ALTER TABLE consult_notes ADD COLUMN speaker_confidence TEXT NOT NULL DEFAULT 'unclear';

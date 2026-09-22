-- =========================================================================
-- 036  Provider-file lifecycle for overnight AI readings.
--
-- `store: false` prevents a Responses object from being retained as
-- application state. It does not delete Files API objects used by Batch.
-- Keep the provider ids until the result is safely written to our draft
-- table, then delete every input/output/error file. Failed deletions remain
-- visible and are retried the next time the clinic opens the reading queue.
-- =========================================================================

ALTER TABLE ai_queue ADD COLUMN provider_input_file_id TEXT;
ALTER TABLE ai_queue ADD COLUMN provider_output_file_id TEXT;
ALTER TABLE ai_queue ADD COLUMN provider_error_file_id TEXT;

-- not_needed | pending | failed | complete
ALTER TABLE ai_queue ADD COLUMN provider_cleanup_status TEXT NOT NULL DEFAULT 'not_needed';
ALTER TABLE ai_queue ADD COLUMN provider_cleanup_error TEXT;
ALTER TABLE ai_queue ADD COLUMN provider_cleanup_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_queue ADD COLUMN provider_cleanup_last_attempt_at TEXT;
ALTER TABLE ai_queue ADD COLUMN provider_files_deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_queue_provider_cleanup
  ON ai_queue(doctor_id, provider_cleanup_status, provider_status);

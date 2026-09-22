-- =========================================================================
-- 039  Preserve who produced a diagnostic report.
--
-- The AI draft already retains the laboratory name, but the confirmed
-- clinical record did not. Once a draft became a lab_report, that provenance
-- disappeared from the patient's history. A result without its issuing lab
-- is harder to verify and harder to investigate later.
-- =========================================================================

ALTER TABLE lab_reports ADD COLUMN lab_name TEXT;
ALTER TABLE lab_reports ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_report_idempotency
  ON lab_reports(doctor_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

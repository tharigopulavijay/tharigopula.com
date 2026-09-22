-- Historical compatibility copy for the original TCOS production rehearsal.
--
-- That database received doctors.custom_domain before numbered migration 016
-- existed. Fresh databases must still use the top-level 016 migration. The
-- production rehearsal and production upgrade use this file instead so the
-- existing column is preserved and only the missing status fields/indexes are
-- added. The top-level migration now has the same safe behaviour because
-- migration 006 is the single owner of doctors.custom_domain.

ALTER TABLE doctors ADD COLUMN custom_domain_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE doctors ADD COLUMN custom_domain_checked_at TEXT;
ALTER TABLE doctors ADD COLUMN custom_domain_active_at TEXT;
ALTER TABLE doctors ADD COLUMN custom_domain_error TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_doctors_custom_domain
  ON doctors(custom_domain) WHERE custom_domain IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_doctors_domain_status
  ON doctors(custom_domain_status);

-- ONE-TIME PRODUCTION LEDGER REPAIR — 2026-09-09
--
-- Production's schema was created before Wrangler's migration ledger was
-- adopted. The full D1 export was checksum-verified and then audited offline:
-- all 100 objects and 73 columns introduced by migrations 001-035 exist;
-- migration 036 does not. Migrations 036-048 were successfully rehearsed on
-- the exact production export with integrity_check=ok and zero FK violations.
--
-- This statement is deliberately non-idempotent. A second execution fails on
-- the primary key instead of silently rewriting migration history.

INSERT INTO d1_migrations (id, name) VALUES
  (1,  '001-platform-admin.sql'),
  (2,  '002-prescriptions-and-pharmacy.sql'),
  (3,  '003-patient-access.sql'),
  (4,  '004-household-identity.sql'),
  (5,  '005-appointments.sql'),
  (6,  '006-public-page.sql'),
  (7,  '007-drug-catalogue.sql'),
  (8,  '008-patient-numbers.sql'),
  (9,  '009-clinic-users.sql'),
  (10, '010-billing.sql'),
  (11, '011-operations-and-support.sql'),
  (12, '012-products.sql'),
  (13, '013-doctor-applications.sql'),
  (14, '014-verification-tiers.sql'),
  (15, '015-schedule-and-closures.sql'),
  (16, '016-custom-domains.sql'),
  (17, '017-product-name-fix.sql'),
  (18, '018-practitioners.sql'),
  (19, '019-cost-tracking.sql'),
  (20, '020-plan-limits.sql'),
  (21, '021-grace-period.sql'),
  (22, '022-files.sql'),
  (23, '023-ai-drafts.sql'),
  (24, '024-ai-preflight.sql'),
  (25, '025-repair-mobile-format.sql'),
  (26, '026-ai-spend-guard.sql'),
  (27, '027-batch-reading.sql'),
  (28, '028-abdm-identity.sql'),
  (29, '029-verification-deadline.sql'),
  (30, '030-plans-from-market-research.sql'),
  (31, '031-whatsapp.sql'),
  (32, '032-repair-patient-sequences.sql'),
  (33, '033-drug-catalogue-core.sql'),
  (34, '034-consultation-notes.sql'),
  (35, '035-scribe-speakers.sql');

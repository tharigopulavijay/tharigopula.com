-- =========================================================================
-- Demo accounts: one doctor per product and the clinic
-- staff. Idempotent, and safe to re-run.
--
-- Why this file exists: an earlier seed set staff CAPABILITIES with three
-- UPDATE statements against rows that were never INSERTed. The updates
-- matched nothing and reported success, so the Team screen, the capability
-- checkboxes and the whole admin console had no accounts behind them and
-- four of the five advertised demo logins simply failed.
--
-- Passwords are PBKDF2-SHA256, 100k iterations, salted per row and peppered
-- with the LOCAL demo pepper from .dev.vars:
--
--     PEPPER="tcos-local-demo-only-2026"
--
-- These hashes are therefore worthless against production, which uses a
-- pepper set by `wrangler secret put` and known only to Vijay. Never run
-- this file against a real database.
--
--   Doctor AyurCOS   9000000001        DoctorDemo2026
--   Doctor HomeoCOS   9000000011        DoctorDemo2026
--   Doctor AlloCOS    9000000021        DoctorDemo2026
--   Front desk       9000000002        FrontDesk2026
--   Pharmacist       9000000003        Pharmacy2026
--   Clinical asst.   9000000004        Assistant2026
-- =========================================================================

-- ------------------------------------------------------------- doctors --
-- One per product, so all three workspaces can be demonstrated from one
-- local server. doc_demo already exists from the bootstrap seed; this makes
-- its password match the other two rather than leaving two documented
-- answers for the same account.
-- Verified, because the demo has to show the finished product: an
-- unverified doctor cannot publish a public page or open cross-clinic
-- history (migration 014), so leaving the demo doctors unverified makes
-- two working features look broken to anyone evaluating TCOS.
UPDATE doctors SET
  product = 'ayurcos',
  password_hash = '01eb7e3238068a63deb9e3378eed8fc52cb4852b7cba7e4afa516bb77b286086',
  password_salt = 'a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1',
  must_change_password = 0,
  verification_status = 'verified',
  verified_at = datetime('now','-80 days'),
  verified_by = 'demo-seed@tcos.local',
  verification_note = 'Demo tenant. Registration checked at onboarding.'
WHERE id = 'doc_demo';

INSERT OR REPLACE INTO doctors
  (id, mobile, mobile_verified, email, full_name, qualification, registration_no,
   clinic_name, tagline, address, patient_prefix, practice_packs, line, plan,
   product, status, password_hash, password_salt, must_change_password, created_at)
VALUES
 ('doc_homeo','+919000000011',1,'doctor@homeocos.demo','Dr. Kavitha Menon',
  'BHMS, MD (Hom)','CCH-DEMO-3141','HomeoCOS Demonstration Clinic',
  'Classical homeopathy, one case at a time','Kochi, Kerala','HOMO',
  '["homeopathy","repertory","constitution","referral"]','doctor','clinic',
  'homeocos','active',
  '9e50b95306f3a27757d5ae9aa7c22836cf9929b55cd5fe5166e4dd911730da8d',
  'b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2',0,datetime('now','-70 days')),

 ('doc_allo','+919000000021',1,'doctor@allocos.demo','Dr. Imran Sheikh',
  'MBBS, MD (General Medicine)','NMC-DEMO-7788','AlloCOS Demonstration Clinic',
  'Family medicine with follow-up that actually happens','Pune, Maharashtra','ALO',
  '["systemic","history","procedure","referral"]','doctor','clinic',
  'allocos','active',
  '7ebe97465905bbc870b0c1c27063c7cd6620125b10c5fbdcfd131238187ffc00',
  'c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3',0,datetime('now','-45 days'));

UPDATE doctors SET verification_status = 'verified',
       verified_at = created_at, verified_by = 'demo-seed@tcos.local',
       verification_note = 'Demo tenant. Registration checked at onboarding.'
 WHERE id IN ('doc_homeo','doc_allo');

-- ---------------------------------------------------------- clinic staff --
-- Three people on the AyurCOS demo clinic. `capabilities` is the doctor's
-- own tick-list and overrides the role preset; `role` stays as the starting
-- point it was chosen from.
--
-- Latha is the case worth demonstrating: front desk AND pharmacy on one
-- person, which is how a clinic with three staff actually runs. Her menu is
-- built from the union of her capabilities, so Patients appears once.
INSERT OR REPLACE INTO clinic_users
  (id, doctor_id, full_name, mobile, role, capabilities,
   password_hash, password_salt, must_change_password, status, created_at, last_sign_in_at)
VALUES
 ('usr_demo_front','doc_demo','Latha Reddy','+919000000002','front_desk',
  '["appointments","patients","billing","pharmacy"]',
  'fc804d7ea61ca5f14d03c404dfabae00b7055a82e87b442650a5353fc9fdcd5f',
  'd4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4',0,'active',
  datetime('now','-80 days'), datetime('now','-1 day')),

 -- "patients" included deliberately: a pharmacist handing medicine over has
 -- to be able to confirm who is standing there. Without it the pharmacy
 -- screen can bill a patient it cannot look up.
 ('usr_demo_pharmacy','doc_demo','Suresh Babu','+919000000003','pharmacist',
  '["pharmacy","patients","billing"]',
  '0396708034cf430edac16a2c81aaa0bad79b9010c79bced9829c8385f63d2829',
  'e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5',0,'active',
  datetime('now','-60 days'), datetime('now','-2 days')),

 ('usr_demo_assistant','doc_demo','Priya Nair','+919000000004','assistant',
  '["appointments","patients","vitals"]',
  'ccaa2a1debd966ac957645af0abb6e0f73e2bfd020bc534ae31c7d151c49f968',
  'f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6f6',0,'active',
  datetime('now','-30 days'), datetime('now','-4 hours'));

-- A SECOND DOCTOR in the same practice - migration 018. She shares the
-- patient list, the diary and the records, and is refused the pharmacy, the
-- practice settings and the team, because the clinic still belongs to the
-- doctor who owns it.
--
-- Her capabilities column is deliberately left NULL: a practitioner's access
-- comes from the role, never from a stored tick-list, and putting one here
-- would suggest otherwise to the next person reading this file.
--
-- Verified, so her registration number prints on the prescriptions she
-- issues. An unverified one works but does not print.
--
--   Doctor (partner)  9000000005  Partner2026
INSERT OR REPLACE INTO clinic_users
  (id, doctor_id, full_name, mobile, role, capabilities,
   qualification, registration_no, council,
   verification_status, verified_at, verified_by,
   password_hash, password_salt, must_change_password, status, created_at, last_sign_in_at)
VALUES
 ('usr_demo_partner','doc_demo','Dr. Ramya Iyer','+919000000005','practitioner',
  NULL,'BAMS, MD (Ayurveda)','AYUSH-DEMO-5521','AYUSH / State Ayurveda Council',
  'verified', datetime('now','-18 days'), 'demo-seed@tcos.local',
  '9a162847010e7c3f1f004748dea5573885337802b234999558aa0698b3c33faa',
  '9a9a9a9a9a9a9a9a9a9a9a9a9a9a9a9a',0,'active',
  datetime('now','-20 days'), datetime('now','-3 hours'));

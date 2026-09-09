PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE doctors (
  id                TEXT PRIMARY KEY,
  mobile            TEXT NOT NULL UNIQUE,       -- verified at signup, used for OTP
  mobile_verified   INTEGER NOT NULL DEFAULT 0,
  email             TEXT,
  full_name         TEXT NOT NULL,
  qualification     TEXT,
  registration_no   TEXT,
  clinic_name       TEXT NOT NULL,
  tagline           TEXT,
  address           TEXT,
  website           TEXT,
  logo_key          TEXT,                        -- R2 object key, not the image
  theme_ink         TEXT DEFAULT '#1B4A34',
  theme_accent      TEXT DEFAULT '#C9973E',
  patient_prefix    TEXT DEFAULT 'TCOS',
  practice_packs    TEXT NOT NULL DEFAULT '[]',  -- JSON array of pack ids
  line              TEXT NOT NULL DEFAULT 'doctor',
  plan              TEXT NOT NULL DEFAULT 'basic',
  feature_overrides TEXT NOT NULL DEFAULT '{}',  -- JSON, admin per-doctor switches
  trial_offer       TEXT,
  trial_ends_on     TEXT,
  status            TEXT NOT NULL DEFAULT 'active', -- active | suspended
  password_hash     TEXT,                        -- PBKDF2, salted, per row
  password_salt     TEXT,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  last_sign_in_at   TEXT
, public_slug TEXT, public_page_on INTEGER NOT NULL DEFAULT 0, public_intro TEXT, public_hours TEXT, custom_domain TEXT, weekly_hours TEXT NOT NULL DEFAULT '{}', certificate_name TEXT, certificate_status TEXT NOT NULL DEFAULT 'not_uploaded', certificate_submitted_at TEXT, product TEXT NOT NULL DEFAULT 'ayurcos', verification_status TEXT NOT NULL DEFAULT 'unverified', verified_at TEXT, verified_by TEXT, verification_note TEXT, custom_domain_status TEXT NOT NULL DEFAULT 'none', custom_domain_checked_at TEXT, custom_domain_active_at TEXT, custom_domain_error TEXT, facility_type TEXT NOT NULL DEFAULT 'clinic', certificate_file_id TEXT REFERENCES files(id), logo_file_id TEXT REFERENCES files(id), hpr_id TEXT, hpr_verified_at TEXT, hfr_id TEXT, hfr_verified_at TEXT, verify_by TEXT, verify_reminded_at TEXT, suspended_reason TEXT, suspended_at TEXT, suspended_by TEXT, council TEXT);
INSERT INTO "doctors" ("id","mobile","mobile_verified","email","full_name","qualification","registration_no","clinic_name","tagline","address","website","logo_key","theme_ink","theme_accent","patient_prefix","practice_packs","line","plan","feature_overrides","trial_offer","trial_ends_on","status","password_hash","password_salt","must_change_password","created_at","last_sign_in_at","public_slug","public_page_on","public_intro","public_hours","custom_domain","weekly_hours","certificate_name","certificate_status","certificate_submitted_at","product","verification_status","verified_at","verified_by","verification_note","custom_domain_status","custom_domain_checked_at","custom_domain_active_at","custom_domain_error","facility_type","certificate_file_id","logo_file_id","hpr_id","hpr_verified_at","hfr_id","hfr_verified_at","verify_by","verify_reminded_at","suspended_reason","suspended_at","suspended_by","council") VALUES('doc_demo','+919000000001',1,'doctor@ayurcos.demo','Dr. Sri Devi','BAMS, MD (Ayurveda)','AYUSH-DEMO-2048','AyurCOS Demonstration Clinic','Classical Ayurveda with connected follow-up care','Road No. 12, Banjara Hills, Hyderabad',NULL,NULL,'#1B4A34','#C9973E','DEMO','["ayurveda","nadi","yoga","referral"]','doctor','clinic','{}',NULL,NULL,'active','40ffc8c1b6ef2aa4bc6b5b604edf1309d1dc2cadb7641f3edba54d6a7ca1a6e3','9cc5b16465c30c27b28f6aab67c63a0a',0,'2026-09-03 19:20:26','2026-09-08T19:07:33.656Z','ayurcos-demo-clinic',1,'Classical Ayurveda with connected follow-up care. Prakriti and Nadi assessment, in-house pharmacy, and a record you can read at home.','Mon-Tue & Thu-Fri 9am-6pm, Wed 9am-2pm, Sat 10am-1pm',NULL,'{"mon":{"closed":false,"open":"09:00","close":"18:00"},"tue":{"closed":false,"open":"09:00","close":"18:00"},"wed":{"closed":false,"open":"09:00","close":"14:00"},"thu":{"closed":false,"open":"09:00","close":"18:00"},"fri":{"closed":false,"open":"09:00","close":"18:00"},"sat":{"closed":false,"open":"10:00","close":"13:00"},"sun":{"closed":true,"open":"09:00","close":"18:00"}}','medical-registration-demo.pdf','verified','2026-08-14 19:20:36','ayurcos','verified','2026-06-15 19:20:31','admin@tcos.demo','Demo tenant. Registration checked at onboarding.','none',NULL,NULL,NULL,'clinic',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
INSERT INTO "doctors" ("id","mobile","mobile_verified","email","full_name","qualification","registration_no","clinic_name","tagline","address","website","logo_key","theme_ink","theme_accent","patient_prefix","practice_packs","line","plan","feature_overrides","trial_offer","trial_ends_on","status","password_hash","password_salt","must_change_password","created_at","last_sign_in_at","public_slug","public_page_on","public_intro","public_hours","custom_domain","weekly_hours","certificate_name","certificate_status","certificate_submitted_at","product","verification_status","verified_at","verified_by","verification_note","custom_domain_status","custom_domain_checked_at","custom_domain_active_at","custom_domain_error","facility_type","certificate_file_id","logo_file_id","hpr_id","hpr_verified_at","hfr_id","hfr_verified_at","verify_by","verify_reminded_at","suspended_reason","suspended_at","suspended_by","council") VALUES('doc_homeo','+919000000011',1,'doctor@homeocos.demo','Dr. Kavitha Menon','BHMS, MD (Hom)','CCH-DEMO-3141','HomeoCOS Demonstration Clinic','Classical homeopathy, one case at a time','Kochi, Kerala',NULL,NULL,'#1B4A34','#C9973E','HOMO','["homeopathy","repertory","constitution","referral"]','doctor','clinic','{}',NULL,NULL,'active','4e4f90215cec75a2494cd758c3fbc616f2d13ebcbc3e4deaa5d4b8fcc397e94d','6543c9fc87994d9d89312dba7cd42cfa',0,'2026-06-25 19:20:31','2026-09-08T14:39:09.372Z',NULL,0,NULL,NULL,NULL,'{}',NULL,'not_uploaded',NULL,'homeocos','verified','2026-06-25 19:20:31','admin@tcos.demo','Demo tenant. Registration checked at onboarding.','none',NULL,NULL,NULL,'clinic',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
INSERT INTO "doctors" ("id","mobile","mobile_verified","email","full_name","qualification","registration_no","clinic_name","tagline","address","website","logo_key","theme_ink","theme_accent","patient_prefix","practice_packs","line","plan","feature_overrides","trial_offer","trial_ends_on","status","password_hash","password_salt","must_change_password","created_at","last_sign_in_at","public_slug","public_page_on","public_intro","public_hours","custom_domain","weekly_hours","certificate_name","certificate_status","certificate_submitted_at","product","verification_status","verified_at","verified_by","verification_note","custom_domain_status","custom_domain_checked_at","custom_domain_active_at","custom_domain_error","facility_type","certificate_file_id","logo_file_id","hpr_id","hpr_verified_at","hfr_id","hfr_verified_at","verify_by","verify_reminded_at","suspended_reason","suspended_at","suspended_by","council") VALUES('doc_allo','+919000000021',1,'doctor@allocos.demo','Dr. Imran Sheikh','MBBS, MD (General Medicine)','NMC-DEMO-7788','AlloCOS Demonstration Clinic','Family medicine with follow-up that actually happens','Pune, Maharashtra',NULL,NULL,'#1B4A34','#C9973E','ALO','["systemic","history","procedure","referral"]','doctor','clinic','{}',NULL,NULL,'active','1cab1a17d4e856f2f224fc41bb605050b743c5e98eb47fe5cdc5d9dbf1c02f59','101a8c70f007abd239d0120214a84a8b',0,'2026-07-20 19:20:31','2026-09-08T14:39:11.144Z',NULL,0,NULL,NULL,NULL,'{}',NULL,'not_uploaded',NULL,'allocos','verified','2026-07-20 19:20:31','admin@tcos.demo','Demo tenant. Registration checked at onboarding.','none',NULL,NULL,NULL,'clinic',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
CREATE TABLE sessions (
  token_hash  TEXT PRIMARY KEY,
  doctor_id   TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL,
  user_agent  TEXT,
  revoked_at  TEXT
, user_id TEXT);
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('87adadb5b1d8b39221c1893340bed53e1c106ca016453e0126dba6fffe47713b','doc_demo','2026-09-03 19:22:12','2026-09-04T07:22:12.067Z','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-IN) PowerShell/7.6.4','2026-09-03T19:22:14.089Z',NULL);
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('191acbae49e736f082eb4b5a84bba4d7118f427d02cb87d1adfd3666defa401b','doc_homeo','2026-09-03 19:22:14','2026-09-04T07:22:14.449Z','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-IN) PowerShell/7.6.4','2026-09-03T19:22:15.957Z',NULL);
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('436a5be372bcaec70e43fb737d9f883dde62a360b8cabdfea859f532e78420ec','doc_allo','2026-09-03 19:22:16','2026-09-04T07:22:16.311Z','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-IN) PowerShell/7.6.4','2026-09-03T19:22:17.880Z',NULL);
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('d854a3738c3929c6ddb83cbd0d5dc22a74fa802c096770373783f5b39b5574fa','doc_demo','2026-09-03 19:22:18','2026-09-04T07:22:18.428Z','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-IN) PowerShell/7.6.4','2026-09-03T19:22:20.027Z','usr_demo_front');
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('a898c118083c8506c82ffd5301b0edf44b5dfd03c51a455f57a5c470c9ddeb56','doc_demo','2026-09-03 19:22:20','2026-09-04T07:22:20.576Z','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-IN) PowerShell/7.6.4','2026-09-03T19:22:22.212Z','usr_demo_pharmacy');
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('106126947b5e500573e89fdb750b4d43d8c334105f3243c06bb20cc2acc39f69','doc_demo','2026-09-03 19:22:23','2026-09-04T07:22:23.284Z','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-IN) PowerShell/7.6.4','2026-09-03T19:22:25.400Z','usr_demo_assistant');
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('a64a8ba437c1db4d4c2516d2a64ad13865495642a15310319b91683a49c478e7','doc_demo','2026-09-07 06:19:45','2026-09-07T18:19:45.268Z','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',NULL,NULL);
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('4c067a30bf1c72374884221fdd0647ab9b6ee6a4d3931d75747e84d96184a3c9','doc_demo','2026-09-07 06:21:34','2026-09-07T18:21:34.712Z','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',NULL,NULL);
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('1915fadd0727ecf3deee30abd7572c2af0c2575686b7d45f61c98e81f8563be0','doc_demo','2026-09-07 06:21:41','2026-09-07T18:21:41.318Z','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',NULL,'usr_demo_front');
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('655aea13ad50d08f324b5ddd29252f8447e112affe7856b0cfc30e29524bea93','doc_demo','2026-09-07 06:21:46','2026-09-07T18:21:46.829Z','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',NULL,'usr_demo_pharmacy');
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('036d90861310caa66d7a9e730a93f931048328c08a1d576be1c4c2cde5aa5e30','doc_demo','2026-09-07 06:21:52','2026-09-07T18:21:52.345Z','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',NULL,'usr_demo_assistant');
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('53bbe3384be059dfd3f09bb5172ed3ef264a67703fe9c09f5afa77b636443bf7','doc_demo','2026-09-07 06:22:06','2026-09-07T18:22:06.357Z','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',NULL,'usr_demo_front');
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('8a33b31114f26ca19fb5a07523c85c3676ccf360a74bb20caea108723b500d30','doc_demo','2026-09-07 06:22:09','2026-09-07T18:22:09.707Z','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',NULL,'usr_demo_pharmacy');
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('fd1033b35c0c16e7af1024c2dea1bb3ad230e2b2cb8a413935bbd225506923ac','doc_demo','2026-09-07 06:22:13','2026-09-07T18:22:13.121Z','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',NULL,'usr_demo_assistant');
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('c209312d270447a2a1e6e79253716e13083d0d7d91e8ea742f5e2d34c048ae3d','doc_demo','2026-09-07 06:24:17','2026-09-07T18:24:17.531Z','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',NULL,NULL);
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('f6620633729c1796d409be6e72a843b99f736a20199f65fe60abbd5b502f1111','doc_demo','2026-09-08 04:39:01','2026-09-08T16:39:01.830Z','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-IN) PowerShell/7.6.5',NULL,NULL);
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('ad9a539601878e64a81217c6778b94356e740c8d5fe2bcf7723be4c8d3995dca','doc_homeo','2026-09-08 04:39:02','2026-09-08T16:39:02.627Z','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-IN) PowerShell/7.6.5',NULL,NULL);
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('98e47a0c34cdbb540a895a9fb68087753a20556c62d09d21f9bbffdf7cb050cf','doc_allo','2026-09-08 04:39:03','2026-09-08T16:39:03.541Z','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-IN) PowerShell/7.6.5',NULL,NULL);
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('e15bd1f0eebb1739cd6362f66d98a689be22986978af1d65fbb09ea96cc12744','doc_demo','2026-09-08 04:40:01','2026-09-08T16:40:01.354Z','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-IN) PowerShell/7.6.5',NULL,NULL);
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('4d6173973545ecc6e0303087bcf500515d9f5ac8c33a4d4c5b895ea463bc4726','doc_demo','2026-09-08 04:40:58','2026-09-08T16:40:58.844Z','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',NULL,NULL);
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('96bb705adf190a3aadf3e55aeba6822f0e1cf0868d77fa610db65f45ff87fa23','doc_demo','2026-09-08 04:45:47','2026-09-08T16:45:47.479Z','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-IN) PowerShell/7.6.5',NULL,NULL);
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('407cbecd594456071a2e22eda098b9496117a01c121c2eddd75b3ed356bfb87d','doc_demo','2026-09-08 04:45:48','2026-09-08T16:45:48.492Z','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-IN) PowerShell/7.6.5',NULL,NULL);
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('8f70a6a594ef1290a15b10e03de25dfeebc8517169f7c585849a50b984f4ee1f','doc_demo','2026-09-08 04:45:50','2026-09-08T16:45:50.189Z','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-IN) PowerShell/7.6.5',NULL,'usr_demo_front');
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('87e1ebcaaa7da561948284c24baaaac9e44800ac986e82a139082857bcef4830','doc_demo','2026-09-08 04:45:51','2026-09-08T16:45:51.777Z','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-IN) PowerShell/7.6.5',NULL,'usr_demo_front');
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('72d903855611299580a97a1168069f65e833c38d9e9e38acdfc75a29f73cb6ec','doc_demo','2026-09-08 04:48:35','2026-09-08T16:48:35.230Z','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-IN) PowerShell/7.6.5',NULL,NULL);
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('87654f002080a3fd4e1c2c98639eef200d3759d225844757bdb02b8853739cd6','doc_demo','2026-09-08 04:50:26','2026-09-08T16:50:26.433Z','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-IN) PowerShell/7.6.5',NULL,NULL);
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('c7f70383b20b5fedf91cd40ed2ad8bd3db0380899adb8c21e017f890c3233791','doc_demo','2026-09-08 04:51:13','2026-09-08T16:51:13.197Z','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-IN) PowerShell/7.6.5',NULL,NULL);
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('8cb6c820e0f6da0dab850413bb15278a1bb37458211b5c2ed538526e91457109','doc_demo','2026-09-08 12:43:40','2026-09-09T00:43:39.952Z','node',NULL,NULL);
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('1f366b5f512fc25db59803b521137dbcbf860103ccc8785961e52ddcf6933915','doc_demo','2026-09-08 12:44:28','2026-09-09T00:44:27.939Z','node',NULL,NULL);
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('04fa617bac4c243e7fe7b2b100456757846b19ba5b5fac91201a05a5d1b526fe','doc_demo','2026-09-08 12:48:55','2026-09-09T00:48:55.425Z','node',NULL,NULL);
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('e465a2126cd8d88f69b1c6742ab83ca28dc0f3956d58ed63e72efb8558944494','doc_demo','2026-09-08 14:23:34','2026-09-09T02:23:34.218Z','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-IN) PowerShell/7.6.5','2026-09-08T14:23:49.565Z',NULL);
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('4a1822fdfadbeebc8a5accfe46e934032c8e7c1a42c14df9616be60a0b9a8684','doc_homeo','2026-09-08 14:23:50','2026-09-09T02:23:50.641Z','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-IN) PowerShell/7.6.5','2026-09-08T14:24:03.728Z',NULL);
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('bff848d4099d1dafc1c22b6dba060eb6c6f25ffb39e93c82718a000a31e67782','doc_allo','2026-09-08 14:24:04','2026-09-09T02:24:04.744Z','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-IN) PowerShell/7.6.5','2026-09-08T14:24:20.424Z',NULL);
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('a45137ff52bdcba968b68075a547c6a70111f9b844d3335951263eb669bf8efb','doc_demo','2026-09-08 14:24:21','2026-09-09T02:24:21.054Z','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-IN) PowerShell/7.6.5','2026-09-08T14:24:29.107Z','usr_demo_front');
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('25ce4f7751145635458102606a4aa26c9b0cb1a32c982671561f51d8064b5eba','doc_demo','2026-09-08 14:24:30','2026-09-09T02:24:29.922Z','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-IN) PowerShell/7.6.5','2026-09-08T14:24:35.933Z','usr_demo_pharmacy');
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('f141f7a4bd43a16e446135f5f729961ed28b02f8d5ea47412dc718c7a212a3dd','doc_demo','2026-09-08 14:24:36','2026-09-09T02:24:36.822Z','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-IN) PowerShell/7.6.5','2026-09-08T14:24:43.656Z','usr_demo_assistant');
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('8665eda1c77bd1b5e2a7f3d44723b227b052e858f5b55bfccf8bd59b3b47c4b2','doc_demo','2026-09-08 14:25:21','2026-09-09T02:25:21.584Z','node','2026-09-08T14:25:25.478Z',NULL);
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('1cd8d6776277fdbe98f7546402059c5b5d2feeda5849a78b1912a33acce2c30e','doc_homeo','2026-09-08 14:25:21','2026-09-09T02:25:21.634Z','node','2026-09-08T14:25:26.489Z',NULL);
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('a862e69f1c5116815eb55f8d2651f280eb7d68d2acf7e2b0dedfec1ccde58c94','doc_allo','2026-09-08 14:25:21','2026-09-09T02:25:21.734Z','node','2026-09-08T14:25:27.015Z',NULL);
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('68a67d589c2eee2c1bf0a7bedcee01b37325d0b52913eb3cf4337eedd6c83148','doc_demo','2026-09-08 14:25:22','2026-09-09T02:25:21.920Z','node','2026-09-08T14:25:24.860Z','usr_demo_pharmacy');
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('22d92679c376ca582ef9ec20d25efd4c690df58add47db868e9eea20b38ea278','doc_demo','2026-09-08 14:25:22','2026-09-09T02:25:21.907Z','node','2026-09-08T14:25:24.718Z','usr_demo_assistant');
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('8483dad464b8da8bd5ff8fec9550f6efd85ed3cea1dae5ad894f46fdc808f063','doc_demo','2026-09-08 14:25:22','2026-09-09T02:25:22.420Z','node','2026-09-08T14:25:26.353Z','usr_demo_front');
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('e836ce01d3fb97a727713e4c39a903b7b0b477137167e16de4c4c7e3a1356763','doc_demo','2026-09-08 14:39:07','2026-09-09T02:39:07.425Z','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-IN) PowerShell/7.6.5','2026-09-08T14:39:08.662Z',NULL);
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('0c3f2a827f2d7e82ab298bb1a7aab8f575deeb4bb723403e4a18f0a80dafd688','doc_homeo','2026-09-08 14:39:09','2026-09-09T02:39:09.179Z','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-IN) PowerShell/7.6.5','2026-09-08T14:39:10.485Z',NULL);
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('0ced9d966122a93fe26368c2489cfc8a54625f6e2978aeb80ead5048f11ea552','doc_allo','2026-09-08 14:39:10','2026-09-09T02:39:10.837Z','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-IN) PowerShell/7.6.5','2026-09-08T14:39:11.925Z',NULL);
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('2a3f79b68edfdbb4724c5cf4ff0c83955275df09d1d4fd8a21cb7a06aff26a88','doc_demo','2026-09-08 14:39:13','2026-09-09T02:39:13.077Z','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-IN) PowerShell/7.6.5','2026-09-08T14:39:14.789Z','usr_demo_front');
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('5ff4c867e700dece71f93d435aa73517671bd668230f8e6349a71a571d5838cd','doc_demo','2026-09-08 16:55:49','2026-09-09T04:55:49.269Z','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36','2026-09-08T16:57:48.652Z',NULL);
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('be126c847c7461d88a9f57ca276641f409cf05f6fcceac8ad2693378ec02b663','doc_demo','2026-09-08 16:57:53','2026-09-09T04:57:53.512Z','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',NULL,'usr_demo_partner');
INSERT INTO "sessions" ("token_hash","doctor_id","created_at","expires_at","user_agent","revoked_at","user_id") VALUES('9c3b2e01cb33f353b4395dda3bc2459ab13d3d4b7a4f6b4cd85f54b68080d6b4','doc_demo','2026-09-08 19:07:33','2026-09-09T07:07:33.266Z','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-IN) PowerShell/7.6.5',NULL,NULL);
CREATE TABLE otp_codes (
  id          TEXT PRIMARY KEY,
  purpose     TEXT NOT NULL,          -- doctor_signup | doctor_reset | patient_consent
  mobile      TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  context     TEXT,                   -- JSON: eg which doctor is requesting consent
  attempts    INTEGER NOT NULL DEFAULT 0,
  consumed_at TEXT,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE doctor_patients (
  doctor_id     TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id    TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  local_ref     TEXT,                  -- the doctor's own patient number
  first_seen_on TEXT NOT NULL DEFAULT (date('now')),
  last_seen_on  TEXT,
  private_notes TEXT,                  -- never shared, even under consent
  archived_at   TEXT,
  PRIMARY KEY (doctor_id, patient_id)
);
INSERT INTO "doctor_patients" ("doctor_id","patient_id","local_ref","first_seen_on","last_seen_on","private_notes","archived_at") VALUES('doc_demo','pat_demo_vijay','DEMO-1001','2026-05-06','2026-09-01','Prefers evening follow-ups.',NULL);
INSERT INTO "doctor_patients" ("doctor_id","patient_id","local_ref","first_seen_on","last_seen_on","private_notes","archived_at") VALUES('doc_demo','pat_demo_ananya','DEMO-1002','2026-05-26','2026-08-27','Bring home BP log.',NULL);
INSERT INTO "doctor_patients" ("doctor_id","patient_id","local_ref","first_seen_on","last_seen_on","private_notes","archived_at") VALUES('doc_demo','pat_demo_rohan','DEMO-1003','2026-06-20','2026-09-02',NULL,NULL);
INSERT INTO "doctor_patients" ("doctor_id","patient_id","local_ref","first_seen_on","last_seen_on","private_notes","archived_at") VALUES('doc_demo','pat_demo_meera','DEMO-1004','2026-07-05','2026-08-24','Daughter helps with medicines.',NULL);
INSERT INTO "doctor_patients" ("doctor_id","patient_id","local_ref","first_seen_on","last_seen_on","private_notes","archived_at") VALUES('doc_demo','pat_demo_aarav','DEMO-1005','2026-08-09','2026-08-31',NULL,NULL);
INSERT INTO "doctor_patients" ("doctor_id","patient_id","local_ref","first_seen_on","last_seen_on","private_notes","archived_at") VALUES('doc_demo','pat_demo_lakshmi','DEMO-1006','2026-01-06','2026-08-30','Daughter organises the weekly pill box. Previous coronary stent; carry GTN.',NULL);
INSERT INTO "doctor_patients" ("doctor_id","patient_id","local_ref","first_seen_on","last_seen_on","private_notes","archived_at") VALUES('doc_demo','pat_demo_arjun','DEMO-1007','2026-03-17','2026-08-22','Prefers morning appointments.',NULL);
INSERT INTO "doctor_patients" ("doctor_id","patient_id","local_ref","first_seen_on","last_seen_on","private_notes","archived_at") VALUES('doc_demo','pat_demo_fatima','DEMO-1008','2026-04-06','2026-08-16',NULL,NULL);
INSERT INTO "doctor_patients" ("doctor_id","patient_id","local_ref","first_seen_on","last_seen_on","private_notes","archived_at") VALUES('doc_demo','pat_demo_kiran','DEMO-1009','2026-04-26','2026-08-26',NULL,NULL);
INSERT INTO "doctor_patients" ("doctor_id","patient_id","local_ref","first_seen_on","last_seen_on","private_notes","archived_at") VALUES('doc_demo','pat_demo_savita','DEMO-1010','2026-05-16','2026-08-19','Call with thyroid results.',NULL);
INSERT INTO "doctor_patients" ("doctor_id","patient_id","local_ref","first_seen_on","last_seen_on","private_notes","archived_at") VALUES('doc_demo','pat_demo_mahesh','DEMO-1011','2026-06-05','2026-08-28',NULL,NULL);
INSERT INTO "doctor_patients" ("doctor_id","patient_id","local_ref","first_seen_on","last_seen_on","private_notes","archived_at") VALUES('doc_demo','pat_demo_nisha','DEMO-1012','2026-06-25','2026-08-25',NULL,NULL);
INSERT INTO "doctor_patients" ("doctor_id","patient_id","local_ref","first_seen_on","last_seen_on","private_notes","archived_at") VALUES('doc_demo','pat_demo_rahul','DEMO-1013','2026-07-10','2026-08-23',NULL,NULL);
INSERT INTO "doctor_patients" ("doctor_id","patient_id","local_ref","first_seen_on","last_seen_on","private_notes","archived_at") VALUES('doc_demo','pat_demo_leela','DEMO-1014','2026-07-20','2026-08-29','Uses hearing aid.',NULL);
INSERT INTO "doctor_patients" ("doctor_id","patient_id","local_ref","first_seen_on","last_seen_on","private_notes","archived_at") VALUES('doc_demo','pat_demo_aditya','DEMO-1015','2026-08-04','2026-09-01','Parent accompanies child.',NULL);
INSERT INTO "doctor_patients" ("doctor_id","patient_id","local_ref","first_seen_on","last_seen_on","private_notes","archived_at") VALUES('doc_homeo','pat_homeo_1','HOMO-1001','2026-07-01','2026-08-28','Chronic case; keep the totality in view.',NULL);
INSERT INTO "doctor_patients" ("doctor_id","patient_id","local_ref","first_seen_on","last_seen_on","private_notes","archived_at") VALUES('doc_homeo','pat_homeo_2','HOMO-1002','2026-07-13','2026-08-21',NULL,NULL);
INSERT INTO "doctor_patients" ("doctor_id","patient_id","local_ref","first_seen_on","last_seen_on","private_notes","archived_at") VALUES('doc_homeo','pat_homeo_3','HOMO-1003','2026-08-03','2026-09-01','Mother attends with her.',NULL);
INSERT INTO "doctor_patients" ("doctor_id","patient_id","local_ref","first_seen_on","last_seen_on","private_notes","archived_at") VALUES('doc_allo','pat_allo_1','ALO-1001','2026-07-25','2026-08-29','Reviews BP log on his phone.',NULL);
INSERT INTO "doctor_patients" ("doctor_id","patient_id","local_ref","first_seen_on","last_seen_on","private_notes","archived_at") VALUES('doc_allo','pat_allo_2','ALO-1002','2026-08-12','2026-08-31',NULL,NULL);
INSERT INTO "doctor_patients" ("doctor_id","patient_id","local_ref","first_seen_on","last_seen_on","private_notes","archived_at") VALUES('doc_allo','pat_demo_vijay','ALO-1003','2026-08-16','2026-08-30','Also under Ayurvedic care elsewhere - ask before changing anything.',NULL);
CREATE TABLE visits (
  id           TEXT PRIMARY KEY,
  doctor_id    TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id   TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  visited_on   TEXT NOT NULL,
  visit_type   TEXT,                   -- first | follow_up | online
  complaints   TEXT,
  diagnosis    TEXT,
  vitals       TEXT,                   -- JSON
  findings     TEXT,                   -- JSON, practice-pack fields
  advice       TEXT,
  follow_up_on TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
, status TEXT NOT NULL DEFAULT 'completed', closed_at TEXT, practitioner_id TEXT REFERENCES clinic_users(id), idempotency_key TEXT);
INSERT INTO "visits" ("id","doctor_id","patient_id","visited_on","visit_type","complaints","diagnosis","vitals","findings","advice","follow_up_on","created_at","status","closed_at","practitioner_id","idempotency_key") VALUES('visit_demo_vijay_1','doc_demo','pat_demo_vijay','2026-08-04','first','Headache and poor sleep','Tension-type headache','{"bp":"128/82","pulse":76,"weight":74.2}','{"redFlags":false}','Hydration, sleep routine and screen breaks','2026-09-01','2026-09-03 19:20:36','completed','2026-08-04 19:20:36',NULL,NULL);
INSERT INTO "visits" ("id","doctor_id","patient_id","visited_on","visit_type","complaints","diagnosis","vitals","findings","advice","follow_up_on","created_at","status","closed_at","practitioner_id","idempotency_key") VALUES('visit_demo_vijay_2','doc_demo','pat_demo_vijay','2026-09-01','follow_up','Amlapitta symptoms, irregular appetite and disturbed sleep','Amlapitta with Pitta-Vata aggravation','{"bp":"124/80","pulse":72,"weight":73.8}','{"ayurveda-assessment.Prakriti":"Pitta–Vata","ayurveda-assessment.Vikriti":"Pitta predominance with Vata association","ayurveda-assessment.Dosha status":"Pitta ↑, Vata mild ↑","ayurveda-assessment.Agni":"Vishama–Tikshna","ayurveda-assessment.Koshtha":"Madhyama","ayurveda-assessment.Ama":"Mild","ayurveda-assessment.Srotas involved":"Annavaha, Purishavaha","nadi.Nadi — left":"Pitta–Vata","nadi.Nadi — right":"Vata–Pitta","nadi.Gati":"Manduka / Sarpa mixed","ahara-vihara.Sleep":"Interrupted; 5–6 hours","ahara-vihara.Pathya":"Warm freshly prepared food; regular meal timing","ahara-vihara.Apathya":"Late meals, excess chilli, sour and fried foods","care.investigations":"CBC, LFT and HbA1c before next review","care.referrals":"Physician co-management if warning symptoms persist"}','Pathya: warm simple meals at regular times. Apathya: late meals, excess chilli, sour and fried food. Gentle walk after meals; Nadi Shodhana 8 minutes daily.','2026-09-17','2026-09-03 19:20:36','completed','2026-09-01 19:20:36',NULL,NULL);
INSERT INTO "visits" ("id","doctor_id","patient_id","visited_on","visit_type","complaints","diagnosis","vitals","findings","advice","follow_up_on","created_at","status","closed_at","practitioner_id","idempotency_key") VALUES('visit_demo_ananya','doc_demo','pat_demo_ananya','2026-08-27','follow_up','Home BP readings elevated','Essential hypertension','{"bp":"148/92","pulse":78,"weight":68.4}','{"homeAverage":"142/88"}','Reduce salt and continue BP diary','2026-09-04','2026-09-03 19:20:36','completed','2026-08-27 19:20:36',NULL,NULL);
INSERT INTO "visits" ("id","doctor_id","patient_id","visited_on","visit_type","complaints","diagnosis","vitals","findings","advice","follow_up_on","created_at","status","closed_at","practitioner_id","idempotency_key") VALUES('visit_demo_rohan','doc_demo','pat_demo_rohan','2026-09-02','first','Fever, sore throat','Viral upper respiratory infection','{"temperature":38.1,"pulse":96,"weight":41.0}','{"hydration":"adequate"}','Fluids, rest and return for breathing difficulty','2026-09-03','2026-09-03 19:20:36','completed','2026-09-02 19:20:36',NULL,NULL);
INSERT INTO "visits" ("id","doctor_id","patient_id","visited_on","visit_type","complaints","diagnosis","vitals","findings","advice","follow_up_on","created_at","status","closed_at","practitioner_id","idempotency_key") VALUES('visit_demo_meera','doc_demo','pat_demo_meera','2026-08-24','follow_up','Glucose review','Type 2 diabetes mellitus','{"bp":"136/84","pulse":74,"weight":70.1}','{"fastingGlucose":142}','Diet review and daily walking','2026-09-23','2026-09-03 19:20:36','completed','2026-08-24 19:20:36',NULL,NULL);
INSERT INTO "visits" ("id","doctor_id","patient_id","visited_on","visit_type","complaints","diagnosis","vitals","findings","advice","follow_up_on","created_at","status","closed_at","practitioner_id","idempotency_key") VALUES('visit_demo_aarav','doc_demo','pat_demo_aarav','2026-08-31','first','Sneezing and itchy eyes','Seasonal allergic rhinitis','{"bp":"118/76","pulse":70,"weight":66.5}','{}','Avoid triggers; saline nasal rinse',NULL,'2026-09-03 19:20:36','completed','2026-08-31 19:20:36',NULL,NULL);
INSERT INTO "visits" ("id","doctor_id","patient_id","visited_on","visit_type","complaints","diagnosis","vitals","findings","advice","follow_up_on","created_at","status","closed_at","practitioner_id","idempotency_key") VALUES('visit_demo_cardio','doc_demo','pat_demo_lakshmi','2026-08-30','follow_up','Exertional tiredness; no resting chest pain','Ischaemic heart disease, hypertension, dyslipidaemia and type 2 diabetes','{"bp":"146/86","pulse":68,"weight":63.2,"spo2":97}','{"testsAdvised":["ECG","Echocardiogram","Lipid profile","HbA1c","Renal function"],"referrals":["Cardiology review","ENT for recurrent vertigo","Neurology if imbalance persists"]}','Low-salt diabetic diet, 30 minutes walking as tolerated, keep BP/glucose log; urgent care for chest pain lasting over 10 minutes','2026-09-29','2026-09-03 19:20:44','completed','2026-08-30 19:20:44',NULL,NULL);
INSERT INTO "visits" ("id","doctor_id","patient_id","visited_on","visit_type","complaints","diagnosis","vitals","findings","advice","follow_up_on","created_at","status","closed_at","practitioner_id","idempotency_key") VALUES('vis_homeo_1','doc_homeo','pat_homeo_1','2026-07-01','first','Recurrent migraine, worse before menses, better in a dark room','Chronic migraine - constitutional case','{"bp":"118/76","pulse":"74","weight":"61"}','Mentals: reserved, weeps alone. Thermal: chilly. Thirst: large quantities, infrequent. Miasm: psoric.','Avoid skipping meals. Keep a headache diary until the next visit.','2026-07-31','2026-09-03 19:20:52','closed','2026-07-01 19:20:52',NULL,NULL);
INSERT INTO "visits" ("id","doctor_id","patient_id","visited_on","visit_type","complaints","diagnosis","vitals","findings","advice","follow_up_on","created_at","status","closed_at","practitioner_id","idempotency_key") VALUES('vis_homeo_2','doc_homeo','pat_homeo_1','2026-08-28','follow_up','Frequency down from weekly to twice this month; intensity lower','Chronic migraine - responding','{"bp":"116/74","pulse":"72","weight":"61"}','Direction of cure holding. No new symptoms. Repeat not indicated yet.','Continue placebo. Return if the pattern changes.','2026-09-27','2026-09-03 19:20:52','closed','2026-08-28 19:20:52',NULL,NULL);
INSERT INTO "visits" ("id","doctor_id","patient_id","visited_on","visit_type","complaints","diagnosis","vitals","findings","advice","follow_up_on","created_at","status","closed_at","practitioner_id","idempotency_key") VALUES('vis_homeo_3','doc_homeo','pat_homeo_2','2026-08-21','follow_up','Eczema on both hands, worse with water and washing','Chronic eczema','{"bp":"128/82","pulse":"78","weight":"79"}','Worse: washing, winter. Better: open air. Thermal: hot. Sycotic features.','Cotton gloves for wet work. No medicated soap.','2026-09-20','2026-09-03 19:20:52','closed','2026-08-21 19:20:52',NULL,NULL);
INSERT INTO "visits" ("id","doctor_id","patient_id","visited_on","visit_type","complaints","diagnosis","vitals","findings","advice","follow_up_on","created_at","status","closed_at","practitioner_id","idempotency_key") VALUES('vis_allo_1','doc_allo','pat_allo_1','2026-07-25','first','Fatigue, increased thirst, passing urine at night','Type 2 diabetes mellitus - newly detected','{"bp":"142/90","pulse":"84","weight":"88","temperature":"98.4"}','CVS: S1S2 normal. RS: clear. Abdomen: soft, no organomegaly. No neuropathy.','Start metformin with the evening meal. Walk 30 minutes daily. Repeat HbA1c in 3 months.','2026-08-24','2026-09-03 19:20:52','closed','2026-07-25 19:20:52',NULL,NULL);
INSERT INTO "visits" ("id","doctor_id","patient_id","visited_on","visit_type","complaints","diagnosis","vitals","findings","advice","follow_up_on","created_at","status","closed_at","practitioner_id","idempotency_key") VALUES('vis_allo_2','doc_allo','pat_allo_1','2026-08-29','follow_up','Tolerating medication; no hypoglycaemic episodes','Type 2 diabetes mellitus - on treatment','{"bp":"132/84","pulse":"78","weight":"86"}','Weight down 2kg. No side effects reported.','Continue the same dose. Bring the glucose log next time.','2026-10-28','2026-09-03 19:20:52','closed','2026-08-29 19:20:52',NULL,NULL);
INSERT INTO "visits" ("id","doctor_id","patient_id","visited_on","visit_type","complaints","diagnosis","vitals","findings","advice","follow_up_on","created_at","status","closed_at","practitioner_id","idempotency_key") VALUES('vis_allo_3','doc_allo','pat_demo_vijay','2026-08-30','first','Persistent acidity and disturbed sleep for three weeks','Gastro-oesophageal reflux','{"bp":"124/80","pulse":"76","weight":"74"}','Abdomen soft, epigastric tenderness. Currently taking Ayurvedic formulations under another doctor - noted, not altered.','Avoid late meals. Raise the head of the bed. Review in two weeks.','2026-09-13','2026-09-03 19:20:52','closed','2026-08-30 19:20:52',NULL,NULL);
CREATE TABLE prescriptions (
  id          TEXT PRIMARY KEY,
  doctor_id   TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id  TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  visit_id    TEXT REFERENCES visits(id) ON DELETE SET NULL,
  rx_number   TEXT,
  issued_on   TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'draft',  -- draft | issued
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
, issued_at TEXT, sequence_no INTEGER, amends TEXT, superseded_by TEXT, amend_reason TEXT, practitioner_id TEXT REFERENCES clinic_users(id), idempotency_key TEXT);
INSERT INTO "prescriptions" ("id","doctor_id","patient_id","visit_id","rx_number","issued_on","status","created_at","issued_at","sequence_no","amends","superseded_by","amend_reason","practitioner_id","idempotency_key") VALUES('rx_demo_1','doc_demo','pat_demo_vijay','visit_demo_vijay_2','DEMO/2026/0001','2026-09-01','issued','2026-09-03 19:20:36','2026-09-01 19:20:36',1,NULL,NULL,NULL,NULL,NULL);
INSERT INTO "prescriptions" ("id","doctor_id","patient_id","visit_id","rx_number","issued_on","status","created_at","issued_at","sequence_no","amends","superseded_by","amend_reason","practitioner_id","idempotency_key") VALUES('rx_demo_2','doc_demo','pat_demo_rohan','visit_demo_rohan','DEMO/2026/0002','2026-09-02','issued','2026-09-03 19:20:36','2026-09-02 19:20:36',2,NULL,NULL,NULL,NULL,NULL);
INSERT INTO "prescriptions" ("id","doctor_id","patient_id","visit_id","rx_number","issued_on","status","created_at","issued_at","sequence_no","amends","superseded_by","amend_reason","practitioner_id","idempotency_key") VALUES('rx_demo_3','doc_demo','pat_demo_meera','visit_demo_meera','DEMO/2026/0003','2026-08-24','issued','2026-09-03 19:20:36','2026-08-24 19:20:36',3,NULL,NULL,NULL,NULL,NULL);
INSERT INTO "prescriptions" ("id","doctor_id","patient_id","visit_id","rx_number","issued_on","status","created_at","issued_at","sequence_no","amends","superseded_by","amend_reason","practitioner_id","idempotency_key") VALUES('rx_demo_4','doc_demo','pat_demo_aarav','visit_demo_aarav','DEMO/2026/0004','2026-08-31','issued','2026-09-03 19:20:36','2026-08-31 19:20:36',4,NULL,NULL,NULL,NULL,NULL);
INSERT INTO "prescriptions" ("id","doctor_id","patient_id","visit_id","rx_number","issued_on","status","created_at","issued_at","sequence_no","amends","superseded_by","amend_reason","practitioner_id","idempotency_key") VALUES('rx_demo_cardio','doc_demo','pat_demo_lakshmi','visit_demo_cardio','DEMO/2026/0015','2026-08-30','issued','2026-09-03 19:20:44','2026-08-30 19:20:44',15,NULL,NULL,NULL,NULL,NULL);
INSERT INTO "prescriptions" ("id","doctor_id","patient_id","visit_id","rx_number","issued_on","status","created_at","issued_at","sequence_no","amends","superseded_by","amend_reason","practitioner_id","idempotency_key") VALUES('rx_homeo_1','doc_homeo','pat_homeo_1','vis_homeo_1','HOMO/2026/0001','2026-07-01','issued','2026-09-03 19:20:52','2026-07-01 19:20:52',1,NULL,NULL,NULL,NULL,NULL);
INSERT INTO "prescriptions" ("id","doctor_id","patient_id","visit_id","rx_number","issued_on","status","created_at","issued_at","sequence_no","amends","superseded_by","amend_reason","practitioner_id","idempotency_key") VALUES('rx_homeo_2','doc_homeo','pat_homeo_2','vis_homeo_3','HOMO/2026/0002','2026-08-21','issued','2026-09-03 19:20:52','2026-08-21 19:20:52',2,NULL,NULL,NULL,NULL,NULL);
INSERT INTO "prescriptions" ("id","doctor_id","patient_id","visit_id","rx_number","issued_on","status","created_at","issued_at","sequence_no","amends","superseded_by","amend_reason","practitioner_id","idempotency_key") VALUES('rx_allo_1','doc_allo','pat_allo_1','vis_allo_1','ALO/2026/0001','2026-07-25','issued','2026-09-03 19:20:52','2026-07-25 19:20:52',1,NULL,NULL,NULL,NULL,NULL);
INSERT INTO "prescriptions" ("id","doctor_id","patient_id","visit_id","rx_number","issued_on","status","created_at","issued_at","sequence_no","amends","superseded_by","amend_reason","practitioner_id","idempotency_key") VALUES('rx_allo_2','doc_allo','pat_demo_vijay','vis_allo_3','ALO/2026/0002','2026-08-30','issued','2026-09-03 19:20:52','2026-08-30 19:20:52',2,NULL,NULL,NULL,NULL,NULL);
CREATE TABLE prescription_items (
  id              TEXT PRIMARY KEY,
  prescription_id TEXT NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  doctor_id       TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  medicine_name   TEXT NOT NULL,
  system          TEXT NOT NULL DEFAULT 'allopathy',
  dose            TEXT,
  frequency       TEXT,
  duration        TEXT,
  instructions    TEXT,
  attributes      TEXT NOT NULL DEFAULT '{}',  -- JSON, validated per practice pack
  sort_order      INTEGER NOT NULL DEFAULT 0
, dispense_quantity REAL, stock_item_id TEXT);
INSERT INTO "prescription_items" ("id","prescription_id","doctor_id","medicine_name","system","dose","frequency","duration","instructions","attributes","sort_order","dispense_quantity","stock_item_id") VALUES('rxi_demo_1','rx_demo_1','doc_demo','Paracetamol 500 mg','allopathy','1 tablet','When required','5 days','After food; maximum 3 daily','{}',1,10,'stock_demo_para');
INSERT INTO "prescription_items" ("id","prescription_id","doctor_id","medicine_name","system","dose","frequency","duration","instructions","attributes","sort_order","dispense_quantity","stock_item_id") VALUES('rxi_demo_2','rx_demo_2','doc_demo','Paracetamol 500 mg','allopathy','1 tablet','Three times daily','3 days','After food','{}',1,9,'stock_demo_para');
INSERT INTO "prescription_items" ("id","prescription_id","doctor_id","medicine_name","system","dose","frequency","duration","instructions","attributes","sort_order","dispense_quantity","stock_item_id") VALUES('rxi_demo_3','rx_demo_2','doc_demo','ORS sachet','allopathy','1 sachet','After loose stool','2 days','Mix in one litre clean water','{}',2,2,'stock_demo_ors');
INSERT INTO "prescription_items" ("id","prescription_id","doctor_id","medicine_name","system","dose","frequency","duration","instructions","attributes","sort_order","dispense_quantity","stock_item_id") VALUES('rxi_demo_4','rx_demo_3','doc_demo','Metformin 500 mg','allopathy','1 tablet','Twice daily','30 days','With meals','{}',1,60,'stock_demo_met');
INSERT INTO "prescription_items" ("id","prescription_id","doctor_id","medicine_name","system","dose","frequency","duration","instructions","attributes","sort_order","dispense_quantity","stock_item_id") VALUES('rxi_demo_5','rx_demo_4','doc_demo','Cetirizine 10 mg','allopathy','1 tablet','Once nightly','7 days','May cause drowsiness','{}',1,7,'stock_demo_cet');
INSERT INTO "prescription_items" ("id","prescription_id","doctor_id","medicine_name","system","dose","frequency","duration","instructions","attributes","sort_order","dispense_quantity","stock_item_id") VALUES('rxi_ayurcos_1','rx_demo_1','doc_demo','Avipattikara Churna','ayurveda','3 g','Twice daily','30 days','With warm water, 20 minutes before food','{"anupana":"warm water","form":"churna"}',10,180,NULL);
INSERT INTO "prescription_items" ("id","prescription_id","doctor_id","medicine_name","system","dose","frequency","duration","instructions","attributes","sort_order","dispense_quantity","stock_item_id") VALUES('rxi_ayurcos_2','rx_demo_1','doc_demo','Guduchi Ghana Vati 500 mg','ayurveda','1 tablet','Twice daily','30 days','After food with warm water','{"form":"vati"}',11,60,NULL);
INSERT INTO "prescription_items" ("id","prescription_id","doctor_id","medicine_name","system","dose","frequency","duration","instructions","attributes","sort_order","dispense_quantity","stock_item_id") VALUES('rxi_ayurcos_3','rx_demo_1','doc_demo','Yashtimadhu Churna','ayurveda','2 g','Twice daily','21 days','With lukewarm milk when tolerated','{"anupana":"lukewarm milk","form":"churna"}',12,84,NULL);
INSERT INTO "prescription_items" ("id","prescription_id","doctor_id","medicine_name","system","dose","frequency","duration","instructions","attributes","sort_order","dispense_quantity","stock_item_id") VALUES('rxi_ayurcos_4','rx_demo_1','doc_demo','Drakshasava','ayurveda','15 ml','Twice daily','30 days','Dilute with equal water after food','{"form":"asava-arishta"}',13,900,NULL);
INSERT INTO "prescription_items" ("id","prescription_id","doctor_id","medicine_name","system","dose","frequency","duration","instructions","attributes","sort_order","dispense_quantity","stock_item_id") VALUES('rxi_ayurcos_5','rx_demo_1','doc_demo','Ksheerabala Taila','ayurveda','External application','Once nightly','21 days','Gentle local application; avoid if irritation occurs','{"form":"taila"}',14,1,NULL);
INSERT INTO "prescription_items" ("id","prescription_id","doctor_id","medicine_name","system","dose","frequency","duration","instructions","attributes","sort_order","dispense_quantity","stock_item_id") VALUES('rxi_cardio_1','rx_demo_cardio','doc_demo','Aspirin 75 mg','allopathy','1 tablet','Once daily','30 days','After breakfast','{}',1,30,NULL);
INSERT INTO "prescription_items" ("id","prescription_id","doctor_id","medicine_name","system","dose","frequency","duration","instructions","attributes","sort_order","dispense_quantity","stock_item_id") VALUES('rxi_cardio_2','rx_demo_cardio','doc_demo','Clopidogrel 75 mg','allopathy','1 tablet','Once daily','30 days','After dinner','{}',2,30,NULL);
INSERT INTO "prescription_items" ("id","prescription_id","doctor_id","medicine_name","system","dose","frequency","duration","instructions","attributes","sort_order","dispense_quantity","stock_item_id") VALUES('rxi_cardio_3','rx_demo_cardio','doc_demo','Atorvastatin 40 mg','allopathy','1 tablet','At night','30 days','Same time every night','{}',3,30,NULL);
INSERT INTO "prescription_items" ("id","prescription_id","doctor_id","medicine_name","system","dose","frequency","duration","instructions","attributes","sort_order","dispense_quantity","stock_item_id") VALUES('rxi_cardio_4','rx_demo_cardio','doc_demo','Metoprolol succinate 25 mg','allopathy','1 tablet','Once daily','30 days','Do not stop suddenly','{}',4,30,NULL);
INSERT INTO "prescription_items" ("id","prescription_id","doctor_id","medicine_name","system","dose","frequency","duration","instructions","attributes","sort_order","dispense_quantity","stock_item_id") VALUES('rxi_cardio_5','rx_demo_cardio','doc_demo','Telmisartan 40 mg','allopathy','1 tablet','Once daily','30 days','Check blood pressure daily','{}',5,30,NULL);
INSERT INTO "prescription_items" ("id","prescription_id","doctor_id","medicine_name","system","dose","frequency","duration","instructions","attributes","sort_order","dispense_quantity","stock_item_id") VALUES('rxi_cardio_6','rx_demo_cardio','doc_demo','Amlodipine 5 mg','allopathy','1 tablet','Once daily','30 days','Report troublesome ankle swelling','{}',6,30,NULL);
INSERT INTO "prescription_items" ("id","prescription_id","doctor_id","medicine_name","system","dose","frequency","duration","instructions","attributes","sort_order","dispense_quantity","stock_item_id") VALUES('rxi_cardio_7','rx_demo_cardio','doc_demo','Metformin 500 mg','allopathy','1 tablet','Twice daily','30 days','With breakfast and dinner','{}',7,60,NULL);
INSERT INTO "prescription_items" ("id","prescription_id","doctor_id","medicine_name","system","dose","frequency","duration","instructions","attributes","sort_order","dispense_quantity","stock_item_id") VALUES('rxi_cardio_8','rx_demo_cardio','doc_demo','Pantoprazole 40 mg','allopathy','1 tablet','Once daily','30 days','30 minutes before breakfast','{}',8,30,NULL);
INSERT INTO "prescription_items" ("id","prescription_id","doctor_id","medicine_name","system","dose","frequency","duration","instructions","attributes","sort_order","dispense_quantity","stock_item_id") VALUES('rxi_cardio_9','rx_demo_cardio','doc_demo','Nitroglycerin 0.5 mg SL','allopathy','1 tablet under tongue','When required','As needed','For chest pain; seek urgent help if not relieved','{}',9,10,NULL);
INSERT INTO "prescription_items" ("id","prescription_id","doctor_id","medicine_name","system","dose","frequency","duration","instructions","attributes","sort_order","dispense_quantity","stock_item_id") VALUES('rxi_cardio_10','rx_demo_cardio','doc_demo','Vitamin D3 60000 IU','allopathy','1 capsule','Once weekly','8 weeks','After food on Sunday','{}',10,8,NULL);
INSERT INTO "prescription_items" ("id","prescription_id","doctor_id","medicine_name","system","dose","frequency","duration","instructions","attributes","sort_order","dispense_quantity","stock_item_id") VALUES('rxi_homeo_1','rx_homeo_1','doc_homeo','Natrum Muriaticum','homeopathy','200C','Single dose','Once','Dry doses on the tongue. Nothing by mouth for 30 minutes.','{}',1,NULL,NULL);
INSERT INTO "prescription_items" ("id","prescription_id","doctor_id","medicine_name","system","dose","frequency","duration","instructions","attributes","sort_order","dispense_quantity","stock_item_id") VALUES('rxi_homeo_2','rx_homeo_1','doc_homeo','Saccharum Lactis (placebo)','homeopathy','30','Twice daily','30 days','Continue until the next review.','{}',2,NULL,NULL);
INSERT INTO "prescription_items" ("id","prescription_id","doctor_id","medicine_name","system","dose","frequency","duration","instructions","attributes","sort_order","dispense_quantity","stock_item_id") VALUES('rxi_homeo_3','rx_homeo_2','doc_homeo','Graphites','homeopathy','30C','Once daily','14 days','Morning, empty stomach.','{}',1,NULL,NULL);
INSERT INTO "prescription_items" ("id","prescription_id","doctor_id","medicine_name","system","dose","frequency","duration","instructions","attributes","sort_order","dispense_quantity","stock_item_id") VALUES('rxi_homeo_4','rx_homeo_2','doc_homeo','Calendula mother tincture','homeopathy','Q','Local application','14 days','Dilute 1:10 in water before applying.','{}',2,NULL,NULL);
INSERT INTO "prescription_items" ("id","prescription_id","doctor_id","medicine_name","system","dose","frequency","duration","instructions","attributes","sort_order","dispense_quantity","stock_item_id") VALUES('rxi_allo_1','rx_allo_1','doc_allo','Metformin','allopathy','500 mg','Once daily','90 days','With the evening meal.','{}',1,NULL,NULL);
INSERT INTO "prescription_items" ("id","prescription_id","doctor_id","medicine_name","system","dose","frequency","duration","instructions","attributes","sort_order","dispense_quantity","stock_item_id") VALUES('rxi_allo_2','rx_allo_1','doc_allo','Vitamin D3','supplement','60000 IU','Once weekly','8 weeks','With food.','{}',2,NULL,NULL);
INSERT INTO "prescription_items" ("id","prescription_id","doctor_id","medicine_name","system","dose","frequency","duration","instructions","attributes","sort_order","dispense_quantity","stock_item_id") VALUES('rxi_allo_3','rx_allo_2','doc_allo','Pantoprazole','allopathy','40 mg','Once daily','14 days','30 minutes before breakfast.','{}',1,NULL,NULL);
CREATE TABLE lab_reports (
  id            TEXT PRIMARY KEY,
  doctor_id     TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id    TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  report_name   TEXT NOT NULL,
  reported_on   TEXT NOT NULL,
  source        TEXT,                  -- lab | patient_upload
  status        TEXT NOT NULL DEFAULT 'awaiting_verification',
  verified_by   TEXT,
  verified_at   TEXT,
  file_key      TEXT,                  -- R2 object key
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
, practitioner_id TEXT REFERENCES clinic_users(id), lab_name TEXT, idempotency_key TEXT);
INSERT INTO "lab_reports" ("id","doctor_id","patient_id","report_name","reported_on","source","status","verified_by","verified_at","file_key","created_at","practitioner_id","lab_name","idempotency_key") VALUES('lab_demo_vijay','doc_demo','pat_demo_vijay','Complete Blood Count','2026-08-29','lab','verified','doc_demo','2026-08-29 19:20:36',NULL,'2026-09-03 19:20:36',NULL,NULL,NULL);
INSERT INTO "lab_reports" ("id","doctor_id","patient_id","report_name","reported_on","source","status","verified_by","verified_at","file_key","created_at","practitioner_id","lab_name","idempotency_key") VALUES('lab_demo_meera','doc_demo','pat_demo_meera','Diabetes Panel','2026-08-25','lab','verified','doc_demo','2026-08-25 19:20:36',NULL,'2026-09-03 19:20:36',NULL,NULL,NULL);
INSERT INTO "lab_reports" ("id","doctor_id","patient_id","report_name","reported_on","source","status","verified_by","verified_at","file_key","created_at","practitioner_id","lab_name","idempotency_key") VALUES('lab_demo_ananya','doc_demo','pat_demo_ananya','Renal Function Test','2026-08-28','patient_upload','awaiting_verification',NULL,NULL,NULL,'2026-09-03 19:20:36',NULL,NULL,NULL);
INSERT INTO "lab_reports" ("id","doctor_id","patient_id","report_name","reported_on","source","status","verified_by","verified_at","file_key","created_at","practitioner_id","lab_name","idempotency_key") VALUES('lab_cardio_lipid','doc_demo','pat_demo_lakshmi','Lipid profile','2026-08-28','lab','verified','doc_demo','2026-08-29 19:20:44',NULL,'2026-09-03 19:20:44',NULL,NULL,NULL);
INSERT INTO "lab_reports" ("id","doctor_id","patient_id","report_name","reported_on","source","status","verified_by","verified_at","file_key","created_at","practitioner_id","lab_name","idempotency_key") VALUES('lab_cardio_diabetes','doc_demo','pat_demo_lakshmi','Diabetes and renal panel','2026-08-28','lab','verified','doc_demo','2026-08-29 19:20:44',NULL,'2026-09-03 19:20:44',NULL,NULL,NULL);
INSERT INTO "lab_reports" ("id","doctor_id","patient_id","report_name","reported_on","source","status","verified_by","verified_at","file_key","created_at","practitioner_id","lab_name","idempotency_key") VALUES('lab_cardio_echo','doc_demo','pat_demo_lakshmi','Echocardiogram','2026-08-29','patient_upload','awaiting_verification',NULL,NULL,NULL,'2026-09-03 19:20:44',NULL,NULL,NULL);
INSERT INTO "lab_reports" ("id","doctor_id","patient_id","report_name","reported_on","source","status","verified_by","verified_at","file_key","created_at","practitioner_id","lab_name","idempotency_key") VALUES('lab_more_thyroid','doc_demo','pat_demo_fatima','Thyroid function test','2026-09-01','patient_upload','awaiting_verification',NULL,NULL,NULL,'2026-09-03 19:20:44',NULL,NULL,NULL);
INSERT INTO "lab_reports" ("id","doctor_id","patient_id","report_name","reported_on","source","status","verified_by","verified_at","file_key","created_at","practitioner_id","lab_name","idempotency_key") VALUES('lab_more_anaemia','doc_demo','pat_demo_nisha','Complete Blood Count','2026-08-26','lab','verified','doc_demo','2026-08-27 19:20:44',NULL,'2026-09-03 19:20:44',NULL,NULL,NULL);
INSERT INTO "lab_reports" ("id","doctor_id","patient_id","report_name","reported_on","source","status","verified_by","verified_at","file_key","created_at","practitioner_id","lab_name","idempotency_key") VALUES('lab_lakshmi_history_1','doc_demo','pat_demo_lakshmi','Cardiometabolic review','2026-03-02','lab','verified','doc_demo','2026-03-02 19:20:48',NULL,'2026-09-03 19:20:48',NULL,NULL,NULL);
INSERT INTO "lab_reports" ("id","doctor_id","patient_id","report_name","reported_on","source","status","verified_by","verified_at","file_key","created_at","practitioner_id","lab_name","idempotency_key") VALUES('lab_lakshmi_history_2','doc_demo','pat_demo_lakshmi','Cardiometabolic review','2026-05-30','lab','verified','doc_demo','2026-05-30 19:20:48',NULL,'2026-09-03 19:20:48',NULL,NULL,NULL);
INSERT INTO "lab_reports" ("id","doctor_id","patient_id","report_name","reported_on","source","status","verified_by","verified_at","file_key","created_at","practitioner_id","lab_name","idempotency_key") VALUES('lab_lakshmi_history_3','doc_demo','pat_demo_lakshmi','Cardiometabolic review','2026-07-30','lab','verified','doc_demo','2026-07-30 19:20:48',NULL,'2026-09-03 19:20:48',NULL,NULL,NULL);
INSERT INTO "lab_reports" ("id","doctor_id","patient_id","report_name","reported_on","source","status","verified_by","verified_at","file_key","created_at","practitioner_id","lab_name","idempotency_key") VALUES('lab_allo_1','doc_allo','pat_allo_1','HbA1c and fasting glucose','2026-07-24','lab','verified','doc_allo','2026-07-25 19:20:52',NULL,'2026-09-03 19:20:52',NULL,NULL,NULL);
INSERT INTO "lab_reports" ("id","doctor_id","patient_id","report_name","reported_on","source","status","verified_by","verified_at","file_key","created_at","practitioner_id","lab_name","idempotency_key") VALUES('lab_allo_2','doc_allo','pat_allo_1','HbA1c - repeat','2026-08-28','lab','verified','doc_allo','2026-08-29 19:20:52',NULL,'2026-09-03 19:20:52',NULL,NULL,NULL);
CREATE TABLE lab_values (
  id            TEXT PRIMARY KEY,
  lab_report_id TEXT NOT NULL REFERENCES lab_reports(id) ON DELETE CASCADE,
  doctor_id     TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  analyte       TEXT NOT NULL,
  value         TEXT,
  unit          TEXT,
  reference     TEXT,
  flag          TEXT                    -- normal | high | low | critical
);
INSERT INTO "lab_values" ("id","lab_report_id","doctor_id","analyte","value","unit","reference","flag") VALUES('labv_demo_1','lab_demo_vijay','doc_demo','Haemoglobin','14.2','g/dL','13.0-17.0','normal');
INSERT INTO "lab_values" ("id","lab_report_id","doctor_id","analyte","value","unit","reference","flag") VALUES('labv_demo_2','lab_demo_vijay','doc_demo','WBC','7.4','10^3/uL','4.0-11.0','normal');
INSERT INTO "lab_values" ("id","lab_report_id","doctor_id","analyte","value","unit","reference","flag") VALUES('labv_demo_3','lab_demo_meera','doc_demo','HbA1c','7.8','%','4.0-5.6','high');
INSERT INTO "lab_values" ("id","lab_report_id","doctor_id","analyte","value","unit","reference","flag") VALUES('labv_demo_4','lab_demo_meera','doc_demo','Fasting glucose','142','mg/dL','70-99','high');
INSERT INTO "lab_values" ("id","lab_report_id","doctor_id","analyte","value","unit","reference","flag") VALUES('labv_cardio_1','lab_cardio_lipid','doc_demo','LDL cholesterol','132','mg/dL','Below 70','high');
INSERT INTO "lab_values" ("id","lab_report_id","doctor_id","analyte","value","unit","reference","flag") VALUES('labv_cardio_2','lab_cardio_lipid','doc_demo','HDL cholesterol','39','mg/dL','Above 50','low');
INSERT INTO "lab_values" ("id","lab_report_id","doctor_id","analyte","value","unit","reference","flag") VALUES('labv_cardio_3','lab_cardio_lipid','doc_demo','Triglycerides','186','mg/dL','Below 150','high');
INSERT INTO "lab_values" ("id","lab_report_id","doctor_id","analyte","value","unit","reference","flag") VALUES('labv_cardio_4','lab_cardio_diabetes','doc_demo','HbA1c','7.6','%','Below 7.0','high');
INSERT INTO "lab_values" ("id","lab_report_id","doctor_id","analyte","value","unit","reference","flag") VALUES('labv_cardio_5','lab_cardio_diabetes','doc_demo','Creatinine','1.1','mg/dL','0.6-1.2','normal');
INSERT INTO "lab_values" ("id","lab_report_id","doctor_id","analyte","value","unit","reference","flag") VALUES('labv_cardio_6','lab_cardio_diabetes','doc_demo','eGFR','68','mL/min','Above 60','normal');
INSERT INTO "lab_values" ("id","lab_report_id","doctor_id","analyte","value","unit","reference","flag") VALUES('labv_cardio_7','lab_cardio_echo','doc_demo','LVEF','48','%','55-70','low');
INSERT INTO "lab_values" ("id","lab_report_id","doctor_id","analyte","value","unit","reference","flag") VALUES('labv_cardio_8','lab_more_thyroid','doc_demo','TSH','8.2','mIU/L','0.4-4.0','high');
INSERT INTO "lab_values" ("id","lab_report_id","doctor_id","analyte","value","unit","reference","flag") VALUES('labv_cardio_9','lab_more_anaemia','doc_demo','Haemoglobin','9.8','g/dL','12.0-15.0','low');
INSERT INTO "lab_values" ("id","lab_report_id","doctor_id","analyte","value","unit","reference","flag") VALUES('labv_cardio_10','lab_more_anaemia','doc_demo','MCV','72','fL','80-100','low');
INSERT INTO "lab_values" ("id","lab_report_id","doctor_id","analyte","value","unit","reference","flag") VALUES('labv_lakshmi_history_1','lab_lakshmi_history_1','doc_demo','HbA1c','8.6','%','Below 7.0','high');
INSERT INTO "lab_values" ("id","lab_report_id","doctor_id","analyte","value","unit","reference","flag") VALUES('labv_lakshmi_history_2','lab_lakshmi_history_2','doc_demo','HbA1c','8.1','%','Below 7.0','high');
INSERT INTO "lab_values" ("id","lab_report_id","doctor_id","analyte","value","unit","reference","flag") VALUES('labv_lakshmi_history_3','lab_lakshmi_history_3','doc_demo','HbA1c','7.8','%','Below 7.0','high');
INSERT INTO "lab_values" ("id","lab_report_id","doctor_id","analyte","value","unit","reference","flag") VALUES('labv_lakshmi_history_4','lab_lakshmi_history_1','doc_demo','LDL cholesterol','158','mg/dL','Below 70','high');
INSERT INTO "lab_values" ("id","lab_report_id","doctor_id","analyte","value","unit","reference","flag") VALUES('labv_lakshmi_history_5','lab_lakshmi_history_2','doc_demo','LDL cholesterol','149','mg/dL','Below 70','high');
INSERT INTO "lab_values" ("id","lab_report_id","doctor_id","analyte","value","unit","reference","flag") VALUES('labv_lakshmi_history_6','lab_lakshmi_history_3','doc_demo','LDL cholesterol','141','mg/dL','Below 70','high');
INSERT INTO "lab_values" ("id","lab_report_id","doctor_id","analyte","value","unit","reference","flag") VALUES('labv_lakshmi_history_7','lab_lakshmi_history_1','doc_demo','Triglycerides','238','mg/dL','Below 150','high');
INSERT INTO "lab_values" ("id","lab_report_id","doctor_id","analyte","value","unit","reference","flag") VALUES('labv_lakshmi_history_8','lab_lakshmi_history_2','doc_demo','Triglycerides','214','mg/dL','Below 150','high');
INSERT INTO "lab_values" ("id","lab_report_id","doctor_id","analyte","value","unit","reference","flag") VALUES('labv_lakshmi_history_9','lab_lakshmi_history_3','doc_demo','Triglycerides','198','mg/dL','Below 150','high');
INSERT INTO "lab_values" ("id","lab_report_id","doctor_id","analyte","value","unit","reference","flag") VALUES('labv_lakshmi_history_10','lab_lakshmi_history_1','doc_demo','Creatinine','1.0','mg/dL','0.6-1.2','normal');
INSERT INTO "lab_values" ("id","lab_report_id","doctor_id","analyte","value","unit","reference","flag") VALUES('labv_lakshmi_history_11','lab_lakshmi_history_2','doc_demo','Creatinine','1.0','mg/dL','0.6-1.2','normal');
INSERT INTO "lab_values" ("id","lab_report_id","doctor_id","analyte","value","unit","reference","flag") VALUES('labv_lakshmi_history_12','lab_lakshmi_history_3','doc_demo','Creatinine','1.1','mg/dL','0.6-1.2','normal');
INSERT INTO "lab_values" ("id","lab_report_id","doctor_id","analyte","value","unit","reference","flag") VALUES('lv_allo_1','lab_allo_1','doc_allo','HbA1c','8.4','%','4.0-5.6','high');
INSERT INTO "lab_values" ("id","lab_report_id","doctor_id","analyte","value","unit","reference","flag") VALUES('lv_allo_2','lab_allo_1','doc_allo','Fasting glucose','168','mg/dL','70-100','high');
INSERT INTO "lab_values" ("id","lab_report_id","doctor_id","analyte","value","unit","reference","flag") VALUES('lv_allo_3','lab_allo_1','doc_allo','Creatinine','0.9','mg/dL','0.7-1.3','normal');
INSERT INTO "lab_values" ("id","lab_report_id","doctor_id","analyte","value","unit","reference","flag") VALUES('lv_allo_4','lab_allo_2','doc_allo','HbA1c','7.1','%','4.0-5.6','high');
INSERT INTO "lab_values" ("id","lab_report_id","doctor_id","analyte","value","unit","reference","flag") VALUES('lv_allo_5','lab_allo_2','doc_allo','Fasting glucose','126','mg/dL','70-100','high');
CREATE TABLE stock_items (
  id            TEXT PRIMARY KEY,
  doctor_id     TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  medicine_name TEXT NOT NULL,
  system        TEXT NOT NULL DEFAULT 'allopathy',
  form          TEXT,                   -- tablet | syrup | churna | oil
  unit          TEXT,
  reorder_level REAL NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO "stock_items" ("id","doctor_id","medicine_name","system","form","unit","reorder_level","created_at") VALUES('stock_demo_para','doc_demo','Paracetamol 500 mg','allopathy','tablet','tablet',50,'2026-09-03 19:20:36');
INSERT INTO "stock_items" ("id","doctor_id","medicine_name","system","form","unit","reorder_level","created_at") VALUES('stock_demo_ors','doc_demo','ORS sachet','allopathy','sachet','sachet',20,'2026-09-03 19:20:36');
INSERT INTO "stock_items" ("id","doctor_id","medicine_name","system","form","unit","reorder_level","created_at") VALUES('stock_demo_met','doc_demo','Metformin 500 mg','allopathy','tablet','tablet',60,'2026-09-03 19:20:36');
INSERT INTO "stock_items" ("id","doctor_id","medicine_name","system","form","unit","reorder_level","created_at") VALUES('stock_demo_cet','doc_demo','Cetirizine 10 mg','allopathy','tablet','tablet',30,'2026-09-03 19:20:36');
INSERT INTO "stock_items" ("id","doctor_id","medicine_name","system","form","unit","reorder_level","created_at") VALUES('stock_ayurcos_avip','doc_demo','Avipattikara Churna','ayurveda','churna','gram',500,'2026-09-03 19:20:41');
INSERT INTO "stock_items" ("id","doctor_id","medicine_name","system","form","unit","reorder_level","created_at") VALUES('stock_ayurcos_guduchi','doc_demo','Guduchi Ghana Vati 500 mg','ayurveda','vati','tablet',200,'2026-09-03 19:20:41');
INSERT INTO "stock_items" ("id","doctor_id","medicine_name","system","form","unit","reorder_level","created_at") VALUES('stock_ayurcos_draksha','doc_demo','Drakshasava','ayurveda','asava','ml',2000,'2026-09-03 19:20:41');
INSERT INTO "stock_items" ("id","doctor_id","medicine_name","system","form","unit","reorder_level","created_at") VALUES('stock_ayurcos_ksheer','doc_demo','Ksheerabala Taila','ayurveda','taila','bottle',8,'2026-09-03 19:20:41');
INSERT INTO "stock_items" ("id","doctor_id","medicine_name","system","form","unit","reorder_level","created_at") VALUES('stock_ayurcos_trip','doc_demo','Triphala Churna','ayurveda','churna','gram',400,'2026-09-03 19:20:41');
INSERT INTO "stock_items" ("id","doctor_id","medicine_name","system","form","unit","reorder_level","created_at") VALUES('stock_ayurcos_ashwa','doc_demo','Ashwagandha Churna','ayurveda','churna','gram',400,'2026-09-03 19:20:41');
INSERT INTO "stock_items" ("id","doctor_id","medicine_name","system","form","unit","reorder_level","created_at") VALUES('sit_homeo_1','doc_homeo','Natrum Muriaticum 200C','homeopathy','Globules','vial',5,'2026-09-03 19:20:52');
INSERT INTO "stock_items" ("id","doctor_id","medicine_name","system","form","unit","reorder_level","created_at") VALUES('sit_homeo_2','doc_homeo','Graphites 30C','homeopathy','Globules','vial',5,'2026-09-03 19:20:52');
INSERT INTO "stock_items" ("id","doctor_id","medicine_name","system","form","unit","reorder_level","created_at") VALUES('sit_homeo_3','doc_homeo','Calendula Q','homeopathy','Mother tincture','bottle',3,'2026-09-03 19:20:52');
INSERT INTO "stock_items" ("id","doctor_id","medicine_name","system","form","unit","reorder_level","created_at") VALUES('sit_homeo_4','doc_homeo','Saccharum Lactis','homeopathy','Globules','vial',10,'2026-09-03 19:20:52');
INSERT INTO "stock_items" ("id","doctor_id","medicine_name","system","form","unit","reorder_level","created_at") VALUES('sit_allo_1','doc_allo','Metformin 500mg','allopathy','Tablet','strip',20,'2026-09-03 19:20:52');
INSERT INTO "stock_items" ("id","doctor_id","medicine_name","system","form","unit","reorder_level","created_at") VALUES('sit_allo_2','doc_allo','Pantoprazole 40mg','allopathy','Tablet','strip',15,'2026-09-03 19:20:52');
INSERT INTO "stock_items" ("id","doctor_id","medicine_name","system","form","unit","reorder_level","created_at") VALUES('sit_allo_3','doc_allo','Vitamin D3 60000 IU','supplement','Sachet','sachet',10,'2026-09-03 19:20:52');
INSERT INTO "stock_items" ("id","doctor_id","medicine_name","system","form","unit","reorder_level","created_at") VALUES('sit_allo_4','doc_allo','Amoxicillin 500mg','allopathy','Capsule','strip',12,'2026-09-03 19:20:52');
CREATE TABLE stock_batches (
  id            TEXT PRIMARY KEY,
  stock_item_id TEXT NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  doctor_id     TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  batch_no      TEXT,
  expires_on    TEXT NOT NULL,
  quantity      REAL NOT NULL DEFAULT 0,
  cost_price    REAL,
  sale_price    REAL,
  received_on   TEXT NOT NULL DEFAULT (date('now'))
, quarantined_at TEXT, quarantine_reason TEXT);
INSERT INTO "stock_batches" ("id","stock_item_id","doctor_id","batch_no","expires_on","quantity","cost_price","sale_price","received_on","quarantined_at","quarantine_reason") VALUES('batch_demo_para','stock_demo_para','doc_demo','PCM-2601','2027-06-10',120,0.8,1.5,'2026-08-04',NULL,NULL);
INSERT INTO "stock_batches" ("id","stock_item_id","doctor_id","batch_no","expires_on","quantity","cost_price","sale_price","received_on","quarantined_at","quarantine_reason") VALUES('batch_demo_ors','stock_demo_ors','doc_demo','ORS-2511','2026-10-08',12,8,12,'2026-06-05',NULL,NULL);
INSERT INTO "stock_batches" ("id","stock_item_id","doctor_id","batch_no","expires_on","quantity","cost_price","sale_price","received_on","quarantined_at","quarantine_reason") VALUES('batch_demo_met','stock_demo_met','doc_demo','MET-2602','2027-10-08',45,1.2,2.1,'2026-08-09',NULL,NULL);
INSERT INTO "stock_batches" ("id","stock_item_id","doctor_id","batch_no","expires_on","quantity","cost_price","sale_price","received_on","quarantined_at","quarantine_reason") VALUES('batch_demo_cet','stock_demo_cet','doc_demo','CET-2603','2027-03-02',80,0.7,1.4,'2026-08-16',NULL,NULL);
INSERT INTO "stock_batches" ("id","stock_item_id","doctor_id","batch_no","expires_on","quantity","cost_price","sale_price","received_on","quarantined_at","quarantine_reason") VALUES('batch_ayurcos_avip','stock_ayurcos_avip','doc_demo','AVP-2604','2027-06-30',1800,0.55,0.9,'2026-08-09',NULL,NULL);
INSERT INTO "stock_batches" ("id","stock_item_id","doctor_id","batch_no","expires_on","quantity","cost_price","sale_price","received_on","quarantined_at","quarantine_reason") VALUES('batch_ayurcos_guduchi','stock_ayurcos_guduchi','doc_demo','GUD-2605','2027-10-28',420,2.1,3.5,'2026-08-16',NULL,NULL);
INSERT INTO "stock_batches" ("id","stock_item_id","doctor_id","batch_no","expires_on","quantity","cost_price","sale_price","received_on","quarantined_at","quarantine_reason") VALUES('batch_ayurcos_draksha','stock_ayurcos_draksha','doc_demo','DRA-2602','2027-04-01',4500,0.32,0.55,'2026-07-30',NULL,NULL);
INSERT INTO "stock_batches" ("id","stock_item_id","doctor_id","batch_no","expires_on","quantity","cost_price","sale_price","received_on","quarantined_at","quarantine_reason") VALUES('batch_ayurcos_ksheer','stock_ayurcos_ksheer','doc_demo','KBT-2511','2026-10-21',6,14500,22000,'2026-06-15',NULL,NULL);
INSERT INTO "stock_batches" ("id","stock_item_id","doctor_id","batch_no","expires_on","quantity","cost_price","sale_price","received_on","quarantined_at","quarantine_reason") VALUES('batch_ayurcos_trip','stock_ayurcos_trip','doc_demo','TRI-2601','2027-09-03',1500,0.42,0.75,'2026-08-04',NULL,NULL);
INSERT INTO "stock_batches" ("id","stock_item_id","doctor_id","batch_no","expires_on","quantity","cost_price","sale_price","received_on","quarantined_at","quarantine_reason") VALUES('batch_ayurcos_ashwa','stock_ayurcos_ashwa','doc_demo','ASH-2603','2027-07-30',900,0.75,1.2,'2026-08-14',NULL,NULL);
INSERT INTO "stock_batches" ("id","stock_item_id","doctor_id","batch_no","expires_on","quantity","cost_price","sale_price","received_on","quarantined_at","quarantine_reason") VALUES('bat_homeo_1','sit_homeo_1','doc_homeo','NM-2411','2027-05-01',18,4500,9000,'2026-07-05',NULL,NULL);
INSERT INTO "stock_batches" ("id","stock_item_id","doctor_id","batch_no","expires_on","quantity","cost_price","sale_price","received_on","quarantined_at","quarantine_reason") VALUES('bat_homeo_2','sit_homeo_2','doc_homeo','GR-2405','2026-10-13',9,4200,8500,'2026-06-05',NULL,NULL);
INSERT INTO "stock_batches" ("id","stock_item_id","doctor_id","batch_no","expires_on","quantity","cost_price","sale_price","received_on","quarantined_at","quarantine_reason") VALUES('bat_homeo_3','sit_homeo_3','doc_homeo','CAL-2312','2026-08-25',4,11000,19500,'2026-02-15',NULL,NULL);
INSERT INTO "stock_batches" ("id","stock_item_id","doctor_id","batch_no","expires_on","quantity","cost_price","sale_price","received_on","quarantined_at","quarantine_reason") VALUES('bat_homeo_4','sit_homeo_4','doc_homeo','SL-2502','2027-10-08',40,2000,4000,'2026-08-14',NULL,NULL);
INSERT INTO "stock_batches" ("id","stock_item_id","doctor_id","batch_no","expires_on","quantity","cost_price","sale_price","received_on","quarantined_at","quarantine_reason") VALUES('bat_allo_1','sit_allo_1','doc_allo','MET-8821','2027-06-30',64,3200,6500,'2026-07-20',NULL,NULL);
INSERT INTO "stock_batches" ("id","stock_item_id","doctor_id","batch_no","expires_on","quantity","cost_price","sale_price","received_on","quarantined_at","quarantine_reason") VALUES('bat_allo_2','sit_allo_1','doc_allo','MET-8790','2026-10-28',12,3200,6500,'2026-04-06',NULL,NULL);
INSERT INTO "stock_batches" ("id","stock_item_id","doctor_id","batch_no","expires_on","quantity","cost_price","sale_price","received_on","quarantined_at","quarantine_reason") VALUES('bat_allo_3','sit_allo_2','doc_allo','PAN-4410','2027-03-02',30,5500,11000,'2026-08-04',NULL,NULL);
INSERT INTO "stock_batches" ("id","stock_item_id","doctor_id","batch_no","expires_on","quantity","cost_price","sale_price","received_on","quarantined_at","quarantine_reason") VALUES('bat_allo_4','sit_allo_3','doc_allo','D3-7712','2028-01-16',25,1800,4500,'2026-08-19',NULL,NULL);
INSERT INTO "stock_batches" ("id","stock_item_id","doctor_id","batch_no","expires_on","quantity","cost_price","sale_price","received_on","quarantined_at","quarantine_reason") VALUES('bat_allo_5','sit_allo_4','doc_allo','AMX-3301','2026-08-13',8,4800,9500,'2026-01-06',NULL,NULL);
CREATE TABLE stock_movements (
  id            TEXT PRIMARY KEY,
  doctor_id     TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  batch_id      TEXT NOT NULL REFERENCES stock_batches(id) ON DELETE CASCADE,
  patient_id    TEXT REFERENCES patients(id) ON DELETE SET NULL,
  direction     TEXT NOT NULL,          -- in | out | adjust | expired
  quantity      REAL NOT NULL,
  reason        TEXT,
  moved_at      TEXT NOT NULL DEFAULT (datetime('now'))
, prescription_item_id TEXT, operation_id TEXT
  REFERENCES stock_operations(id) ON DELETE SET NULL);
INSERT INTO "stock_movements" ("id","doctor_id","batch_id","patient_id","direction","quantity","reason","moved_at","prescription_item_id","operation_id") VALUES('move_demo_1','doc_demo','batch_demo_para','pat_demo_rohan','out',9,'Dispensed against prescription','2026-09-02 19:20:36','rxi_demo_2',NULL);
INSERT INTO "stock_movements" ("id","doctor_id","batch_id","patient_id","direction","quantity","reason","moved_at","prescription_item_id","operation_id") VALUES('move_demo_2','doc_demo','batch_demo_cet','pat_demo_aarav','out',7,'Dispensed against prescription','2026-08-31 19:20:36','rxi_demo_5',NULL);
INSERT INTO "stock_movements" ("id","doctor_id","batch_id","patient_id","direction","quantity","reason","moved_at","prescription_item_id","operation_id") VALUES('move_demo_3','doc_demo','batch_demo_ors',NULL,'adjust',-2,'Damaged sachets removed','2026-08-30 19:20:36',NULL,NULL);
CREATE TABLE consent_grants (
  id                TEXT PRIMARY KEY,
  patient_id        TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  granted_to_doctor TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  scope             TEXT NOT NULL DEFAULT 'full_history',
  method            TEXT NOT NULL DEFAULT 'patient_otp',
  granted_at        TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at        TEXT NOT NULL,
  revoked_at        TEXT
);
CREATE TABLE consent_access_log (
  id           TEXT PRIMARY KEY,
  grant_id     TEXT NOT NULL REFERENCES consent_grants(id) ON DELETE CASCADE,
  patient_id   TEXT NOT NULL,
  reader_id    TEXT NOT NULL,           -- the doctor doing the reading
  owner_id     TEXT NOT NULL,           -- the doctor whose record was read
  record_type  TEXT NOT NULL,
  record_id    TEXT,
  accessed_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE audit_events (
  id          TEXT PRIMARY KEY,
  doctor_id   TEXT,
  actor       TEXT NOT NULL,            -- doctor:<id> | platform:<email> | system
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  detail      TEXT,
  ip          TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
, actor_user_id TEXT);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_5cd47e5b6c7d4cf5a00ee2db','doc_demo','doctor:doc_demo','sign_in',NULL,NULL,NULL,NULL,'2026-09-03 19:22:12',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_e363645f327c48d8a0e2dc74','doc_homeo','doctor:doc_homeo','sign_in',NULL,NULL,NULL,NULL,'2026-09-03 19:22:14',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_a6f93b9231f4469bba9269de','doc_allo','doctor:doc_allo','sign_in',NULL,NULL,NULL,NULL,'2026-09-03 19:22:16',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_72cd1b857cdc47aca61596f8','doc_demo','staff:usr_demo_front','sign_in',NULL,NULL,'Latha Reddy (front_desk)',NULL,'2026-09-03 19:22:18',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_ea9379bbe8d6441b8d466ffa','doc_demo','staff:usr_demo_pharmacy','sign_in',NULL,NULL,'Suresh Babu (pharmacist)',NULL,'2026-09-03 19:22:21',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_adc3b03c7cce42b29e1177d9','doc_demo','staff:usr_demo_assistant','sign_in',NULL,NULL,'Priya Nair (assistant)',NULL,'2026-09-03 19:22:24',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_ea8857dbed884040bf830b3f',NULL,'platform:admin@tcos.demo','admin_sign_in',NULL,NULL,NULL,NULL,'2026-09-03 19:22:26',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_279db996f4a24f8ca8800c73','doc_demo','doctor:doc_demo','sign_in',NULL,NULL,NULL,NULL,'2026-09-07 06:19:45',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_18a0e1082a7a49f6a6bcd516','doc_demo','doctor:doc_demo','sign_in',NULL,NULL,NULL,NULL,'2026-09-07 06:21:35',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_4920a0bf947c4de88e78a784','doc_demo','staff:usr_demo_front','sign_in',NULL,NULL,'Latha Reddy (front_desk)',NULL,'2026-09-07 06:21:41',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_a6d8123bab2f407dae35fac4','doc_demo','staff:usr_demo_pharmacy','sign_in',NULL,NULL,'Suresh Babu (pharmacist)',NULL,'2026-09-07 06:21:47',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_0eac47815a554e0a9e2737a4','doc_demo','staff:usr_demo_assistant','sign_in',NULL,NULL,'Priya Nair (assistant)',NULL,'2026-09-07 06:21:52',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_e942f46da16b4f61bfeaab0f','doc_demo','staff:usr_demo_front','sign_in',NULL,NULL,'Latha Reddy (front_desk)',NULL,'2026-09-07 06:22:06',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_c7d60818c38345f88d152a90','doc_demo','staff:usr_demo_pharmacy','sign_in',NULL,NULL,'Suresh Babu (pharmacist)',NULL,'2026-09-07 06:22:10',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_a5ab938dd0ae48249d1998a3','doc_demo','staff:usr_demo_assistant','sign_in',NULL,NULL,'Priya Nair (assistant)',NULL,'2026-09-07 06:22:13',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_520fa2806acd4bc4aaf12a4f','doc_demo','doctor:doc_demo','sign_in',NULL,NULL,NULL,NULL,'2026-09-07 06:24:17',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_d62265ad411f4487ac8a5cdd','doc_demo','doctor:doc_demo','patient_link_created','patient','pat_demo_vijay',NULL,NULL,'2026-09-07 06:25:19',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_1ba83d5687fc4b6389df075e','doc_demo','doctor:doc_demo','sign_in',NULL,NULL,NULL,NULL,'2026-09-08 04:39:02',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_56db66661abc49f4b49e81a5','doc_homeo','doctor:doc_homeo','sign_in',NULL,NULL,NULL,NULL,'2026-09-08 04:39:03',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_75fc175b5dbb4df38377036a','doc_allo','doctor:doc_allo','sign_in',NULL,NULL,NULL,NULL,'2026-09-08 04:39:04',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_19732e4cbe3e43948cbac0aa',NULL,'platform:admin@tcos.demo','admin_sign_in',NULL,NULL,NULL,NULL,'2026-09-08 04:39:05',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_e08f8acfa5134bacb06238cf','doc_demo','doctor:doc_demo','sign_in',NULL,NULL,NULL,NULL,'2026-09-08 04:40:02',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_e473d93658f6408ba55b9676','doc_demo','doctor:doc_demo','sign_in',NULL,NULL,NULL,NULL,'2026-09-08 04:40:59',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_cd834bd78d774401abfe075b','doc_demo','doctor:doc_demo','sign_in',NULL,NULL,NULL,NULL,'2026-09-08 04:45:47',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_0817d77e5e2e45609f0f3032','doc_demo','doctor:doc_demo','sign_in',NULL,NULL,NULL,NULL,'2026-09-08 04:45:49',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_4909300cacbf467f82f2bc0b','doc_demo','staff:usr_demo_front','sign_in',NULL,NULL,'Latha Reddy (front_desk)',NULL,'2026-09-08 04:45:50',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_423fb00cf47c4984bb9225a2','doc_demo','staff:usr_demo_front','sign_in',NULL,NULL,'Latha Reddy (front_desk)',NULL,'2026-09-08 04:45:52',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_895319651dd54e80ac0f3b0a',NULL,'platform:admin@tcos.demo','admin_sign_in',NULL,NULL,NULL,NULL,'2026-09-08 04:45:53',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_4134dabd35af4744aa9be927',NULL,'platform:admin@tcos.demo','admin_sign_in',NULL,NULL,NULL,NULL,'2026-09-08 04:45:54',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_786b8555fefc4ca6a5e40579','doc_demo','doctor:doc_demo','sign_in',NULL,NULL,NULL,NULL,'2026-09-08 04:48:35',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_52f7c8c0009f4c15816464bf','doc_demo','doctor:doc_demo','sign_in',NULL,NULL,NULL,NULL,'2026-09-08 04:50:26',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_60aaa44a2f594d2095988c2a','doc_demo','doctor:doc_demo','sign_in',NULL,NULL,NULL,NULL,'2026-09-08 04:51:13',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_ec93e4dad1714fabb67527bd','doc_demo','doctor:doc_demo','file_uploaded','file','fil_df4018c203b041498de6cc01','lab_report',NULL,'2026-09-08 04:51:18',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_fe0d45d7e7584646a4d9facf','doc_demo','doctor:doc_demo','sign_in',NULL,NULL,NULL,NULL,'2026-09-08 12:43:40',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_674d19a3ab114ecc85859314','doc_demo','doctor:doc_demo','sign_in',NULL,NULL,NULL,NULL,'2026-09-08 12:44:28',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_06801c1fc2c844b998bd962b','doc_demo','doctor:doc_demo','ai_document_preflight','ai_preflight','pre_560d95ed85e44f4e81d45908','same_person: Vijay',NULL,'2026-09-08 12:44:43',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_068a634d6b91480db9495d97','doc_demo','doctor:doc_demo','ai_report_read','ai_draft','draft_748d9b7a4f0f4c9c9abef84c','0 values',NULL,'2026-09-08 12:44:51',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_1d4af0a889794847bed31573','doc_demo','doctor:doc_demo','sign_in',NULL,NULL,NULL,NULL,'2026-09-08 12:48:55',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_8e5d7c2a797a4278b39fe362','doc_demo','doctor:doc_demo','ai_document_preflight','ai_preflight','pre_dc623eafef9f4237b206cac6','same_person: Vijay',NULL,'2026-09-08 12:49:04',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_14b7bdfbf9344af29727dc79','doc_demo','doctor:doc_demo','ai_report_read','ai_draft','draft_7d7cc15b35cf493eb909842f','4 values',NULL,'2026-09-08 12:49:18',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_ede939549b96499599b6b031','doc_demo','doctor:doc_demo','sign_in',NULL,NULL,NULL,NULL,'2026-09-08 14:23:34',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_f7554a4361a64e73ba1682f6','doc_homeo','doctor:doc_homeo','sign_in',NULL,NULL,NULL,NULL,'2026-09-08 14:23:51',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_98dbc8b090d0403db33eb0be','doc_allo','doctor:doc_allo','sign_in',NULL,NULL,NULL,NULL,'2026-09-08 14:24:05',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_347fe65d190d4d2eba656e2e','doc_demo','staff:usr_demo_front','sign_in',NULL,NULL,'Latha Reddy (front_desk)',NULL,'2026-09-08 14:24:21',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_8760740ff4df49f8a6625be4','doc_demo','staff:usr_demo_pharmacy','sign_in',NULL,NULL,'Suresh Babu (pharmacist)',NULL,'2026-09-08 14:24:30',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_01a81e1117924248bba549ca','doc_demo','staff:usr_demo_assistant','sign_in',NULL,NULL,'Priya Nair (assistant)',NULL,'2026-09-08 14:24:37',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_158c1f9d62c8457fa82c342a','doc_demo','doctor:doc_demo','sign_in',NULL,NULL,NULL,NULL,'2026-09-08 14:25:22',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_2007e87dee7f449ca9e062de','doc_homeo','doctor:doc_homeo','sign_in',NULL,NULL,NULL,NULL,'2026-09-08 14:25:22',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_710eeca9e8294f97803e616f','doc_demo','staff:usr_demo_pharmacy','sign_in',NULL,NULL,'Suresh Babu (pharmacist)',NULL,'2026-09-08 14:25:22',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_4a3b4fbbdf9e43cc8a9c78a2','doc_demo','staff:usr_demo_assistant','sign_in',NULL,NULL,'Priya Nair (assistant)',NULL,'2026-09-08 14:25:22',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_68dee51d11644a588b9aa67b','doc_allo','doctor:doc_allo','sign_in',NULL,NULL,NULL,NULL,'2026-09-08 14:25:22',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_a7ad5b82166f439b9eefd25f','doc_demo','staff:usr_demo_front','sign_in',NULL,NULL,'Latha Reddy (front_desk)',NULL,'2026-09-08 14:25:23',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_a087d5137e0445e3b9e70ef0',NULL,'platform:admin@tcos.demo','admin_sign_in',NULL,NULL,NULL,NULL,'2026-09-08 14:25:47',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_cefb6b4eadea421d8c6376dc',NULL,'platform:admin@tcos.demo','admin_sign_in',NULL,NULL,NULL,NULL,'2026-09-08 14:28:38',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_eadcff3b6c9b4766b1b5d9eb','doc_demo','doctor:doc_demo','sign_in',NULL,NULL,NULL,NULL,'2026-09-08 14:39:07',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_9b0bc7209d3943f1a5844530','doc_homeo','doctor:doc_homeo','sign_in',NULL,NULL,NULL,NULL,'2026-09-08 14:39:09',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_4cfab673d8af45628e379261','doc_allo','doctor:doc_allo','sign_in',NULL,NULL,NULL,NULL,'2026-09-08 14:39:11',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_7ca1fc343e234ffe8bbdd6c1','doc_demo','staff:usr_demo_front','sign_in',NULL,NULL,'Latha Reddy (front_desk)',NULL,'2026-09-08 14:39:13',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_2243fdb38b5d46579bc0f2ac',NULL,'platform:admin@tcos.demo','admin_sign_in',NULL,NULL,NULL,NULL,'2026-09-08 15:42:34',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_19e666e2696e432e91cda11f','doc_demo','doctor:doc_demo','sign_in',NULL,NULL,NULL,NULL,'2026-09-08 16:55:49',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_583cc705ec8d457c96bda0d6','doc_demo','staff:usr_demo_partner','sign_in',NULL,NULL,'Dr. Ramya Iyer (practitioner)',NULL,'2026-09-08 16:57:54',NULL);
INSERT INTO "audit_events" ("id","doctor_id","actor","action","target_type","target_id","detail","ip","created_at","actor_user_id") VALUES('aud_0de1037bdf0a4ea69472af77','doc_demo','doctor:doc_demo','sign_in',NULL,NULL,NULL,NULL,'2026-09-08 19:07:34',NULL);
CREATE TABLE usage_events (
  id              TEXT PRIMARY KEY,
  doctor_id       TEXT NOT NULL,
  event_type      TEXT NOT NULL,        -- patient_created | rx_issued | ai_run | ...
  quantity        REAL NOT NULL DEFAULT 1,
  unit            TEXT,
  provider        TEXT,
  model           TEXT,
  estimated_cost  REAL,
  idempotency_key TEXT UNIQUE,          -- stops double counting on retry
  metadata        TEXT,
  occurred_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO "usage_events" ("id","doctor_id","event_type","quantity","unit","provider","model","estimated_cost","idempotency_key","metadata","occurred_at") VALUES('use_f02c4c0addb14e93a498b3f9','doc_demo','file_stored',3187,'bytes',NULL,NULL,NULL,'idem_ad8ff101de2046d0a925e793',NULL,'2026-09-08 04:51:17');
INSERT INTO "usage_events" ("id","doctor_id","event_type","quantity","unit","provider","model","estimated_cost","idempotency_key","metadata","occurred_at") VALUES('use_ba41c6cb4af84be9a5f03214','doc_demo','ai_document_read',1,NULL,NULL,NULL,NULL,'idem_cf7d856ebec34b8d95a500c1',NULL,'2026-09-08 12:44:51');
INSERT INTO "usage_events" ("id","doctor_id","event_type","quantity","unit","provider","model","estimated_cost","idempotency_key","metadata","occurred_at") VALUES('use_8e8ace44af67444686d653ee','doc_demo','ai_document_read',1,NULL,NULL,NULL,NULL,'idem_cb6ef9ab60eb44a38ffe4934',NULL,'2026-09-08 12:49:17');
CREATE TABLE platform_team (
  email      TEXT PRIMARY KEY,
  full_name  TEXT,
  role       TEXT NOT NULL DEFAULT 'viewer',  -- owner | admin | support | finance | viewer
  added_at   TEXT NOT NULL DEFAULT (datetime('now')),
  removed_at TEXT
, password_hash TEXT, password_salt TEXT, last_sign_in_at TEXT);
INSERT INTO "platform_team" ("email","full_name","role","added_at","removed_at","password_hash","password_salt","last_sign_in_at") VALUES('admin@tcos.demo','Platform Owner (demo)','owner','2026-06-05 19:20:31',NULL,'a504bc16e0f4a0c31e30b29e4df80c9b334e18c2430b0468827c95cc40567cc9','966e55d1ad43bd574ad175c68ffa2984','2026-09-08T15:42:33.687Z');
CREATE TABLE invoices (
  id          TEXT PRIMARY KEY,
  doctor_id   TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id  TEXT NOT NULL REFERENCES patients(id),
  visit_id    TEXT,

  invoice_no  TEXT,                -- assigned on issue, never before
  status      TEXT NOT NULL DEFAULT 'draft',   -- draft | issued | cancelled
  issued_on   TEXT,

  -- all in paise
  subtotal    INTEGER NOT NULL DEFAULT 0,
  discount    INTEGER NOT NULL DEFAULT 0,
  tax_rate    REAL    NOT NULL DEFAULT 0,      -- percent, e.g. 5 or 12
  tax_amount  INTEGER NOT NULL DEFAULT 0,
  total       INTEGER NOT NULL DEFAULT 0,

  note            TEXT,
  cancelled_at    TEXT,
  cancel_reason   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO "invoices" ("id","doctor_id","patient_id","visit_id","invoice_no","status","issued_on","subtotal","discount","tax_rate","tax_amount","total","note","cancelled_at","cancel_reason","created_at") VALUES('inv_demo_1','doc_demo','pat_demo_vijay','visit_demo_vijay_2','DEMO/INV/2026/0001','issued','2026-09-01',60000,0,0,0,60000,'Consultation paid by UPI',NULL,NULL,'2026-09-03 19:20:36');
INSERT INTO "invoices" ("id","doctor_id","patient_id","visit_id","invoice_no","status","issued_on","subtotal","discount","tax_rate","tax_amount","total","note","cancelled_at","cancel_reason","created_at") VALUES('inv_demo_2','doc_demo','pat_demo_rohan','visit_demo_rohan','DEMO/INV/2026/0002','issued','2026-09-02',54000,4000,0,0,50000,'Consultation and medicines',NULL,NULL,'2026-09-03 19:20:36');
INSERT INTO "invoices" ("id","doctor_id","patient_id","visit_id","invoice_no","status","issued_on","subtotal","discount","tax_rate","tax_amount","total","note","cancelled_at","cancel_reason","created_at") VALUES('inv_demo_3','doc_demo','pat_demo_meera','visit_demo_meera','DEMO/INV/2026/0003','issued','2026-08-24',90000,0,0,0,90000,'Partial payment received',NULL,NULL,'2026-09-03 19:20:36');
INSERT INTO "invoices" ("id","doctor_id","patient_id","visit_id","invoice_no","status","issued_on","subtotal","discount","tax_rate","tax_amount","total","note","cancelled_at","cancel_reason","created_at") VALUES('inv_demo_4','doc_demo','pat_demo_aarav','visit_demo_aarav','DEMO/INV/2026/0004','issued','2026-08-31',65000,0,0,0,65000,NULL,NULL,NULL,'2026-09-03 19:20:36');
INSERT INTO "invoices" ("id","doctor_id","patient_id","visit_id","invoice_no","status","issued_on","subtotal","discount","tax_rate","tax_amount","total","note","cancelled_at","cancel_reason","created_at") VALUES('inv_demo_cardio','doc_demo','pat_demo_lakshmi','visit_demo_cardio','DEMO/INV/2026/0015','issued','2026-08-30',180000,10000,0,0,170000,'Consultation, ECG and medicines',NULL,NULL,'2026-09-03 19:20:44');
INSERT INTO "invoices" ("id","doctor_id","patient_id","visit_id","invoice_no","status","issued_on","subtotal","discount","tax_rate","tax_amount","total","note","cancelled_at","cancel_reason","created_at") VALUES('inv_homeo_1','doc_homeo','pat_homeo_1','vis_homeo_1','HOMO/INV/2026/0001','issued','2026-07-01',80000,0,0,0,80000,NULL,NULL,NULL,'2026-09-03 19:20:52');
INSERT INTO "invoices" ("id","doctor_id","patient_id","visit_id","invoice_no","status","issued_on","subtotal","discount","tax_rate","tax_amount","total","note","cancelled_at","cancel_reason","created_at") VALUES('inv_homeo_2','doc_homeo','pat_homeo_2','vis_homeo_3','HOMO/INV/2026/0002','issued','2026-08-21',53500,3500,0,0,50000,NULL,NULL,NULL,'2026-09-03 19:20:52');
INSERT INTO "invoices" ("id","doctor_id","patient_id","visit_id","invoice_no","status","issued_on","subtotal","discount","tax_rate","tax_amount","total","note","cancelled_at","cancel_reason","created_at") VALUES('inv_allo_1','doc_allo','pat_allo_1','vis_allo_1','ALO/INV/2026/0001','issued','2026-07-25',95000,0,0,0,95000,NULL,NULL,NULL,'2026-09-03 19:20:52');
INSERT INTO "invoices" ("id","doctor_id","patient_id","visit_id","invoice_no","status","issued_on","subtotal","discount","tax_rate","tax_amount","total","note","cancelled_at","cancel_reason","created_at") VALUES('inv_allo_2','doc_allo','pat_demo_vijay','vis_allo_3','ALO/INV/2026/0002','issued','2026-08-30',67000,0,0,0,67000,NULL,NULL,NULL,'2026-09-03 19:20:52');
CREATE TABLE invoice_items (
  id          TEXT PRIMARY KEY,
  invoice_id  TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  doctor_id   TEXT NOT NULL,       -- denormalised so isolation holds on this table too
  kind        TEXT NOT NULL DEFAULT 'other',  -- consultation | medicine | procedure | lab | other
  description TEXT NOT NULL,
  quantity    REAL    NOT NULL DEFAULT 1,
  unit_price  INTEGER NOT NULL DEFAULT 0,     -- paise
  amount      INTEGER NOT NULL DEFAULT 0,     -- paise
  sort_order  INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "invoice_items" ("id","invoice_id","doctor_id","kind","description","quantity","unit_price","amount","sort_order") VALUES('invi_demo_1','inv_demo_1','doc_demo','consultation','Follow-up consultation',1,60000,60000,1);
INSERT INTO "invoice_items" ("id","invoice_id","doctor_id","kind","description","quantity","unit_price","amount","sort_order") VALUES('invi_demo_2','inv_demo_2','doc_demo','consultation','General consultation',1,50000,50000,1);
INSERT INTO "invoice_items" ("id","invoice_id","doctor_id","kind","description","quantity","unit_price","amount","sort_order") VALUES('invi_demo_3','inv_demo_2','doc_demo','medicine','Medicines dispensed',1,4000,4000,2);
INSERT INTO "invoice_items" ("id","invoice_id","doctor_id","kind","description","quantity","unit_price","amount","sort_order") VALUES('invi_demo_4','inv_demo_3','doc_demo','consultation','Diabetes review',1,70000,70000,1);
INSERT INTO "invoice_items" ("id","invoice_id","doctor_id","kind","description","quantity","unit_price","amount","sort_order") VALUES('invi_demo_5','inv_demo_3','doc_demo','lab','Point-of-care testing',1,20000,20000,2);
INSERT INTO "invoice_items" ("id","invoice_id","doctor_id","kind","description","quantity","unit_price","amount","sort_order") VALUES('invi_demo_6','inv_demo_4','doc_demo','consultation','General consultation',1,65000,65000,1);
INSERT INTO "invoice_items" ("id","invoice_id","doctor_id","kind","description","quantity","unit_price","amount","sort_order") VALUES('invi_cardio_1','inv_demo_cardio','doc_demo','consultation','Cardiac follow-up consultation',1,80000,80000,1);
INSERT INTO "invoice_items" ("id","invoice_id","doctor_id","kind","description","quantity","unit_price","amount","sort_order") VALUES('invi_cardio_2','inv_demo_cardio','doc_demo','procedure','ECG',1,50000,50000,2);
INSERT INTO "invoice_items" ("id","invoice_id","doctor_id","kind","description","quantity","unit_price","amount","sort_order") VALUES('invi_cardio_3','inv_demo_cardio','doc_demo','medicine','Medicines dispensed',1,50000,50000,3);
INSERT INTO "invoice_items" ("id","invoice_id","doctor_id","kind","description","quantity","unit_price","amount","sort_order") VALUES('ivi_homeo_1','inv_homeo_1','doc_homeo','fee','First consultation - detailed case taking',1,65000,65000,1);
INSERT INTO "invoice_items" ("id","invoice_id","doctor_id","kind","description","quantity","unit_price","amount","sort_order") VALUES('ivi_homeo_2','inv_homeo_1','doc_homeo','medicine','Natrum Muriaticum 200C',1,9000,9000,2);
INSERT INTO "invoice_items" ("id","invoice_id","doctor_id","kind","description","quantity","unit_price","amount","sort_order") VALUES('ivi_homeo_3','inv_homeo_1','doc_homeo','medicine','Saccharum Lactis',1,4000,4000,3);
INSERT INTO "invoice_items" ("id","invoice_id","doctor_id","kind","description","quantity","unit_price","amount","sort_order") VALUES('ivi_homeo_4','inv_homeo_1','doc_homeo','fee','Records and follow-up plan',1,2000,2000,4);
INSERT INTO "invoice_items" ("id","invoice_id","doctor_id","kind","description","quantity","unit_price","amount","sort_order") VALUES('ivi_homeo_5','inv_homeo_2','doc_homeo','fee','Follow-up consultation',1,35000,35000,1);
INSERT INTO "invoice_items" ("id","invoice_id","doctor_id","kind","description","quantity","unit_price","amount","sort_order") VALUES('ivi_homeo_6','inv_homeo_2','doc_homeo','medicine','Graphites 30C',1,8500,8500,2);
INSERT INTO "invoice_items" ("id","invoice_id","doctor_id","kind","description","quantity","unit_price","amount","sort_order") VALUES('ivi_homeo_7','inv_homeo_2','doc_homeo','medicine','Calendula Q',1,10000,10000,3);
INSERT INTO "invoice_items" ("id","invoice_id","doctor_id","kind","description","quantity","unit_price","amount","sort_order") VALUES('ivi_allo_1','inv_allo_1','doc_allo','fee','First consultation',1,60000,60000,1);
INSERT INTO "invoice_items" ("id","invoice_id","doctor_id","kind","description","quantity","unit_price","amount","sort_order") VALUES('ivi_allo_2','inv_allo_1','doc_allo','medicine','Metformin 500mg - 30 tablets',3,6500,19500,2);
INSERT INTO "invoice_items" ("id","invoice_id","doctor_id","kind","description","quantity","unit_price","amount","sort_order") VALUES('ivi_allo_3','inv_allo_1','doc_allo','medicine','Vitamin D3 60000 IU',2,4500,9000,3);
INSERT INTO "invoice_items" ("id","invoice_id","doctor_id","kind","description","quantity","unit_price","amount","sort_order") VALUES('ivi_allo_4','inv_allo_1','doc_allo','fee','Dressing and consumables',1,6500,6500,4);
INSERT INTO "invoice_items" ("id","invoice_id","doctor_id","kind","description","quantity","unit_price","amount","sort_order") VALUES('ivi_allo_5','inv_allo_2','doc_allo','fee','First consultation',1,56000,56000,1);
INSERT INTO "invoice_items" ("id","invoice_id","doctor_id","kind","description","quantity","unit_price","amount","sort_order") VALUES('ivi_allo_6','inv_allo_2','doc_allo','medicine','Pantoprazole 40mg - 14 tablets',1,11000,11000,2);
CREATE TABLE payments (
  id          TEXT PRIMARY KEY,
  invoice_id  TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  doctor_id   TEXT NOT NULL,
  amount      INTEGER NOT NULL,    -- paise
  method      TEXT NOT NULL,       -- cash | upi | card | bank | other
  reference   TEXT,                -- UPI ref, last four digits, cheque no
  received_on TEXT NOT NULL,
  received_by TEXT,                -- clinic_users.id, or null for the doctor
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
, idempotency_key TEXT);
INSERT INTO "payments" ("id","invoice_id","doctor_id","amount","method","reference","received_on","received_by","created_at","idempotency_key") VALUES('pay_demo_1','inv_demo_1','doc_demo',60000,'upi','UPI-DEMO-4102','2026-09-01','usr_demo_front','2026-09-03 19:20:36',NULL);
INSERT INTO "payments" ("id","invoice_id","doctor_id","amount","method","reference","received_on","received_by","created_at","idempotency_key") VALUES('pay_demo_2','inv_demo_2','doc_demo',50000,'cash',NULL,'2026-09-02','usr_demo_front','2026-09-03 19:20:36',NULL);
INSERT INTO "payments" ("id","invoice_id","doctor_id","amount","method","reference","received_on","received_by","created_at","idempotency_key") VALUES('pay_demo_3','inv_demo_3','doc_demo',50000,'card','CARD-8842','2026-08-24','usr_demo_front','2026-09-03 19:20:36',NULL);
INSERT INTO "payments" ("id","invoice_id","doctor_id","amount","method","reference","received_on","received_by","created_at","idempotency_key") VALUES('pay_demo_4','inv_demo_4','doc_demo',65000,'upi','UPI-DEMO-4118','2026-08-31','usr_demo_front','2026-09-03 19:20:36',NULL);
INSERT INTO "payments" ("id","invoice_id","doctor_id","amount","method","reference","received_on","received_by","created_at","idempotency_key") VALUES('pay_demo_cardio_1','inv_demo_cardio','doc_demo',100000,'card','VISA •••• 4281','2026-08-30','usr_demo_front','2026-09-03 19:20:44',NULL);
INSERT INTO "payments" ("id","invoice_id","doctor_id","amount","method","reference","received_on","received_by","created_at","idempotency_key") VALUES('pay_demo_cardio_2','inv_demo_cardio','doc_demo',70000,'upi','UPI-QR-DEMO-98214','2026-08-30','usr_demo_front','2026-09-03 19:20:44',NULL);
INSERT INTO "payments" ("id","invoice_id","doctor_id","amount","method","reference","received_on","received_by","created_at","idempotency_key") VALUES('pay_homeo_1','inv_homeo_1','doc_homeo',80000,'upi','UPI-4471102','2026-07-01','doc_homeo','2026-09-03 19:20:52',NULL);
INSERT INTO "payments" ("id","invoice_id","doctor_id","amount","method","reference","received_on","received_by","created_at","idempotency_key") VALUES('pay_homeo_2','inv_homeo_2','doc_homeo',50000,'cash',NULL,'2026-08-21','doc_homeo','2026-09-03 19:20:52',NULL);
INSERT INTO "payments" ("id","invoice_id","doctor_id","amount","method","reference","received_on","received_by","created_at","idempotency_key") VALUES('pay_allo_1','inv_allo_1','doc_allo',95000,'card','CARD-8890','2026-07-25','doc_allo','2026-09-03 19:20:52',NULL);
INSERT INTO "payments" ("id","invoice_id","doctor_id","amount","method","reference","received_on","received_by","created_at","idempotency_key") VALUES('pay_allo_2','inv_allo_2','doc_allo',67000,'upi','UPI-9902314','2026-08-30','doc_allo','2026-09-03 19:20:52',NULL);
CREATE TABLE invoice_sequences (
  doctor_id TEXT NOT NULL,
  year      INTEGER NOT NULL,
  next_no   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (doctor_id, year)
);
INSERT INTO "invoice_sequences" ("doctor_id","year","next_no") VALUES('doc_demo',2026,4);
INSERT INTO "invoice_sequences" ("doctor_id","year","next_no") VALUES('doc_homeo',2026,3);
INSERT INTO "invoice_sequences" ("doctor_id","year","next_no") VALUES('doc_allo',2026,3);
CREATE TABLE fee_items (
  id          TEXT PRIMARY KEY,
  doctor_id   TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL DEFAULT 'consultation',
  description TEXT NOT NULL,
  unit_price  INTEGER NOT NULL DEFAULT 0,   -- paise
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO "fee_items" ("id","doctor_id","kind","description","unit_price","active","created_at") VALUES('fee_demo_1','doc_demo','consultation','Ayurveda consultation',70000,1,'2026-09-03 19:20:36');
INSERT INTO "fee_items" ("id","doctor_id","kind","description","unit_price","active","created_at") VALUES('fee_demo_2','doc_demo','consultation','Ayurveda follow-up',50000,1,'2026-09-03 19:20:36');
INSERT INTO "fee_items" ("id","doctor_id","kind","description","unit_price","active","created_at") VALUES('fee_demo_3','doc_demo','procedure','Nadi Pariksha',35000,1,'2026-09-03 19:20:36');
INSERT INTO "fee_items" ("id","doctor_id","kind","description","unit_price","active","created_at") VALUES('fee_homeo_1','doc_homeo','fee','First consultation - detailed case taking',65000,1,'2026-09-03 19:20:52');
INSERT INTO "fee_items" ("id","doctor_id","kind","description","unit_price","active","created_at") VALUES('fee_homeo_2','doc_homeo','fee','Follow-up consultation',35000,1,'2026-09-03 19:20:52');
INSERT INTO "fee_items" ("id","doctor_id","kind","description","unit_price","active","created_at") VALUES('fee_homeo_3','doc_homeo','fee','Repertorisation review',25000,1,'2026-09-03 19:20:52');
INSERT INTO "fee_items" ("id","doctor_id","kind","description","unit_price","active","created_at") VALUES('fee_allo_1','doc_allo','fee','First consultation',60000,1,'2026-09-03 19:20:52');
INSERT INTO "fee_items" ("id","doctor_id","kind","description","unit_price","active","created_at") VALUES('fee_allo_2','doc_allo','fee','Follow-up consultation',30000,1,'2026-09-03 19:20:52');
INSERT INTO "fee_items" ("id","doctor_id","kind","description","unit_price","active","created_at") VALUES('fee_allo_3','doc_allo','fee','Dressing and consumables',6500,1,'2026-09-03 19:20:52');
INSERT INTO "fee_items" ("id","doctor_id","kind","description","unit_price","active","created_at") VALUES('fee_allo_4','doc_allo','fee','Injection administration',15000,1,'2026-09-03 19:20:52');
CREATE TABLE IF NOT EXISTS "d1_migrations"(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(1,'001-platform-admin.sql','2026-09-03 19:19:07');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(2,'002-prescriptions-and-pharmacy.sql','2026-09-03 19:19:08');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(3,'003-patient-access.sql','2026-09-03 19:19:08');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(4,'004-household-identity.sql','2026-09-03 19:19:09');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(5,'005-appointments.sql','2026-09-03 19:19:09');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(6,'006-public-page.sql','2026-09-03 19:19:10');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(7,'007-drug-catalogue.sql','2026-09-03 19:19:10');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(8,'008-patient-numbers.sql','2026-09-03 19:19:10');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(9,'009-clinic-users.sql','2026-09-03 19:19:11');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(10,'010-billing.sql','2026-09-03 19:19:11');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(11,'011-operations-and-support.sql','2026-09-03 19:19:12');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(12,'012-products.sql','2026-09-03 19:19:12');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(13,'013-doctor-applications.sql','2026-09-03 19:19:13');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(14,'014-verification-tiers.sql','2026-09-03 19:19:13');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(15,'015-schedule-and-closures.sql','2026-09-03 19:19:13');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(16,'016-custom-domains.sql','2026-09-03 19:20:06');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(17,'017-product-name-fix.sql','2026-09-03 19:20:06');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(18,'018-practitioners.sql','2026-09-03 19:20:07');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(19,'019-cost-tracking.sql','2026-09-03 19:20:07');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(20,'020-plan-limits.sql','2026-09-03 19:20:07');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(21,'021-grace-period.sql','2026-09-03 19:20:08');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(22,'022-files.sql','2026-09-03 19:20:08');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(23,'023-ai-drafts.sql','2026-09-03 19:20:08');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(24,'024-ai-preflight.sql','2026-09-03 19:20:09');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(25,'025-repair-mobile-format.sql','2026-09-08 04:20:48');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(26,'026-ai-spend-guard.sql','2026-09-08 04:20:48');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(27,'027-batch-reading.sql','2026-09-08 04:20:49');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(28,'028-abdm-identity.sql','2026-09-08 04:20:49');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(29,'029-verification-deadline.sql','2026-09-08 04:20:49');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(30,'030-plans-from-market-research.sql','2026-09-08 04:20:50');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(31,'031-whatsapp.sql','2026-09-08 04:20:50');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(32,'032-repair-patient-sequences.sql','2026-09-08 04:20:51');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(33,'033-drug-catalogue-core.sql','2026-09-08 04:20:51');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(34,'034-consultation-notes.sql','2026-09-08 04:20:52');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(35,'035-scribe-speakers.sql','2026-09-08 04:20:52');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(36,'036-ai-provider-file-cleanup.sql','2026-09-08 04:20:53');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(37,'037-doctor-council.sql','2026-09-08 15:33:44');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(38,'038-subscriptions.sql','2026-09-08 15:33:44');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(39,'039-lab-report-provenance.sql','2026-09-08 16:15:49');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(40,'040-payment-idempotency.sql','2026-09-08 16:15:49');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(41,'041-appointment-request-idempotency.sql','2026-09-08 16:15:50');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(42,'042-stock-operations.sql','2026-09-08 16:52:30');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(43,'043-patient-registration-operations.sql','2026-09-08 16:52:31');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(44,'044-consultation-idempotency.sql','2026-09-08 16:52:31');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(45,'045-access-security.sql','2026-09-08 19:05:53');
CREATE TABLE admin_sessions (
  token_hash TEXT PRIMARY KEY,
  email      TEXT NOT NULL REFERENCES platform_team(email) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  user_agent TEXT,
  revoked_at TEXT
);
INSERT INTO "admin_sessions" ("token_hash","email","created_at","expires_at","user_agent","revoked_at") VALUES('184360bf596450c6f5611bd7532d31cc5537303279d9f1f2366b09e05c52d913','admin@tcos.demo','2026-09-03 19:22:26','2026-09-04T03:22:25.937Z','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-IN) PowerShell/7.6.4','2026-09-03T19:22:28.593Z');
INSERT INTO "admin_sessions" ("token_hash","email","created_at","expires_at","user_agent","revoked_at") VALUES('e99858c0f00d861b47930a708e8ee2de2b3e4b9a8df92abb6b1794bb4f537d90','admin@tcos.demo','2026-09-08 04:39:05','2026-09-08T12:39:05.034Z','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-IN) PowerShell/7.6.5',NULL);
INSERT INTO "admin_sessions" ("token_hash","email","created_at","expires_at","user_agent","revoked_at") VALUES('d5d5fb3e521acede9a37bdcbb571768c2cc2768ee169a917023a00be3aab8a8b','admin@tcos.demo','2026-09-08 04:45:53','2026-09-08T12:45:53.474Z','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-IN) PowerShell/7.6.5',NULL);
INSERT INTO "admin_sessions" ("token_hash","email","created_at","expires_at","user_agent","revoked_at") VALUES('1a4732fcdc3a1506a322156b835f2d896d6372681e493e59f547fd640a6a8c02','admin@tcos.demo','2026-09-08 04:45:54','2026-09-08T12:45:54.343Z','Mozilla/5.0 (Windows NT 10.0; Microsoft Windows 10.0.26200; en-IN) PowerShell/7.6.5',NULL);
INSERT INTO "admin_sessions" ("token_hash","email","created_at","expires_at","user_agent","revoked_at") VALUES('db3182a796ad80c742da88bba5f8e50aba5b7c9027d2890b9fb66841ae5e2c8e','admin@tcos.demo','2026-09-08 14:25:47','2026-09-08T22:25:47.387Z','node','2026-09-08T14:25:57.043Z');
INSERT INTO "admin_sessions" ("token_hash","email","created_at","expires_at","user_agent","revoked_at") VALUES('b003e36fdfb74794a496a5f337dfa2ebce2dcca8a98d6576b868ebd7dc9b772d','admin@tcos.demo','2026-09-08 14:28:38','2026-09-08T22:28:38.332Z','node','2026-09-08T14:28:39.562Z');
INSERT INTO "admin_sessions" ("token_hash","email","created_at","expires_at","user_agent","revoked_at") VALUES('5efbd29ff253ba771c486715fa997bb62f06967876594d7b4cda40a1f07c5650','admin@tcos.demo','2026-09-08 15:42:34','2026-09-08T23:42:33.877Z','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',NULL);
CREATE TABLE doctor_invites (
  id            TEXT PRIMARY KEY,
  doctor_id     TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  invited_by    TEXT NOT NULL,
  identifier    TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  first_used_at TEXT
);
CREATE TABLE rx_sequences (
  doctor_id TEXT NOT NULL,
  year      INTEGER NOT NULL,
  next_no   INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (doctor_id, year)
);
INSERT INTO "rx_sequences" ("doctor_id","year","next_no") VALUES('doc_demo',2026,16);
INSERT INTO "rx_sequences" ("doctor_id","year","next_no") VALUES('doc_homeo',2026,3);
INSERT INTO "rx_sequences" ("doctor_id","year","next_no") VALUES('doc_allo',2026,3);
CREATE TABLE patient_access_links (
  id             TEXT PRIMARY KEY,
  token_hash     TEXT NOT NULL UNIQUE,
  patient_id     TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id      TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  created_by     TEXT NOT NULL,
  requires_otp   INTEGER NOT NULL DEFAULT 0,  
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at     TEXT NOT NULL,
  revoked_at     TEXT,
  opened_count   INTEGER NOT NULL DEFAULT 0,
  last_opened_at TEXT
);
INSERT INTO "patient_access_links" ("id","token_hash","patient_id","doctor_id","created_by","requires_otp","created_at","expires_at","revoked_at","opened_count","last_opened_at") VALUES('pal_demo_vijay','aff9063d61e75654d8b050ba9e0050323192562538a0d9c63753dc84334bd398','pat_demo_vijay','doc_demo','doc_demo',0,'2026-09-03 19:20:36','2027-09-03 19:20:36',NULL,0,NULL);
INSERT INTO "patient_access_links" ("id","token_hash","patient_id","doctor_id","created_by","requires_otp","created_at","expires_at","revoked_at","opened_count","last_opened_at") VALUES('pal_demo_lakshmi','cbd023bd61f94c3bc2df5134dff587e7ee5abaeb53ae00a8fb1e904c61ca4409','pat_demo_lakshmi','doc_demo','doc_demo',0,'2026-09-03 19:20:48','2027-09-03 19:20:48',NULL,0,NULL);
INSERT INTO "patient_access_links" ("id","token_hash","patient_id","doctor_id","created_by","requires_otp","created_at","expires_at","revoked_at","opened_count","last_opened_at") VALUES('pal_09273c1b69b94075959752a2','ab883741092e157105aed4c38b5dcc5ec163fb6e2f53e7f8ece0088fd3fe4c83','pat_demo_vijay','doc_demo','doc_demo',0,'2026-09-07 06:25:18','2026-12-06T06:25:18.779Z',NULL,0,NULL);
CREATE TABLE IF NOT EXISTS "patients" (
  id              TEXT PRIMARY KEY,
  patient_code    TEXT UNIQUE,          
  mobile          TEXT NOT NULL,        
  mobile_verified INTEGER NOT NULL DEFAULT 0,
  full_name       TEXT NOT NULL,
  sex             TEXT,
  date_of_birth   TEXT,
  blood_group     TEXT,
  relation        TEXT,                 
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
, abha_number TEXT, abha_address TEXT, abha_status TEXT NOT NULL DEFAULT 'unverified', abha_verified_at TEXT, whatsapp_opt_in INTEGER NOT NULL DEFAULT 0, whatsapp_opt_in_at TEXT, whatsapp_opted_out_at TEXT);
INSERT INTO "patients" ("id","patient_code","mobile","mobile_verified","full_name","sex","date_of_birth","blood_group","relation","created_at","abha_number","abha_address","abha_status","abha_verified_at","whatsapp_opt_in","whatsapp_opt_in_at","whatsapp_opted_out_at") VALUES('pat_demo_vijay',NULL,'+919333300001',1,'Vijay','male','1990-06-12','B+',NULL,'2026-05-06 19:20:36',NULL,NULL,'unverified',NULL,0,NULL,NULL);
INSERT INTO "patients" ("id","patient_code","mobile","mobile_verified","full_name","sex","date_of_birth","blood_group","relation","created_at","abha_number","abha_address","abha_status","abha_verified_at","whatsapp_opt_in","whatsapp_opt_in_at","whatsapp_opted_out_at") VALUES('pat_demo_ananya',NULL,'+919333300002',1,'Ananya Reddy','female','1985-03-22','O+',NULL,'2026-05-26 19:20:36',NULL,NULL,'unverified',NULL,0,NULL,NULL);
INSERT INTO "patients" ("id","patient_code","mobile","mobile_verified","full_name","sex","date_of_birth","blood_group","relation","created_at","abha_number","abha_address","abha_status","abha_verified_at","whatsapp_opt_in","whatsapp_opt_in_at","whatsapp_opted_out_at") VALUES('pat_demo_rohan',NULL,'+919333300003',1,'Rohan Kumar','male','2012-09-08','A+',NULL,'2026-06-20 19:20:36',NULL,NULL,'unverified',NULL,0,NULL,NULL);
INSERT INTO "patients" ("id","patient_code","mobile","mobile_verified","full_name","sex","date_of_birth","blood_group","relation","created_at","abha_number","abha_address","abha_status","abha_verified_at","whatsapp_opt_in","whatsapp_opt_in_at","whatsapp_opted_out_at") VALUES('pat_demo_meera',NULL,'+919333300004',1,'Meera Shah','female','1964-11-17','AB+',NULL,'2026-07-05 19:20:36',NULL,NULL,'unverified',NULL,0,NULL,NULL);
INSERT INTO "patients" ("id","patient_code","mobile","mobile_verified","full_name","sex","date_of_birth","blood_group","relation","created_at","abha_number","abha_address","abha_status","abha_verified_at","whatsapp_opt_in","whatsapp_opt_in_at","whatsapp_opted_out_at") VALUES('pat_demo_aarav',NULL,'+919333300005',1,'Aarav Patel','male','1998-01-30','O-',NULL,'2026-08-09 19:20:36',NULL,NULL,'unverified',NULL,0,NULL,NULL);
INSERT INTO "patients" ("id","patient_code","mobile","mobile_verified","full_name","sex","date_of_birth","blood_group","relation","created_at","abha_number","abha_address","abha_status","abha_verified_at","whatsapp_opt_in","whatsapp_opt_in_at","whatsapp_opted_out_at") VALUES('pat_demo_lakshmi',NULL,'+919333300006',1,'Lakshmi Devi','female','1957-04-18','B+',NULL,'2026-01-06 19:20:44',NULL,NULL,'unverified',NULL,0,NULL,NULL);
INSERT INTO "patients" ("id","patient_code","mobile","mobile_verified","full_name","sex","date_of_birth","blood_group","relation","created_at","abha_number","abha_address","abha_status","abha_verified_at","whatsapp_opt_in","whatsapp_opt_in_at","whatsapp_opted_out_at") VALUES('pat_demo_arjun',NULL,'+919333300007',1,'Arjun Varma','male','1978-02-11','O+',NULL,'2026-03-17 19:20:44',NULL,NULL,'unverified',NULL,0,NULL,NULL);
INSERT INTO "patients" ("id","patient_code","mobile","mobile_verified","full_name","sex","date_of_birth","blood_group","relation","created_at","abha_number","abha_address","abha_status","abha_verified_at","whatsapp_opt_in","whatsapp_opt_in_at","whatsapp_opted_out_at") VALUES('pat_demo_fatima',NULL,'+919333300008',1,'Fatima Begum','female','1992-08-05','A+',NULL,'2026-04-06 19:20:44',NULL,NULL,'unverified',NULL,0,NULL,NULL);
INSERT INTO "patients" ("id","patient_code","mobile","mobile_verified","full_name","sex","date_of_birth","blood_group","relation","created_at","abha_number","abha_address","abha_status","abha_verified_at","whatsapp_opt_in","whatsapp_opt_in_at","whatsapp_opted_out_at") VALUES('pat_demo_kiran',NULL,'+919333300009',1,'Kiran Rao','male','2001-12-20','B-',NULL,'2026-04-26 19:20:44',NULL,NULL,'unverified',NULL,0,NULL,NULL);
INSERT INTO "patients" ("id","patient_code","mobile","mobile_verified","full_name","sex","date_of_birth","blood_group","relation","created_at","abha_number","abha_address","abha_status","abha_verified_at","whatsapp_opt_in","whatsapp_opt_in_at","whatsapp_opted_out_at") VALUES('pat_demo_savita',NULL,'+919333300010',1,'Savita Iyer','female','1969-07-03','O+',NULL,'2026-05-16 19:20:44',NULL,NULL,'unverified',NULL,0,NULL,NULL);
INSERT INTO "patients" ("id","patient_code","mobile","mobile_verified","full_name","sex","date_of_birth","blood_group","relation","created_at","abha_number","abha_address","abha_status","abha_verified_at","whatsapp_opt_in","whatsapp_opt_in_at","whatsapp_opted_out_at") VALUES('pat_demo_mahesh',NULL,'+919333300011',1,'Mahesh Babu','male','1982-10-27','A-',NULL,'2026-06-05 19:20:44',NULL,NULL,'unverified',NULL,0,NULL,NULL);
INSERT INTO "patients" ("id","patient_code","mobile","mobile_verified","full_name","sex","date_of_birth","blood_group","relation","created_at","abha_number","abha_address","abha_status","abha_verified_at","whatsapp_opt_in","whatsapp_opt_in_at","whatsapp_opted_out_at") VALUES('pat_demo_nisha',NULL,'+919333300012',1,'Nisha Kapoor','female','1996-05-14','AB+',NULL,'2026-06-25 19:20:44',NULL,NULL,'unverified',NULL,0,NULL,NULL);
INSERT INTO "patients" ("id","patient_code","mobile","mobile_verified","full_name","sex","date_of_birth","blood_group","relation","created_at","abha_number","abha_address","abha_status","abha_verified_at","whatsapp_opt_in","whatsapp_opt_in_at","whatsapp_opted_out_at") VALUES('pat_demo_rahul',NULL,'+919333300013',1,'Rahul Reddy','male','1988-09-09','O+',NULL,'2026-07-10 19:20:44',NULL,NULL,'unverified',NULL,0,NULL,NULL);
INSERT INTO "patients" ("id","patient_code","mobile","mobile_verified","full_name","sex","date_of_birth","blood_group","relation","created_at","abha_number","abha_address","abha_status","abha_verified_at","whatsapp_opt_in","whatsapp_opt_in_at","whatsapp_opted_out_at") VALUES('pat_demo_leela',NULL,'+919333300014',1,'Leela Nair','female','1952-01-25','A+',NULL,'2026-07-20 19:20:44',NULL,NULL,'unverified',NULL,0,NULL,NULL);
INSERT INTO "patients" ("id","patient_code","mobile","mobile_verified","full_name","sex","date_of_birth","blood_group","relation","created_at","abha_number","abha_address","abha_status","abha_verified_at","whatsapp_opt_in","whatsapp_opt_in_at","whatsapp_opted_out_at") VALUES('pat_demo_aditya',NULL,'+919333300015',1,'Aditya Singh','male','2016-06-16','B+',NULL,'2026-08-04 19:20:44',NULL,NULL,'unverified',NULL,0,NULL,NULL);
INSERT INTO "patients" ("id","patient_code","mobile","mobile_verified","full_name","sex","date_of_birth","blood_group","relation","created_at","abha_number","abha_address","abha_status","abha_verified_at","whatsapp_opt_in","whatsapp_opt_in_at","whatsapp_opted_out_at") VALUES('pat_homeo_1',NULL,'+919444400001',1,'Devika Menon','female','1979-04-19','A+',NULL,'2026-07-01 19:20:52',NULL,NULL,'unverified',NULL,0,NULL,NULL);
INSERT INTO "patients" ("id","patient_code","mobile","mobile_verified","full_name","sex","date_of_birth","blood_group","relation","created_at","abha_number","abha_address","abha_status","abha_verified_at","whatsapp_opt_in","whatsapp_opt_in_at","whatsapp_opted_out_at") VALUES('pat_homeo_2',NULL,'+919444400002',1,'Joseph Thomas','male','1966-12-02','B+',NULL,'2026-07-13 19:20:52',NULL,NULL,'unverified',NULL,0,NULL,NULL);
INSERT INTO "patients" ("id","patient_code","mobile","mobile_verified","full_name","sex","date_of_birth","blood_group","relation","created_at","abha_number","abha_address","abha_status","abha_verified_at","whatsapp_opt_in","whatsapp_opt_in_at","whatsapp_opted_out_at") VALUES('pat_homeo_3',NULL,'+919444400003',1,'Anjali Pillai','female','2009-07-25','O+',NULL,'2026-08-03 19:20:52',NULL,NULL,'unverified',NULL,0,NULL,NULL);
INSERT INTO "patients" ("id","patient_code","mobile","mobile_verified","full_name","sex","date_of_birth","blood_group","relation","created_at","abha_number","abha_address","abha_status","abha_verified_at","whatsapp_opt_in","whatsapp_opt_in_at","whatsapp_opted_out_at") VALUES('pat_allo_1',NULL,'+919555500001',1,'Sanjay Deshmukh','male','1971-02-14','B+',NULL,'2026-07-25 19:20:52',NULL,NULL,'unverified',NULL,0,NULL,NULL);
INSERT INTO "patients" ("id","patient_code","mobile","mobile_verified","full_name","sex","date_of_birth","blood_group","relation","created_at","abha_number","abha_address","abha_status","abha_verified_at","whatsapp_opt_in","whatsapp_opt_in_at","whatsapp_opted_out_at") VALUES('pat_allo_2',NULL,'+919555500002',1,'Fatima Qureshi','female','1994-08-09','AB+',NULL,'2026-08-12 19:20:52',NULL,NULL,'unverified',NULL,0,NULL,NULL);
CREATE TABLE appointments (
  id             TEXT PRIMARY KEY,
  doctor_id      TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id     TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  scheduled_on   TEXT NOT NULL,          
  scheduled_at   TEXT,                   
  duration_mins  INTEGER NOT NULL DEFAULT 15,

  reason         TEXT,
  source         TEXT NOT NULL DEFAULT 'manual',  
  from_visit_id  TEXT REFERENCES visits(id) ON DELETE SET NULL,

  status         TEXT NOT NULL DEFAULT 'scheduled',
                 
  arrived_at     TEXT,
  completed_at   TEXT,
  cancel_reason  TEXT,

  notes          TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT
, request_id TEXT
  REFERENCES appointment_requests(id) ON DELETE SET NULL);
INSERT INTO "appointments" ("id","doctor_id","patient_id","scheduled_on","scheduled_at","duration_mins","reason","source","from_visit_id","status","arrived_at","completed_at","cancel_reason","notes","created_at","updated_at","request_id") VALUES('appt_demo_1','doc_demo','pat_demo_rohan','2026-09-03','09:30',15,'Fever follow-up','manual',NULL,'arrived','2026-09-03 19:00:36',NULL,NULL,'Temperature to be rechecked','2026-09-03 19:20:36',NULL,NULL);
INSERT INTO "appointments" ("id","doctor_id","patient_id","scheduled_on","scheduled_at","duration_mins","reason","source","from_visit_id","status","arrived_at","completed_at","cancel_reason","notes","created_at","updated_at","request_id") VALUES('appt_demo_2','doc_demo','pat_demo_vijay','2026-09-03','10:15',20,'Headache review','follow_up',NULL,'scheduled',NULL,NULL,NULL,'Review sleep diary','2026-09-03 19:20:36',NULL,NULL);
INSERT INTO "appointments" ("id","doctor_id","patient_id","scheduled_on","scheduled_at","duration_mins","reason","source","from_visit_id","status","arrived_at","completed_at","cancel_reason","notes","created_at","updated_at","request_id") VALUES('appt_demo_3','doc_demo','pat_demo_meera','2026-09-03','11:00',20,'Diabetes review','phone',NULL,'scheduled',NULL,NULL,NULL,'Bring glucose log','2026-09-03 19:20:36',NULL,NULL);
INSERT INTO "appointments" ("id","doctor_id","patient_id","scheduled_on","scheduled_at","duration_mins","reason","source","from_visit_id","status","arrived_at","completed_at","cancel_reason","notes","created_at","updated_at","request_id") VALUES('appt_demo_4','doc_demo','pat_demo_aarav','2026-09-03','12:00',15,'Allergy symptoms','manual',NULL,'completed',NULL,'2026-09-03 18:20:36',NULL,NULL,'2026-09-03 19:20:36',NULL,NULL);
INSERT INTO "appointments" ("id","doctor_id","patient_id","scheduled_on","scheduled_at","duration_mins","reason","source","from_visit_id","status","arrived_at","completed_at","cancel_reason","notes","created_at","updated_at","request_id") VALUES('appt_demo_5','doc_demo','pat_demo_ananya','2026-09-04','09:45',20,'Blood pressure review','follow_up',NULL,'scheduled',NULL,NULL,NULL,NULL,'2026-09-03 19:20:36',NULL,NULL);
INSERT INTO "appointments" ("id","doctor_id","patient_id","scheduled_on","scheduled_at","duration_mins","reason","source","from_visit_id","status","arrived_at","completed_at","cancel_reason","notes","created_at","updated_at","request_id") VALUES('appt_more_1','doc_demo','pat_demo_lakshmi','2026-09-03','09:00',30,'Cardiac and diabetes review','follow_up',NULL,'scheduled',NULL,NULL,NULL,'Review lipid and renal results','2026-09-03 19:20:44',NULL,NULL);
INSERT INTO "appointments" ("id","doctor_id","patient_id","scheduled_on","scheduled_at","duration_mins","reason","source","from_visit_id","status","arrived_at","completed_at","cancel_reason","notes","created_at","updated_at","request_id") VALUES('appt_more_2','doc_demo','pat_demo_arjun','2026-09-03','09:45',20,'Back pain follow-up','manual',NULL,'scheduled',NULL,NULL,NULL,NULL,'2026-09-03 19:20:44',NULL,NULL);
INSERT INTO "appointments" ("id","doctor_id","patient_id","scheduled_on","scheduled_at","duration_mins","reason","source","from_visit_id","status","arrived_at","completed_at","cancel_reason","notes","created_at","updated_at","request_id") VALUES('appt_more_3','doc_demo','pat_demo_fatima','2026-09-03','10:30',20,'Thyroid review','phone',NULL,'arrived','2026-09-03 19:12:44',NULL,NULL,'Report uploaded','2026-09-03 19:20:44',NULL,NULL);
INSERT INTO "appointments" ("id","doctor_id","patient_id","scheduled_on","scheduled_at","duration_mins","reason","source","from_visit_id","status","arrived_at","completed_at","cancel_reason","notes","created_at","updated_at","request_id") VALUES('appt_more_4','doc_demo','pat_demo_kiran','2026-09-03','13:15',15,'Migraine follow-up','follow_up',NULL,'scheduled',NULL,NULL,NULL,NULL,'2026-09-03 19:20:44',NULL,NULL);
INSERT INTO "appointments" ("id","doctor_id","patient_id","scheduled_on","scheduled_at","duration_mins","reason","source","from_visit_id","status","arrived_at","completed_at","cancel_reason","notes","created_at","updated_at","request_id") VALUES('appt_more_5','doc_demo','pat_demo_savita','2026-09-03','14:00',20,'Knee pain','manual',NULL,'scheduled',NULL,NULL,NULL,NULL,'2026-09-03 19:20:44',NULL,NULL);
INSERT INTO "appointments" ("id","doctor_id","patient_id","scheduled_on","scheduled_at","duration_mins","reason","source","from_visit_id","status","arrived_at","completed_at","cancel_reason","notes","created_at","updated_at","request_id") VALUES('appt_more_6','doc_demo','pat_demo_mahesh','2026-09-03','15:00',20,'Cough and wheeze','manual',NULL,'scheduled',NULL,NULL,NULL,NULL,'2026-09-03 19:20:44',NULL,NULL);
INSERT INTO "appointments" ("id","doctor_id","patient_id","scheduled_on","scheduled_at","duration_mins","reason","source","from_visit_id","status","arrived_at","completed_at","cancel_reason","notes","created_at","updated_at","request_id") VALUES('appt_more_7','doc_demo','pat_demo_nisha','2026-09-03','16:00',20,'Anaemia review','follow_up',NULL,'scheduled',NULL,NULL,NULL,NULL,'2026-09-03 19:20:44',NULL,NULL);
INSERT INTO "appointments" ("id","doctor_id","patient_id","scheduled_on","scheduled_at","duration_mins","reason","source","from_visit_id","status","arrived_at","completed_at","cancel_reason","notes","created_at","updated_at","request_id") VALUES('appt_more_8','doc_demo','pat_demo_rahul','2026-09-05','10:00',20,'Annual health check','manual',NULL,'scheduled',NULL,NULL,NULL,NULL,'2026-09-03 19:20:44',NULL,NULL);
INSERT INTO "appointments" ("id","doctor_id","patient_id","scheduled_on","scheduled_at","duration_mins","reason","source","from_visit_id","status","arrived_at","completed_at","cancel_reason","notes","created_at","updated_at","request_id") VALUES('appt_more_9','doc_demo','pat_demo_leela','2026-09-06','11:20',20,'Vertigo review','follow_up',NULL,'scheduled',NULL,NULL,NULL,'ENT opinion requested','2026-09-03 19:20:44',NULL,NULL);
INSERT INTO "appointments" ("id","doctor_id","patient_id","scheduled_on","scheduled_at","duration_mins","reason","source","from_visit_id","status","arrived_at","completed_at","cancel_reason","notes","created_at","updated_at","request_id") VALUES('appt_more_10','doc_demo','pat_demo_aditya','2026-09-08','17:00',15,'Asthma control','follow_up',NULL,'scheduled',NULL,NULL,NULL,NULL,'2026-09-03 19:20:44',NULL,NULL);
INSERT INTO "appointments" ("id","doctor_id","patient_id","scheduled_on","scheduled_at","duration_mins","reason","source","from_visit_id","status","arrived_at","completed_at","cancel_reason","notes","created_at","updated_at","request_id") VALUES('appt_homeo_1','doc_homeo','pat_homeo_3','2026-09-03','10:00',30,'Case review','follow_up',NULL,'arrived','2026-09-03 19:05:52',NULL,NULL,'Mother attending','2026-09-03 19:20:52',NULL,NULL);
INSERT INTO "appointments" ("id","doctor_id","patient_id","scheduled_on","scheduled_at","duration_mins","reason","source","from_visit_id","status","arrived_at","completed_at","cancel_reason","notes","created_at","updated_at","request_id") VALUES('appt_homeo_2','doc_homeo','pat_homeo_1','2026-09-03','11:00',20,'Repeat assessment','follow_up',NULL,'scheduled',NULL,NULL,NULL,'Headache diary to be reviewed','2026-09-03 19:20:52',NULL,NULL);
INSERT INTO "appointments" ("id","doctor_id","patient_id","scheduled_on","scheduled_at","duration_mins","reason","source","from_visit_id","status","arrived_at","completed_at","cancel_reason","notes","created_at","updated_at","request_id") VALUES('appt_homeo_3','doc_homeo','pat_homeo_2','2026-09-03','12:00',20,'Eczema review','follow_up',NULL,'scheduled',NULL,NULL,NULL,NULL,'2026-09-03 19:20:52',NULL,NULL);
INSERT INTO "appointments" ("id","doctor_id","patient_id","scheduled_on","scheduled_at","duration_mins","reason","source","from_visit_id","status","arrived_at","completed_at","cancel_reason","notes","created_at","updated_at","request_id") VALUES('appt_allo_1','doc_allo','pat_allo_2','2026-09-03','09:45',15,'Throat pain','manual',NULL,'arrived','2026-09-03 18:55:52',NULL,NULL,NULL,'2026-09-03 19:20:52',NULL,NULL);
INSERT INTO "appointments" ("id","doctor_id","patient_id","scheduled_on","scheduled_at","duration_mins","reason","source","from_visit_id","status","arrived_at","completed_at","cancel_reason","notes","created_at","updated_at","request_id") VALUES('appt_allo_2','doc_allo','pat_demo_vijay','2026-09-03','10:30',15,'Reflux review','follow_up',NULL,'scheduled',NULL,NULL,NULL,'Ask about the Ayurvedic medicines he is on','2026-09-03 19:20:52',NULL,NULL);
INSERT INTO "appointments" ("id","doctor_id","patient_id","scheduled_on","scheduled_at","duration_mins","reason","source","from_visit_id","status","arrived_at","completed_at","cancel_reason","notes","created_at","updated_at","request_id") VALUES('appt_allo_3','doc_allo','pat_allo_1','2026-09-03','11:15',20,'Diabetes review','follow_up',NULL,'scheduled',NULL,NULL,NULL,'Glucose log','2026-09-03 19:20:52',NULL,NULL);
INSERT INTO "appointments" ("id","doctor_id","patient_id","scheduled_on","scheduled_at","duration_mins","reason","source","from_visit_id","status","arrived_at","completed_at","cancel_reason","notes","created_at","updated_at","request_id") VALUES('appt_allo_4','doc_allo','pat_allo_2','2026-09-03','16:00',15,'Report collection','manual',NULL,'scheduled',NULL,NULL,NULL,NULL,'2026-09-03 19:20:52',NULL,NULL);
CREATE TABLE appointment_requests (
  id            TEXT PRIMARY KEY,
  doctor_id     TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  mobile        TEXT NOT NULL,
  preferred_on  TEXT,
  preferred_time TEXT,
  reason        TEXT,
  note          TEXT,
  status        TEXT NOT NULL DEFAULT 'new',   
  patient_id    TEXT REFERENCES patients(id) ON DELETE SET NULL,
  appointment_id TEXT REFERENCES appointments(id) ON DELETE SET NULL,
  source_ip     TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  handled_at    TEXT
);
INSERT INTO "appointment_requests" ("id","doctor_id","full_name","mobile","preferred_on","preferred_time","reason","note","status","patient_id","appointment_id","source_ip","created_at","handled_at") VALUES('req_demo_1','doc_demo','Saanvi Gupta','+919333300099','2026-09-05','17:30','Recurring acidity','First visit request from clinic page','new',NULL,NULL,NULL,'2026-09-03 16:20:36',NULL);
CREATE TABLE drug_catalogue (
  id          TEXT PRIMARY KEY,        
  system      TEXT NOT NULL,           
  name        TEXT NOT NULL,           
  detail      TEXT,                    
  search_text TEXT NOT NULL,           
  popularity  INTEGER NOT NULL DEFAULT 0,  
  source      TEXT NOT NULL,           
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ferrous-ascorbate','allopathy','Ferrous ascorbate','Oral iron','ferrous ascorbate iron anaemia haemoglobin',66,'curated-demo','2026-09-03 19:20:56');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('methylcobalamin','supplement','Methylcobalamin','Vitamin B12','methylcobalamin b12 vitamin neuropathy',77,'curated-demo','2026-09-03 19:20:56');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('calcium-carbonate','supplement','Calcium carbonate','With vitamin D3','calcium carbonate bone shelcal',73,'curated-demo','2026-09-03 19:20:56');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('haridra','ayurveda','Haridra','Curcuma longa · Turmeric','haridra turmeric curcuma longa curcumin',86,'curated-demo','2026-09-03 19:20:56');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('dashamoola','ayurveda','Dashamoola Kwatha','Ten-root decoction','dashamoola dashmool kwatha kashaya vata',74,'curated-demo','2026-09-03 19:20:56');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('trikatu','ayurveda','Trikatu','Pippali, Maricha, Shunthi','trikatu pippali maricha shunthi deepana agni',73,'curated-demo','2026-09-03 19:20:56');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('lycopodium','homeopathy','Lycopodium Clavatum','Club moss · polychrest','lycopodium lyco clavatum club moss digestive',92,'curated-demo','2026-09-03 19:20:56');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('pulsatilla','homeopathy','Pulsatilla Nigricans','Wind flower · polychrest','pulsatilla puls nigricans wind flower changeable',91,'curated-demo','2026-09-03 19:20:56');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('sepia','homeopathy','Sepia Officinalis','Cuttlefish ink','sepia sep officinalis cuttlefish indifference',83,'curated-demo','2026-09-03 19:20:56');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('graphites','homeopathy','Graphites','Black lead','graphites graph black lead eczema skin',78,'curated-demo','2026-09-03 19:20:56');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('calendula','homeopathy','Calendula Officinalis','Marigold · commonly used as mother tincture','calendula officinalis marigold wound antiseptic',76,'curated-demo','2026-09-03 19:20:56');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-paracetamol','allopathy','Paracetamol','acetaminophen','paracetamol acetaminophen pcm dolo crocin calpol',100,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-cetirizine','allopathy','Cetirizine','cetrizine','cetirizine cetrizine cetzine alerid',95,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-levocetirizine','allopathy','Levocetirizine','levocet','levocetirizine levocet levocetrizine',88,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-amoxicillin','allopathy','Amoxicillin','amoxycillin','amoxicillin amoxycillin mox',90,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-amoxicillin-plus-clavulanic-acid','allopathy','Amoxicillin + Clavulanic acid','co-amoxiclav','amoxicillin + clavulanic acid co-amoxiclav augmentin clavam',89,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-azithromycin','allopathy','Azithromycin','azithral','azithromycin azithral azee',87,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-cefixime','allopathy','Cefixime','taxim-o','cefixime taxim-o zifi',84,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-ciprofloxacin','allopathy','Ciprofloxacin','cifran','ciprofloxacin cifran ciplox',78,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-ofloxacin','allopathy','Ofloxacin','oflox','ofloxacin oflox',72,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-doxycycline','allopathy','Doxycycline','doxy','doxycycline doxy',70,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-metronidazole','allopathy','Metronidazole','flagyl','metronidazole flagyl metrogyl',76,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-ibuprofen','allopathy','Ibuprofen','brufen','ibuprofen brufen combiflam',85,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-diclofenac','allopathy','Diclofenac','voveran','diclofenac voveran volini',80,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-aceclofenac','allopathy','Aceclofenac','zerodol','aceclofenac zerodol',74,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-naproxen','allopathy','Naproxen',NULL,'naproxen',55,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-tramadol','allopathy','Tramadol',NULL,'tramadol',50,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-pantoprazole','allopathy','Pantoprazole','pantop','pantoprazole pantop pan-d',92,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-omeprazole','allopathy','Omeprazole','omez','omeprazole omez',82,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-rabeprazole','allopathy','Rabeprazole','razo','rabeprazole razo',68,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-ranitidine','allopathy','Ranitidine','zinetac','ranitidine zinetac rantac',45,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-domperidone','allopathy','Domperidone','domstal','domperidone domstal',66,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-ondansetron','allopathy','Ondansetron','emeset','ondansetron emeset vomikind',73,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-metformin','allopathy','Metformin','glycomet','metformin glycomet',93,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-glimepiride','allopathy','Glimepiride','amaryl','glimepiride amaryl',79,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-sitagliptin','allopathy','Sitagliptin','januvia','sitagliptin januvia istamet',71,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-insulin-glargine','allopathy','Insulin glargine','lantus','insulin glargine lantus basalog',48,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-telmisartan','allopathy','Telmisartan','telma','telmisartan telma',86,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-amlodipine','allopathy','Amlodipine','amlong','amlodipine amlong amlokind',88,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-losartan','allopathy','Losartan','losar','losartan losar',69,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-ramipril','allopathy','Ramipril','cardace','ramipril cardace',62,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-metoprolol','allopathy','Metoprolol','metolar','metoprolol metolar',67,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-atenolol','allopathy','Atenolol',NULL,'atenolol',58,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-atorvastatin','allopathy','Atorvastatin','atorva','atorvastatin atorva lipvas',83,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-rosuvastatin','allopathy','Rosuvastatin','rosuvas','rosuvastatin rosuvas',75,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-clopidogrel','allopathy','Clopidogrel','clopilet','clopidogrel clopilet deplatt',61,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-aspirin','allopathy','Aspirin','ecosprin','aspirin ecosprin acetylsalicylic acid',77,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-montelukast','allopathy','Montelukast','montair','montelukast montair',81,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-salbutamol','allopathy','Salbutamol','asthalin','salbutamol asthalin albuterol',72,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-budesonide-plus-formoterol','allopathy','Budesonide + Formoterol','foracort','budesonide + formoterol foracort symbicort',59,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-prednisolone','allopathy','Prednisolone','omnacortil','prednisolone omnacortil wysolone',70,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-deflazacort','allopathy','Deflazacort','defcort','deflazacort defcort',52,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-hydroxyzine','allopathy','Hydroxyzine','atarax','hydroxyzine atarax',44,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-fexofenadine','allopathy','Fexofenadine','allegra','fexofenadine allegra',64,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-chlorpheniramine','allopathy','Chlorpheniramine','cpm','chlorpheniramine cpm piriton',47,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-dextromethorphan','allopathy','Dextromethorphan','benadryl dr','dextromethorphan benadryl dr',42,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-ambroxol','allopathy','Ambroxol',NULL,'ambroxol',56,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-levothyroxine','allopathy','Levothyroxine','thyronorm','levothyroxine thyronorm eltroxin',85,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-iron-plus-folic-acid','allopathy','Iron + Folic acid','ifa','iron + folic acid ifa orofer ferrous ascorbate',74,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-calcium-plus-vitamin-d3','allopathy','Calcium + Vitamin D3','shelcal','calcium + vitamin d3 shelcal calcimax',80,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-vitamin-d3','allopathy','Vitamin D3','cholecalciferol','vitamin d3 cholecalciferol uprise-d3',82,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-vitamin-b12','allopathy','Vitamin B12','cyanocobalamin','vitamin b12 cyanocobalamin methylcobalamin nurokind',71,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-folic-acid','allopathy','Folic acid',NULL,'folic acid',60,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-zinc','allopathy','Zinc','zinc sulphate','zinc zinc sulphate zincovit',57,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-ors','allopathy','ORS','oral rehydration salts','ors oral rehydration salts electral',76,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-albendazole','allopathy','Albendazole','zentel','albendazole zentel',65,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-ivermectin','allopathy','Ivermectin',NULL,'ivermectin',40,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-fluconazole','allopathy','Fluconazole','forcan','fluconazole forcan',63,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-clotrimazole','allopathy','Clotrimazole','candid','clotrimazole candid',54,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-mupirocin','allopathy','Mupirocin','t-bact','mupirocin t-bact',46,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-silver-sulfadiazine','allopathy','Silver sulfadiazine','silverex','silver sulfadiazine silverex',33,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-sucralfate','allopathy','Sucralfate',NULL,'sucralfate',38,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-lactulose','allopathy','Lactulose','duphalac','lactulose duphalac looz',53,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-isabgol','allopathy','Isabgol','psyllium husk','isabgol psyllium husk naturolax',49,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-amitriptyline','allopathy','Amitriptyline',NULL,'amitriptyline',36,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-gabapentin','allopathy','Gabapentin',NULL,'gabapentin',43,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-pregabalin','allopathy','Pregabalin',NULL,'pregabalin',51,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-escitalopram','allopathy','Escitalopram',NULL,'escitalopram',41,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-alprazolam','allopathy','Alprazolam',NULL,'alprazolam',34,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-cetrizine-plus-phenylephrine','allopathy','Cetrizine + Phenylephrine','cold tablet','cetrizine + phenylephrine cold tablet',39,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-tranexamic-acid','allopathy','Tranexamic acid','pause','tranexamic acid pause',37,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-misoprostol','allopathy','Misoprostol',NULL,'misoprostol',25,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('allo-nifedipine','allopathy','Nifedipine',NULL,'nifedipine',30,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-ashwagandha','ayurveda','Ashwagandha','withania somnifera','ashwagandha withania somnifera winter cherry asgandh',100,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-triphala','ayurveda','Triphala','triphala churna','triphala triphala churna',98,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-brahmi','ayurveda','Brahmi','bacopa monnieri','brahmi bacopa monnieri water hyssop',88,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-shatavari','ayurveda','Shatavari','asparagus racemosus','shatavari asparagus racemosus',86,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-guduchi','ayurveda','Guduchi','giloy','guduchi giloy tinospora cordifolia amrita',92,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-tulsi','ayurveda','Tulsi','holy basil','tulsi holy basil ocimum sanctum',85,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-neem','ayurveda','Neem','azadirachta indica','neem azadirachta indica nimba',80,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-amla','ayurveda','Amla','amalaki','amla amalaki emblica officinalis indian gooseberry',90,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-haritaki','ayurveda','Haritaki','terminalia chebula','haritaki terminalia chebula',76,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-bibhitaki','ayurveda','Bibhitaki','terminalia bellirica','bibhitaki terminalia bellirica',70,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-yashtimadhu','ayurveda','Yashtimadhu','licorice','yashtimadhu licorice mulethi glycyrrhiza glabra',78,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-punarnava','ayurveda','Punarnava','boerhavia diffusa','punarnava boerhavia diffusa',68,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-guggulu','ayurveda','Guggulu','commiphora mukul','guggulu commiphora mukul',74,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-shallaki','ayurveda','Shallaki','boswellia serrata','shallaki boswellia serrata salai guggul',66,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-arjuna','ayurveda','Arjuna','terminalia arjuna','arjuna terminalia arjuna',79,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-manjistha','ayurveda','Manjistha','rubia cordifolia','manjistha rubia cordifolia',58,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-vacha','ayurveda','Vacha','acorus calamus','vacha acorus calamus',44,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-bhringraj','ayurveda','Bhringraj','eclipta alba','bhringraj eclipta alba',62,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-kutki','ayurveda','Kutki','picrorhiza kurroa','kutki picrorhiza kurroa',48,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-methi','ayurveda','Methi','fenugreek','methi fenugreek trigonella',60,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-jatamansi','ayurveda','Jatamansi','nardostachys jatamansi','jatamansi nardostachys jatamansi',46,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-shankhpushpi','ayurveda','Shankhpushpi','convolvulus pluricaulis','shankhpushpi convolvulus pluricaulis',64,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-gokshura','ayurveda','Gokshura','tribulus terrestris','gokshura tribulus terrestris',61,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-vidanga','ayurveda','Vidanga','embelia ribes','vidanga embelia ribes',35,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-pippali','ayurveda','Pippali','long pepper','pippali long pepper piper longum',55,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-avipattikara-churna','ayurveda','Avipattikara Churna','avipattikar','avipattikara churna avipattikar',82,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-sitopaladi-churna','ayurveda','Sitopaladi Churna','sitopaladi','sitopaladi churna sitopaladi',84,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-talisadi-churna','ayurveda','Talisadi Churna','talisadi','talisadi churna talisadi',63,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-hingvastak-churna','ayurveda','Hingvastak Churna','hingvastaka','hingvastak churna hingvastaka',65,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-dashamoola','ayurveda','Dashamoola','dashmool','dashamoola dashmool dashamula',72,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-chyawanprash','ayurveda','Chyawanprash','chyavanprash','chyawanprash chyavanprash',89,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-drakshasava','ayurveda','Drakshasava',NULL,'drakshasava',71,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-ashokarishta','ayurveda','Ashokarishta','ashokarist','ashokarishta ashokarist',75,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-dashamularishta','ayurveda','Dashamularishta',NULL,'dashamularishta',67,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-arjunarishta','ayurveda','Arjunarishta',NULL,'arjunarishta',59,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-kumaryasava','ayurveda','Kumaryasava',NULL,'kumaryasava',45,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-saraswatarishta','ayurveda','Saraswatarishta',NULL,'saraswatarishta',52,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-punarnavasava','ayurveda','Punarnavasava',NULL,'punarnavasava',41,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-yograj-guggulu','ayurveda','Yograj Guggulu','yogaraja guggulu','yograj guggulu yogaraja guggulu',77,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-kaishore-guggulu','ayurveda','Kaishore Guggulu',NULL,'kaishore guggulu',69,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-triphala-guggulu','ayurveda','Triphala Guggulu',NULL,'triphala guggulu',73,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-kanchanar-guggulu','ayurveda','Kanchanar Guggulu','kanchnar guggul','kanchanar guggulu kanchnar guggul',66,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-simhanad-guggulu','ayurveda','Simhanad Guggulu',NULL,'simhanad guggulu',40,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-guduchi-ghana-vati','ayurveda','Guduchi Ghana Vati','giloy ghan vati','guduchi ghana vati giloy ghan vati',70,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-chandraprabha-vati','ayurveda','Chandraprabha Vati',NULL,'chandraprabha vati',74,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-arogyavardhini-vati','ayurveda','Arogyavardhini Vati',NULL,'arogyavardhini vati',68,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-sanjivani-vati','ayurveda','Sanjivani Vati',NULL,'sanjivani vati',47,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-khadiradi-vati','ayurveda','Khadiradi Vati',NULL,'khadiradi vati',33,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-lakshmivilas-rasa','ayurveda','Lakshmivilas Rasa',NULL,'lakshmivilas rasa',38,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-tribhuvankirti-rasa','ayurveda','Tribhuvankirti Rasa',NULL,'tribhuvankirti rasa',36,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-ksheerabala-taila','ayurveda','Ksheerabala Taila','ksheerabala','ksheerabala taila ksheerabala',62,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-mahanarayan-taila','ayurveda','Mahanarayan Taila','mahanarayana','mahanarayan taila mahanarayana',71,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-dhanwantharam-taila','ayurveda','Dhanwantharam Taila',NULL,'dhanwantharam taila',50,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-bala-taila','ayurveda','Bala Taila',NULL,'bala taila',39,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-anu-taila','ayurveda','Anu Taila','anu thailam','anu taila anu thailam nasya oil',57,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-brahmi-ghrita','ayurveda','Brahmi Ghrita',NULL,'brahmi ghrita',42,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-phala-ghrita','ayurveda','Phala Ghrita',NULL,'phala ghrita',34,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-panchakarma-basti','ayurveda','Panchakarma Basti',NULL,'panchakarma basti',28,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-sitopaladi-plus-honey','ayurveda','Sitopaladi + Honey',NULL,'sitopaladi + honey',30,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('ayur-mahasudarshan-churna','ayurveda','Mahasudarshan Churna','mahasudarshana','mahasudarshan churna mahasudarshana',56,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-arnica-montana','homeopathy','Arnica montana','arnica','arnica montana arnica',100,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-belladonna','homeopathy','Belladonna',NULL,'belladonna',92,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-bryonia-alba','homeopathy','Bryonia alba','bryonia','bryonia alba bryonia',88,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-nux-vomica','homeopathy','Nux vomica',NULL,'nux vomica',96,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-rhus-toxicodendron','homeopathy','Rhus toxicodendron','rhus tox','rhus toxicodendron rhus tox',90,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-pulsatilla','homeopathy','Pulsatilla',NULL,'pulsatilla',86,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-sulphur','homeopathy','Sulphur',NULL,'sulphur',89,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-calcarea-carbonica','homeopathy','Calcarea carbonica','calc carb','calcarea carbonica calc carb',82,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-lycopodium','homeopathy','Lycopodium',NULL,'lycopodium',84,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-natrum-muriaticum','homeopathy','Natrum muriaticum','nat mur','natrum muriaticum nat mur',80,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-phosphorus','homeopathy','Phosphorus',NULL,'phosphorus',76,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-sepia','homeopathy','Sepia',NULL,'sepia',74,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-ignatia-amara','homeopathy','Ignatia amara','ignatia','ignatia amara ignatia',72,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-gelsemium','homeopathy','Gelsemium',NULL,'gelsemium',70,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-aconitum-napellus','homeopathy','Aconitum napellus','aconite','aconitum napellus aconite',78,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-apis-mellifica','homeopathy','Apis mellifica','apis','apis mellifica apis',64,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-chamomilla','homeopathy','Chamomilla',NULL,'chamomilla',68,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-hepar-sulphuris','homeopathy','Hepar sulphuris','hepar sulph','hepar sulphuris hepar sulph',60,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-mercurius-solubilis','homeopathy','Mercurius solubilis','merc sol','mercurius solubilis merc sol',62,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-silicea','homeopathy','Silicea','silica','silicea silica',66,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-thuja-occidentalis','homeopathy','Thuja occidentalis','thuja','thuja occidentalis thuja',71,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-antimonium-crudum','homeopathy','Antimonium crudum',NULL,'antimonium crudum',44,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-argentum-nitricum','homeopathy','Argentum nitricum','arg nit','argentum nitricum arg nit',56,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-arsenicum-album','homeopathy','Arsenicum album','ars alb','arsenicum album ars alb',85,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-carbo-vegetabilis','homeopathy','Carbo vegetabilis','carbo veg','carbo vegetabilis carbo veg',58,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-cantharis','homeopathy','Cantharis',NULL,'cantharis',52,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-china-officinalis','homeopathy','China officinalis','cinchona','china officinalis cinchona',48,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-colocynthis','homeopathy','Colocynthis',NULL,'colocynthis',54,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-drosera','homeopathy','Drosera',NULL,'drosera',42,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-euphrasia','homeopathy','Euphrasia',NULL,'euphrasia',46,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-ferrum-phosphoricum','homeopathy','Ferrum phosphoricum','ferrum phos','ferrum phosphoricum ferrum phos',50,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-kali-bichromicum','homeopathy','Kali bichromicum','kali bich','kali bichromicum kali bich',57,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-ledum-palustre','homeopathy','Ledum palustre','ledum','ledum palustre ledum',40,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-nux-moschata','homeopathy','Nux moschata',NULL,'nux moschata',30,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-podophyllum','homeopathy','Podophyllum',NULL,'podophyllum',36,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-ruta-graveolens','homeopathy','Ruta graveolens','ruta','ruta graveolens ruta',55,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-spongia-tosta','homeopathy','Spongia tosta','spongia','spongia tosta spongia',38,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-staphysagria','homeopathy','Staphysagria',NULL,'staphysagria',43,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-symphytum','homeopathy','Symphytum',NULL,'symphytum',34,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-veratrum-album','homeopathy','Veratrum album',NULL,'veratrum album',28,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-cina','homeopathy','Cina',NULL,'cina',32,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-dulcamara','homeopathy','Dulcamara',NULL,'dulcamara',26,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-kali-carbonicum','homeopathy','Kali carbonicum','kali carb','kali carbonicum kali carb',45,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-magnesia-phosphorica','homeopathy','Magnesia phosphorica','mag phos','magnesia phosphorica mag phos',47,'tcos-core-catalogue','2026-09-08 04:20:51');
INSERT INTO "drug_catalogue" ("id","system","name","detail","search_text","popularity","source","created_at") VALUES('home-natrum-sulphuricum','homeopathy','Natrum sulphuricum','nat sulph','natrum sulphuricum nat sulph',33,'tcos-core-catalogue','2026-09-08 04:20:51');
CREATE TABLE drug_strengths (
  drug_id  TEXT NOT NULL REFERENCES drug_catalogue(id) ON DELETE CASCADE,
  strength TEXT NOT NULL,              
  
  
  form     TEXT NOT NULL DEFAULT '',   
  weight   INTEGER NOT NULL DEFAULT 0, 
  PRIMARY KEY (drug_id, strength, form)
);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ferrous-ascorbate','100mg','Tablet',85);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('methylcobalamin','500mcg','Tablet',90);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('methylcobalamin','1500mcg','Tablet',70);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('calcium-carbonate','500mg','Tablet',90);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('lycopodium','30C','Globules',100);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('pulsatilla','30C','Globules',100);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('sepia','30C','Globules',100);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('graphites','30C','Globules',100);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('calendula','30C','Globules',100);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('lycopodium','200C','Globules',95);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('pulsatilla','200C','Globules',95);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('sepia','200C','Globules',95);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('graphites','200C','Globules',95);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('calendula','200C','Globules',95);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('lycopodium','6C','Globules',80);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('pulsatilla','6C','Globules',80);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('sepia','6C','Globules',80);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('graphites','6C','Globules',80);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('calendula','6C','Globules',80);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('lycopodium','1M','Globules',75);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('pulsatilla','1M','Globules',75);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('sepia','1M','Globules',75);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('graphites','1M','Globules',75);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('calendula','1M','Globules',75);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('lycopodium','10M','Globules',55);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('pulsatilla','10M','Globules',55);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('sepia','10M','Globules',55);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('graphites','10M','Globules',55);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('calendula','10M','Globules',55);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('lycopodium','Q (mother tincture)','Tincture',50);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('pulsatilla','Q (mother tincture)','Tincture',50);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('sepia','Q (mother tincture)','Tincture',50);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('graphites','Q (mother tincture)','Tincture',50);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('calendula','Q (mother tincture)','Tincture',50);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('haridra','500mg','Vati',90);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('dashamoola','15ml','Kwatha',95);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('trikatu','1g','Churna',90);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-paracetamol','500mg','Tablet',4);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-paracetamol','650mg','Tablet',3);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-paracetamol','125mg/5ml','Syrup',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-paracetamol','250mg/5ml','Syrup',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-cetirizine','10mg','Tablet',3);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-cetirizine','5mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-cetirizine','5mg/5ml','Syrup',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-levocetirizine','5mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-levocetirizine','2.5mg/5ml','Syrup',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-amoxicillin','250mg','Tablet',3);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-amoxicillin','500mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-amoxicillin','125mg/5ml','Syrup',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-amoxicillin-plus-clavulanic-acid','625mg','Tablet',3);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-amoxicillin-plus-clavulanic-acid','1g','Churna',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-amoxicillin-plus-clavulanic-acid','228mg/5ml','Syrup',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-azithromycin','250mg','Tablet',3);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-azithromycin','500mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-azithromycin','200mg/5ml','Syrup',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-cefixime','200mg','Tablet',3);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-cefixime','100mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-cefixime','50mg/5ml','Syrup',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-ciprofloxacin','250mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-ciprofloxacin','500mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-ofloxacin','200mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-ofloxacin','400mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-doxycycline','100mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-metronidazole','200mg','Tablet',3);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-metronidazole','400mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-metronidazole','200mg/5ml','Syrup',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-ibuprofen','200mg','Tablet',3);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-ibuprofen','400mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-ibuprofen','100mg/5ml','Syrup',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-diclofenac','50mg','Tablet',3);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-diclofenac','75mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-diclofenac','1% gel','Topical',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-aceclofenac','100mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-naproxen','250mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-naproxen','500mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-tramadol','50mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-tramadol','100mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-pantoprazole','40mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-pantoprazole','20mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-omeprazole','20mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-omeprazole','40mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-rabeprazole','20mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-ranitidine','150mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-ranitidine','300mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-domperidone','10mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-ondansetron','4mg','Tablet',3);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-ondansetron','8mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-ondansetron','2mg/5ml','Syrup',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-metformin','500mg','Tablet',3);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-metformin','850mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-metformin','1g','Churna',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-glimepiride','1mg','Tablet',3);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-glimepiride','2mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-glimepiride','3mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-sitagliptin','50mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-sitagliptin','100mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-insulin-glargine','100IU/ml','Liquid',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-telmisartan','20mg','Tablet',3);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-telmisartan','40mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-telmisartan','80mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-amlodipine','2.5mg','Tablet',3);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-amlodipine','5mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-amlodipine','10mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-losartan','25mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-losartan','50mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-ramipril','2.5mg','Tablet',3);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-ramipril','5mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-ramipril','10mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-metoprolol','25mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-metoprolol','50mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-atenolol','25mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-atenolol','50mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-atorvastatin','10mg','Tablet',3);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-atorvastatin','20mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-atorvastatin','40mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-rosuvastatin','5mg','Tablet',3);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-rosuvastatin','10mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-rosuvastatin','20mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-clopidogrel','75mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-aspirin','75mg','Tablet',3);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-aspirin','150mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-aspirin','325mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-montelukast','10mg','Tablet',3);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-montelukast','5mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-montelukast','4mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-salbutamol','2mg','Tablet',3);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-salbutamol','4mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-salbutamol','100mcg inhaler','Inhaler',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-budesonide-plus-formoterol','200mcg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-budesonide-plus-formoterol','400mcg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-prednisolone','5mg','Tablet',3);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-prednisolone','10mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-prednisolone','20mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-deflazacort','6mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-deflazacort','30mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-hydroxyzine','10mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-hydroxyzine','25mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-fexofenadine','120mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-fexofenadine','180mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-chlorpheniramine','4mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-dextromethorphan','10mg/5ml','Syrup',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-ambroxol','30mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-ambroxol','15mg/5ml','Syrup',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-levothyroxine','25mcg','Tablet',4);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-levothyroxine','50mcg','Tablet',3);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-levothyroxine','75mcg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-levothyroxine','100mcg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-iron-plus-folic-acid','100mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-iron-plus-folic-acid','60mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-calcium-plus-vitamin-d3','500mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-calcium-plus-vitamin-d3','250mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-vitamin-d3','60000IU','Tablet',3);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-vitamin-d3','1000IU','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-vitamin-d3','2000IU','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-vitamin-b12','500mcg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-vitamin-b12','1500mcg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-folic-acid','5mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-zinc','20mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-zinc','50mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-ors','21.8g sachet','Sachet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-albendazole','400mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-ivermectin','6mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-ivermectin','12mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-fluconazole','150mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-fluconazole','200mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-clotrimazole','1% cream','Topical',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-clotrimazole','1% solution','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-mupirocin','2% ointment','Topical',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-silver-sulfadiazine','1% cream','Topical',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-sucralfate','1g/10ml','Syrup',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-lactulose','10g/15ml','Syrup',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-isabgol','3.5g','Churna',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-amitriptyline','10mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-amitriptyline','25mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-gabapentin','100mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-gabapentin','300mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-pregabalin','75mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-pregabalin','150mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-escitalopram','5mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-escitalopram','10mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-alprazolam','0.25mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-alprazolam','0.5mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-tranexamic-acid','500mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-misoprostol','200mcg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-nifedipine','10mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('allo-nifedipine','20mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-ashwagandha','500mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-ashwagandha','3g','Churna',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-triphala','500mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-triphala','3g','Churna',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-brahmi','500mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-brahmi','3g','Churna',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-shatavari','500mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-shatavari','3g','Churna',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-guduchi','500mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-guduchi','3g','Churna',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-tulsi','500mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-neem','500mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-amla','500mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-amla','3g','Churna',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-haritaki','500mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-haritaki','3g','Churna',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-bibhitaki','500mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-bibhitaki','3g','Churna',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-yashtimadhu','500mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-yashtimadhu','3g','Churna',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-punarnava','500mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-punarnava','3g','Churna',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-guggulu','500mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-shallaki','500mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-arjuna','500mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-arjuna','3g','Churna',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-manjistha','500mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-vacha','500mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-bhringraj','500mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-kutki','500mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-methi','500mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-methi','3g','Churna',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-jatamansi','500mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-shankhpushpi','500mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-shankhpushpi','10ml','Liquid',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-gokshura','500mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-vidanga','500mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-pippali','500mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-avipattikara-churna','3g','Churna',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-sitopaladi-churna','3g','Churna',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-talisadi-churna','3g','Churna',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-hingvastak-churna','3g','Churna',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-dashamoola','3g','Churna',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-dashamoola','15ml','Liquid',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-chyawanprash','10g','Churna',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-drakshasava','15ml','Liquid',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-drakshasava','30ml','Liquid',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-ashokarishta','15ml','Liquid',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-ashokarishta','30ml','Liquid',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-dashamularishta','15ml','Liquid',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-dashamularishta','30ml','Liquid',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-arjunarishta','15ml','Liquid',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-arjunarishta','30ml','Liquid',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-kumaryasava','15ml','Liquid',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-saraswatarishta','15ml','Liquid',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-punarnavasava','15ml','Liquid',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-yograj-guggulu','250mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-yograj-guggulu','500mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-kaishore-guggulu','250mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-kaishore-guggulu','500mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-triphala-guggulu','250mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-triphala-guggulu','500mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-kanchanar-guggulu','250mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-kanchanar-guggulu','500mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-simhanad-guggulu','250mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-guduchi-ghana-vati','250mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-guduchi-ghana-vati','500mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-chandraprabha-vati','250mg','Tablet',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-chandraprabha-vati','500mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-arogyavardhini-vati','250mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-sanjivani-vati','250mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-khadiradi-vati','250mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-lakshmivilas-rasa','125mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-tribhuvankirti-rasa','125mg','Tablet',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-ksheerabala-taila','10ml','Liquid',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-ksheerabala-taila','200ml','Liquid',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-mahanarayan-taila','100ml','Liquid',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-mahanarayan-taila','200ml','Liquid',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-dhanwantharam-taila','200ml','Liquid',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-bala-taila','200ml','Liquid',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-anu-taila','10ml','Liquid',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-brahmi-ghrita','100g','Churna',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-phala-ghrita','100g','Churna',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('ayur-mahasudarshan-churna','3g','Churna',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-arnica-montana','30C','Potency',4);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-arnica-montana','200C','Potency',3);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-arnica-montana','6C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-arnica-montana','1M','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-belladonna','30C','Potency',3);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-belladonna','200C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-belladonna','6C','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-bryonia-alba','30C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-bryonia-alba','200C','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-nux-vomica','30C','Potency',4);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-nux-vomica','200C','Potency',3);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-nux-vomica','6C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-nux-vomica','1M','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-rhus-toxicodendron','30C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-rhus-toxicodendron','200C','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-pulsatilla','30C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-pulsatilla','200C','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-sulphur','30C','Potency',3);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-sulphur','200C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-sulphur','1M','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-calcarea-carbonica','30C','Potency',3);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-calcarea-carbonica','200C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-calcarea-carbonica','1M','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-lycopodium','30C','Potency',3);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-lycopodium','200C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-lycopodium','1M','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-natrum-muriaticum','30C','Potency',3);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-natrum-muriaticum','200C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-natrum-muriaticum','1M','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-phosphorus','30C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-phosphorus','200C','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-sepia','30C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-sepia','200C','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-ignatia-amara','30C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-ignatia-amara','200C','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-gelsemium','30C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-gelsemium','200C','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-aconitum-napellus','30C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-aconitum-napellus','200C','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-apis-mellifica','30C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-apis-mellifica','200C','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-chamomilla','30C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-chamomilla','200C','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-hepar-sulphuris','30C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-hepar-sulphuris','200C','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-mercurius-solubilis','30C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-mercurius-solubilis','200C','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-silicea','30C','Potency',3);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-silicea','200C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-silicea','1M','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-thuja-occidentalis','30C','Potency',3);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-thuja-occidentalis','200C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-thuja-occidentalis','1M','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-antimonium-crudum','30C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-antimonium-crudum','200C','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-argentum-nitricum','30C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-argentum-nitricum','200C','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-arsenicum-album','30C','Potency',3);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-arsenicum-album','200C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-arsenicum-album','1M','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-carbo-vegetabilis','30C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-carbo-vegetabilis','200C','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-cantharis','30C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-cantharis','200C','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-china-officinalis','30C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-china-officinalis','200C','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-colocynthis','30C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-colocynthis','200C','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-drosera','30C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-drosera','200C','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-euphrasia','30C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-euphrasia','200C','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-ferrum-phosphoricum','6X','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-ferrum-phosphoricum','30C','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-kali-bichromicum','30C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-kali-bichromicum','200C','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-ledum-palustre','30C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-ledum-palustre','200C','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-nux-moschata','30C','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-podophyllum','30C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-podophyllum','200C','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-ruta-graveolens','30C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-ruta-graveolens','200C','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-spongia-tosta','30C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-spongia-tosta','200C','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-staphysagria','30C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-staphysagria','200C','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-symphytum','30C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-symphytum','200C','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-veratrum-album','30C','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-cina','30C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-cina','200C','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-dulcamara','30C','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-kali-carbonicum','30C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-kali-carbonicum','200C','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-magnesia-phosphorica','6X','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-magnesia-phosphorica','30C','Potency',1);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-natrum-sulphuricum','30C','Potency',2);
INSERT INTO "drug_strengths" ("drug_id","strength","form","weight") VALUES('home-natrum-sulphuricum','200C','Potency',1);
CREATE TABLE patient_sequences (
  doctor_id TEXT PRIMARY KEY REFERENCES doctors(id) ON DELETE CASCADE,
  next_no   INTEGER NOT NULL DEFAULT 1000    
);
INSERT INTO "patient_sequences" ("doctor_id","next_no") VALUES('doc_demo',1016);
INSERT INTO "patient_sequences" ("doctor_id","next_no") VALUES('doc_homeo',1004);
INSERT INTO "patient_sequences" ("doctor_id","next_no") VALUES('doc_allo',1004);
CREATE TABLE clinic_users (
  id            TEXT PRIMARY KEY,
  doctor_id     TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  full_name     TEXT NOT NULL,
  mobile        TEXT NOT NULL UNIQUE,   
  role          TEXT NOT NULL,          
  password_hash TEXT,
  password_salt TEXT,

  
  
  
  must_change_password INTEGER NOT NULL DEFAULT 1,

  status        TEXT NOT NULL DEFAULT 'active',   
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_sign_in_at TEXT
, capabilities TEXT, qualification TEXT, registration_no TEXT, council TEXT, verification_status TEXT NOT NULL DEFAULT 'unverified', verified_at TEXT, verified_by TEXT, hpr_id TEXT);
INSERT INTO "clinic_users" ("id","doctor_id","full_name","mobile","role","password_hash","password_salt","must_change_password","status","created_at","last_sign_in_at","capabilities","qualification","registration_no","council","verification_status","verified_at","verified_by","hpr_id") VALUES('usr_demo_front','doc_demo','Latha Reddy','+919000000002','front_desk','323ad168eb7aaed8082cab2e5489f6b4b2878cc773fded4e614e2d7b59da4773','64aa4ae7fc3ef350f74790b204f37b3b',0,'active','2026-06-15 19:20:31','2026-09-08T14:39:13.427Z','["appointments","patients","billing","pharmacy"]',NULL,NULL,NULL,'unverified',NULL,NULL,NULL);
INSERT INTO "clinic_users" ("id","doctor_id","full_name","mobile","role","password_hash","password_salt","must_change_password","status","created_at","last_sign_in_at","capabilities","qualification","registration_no","council","verification_status","verified_at","verified_by","hpr_id") VALUES('usr_demo_pharmacy','doc_demo','Suresh Babu','+919000000003','pharmacist','3fe8d2cbd80008018a086ca34532162f07974d1b3bd1475faf44cd4618e518fd','022dcc3dd41c2e9e6fa987d9fa482939',0,'active','2026-07-05 19:20:31','2026-09-08T14:25:22.132Z','["pharmacy","patients","billing"]',NULL,NULL,NULL,'unverified',NULL,NULL,NULL);
INSERT INTO "clinic_users" ("id","doctor_id","full_name","mobile","role","password_hash","password_salt","must_change_password","status","created_at","last_sign_in_at","capabilities","qualification","registration_no","council","verification_status","verified_at","verified_by","hpr_id") VALUES('usr_demo_assistant','doc_demo','Priya Nair','+919000000004','assistant','efad0da694b34bb20f01e587bb9fb7c293292ca5ab88cbf08397134a115bc81f','4e6de4fc99efb5b893447d7cd1086e78',0,'active','2026-08-04 19:20:31','2026-09-08T14:25:22.209Z','["appointments","patients","vitals"]',NULL,NULL,NULL,'unverified',NULL,NULL,NULL);
INSERT INTO "clinic_users" ("id","doctor_id","full_name","mobile","role","password_hash","password_salt","must_change_password","status","created_at","last_sign_in_at","capabilities","qualification","registration_no","council","verification_status","verified_at","verified_by","hpr_id") VALUES('usr_demo_partner','doc_demo','Dr. Ramya Iyer','+919000000005','practitioner','5d321be34f46dd47b8d40aa09b22b34c1f5894c9512c1f6944d57444cd5d56ec','6d03d3f6264d2342b28ff3c8f52f1288',0,'active','2026-08-14 19:20:31','2026-09-08T16:57:53.872Z',NULL,'BAMS, MD (Ayurveda)','AYUSH-DEMO-5521','AYUSH / State Ayurveda Council','verified','2026-08-16 19:20:31','admin@tcos.demo',NULL);
CREATE TABLE support_requests (
  id          TEXT PRIMARY KEY,
  doctor_id   TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  created_by  TEXT NOT NULL,
  category    TEXT NOT NULL,
  subject     TEXT NOT NULL,
  message     TEXT NOT NULL,
  priority    TEXT NOT NULL DEFAULT 'normal',
  status      TEXT NOT NULL DEFAULT 'open',
  admin_note  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO "support_requests" ("id","doctor_id","created_by","category","subject","message","priority","status","admin_note","created_at","updated_at") VALUES('support_demo_1','doc_demo','doc_demo','feature','Enable WhatsApp reminders','Please enable reminders for tomorrow appointments.','normal','open',NULL,'2026-09-03 17:20:36','2026-09-03 17:20:36');
INSERT INTO "support_requests" ("id","doctor_id","created_by","category","subject","message","priority","status","admin_note","created_at","updated_at") VALUES('support_demo_2','doc_demo','doc_demo','verification','Verify medical registration certificate','Certificate uploaded from My Practice.','high','in_progress','Registration check started.','2026-09-01 19:20:36','2026-09-02 19:20:36');
INSERT INTO "support_requests" ("id","doctor_id","created_by","category","subject","message","priority","status","admin_note","created_at","updated_at") VALUES('support_demo_3','doc_demo','usr_demo_front','help','How do I correct a receipt?','Need help correcting the payment method on a receipt.','normal','resolved','Explained cancel-and-reissue workflow.','2026-08-26 19:20:36','2026-08-27 19:20:36');
CREATE TABLE doctor_applications (
  id               TEXT PRIMARY KEY,

  
  
  full_name        TEXT NOT NULL,
  mobile           TEXT NOT NULL,
  email            TEXT,
  qualification    TEXT,
  registration_no  TEXT,
  council          TEXT,                
  clinic_name      TEXT NOT NULL,
  city             TEXT,
  state            TEXT,

  
  
  
  discipline       TEXT NOT NULL DEFAULT 'ayurcos',

  
  
  
  
  facility_type    TEXT,                
  doctor_count     INTEGER,             
  staff_count      INTEGER,             

  message          TEXT,                
  source           TEXT,                

  
  
  
  status           TEXT NOT NULL DEFAULT 'new',
  review_note      TEXT,                
  rejection_reason TEXT,                
  reviewed_by      TEXT,                
  reviewed_at      TEXT,

  
  doctor_id        TEXT REFERENCES doctors(id) ON DELETE SET NULL,

  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE clinic_closures (
  id         TEXT PRIMARY KEY,
  doctor_id  TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,

  
  
  starts_on  TEXT NOT NULL,
  ends_on    TEXT NOT NULL,

  
  
  reason     TEXT,

  
  
  sessions   TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE cost_rates (
  id              TEXT PRIMARY KEY,     
  label           TEXT NOT NULL,        
  category        TEXT NOT NULL,        
  unit            TEXT NOT NULL,        
  paise_per_unit  INTEGER NOT NULL DEFAULT 0,
  note            TEXT,                 
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO "cost_rates" ("id","label","category","unit","paise_per_unit","note","updated_at") VALUES('storage_gb_month','File storage','storage','gb_month',132,'Cloudflare R2 $0.015/GB-month. First 10GB free ACROSS THE ACCOUNT, not per clinic.','2026-09-03 19:20:07');
INSERT INTO "cost_rates" ("id","label","category","unit","paise_per_unit","note","updated_at") VALUES('class_a_1k','File uploads','storage','per_1000',40,'R2 Class A $4.50/million. 1 million free per month.','2026-09-03 19:20:07');
INSERT INTO "cost_rates" ("id","label","category","unit","paise_per_unit","note","updated_at") VALUES('class_b_1k','File reads','storage','per_1000',4,'R2 Class B $0.36/million. 10 million free per month.','2026-09-03 19:20:07');
INSERT INTO "cost_rates" ("id","label","category","unit","paise_per_unit","note","updated_at") VALUES('rows_written_1k','Database writes','database','per_1000',9,'D1 $1.00 per million rows written. 50 million included on Workers Paid.','2026-09-03 19:20:07');
INSERT INTO "cost_rates" ("id","label","category","unit","paise_per_unit","note","updated_at") VALUES('rows_read_1k','Database reads','database','per_1000',1,'D1 $0.001 per million rows read. 25 billion included. Effectively free.','2026-09-03 19:20:07');
INSERT INTO "cost_rates" ("id","label","category","unit","paise_per_unit","note","updated_at") VALUES('whatsapp_message','WhatsApp message','messaging','each',55,'Meta conversation pricing via a BSP, India utility template. Varies 30-80 paise.','2026-09-03 19:20:07');
INSERT INTO "cost_rates" ("id","label","category","unit","paise_per_unit","note","updated_at") VALUES('sms_message','SMS','messaging','each',20,'Typical Indian transactional SMS. Excludes one-time DLT registration.','2026-09-03 19:20:07');
INSERT INTO "cost_rates" ("id","label","category","unit","paise_per_unit","note","updated_at") VALUES('ai_document','AI reading a document','ai','each',200,'One report read on gpt-5.4-mini, five pages per call: about ₹3 typical, ₹17 for a 21-page master check-up on the batch route. Measured, not estimated, and recorded per read on the draft.','2026-09-03 19:20:07');
INSERT INTO "cost_rates" ("id","label","category","unit","paise_per_unit","note","updated_at") VALUES('platform_workers','Cloudflare Workers Paid','platform','month',44000,'$5/month flat. Covers 10 million requests.','2026-09-03 19:20:07');
INSERT INTO "cost_rates" ("id","label","category","unit","paise_per_unit","note","updated_at") VALUES('platform_messaging_bsp','WhatsApp provider platform fee','platform','month',0,'Gupshup / Interakt / AiSensy monthly fee. Set once chosen; 0 until then.','2026-09-03 19:20:07');
INSERT INTO "cost_rates" ("id","label","category","unit","paise_per_unit","note","updated_at") VALUES('platform_domain','Domains','platform','month',400,'About ₹1,000-1,200 a year for .com plus .in, spread monthly.','2026-09-03 19:20:07');
INSERT INTO "cost_rates" ("id","label","category","unit","paise_per_unit","note","updated_at") VALUES('grace_days','Reserve days past a limit','platform','each',3,'Not money: the number of days a clinic keeps working after passing an allowance. Stored here so it can be changed without a deploy.','2026-09-03 19:20:08');
INSERT INTO "cost_rates" ("id","label","category","unit","paise_per_unit","note","updated_at") VALUES('ai_consult_minute','Consultation listened to','ai','minute',60,'Transcription plus the drafted note, per minute of consultation. Metered like any other AI work and stopped by the same spend guard.','2026-09-08 04:20:52');
CREATE TABLE plan_prices (
  plan           TEXT PRIMARY KEY,
  paise_monthly  INTEGER NOT NULL DEFAULT 0,
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO "plan_prices" ("plan","paise_monthly","updated_at") VALUES('basic',0,'2026-09-08 04:20:50');
INSERT INTO "plan_prices" ("plan","paise_monthly","updated_at") VALUES('starter',89900,'2026-09-08 04:20:50');
INSERT INTO "plan_prices" ("plan","paise_monthly","updated_at") VALUES('pro',219900,'2026-09-08 04:20:50');
INSERT INTO "plan_prices" ("plan","paise_monthly","updated_at") VALUES('pro_plus',449900,'2026-09-08 04:20:50');
INSERT INTO "plan_prices" ("plan","paise_monthly","updated_at") VALUES('clinic',219900,'2026-09-08 04:20:50');
CREATE TABLE plan_limits (
  plan           TEXT NOT NULL,
  limit_key      TEXT NOT NULL,   
  included       INTEGER NOT NULL DEFAULT 0,
  overage_paise  INTEGER NOT NULL DEFAULT 0,   
  hard_stop      INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (plan, limit_key)
);
INSERT INTO "plan_limits" ("plan","limit_key","included","overage_paise","hard_stop") VALUES('basic','patients',100,0,1);
INSERT INTO "plan_limits" ("plan","limit_key","included","overage_paise","hard_stop") VALUES('basic','staff',1,0,1);
INSERT INTO "plan_limits" ("plan","limit_key","included","overage_paise","hard_stop") VALUES('basic','doctors',1,0,1);
INSERT INTO "plan_limits" ("plan","limit_key","included","overage_paise","hard_stop") VALUES('basic','messages',0,0,1);
INSERT INTO "plan_limits" ("plan","limit_key","included","overage_paise","hard_stop") VALUES('basic','ai_documents',0,0,1);
INSERT INTO "plan_limits" ("plan","limit_key","included","overage_paise","hard_stop") VALUES('basic','storage_mb',200,0,1);
INSERT INTO "plan_limits" ("plan","limit_key","included","overage_paise","hard_stop") VALUES('starter','patients',2000,0,0);
INSERT INTO "plan_limits" ("plan","limit_key","included","overage_paise","hard_stop") VALUES('starter','staff',3,0,1);
INSERT INTO "plan_limits" ("plan","limit_key","included","overage_paise","hard_stop") VALUES('starter','doctors',1,0,1);
INSERT INTO "plan_limits" ("plan","limit_key","included","overage_paise","hard_stop") VALUES('starter','messages',100,150,0);
INSERT INTO "plan_limits" ("plan","limit_key","included","overage_paise","hard_stop") VALUES('starter','ai_documents',60,500,0);
INSERT INTO "plan_limits" ("plan","limit_key","included","overage_paise","hard_stop") VALUES('starter','storage_mb',5120,0,0);
INSERT INTO "plan_limits" ("plan","limit_key","included","overage_paise","hard_stop") VALUES('pro','patients',10000,0,0);
INSERT INTO "plan_limits" ("plan","limit_key","included","overage_paise","hard_stop") VALUES('pro','staff',8,0,1);
INSERT INTO "plan_limits" ("plan","limit_key","included","overage_paise","hard_stop") VALUES('pro','doctors',3,0,1);
INSERT INTO "plan_limits" ("plan","limit_key","included","overage_paise","hard_stop") VALUES('pro','messages',500,150,0);
INSERT INTO "plan_limits" ("plan","limit_key","included","overage_paise","hard_stop") VALUES('pro','ai_documents',250,500,0);
INSERT INTO "plan_limits" ("plan","limit_key","included","overage_paise","hard_stop") VALUES('pro','storage_mb',20480,0,0);
INSERT INTO "plan_limits" ("plan","limit_key","included","overage_paise","hard_stop") VALUES('pro_plus','patients',50000,0,0);
INSERT INTO "plan_limits" ("plan","limit_key","included","overage_paise","hard_stop") VALUES('pro_plus','staff',50,0,1);
INSERT INTO "plan_limits" ("plan","limit_key","included","overage_paise","hard_stop") VALUES('pro_plus','doctors',25,0,1);
INSERT INTO "plan_limits" ("plan","limit_key","included","overage_paise","hard_stop") VALUES('pro_plus','messages',1500,150,0);
INSERT INTO "plan_limits" ("plan","limit_key","included","overage_paise","hard_stop") VALUES('pro_plus','ai_documents',700,500,0);
INSERT INTO "plan_limits" ("plan","limit_key","included","overage_paise","hard_stop") VALUES('pro_plus','storage_mb',51200,0,0);
INSERT INTO "plan_limits" ("plan","limit_key","included","overage_paise","hard_stop") VALUES('clinic','patients',10000,0,0);
INSERT INTO "plan_limits" ("plan","limit_key","included","overage_paise","hard_stop") VALUES('clinic','staff',8,0,1);
INSERT INTO "plan_limits" ("plan","limit_key","included","overage_paise","hard_stop") VALUES('clinic','doctors',3,0,1);
INSERT INTO "plan_limits" ("plan","limit_key","included","overage_paise","hard_stop") VALUES('clinic','messages',500,150,0);
INSERT INTO "plan_limits" ("plan","limit_key","included","overage_paise","hard_stop") VALUES('clinic','ai_documents',250,500,0);
INSERT INTO "plan_limits" ("plan","limit_key","included","overage_paise","hard_stop") VALUES('clinic','storage_mb',20480,0,0);
CREATE TABLE plan_grace (
  doctor_id    TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  limit_key    TEXT NOT NULL,
  started_at   TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at   TEXT NOT NULL,
  
  
  usage_at_start INTEGER NOT NULL DEFAULT 0,
  notified_at  TEXT,
  PRIMARY KEY (doctor_id, limit_key)
);
CREATE TABLE files (
  id            TEXT PRIMARY KEY,
  doctor_id     TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,

  
  
  r2_key        TEXT NOT NULL UNIQUE,

  kind          TEXT NOT NULL,        
  original_name TEXT,                 
  content_type  TEXT NOT NULL,
  bytes         INTEGER NOT NULL,

  
  patient_id     TEXT REFERENCES patients(id) ON DELETE SET NULL,
  lab_report_id  TEXT REFERENCES lab_reports(id) ON DELETE SET NULL,

  uploaded_by   TEXT,                 
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),

  
  
  deleted_at    TEXT,
  deleted_by    TEXT,
  delete_reason TEXT
);
INSERT INTO "files" ("id","doctor_id","r2_key","kind","original_name","content_type","bytes","patient_id","lab_report_id","uploaded_by","created_at","deleted_at","deleted_by","delete_reason") VALUES('fil_df4018c203b041498de6cc01','doc_demo','doc_demo/lab_report/fil_df4018c203b041498de6cc01','lab_report','tcos-ai-smoke-vijay.pdf','application/pdf',3187,'pat_demo_vijay',NULL,'doctor:doc_demo','2026-09-08 04:51:17',NULL,NULL,NULL);
CREATE TABLE ai_drafts (
  id           TEXT PRIMARY KEY,
  doctor_id    TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id   TEXT REFERENCES patients(id) ON DELETE SET NULL,
  file_id      TEXT REFERENCES files(id) ON DELETE SET NULL,

  kind         TEXT NOT NULL DEFAULT 'lab_report',

  
  
  
  legible      INTEGER NOT NULL DEFAULT 1,
  legibility_problem TEXT,

  
  
  
  
  
  
  
  
  
  name_verdict TEXT,
  name_on_page TEXT,

  
  
  
  payload      TEXT NOT NULL,

  
  status       TEXT NOT NULL DEFAULT 'pending',
  lab_report_id TEXT REFERENCES lab_reports(id) ON DELETE SET NULL,
  reviewed_by  TEXT,
  reviewed_at  TEXT,
  reject_reason TEXT,

  
  input_tokens  INTEGER,
  cached_tokens INTEGER,
  output_tokens INTEGER,
  cost_paise    INTEGER,
  model         TEXT,

  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO "ai_drafts" ("id","doctor_id","patient_id","file_id","kind","legible","legibility_problem","name_verdict","name_on_page","payload","status","lab_report_id","reviewed_by","reviewed_at","reject_reason","input_tokens","cached_tokens","output_tokens","cost_paise","model","created_at") VALUES('draft_748d9b7a4f0f4c9c9abef84c','doc_demo','pat_demo_vijay','fil_df4018c203b041498de6cc01','lab_report',1,NULL,'not_checked','Vijay','{"legible":true,"legibility_problem":null,"headings_visible":[],"report_name":null,"reported_on":null,"patient":{"name":"Vijay","age":null,"sex":null,"id_on_report":null,"referred_by":null},"sample":{},"lab":{},"sections":[],"unrecognised":[{"label":"Pages with no values","text":"Page 2 produced no results. That is expected for a cover or a comments page, but worth a look if you were expecting figures there.","page":2}],"pages_read":[2],"pages_without_values":[2],"missed_headings":[],"row_count":0}','pending',NULL,NULL,NULL,NULL,812,0,223,41,'gpt-5.6-terra','2026-09-08 12:44:50');
INSERT INTO "ai_drafts" ("id","doctor_id","patient_id","file_id","kind","legible","legibility_problem","name_verdict","name_on_page","payload","status","lab_report_id","reviewed_by","reviewed_at","reject_reason","input_tokens","cached_tokens","output_tokens","cost_paise","model","created_at") VALUES('draft_7d7cc15b35cf493eb909842f','doc_demo','pat_demo_vijay','fil_df4018c203b041498de6cc01','lab_report',1,NULL,'not_checked','Vijay','{"legible":true,"legibility_problem":null,"headings_visible":["Test Result Reference range"],"report_name":null,"reported_on":"08 September 2026","patient":{"name":"Vijay","age":null,"sex":null,"id_on_report":null,"referred_by":null},"sample":{"collected_at":"08 September 2026 08:15","received_at":null,"type":null},"lab":{"name":"THARIGOPULA DEMO DIAGNOSTICS","accreditation":null,"signed_by":null},"sections":[{"title":"Test Result Reference range","pages":[2],"rows":[{"analyte":"Haemoglobin","value":"14.2","unit":"g/dL","reference":"13.0 - 17.0 g/dL","method":null,"flag":null,"page":2,"confidence":"high"},{"analyte":"Fasting glucose","value":"92","unit":"mg/dL","reference":"70 - 99 mg/dL","method":null,"flag":null,"page":2,"confidence":"high"},{"analyte":"Creatinine","value":"0.9","unit":"mg/dL","reference":"0.7 - 1.3 mg/dL","method":null,"flag":null,"page":2,"confidence":"high"},{"analyte":"TSH","value":"2.40","unit":"uIU/mL","reference":"0.40 - 4.50 uIU/mL","method":null,"flag":null,"page":2,"confidence":"high"}]}],"unrecognised":[],"pages_read":[2],"pages_without_values":[],"missed_headings":[],"row_count":4}','pending',NULL,NULL,NULL,NULL,844,0,618,86,'gpt-5.6-terra','2026-09-08 12:49:16');
CREATE TABLE ai_preflights (
  id                TEXT PRIMARY KEY,
  doctor_id         TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id        TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  file_id           TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  registered_name   TEXT NOT NULL,
  name_on_document  TEXT,
  name_verdict      TEXT NOT NULL,
  name_reason       TEXT,
  legible           INTEGER NOT NULL DEFAULT 1,
  legibility_problem TEXT,
  page_count        INTEGER,
  clinical_pages    TEXT NOT NULL DEFAULT '[]',
  excluded_pages    TEXT NOT NULL DEFAULT '[]',
  page_inventory    TEXT NOT NULL DEFAULT '[]',
  status            TEXT NOT NULL,
  confirmed_by      TEXT,
  confirmation_note TEXT,
  confirmed_at      TEXT,
  consumed_at       TEXT,
  input_tokens      INTEGER NOT NULL DEFAULT 0,
  cached_tokens     INTEGER NOT NULL DEFAULT 0,
  output_tokens     INTEGER NOT NULL DEFAULT 0,
  cost_paise        INTEGER NOT NULL DEFAULT 0,
  model             TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (name_verdict IN ('same_person','needs_confirmation','different_person','no_name_on_document')),
  CHECK (status IN ('approved','awaiting_confirmation','blocked','rejected'))
);
INSERT INTO "ai_preflights" ("id","doctor_id","patient_id","file_id","registered_name","name_on_document","name_verdict","name_reason","legible","legibility_problem","page_count","clinical_pages","excluded_pages","page_inventory","status","confirmed_by","confirmation_note","confirmed_at","consumed_at","input_tokens","cached_tokens","output_tokens","cost_paise","model","created_at") VALUES('pre_560d95ed85e44f4e81d45908','doc_demo','pat_demo_vijay','fil_df4018c203b041498de6cc01','Vijay','Vijay','same_person','The patient name is printed exactly as "Vijay", matching the registered name exactly.',1,NULL,3,'[2]','[1,3]','[{"page":1,"category":"advertisement","process":false,"duplicate_of":null,"reason":"Explicit promotional wellness package offer; not a clinical report."},{"page":2,"category":"clinical_result","process":true,"duplicate_of":null,"reason":"Unique patient clinical-results page identifying the patient as Vijay."},{"page":3,"category":"advertisement","process":false,"duplicate_of":null,"reason":"Explicit advertisement with no patient results."}]','approved',NULL,NULL,NULL,'2026-09-08T12:44:51.103Z',752,0,284,5,'gpt-5.6-luna','2026-09-08 12:44:42');
INSERT INTO "ai_preflights" ("id","doctor_id","patient_id","file_id","registered_name","name_on_document","name_verdict","name_reason","legible","legibility_problem","page_count","clinical_pages","excluded_pages","page_inventory","status","confirmed_by","confirmation_note","confirmed_at","consumed_at","input_tokens","cached_tokens","output_tokens","cost_paise","model","created_at") VALUES('pre_dc623eafef9f4237b206cac6','doc_demo','pat_demo_vijay','fil_df4018c203b041498de6cc01','Vijay','Vijay','same_person','The patient name printed on page 2 is exactly "Vijay", matching the registered name after applying the permitted normalization.',1,NULL,3,'[2]','[1,3]','[{"page":1,"category":"advertisement","process":false,"duplicate_of":null,"reason":"Promotional wellness package material; not a clinical report."},{"page":2,"category":"clinical_result","process":true,"duplicate_of":null,"reason":"Unique clinical laboratory result page identifying the patient as Vijay."},{"page":3,"category":"advertisement","process":false,"duplicate_of":null,"reason":"Advertisement/thank-you page with no patient results."}]','approved',NULL,NULL,NULL,'2026-09-08T12:49:17.263Z',752,0,292,5,'gpt-5.6-luna','2026-09-08 12:49:03');
CREATE TABLE ai_spend (
  id            TEXT PRIMARY KEY,
  doctor_id     TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,

  kind          TEXT NOT NULL,        
  model         TEXT,

  
  
  input_tokens  INTEGER NOT NULL DEFAULT 0,
  cached_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_paise    INTEGER NOT NULL DEFAULT 0,

  
  
  
  
  outcome       TEXT NOT NULL DEFAULT 'ok',
  detail        TEXT,
  duration_ms   INTEGER,

  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
, batched INTEGER NOT NULL DEFAULT 0);
INSERT INTO "ai_spend" ("id","doctor_id","kind","model","input_tokens","cached_tokens","output_tokens","cost_paise","outcome","detail","duration_ms","created_at","batched") VALUES('spend_d8d191e086f94887ab775eb4','doc_demo','preflight',NULL,0,0,0,0,'failed','Incorrect API key provided: Extend. You can find your API key at https://platform.openai.com/account/api-keys.',629,'2026-09-08 04:51:22',0);
INSERT INTO "ai_spend" ("id","doctor_id","kind","model","input_tokens","cached_tokens","output_tokens","cost_paise","outcome","detail","duration_ms","created_at","batched") VALUES('spend_0ecdc701c97b431bbe3790b7','doc_demo','preflight',NULL,0,0,0,0,'failed','Automatic document reading is not switched on yet. Set the OPENAI_API_KEY secret.',0,'2026-09-08 12:43:43',0);
INSERT INTO "ai_spend" ("id","doctor_id","kind","model","input_tokens","cached_tokens","output_tokens","cost_paise","outcome","detail","duration_ms","created_at","batched") VALUES('spend_e48f5283e29e49f7821abcda','doc_demo','preflight','gpt-5.6-luna',752,0,284,5,'ok',NULL,7527,'2026-09-08 12:44:42',0);
INSERT INTO "ai_spend" ("id","doctor_id","kind","model","input_tokens","cached_tokens","output_tokens","cost_paise","outcome","detail","duration_ms","created_at","batched") VALUES('spend_68b01ae0a7c9439e8f0455a1','doc_demo','preflight','gpt-5.6-luna',752,0,292,5,'ok',NULL,4833,'2026-09-08 12:49:03',0);
CREATE TABLE ai_breaker (
  
  
  scope         TEXT PRIMARY KEY,

  
  
  
  state         TEXT NOT NULL DEFAULT 'closed',

  reason        TEXT,                 
  tripped_at    TEXT,
  
  
  resets_at     TEXT,
  window_paise  INTEGER,              
  notified_at   TEXT,                 
  cleared_at    TEXT,
  cleared_by    TEXT
);
CREATE TABLE ai_queue (
  id            TEXT PRIMARY KEY,
  doctor_id     TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id    TEXT REFERENCES patients(id) ON DELETE SET NULL,
  file_id       TEXT REFERENCES files(id) ON DELETE SET NULL,
  kind          TEXT NOT NULL DEFAULT 'preflight',

  
  status        TEXT NOT NULL DEFAULT 'waiting',
  attempts      INTEGER NOT NULL DEFAULT 0,
  last_error    TEXT,

  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at  TEXT
, batch_id TEXT, provider_status TEXT, preflight_id TEXT, urgency TEXT NOT NULL DEFAULT 'normal', draft_id TEXT, provider_input_file_id TEXT, provider_output_file_id TEXT, provider_error_file_id TEXT, provider_cleanup_status TEXT NOT NULL DEFAULT 'not_needed', provider_cleanup_error TEXT, provider_cleanup_attempts INTEGER NOT NULL DEFAULT 0, provider_cleanup_last_attempt_at TEXT, provider_files_deleted_at TEXT);
CREATE TABLE ai_limits (
  key           TEXT PRIMARY KEY,
  value_paise   INTEGER NOT NULL,
  note          TEXT
);
INSERT INTO "ai_limits" ("key","value_paise","note") VALUES('call_ceiling',2500,'Most a single document may cost. A normal report is 300-500 paise; 2500 means something is wrong with the document, not with the clinic.');
INSERT INTO "ai_limits" ("key","value_paise","note") VALUES('clinic_hour',15000,'Most one clinic may spend in a rolling hour. About 40 reports - more than any real clinic reads in an hour.');
INSERT INTO "ai_limits" ("key","value_paise","note") VALUES('clinic_day',60000,'Most one clinic may spend in a rolling day.');
INSERT INTO "ai_limits" ("key","value_paise","note") VALUES('platform_hour',100000,'Most every clinic together may spend in a rolling hour. This is the one that catches a bug in OUR code rather than misuse in theirs.');
INSERT INTO "ai_limits" ("key","value_paise","note") VALUES('platform_day',400000,'Most every clinic together may spend in a rolling day. Roughly a month of expected volume, so tripping it means something is badly wrong.');
CREATE TABLE abdm_care_contexts (
  id            TEXT PRIMARY KEY,
  doctor_id     TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id    TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  
  record_type   TEXT NOT NULL,
  record_id     TEXT NOT NULL,

  
  reference     TEXT NOT NULL,
  display       TEXT NOT NULL,

  
  status        TEXT NOT NULL DEFAULT 'pending',
  linked_at     TEXT,
  last_error    TEXT,
  attempts      INTEGER NOT NULL DEFAULT 0,

  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE messages (
  id            TEXT PRIMARY KEY,
  doctor_id     TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id    TEXT REFERENCES patients(id) ON DELETE SET NULL,

  channel       TEXT NOT NULL DEFAULT 'whatsapp',
  template      TEXT NOT NULL,          
  to_mobile     TEXT NOT NULL,

  
  
  
  body_preview  TEXT,

  
  about_type    TEXT,                   
  about_id      TEXT,

  
  status        TEXT NOT NULL DEFAULT 'queued',
  provider_id   TEXT,                   
  error         TEXT,

  
  dedupe_key    TEXT NOT NULL UNIQUE,

  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at       TEXT,
  updated_at    TEXT
);
CREATE TABLE consult_notes (
  id            TEXT PRIMARY KEY,
  doctor_id     TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id    TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  
  visit_id      TEXT REFERENCES visits(id) ON DELETE SET NULL,

  
  
  
  
  consent_at    TEXT NOT NULL,
  consent_by    TEXT NOT NULL,          

  
  
  
  audio_key     TEXT,
  audio_seconds INTEGER,
  audio_deleted_at TEXT,

  
  
  
  
  
  language      TEXT,
  transcript    TEXT,

  
  
  
  complaints    TEXT,
  history       TEXT,
  examination   TEXT,
  advice        TEXT,
  follow_up     TEXT,

  
  status        TEXT NOT NULL DEFAULT 'recording',
  error         TEXT,
  cost_paise    INTEGER NOT NULL DEFAULT 0,

  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT
, speakers TEXT, speaker_confidence TEXT NOT NULL DEFAULT 'unclear');
CREATE TABLE subscription_plan_catalog (
  id                TEXT PRIMARY KEY,
  provider          TEXT NOT NULL DEFAULT 'razorpay',
  plan              TEXT NOT NULL,
  cadence           TEXT NOT NULL,
  price_paise       INTEGER NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'INR',
  provider_plan_id  TEXT,
  active            INTEGER NOT NULL DEFAULT 1,
  synced_at         TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (provider, provider_plan_id),
  UNIQUE (provider, plan, cadence, price_paise),
  CHECK (plan IN ('starter','pro','pro_plus')),
  CHECK (cadence IN ('monthly','yearly')),
  CHECK (price_paise > 0)
);
INSERT INTO "subscription_plan_catalog" ("id","provider","plan","cadence","price_paise","currency","provider_plan_id","active","synced_at","created_at","updated_at") VALUES('rzp_starter_monthly_v1','razorpay','starter','monthly',89900,'INR',NULL,1,NULL,'2026-09-08 15:33:44','2026-09-08 15:33:44');
INSERT INTO "subscription_plan_catalog" ("id","provider","plan","cadence","price_paise","currency","provider_plan_id","active","synced_at","created_at","updated_at") VALUES('rzp_starter_yearly_v1','razorpay','starter','yearly',899000,'INR',NULL,1,NULL,'2026-09-08 15:33:44','2026-09-08 15:33:44');
INSERT INTO "subscription_plan_catalog" ("id","provider","plan","cadence","price_paise","currency","provider_plan_id","active","synced_at","created_at","updated_at") VALUES('rzp_pro_monthly_v1','razorpay','pro','monthly',219900,'INR',NULL,1,NULL,'2026-09-08 15:33:44','2026-09-08 15:33:44');
INSERT INTO "subscription_plan_catalog" ("id","provider","plan","cadence","price_paise","currency","provider_plan_id","active","synced_at","created_at","updated_at") VALUES('rzp_pro_yearly_v1','razorpay','pro','yearly',2199000,'INR',NULL,1,NULL,'2026-09-08 15:33:44','2026-09-08 15:33:44');
INSERT INTO "subscription_plan_catalog" ("id","provider","plan","cadence","price_paise","currency","provider_plan_id","active","synced_at","created_at","updated_at") VALUES('rzp_pro_plus_monthly_v1','razorpay','pro_plus','monthly',449900,'INR',NULL,1,NULL,'2026-09-08 15:33:44','2026-09-08 15:33:44');
INSERT INTO "subscription_plan_catalog" ("id","provider","plan","cadence","price_paise","currency","provider_plan_id","active","synced_at","created_at","updated_at") VALUES('rzp_pro_plus_yearly_v1','razorpay','pro_plus','yearly',4499000,'INR',NULL,1,NULL,'2026-09-08 15:33:44','2026-09-08 15:33:44');
CREATE TABLE subscriptions (
  id                        TEXT PRIMARY KEY,
  doctor_id                 TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  provider                  TEXT NOT NULL DEFAULT 'razorpay',
  provider_subscription_id  TEXT NOT NULL,
  provider_plan_id          TEXT NOT NULL,
  plan                      TEXT NOT NULL,
  cadence                   TEXT NOT NULL,
  price_paise               INTEGER NOT NULL,
  currency                  TEXT NOT NULL DEFAULT 'INR',
  status                    TEXT NOT NULL DEFAULT 'created',
  checkout_url              TEXT,
  current_start             TEXT,
  current_end               TEXT,
  access_until              TEXT,
  cancel_at_cycle_end       INTEGER NOT NULL DEFAULT 0,
  last_provider_event_at    INTEGER,
  created_at                TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (provider, provider_subscription_id),
  CHECK (plan IN ('starter','pro','pro_plus')),
  CHECK (cadence IN ('monthly','yearly')),
  CHECK (status IN ('created','authenticated','active','pending','halted',
                    'paused','cancelled','completed','expired'))
);
CREATE TABLE payment_webhook_events (
  provider          TEXT NOT NULL,
  event_id          TEXT NOT NULL,
  event_type        TEXT NOT NULL,
  payload_sha256    TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'received',
  attempts          INTEGER NOT NULL DEFAULT 0,
  last_error        TEXT,
  received_at       TEXT NOT NULL DEFAULT (datetime('now')),
  last_attempt_at   TEXT,
  processed_at      TEXT,
  PRIMARY KEY (provider, event_id),
  CHECK (status IN ('received','processing','processed','ignored','failed'))
);
CREATE TABLE subscription_payments (
  id                    TEXT PRIMARY KEY,
  doctor_id             TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  subscription_id       TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  provider              TEXT NOT NULL DEFAULT 'razorpay',
  provider_payment_id   TEXT NOT NULL,
  provider_invoice_id   TEXT,
  amount_paise          INTEGER NOT NULL DEFAULT 0,
  currency              TEXT NOT NULL DEFAULT 'INR',
  status                TEXT NOT NULL,
  occurred_at           TEXT,
  recorded_at           TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (provider, provider_payment_id)
);
CREATE TABLE stock_operations (
  id             TEXT PRIMARY KEY,
  doctor_id      TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  operation_key  TEXT NOT NULL,
  kind           TEXT NOT NULL,
  target_id      TEXT,
  quantity       REAL,
  result_json    TEXT NOT NULL DEFAULT '{}',
  actor          TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (doctor_id, operation_key)
);
CREATE TABLE patient_registration_operations (
  id             TEXT PRIMARY KEY,
  doctor_id      TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  operation_key  TEXT NOT NULL,
  patient_id     TEXT REFERENCES patients(id) ON DELETE SET NULL,
  local_ref      TEXT,
  actor          TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (doctor_id, operation_key)
);
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('d1_migrations',45);
CREATE INDEX idx_doctors_mobile ON doctors(mobile);
CREATE INDEX idx_sessions_doctor ON sessions(doctor_id);
CREATE INDEX idx_otp_mobile_purpose ON otp_codes(mobile, purpose);
CREATE INDEX idx_dp_doctor ON doctor_patients(doctor_id);
CREATE INDEX idx_dp_patient ON doctor_patients(patient_id);
CREATE INDEX idx_visits_doctor ON visits(doctor_id);
CREATE INDEX idx_visits_patient ON visits(patient_id, visited_on);
CREATE INDEX idx_rx_doctor ON prescriptions(doctor_id);
CREATE INDEX idx_rx_patient ON prescriptions(patient_id, issued_on);
CREATE INDEX idx_rxi_prescription ON prescription_items(prescription_id);
CREATE INDEX idx_lab_doctor ON lab_reports(doctor_id);
CREATE INDEX idx_lab_patient ON lab_reports(patient_id, reported_on);
CREATE INDEX idx_labval_report ON lab_values(lab_report_id);
CREATE INDEX idx_stock_doctor ON stock_items(doctor_id);
CREATE INDEX idx_batch_item ON stock_batches(stock_item_id);
CREATE INDEX idx_batch_expiry ON stock_batches(doctor_id, expires_on);
CREATE INDEX idx_move_doctor ON stock_movements(doctor_id, moved_at);
CREATE INDEX idx_consent_lookup
  ON consent_grants(patient_id, granted_to_doctor, expires_at);
CREATE INDEX idx_calog_patient ON consent_access_log(patient_id, accessed_at);
CREATE INDEX idx_audit_doctor ON audit_events(doctor_id, created_at);
CREATE INDEX idx_usage_doctor ON usage_events(doctor_id, occurred_at);
CREATE INDEX idx_invoices_doctor  ON invoices(doctor_id, issued_on DESC);
CREATE INDEX idx_invoices_patient ON invoices(doctor_id, patient_id);
CREATE UNIQUE INDEX idx_invoice_no
  ON invoices(doctor_id, invoice_no) WHERE invoice_no IS NOT NULL;
CREATE INDEX idx_invoice_items ON invoice_items(invoice_id, sort_order);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payments_doctor  ON payments(doctor_id, received_on DESC);
CREATE INDEX idx_fee_items ON fee_items(doctor_id, active);
CREATE INDEX idx_admin_sessions_email ON admin_sessions(email);
CREATE INDEX idx_invites_doctor ON doctor_invites(doctor_id);
CREATE INDEX idx_rx_status ON prescriptions(doctor_id, status, issued_on);
CREATE INDEX idx_move_rxitem ON stock_movements(prescription_item_id);
CREATE INDEX idx_pal_patient ON patient_access_links(patient_id);
CREATE INDEX idx_pal_doctor ON patient_access_links(doctor_id);
CREATE INDEX idx_patients_mobile ON patients(mobile);
CREATE INDEX idx_patients_code ON patients(patient_code);
CREATE UNIQUE INDEX idx_patients_household
  ON patients(mobile, full_name);
CREATE INDEX idx_appt_day ON appointments(doctor_id, scheduled_on, scheduled_at);
CREATE INDEX idx_appt_patient ON appointments(patient_id, scheduled_on);
CREATE INDEX idx_appt_status ON appointments(doctor_id, status, scheduled_on);
CREATE UNIQUE INDEX idx_appt_one_per_visit
  ON appointments(from_visit_id) WHERE from_visit_id IS NOT NULL;
CREATE UNIQUE INDEX idx_doctors_slug ON doctors(public_slug)
  WHERE public_slug IS NOT NULL;
CREATE UNIQUE INDEX idx_doctors_domain ON doctors(custom_domain)
  WHERE custom_domain IS NOT NULL;
CREATE INDEX idx_reqs_doctor ON appointment_requests(doctor_id, status, created_at);
CREATE INDEX idx_reqs_mobile ON appointment_requests(mobile, created_at);
CREATE INDEX idx_drug_system ON drug_catalogue(system, popularity DESC);
CREATE INDEX idx_drug_name   ON drug_catalogue(name);
CREATE INDEX idx_strength_drug ON drug_strengths(drug_id, weight DESC);
CREATE UNIQUE INDEX idx_dp_local_ref
  ON doctor_patients(doctor_id, local_ref) WHERE local_ref IS NOT NULL;
CREATE INDEX idx_clinic_users_doctor ON clinic_users(doctor_id, status);
CREATE INDEX idx_support_doctor ON support_requests(doctor_id, created_at DESC);
CREATE INDEX idx_support_status ON support_requests(status, created_at DESC);
CREATE INDEX idx_doctors_product ON doctors(product);
CREATE INDEX idx_applications_status
  ON doctor_applications(status, created_at DESC);
CREATE UNIQUE INDEX idx_applications_open_mobile
  ON doctor_applications(mobile) WHERE status IN ('new', 'reviewing');
CREATE INDEX idx_doctors_verification
  ON doctors(verification_status);
CREATE INDEX idx_closures_doctor
  ON clinic_closures(doctor_id, starts_on, ends_on);
CREATE UNIQUE INDEX idx_doctors_custom_domain
  ON doctors(custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX idx_doctors_domain_status
  ON doctors(custom_domain_status);
CREATE INDEX idx_visits_practitioner
  ON visits(doctor_id, practitioner_id, visited_on);
CREATE INDEX idx_rx_practitioner
  ON prescriptions(doctor_id, practitioner_id, issued_on);
CREATE INDEX idx_usage_month
  ON usage_events(occurred_at, doctor_id, event_type);
CREATE INDEX idx_grace_expiry ON plan_grace(expires_at);
CREATE INDEX idx_files_doctor ON files(doctor_id, created_at DESC);
CREATE INDEX idx_files_patient ON files(doctor_id, patient_id);
CREATE INDEX idx_files_lab ON files(lab_report_id);
CREATE INDEX idx_drafts_doctor
  ON ai_drafts(doctor_id, status, created_at DESC);
CREATE INDEX idx_drafts_patient
  ON ai_drafts(doctor_id, patient_id);
CREATE INDEX idx_drafts_name_check
  ON ai_drafts(doctor_id, status, name_verdict);
CREATE INDEX idx_ai_preflights_doctor
  ON ai_preflights(doctor_id, status, created_at DESC);
CREATE INDEX idx_ai_preflights_file
  ON ai_preflights(doctor_id, file_id, patient_id);
CREATE INDEX idx_spend_doctor_time ON ai_spend(doctor_id, created_at DESC);
CREATE INDEX idx_spend_time        ON ai_spend(created_at DESC);
CREATE INDEX idx_queue_waiting ON ai_queue(status, created_at);
CREATE INDEX idx_queue_doctor  ON ai_queue(doctor_id, status);
CREATE INDEX idx_queue_batch ON ai_queue(batch_id);
CREATE INDEX idx_patients_abha ON patients(abha_number);
CREATE INDEX idx_cc_doctor ON abdm_care_contexts(doctor_id, status);
CREATE INDEX idx_cc_patient ON abdm_care_contexts(doctor_id, patient_id);
CREATE UNIQUE INDEX idx_cc_record
  ON abdm_care_contexts(doctor_id, record_type, record_id);
CREATE INDEX idx_doctors_verify_by
  ON doctors(verification_status, verify_by);
CREATE INDEX idx_msg_doctor  ON messages(doctor_id, created_at);
CREATE INDEX idx_msg_patient ON messages(doctor_id, patient_id);
CREATE INDEX idx_msg_about   ON messages(about_type, about_id);
CREATE INDEX idx_msg_provider
  ON messages(provider_id) WHERE provider_id IS NOT NULL;
CREATE INDEX idx_cn_doctor  ON consult_notes(doctor_id, status, created_at);
CREATE INDEX idx_cn_patient ON consult_notes(doctor_id, patient_id);
CREATE INDEX idx_cn_audio
  ON consult_notes(audio_key) WHERE audio_key IS NOT NULL;
CREATE INDEX idx_queue_provider_cleanup
  ON ai_queue(doctor_id, provider_cleanup_status, provider_status);
CREATE UNIQUE INDEX idx_subscription_catalog_one_active
  ON subscription_plan_catalog(provider, plan, cadence) WHERE active = 1;
CREATE INDEX idx_subscriptions_doctor
  ON subscriptions(doctor_id, created_at DESC);
CREATE INDEX idx_subscriptions_access
  ON subscriptions(status, access_until);
CREATE UNIQUE INDEX idx_subscriptions_one_open
  ON subscriptions(doctor_id)
  WHERE status IN ('created','authenticated','active','pending','halted','paused');
CREATE INDEX idx_payment_events_retry
  ON payment_webhook_events(status, last_attempt_at);
CREATE INDEX idx_subscription_payments_doctor
  ON subscription_payments(doctor_id, occurred_at DESC);
CREATE UNIQUE INDEX idx_lab_report_idempotency
  ON lab_reports(doctor_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX idx_payments_idempotency
  ON payments(doctor_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX idx_appointments_one_per_request
  ON appointments(doctor_id, request_id)
  WHERE request_id IS NOT NULL;
CREATE INDEX idx_stock_operations_doctor
  ON stock_operations(doctor_id, created_at);
CREATE INDEX idx_stock_movements_operation
  ON stock_movements(doctor_id, operation_id);
CREATE INDEX idx_patient_registration_doctor
  ON patient_registration_operations(doctor_id, created_at);
CREATE UNIQUE INDEX idx_visits_idempotency
  ON visits(doctor_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX idx_prescriptions_idempotency
  ON prescriptions(doctor_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE TRIGGER trg_stock_movement_positive
BEFORE INSERT ON stock_movements
WHEN NEW.quantity <= 0
BEGIN
  SELECT RAISE(ABORT, 'stock movement quantity must be positive');
END;
CREATE TRIGGER trg_stock_dispense_usable
BEFORE INSERT ON stock_movements
WHEN NEW.direction = 'out' AND NOT EXISTS (
  SELECT 1 FROM stock_batches b
   WHERE b.id = NEW.batch_id
     AND b.doctor_id = NEW.doctor_id
     AND b.quantity >= NEW.quantity
     AND b.expires_on >= date('now')
     AND b.quarantined_at IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'stock batch is no longer usable or sufficient');
END;
CREATE TRIGGER trg_stock_writeoff_matches
BEFORE INSERT ON stock_movements
WHEN NEW.direction = 'expired' AND NOT EXISTS (
  SELECT 1 FROM stock_batches b
   WHERE b.id = NEW.batch_id
     AND b.doctor_id = NEW.doctor_id
     AND b.quantity = NEW.quantity
     AND b.quantity > 0
)
BEGIN
  SELECT RAISE(ABORT, 'stock batch changed before write-off');
END;

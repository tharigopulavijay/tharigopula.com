-- Creates only the fictional tenant needed before the shared demonstration seed.
INSERT OR IGNORE INTO doctors
  (id,mobile,mobile_verified,email,full_name,qualification,registration_no,clinic_name,tagline,address,patient_prefix,practice_packs,line,plan,status,password_hash,password_salt)
VALUES
  ('doc_demo','+919000000001',1,'doctor@ayurcos.demo','Dr. Sri Devi','BAMS, MD (Ayurveda)','AYUSH-DEMO-2048','AyurCOS Demonstration Clinic','Classical Ayurveda with connected follow-up care','Hyderabad, Telangana','DEMO','["ayurveda","nadi","yoga","referral"]','doctor','clinic','active','330b19107f1eea5b96c9cd0112767a6e6d4042f033a2871ba91013fd9b58df44','00112233445566778899aabbccddeeff');

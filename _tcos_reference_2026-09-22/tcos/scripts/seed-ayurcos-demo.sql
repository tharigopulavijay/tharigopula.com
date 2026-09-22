-- AyurCOS fictional demonstration overlay. Run after the standard TCOS demo seeds.
-- No row in this file is real clinical or patient information.

INSERT OR IGNORE INTO doctors
  (id,mobile,mobile_verified,email,full_name,qualification,registration_no,clinic_name,tagline,address,patient_prefix,practice_packs,line,plan,status)
VALUES
  ('doc_demo','+919000000001',1,'doctor@ayurcos.demo','Dr. Sri Devi','BAMS, MD (Ayurveda)','AYUSH-DEMO-2048','AyurCOS Demonstration Clinic','Classical Ayurveda with connected follow-up care','Hyderabad, Telangana','DEMO','["ayurveda","nadi","yoga","referral"]','doctor','clinic','active');

UPDATE doctors SET
  full_name = 'Dr. Sri Devi',
  qualification = 'BAMS, MD (Ayurveda)',
  registration_no = 'AYUSH-DEMO-2048',
  clinic_name = 'AyurCOS Demonstration Clinic',
  tagline = 'Classical Ayurveda with connected follow-up care',
  patient_prefix = 'DEMO',
  practice_packs = '["ayurveda","nadi","yoga","referral"]',
  -- The clinic's website, on. This seed used to switch it off and null the
  -- slug, which is why nobody could find the feature: it was built, hidden
  -- in the UI, and disabled in the data. A doctor's own web address is one
  -- of the more sellable things TCOS does, so the demo shows it working.
  public_page_on = 1,
  public_slug = 'ayurcos-demo-clinic',
  public_intro = 'Classical Ayurveda with connected follow-up care. Prakriti and Nadi assessment, in-house pharmacy, and a record you can read at home.'
WHERE id = 'doc_demo';

UPDATE visits SET
  complaints = 'Amlapitta symptoms, irregular appetite and disturbed sleep',
  diagnosis = 'Amlapitta with Pitta-Vata aggravation',
  findings = '{"ayurveda-assessment.Prakriti":"Pitta–Vata","ayurveda-assessment.Vikriti":"Pitta predominance with Vata association","ayurveda-assessment.Dosha status":"Pitta ↑, Vata mild ↑","ayurveda-assessment.Agni":"Vishama–Tikshna","ayurveda-assessment.Koshtha":"Madhyama","ayurveda-assessment.Ama":"Mild","ayurveda-assessment.Srotas involved":"Annavaha, Purishavaha","nadi.Nadi — left":"Pitta–Vata","nadi.Nadi — right":"Vata–Pitta","nadi.Gati":"Manduka / Sarpa mixed","ahara-vihara.Sleep":"Interrupted; 5–6 hours","ahara-vihara.Pathya":"Warm freshly prepared food; regular meal timing","ahara-vihara.Apathya":"Late meals, excess chilli, sour and fried foods","care.investigations":"CBC, LFT and HbA1c before next review","care.referrals":"Physician co-management if warning symptoms persist"}',
  advice = 'Pathya: warm simple meals at regular times. Apathya: late meals, excess chilli, sour and fried food. Gentle walk after meals; Nadi Shodhana 8 minutes daily.'
WHERE id = 'visit_demo_vijay_2';

UPDATE prescriptions SET rx_number = REPLACE(rx_number, 'TCOS/', 'AYUR/')
WHERE doctor_id = 'doc_demo' AND rx_number LIKE 'TCOS/%';

DELETE FROM prescription_items WHERE id LIKE 'rxi_ayurcos_%';
INSERT INTO prescription_items
  (id,prescription_id,doctor_id,medicine_name,system,dose,frequency,duration,instructions,attributes,sort_order,dispense_quantity,stock_item_id)
VALUES
 ('rxi_ayurcos_1','rx_demo_1','doc_demo','Avipattikara Churna','ayurveda','3 g','Twice daily','30 days','With warm water, 20 minutes before food','{"anupana":"warm water","form":"churna"}',10,180,NULL),
 ('rxi_ayurcos_2','rx_demo_1','doc_demo','Guduchi Ghana Vati 500 mg','ayurveda','1 tablet','Twice daily','30 days','After food with warm water','{"form":"vati"}',11,60,NULL),
 ('rxi_ayurcos_3','rx_demo_1','doc_demo','Yashtimadhu Churna','ayurveda','2 g','Twice daily','21 days','With lukewarm milk when tolerated','{"anupana":"lukewarm milk","form":"churna"}',12,84,NULL),
 ('rxi_ayurcos_4','rx_demo_1','doc_demo','Drakshasava','ayurveda','15 ml','Twice daily','30 days','Dilute with equal water after food','{"form":"asava-arishta"}',13,900,NULL),
 ('rxi_ayurcos_5','rx_demo_1','doc_demo','Ksheerabala Taila','ayurveda','External application','Once nightly','21 days','Gentle local application; avoid if irritation occurs','{"form":"taila"}',14,1,NULL);

DELETE FROM stock_batches WHERE id LIKE 'batch_ayurcos_%';
DELETE FROM stock_items WHERE id LIKE 'stock_ayurcos_%';
INSERT INTO stock_items (id,doctor_id,medicine_name,system,form,unit,reorder_level) VALUES
 ('stock_ayurcos_avip','doc_demo','Avipattikara Churna','ayurveda','churna','gram',500),
 ('stock_ayurcos_guduchi','doc_demo','Guduchi Ghana Vati 500 mg','ayurveda','vati','tablet',200),
 ('stock_ayurcos_draksha','doc_demo','Drakshasava','ayurveda','asava','ml',2000),
 ('stock_ayurcos_ksheer','doc_demo','Ksheerabala Taila','ayurveda','taila','bottle',8),
 ('stock_ayurcos_trip','doc_demo','Triphala Churna','ayurveda','churna','gram',400),
 ('stock_ayurcos_ashwa','doc_demo','Ashwagandha Churna','ayurveda','churna','gram',400);

INSERT INTO stock_batches (id,stock_item_id,doctor_id,batch_no,expires_on,quantity,cost_price,sale_price,received_on) VALUES
 ('batch_ayurcos_avip','stock_ayurcos_avip','doc_demo','AVP-2604',date('now','+300 days'),1800,0.55,0.90,date('now','-25 days')),
 ('batch_ayurcos_guduchi','stock_ayurcos_guduchi','doc_demo','GUD-2605',date('now','+420 days'),420,2.10,3.50,date('now','-18 days')),
 ('batch_ayurcos_draksha','stock_ayurcos_draksha','doc_demo','DRA-2602',date('now','+210 days'),4500,0.32,0.55,date('now','-35 days')),
 ('batch_ayurcos_ksheer','stock_ayurcos_ksheer','doc_demo','KBT-2511',date('now','+48 days'),6,14500,22000,date('now','-80 days')),
 ('batch_ayurcos_trip','stock_ayurcos_trip','doc_demo','TRI-2601',date('now','+365 days'),1500,0.42,0.75,date('now','-30 days')),
 ('batch_ayurcos_ashwa','stock_ayurcos_ashwa','doc_demo','ASH-2603',date('now','+330 days'),900,0.75,1.20,date('now','-20 days'));

UPDATE fee_items SET description = 'Ayurveda consultation' WHERE id = 'fee_demo_1';
UPDATE fee_items SET description = 'Ayurveda follow-up' WHERE id = 'fee_demo_2';
UPDATE fee_items SET description = 'Nadi Pariksha' WHERE id = 'fee_demo_3';

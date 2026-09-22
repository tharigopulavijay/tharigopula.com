-- =========================================================================
-- Activity for the HomeoCOS and AlloCOS demonstration clinics, so all three
-- products open onto a working practice rather than an empty one.
--
-- The important row in this file is pat_demo_vijay. He is already a patient
-- of the AyurCOS demo doctor, and this file adds him to the AlloCOS doctor
-- as well - ONE person, ONE patient record, seen by two doctors on two
-- different products, each holding their own separate clinical notes.
--
-- That is the architecture in a single example:
--   * the patient is shared, so his identity is not typed in twice
--   * the clinical records are NOT shared - doc_demo cannot read doc_allo's
--     visit and vice versa, because tenant isolation does not care which
--     product a doctor uses
--   * his medication history spans both, which is the only reason anyone
--     would catch an Ayurvedic formulation interacting with metformin
--   * to actually READ across the boundary, a doctor needs the patient's
--     consent, exactly as before
--
-- Money is integer paise throughout. 60000 is six hundred rupees.
-- Idempotent, and safe to re-run.
-- =========================================================================

-- ----------------------------------------------------- shared patients --
INSERT OR REPLACE INTO patients (id,mobile,mobile_verified,full_name,sex,date_of_birth,blood_group,created_at) VALUES
 ('pat_homeo_1','+919444400001',1,'Devika Menon','female','1979-04-19','A+',datetime('now','-64 days')),
 ('pat_homeo_2','+919444400002',1,'Joseph Thomas','male','1966-12-02','B+',datetime('now','-52 days')),
 ('pat_homeo_3','+919444400003',1,'Anjali Pillai','female','2009-07-25','O+',datetime('now','-31 days')),
 ('pat_allo_1','+919555500001',1,'Sanjay Deshmukh','male','1971-02-14','B+',datetime('now','-40 days')),
 ('pat_allo_2','+919555500002',1,'Fatima Qureshi','female','1994-08-09','AB+',datetime('now','-22 days'));

-- ------------------------------------------------ HomeoCOS patient list --
INSERT OR REPLACE INTO doctor_patients (doctor_id,patient_id,local_ref,first_seen_on,last_seen_on,private_notes) VALUES
 ('doc_homeo','pat_homeo_1','HOMO-1001',date('now','-64 days'),date('now','-6 days'),'Chronic case; keep the totality in view.'),
 ('doc_homeo','pat_homeo_2','HOMO-1002',date('now','-52 days'),date('now','-13 days'),NULL),
 ('doc_homeo','pat_homeo_3','HOMO-1003',date('now','-31 days'),date('now','-2 days'),'Mother attends with her.');
INSERT OR REPLACE INTO patient_sequences (doctor_id,next_no) VALUES ('doc_homeo',1004);

-- ------------------------------------------------- AlloCOS patient list --
-- Vijay is deliberately the same person as DEMO-1001 on the AyurCOS clinic.
INSERT OR REPLACE INTO doctor_patients (doctor_id,patient_id,local_ref,first_seen_on,last_seen_on,private_notes) VALUES
 ('doc_allo','pat_allo_1','ALO-1001',date('now','-40 days'),date('now','-5 days'),'Reviews BP log on his phone.'),
 ('doc_allo','pat_allo_2','ALO-1002',date('now','-22 days'),date('now','-3 days'),NULL),
 ('doc_allo','pat_demo_vijay','ALO-1003',date('now','-18 days'),date('now','-4 days'),'Also under Ayurvedic care elsewhere - ask before changing anything.');
INSERT OR REPLACE INTO patient_sequences (doctor_id,next_no) VALUES ('doc_allo',1004);

-- ----------------------------------------------------------- visits ----
DELETE FROM visits WHERE id LIKE 'vis_homeo_%' OR id LIKE 'vis_allo_%';
INSERT INTO visits (id,doctor_id,patient_id,visited_on,visit_type,complaints,diagnosis,vitals,findings,advice,follow_up_on,status,closed_at) VALUES
 ('vis_homeo_1','doc_homeo','pat_homeo_1',date('now','-64 days'),'first',
  'Recurrent migraine, worse before menses, better in a dark room',
  'Chronic migraine - constitutional case',
  '{"bp":"118/76","pulse":"74","weight":"61"}',
  'Mentals: reserved, weeps alone. Thermal: chilly. Thirst: large quantities, infrequent. Miasm: psoric.',
  'Avoid skipping meals. Keep a headache diary until the next visit.',
  date('now','-34 days'),'closed',datetime('now','-64 days')),
 ('vis_homeo_2','doc_homeo','pat_homeo_1',date('now','-6 days'),'follow_up',
  'Frequency down from weekly to twice this month; intensity lower',
  'Chronic migraine - responding',
  '{"bp":"116/74","pulse":"72","weight":"61"}',
  'Direction of cure holding. No new symptoms. Repeat not indicated yet.',
  'Continue placebo. Return if the pattern changes.',
  date('now','+24 days'),'closed',datetime('now','-6 days')),
 ('vis_homeo_3','doc_homeo','pat_homeo_2',date('now','-13 days'),'follow_up',
  'Eczema on both hands, worse with water and washing',
  'Chronic eczema',
  '{"bp":"128/82","pulse":"78","weight":"79"}',
  'Worse: washing, winter. Better: open air. Thermal: hot. Sycotic features.',
  'Cotton gloves for wet work. No medicated soap.',
  date('now','+17 days'),'closed',datetime('now','-13 days')),
 ('vis_allo_1','doc_allo','pat_allo_1',date('now','-40 days'),'first',
  'Fatigue, increased thirst, passing urine at night',
  'Type 2 diabetes mellitus - newly detected',
  '{"bp":"142/90","pulse":"84","weight":"88","temperature":"98.4"}',
  'CVS: S1S2 normal. RS: clear. Abdomen: soft, no organomegaly. No neuropathy.',
  'Start metformin with the evening meal. Walk 30 minutes daily. Repeat HbA1c in 3 months.',
  date('now','-10 days'),'closed',datetime('now','-40 days')),
 ('vis_allo_2','doc_allo','pat_allo_1',date('now','-5 days'),'follow_up',
  'Tolerating medication; no hypoglycaemic episodes',
  'Type 2 diabetes mellitus - on treatment',
  '{"bp":"132/84","pulse":"78","weight":"86"}',
  'Weight down 2kg. No side effects reported.',
  'Continue the same dose. Bring the glucose log next time.',
  date('now','+55 days'),'closed',datetime('now','-5 days')),
 ('vis_allo_3','doc_allo','pat_demo_vijay',date('now','-4 days'),'first',
  'Persistent acidity and disturbed sleep for three weeks',
  'Gastro-oesophageal reflux',
  '{"bp":"124/80","pulse":"76","weight":"74"}',
  'Abdomen soft, epigastric tenderness. Currently taking Ayurvedic formulations under another doctor - noted, not altered.',
  'Avoid late meals. Raise the head of the bed. Review in two weeks.',
  date('now','+10 days'),'closed',datetime('now','-4 days'));

-- ---------------------------------------------------- prescriptions ----
DELETE FROM prescription_items WHERE prescription_id LIKE 'rx_homeo_%' OR prescription_id LIKE 'rx_allo_%';
DELETE FROM prescriptions WHERE id LIKE 'rx_homeo_%' OR id LIKE 'rx_allo_%';

INSERT INTO prescriptions (id,doctor_id,patient_id,visit_id,rx_number,issued_on,status,issued_at,sequence_no) VALUES
 ('rx_homeo_1','doc_homeo','pat_homeo_1','vis_homeo_1','HOMO/2026/0001',date('now','-64 days'),'issued',datetime('now','-64 days'),1),
 ('rx_homeo_2','doc_homeo','pat_homeo_2','vis_homeo_3','HOMO/2026/0002',date('now','-13 days'),'issued',datetime('now','-13 days'),2),
 ('rx_allo_1','doc_allo','pat_allo_1','vis_allo_1','ALO/2026/0001',date('now','-40 days'),'issued',datetime('now','-40 days'),1),
 ('rx_allo_2','doc_allo','pat_demo_vijay','vis_allo_3','ALO/2026/0002',date('now','-4 days'),'issued',datetime('now','-4 days'),2);

INSERT OR REPLACE INTO rx_sequences (doctor_id,year,next_no) VALUES
 ('doc_homeo',2026,3),('doc_allo',2026,3);

INSERT INTO prescription_items (id,prescription_id,doctor_id,medicine_name,system,dose,frequency,duration,instructions,sort_order) VALUES
 ('rxi_homeo_1','rx_homeo_1','doc_homeo','Natrum Muriaticum','homeopathy','200C','Single dose','Once','Dry doses on the tongue. Nothing by mouth for 30 minutes.',1),
 ('rxi_homeo_2','rx_homeo_1','doc_homeo','Saccharum Lactis (placebo)','homeopathy','30','Twice daily','30 days','Continue until the next review.',2),
 ('rxi_homeo_3','rx_homeo_2','doc_homeo','Graphites','homeopathy','30C','Once daily','14 days','Morning, empty stomach.',1),
 ('rxi_homeo_4','rx_homeo_2','doc_homeo','Calendula mother tincture','homeopathy','Q','Local application','14 days','Dilute 1:10 in water before applying.',2),
 ('rxi_allo_1','rx_allo_1','doc_allo','Metformin','allopathy','500 mg','Once daily','90 days','With the evening meal.',1),
 ('rxi_allo_2','rx_allo_1','doc_allo','Vitamin D3','supplement','60000 IU','Once weekly','8 weeks','With food.',2),
 ('rxi_allo_3','rx_allo_2','doc_allo','Pantoprazole','allopathy','40 mg','Once daily','14 days','30 minutes before breakfast.',1);

-- ------------------------------------------------------ lab reports ----
DELETE FROM lab_values WHERE lab_report_id LIKE 'lab_allo_%';
DELETE FROM lab_reports WHERE id LIKE 'lab_allo_%';
INSERT INTO lab_reports (id,doctor_id,patient_id,report_name,reported_on,source,status,verified_by,verified_at) VALUES
 ('lab_allo_1','doc_allo','pat_allo_1','HbA1c and fasting glucose',date('now','-41 days'),'lab','verified','doc_allo',datetime('now','-40 days')),
 ('lab_allo_2','doc_allo','pat_allo_1','HbA1c - repeat',date('now','-6 days'),'lab','verified','doc_allo',datetime('now','-5 days'));
INSERT INTO lab_values (id,lab_report_id,doctor_id,analyte,value,unit,reference,flag) VALUES
 ('lv_allo_1','lab_allo_1','doc_allo','HbA1c','8.4','%','4.0-5.6','high'),
 ('lv_allo_2','lab_allo_1','doc_allo','Fasting glucose','168','mg/dL','70-100','high'),
 ('lv_allo_3','lab_allo_1','doc_allo','Creatinine','0.9','mg/dL','0.7-1.3','normal'),
 ('lv_allo_4','lab_allo_2','doc_allo','HbA1c','7.1','%','4.0-5.6','high'),
 ('lv_allo_5','lab_allo_2','doc_allo','Fasting glucose','126','mg/dL','70-100','high');

-- ---------------------------------------------------------- pharmacy ---
DELETE FROM stock_batches WHERE id LIKE 'bat_homeo_%' OR id LIKE 'bat_allo_%';
DELETE FROM stock_items WHERE id LIKE 'sit_homeo_%' OR id LIKE 'sit_allo_%';
INSERT INTO stock_items (id,doctor_id,medicine_name,system,form,unit,reorder_level) VALUES
 ('sit_homeo_1','doc_homeo','Natrum Muriaticum 200C','homeopathy','Globules','vial',5),
 ('sit_homeo_2','doc_homeo','Graphites 30C','homeopathy','Globules','vial',5),
 ('sit_homeo_3','doc_homeo','Calendula Q','homeopathy','Mother tincture','bottle',3),
 ('sit_homeo_4','doc_homeo','Saccharum Lactis','homeopathy','Globules','vial',10),
 ('sit_allo_1','doc_allo','Metformin 500mg','allopathy','Tablet','strip',20),
 ('sit_allo_2','doc_allo','Pantoprazole 40mg','allopathy','Tablet','strip',15),
 ('sit_allo_3','doc_allo','Vitamin D3 60000 IU','supplement','Sachet','sachet',10),
 ('sit_allo_4','doc_allo','Amoxicillin 500mg','allopathy','Capsule','strip',12);

-- A batch already past its date on each clinic, so the expiry warning and
-- the FEFO rule have something real to act on rather than a clean shelf.
INSERT INTO stock_batches (id,stock_item_id,doctor_id,batch_no,expires_on,quantity,cost_price,sale_price,received_on) VALUES
 ('bat_homeo_1','sit_homeo_1','doc_homeo','NM-2411',date('now','+240 days'),18,4500,9000,date('now','-60 days')),
 ('bat_homeo_2','sit_homeo_2','doc_homeo','GR-2405',date('now','+40 days'),9,4200,8500,date('now','-90 days')),
 ('bat_homeo_3','sit_homeo_3','doc_homeo','CAL-2312',date('now','-9 days'),4,11000,19500,date('now','-200 days')),
 ('bat_homeo_4','sit_homeo_4','doc_homeo','SL-2502',date('now','+400 days'),40,2000,4000,date('now','-20 days')),
 ('bat_allo_1','sit_allo_1','doc_allo','MET-8821',date('now','+300 days'),64,3200,6500,date('now','-45 days')),
 ('bat_allo_2','sit_allo_1','doc_allo','MET-8790',date('now','+55 days'),12,3200,6500,date('now','-150 days')),
 ('bat_allo_3','sit_allo_2','doc_allo','PAN-4410',date('now','+180 days'),30,5500,11000,date('now','-30 days')),
 ('bat_allo_4','sit_allo_3','doc_allo','D3-7712',date('now','+500 days'),25,1800,4500,date('now','-15 days')),
 ('bat_allo_5','sit_allo_4','doc_allo','AMX-3301',date('now','-21 days'),8,4800,9500,date('now','-240 days'));

-- ----------------------------------------------------------- billing ---
DELETE FROM payments WHERE id LIKE 'pay_homeo_%' OR id LIKE 'pay_allo_%';
DELETE FROM invoice_items WHERE invoice_id LIKE 'inv_homeo_%' OR invoice_id LIKE 'inv_allo_%';
DELETE FROM invoices WHERE id LIKE 'inv_homeo_%' OR id LIKE 'inv_allo_%';

INSERT INTO invoices (id,doctor_id,patient_id,visit_id,invoice_no,status,issued_on,subtotal,discount,tax_rate,tax_amount,total) VALUES
 ('inv_homeo_1','doc_homeo','pat_homeo_1','vis_homeo_1','HOMO/INV/2026/0001','issued',date('now','-64 days'),80000,0,0,0,80000),
 ('inv_homeo_2','doc_homeo','pat_homeo_2','vis_homeo_3','HOMO/INV/2026/0002','issued',date('now','-13 days'),53500,3500,0,0,50000),
 ('inv_allo_1','doc_allo','pat_allo_1','vis_allo_1','ALO/INV/2026/0001','issued',date('now','-40 days'),95000,0,0,0,95000),
 ('inv_allo_2','doc_allo','pat_demo_vijay','vis_allo_3','ALO/INV/2026/0002','issued',date('now','-4 days'),67000,0,0,0,67000);

INSERT OR REPLACE INTO invoice_sequences (doctor_id,year,next_no) VALUES
 ('doc_homeo',2026,3),('doc_allo',2026,3);

INSERT INTO invoice_items (id,invoice_id,doctor_id,kind,description,quantity,unit_price,amount,sort_order) VALUES
 ('ivi_homeo_1','inv_homeo_1','doc_homeo','fee','First consultation - detailed case taking',1,65000,65000,1),
 ('ivi_homeo_2','inv_homeo_1','doc_homeo','medicine','Natrum Muriaticum 200C',1,9000,9000,2),
 ('ivi_homeo_3','inv_homeo_1','doc_homeo','medicine','Saccharum Lactis',1,4000,4000,3),
 ('ivi_homeo_4','inv_homeo_1','doc_homeo','fee','Records and follow-up plan',1,2000,2000,4),
 ('ivi_homeo_5','inv_homeo_2','doc_homeo','fee','Follow-up consultation',1,35000,35000,1),
 ('ivi_homeo_6','inv_homeo_2','doc_homeo','medicine','Graphites 30C',1,8500,8500,2),
 ('ivi_homeo_7','inv_homeo_2','doc_homeo','medicine','Calendula Q',1,10000,10000,3),
 ('ivi_allo_1','inv_allo_1','doc_allo','fee','First consultation',1,60000,60000,1),
 ('ivi_allo_2','inv_allo_1','doc_allo','medicine','Metformin 500mg - 30 tablets',3,6500,19500,2),
 ('ivi_allo_3','inv_allo_1','doc_allo','medicine','Vitamin D3 60000 IU',2,4500,9000,3),
 ('ivi_allo_4','inv_allo_1','doc_allo','fee','Dressing and consumables',1,6500,6500,4),
 ('ivi_allo_5','inv_allo_2','doc_allo','fee','First consultation',1,56000,56000,1),
 ('ivi_allo_6','inv_allo_2','doc_allo','medicine','Pantoprazole 40mg - 14 tablets',1,11000,11000,2);

INSERT INTO payments (id,invoice_id,doctor_id,amount,method,reference,received_on,received_by) VALUES
 ('pay_homeo_1','inv_homeo_1','doc_homeo',80000,'upi','UPI-4471102',date('now','-64 days'),'doc_homeo'),
 ('pay_homeo_2','inv_homeo_2','doc_homeo',50000,'cash',NULL,date('now','-13 days'),'doc_homeo'),
 ('pay_allo_1','inv_allo_1','doc_allo',95000,'card','CARD-8890',date('now','-40 days'),'doc_allo'),
 ('pay_allo_2','inv_allo_2','doc_allo',67000,'upi','UPI-9902314',date('now','-4 days'),'doc_allo');

-- --------------------------------------------------------- fee lists ---
DELETE FROM fee_items WHERE id LIKE 'fee_homeo_%' OR id LIKE 'fee_allo_%';
INSERT INTO fee_items (id,doctor_id,kind,description,unit_price,active) VALUES
 ('fee_homeo_1','doc_homeo','fee','First consultation - detailed case taking',65000,1),
 ('fee_homeo_2','doc_homeo','fee','Follow-up consultation',35000,1),
 ('fee_homeo_3','doc_homeo','fee','Repertorisation review',25000,1),
 ('fee_allo_1','doc_allo','fee','First consultation',60000,1),
 ('fee_allo_2','doc_allo','fee','Follow-up consultation',30000,1),
 ('fee_allo_3','doc_allo','fee','Dressing and consumables',6500,1),
 ('fee_allo_4','doc_allo','fee','Injection administration',15000,1);

-- ------------------------------------------------------- today's diary --
DELETE FROM appointments WHERE id LIKE 'appt_homeo_%' OR id LIKE 'appt_allo_%';
INSERT INTO appointments (id,doctor_id,patient_id,scheduled_on,scheduled_at,duration_mins,reason,source,status,arrived_at,notes) VALUES
 ('appt_homeo_1','doc_homeo','pat_homeo_3',date('now'),'10:00',30,'Case review','follow_up','arrived',datetime('now','-15 minutes'),'Mother attending'),
 ('appt_homeo_2','doc_homeo','pat_homeo_1',date('now'),'11:00',20,'Repeat assessment','follow_up','scheduled',NULL,'Headache diary to be reviewed'),
 ('appt_homeo_3','doc_homeo','pat_homeo_2',date('now'),'12:00',20,'Eczema review','follow_up','scheduled',NULL,NULL),
 ('appt_allo_1','doc_allo','pat_allo_2',date('now'),'09:45',15,'Throat pain','manual','arrived',datetime('now','-25 minutes'),NULL),
 ('appt_allo_2','doc_allo','pat_demo_vijay',date('now'),'10:30',15,'Reflux review','follow_up','scheduled',NULL,'Ask about the Ayurvedic medicines he is on'),
 ('appt_allo_3','doc_allo','pat_allo_1',date('now'),'11:15',20,'Diabetes review','follow_up','scheduled',NULL,'Glucose log'),
 ('appt_allo_4','doc_allo','pat_allo_2',date('now'),'16:00',15,'Report collection','manual','scheduled',NULL,NULL);

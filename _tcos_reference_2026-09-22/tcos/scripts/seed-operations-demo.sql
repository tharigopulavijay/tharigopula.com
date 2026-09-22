-- Connected, idempotent sample activity for the public TCOS demonstration.
-- All identifiers are demo-prefixed so the seed never touches real records.

UPDATE doctors SET
  full_name = 'Dr. Ananya Rao', qualification = 'MBBS, MD (General Medicine)',
  registration_no = 'TSMC-DEMO-2048', clinic_name = 'TCOS Demo Clinic',
  tagline = 'Thoughtful family medicine, close to home',
  address = 'Road No. 12, Banjara Hills, Hyderabad',
  weekly_hours = '{"mon":{"closed":false,"open":"09:00","close":"18:00"},"tue":{"closed":false,"open":"09:00","close":"18:00"},"wed":{"closed":false,"open":"09:00","close":"14:00"},"thu":{"closed":false,"open":"09:00","close":"18:00"},"fri":{"closed":false,"open":"09:00","close":"18:00"},"sat":{"closed":false,"open":"10:00","close":"13:00"},"sun":{"closed":true,"open":"09:00","close":"18:00"}}',
  certificate_name = 'medical-registration-demo.pdf', certificate_status = 'verified',
  certificate_submitted_at = datetime('now','-20 days'), public_page_on = 1,
  public_slug = 'dr-ananya-rao', public_intro = 'General medicine for adults and families, with clear follow-up plans.',
  public_hours = 'Mon-Tue & Thu-Fri 9am-6pm, Wed 9am-2pm, Sat 10am-1pm'
WHERE id = 'doc_demo';

-- Staff accounts and their capabilities are created in
-- scripts/seed-accounts-demo.sql, which must run before this file. Three
-- UPDATE statements used to sit here against rows nothing had inserted:
-- they matched no rows, raised no error, and left every staff sign-in
-- broken while appearing to succeed. Capabilities belong with the account
-- that has them, not in the activity seed.

INSERT OR REPLACE INTO patients (id,mobile,mobile_verified,full_name,sex,date_of_birth,blood_group,created_at) VALUES
 ('pat_demo_vijay','+919333300001',1,'Vijay','male','1990-06-12','B+',datetime('now','-120 days')),
 ('pat_demo_ananya','+919333300002',1,'Ananya Reddy','female','1985-03-22','O+',datetime('now','-100 days')),
 ('pat_demo_rohan','+919333300003',1,'Rohan Kumar','male','2012-09-08','A+',datetime('now','-75 days')),
 ('pat_demo_meera','+919333300004',1,'Meera Shah','female','1964-11-17','AB+',datetime('now','-60 days')),
 ('pat_demo_aarav','+919333300005',1,'Aarav Patel','male','1998-01-30','O-',datetime('now','-25 days'));

INSERT OR REPLACE INTO doctor_patients (doctor_id,patient_id,local_ref,first_seen_on,last_seen_on,private_notes) VALUES
 ('doc_demo','pat_demo_vijay','DEMO-1001',date('now','-120 days'),date('now','-2 days'),'Prefers evening follow-ups.'),
 ('doc_demo','pat_demo_ananya','DEMO-1002',date('now','-100 days'),date('now','-7 days'),'Bring home BP log.'),
 ('doc_demo','pat_demo_rohan','DEMO-1003',date('now','-75 days'),date('now','-1 day'),NULL),
 ('doc_demo','pat_demo_meera','DEMO-1004',date('now','-60 days'),date('now','-10 days'),'Daughter helps with medicines.'),
 ('doc_demo','pat_demo_aarav','DEMO-1005',date('now','-25 days'),date('now','-3 days'),NULL);
INSERT OR REPLACE INTO patient_sequences (doctor_id,next_no) VALUES ('doc_demo',1006);

DELETE FROM appointments WHERE id LIKE 'appt_demo_%';
INSERT INTO appointments (id,doctor_id,patient_id,scheduled_on,scheduled_at,duration_mins,reason,source,status,arrived_at,completed_at,notes) VALUES
 ('appt_demo_1','doc_demo','pat_demo_rohan',date('now'),'09:30',15,'Fever follow-up','manual','arrived',datetime('now','-20 minutes'),NULL,'Temperature to be rechecked'),
 ('appt_demo_2','doc_demo','pat_demo_vijay',date('now'),'10:15',20,'Headache review','follow_up','scheduled',NULL,NULL,'Review sleep diary'),
 ('appt_demo_3','doc_demo','pat_demo_meera',date('now'),'11:00',20,'Diabetes review','phone','scheduled',NULL,NULL,'Bring glucose log'),
 ('appt_demo_4','doc_demo','pat_demo_aarav',date('now'),'12:00',15,'Allergy symptoms','manual','completed',NULL,datetime('now','-1 hour'),NULL),
 ('appt_demo_5','doc_demo','pat_demo_ananya',date('now','+1 day'),'09:45',20,'Blood pressure review','follow_up','scheduled',NULL,NULL,NULL);

DELETE FROM prescription_items WHERE id LIKE 'rxi_demo_%';
DELETE FROM prescriptions WHERE id LIKE 'rx_demo_%';
DELETE FROM visits WHERE id LIKE 'visit_demo_%';
INSERT INTO visits (id,doctor_id,patient_id,visited_on,visit_type,complaints,diagnosis,vitals,findings,advice,follow_up_on,status,closed_at) VALUES
 ('visit_demo_vijay_1','doc_demo','pat_demo_vijay',date('now','-30 days'),'first','Headache and poor sleep','Tension-type headache','{"bp":"128/82","pulse":76,"weight":74.2}','{"redFlags":false}','Hydration, sleep routine and screen breaks',date('now','-2 days'),'completed',datetime('now','-30 days')),
 ('visit_demo_vijay_2','doc_demo','pat_demo_vijay',date('now','-2 days'),'follow_up','Headache improved; occasional evening pain','Tension-type headache, improving','{"bp":"124/80","pulse":72,"weight":73.8}','{"redFlags":false}','Continue routine; review if frequency increases',date('now','+14 days'),'completed',datetime('now','-2 days')),
 ('visit_demo_ananya','doc_demo','pat_demo_ananya',date('now','-7 days'),'follow_up','Home BP readings elevated','Essential hypertension','{"bp":"148/92","pulse":78,"weight":68.4}','{"homeAverage":"142/88"}','Reduce salt and continue BP diary',date('now','+1 day'),'completed',datetime('now','-7 days')),
 ('visit_demo_rohan','doc_demo','pat_demo_rohan',date('now','-1 day'),'first','Fever, sore throat','Viral upper respiratory infection','{"temperature":38.1,"pulse":96,"weight":41.0}','{"hydration":"adequate"}','Fluids, rest and return for breathing difficulty',date('now'),'completed',datetime('now','-1 day')),
 ('visit_demo_meera','doc_demo','pat_demo_meera',date('now','-10 days'),'follow_up','Glucose review','Type 2 diabetes mellitus','{"bp":"136/84","pulse":74,"weight":70.1}','{"fastingGlucose":142}','Diet review and daily walking',date('now','+20 days'),'completed',datetime('now','-10 days')),
 ('visit_demo_aarav','doc_demo','pat_demo_aarav',date('now','-3 days'),'first','Sneezing and itchy eyes','Seasonal allergic rhinitis','{"bp":"118/76","pulse":70,"weight":66.5}','{}','Avoid triggers; saline nasal rinse',NULL,'completed',datetime('now','-3 days'));

INSERT INTO prescriptions (id,doctor_id,patient_id,visit_id,rx_number,issued_on,status,issued_at,sequence_no) VALUES
 ('rx_demo_1','doc_demo','pat_demo_vijay','visit_demo_vijay_2','DEMO/2026/0001',date('now','-2 days'),'issued',datetime('now','-2 days'),1),
 ('rx_demo_2','doc_demo','pat_demo_rohan','visit_demo_rohan','DEMO/2026/0002',date('now','-1 day'),'issued',datetime('now','-1 day'),2),
 ('rx_demo_3','doc_demo','pat_demo_meera','visit_demo_meera','DEMO/2026/0003',date('now','-10 days'),'issued',datetime('now','-10 days'),3),
 ('rx_demo_4','doc_demo','pat_demo_aarav','visit_demo_aarav','DEMO/2026/0004',date('now','-3 days'),'issued',datetime('now','-3 days'),4);
INSERT INTO prescription_items (id,prescription_id,doctor_id,medicine_name,system,dose,frequency,duration,instructions,attributes,sort_order,dispense_quantity,stock_item_id) VALUES
 ('rxi_demo_1','rx_demo_1','doc_demo','Paracetamol 500 mg','allopathy','1 tablet','When required','5 days','After food; maximum 3 daily','{}',1,10,'stock_demo_para'),
 ('rxi_demo_2','rx_demo_2','doc_demo','Paracetamol 500 mg','allopathy','1 tablet','Three times daily','3 days','After food','{}',1,9,'stock_demo_para'),
 ('rxi_demo_3','rx_demo_2','doc_demo','ORS sachet','allopathy','1 sachet','After loose stool','2 days','Mix in one litre clean water','{}',2,2,'stock_demo_ors'),
 ('rxi_demo_4','rx_demo_3','doc_demo','Metformin 500 mg','allopathy','1 tablet','Twice daily','30 days','With meals','{}',1,60,'stock_demo_met'),
 ('rxi_demo_5','rx_demo_4','doc_demo','Cetirizine 10 mg','allopathy','1 tablet','Once nightly','7 days','May cause drowsiness','{}',1,7,'stock_demo_cet');
INSERT OR REPLACE INTO rx_sequences (doctor_id,year,next_no) VALUES ('doc_demo',2026,5);

DELETE FROM lab_values WHERE id LIKE 'labv_demo_%';
DELETE FROM lab_reports WHERE id LIKE 'lab_demo_%';
INSERT INTO lab_reports (id,doctor_id,patient_id,report_name,reported_on,source,status,verified_by,verified_at) VALUES
 ('lab_demo_vijay','doc_demo','pat_demo_vijay','Complete Blood Count',date('now','-5 days'),'lab','verified','doc_demo',datetime('now','-5 days')),
 ('lab_demo_meera','doc_demo','pat_demo_meera','Diabetes Panel',date('now','-9 days'),'lab','verified','doc_demo',datetime('now','-9 days')),
 ('lab_demo_ananya','doc_demo','pat_demo_ananya','Renal Function Test',date('now','-6 days'),'patient_upload','awaiting_verification',NULL,NULL);
INSERT INTO lab_values (id,lab_report_id,doctor_id,analyte,value,unit,reference,flag) VALUES
 ('labv_demo_1','lab_demo_vijay','doc_demo','Haemoglobin','14.2','g/dL','13.0-17.0','normal'),
 ('labv_demo_2','lab_demo_vijay','doc_demo','WBC','7.4','10^3/uL','4.0-11.0','normal'),
 ('labv_demo_3','lab_demo_meera','doc_demo','HbA1c','7.8','%','4.0-5.6','high'),
 ('labv_demo_4','lab_demo_meera','doc_demo','Fasting glucose','142','mg/dL','70-99','high');

DELETE FROM stock_movements WHERE id LIKE 'move_demo_%';
DELETE FROM stock_batches WHERE id LIKE 'batch_demo_%';
DELETE FROM stock_items WHERE id LIKE 'stock_demo_%';
INSERT INTO stock_items (id,doctor_id,medicine_name,system,form,unit,reorder_level) VALUES
 ('stock_demo_para','doc_demo','Paracetamol 500 mg','allopathy','tablet','tablet',50),
 ('stock_demo_ors','doc_demo','ORS sachet','allopathy','sachet','sachet',20),
 ('stock_demo_met','doc_demo','Metformin 500 mg','allopathy','tablet','tablet',60),
 ('stock_demo_cet','doc_demo','Cetirizine 10 mg','allopathy','tablet','tablet',30);
INSERT INTO stock_batches (id,stock_item_id,doctor_id,batch_no,expires_on,quantity,cost_price,sale_price,received_on) VALUES
 ('batch_demo_para','stock_demo_para','doc_demo','PCM-2601',date('now','+280 days'),120,0.8,1.5,date('now','-30 days')),
 ('batch_demo_ors','stock_demo_ors','doc_demo','ORS-2511',date('now','+35 days'),12,8,12,date('now','-90 days')),
 ('batch_demo_met','stock_demo_met','doc_demo','MET-2602',date('now','+400 days'),45,1.2,2.1,date('now','-25 days')),
 ('batch_demo_cet','stock_demo_cet','doc_demo','CET-2603',date('now','+180 days'),80,0.7,1.4,date('now','-18 days'));
INSERT INTO stock_movements (id,doctor_id,batch_id,patient_id,direction,quantity,reason,moved_at,prescription_item_id) VALUES
 ('move_demo_1','doc_demo','batch_demo_para','pat_demo_rohan','out',9,'Dispensed against prescription',datetime('now','-1 day'),'rxi_demo_2'),
 ('move_demo_2','doc_demo','batch_demo_cet','pat_demo_aarav','out',7,'Dispensed against prescription',datetime('now','-3 days'),'rxi_demo_5'),
 ('move_demo_3','doc_demo','batch_demo_ors',NULL,'adjust',-2,'Damaged sachets removed',datetime('now','-4 days'),NULL);

DELETE FROM payments WHERE id LIKE 'pay_demo_%';
DELETE FROM invoice_items WHERE id LIKE 'invi_demo_%';
DELETE FROM invoices WHERE id LIKE 'inv_demo_%';
INSERT INTO invoices (id,doctor_id,patient_id,visit_id,invoice_no,status,issued_on,subtotal,discount,tax_rate,tax_amount,total,note) VALUES
 ('inv_demo_1','doc_demo','pat_demo_vijay','visit_demo_vijay_2','DEMO/INV/2026/0001','issued',date('now','-2 days'),60000,0,0,0,60000,'Consultation paid by UPI'),
 ('inv_demo_2','doc_demo','pat_demo_rohan','visit_demo_rohan','DEMO/INV/2026/0002','issued',date('now','-1 day'),54000,4000,0,0,50000,'Consultation and medicines'),
 ('inv_demo_3','doc_demo','pat_demo_meera','visit_demo_meera','DEMO/INV/2026/0003','issued',date('now','-10 days'),90000,0,0,0,90000,'Partial payment received'),
 ('inv_demo_4','doc_demo','pat_demo_aarav','visit_demo_aarav','DEMO/INV/2026/0004','issued',date('now','-3 days'),65000,0,0,0,65000,NULL);
INSERT INTO invoice_items (id,invoice_id,doctor_id,kind,description,quantity,unit_price,amount,sort_order) VALUES
 ('invi_demo_1','inv_demo_1','doc_demo','consultation','Follow-up consultation',1,60000,60000,1),
 ('invi_demo_2','inv_demo_2','doc_demo','consultation','General consultation',1,50000,50000,1),
 ('invi_demo_3','inv_demo_2','doc_demo','medicine','Medicines dispensed',1,4000,4000,2),
 ('invi_demo_4','inv_demo_3','doc_demo','consultation','Diabetes review',1,70000,70000,1),
 ('invi_demo_5','inv_demo_3','doc_demo','lab','Point-of-care testing',1,20000,20000,2),
 ('invi_demo_6','inv_demo_4','doc_demo','consultation','General consultation',1,65000,65000,1);
INSERT INTO payments (id,invoice_id,doctor_id,amount,method,reference,received_on,received_by) VALUES
 ('pay_demo_1','inv_demo_1','doc_demo',60000,'upi','UPI-DEMO-4102',date('now','-2 days'),'usr_demo_front'),
 ('pay_demo_2','inv_demo_2','doc_demo',50000,'cash',NULL,date('now','-1 day'),'usr_demo_front'),
 ('pay_demo_3','inv_demo_3','doc_demo',50000,'card','CARD-8842',date('now','-10 days'),'usr_demo_front'),
 ('pay_demo_4','inv_demo_4','doc_demo',65000,'upi','UPI-DEMO-4118',date('now','-3 days'),'usr_demo_front');
INSERT OR REPLACE INTO invoice_sequences (doctor_id,year,next_no) VALUES ('doc_demo',2026,4);
DELETE FROM fee_items WHERE id LIKE 'fee_demo_%';
INSERT INTO fee_items (id,doctor_id,kind,description,unit_price,active) VALUES
 ('fee_demo_1','doc_demo','consultation','New consultation',70000,1),
 ('fee_demo_2','doc_demo','consultation','Follow-up consultation',50000,1),
 ('fee_demo_3','doc_demo','procedure','Nebulisation',35000,1);

DELETE FROM appointment_requests WHERE id LIKE 'req_demo_%';
INSERT INTO appointment_requests (id,doctor_id,full_name,mobile,preferred_on,preferred_time,reason,note,status,source_ip,created_at) VALUES
 ('req_demo_1','doc_demo','Saanvi Gupta','+919333300099',date('now','+2 days'),'17:30','Recurring acidity','First visit request from clinic page','new','demo',datetime('now','-3 hours'));

DELETE FROM patient_access_links WHERE id = 'pal_demo_vijay';
INSERT INTO patient_access_links (id,token_hash,patient_id,doctor_id,created_by,created_at,expires_at,opened_count) VALUES
 ('pal_demo_vijay','aff9063d61e75654d8b050ba9e0050323192562538a0d9c63753dc84334bd398','pat_demo_vijay','doc_demo','doc_demo',datetime('now'),datetime('now','+365 days'),0);

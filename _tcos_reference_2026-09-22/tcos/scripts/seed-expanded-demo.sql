-- Expanded fictional TCOS demonstration. No real patient information.
INSERT OR IGNORE INTO patients (id,mobile,mobile_verified,full_name,sex,date_of_birth,blood_group,created_at) VALUES
 ('pat_demo_lakshmi','+919333300006',1,'Lakshmi Devi','female','1957-04-18','B+',datetime('now','-240 days')),
 ('pat_demo_arjun','+919333300007',1,'Arjun Varma','male','1978-02-11','O+',datetime('now','-170 days')),
 ('pat_demo_fatima','+919333300008',1,'Fatima Begum','female','1992-08-05','A+',datetime('now','-150 days')),
 ('pat_demo_kiran','+919333300009',1,'Kiran Rao','male','2001-12-20','B-',datetime('now','-130 days')),
 ('pat_demo_savita','+919333300010',1,'Savita Iyer','female','1969-07-03','O+',datetime('now','-110 days')),
 ('pat_demo_mahesh','+919333300011',1,'Mahesh Babu','male','1982-10-27','A-',datetime('now','-90 days')),
 ('pat_demo_nisha','+919333300012',1,'Nisha Kapoor','female','1996-05-14','AB+',datetime('now','-70 days')),
 ('pat_demo_rahul','+919333300013',1,'Rahul Reddy','male','1988-09-09','O+',datetime('now','-55 days')),
 ('pat_demo_leela','+919333300014',1,'Leela Nair','female','1952-01-25','A+',datetime('now','-45 days')),
 ('pat_demo_aditya','+919333300015',1,'Aditya Singh','male','2016-06-16','B+',datetime('now','-30 days'));

INSERT OR REPLACE INTO doctor_patients (doctor_id,patient_id,local_ref,first_seen_on,last_seen_on,private_notes) VALUES
 ('doc_demo','pat_demo_lakshmi','DEMO-1006',date('now','-240 days'),date('now','-4 days'),'Daughter organises the weekly pill box. Previous coronary stent; carry GTN.'),
 ('doc_demo','pat_demo_arjun','DEMO-1007',date('now','-170 days'),date('now','-12 days'),'Prefers morning appointments.'),
 ('doc_demo','pat_demo_fatima','DEMO-1008',date('now','-150 days'),date('now','-18 days'),NULL),
 ('doc_demo','pat_demo_kiran','DEMO-1009',date('now','-130 days'),date('now','-8 days'),NULL),
 ('doc_demo','pat_demo_savita','DEMO-1010',date('now','-110 days'),date('now','-15 days'),'Call with thyroid results.'),
 ('doc_demo','pat_demo_mahesh','DEMO-1011',date('now','-90 days'),date('now','-6 days'),NULL),
 ('doc_demo','pat_demo_nisha','DEMO-1012',date('now','-70 days'),date('now','-9 days'),NULL),
 ('doc_demo','pat_demo_rahul','DEMO-1013',date('now','-55 days'),date('now','-11 days'),NULL),
 ('doc_demo','pat_demo_leela','DEMO-1014',date('now','-45 days'),date('now','-5 days'),'Uses hearing aid.'),
 ('doc_demo','pat_demo_aditya','DEMO-1015',date('now','-30 days'),date('now','-2 days'),'Parent accompanies child.');
INSERT OR REPLACE INTO patient_sequences (doctor_id,next_no) VALUES ('doc_demo',1016);

DELETE FROM appointments WHERE id LIKE 'appt_more_%';
INSERT INTO appointments (id,doctor_id,patient_id,scheduled_on,scheduled_at,duration_mins,reason,source,status,arrived_at,completed_at,notes) VALUES
 ('appt_more_1','doc_demo','pat_demo_lakshmi',date('now'),'09:00',30,'Cardiac and diabetes review','follow_up','scheduled',NULL,NULL,'Review lipid and renal results'),
 ('appt_more_2','doc_demo','pat_demo_arjun',date('now'),'09:45',20,'Back pain follow-up','manual','scheduled',NULL,NULL,NULL),
 ('appt_more_3','doc_demo','pat_demo_fatima',date('now'),'10:30',20,'Thyroid review','phone','arrived',datetime('now','-8 minutes'),NULL,'Report uploaded'),
 ('appt_more_4','doc_demo','pat_demo_kiran',date('now'),'13:15',15,'Migraine follow-up','follow_up','scheduled',NULL,NULL,NULL),
 ('appt_more_5','doc_demo','pat_demo_savita',date('now'),'14:00',20,'Knee pain','manual','scheduled',NULL,NULL,NULL),
 ('appt_more_6','doc_demo','pat_demo_mahesh',date('now'),'15:00',20,'Cough and wheeze','manual','scheduled',NULL,NULL,NULL),
 ('appt_more_7','doc_demo','pat_demo_nisha',date('now'),'16:00',20,'Anaemia review','follow_up','scheduled',NULL,NULL,NULL),
 ('appt_more_8','doc_demo','pat_demo_rahul',date('now','+2 days'),'10:00',20,'Annual health check','manual','scheduled',NULL,NULL,NULL),
 ('appt_more_9','doc_demo','pat_demo_leela',date('now','+3 days'),'11:20',20,'Vertigo review','follow_up','scheduled',NULL,NULL,'ENT opinion requested'),
 ('appt_more_10','doc_demo','pat_demo_aditya',date('now','+5 days'),'17:00',15,'Asthma control','follow_up','scheduled',NULL,NULL,NULL);

DELETE FROM prescription_items WHERE prescription_id = 'rx_demo_cardio';
DELETE FROM prescriptions WHERE id = 'rx_demo_cardio';
DELETE FROM visits WHERE id = 'visit_demo_cardio';
INSERT INTO visits (id,doctor_id,patient_id,visited_on,visit_type,complaints,diagnosis,vitals,findings,advice,follow_up_on,status,closed_at) VALUES
 ('visit_demo_cardio','doc_demo','pat_demo_lakshmi',date('now','-4 days'),'follow_up','Exertional tiredness; no resting chest pain','Ischaemic heart disease, hypertension, dyslipidaemia and type 2 diabetes','{"bp":"146/86","pulse":68,"weight":63.2,"spo2":97}','{"testsAdvised":["ECG","Echocardiogram","Lipid profile","HbA1c","Renal function"],"referrals":["Cardiology review","ENT for recurrent vertigo","Neurology if imbalance persists"]}','Low-salt diabetic diet, 30 minutes walking as tolerated, keep BP/glucose log; urgent care for chest pain lasting over 10 minutes',date('now','+26 days'),'completed',datetime('now','-4 days'));
INSERT INTO prescriptions (id,doctor_id,patient_id,visit_id,rx_number,issued_on,status,issued_at,sequence_no) VALUES
 ('rx_demo_cardio','doc_demo','pat_demo_lakshmi','visit_demo_cardio','DEMO/2026/0015',date('now','-4 days'),'issued',datetime('now','-4 days'),15);
INSERT INTO prescription_items (id,prescription_id,doctor_id,medicine_name,system,dose,frequency,duration,instructions,attributes,sort_order,dispense_quantity,stock_item_id) VALUES
 ('rxi_cardio_1','rx_demo_cardio','doc_demo','Aspirin 75 mg','allopathy','1 tablet','Once daily','30 days','After breakfast','{}',1,30,NULL),
 ('rxi_cardio_2','rx_demo_cardio','doc_demo','Clopidogrel 75 mg','allopathy','1 tablet','Once daily','30 days','After dinner','{}',2,30,NULL),
 ('rxi_cardio_3','rx_demo_cardio','doc_demo','Atorvastatin 40 mg','allopathy','1 tablet','At night','30 days','Same time every night','{}',3,30,NULL),
 ('rxi_cardio_4','rx_demo_cardio','doc_demo','Metoprolol succinate 25 mg','allopathy','1 tablet','Once daily','30 days','Do not stop suddenly','{}',4,30,NULL),
 ('rxi_cardio_5','rx_demo_cardio','doc_demo','Telmisartan 40 mg','allopathy','1 tablet','Once daily','30 days','Check blood pressure daily','{}',5,30,NULL),
 ('rxi_cardio_6','rx_demo_cardio','doc_demo','Amlodipine 5 mg','allopathy','1 tablet','Once daily','30 days','Report troublesome ankle swelling','{}',6,30,NULL),
 ('rxi_cardio_7','rx_demo_cardio','doc_demo','Metformin 500 mg','allopathy','1 tablet','Twice daily','30 days','With breakfast and dinner','{}',7,60,NULL),
 ('rxi_cardio_8','rx_demo_cardio','doc_demo','Pantoprazole 40 mg','allopathy','1 tablet','Once daily','30 days','30 minutes before breakfast','{}',8,30,NULL),
 ('rxi_cardio_9','rx_demo_cardio','doc_demo','Nitroglycerin 0.5 mg SL','allopathy','1 tablet under tongue','When required','As needed','For chest pain; seek urgent help if not relieved','{}',9,10,NULL),
 ('rxi_cardio_10','rx_demo_cardio','doc_demo','Vitamin D3 60000 IU','allopathy','1 capsule','Once weekly','8 weeks','After food on Sunday','{}',10,8,NULL);
INSERT OR REPLACE INTO rx_sequences (doctor_id,year,next_no) VALUES ('doc_demo',2026,16);

DELETE FROM lab_values WHERE id LIKE 'labv_cardio_%';
DELETE FROM lab_reports WHERE id LIKE 'lab_cardio_%';
INSERT INTO lab_reports (id,doctor_id,patient_id,report_name,reported_on,source,status,verified_by,verified_at) VALUES
 ('lab_cardio_lipid','doc_demo','pat_demo_lakshmi','Lipid profile',date('now','-6 days'),'lab','verified','doc_demo',datetime('now','-5 days')),
 ('lab_cardio_diabetes','doc_demo','pat_demo_lakshmi','Diabetes and renal panel',date('now','-6 days'),'lab','verified','doc_demo',datetime('now','-5 days')),
 ('lab_cardio_echo','doc_demo','pat_demo_lakshmi','Echocardiogram',date('now','-5 days'),'patient_upload','awaiting_verification',NULL,NULL),
 ('lab_more_thyroid','doc_demo','pat_demo_fatima','Thyroid function test',date('now','-2 days'),'patient_upload','awaiting_verification',NULL,NULL),
 ('lab_more_anaemia','doc_demo','pat_demo_nisha','Complete Blood Count',date('now','-8 days'),'lab','verified','doc_demo',datetime('now','-7 days'));
INSERT INTO lab_values (id,lab_report_id,doctor_id,analyte,value,unit,reference,flag) VALUES
 ('labv_cardio_1','lab_cardio_lipid','doc_demo','LDL cholesterol','132','mg/dL','Below 70','high'),
 ('labv_cardio_2','lab_cardio_lipid','doc_demo','HDL cholesterol','39','mg/dL','Above 50','low'),
 ('labv_cardio_3','lab_cardio_lipid','doc_demo','Triglycerides','186','mg/dL','Below 150','high'),
 ('labv_cardio_4','lab_cardio_diabetes','doc_demo','HbA1c','7.6','%','Below 7.0','high'),
 ('labv_cardio_5','lab_cardio_diabetes','doc_demo','Creatinine','1.1','mg/dL','0.6-1.2','normal'),
 ('labv_cardio_6','lab_cardio_diabetes','doc_demo','eGFR','68','mL/min','Above 60','normal'),
 ('labv_cardio_7','lab_cardio_echo','doc_demo','LVEF','48','%','55-70','low'),
 ('labv_cardio_8','lab_more_thyroid','doc_demo','TSH','8.2','mIU/L','0.4-4.0','high'),
 ('labv_cardio_9','lab_more_anaemia','doc_demo','Haemoglobin','9.8','g/dL','12.0-15.0','low'),
 ('labv_cardio_10','lab_more_anaemia','doc_demo','MCV','72','fL','80-100','low');

DELETE FROM invoices WHERE id = 'inv_demo_cardio';
INSERT INTO invoices (id,doctor_id,patient_id,visit_id,invoice_no,status,issued_on,subtotal,discount,tax_rate,tax_amount,total,note) VALUES
 ('inv_demo_cardio','doc_demo','pat_demo_lakshmi','visit_demo_cardio','DEMO/INV/2026/0015','issued',date('now','-4 days'),180000,10000,0,0,170000,'Consultation, ECG and medicines');
INSERT OR REPLACE INTO invoice_items (id,invoice_id,doctor_id,kind,description,quantity,unit_price,amount,sort_order) VALUES
 ('invi_cardio_1','inv_demo_cardio','doc_demo','consultation','Cardiac follow-up consultation',1,80000,80000,1),
 ('invi_cardio_2','inv_demo_cardio','doc_demo','procedure','ECG',1,50000,50000,2),
 ('invi_cardio_3','inv_demo_cardio','doc_demo','medicine','Medicines dispensed',1,50000,50000,3);
INSERT OR REPLACE INTO payments (id,invoice_id,doctor_id,amount,method,reference,received_on,received_by) VALUES
 ('pay_demo_cardio_1','inv_demo_cardio','doc_demo',100000,'card','VISA •••• 4281',date('now','-4 days'),'usr_demo_front'),
 ('pay_demo_cardio_2','inv_demo_cardio','doc_demo',70000,'upi','UPI-QR-DEMO-98214',date('now','-4 days'),'usr_demo_front');

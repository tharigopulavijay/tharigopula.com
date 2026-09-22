-- Longitudinal fictional results for patient-history demonstration.
DELETE FROM lab_values WHERE id LIKE 'labv_lakshmi_history_%';
DELETE FROM lab_reports WHERE id LIKE 'lab_lakshmi_history_%';
INSERT INTO lab_reports (id,doctor_id,patient_id,report_name,reported_on,source,status,verified_by,verified_at) VALUES
 ('lab_lakshmi_history_1','doc_demo','pat_demo_lakshmi','Cardiometabolic review',date('now','-185 days'),'lab','verified','doc_demo',datetime('now','-185 days')),
 ('lab_lakshmi_history_2','doc_demo','pat_demo_lakshmi','Cardiometabolic review',date('now','-96 days'),'lab','verified','doc_demo',datetime('now','-96 days')),
 ('lab_lakshmi_history_3','doc_demo','pat_demo_lakshmi','Cardiometabolic review',date('now','-35 days'),'lab','verified','doc_demo',datetime('now','-35 days'));
INSERT INTO lab_values (id,lab_report_id,doctor_id,analyte,value,unit,reference,flag) VALUES
 ('labv_lakshmi_history_1','lab_lakshmi_history_1','doc_demo','HbA1c','8.6','%','Below 7.0','high'),
 ('labv_lakshmi_history_2','lab_lakshmi_history_2','doc_demo','HbA1c','8.1','%','Below 7.0','high'),
 ('labv_lakshmi_history_3','lab_lakshmi_history_3','doc_demo','HbA1c','7.8','%','Below 7.0','high'),
 ('labv_lakshmi_history_4','lab_lakshmi_history_1','doc_demo','LDL cholesterol','158','mg/dL','Below 70','high'),
 ('labv_lakshmi_history_5','lab_lakshmi_history_2','doc_demo','LDL cholesterol','149','mg/dL','Below 70','high'),
 ('labv_lakshmi_history_6','lab_lakshmi_history_3','doc_demo','LDL cholesterol','141','mg/dL','Below 70','high'),
 ('labv_lakshmi_history_7','lab_lakshmi_history_1','doc_demo','Triglycerides','238','mg/dL','Below 150','high'),
 ('labv_lakshmi_history_8','lab_lakshmi_history_2','doc_demo','Triglycerides','214','mg/dL','Below 150','high'),
 ('labv_lakshmi_history_9','lab_lakshmi_history_3','doc_demo','Triglycerides','198','mg/dL','Below 150','high'),
 ('labv_lakshmi_history_10','lab_lakshmi_history_1','doc_demo','Creatinine','1.0','mg/dL','0.6-1.2','normal'),
 ('labv_lakshmi_history_11','lab_lakshmi_history_2','doc_demo','Creatinine','1.0','mg/dL','0.6-1.2','normal'),
 ('labv_lakshmi_history_12','lab_lakshmi_history_3','doc_demo','Creatinine','1.1','mg/dL','0.6-1.2','normal');
DELETE FROM patient_access_links WHERE id = 'pal_demo_lakshmi';
INSERT INTO patient_access_links (id,token_hash,patient_id,doctor_id,created_by,created_at,expires_at,opened_count) VALUES
 ('pal_demo_lakshmi','cbd023bd61f94c3bc2df5134dff587e7ee5abaeb53ae00a8fb1e904c61ca4409','pat_demo_lakshmi','doc_demo','doc_demo',datetime('now'),datetime('now','+365 days'),0);

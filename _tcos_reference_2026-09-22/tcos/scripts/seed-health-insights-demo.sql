-- =========================================================================
-- HEALTH INSIGHTS EXAMPLES — STAGING/LOCAL ONLY, NEVER PRODUCTION.
--
-- Five fictional patients deliberately share one diagnosis, test and
-- laboratory so the owner can see the cohort privacy floor working. These
-- are real clinical-shaped rows, not a special analytics shortcut.
-- Requires seed-expanded-demo.sql and migration 039 or later.
-- =========================================================================

DELETE FROM visits WHERE id LIKE 'visit_health_insight_demo_%';
INSERT INTO visits
  (id,doctor_id,patient_id,visited_on,visit_type,complaints,diagnosis,vitals,
   findings,advice,follow_up_on,status,closed_at) VALUES
 ('visit_health_insight_demo_1','doc_demo','pat_demo_lakshmi',date('now','-92 days'),'follow_up','Blood pressure review','Essential hypertension','{"bp":"142/86"}','{}','Continue monitoring',date('now','-62 days'),'completed',datetime('now','-92 days')),
 ('visit_health_insight_demo_2','doc_demo','pat_demo_arjun',date('now','-78 days'),'follow_up','Blood pressure review','Essential hypertension','{"bp":"146/88"}','{}','Reduce salt and review',date('now','-48 days'),'completed',datetime('now','-78 days')),
 ('visit_health_insight_demo_3','doc_demo','pat_demo_fatima',date('now','-65 days'),'follow_up','Blood pressure review','Essential hypertension','{"bp":"144/90"}','{}','Home BP diary',date('now','-35 days'),'completed',datetime('now','-65 days')),
 ('visit_health_insight_demo_4','doc_demo','pat_demo_kiran',date('now','-51 days'),'follow_up','Blood pressure review','Essential hypertension','{"bp":"140/86"}','{}','Exercise and review',date('now','-21 days'),'completed',datetime('now','-51 days')),
 ('visit_health_insight_demo_5','doc_demo','pat_demo_savita',date('now','-38 days'),'follow_up','Blood pressure review','Essential hypertension','{"bp":"148/92"}','{}','Medication adherence reviewed',date('now','-8 days'),'completed',datetime('now','-38 days'));

DELETE FROM lab_values WHERE id LIKE 'labv_health_insight_demo_%';
DELETE FROM lab_reports WHERE id LIKE 'lab_health_insight_demo_%';
INSERT INTO lab_reports
  (id,doctor_id,patient_id,report_name,lab_name,reported_on,source,status,
   verified_by,verified_at) VALUES
 ('lab_health_insight_demo_1','doc_demo','pat_demo_lakshmi','Complete Blood Count','City Diagnostics Hyderabad',date('now','-90 days'),'lab','verified','doc_demo',datetime('now','-89 days')),
 ('lab_health_insight_demo_2','doc_demo','pat_demo_arjun','Complete Blood Count','City Diagnostics Hyderabad',date('now','-76 days'),'lab','verified','doc_demo',datetime('now','-75 days')),
 ('lab_health_insight_demo_3','doc_demo','pat_demo_fatima','Complete Blood Count','City Diagnostics Hyderabad',date('now','-63 days'),'lab','verified','doc_demo',datetime('now','-62 days')),
 ('lab_health_insight_demo_4','doc_demo','pat_demo_kiran','Complete Blood Count','City Diagnostics Hyderabad',date('now','-49 days'),'lab','verified','doc_demo',datetime('now','-48 days')),
 ('lab_health_insight_demo_5','doc_demo','pat_demo_savita','Complete Blood Count','City Diagnostics Hyderabad',date('now','-36 days'),'lab','verified','doc_demo',datetime('now','-35 days'));

INSERT INTO lab_values
  (id,lab_report_id,doctor_id,analyte,value,unit,reference,flag) VALUES
 ('labv_health_insight_demo_1','lab_health_insight_demo_1','doc_demo','Haemoglobin','12.8','g/dL','12.0-15.0','normal'),
 ('labv_health_insight_demo_2','lab_health_insight_demo_2','doc_demo','Haemoglobin','14.1','g/dL','13.0-17.0','normal'),
 ('labv_health_insight_demo_3','lab_health_insight_demo_3','doc_demo','Haemoglobin','11.7','g/dL','12.0-15.0','low'),
 ('labv_health_insight_demo_4','lab_health_insight_demo_4','doc_demo','Haemoglobin','13.9','g/dL','13.0-17.0','normal'),
 ('labv_health_insight_demo_5','lab_health_insight_demo_5','doc_demo','Haemoglobin','12.4','g/dL','12.0-15.0','normal');

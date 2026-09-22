-- =========================================================================
-- OWNER CONSOLE EXAMPLES — STAGING/LOCAL ONLY, NEVER PRODUCTION.
--
-- Kept separate from clinic activity so refreshing two application rows does
-- not rewrite visits, prescriptions, invoices or stock. Every identity and
-- provider id below is unmistakably fictional.
-- Requires migrations through 049 and seed-accounts-demo.sql.
-- =========================================================================

DELETE FROM support_requests WHERE id LIKE 'support_demo_%';
INSERT INTO support_requests (id,doctor_id,created_by,category,subject,message,status,priority,admin_note,created_at,updated_at) VALUES
 ('support_demo_1','doc_demo','doc_demo','feature','Enable WhatsApp reminders','Please enable reminders for tomorrow appointments.','open','normal',NULL,datetime('now','-2 hours'),datetime('now','-2 hours')),
 ('support_demo_2','doc_homeo','doc_homeo','verification','Verify medical registration certificate','Certificate uploaded from My Practice.','in_progress','high','Registration check started.',datetime('now','-2 days'),datetime('now','-1 day')),
 ('support_demo_3','doc_allo','doc_allo','help','How do I correct a receipt?','Need help correcting the payment method on a receipt.','resolved','normal','Explained cancel-and-reissue workflow.',datetime('now','-8 days'),datetime('now','-7 days'));

INSERT INTO support_messages
  (id,request_id,author_type,author_ref,body,internal,created_at) VALUES
 ('support_msg_demo_1a','support_demo_1','clinic','doc_demo','Please enable reminders for tomorrow appointments. We have 23 bookings and currently call each patient by hand.',0,datetime('now','-2 hours')),
 ('support_msg_demo_2a','support_demo_2','clinic','doc_homeo','Certificate uploaded from My Practice. Please confirm whether anything else is needed.',0,datetime('now','-2 days')),
 ('support_msg_demo_2b','support_demo_2','platform','hello.tharigopula@gmail.com','Registration check started. We will update this thread after comparing it with the council register.',0,datetime('now','-1 day')),
 ('support_msg_demo_3a','support_demo_3','clinic','doc_allo','Need help correcting the payment method on a receipt. The patient paid by UPI but I selected cash.',0,datetime('now','-8 days')),
 ('support_msg_demo_3b','support_demo_3','platform','hello.tharigopula@gmail.com','Cancel the issued receipt with the reason, then reissue it using UPI. The original remains in the audit trail.',0,datetime('now','-7 days'));

DELETE FROM doctor_applications WHERE id LIKE 'application_demo_%';
INSERT INTO doctor_applications
  (id,full_name,mobile,email,qualification,registration_no,council,clinic_name,
   city,state,discipline,facility_type,doctor_count,staff_count,message,source,
   status,review_note,created_at,updated_at) VALUES
 ('application_demo_1','Dr. Ananya Rao','+919111110001','ananya@example.test','MBBS, MD','DEMO-NMC-2401','Telangana Medical Council','Lakeview Family Clinic','Hyderabad','Telangana','allocos','clinic',1,3,'Interested in online booking, prescriptions and patient report trends.','staging_demo','new',NULL,datetime('now','-5 hours'),datetime('now','-5 hours')),
 ('application_demo_2','Dr. Nikhil Varma','+919111110002','nikhil@example.test','BHMS','DEMO-CCH-8182','National Commission for Homoeopathy','Sanjeevani Homoeo Centre','Vijayawada','Andhra Pradesh','homeocos','multi_doctor',3,5,'Need migration help for existing patient records.','staging_demo','reviewing','Council lookup queued; migration sample requested.',datetime('now','-2 days'),datetime('now','-1 day'));

-- Provider-shaped demonstrations only; nothing is sent to Razorpay.
DELETE FROM subscription_payments WHERE id LIKE 'payment_demo_%';
DELETE FROM subscriptions WHERE id LIKE 'subscription_demo_%';
INSERT INTO subscriptions
  (id,doctor_id,provider,provider_subscription_id,provider_plan_id,plan,cadence,
   price_paise,currency,status,current_start,current_end,access_until,
   cancel_at_cycle_end,created_at,updated_at) VALUES
 ('subscription_demo_1','doc_demo','razorpay','sub_STAGING_DEMO_ACTIVE','plan_STAGING_DEMO_PRO','pro','monthly',219900,'INR','active',datetime('now','-12 days'),datetime('now','+18 days'),datetime('now','+18 days'),0,datetime('now','-12 days'),datetime('now','-12 days')),
 ('subscription_demo_2','doc_homeo','razorpay','sub_STAGING_DEMO_PENDING','plan_STAGING_DEMO_STARTER','starter','yearly',899000,'INR','pending',datetime('now','-350 days'),datetime('now','+15 days'),datetime('now','+3 days'),0,datetime('now','-350 days'),datetime('now','-1 day'));
INSERT INTO subscription_payments
  (id,doctor_id,subscription_id,provider,provider_payment_id,amount_paise,
   currency,status,occurred_at,recorded_at) VALUES
 ('payment_demo_1','doc_demo','subscription_demo_1','razorpay','pay_STAGING_DEMO_1',219900,'INR','captured',datetime('now','-12 days'),datetime('now','-12 days'));
UPDATE doctors SET plan = 'pro', plan_source = 'payment',
       plan_override_reason = NULL, plan_updated_at = datetime('now','-12 days')
 WHERE id = 'doc_demo';

DELETE FROM business_costs WHERE id LIKE 'business_cost_demo_%';
INSERT INTO business_costs
  (id,label,category,vendor,scope,doctor_id,amount_paise,cadence,cash_type,
   allocation_percent,starts_on,note,created_by) VALUES
 ('business_cost_demo_1','Owner product and support time','people',NULL,'tcos',NULL,5000000,'monthly','imputed',100,date('now','start of month'),'Economic cost of Vijay''s TCOS time; no bank payment.','hello.tharigopula@gmail.com'),
 ('business_cost_demo_2','ChatGPT Pro','software','OpenAI','shared',NULL,199900,'monthly','cash',50,date('now','start of month'),'Half allocated to TCOS; edit when actual product usage changes.','hello.tharigopula@gmail.com'),
 ('business_cost_demo_3','TCOS domain allocation','infrastructure','Registrar','tcos',NULL,190000,'yearly','cash',100,date('now','start of year'),'Annual domain cost spread over twelve months.','hello.tharigopula@gmail.com');

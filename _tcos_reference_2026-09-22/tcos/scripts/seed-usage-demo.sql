-- =========================================================================
-- A month of realistic usage, so the Money screen shows the shape of the
-- costs rather than an empty breakdown.
--
-- The numbers are what a busy single-doctor clinic actually generates in a
-- month, and they are chosen to make the one counter-intuitive fact
-- visible: MESSAGES COST MORE THAN EVERYTHING ELSE COMBINED.
--
--   600 WhatsApp messages   @ 55p  = ₹330.00
--   1.8 GB stored           @ 132p = ₹  2.38
--   40,000 rows written     @ 9p/k = ₹  3.60
--   900 file reads          @ 4p/k = ₹  0.04
--
-- Storage is 0.7% of the bill. Anyone pricing a plan by gigabytes is
-- charging the customer for the cheapest thing in the system.
--
-- Idempotent: the keys are fixed, and idempotency_key is UNIQUE.
-- =========================================================================

DELETE FROM usage_events WHERE idempotency_key LIKE 'demo-usage-%';

INSERT INTO usage_events
  (id, doctor_id, event_type, quantity, unit, estimated_cost, idempotency_key, occurred_at)
VALUES
 -- The AyurCOS clinic: busy, messaging its patients.
 ('use_d1','doc_demo','whatsapp_message',600,'each',NULL,'demo-usage-1',datetime('now','-6 days')),
 ('use_d2','doc_demo','sms_message',120,'each',NULL,'demo-usage-2',datetime('now','-6 days')),
 ('use_d3','doc_demo','storage_gb_month',1.8,'gb_month',NULL,'demo-usage-3',datetime('now','-6 days')),
 ('use_d4','doc_demo','rows_written_1k',40,'per_1000',NULL,'demo-usage-4',datetime('now','-6 days')),
 ('use_d5','doc_demo','class_b_1k',0.9,'per_1000',NULL,'demo-usage-5',datetime('now','-6 days')),
 ('use_d6','doc_demo','ai_document',45,'each',NULL,'demo-usage-6',datetime('now','-5 days')),

 -- HomeoCOS: same plan, a quarter of the messaging. The margin difference
 -- between these two clinics is the entire argument for metering messages
 -- and not metering storage.
 ('use_h1','doc_homeo','whatsapp_message',150,'each',NULL,'demo-usage-7',datetime('now','-4 days')),
 ('use_h2','doc_homeo','storage_gb_month',0.6,'gb_month',NULL,'demo-usage-8',datetime('now','-4 days')),
 ('use_h3','doc_homeo','rows_written_1k',12,'per_1000',NULL,'demo-usage-9',datetime('now','-4 days')),

 -- AloCOS: heavy messaging on the same price. This is the clinic that
 -- quietly erodes the margin, and the screen should say so.
 ('use_a1','doc_allo','whatsapp_message',1400,'each',NULL,'demo-usage-10',datetime('now','-3 days')),
 ('use_a2','doc_allo','sms_message',400,'each',NULL,'demo-usage-11',datetime('now','-3 days')),
 ('use_a3','doc_allo','storage_gb_month',2.1,'gb_month',NULL,'demo-usage-12',datetime('now','-3 days')),
 ('use_a4','doc_allo','rows_written_1k',55,'per_1000',NULL,'demo-usage-13',datetime('now','-3 days')),
 ('use_a5','doc_allo','ai_document',120,'each',NULL,'demo-usage-14',datetime('now','-2 days'));

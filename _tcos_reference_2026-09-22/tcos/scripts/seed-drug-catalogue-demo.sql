-- =========================================================================
-- A working medicine catalogue for the demonstration, across all three
-- products.
--
-- This is NOT the full catalogue. scripts/build-drug-seed.js generates that
-- from two public datasets (1,272 allopathic molecules with 6,318 strengths,
-- plus 360 Ayurvedic herbs), and it needs those source files present. Until
-- someone runs it, every product's medicine type-ahead is dead, which makes
-- prescribing look like a feature TCOS does not have.
--
-- So this file seeds a curated subset - the medicines an Indian clinic
-- actually reaches for - so the type-ahead demonstrably works. Running the
-- full builder later simply adds rows on top; the ids are the same slugs.
--
-- It also covers a gap in the builder itself: there is no homeopathy source
-- in it at all, so HomeoCOS would have an empty remedy list even after the
-- full catalogue was loaded. The remedies below are the standard polychrests
-- with their conventional abbreviations as search terms.
--
-- The catalogue decides nothing. It does not pick a dose, does not check an
-- interaction, and never blocks the doctor from typing something that is not
-- in it. Every row carries its source.
-- =========================================================================

DELETE FROM drug_strengths WHERE drug_id IN (SELECT id FROM drug_catalogue WHERE source LIKE 'curated-demo%');
DELETE FROM drug_catalogue WHERE source LIKE 'curated-demo%';

-- ------------------------------------------------------- allopathy -----
INSERT OR REPLACE INTO drug_catalogue (id,system,name,detail,search_text,popularity,source) VALUES
 ('paracetamol','allopathy','Paracetamol','Acetaminophen · analgesic, antipyretic','paracetamol acetaminophen pcm crocin dolo calpol fever pain',100,'curated-demo'),
 ('amoxicillin','allopathy','Amoxicillin','Aminopenicillin antibiotic','amoxicillin amoxil mox antibiotic penicillin',94,'curated-demo'),
 ('amoxiclav','allopathy','Amoxicillin + Clavulanic acid','Beta-lactam with beta-lactamase inhibitor','amoxicillin clavulanic clavulanate augmentin coamoxiclav',88,'curated-demo'),
 ('azithromycin','allopathy','Azithromycin','Macrolide antibiotic','azithromycin azithral azee macrolide',86,'curated-demo'),
 ('metformin','allopathy','Metformin','Biguanide · type 2 diabetes','metformin glycomet glucophage diabetes biguanide',92,'curated-demo'),
 ('glimepiride','allopathy','Glimepiride','Sulfonylurea · type 2 diabetes','glimepiride amaryl sulfonylurea diabetes',72,'curated-demo'),
 ('telmisartan','allopathy','Telmisartan','Angiotensin receptor blocker','telmisartan telma arb hypertension bp',84,'curated-demo'),
 ('amlodipine','allopathy','Amlodipine','Calcium channel blocker','amlodipine amlong norvasc hypertension bp',85,'curated-demo'),
 ('atorvastatin','allopathy','Atorvastatin','HMG-CoA reductase inhibitor','atorvastatin atorva lipitor statin cholesterol',80,'curated-demo'),
 ('pantoprazole','allopathy','Pantoprazole','Proton pump inhibitor','pantoprazole pan pantocid ppi acidity reflux',90,'curated-demo'),
 ('omeprazole','allopathy','Omeprazole','Proton pump inhibitor','omeprazole omez ppi acidity',78,'curated-demo'),
 ('ondansetron','allopathy','Ondansetron','5-HT3 antagonist · antiemetic','ondansetron emeset zofran vomiting nausea',74,'curated-demo'),
 ('cetirizine','allopathy','Cetirizine','Second-generation antihistamine','cetirizine cetzine zyrtec allergy antihistamine',82,'curated-demo'),
 ('montelukast','allopathy','Montelukast','Leukotriene receptor antagonist','montelukast montair asthma allergy',70,'curated-demo'),
 ('salbutamol','allopathy','Salbutamol','Short-acting beta-2 agonist','salbutamol albuterol asthalin ventolin asthma inhaler',76,'curated-demo'),
 ('ibuprofen','allopathy','Ibuprofen','NSAID','ibuprofen brufen nsaid pain inflammation',79,'curated-demo'),
 ('diclofenac','allopathy','Diclofenac','NSAID','diclofenac voveran nsaid pain',75,'curated-demo'),
 ('levothyroxine','allopathy','Levothyroxine','Thyroid hormone replacement','levothyroxine thyronorm eltroxin thyroid hypothyroid',81,'curated-demo'),
 ('metronidazole','allopathy','Metronidazole','Nitroimidazole antimicrobial','metronidazole flagyl metrogyl amoebiasis',68,'curated-demo'),
 ('ferrous-ascorbate','allopathy','Ferrous ascorbate','Oral iron','ferrous ascorbate iron anaemia haemoglobin',66,'curated-demo');

-- ------------------------------------------------------ supplements -----
INSERT OR REPLACE INTO drug_catalogue (id,system,name,detail,search_text,popularity,source) VALUES
 ('cholecalciferol','supplement','Vitamin D3','Cholecalciferol','vitamin d3 cholecalciferol d vitamin deficiency',88,'curated-demo'),
 ('methylcobalamin','supplement','Methylcobalamin','Vitamin B12','methylcobalamin b12 vitamin neuropathy',77,'curated-demo'),
 ('calcium-carbonate','supplement','Calcium carbonate','With vitamin D3','calcium carbonate bone shelcal',73,'curated-demo'),
 ('folic-acid','supplement','Folic acid','Vitamin B9','folic acid folate b9 pregnancy',69,'curated-demo');

-- -------------------------------------------------------- ayurveda -----
INSERT OR REPLACE INTO drug_catalogue (id,system,name,detail,search_text,popularity,source) VALUES
 ('ashwagandha','ayurveda','Ashwagandha','Withania somnifera · Indian winter cherry','ashwagandha withania somnifera winter cherry rasayana balya',96,'curated-demo'),
 ('triphala','ayurveda','Triphala','Amalaki, Bibhitaki, Haritaki','triphala amalaki bibhitaki haritaki churna virechana',95,'curated-demo'),
 ('guduchi','ayurveda','Guduchi','Tinospora cordifolia · Giloy','guduchi giloy tinospora cordifolia amrita jvara',90,'curated-demo'),
 ('yashtimadhu','ayurveda','Yashtimadhu','Glycyrrhiza glabra · Liquorice','yashtimadhu mulethi liquorice licorice glycyrrhiza amlapitta',85,'curated-demo'),
 ('brahmi','ayurveda','Brahmi','Bacopa monnieri','brahmi bacopa monnieri medhya memory',87,'curated-demo'),
 ('shatavari','ayurveda','Shatavari','Asparagus racemosus','shatavari asparagus racemosus rasayana stri',84,'curated-demo'),
 ('haridra','ayurveda','Haridra','Curcuma longa · Turmeric','haridra turmeric curcuma longa curcumin',86,'curated-demo'),
 ('avipattikara','ayurveda','Avipattikara Churna','Classical formulation for amlapitta','avipattikara avipattikar churna amlapitta acidity',80,'curated-demo'),
 ('drakshasava','ayurveda','Drakshasava','Fermented preparation of Vitis vinifera','drakshasava draksha asava arishta',72,'curated-demo'),
 ('ksheerabala','ayurveda','Ksheerabala Taila','Medicated oil with Bala and milk','ksheerabala taila oil bala abhyanga vata',70,'curated-demo'),
 ('dashamoola','ayurveda','Dashamoola Kwatha','Ten-root decoction','dashamoola dashmool kwatha kashaya vata',74,'curated-demo'),
 ('chyawanprash','ayurveda','Chyawanprash','Amalaki-based avaleha','chyawanprash chyavanaprasha avaleha rasayana',82,'curated-demo'),
 ('arjuna','ayurveda','Arjuna','Terminalia arjuna','arjuna terminalia hridya cardiac',76,'curated-demo'),
 ('punarnava','ayurveda','Punarnava','Boerhavia diffusa','punarnava boerhavia diffusa shotha oedema',71,'curated-demo'),
 ('trikatu','ayurveda','Trikatu','Pippali, Maricha, Shunthi','trikatu pippali maricha shunthi deepana agni',73,'curated-demo');

-- ------------------------------------------------------ homeopathy -----
-- The polychrests, with the abbreviations a homeopath actually types.
INSERT OR REPLACE INTO drug_catalogue (id,system,name,detail,search_text,popularity,source) VALUES
 ('sulphur','homeopathy','Sulphur','Polychrest · psoric','sulphur sulph sul psora polychrest',95,'curated-demo'),
 ('natrum-mur','homeopathy','Natrum Muriaticum','Sodium chloride · polychrest','natrum muriaticum nat mur natmur sodium chloride grief',94,'curated-demo'),
 ('lycopodium','homeopathy','Lycopodium Clavatum','Club moss · polychrest','lycopodium lyco clavatum club moss digestive',92,'curated-demo'),
 ('pulsatilla','homeopathy','Pulsatilla Nigricans','Wind flower · polychrest','pulsatilla puls nigricans wind flower changeable',91,'curated-demo'),
 ('calcarea-carb','homeopathy','Calcarea Carbonica','Oyster shell calcium','calcarea carbonica calc carb oyster shell',90,'curated-demo'),
 ('phosphorus','homeopathy','Phosphorus','Polychrest','phosphorus phos sympathetic haemorrhage',88,'curated-demo'),
 ('arsenicum-album','homeopathy','Arsenicum Album','Arsenic trioxide','arsenicum album ars alb arsenic restless anxiety',89,'curated-demo'),
 ('belladonna','homeopathy','Belladonna','Deadly nightshade','belladonna bell atropa nightshade fever sudden',86,'curated-demo'),
 ('bryonia','homeopathy','Bryonia Alba','White bryony','bryonia bry alba worse motion',84,'curated-demo'),
 ('rhus-tox','homeopathy','Rhus Toxicodendron','Poison ivy','rhus tox toxicodendron poison ivy better motion',85,'curated-demo'),
 ('nux-vomica','homeopathy','Nux Vomica','Poison nut','nux vomica nux poison nut irritable digestive',87,'curated-demo'),
 ('sepia','homeopathy','Sepia Officinalis','Cuttlefish ink','sepia sep officinalis cuttlefish indifference',83,'curated-demo'),
 ('graphites','homeopathy','Graphites','Black lead','graphites graph black lead eczema skin',78,'curated-demo'),
 ('silicea','homeopathy','Silicea','Pure flint','silicea sil silica flint suppuration',80,'curated-demo'),
 ('thuja','homeopathy','Thuja Occidentalis','Arbor vitae · sycotic','thuja occidentalis arbor vitae sycosis warts',79,'curated-demo'),
 ('ignatia','homeopathy','Ignatia Amara','St Ignatius bean','ignatia ign amara grief hysteria',77,'curated-demo'),
 ('apis','homeopathy','Apis Mellifica','Honey bee','apis mellifica bee sting oedema stinging',74,'curated-demo'),
 ('china','homeopathy','China Officinalis','Cinchona bark','china officinalis cinchona quinine debility',73,'curated-demo'),
 ('calendula','homeopathy','Calendula Officinalis','Marigold · commonly used as mother tincture','calendula officinalis marigold wound antiseptic',76,'curated-demo'),
 ('arnica','homeopathy','Arnica Montana','Leopard bane','arnica montana leopard bane injury bruise trauma',93,'curated-demo');

-- ---------------------------------------------------------- strengths --
-- Allopathic molecules are picked by strength; the doctor thinks
-- "paracetamol" first, then "650".
INSERT OR REPLACE INTO drug_strengths (drug_id,strength,form,weight) VALUES
 ('paracetamol','500mg','Tablet',100),('paracetamol','650mg','Tablet',95),
 ('paracetamol','125mg/5ml','Syrup',70),('paracetamol','250mg/5ml','Syrup',60),
 ('amoxicillin','250mg','Capsule',80),('amoxicillin','500mg','Capsule',95),
 ('amoxiclav','625mg','Tablet',95),('amoxiclav','1g','Tablet',70),
 ('azithromycin','250mg','Tablet',85),('azithromycin','500mg','Tablet',95),
 ('metformin','500mg','Tablet',100),('metformin','850mg','Tablet',70),
 ('metformin','1g','Tablet',80),
 ('glimepiride','1mg','Tablet',85),('glimepiride','2mg','Tablet',80),
 ('telmisartan','20mg','Tablet',75),('telmisartan','40mg','Tablet',95),
 ('amlodipine','2.5mg','Tablet',60),('amlodipine','5mg','Tablet',100),
 ('amlodipine','10mg','Tablet',70),
 ('atorvastatin','10mg','Tablet',90),('atorvastatin','20mg','Tablet',80),
 ('atorvastatin','40mg','Tablet',60),
 ('pantoprazole','40mg','Tablet',100),('pantoprazole','20mg','Tablet',60),
 ('omeprazole','20mg','Capsule',90),
 ('ondansetron','4mg','Tablet',90),('ondansetron','2mg/ml','Injection',60),
 ('cetirizine','10mg','Tablet',100),('cetirizine','5mg/5ml','Syrup',65),
 ('montelukast','10mg','Tablet',90),('montelukast','5mg','Tablet',60),
 ('salbutamol','100mcg','Inhaler',95),('salbutamol','2mg','Tablet',55),
 ('ibuprofen','400mg','Tablet',95),('ibuprofen','200mg','Tablet',65),
 ('diclofenac','50mg','Tablet',90),('diclofenac','75mg','Injection',60),
 ('levothyroxine','25mcg','Tablet',80),('levothyroxine','50mcg','Tablet',95),
 ('levothyroxine','100mcg','Tablet',75),
 ('metronidazole','400mg','Tablet',90),
 ('ferrous-ascorbate','100mg','Tablet',85),
 ('cholecalciferol','60000 IU','Sachet',100),('cholecalciferol','1000 IU','Tablet',60),
 ('methylcobalamin','500mcg','Tablet',90),('methylcobalamin','1500mcg','Tablet',70),
 ('calcium-carbonate','500mg','Tablet',90),
 ('folic-acid','5mg','Tablet',90);

-- Homeopathic remedies are picked by potency, not milligrams. Every remedy
-- is dispensed in the same ladder of potencies, so these are generated from
-- the catalogue rather than typed out 120 times.
--
-- One statement per potency, deliberately. The obvious version is a single
-- CROSS JOIN against a six-branch UNION ALL, and it works under node:sqlite
-- but D1 rejects it with "too many terms in compound SELECT" - D1's limit is
-- lower than the SQLite default. Six plain statements have no such limit and
-- are easier to read anyway.
INSERT OR REPLACE INTO drug_strengths (drug_id,strength,form,weight)
  SELECT id,'30C','Globules',100 FROM drug_catalogue
   WHERE system='homeopathy' AND source LIKE 'curated-demo%';
INSERT OR REPLACE INTO drug_strengths (drug_id,strength,form,weight)
  SELECT id,'200C','Globules',95 FROM drug_catalogue
   WHERE system='homeopathy' AND source LIKE 'curated-demo%';
INSERT OR REPLACE INTO drug_strengths (drug_id,strength,form,weight)
  SELECT id,'6C','Globules',80 FROM drug_catalogue
   WHERE system='homeopathy' AND source LIKE 'curated-demo%';
INSERT OR REPLACE INTO drug_strengths (drug_id,strength,form,weight)
  SELECT id,'1M','Globules',75 FROM drug_catalogue
   WHERE system='homeopathy' AND source LIKE 'curated-demo%';
INSERT OR REPLACE INTO drug_strengths (drug_id,strength,form,weight)
  SELECT id,'10M','Globules',55 FROM drug_catalogue
   WHERE system='homeopathy' AND source LIKE 'curated-demo%';
INSERT OR REPLACE INTO drug_strengths (drug_id,strength,form,weight)
  SELECT id,'Q (mother tincture)','Tincture',50 FROM drug_catalogue
   WHERE system='homeopathy' AND source LIKE 'curated-demo%';

-- Ayurvedic formulations are dispensed by measure rather than strength.
INSERT OR REPLACE INTO drug_strengths (drug_id,strength,form,weight) VALUES
 ('ashwagandha','500mg','Vati',95),('ashwagandha','3g','Churna',85),
 ('triphala','3g','Churna',95),('triphala','500mg','Vati',80),
 ('guduchi','500mg','Ghana Vati',95),('guduchi','3g','Churna',75),
 ('yashtimadhu','2g','Churna',95),
 ('brahmi','500mg','Vati',90),('brahmi','10ml','Ghrita',65),
 ('shatavari','3g','Churna',90),
 ('haridra','500mg','Vati',90),
 ('avipattikara','3g','Churna',95),
 ('drakshasava','15ml','Asava',95),
 ('ksheerabala','External','Taila',95),
 ('dashamoola','15ml','Kwatha',95),
 ('chyawanprash','10g','Avaleha',95),
 ('arjuna','500mg','Vati',90),('arjuna','15ml','Kwatha',60),
 ('punarnava','500mg','Vati',90),
 ('trikatu','1g','Churna',90);

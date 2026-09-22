/* ---------------------------------------------------------------------------
   Builds the core drug catalogue: the molecules and formulations an Indian
   practice actually writes, across all three systems of medicine.

   Run:  node scripts/build-catalogue-core.js > migrations/033-drug-catalogue-core.sql

   WHY CURATED AND NOT SCRAPED
   ---------------------------
   scripts/build-drug-seed.js reduces a 254,000-brand dataset to molecules.
   That is the right tool for breadth, and it should still be run. But the
   catalogue in the database held 59 rows, and a doctor typing "cetri" got
   nothing while Cetirizine sat on her own pharmacy shelf. The fix that
   matters first is not 254,000 rows of long-tail brands - it is the few
   hundred molecules that make up the overwhelming majority of what is
   actually prescribed.

   WHAT THIS IS NOT
   ----------------
   It is a TYPING AID. It never decides a dose, never suggests an
   indication, never warns about an interaction and never blocks a
   prescription. The strengths listed are the pack strengths these are
   commonly sold in, so a doctor picks rather than types - the clinical
   decision stays entirely hers.

   Nothing here is invented. Anything uncertain was left out rather than
   guessed, which is why some entries carry no strengths at all.
   --------------------------------------------------------------------------- */

const SOURCE = 'tcos-core-catalogue';

/* name, [synonyms], [strengths], popularity (orders the suggestion list) */
const ALLOPATHY = [
  ['Paracetamol', ['acetaminophen', 'pcm', 'dolo', 'crocin', 'calpol'], ['500mg', '650mg', '125mg/5ml', '250mg/5ml'], 100],
  ['Cetirizine', ['cetrizine', 'cetzine', 'alerid'], ['10mg', '5mg', '5mg/5ml'], 95],
  ['Levocetirizine', ['levocet', 'levocetrizine'], ['5mg', '2.5mg/5ml'], 88],
  ['Amoxicillin', ['amoxycillin', 'mox'], ['250mg', '500mg', '125mg/5ml'], 90],
  ['Amoxicillin + Clavulanic acid', ['co-amoxiclav', 'augmentin', 'clavam'], ['625mg', '1g', '228mg/5ml'], 89],
  ['Azithromycin', ['azithral', 'azee'], ['250mg', '500mg', '200mg/5ml'], 87],
  ['Cefixime', ['taxim-o', 'zifi'], ['200mg', '100mg', '50mg/5ml'], 84],
  ['Ciprofloxacin', ['cifran', 'ciplox'], ['250mg', '500mg'], 78],
  ['Ofloxacin', ['oflox'], ['200mg', '400mg'], 72],
  ['Doxycycline', ['doxy'], ['100mg'], 70],
  ['Metronidazole', ['flagyl', 'metrogyl'], ['200mg', '400mg', '200mg/5ml'], 76],
  ['Ibuprofen', ['brufen', 'combiflam'], ['200mg', '400mg', '100mg/5ml'], 85],
  ['Diclofenac', ['voveran', 'volini'], ['50mg', '75mg', '1% gel'], 80],
  ['Aceclofenac', ['zerodol'], ['100mg'], 74],
  ['Naproxen', [], ['250mg', '500mg'], 55],
  ['Tramadol', [], ['50mg', '100mg'], 50],
  ['Pantoprazole', ['pantop', 'pan-d'], ['40mg', '20mg'], 92],
  ['Omeprazole', ['omez'], ['20mg', '40mg'], 82],
  ['Rabeprazole', ['razo'], ['20mg'], 68],
  ['Ranitidine', ['zinetac', 'rantac'], ['150mg', '300mg'], 45],
  ['Domperidone', ['domstal'], ['10mg'], 66],
  ['Ondansetron', ['emeset', 'vomikind'], ['4mg', '8mg', '2mg/5ml'], 73],
  ['Metformin', ['glycomet'], ['500mg', '850mg', '1g'], 93],
  ['Glimepiride', ['amaryl'], ['1mg', '2mg', '3mg'], 79],
  ['Sitagliptin', ['januvia', 'istamet'], ['50mg', '100mg'], 71],
  ['Insulin glargine', ['lantus', 'basalog'], ['100IU/ml'], 48],
  ['Telmisartan', ['telma'], ['20mg', '40mg', '80mg'], 86],
  ['Amlodipine', ['amlong', 'amlokind'], ['2.5mg', '5mg', '10mg'], 88],
  ['Losartan', ['losar'], ['25mg', '50mg'], 69],
  ['Ramipril', ['cardace'], ['2.5mg', '5mg', '10mg'], 62],
  ['Metoprolol', ['metolar'], ['25mg', '50mg'], 67],
  ['Atenolol', [], ['25mg', '50mg'], 58],
  ['Atorvastatin', ['atorva', 'lipvas'], ['10mg', '20mg', '40mg'], 83],
  ['Rosuvastatin', ['rosuvas'], ['5mg', '10mg', '20mg'], 75],
  ['Clopidogrel', ['clopilet', 'deplatt'], ['75mg'], 61],
  ['Aspirin', ['ecosprin', 'acetylsalicylic acid'], ['75mg', '150mg', '325mg'], 77],
  ['Montelukast', ['montair'], ['10mg', '5mg', '4mg'], 81],
  ['Salbutamol', ['asthalin', 'albuterol'], ['2mg', '4mg', '100mcg inhaler'], 72],
  ['Budesonide + Formoterol', ['foracort', 'symbicort'], ['200mcg', '400mcg'], 59],
  ['Prednisolone', ['omnacortil', 'wysolone'], ['5mg', '10mg', '20mg'], 70],
  ['Deflazacort', ['defcort'], ['6mg', '30mg'], 52],
  ['Hydroxyzine', ['atarax'], ['10mg', '25mg'], 44],
  ['Fexofenadine', ['allegra'], ['120mg', '180mg'], 64],
  ['Chlorpheniramine', ['cpm', 'piriton'], ['4mg'], 47],
  ['Dextromethorphan', ['benadryl dr'], ['10mg/5ml'], 42],
  ['Ambroxol', [], ['30mg', '15mg/5ml'], 56],
  ['Levothyroxine', ['thyronorm', 'eltroxin'], ['25mcg', '50mcg', '75mcg', '100mcg'], 85],
  ['Iron + Folic acid', ['ifa', 'orofer', 'ferrous ascorbate'], ['100mg', '60mg'], 74],
  ['Calcium + Vitamin D3', ['shelcal', 'calcimax'], ['500mg', '250mg'], 80],
  ['Vitamin D3', ['cholecalciferol', 'uprise-d3'], ['60000IU', '1000IU', '2000IU'], 82],
  ['Vitamin B12', ['cyanocobalamin', 'methylcobalamin', 'nurokind'], ['500mcg', '1500mcg'], 71],
  ['Folic acid', [], ['5mg'], 60],
  ['Zinc', ['zinc sulphate', 'zincovit'], ['20mg', '50mg'], 57],
  ['ORS', ['oral rehydration salts', 'electral'], ['21.8g sachet'], 76],
  ['Albendazole', ['zentel'], ['400mg'], 65],
  ['Ivermectin', [], ['6mg', '12mg'], 40],
  ['Fluconazole', ['forcan'], ['150mg', '200mg'], 63],
  ['Clotrimazole', ['candid'], ['1% cream', '1% solution'], 54],
  ['Mupirocin', ['t-bact'], ['2% ointment'], 46],
  ['Silver sulfadiazine', ['silverex'], ['1% cream'], 33],
  ['Sucralfate', [], ['1g/10ml'], 38],
  ['Lactulose', ['duphalac', 'looz'], ['10g/15ml'], 53],
  ['Isabgol', ['psyllium husk', 'naturolax'], ['3.5g'], 49],
  ['Amitriptyline', [], ['10mg', '25mg'], 36],
  ['Gabapentin', [], ['100mg', '300mg'], 43],
  ['Pregabalin', [], ['75mg', '150mg'], 51],
  ['Escitalopram', [], ['5mg', '10mg'], 41],
  ['Alprazolam', [], ['0.25mg', '0.5mg'], 34],
  ['Cetrizine + Phenylephrine', ['cold tablet'], [], 39],
  ['Tranexamic acid', ['pause'], ['500mg'], 37],
  ['Misoprostol', [], ['200mcg'], 25],
  ['Nifedipine', [], ['10mg', '20mg'], 30]
];

const AYURVEDA = [
  ['Ashwagandha', ['withania somnifera', 'winter cherry', 'asgandh'], ['500mg', '3g'], 100],
  ['Triphala', ['triphala churna'], ['500mg', '3g'], 98],
  ['Brahmi', ['bacopa monnieri', 'water hyssop'], ['500mg', '3g'], 88],
  ['Shatavari', ['asparagus racemosus'], ['500mg', '3g'], 86],
  ['Guduchi', ['giloy', 'tinospora cordifolia', 'amrita'], ['500mg', '3g'], 92],
  ['Tulsi', ['holy basil', 'ocimum sanctum'], ['500mg'], 85],
  ['Neem', ['azadirachta indica', 'nimba'], ['500mg'], 80],
  ['Amla', ['amalaki', 'emblica officinalis', 'indian gooseberry'], ['500mg', '3g'], 90],
  ['Haritaki', ['terminalia chebula'], ['500mg', '3g'], 76],
  ['Bibhitaki', ['terminalia bellirica'], ['500mg', '3g'], 70],
  ['Yashtimadhu', ['licorice', 'mulethi', 'glycyrrhiza glabra'], ['500mg', '3g'], 78],
  ['Punarnava', ['boerhavia diffusa'], ['500mg', '3g'], 68],
  ['Guggulu', ['commiphora mukul'], ['500mg'], 74],
  ['Shallaki', ['boswellia serrata', 'salai guggul'], ['500mg'], 66],
  ['Arjuna', ['terminalia arjuna'], ['500mg', '3g'], 79],
  ['Manjistha', ['rubia cordifolia'], ['500mg'], 58],
  ['Vacha', ['acorus calamus'], ['500mg'], 44],
  ['Bhringraj', ['eclipta alba'], ['500mg'], 62],
  ['Kutki', ['picrorhiza kurroa'], ['500mg'], 48],
  ['Methi', ['fenugreek', 'trigonella'], ['500mg', '3g'], 60],
  ['Jatamansi', ['nardostachys jatamansi'], ['500mg'], 46],
  ['Shankhpushpi', ['convolvulus pluricaulis'], ['500mg', '10ml'], 64],
  ['Gokshura', ['tribulus terrestris'], ['500mg'], 61],
  ['Vidanga', ['embelia ribes'], ['500mg'], 35],
  ['Pippali', ['long pepper', 'piper longum'], ['500mg'], 55],
  ['Avipattikara Churna', ['avipattikar'], ['3g'], 82],
  ['Sitopaladi Churna', ['sitopaladi'], ['3g'], 84],
  ['Talisadi Churna', ['talisadi'], ['3g'], 63],
  ['Hingvastak Churna', ['hingvastaka'], ['3g'], 65],
  ['Dashamoola', ['dashmool', 'dashamula'], ['3g', '15ml'], 72],
  ['Chyawanprash', ['chyavanprash'], ['10g'], 89],
  ['Drakshasava', [], ['15ml', '30ml'], 71],
  ['Ashokarishta', ['ashokarist'], ['15ml', '30ml'], 75],
  ['Dashamularishta', [], ['15ml', '30ml'], 67],
  ['Arjunarishta', [], ['15ml', '30ml'], 59],
  ['Kumaryasava', [], ['15ml'], 45],
  ['Saraswatarishta', [], ['15ml'], 52],
  ['Punarnavasava', [], ['15ml'], 41],
  ['Yograj Guggulu', ['yogaraja guggulu'], ['250mg', '500mg'], 77],
  ['Kaishore Guggulu', [], ['250mg', '500mg'], 69],
  ['Triphala Guggulu', [], ['250mg', '500mg'], 73],
  ['Kanchanar Guggulu', ['kanchnar guggul'], ['250mg', '500mg'], 66],
  ['Simhanad Guggulu', [], ['250mg'], 40],
  ['Guduchi Ghana Vati', ['giloy ghan vati'], ['250mg', '500mg'], 70],
  ['Chandraprabha Vati', [], ['250mg', '500mg'], 74],
  ['Arogyavardhini Vati', [], ['250mg'], 68],
  ['Sanjivani Vati', [], ['250mg'], 47],
  ['Khadiradi Vati', [], ['250mg'], 33],
  ['Lakshmivilas Rasa', [], ['125mg'], 38],
  ['Tribhuvankirti Rasa', [], ['125mg'], 36],
  ['Ksheerabala Taila', ['ksheerabala'], ['10ml', '200ml'], 62],
  ['Mahanarayan Taila', ['mahanarayana'], ['100ml', '200ml'], 71],
  ['Dhanwantharam Taila', [], ['200ml'], 50],
  ['Bala Taila', [], ['200ml'], 39],
  ['Anu Taila', ['anu thailam', 'nasya oil'], ['10ml'], 57],
  ['Brahmi Ghrita', [], ['100g'], 42],
  ['Phala Ghrita', [], ['100g'], 34],
  ['Panchakarma Basti', [], [], 28],
  ['Sitopaladi + Honey', [], [], 30],
  ['Mahasudarshan Churna', ['mahasudarshana'], ['3g'], 56]
];

const HOMEOPATHY = [
  ['Arnica montana', ['arnica'], ['30C', '200C', '6C', '1M'], 100],
  ['Belladonna', [], ['30C', '200C', '6C'], 92],
  ['Bryonia alba', ['bryonia'], ['30C', '200C'], 88],
  ['Nux vomica', [], ['30C', '200C', '6C', '1M'], 96],
  ['Rhus toxicodendron', ['rhus tox'], ['30C', '200C'], 90],
  ['Pulsatilla', [], ['30C', '200C'], 86],
  ['Sulphur', [], ['30C', '200C', '1M'], 89],
  ['Calcarea carbonica', ['calc carb'], ['30C', '200C', '1M'], 82],
  ['Lycopodium', [], ['30C', '200C', '1M'], 84],
  ['Natrum muriaticum', ['nat mur'], ['30C', '200C', '1M'], 80],
  ['Phosphorus', [], ['30C', '200C'], 76],
  ['Sepia', [], ['30C', '200C'], 74],
  ['Ignatia amara', ['ignatia'], ['30C', '200C'], 72],
  ['Gelsemium', [], ['30C', '200C'], 70],
  ['Aconitum napellus', ['aconite'], ['30C', '200C'], 78],
  ['Apis mellifica', ['apis'], ['30C', '200C'], 64],
  ['Chamomilla', [], ['30C', '200C'], 68],
  ['Hepar sulphuris', ['hepar sulph'], ['30C', '200C'], 60],
  ['Mercurius solubilis', ['merc sol'], ['30C', '200C'], 62],
  ['Silicea', ['silica'], ['30C', '200C', '1M'], 66],
  ['Thuja occidentalis', ['thuja'], ['30C', '200C', '1M'], 71],
  ['Antimonium crudum', [], ['30C', '200C'], 44],
  ['Argentum nitricum', ['arg nit'], ['30C', '200C'], 56],
  ['Arsenicum album', ['ars alb'], ['30C', '200C', '1M'], 85],
  ['Carbo vegetabilis', ['carbo veg'], ['30C', '200C'], 58],
  ['Cantharis', [], ['30C', '200C'], 52],
  ['China officinalis', ['cinchona'], ['30C', '200C'], 48],
  ['Colocynthis', [], ['30C', '200C'], 54],
  ['Drosera', [], ['30C', '200C'], 42],
  ['Euphrasia', [], ['30C', '200C'], 46],
  ['Ferrum phosphoricum', ['ferrum phos'], ['6X', '30C'], 50],
  ['Kali bichromicum', ['kali bich'], ['30C', '200C'], 57],
  ['Ledum palustre', ['ledum'], ['30C', '200C'], 40],
  ['Nux moschata', [], ['30C'], 30],
  ['Podophyllum', [], ['30C', '200C'], 36],
  ['Ruta graveolens', ['ruta'], ['30C', '200C'], 55],
  ['Spongia tosta', ['spongia'], ['30C', '200C'], 38],
  ['Staphysagria', [], ['30C', '200C'], 43],
  ['Symphytum', [], ['30C', '200C'], 34],
  ['Veratrum album', [], ['30C'], 28],
  ['Cina', [], ['30C', '200C'], 32],
  ['Dulcamara', [], ['30C'], 26],
  ['Kali carbonicum', ['kali carb'], ['30C', '200C'], 45],
  ['Magnesia phosphorica', ['mag phos'], ['6X', '30C'], 47],
  ['Natrum sulphuricum', ['nat sulph'], ['30C', '200C'], 33]
];

const slug = name => name.toLowerCase()
  .replace(/\+/g, ' plus ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const q = value => "'" + String(value).replace(/'/g, "''") + "'";

/* Which pack form a strength implies, so the doctor is not asked twice. */
function formFor(strength) {
  const s = strength.toLowerCase();
  if (s.includes('/5ml') || s.includes('/15ml') || s.includes('/10ml')) return 'Syrup';
  if (s.endsWith('ml')) return 'Liquid';
  if (s.includes('inhaler')) return 'Inhaler';
  if (s.includes('cream') || s.includes('ointment') || s.includes('gel')) return 'Topical';
  if (s.includes('sachet')) return 'Sachet';
  if (s.includes('iu/ml')) return 'Injection';
  if (/^\d+(\.\d+)?[cx]$/i.test(strength) || /^\d+m$/i.test(strength)) return 'Potency';
  if (s.endsWith('g') && !s.endsWith('mg') && !s.endsWith('mcg')) return 'Churna';
  return 'Tablet';
}

const lines = [];
const drugRows = [];
const strengthRows = [];

for (const [system, list] of [['allopathy', ALLOPATHY], ['ayurveda', AYURVEDA], ['homeopathy', HOMEOPATHY]]) {
  for (const [name, synonyms, strengths, popularity] of list) {
    const id = system.slice(0, 4) + '-' + slug(name);
    /* Everything a doctor might type for this, lowercased, in one field -
       that is what the LIKE search runs against. */
    const searchText = [name, ...synonyms].join(' ').toLowerCase();
    const detail = synonyms.length ? synonyms[0] : null;

    drugRows.push('(' + [q(id), q(system), q(name), detail ? q(detail) : 'NULL',
      q(searchText), popularity, q(SOURCE)].join(',') + ')');

    strengths.forEach((strength, index) => {
      strengthRows.push('(' + [q(id), q(strength), q(formFor(strength)),
        strengths.length - index].join(',') + ')');
    });
  }
}

lines.push('-- =========================================================================');
lines.push('-- 033  The core drug catalogue.');
lines.push('--');
lines.push('-- The catalogue held 59 rows. A doctor typing "cetri" got nothing back');
lines.push('-- while Cetirizine sat on her own pharmacy shelf, so the autocomplete -');
lines.push('-- which was fully built and working - had almost nothing to offer.');
lines.push('--');
lines.push('-- ' + drugRows.length + ' molecules and formulations across allopathy, Ayurveda and');
lines.push('-- homeopathy, with ' + strengthRows.length + ' pack strengths, chosen for what is actually');
lines.push('-- prescribed rather than for breadth. Generated by');
lines.push('-- scripts/build-catalogue-core.js - edit that, not this.');
lines.push('--');
lines.push('-- THIS IS A TYPING AID. It does not decide a dose, suggest an indication,');
lines.push('-- warn about an interaction or block a prescription. The strengths are');
lines.push('-- the packs these are commonly sold in, so a doctor picks instead of');
lines.push('-- typing. Every clinical decision stays hers.');
lines.push('--');
lines.push('-- INSERT OR REPLACE: re-runnable, and it will not disturb rows loaded');
lines.push('-- from the larger scraped dataset, which carry a different id prefix.');
lines.push('-- =========================================================================');
lines.push('');
lines.push('-- The original 59-row demo seed used bare slugs as ids; these use a');
lines.push('-- system prefix, so INSERT OR REPLACE would leave both and a doctor');
lines.push('-- typing "dolo" would see Paracetamol twice. Where a name is covered');
lines.push('-- here, the demo row goes. Only drug_strengths references these ids and');
lines.push('-- it cascades; pharmacy stock stores medicine names as text, so nothing');
lines.push('-- on a shelf is touched.');
lines.push('DELETE FROM drug_catalogue');
lines.push(" WHERE source <> " + q(SOURCE));
lines.push('   AND LOWER(name) IN (' +
  [...ALLOPATHY, ...AYURVEDA, ...HOMEOPATHY]
    .map(([name]) => q(name.toLowerCase())).join(', ') + ');');
lines.push('');
lines.push('INSERT OR REPLACE INTO drug_catalogue');
lines.push('  (id, system, name, detail, search_text, popularity, source) VALUES');
lines.push(drugRows.join(',\n') + ';');
lines.push('');
lines.push('INSERT OR REPLACE INTO drug_strengths (drug_id, strength, form, weight) VALUES');
lines.push(strengthRows.join(',\n') + ';');
lines.push('');

process.stdout.write(lines.join('\n'));

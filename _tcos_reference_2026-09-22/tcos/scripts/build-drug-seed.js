/* ---------------------------------------------------------------------------
   Builds the drug catalogue seed from two public sources.

   Run:  node scripts/build-drug-seed.js <dir-with-sources>

   Sources, and why each was chosen:

   1. meds.csv    - junioralive/Indian-Medicine-Dataset (GitHub), ~254k Indian
                    brands scraped from 1mg, with composition and strength.
                    We do NOT load the brands. We reduce them to the molecules
                    and the strengths those molecules are actually sold in,
                    which is what a doctor types and what the NMC expects to
                    see on a prescription.

   2. herb.json   - Amidha Ayurveda Herb Database (CC BY 4.0), 360 herbs with
                    botanical, English and Sanskrit names. Dr. Ashwin's side
                    of the catalogue.

   Neither source is a regulator. This file never invents a medicine or a
   dose - anything that does not parse cleanly is dropped, not guessed - and
   every row carries its source so a bad entry can be traced.
   --------------------------------------------------------------------------- */
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2] || '.';
const out = process.argv[3] || path.join(dir, 'seed-drugs.sql');

const SRC_ALLO = 'indian-medicine-dataset@github/junioralive';
const SRC_AYUR = 'amidha-ayurveda-herb-database@CC-BY-4.0';

/* A CSV reader that respects quoted fields - the source has commas inside
   manufacturer names, and splitting on ',' corrupts every row after one. */
function* rows(text) {
  let field = '', row = [], quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); yield row; row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); yield row; }
}

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const q = s => s === null || s === undefined ? 'NULL' : "'" + String(s).replace(/'/g, "''") + "'";

/* ---------------- 1. allopathy: molecules and their strengths -------------- */

const FORMS = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Suspension', 'Drop',
  'Cream', 'Ointment', 'Gel', 'Lotion', 'Solution', 'Powder', 'Sachet',
  'Inhaler', 'Respule', 'Spray', 'Soap', 'Shampoo', 'Infusion', 'Granules',
  'Suppository', 'Patch', 'Kit', 'Oil', 'Mouthwash', 'Rotacap'];

const formOf = text => FORMS.find(f => new RegExp('\\b' + f + 's?\\b', 'i').test(text || '')) || '';

function parseComposition(raw) {
  const s = (raw || '').trim();
  if (!s) return null;
  const m = s.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  if (!m) return null;
  const molecule = m[1].replace(/\s+/g, ' ').trim();
  let strength = m[2].replace(/\s+/g, ' ').trim();
  if (!molecule || molecule.length < 3 || molecule.length > 80) return null;
  if (!/[a-z]/i.test(molecule)) return null;
  /* The source writes an unknown strength as the literal "NA". Storing that
     would put "NA" in a dose box, so it is dropped. */
  if (!strength || /^na$/i.test(strength) || !/\d/.test(strength)) strength = null;
  return { molecule, strength };
}

function allopathy() {
  const text = fs.readFileSync(path.join(dir, 'meds.csv'), 'utf8');
  const it = rows(text);
  const header = it.next().value.map(h => h.trim());
  const iName = header.indexOf('name');
  const iDisc = header.indexOf('Is_discontinued');
  const iPack = header.indexOf('pack_size_label');
  const iC1 = header.indexOf('short_composition1');
  const iC2 = header.indexOf('short_composition2');

  const molecules = new Map();  // slug -> { name, brands:Set }
  const strengths = new Map();  // slug|strength|form -> count

  for (const row of it) {
    if (row.length < header.length) continue;
    if (String(row[iDisc]).toUpperCase() === 'TRUE') continue;   // off the market

    const brand = (row[iName] || '').trim();
    const form = formOf(brand) || formOf(row[iPack]);

    for (const raw of [row[iC1], row[iC2]]) {
      const c = parseComposition(raw);
      if (!c) continue;
      const key = slug(c.molecule);
      if (!key) continue;
      if (!molecules.has(key)) molecules.set(key, { name: c.molecule, brands: new Set() });
      molecules.get(key).brands.add(brand);
      if (c.strength) {
        const sk = key + '|' + c.strength + '|' + form;
        strengths.set(sk, (strengths.get(sk) || 0) + 1);
      }
    }
  }

  /* A molecule appearing on one or two brands is nearly always a spelling
     variant of one that appears on hundreds. A floor keeps the suggestion
     list something a doctor can trust at a glance. */
  const MIN_BRANDS = 3, MIN_STRENGTH = 2;
  const kept = [...molecules.entries()].filter(([, v]) => v.brands.size >= MIN_BRANDS);
  const keptIds = new Set(kept.map(([k]) => k));

  const drugs = kept.map(([id, v]) => ({
    id, system: 'allopathy', name: v.name, detail: null,
    search: v.name.toLowerCase(), popularity: v.brands.size, source: SRC_ALLO
  }));

  const doses = [...strengths.entries()]
    .map(([k, n]) => { const [drug, strength, form] = k.split('|'); return { drug, strength, form, n }; })
    .filter(s => keptIds.has(s.drug) && s.n >= MIN_STRENGTH);

  return { drugs, doses, dropped: molecules.size - kept.length };
}

/* ---------------- 2. ayurveda: herbs, searchable by every name ------------- */

function ayurveda(existing) {
  const raw = JSON.parse(fs.readFileSync(path.join(dir, 'herb.json'), 'utf8'));
  const list = Array.isArray(raw) ? raw : (raw.herbs || Object.values(raw)[0]);

  const drugs = [];
  for (const h of list) {
    const name = (h.name || '').trim();
    if (!name) continue;
    let id = 'ayu-' + slug(name);
    if (existing.has(id)) continue;
    existing.add(id);

    /* She may reach for the Sanskrit name, the English one, or the botanical
       one depending on who she learned it from. All three should find it. */
    const synonyms = [name, h.english_name, h.botanical_name, ...(h.sanskrit_synonyms || [])]
      .filter(Boolean).map(s => String(s).trim()).filter(Boolean);

    const detail = [h.english_name, h.botanical_name].filter(Boolean).join(' · ') || null;

    drugs.push({
      id, system: 'ayurveda', name, detail,
      search: [...new Set(synonyms.map(s => s.toLowerCase()))].join(' '),
      popularity: 0, source: SRC_AYUR
    });
  }
  return drugs;
}

/* ---------------- write it out -------------------------------------------- */

const allo = allopathy();
const ids = new Set(allo.drugs.map(d => d.id));
const ayur = ayurveda(ids);
const drugs = [...allo.drugs, ...ayur];

const lines = [];
lines.push('-- Generated by scripts/build-drug-seed.js. Do not hand-edit.');
lines.push('-- Sources: ' + SRC_ALLO + ' | ' + SRC_AYUR);
lines.push('DELETE FROM drug_strengths;');
lines.push('DELETE FROM drug_catalogue;');

/* Batched inserts: D1 rejects a single statement with tens of thousands of
   bound values, and one INSERT per row would be tens of thousands of round
   trips. 200 rows a statement is comfortably inside both limits. */
const batch = (rowsIn, head, render) => {
  for (let i = 0; i < rowsIn.length; i += 200) {
    const chunk = rowsIn.slice(i, i + 200);
    lines.push(head + '\n' + chunk.map(render).join(',\n') + ';');
  }
};

batch(drugs,
  'INSERT INTO drug_catalogue (id, system, name, detail, search_text, popularity, source) VALUES',
  d => '  (' + [q(d.id), q(d.system), q(d.name), q(d.detail), q(d.search), d.popularity, q(d.source)].join(',') + ')');

batch(allo.doses,
  'INSERT INTO drug_strengths (drug_id, strength, form, weight) VALUES',
  s => '  (' + [q(s.drug), q(s.strength), q(s.form), s.n].join(',') + ')');

fs.writeFileSync(out, lines.join('\n') + '\n');

console.log('allopathy molecules  ', allo.drugs.length, '(dropped ' + allo.dropped + ' seen on <3 brands)');
console.log('ayurveda herbs       ', ayur.length);
console.log('strength options     ', allo.doses.length);
console.log('total rows           ', drugs.length + allo.doses.length);
console.log('written to           ', out, '(' + (fs.statSync(out).size / 1024 / 1024).toFixed(1) + ' MB)');

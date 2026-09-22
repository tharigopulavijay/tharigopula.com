/* =========================================================================
   Her own examination fields, and the six that reach the paper.

   Vijay, about the first Ayurvedic doctor on TCOS: "each one will have their
   own unique thing right... we cant show we need to keep cap like 6 objects
   can only be added max. if you want more it willb e shown side means you
   can record in the data but it would not showup in the prescription."

   THE ASSERTIONS THIS FILE EXISTS FOR, in the order they would hurt:

   1. NOTHING SHE RECORDS IS EVER LOST. The cap is on the sheet. A field
      that does not print is still in the record and still comes back on
      screen. If this file ever fails here, a doctor has silently lost an
      observation, which is the one outcome worse than a long prescription.

   2. NULL IS NOT AN EMPTY LIST. A clinic that has never opened the setting
      prints every filled field, exactly as before. Reading "not configured"
      as "print nothing" would shorten the next prescription of every doctor
      already using TCOS, and nobody would be told.

   3. A NON-ASCII LABEL GETS A REAL KEY. A doctor naming her field in Telugu
      or Devanagari is the entire point of letting her name it. Naive
      slugging leaves the empty string, and every such field would collide
      on it - the second one would overwrite the first's values.

   Run:  node test/clinic-fields.test.js
   ========================================================================= */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { clinicFields, slugFor, PRINT_MAX, FIELD_CEILING } from '../worker/clinicfields.js';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

/* Real SQLite, real schema, so the SQL under test is the SQL that runs. */
const raw = new DatabaseSync(':memory:');
raw.exec(readFileSync('schema.sql', 'utf8'));
raw.exec(readFileSync('migrations/059-her-own-assessment-fields.sql', 'utf8'));
raw.exec(`INSERT INTO doctors (id, mobile, full_name, clinic_name)
          VALUES ('doc_A','+919000000001','Dr Ayur','Holistic Care'),
                 ('doc_B','+919000000002','Dr B','Other Clinic');`);

const db = {
  prepare(sql) {
    const stmt = raw.prepare(sql);
    return {
      bind(...args) {
        return {
          async first() { return stmt.get(...args) ?? null; },
          async all() { return { results: stmt.all(...args) }; },
          async run() { return stmt.run(...args); }
        };
      },
      async first() { return stmt.get() ?? null; },
      async all() { return { results: stmt.all() }; },
      async run() { return stmt.run(); }
    };
  },
  async batch(list) { for (const s of list) await s.run(); return []; }
};

const doctorRow = id => raw.prepare('SELECT * FROM doctors WHERE id = ?').get(id);
const refuses = async (fn, wanted) => {
  try { await fn(); return false; }
  catch (error) { return !wanted || String(error.message || '').includes(wanted); }
};

console.log('\nAdding what we did not think of\n');

/* Neither of these is in any pack in js/clinic-registry.js, and both are on
   the prescription the first real customer prints today. */
const naabhi = await clinicFields.add(db, 'doc_A', 'Naabhi');
const ang = await clinicFields.add(db, 'doc_A', 'ANG');
check('a field we never wrote can be added', naabhi.slug === 'own.naabhi', naabhi.slug);
check('and another', ang.slug === 'own.ang', ang.slug);

check('pressing add twice is not two fields',
  (await clinicFields.add(db, 'doc_A', 'Naabhi')).id === naabhi.id);
check('nor is the same name with different spacing and case',
  (await clinicFields.add(db, 'doc_A', '  naabhi  ')).id === naabhi.id);

check('an empty name is refused', await refuses(() => clinicFields.add(db, 'doc_A', '   ')));
check('and a name too long to be a form label is refused',
  await refuses(() => clinicFields.add(db, 'doc_A', 'x'.repeat(200))));

console.log('\nIndian scripts, which is what a doctor here will actually type\n');

/* Naive slugging strips every one of these to nothing, and every such field
   would then answer to the same key - the second overwriting the first. */
const telugu = await clinicFields.add(db, 'doc_A', 'నాడి');
const hindi = await clinicFields.add(db, 'doc_A', 'नाभि');
check('a Telugu label still gets a key', telugu.slug.length > 4, telugu.slug);
check('so does a Devanagari one', hindi.slug.length > 4, hindi.slug);
check('and the two do not collide', telugu.slug !== hindi.slug,
  telugu.slug + ' vs ' + hindi.slug);
check('the label is kept exactly as she typed it', telugu.label === 'నాడి');
check('CONTROL: an ascii label still slugs from its ascii, not at random',
  slugFor('Roga Bala') === 'own.roga-bala', slugFor('Roga Bala'));

console.log('\nOne clinic cannot see or touch another\n');

await clinicFields.add(db, 'doc_B', 'Naabhi');
check('doc_B has one field', (await clinicFields.list(db, 'doc_B')).length === 1);
check('and doc_A still has her own four',
  (await clinicFields.list(db, 'doc_A')).length === 4,
  JSON.stringify((await clinicFields.list(db, 'doc_A')).map(f => f.label)));
check('the same field name in two clinics is two separate rows',
  (await clinicFields.list(db, 'doc_B'))[0].id !== naabhi.id);
check('archiving somebody else\'s field is a 404, not a deletion',
  await refuses(() => clinicFields.archive(db, 'doc_B', naabhi.id)));
check('and it really was not archived',
  (await clinicFields.list(db, 'doc_A')).some(f => f.id === naabhi.id));

console.log('\nThe cap is on the sheet, not on her\n');

check('the sheet takes six', PRINT_MAX === 6);
check('the ceiling on fields is far above it, and is only an abuse brake',
  FIELD_CEILING > PRINT_MAX * 5, String(FIELD_CEILING));

const six = ['nadi.Jihva', 'nadi.Sparsha', 'nadi.Nails', 'own.naabhi',
  'own.ang', 'ayurveda-assessment.Agni'];
const saved = await clinicFields.setPrintList(db, 'doc_A', six);
check('six can be chosen', saved.fields.length === 6);
check('and they are stored in her order', saved.fields[0] === 'nadi.Jihva');

check('a seventh is refused',
  await refuses(() => clinicFields.setPrintList(db, 'doc_A', six.concat('nadi.Gati')), 'room for 6'));
check('and the refusal says the rest is still recorded',
  await refuses(() => clinicFields.setPrintList(db, 'doc_A', six.concat('nadi.Gati')),
    'still recorded'));

check('the same field twice costs one slot, not two',
  (await clinicFields.setPrintList(db, 'doc_A', ['nadi.Jihva', 'nadi.Jihva'])).fields.length === 1);

check('something that is not a field key is refused',
  await refuses(() => clinicFields.setPrintList(db, 'doc_A', ['no-dot-here'])));
check('and so is a list that is not a list',
  await refuses(() => clinicFields.setPrintList(db, 'doc_A', 'nadi.Jihva')));

await clinicFields.setPrintList(db, 'doc_A', six);

console.log('\nNull is not an empty list - they mean opposite things on paper\n');

const findings = {
  'nadi.Jihva': 'coated', 'nadi.Sparsha': 'moist soft', 'nadi.Nails': 'sharp',
  'own.naabhi': 'unset', 'own.ang': 'normal', 'ayurveda-assessment.Agni': 'manda',
  'nadi.Gati': 'sarpa', 'nadi.Bala': 'madhyama', 'ahara-vihara.Sleep': 'disturbed'
};
const labels = await clinicFields.labels(db, 'doc_A');

/* Never configured. The sheet must be exactly what it was before this
   module existed, or every doctor already using TCOS gets a shorter
   prescription tomorrow without being asked. */
const unset = clinicFields.splitFindings(findings, null, labels);
check('with no layout set, every filled field prints', unset.printed.length === 9,
  String(unset.printed.length));
check('and nothing is pushed off the sheet', unset.recorded.length === 0);
check('and it says so', unset.configured === false);

/* Configured. */
const split = clinicFields.splitFindings(findings, six, labels);
check('with a layout set, six print', split.printed.length === 6);
check('in her order, not the form\'s', split.printed[0].label === 'Jihva');
check('her own field prints under the name SHE gave it',
  split.printed.some(f => f.label === 'Naabhi'),
  JSON.stringify(split.printed.map(f => f.label)));
check('and never under the slug', !split.printed.some(f => /own\./.test(f.label)));
check('our pack prefix is never shown to her',
  !split.printed.some(f => /nadi\.|ayurveda-assessment\./.test(f.label)));

/* THE ONE THAT MATTERS. */
check('NOTHING SHE RECORDED IS LOST - the other three come back',
  split.recorded.length === 3, JSON.stringify(split.recorded.map(f => f.label)));
check('every recorded value is in one list or the other, never neither',
  split.printed.length + split.recorded.length === Object.keys(findings).length);
check('and never in both',
  split.printed.every(p => !split.recorded.some(r => r.key === p.key)));

/* An empty list IS a choice: print no examination at all. */
const none = clinicFields.splitFindings(findings, [], labels);
check('an empty layout prints nothing', none.printed.length === 0);
check('and still keeps all nine in the record', none.recorded.length === 9);

console.log('\nA field she has not filled this visit is skipped, not printed blank\n');

const thin = clinicFields.splitFindings({ 'nadi.Jihva': 'coated' }, six, labels);
check('only what she filled prints', thin.printed.length === 1);
check('blank chosen fields do not become empty rows',
  thin.printed.every(f => f.value));
check('whitespace counts as blank',
  clinicFields.splitFindings({ 'nadi.Jihva': '   ' }, six, labels).printed.length === 0);

console.log('\nRemoving a field keeps its history and frees its slot\n');

await clinicFields.archive(db, 'doc_A', naabhi.id);
check('it leaves the form', !(await clinicFields.list(db, 'doc_A')).some(f => f.id === naabhi.id));
check('it leaves the print list too, rather than silently wasting a slot',
  !clinicFields.printList(doctorRow('doc_A')).includes('own.naabhi'),
  JSON.stringify(clinicFields.printList(doctorRow('doc_A'))));
check('the other five are untouched',
  clinicFields.printList(doctorRow('doc_A')).length === 5);
check('but its label survives, so an old prescription can still print it',
  (await clinicFields.labels(db, 'doc_A'))['own.naabhi'] === 'Naabhi');

const restored = await clinicFields.add(db, 'doc_A', 'Naabhi');
check('adding it again restores the SAME row, so old values line up',
  restored.id === naabhi.id && restored.restored === true);

console.log('\nThe stored value cannot break the sheet\n');

raw.prepare('UPDATE doctors SET rx_print_fields = ? WHERE id = ?').run('{not json', 'doc_A');
check('an unreadable layout falls back to the old sheet, not to a blank one',
  clinicFields.printList(doctorRow('doc_A')) === null);

await clinicFields.setPrintList(db, 'doc_A', null);
check('and an explicit null resets it to that on purpose',
  doctorRow('doc_A').rx_print_fields === null);

console.log('\nThe check can fail\n');

/* CONTROL. If splitFindings returned everything in both lists, or an empty
   split, several assertions above would pass for the wrong reason. */
check('CONTROL: a configured layout really does hold something back',
  clinicFields.splitFindings(findings, ['nadi.Jihva'], labels).recorded.length === 8);
check('CONTROL: and an unset one really does not',
  clinicFields.splitFindings(findings, null, labels).recorded.length === 0);

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);

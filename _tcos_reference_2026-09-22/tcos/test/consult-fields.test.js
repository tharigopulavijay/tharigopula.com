/* =========================================================================
   The consultation screen actually boots, and the examination form on it is
   the one she was promised.

   WHY THIS IS A SUITE AND NOT A CLICK IN A BROWSER.
   A click proves the page worked once, on one machine, on one day. This runs
   js/consult.js for real - the same bytes the browser gets - and fails the
   build if the screen dies on load or stops rendering her own fields. The
   desk has had the same treatment since the day it silently stopped booting
   and nothing noticed; see test/desk-boot.test.js.

   THE ASSERTIONS THAT MATTER:

   1. It boots at all. Everything below is decoration if the consultation
      screen throws on load, and a doctor with a patient in front of her has
      no way to work around a blank page.

   2. Her own fields appear beside ours. The practice packs are our guess at
      an examination; Naabhi and ANG are in neither.

   3. A field that does not print is MARKED AS SUCH ON THE FORM. She has to
      be able to see, while she is typing into it, that this one stays in the
      record. Finding out afterwards - from a patient holding the paper - is
      how a feature meant to shorten a prescription becomes a support call.

   4. Adding one does not silently spend a print slot. Six is six.

   Run:  node test/consult-fields.test.js
   ========================================================================= */

import { readFileSync } from 'node:fs';
import { fakeElement, makeDom, reporter, settle } from './desk-harness.js';

const { check, done } = reporter();

/* ------------------------------------------------------------- the page --- */

/* consult.js reads every finding input off the DOCUMENT, not off one
   element, so the document's selector engine has to answer for real.
   Delegating to #packFields is exactly right rather than a shortcut: every
   [data-finding] input consult.js renders is written into that element.

   createElement is replaced as well. The shared harness returns elements
   whose querySelector always answers null, and the medicine-row builder
   wires listeners onto what it finds inside a row it just created - so the
   screen died on load against the plain harness for reasons that have
   nothing to do with the screen. A created element here hands back a real
   child per selector, cached, so the node the page wired is the node the
   assertions see. */
function makeConsultDom() {
  const doc = makeDom();
  doc.querySelectorAll = selector =>
    /data-finding/.test(String(selector))
      ? doc.getElementById('packFields').querySelectorAll('[data-finding]')
      : [];
  doc.createElement = () => {
    const node = fakeElement('created');
    const children = new Map();
    node.querySelector = selector => {
      const key = String(selector);
      if (!children.has(key)) children.set(key, fakeElement(key));
      return children.get(key);
    };
    return node;
  };
  return doc;
}

/* ------------------------------------------------------------- the API --- */

function makeApi(layout, overrides = {}) {
  const calls = [];
  return {
    calls,
    api: {
      ApiClientError: class extends Error {},
      isSignedIn: () => true,
      me: async () => ({
        id: 'doc_1', fullName: 'Dr Ayur', clinicName: 'Holistic Care',
        qualification: 'BAMS', registrationNo: 'AY-1', product: 'ayurcos',
        /* Her real packs. `nadi` is where Jihva, Sparsha and Nails come
           from - the three fields on the reference prescription that TCOS
           already had. */
        practicePacks: ['ayurveda', 'nadi'],
        verification: { verified: true }
      }),
      getPatient: async () => ({ patient: {
        id: 'pat_1', full_name: 'A Patient', mobile: '+919111111111',
        sex: 'Female', local_ref: 'SAHC-1001'
      } }),
      stock: async () => ({ items: [] }),
      searchDrugs: async () => ({ drugs: [] }),
      clinicFields: async () => { calls.push(['clinicFields']); return layout; },
      addClinicField: async label => {
        calls.push(['addClinicField', label]);
        return { field: { id: 'cf_new', label, slug: 'own.' + label.toLowerCase() } };
      },
      removeClinicField: async id => { calls.push(['removeClinicField', id]); return {}; },
      ...overrides
    }
  };
}

async function boot(layout, overrides) {
  const doc = makeConsultDom();
  const { api, calls } = makeApi(layout, overrides);

  const win = { addEventListener() {}, print() {}, location: { href: '', search: '' } };
  new Function('window', readFileSync('js/products.js', 'utf8'))(win);
  new Function('window', readFileSync('js/clinic-registry.js', 'utf8'))(win);

  /* The screen is an async IIFE: a failure inside it is a rejected promise
     nobody holds, which kills the process AFTER the first assertions have
     printed PASS. Catching it turns that into a named FAIL. */
  let crash = null;
  const onReject = error => { crash = crash || error; };
  process.on('unhandledRejection', onReject);

  try {
    /* js/app-boot.js puts TCOSBoot on the page before any screen runs, so
       the harness has to supply one or the consultation throws a
       ReferenceError the moment it checks the session. The stub records
       instead of navigating. */
    const bootCalls = [];
    win.TCOSBoot = {
      ready: () => bootCalls.push('ready'),
      failed: message => bootCalls.push('failed:' + message),
      toSignIn: reason => bootCalls.push('toSignIn:' + reason),
      bounced: () => false,
      clearBounce() {}
    };
    win.bootCalls = bootCalls;

    new Function('window', 'document', 'TCOSApi', 'location', 'localStorage',
      'crypto', 'confirm', 'alert', 'URLSearchParams', 'TCOSBoot',
      readFileSync('js/consult.js', 'utf8'))(
      win, doc, api,
      { search: '?patient=pat_1', replace() {} },
      { getItem: () => null, setItem() {}, removeItem() {} },
      { randomUUID: () => 'uuid-1' },
      () => true, () => {}, URLSearchParams, win.TCOSBoot);
  } catch (error) { crash = error; }

  await settle(80);
  process.off('unhandledRejection', onReject);
  return { doc, calls, crash, win };
}

/* ========================================================================= */

console.log('\nIt boots, which everything else depends on\n');

/* She has never opened the layout setting. */
const unset = await boot({ fields: [
  { id: 'cf_1', label: 'Naabhi', slug: 'own.naabhi' },
  { id: 'cf_2', label: 'ANG', slug: 'own.ang' }
], printFields: null, max: 6 });

check('the consultation screen loads without throwing',
  !unset.crash, unset.crash && unset.crash.message);
check('and it asked the server for her fields',
  unset.calls.some(c => c[0] === 'clinicFields'));

const form = () => unset.doc.getElementById('packFields').innerHTML;

console.log('\nOurs and hers, in one form\n');

check('the examination card is shown', unset.doc.getElementById('packCard').hidden === false);
/* Ours, from the packs she has on. */
check('a Nadi Pariksha field from our pack is there', /data-finding="nadi\.Jihva"/.test(form()));
check('so is an Ayurveda assessment field',
  /data-finding="ayurveda-assessment\.Agni"/.test(form()));
/* Hers, which are in no pack we wrote. */
check('HER OWN FIELD IS THERE TOO: Naabhi', /data-finding="own\.naabhi"/.test(form()));
check('and ANG', /data-finding="own\.ang"/.test(form()));
check('under the name she gave it, not its key', /<span>Naabhi/.test(form()));

check('only her own fields can be removed from the form',
  (form().match(/data-drop-field/g) || []).length === 2,
  String((form().match(/data-drop-field/g) || []).length));
check('and ours cannot - she takes those off the sheet instead',
  !/data-drop-field="nadi/.test(form()));

console.log('\nWith no layout set, the sheet is what it always was\n');

check('nothing is marked as staying off the paper',
  !/field-off-sheet/.test(form()));
check('and the form says so plainly',
  /every filled field prints/.test(unset.doc.getElementById('packHint').textContent),
  unset.doc.getElementById('packHint').textContent);

console.log('\nWith six chosen, the rest are marked on the form itself\n');

const set = await boot({
  fields: [{ id: 'cf_1', label: 'Naabhi', slug: 'own.naabhi' },
           { id: 'cf_2', label: 'ANG', slug: 'own.ang' }],
  printFields: ['nadi.Jihva', 'nadi.Sparsha', 'nadi.Nails', 'own.naabhi',
                'own.ang', 'ayurveda-assessment.Agni'],
  max: 6
});
const setForm = () => set.doc.getElementById('packFields').innerHTML;

check('it still boots with a layout set', !set.crash, set.crash && set.crash.message);
check('a chosen field is not marked',
  !/field-off-sheet[^>]*>\s*<span>Jihva/.test(setForm()));

/* THE ONE THAT MATTERS. Everything she examines is recorded; she must be
   able to SEE which ones reach the patient's hand. */
check('THE FIELDS THAT DO NOT PRINT ARE MARKED ON THE FORM',
  /field-off-sheet/.test(setForm()));
check('and the mark says where the value goes',
  /record only/.test(setForm()));
check('the marked ones are the unchosen ones, not the chosen ones',
  (setForm().match(/field-off-sheet/g) || []).length ===
    countFields(setForm()) - 6,
  (setForm().match(/field-off-sheet/g) || []).length + ' marked of ' +
    countFields(setForm()) + ' fields');
check('and the hint counts them for her',
  /6 of these print/.test(set.doc.getElementById('packHint').textContent),
  set.doc.getElementById('packHint').textContent);

console.log('\nAdding one mid-consultation\n');

/* The "+" is on the consultation screen, not in settings, because she
   realises she needs the field while a patient is in front of her. */
const addBtn = set.doc.getElementById('addFieldBtn');
check('there is an add control on the consultation screen',
  (addBtn.listeners.click || []).length > 0);

set.doc.getElementById('addFieldLabel').value = 'Netra';
(set.doc.getElementById('addFieldSave').listeners.click || []).forEach(fn => fn());
await settle(60);

check('pressing add sends the label to the server',
  set.calls.some(c => c[0] === 'addClinicField' && c[1] === 'Netra'),
  JSON.stringify(set.calls));
check('and the new field appears on the form without a reload',
  /data-finding="own\.netra"/.test(setForm()));

/* It must NOT quietly become the seventh printed field, and it must not
   push one of her six off. Six is six. */
check('the new field does NOT silently join the printed six',
  /field-off-sheet[\s\S]{0,200}Netra/.test(setForm()) ||
  /Netra[\s\S]{0,200}record only/.test(setForm()),
  setForm().slice(setForm().indexOf('Netra') - 200, setForm().indexOf('Netra') + 60));
check('and she is told where it went and how to change that',
  /does not print|not printed|recorded, not printed/i
    .test(set.doc.getElementById('addFieldNote').textContent),
  set.doc.getElementById('addFieldNote').textContent);

console.log('\nThe screen survives its settings call failing\n');

/* A consultation screen that refuses to open because a settings endpoint
   timed out is worse than one missing three fields. */
const broken = await boot(null, {
  clinicFields: async () => { throw new Error('gateway timeout'); }
});
check('a failed fields call does not take the consultation down',
  !broken.crash, broken.crash && broken.crash.message);
check('and our pack fields still render',
  /data-finding="nadi\.Jihva"/.test(broken.doc.getElementById('packFields').innerHTML));

console.log('\nShe is not asked which system a medicine belongs to\n');

/* A doctor using TCOS, through Vijay: "he is entering the medicine, it is
   asking allopathy homeo so on - why do i need to enter this all, it is
   increasing the time, rather i go for just manual prescription why should
   i use yours."

   He is right, and it was never his field to fill: the catalogue knows what
   Ashwagandha is and his own pharmacy knows what is on his shelf. Both
   already set it. The dropdown was a third source of truth whose only job
   was to be wrong. */
const medRows = unset.doc.getElementById('medRows').children;
const firstRow = medRows[0] ? medRows[0].innerHTML : '';

check('a medicine row really is rendered', !!firstRow, String(medRows.length));
check('THERE IS NO SYSTEM DROPDOWN ON THE ROW', !/<select class="m-system"/.test(firstRow));
check('and no dropdown of any kind', !/<select/.test(firstRow), firstRow.slice(0, 200));

/* The VALUE stays. The patient's copy tags each medicine for her, and a
   homeopath has to be able to see her patient is on allopathic thyroxine.
   What went is the asking, not the fact. */
check('the value is still carried, as a hidden field',
  /<input type="hidden" class="m-system"/.test(firstRow));

/* HER OWN DISCIPLINE, NOT ALLOPATHY. This boot is an AyurCOS doctor, so a
   compounded preparation no catalogue will ever hold must still come out
   Ayurvedic - that is precisely the case where nothing else can fill it. */
check('and it defaults to HER discipline, not to allopathy',
  /class="m-system" value="ayurveda"/.test(firstRow), firstRow.slice(0, 300));

const consultHtml = readFileSync('consult.html', 'utf8');
check('the System column is gone from the table header',
  !/<span>System<\/span>/.test(consultHtml));
check('the grid is six columns wide, not seven',
  /grid-template-columns: 2\.1fr 1fr 1\.1fr 1fr \.6fr 28px/
    .test(readFileSync('css/consult.css', 'utf8')));

/* The same assumption lived on the consultation desk, hardcoded, where it
   printed an Ayurvedic doctor's churna as "English medicine" on the copy
   the patient walks out with. */
const deskSource = readFileSync('js/desk.js', 'utf8');
check('the desk no longer hardcodes allopathy either',
  !/system: item\.system \|\| 'allopathy'/.test(deskSource));
check('it asks the product which system leads',
  /ownSystem\(\)/.test(deskSource) && /medicineFirst/.test(deskSource));

console.log('\nWhere the patient travels in from\n');

/* Also asked for by the same doctor: "add customer address from where he is
   coming - like not complete address, maybe city or place or colony." */
check('the consultation header shows her locality beside her number',
  /patient\.locality/.test(readFileSync('js/consult.js', 'utf8')));
const patientsHtml = readFileSync('patients.html', 'utf8');
check('the add-patient form asks for it', /id="patientLocality"/.test(patientsHtml));
check('and says an area is enough, so nobody types a full address',
  /not a full address/i.test(patientsHtml));
check('it is sent when a patient is added', /locality: document/.test(patientsHtml));
check('the Worker caps it rather than storing whatever arrives',
  /locality[\s\S]{0,80}slice\(0, 80\)/.test(readFileSync('worker/index.js', 'utf8')));

console.log('\nThe check can fail\n');

/* CONTROL. If the form rendered nothing at all, most exclusion assertions
   above would pass for the wrong reason. */
check('CONTROL: the form really does render fields',
  countFields(form()) > 10, String(countFields(form())));
check('CONTROL: and an unset layout really does mark none of them',
  countFields(form()) > 0 && !/field-off-sheet/.test(form()));

function countFields(html) {
  return (html.match(/data-finding="/g) || []).length;
}

done();

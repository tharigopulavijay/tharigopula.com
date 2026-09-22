/* =========================================================================
   Does the consultation desk actually start?

   It did not. `state` called emptyPlan() while being built, and emptyPlan
   was a `const` declared further down the file - so it was in its temporal
   dead zone at that moment and the whole script threw before rendering
   anything. The patient list sat on "Loading…" for ever and every button
   was dead.

   `node --check js/desk.js` passed the entire time, because that is valid
   syntax. Vijay found it by opening the page, which is a thing I should
   have done and did not.

   So this file RUNS the script instead of parsing it: a stub document, a
   stub API, and an assertion that it boots and paints something. It cannot
   prove the desk is usable - only a browser and a real session do that -
   but it makes "the script died on line one" impossible to ship again.

   This is the HAPPY path, with every API answering. The desk's behaviour
   when the consultation scratchpad is not available - which is what
   production looks like until the table exists - is
   test/desk-without-scratchpad.test.js.

   Run:  node test/desk-boot.test.js
   ========================================================================= */

import { makeDom, makeApi, runDesk, settle, reporter } from './desk-harness.js';

const { check, done } = reporter();
const doc = makeDom();
const { api, sent } = makeApi();

console.log('\nThe desk boots without throwing\n');

const { boot } = await runDesk(doc, api);

check('the script runs without throwing', boot === null, boot && boot.message);

/* The bug was a ReferenceError from a temporal dead zone. Naming it keeps
   the failure legible if it ever comes back. */
check('no "cannot access before initialization"',
  !(boot && /before initialization/i.test(boot.message)), boot && boot.message);

const queue = doc.getElementById('deskQueue');
check('the patient list stops saying Loading',
  !/Loading/.test(queue.innerHTML), queue.innerHTML.slice(0, 90));
check('and the patient appears in it',
  /A Patient/.test(queue.innerHTML), queue.innerHTML.slice(0, 120));
check('their appointment status shows',
  /Waiting/.test(queue.innerHTML), queue.innerHTML.slice(0, 160));

/* Somebody who filled in the form at the counter and is not a patient
   yet. She must appear ABOVE the list - she is the one sitting in the
   room - and she must be marked as new, so nobody opens a record that
   does not exist. */
check('a self-registered walk-in appears in the queue',
  /A Walk-in/.test(queue.innerHTML), queue.innerHTML.slice(0, 200));
check('and above the patients, because she is the one waiting',
  queue.innerHTML.indexOf('A Walk-in') < queue.innerHTML.indexOf('A Patient'));
check('marked as waiting to be registered',
  /Waiting to be registered/.test(queue.innerHTML));
check('and carried as a request, not as a patient id',
  /data-request="req_1"/.test(queue.innerHTML) &&
  !/data-patient="req_1"/.test(queue.innerHTML));

/* Every control the page wires up must exist, or a click does nothing and
   nobody is told - which is what "adding new patient button also not
   working" looked like. */
for (const id of ['deskAddNew', 'deskNewForm', 'newCancel', 'deskSave',
                  'deskIssue', 'deskPrint', 'deskSearch', 'deskLabFile',
                  'deskUpload', 'uploadClose', 'uploadDone',
                  'deskAlerts', 'deskShowCode', 'codeClose', 'codeDone']) {
  const node = doc.getElementById(id);
  check(id + ' has a handler attached',
    Object.keys(node.listeners).length > 0, JSON.stringify(Object.keys(node.listeners)));
}

/* ------------------------------- the consultation she did not finish --- */

/* Vijay: "already i have opened this abcd patient's prescription, now it
   should be saved as a draft ... if he is not saving within 24 hours this
   draft should disappear."

   The queue has to say WHO she left half-done, or a doctor called out of
   the room has no way back to it except by remembering. */
check('a patient with an unfinished consultation is marked in the queue',
  /desk-unfinished">Draft</.test(queue.innerHTML), queue.innerHTML.slice(0, 240));
/* And only that patient. A marker on every name is a marker on none. */
check('and only that patient',
  (queue.innerHTML.match(/desk-unfinished/g) || []).length === 1,
  queue.innerHTML.slice(0, 300));

/* Now open that patient, the way a doctor does: by clicking the name. */
const person = queue.querySelectorAll('[data-patient]')
  .find(node => node.dataset.patient === 'pat_1');
check('the name in the queue is clickable', !!person);

for (const fn of (person ? person.listeners.click || [] : [])) fn();
await settle();

const sheet = doc.getElementById('deskSheet');
check('what she had already typed is put back on the sheet',
  /Burning in the chest after meals/.test(sheet.innerHTML),
  sheet.innerHTML.slice(0, 200));
check('including the medicine she had got as far as',
  /Avipattikar churna/.test(sheet.innerHTML));
check('and the vitals she had taken',
  /124\/80/.test(sheet.innerHTML));

/* What came back is NOT in the record, so Save has to be usable on it. The
   first version of this greyed Save out on the reasoning that she had not
   just typed anything - which left a doctor looking at a full consultation
   she could not commit until she typed a character to wake the button up. */
check('and she can save it without having to type something first',
  doc.getElementById('deskSave').disabled === false);

/* And she is told plainly where it stands, because the one thing she must
   not conclude is that this consultation is already in the record. */
check('and she is told it is not in the record yet',
  /not in .* record yet/i.test(doc.getElementById('deskMsg').textContent),
  doc.getElementById('deskMsg').textContent);

/* ------------------------------------ and saving it sends all of it --- */

/* This is the assertion that matters, and it caught a real bug: the plan
   and the alerts each save through their own call behind their own dirty
   flag, so a restored diet chart was on the screen and silently NOT sent.
   The doctor would have seen it, pressed Save, and lost it.

   So this looks at what the click actually SENT, not at what the sheet
   shows. A screen can be right about something the request left out. */
for (const fn of doc.getElementById('deskSave').listeners.click || []) fn();
await settle();

const visit = sent('createVisit')[0];
check('saving sends the restored narrative to the record',
  !!visit && visit.complaints === 'Burning in the chest after meals',
  JSON.stringify(visit && visit.complaints));

const rx = sent('createPrescription')[0];
check('and the medicines that were restored with it',
  !!rx && (rx.items || []).some(item => item.medicineName === 'Avipattikar churna'),
  JSON.stringify(rx && rx.items));

const plan = sent('saveCarePlan')[0];
check('and the plan, which had no keystroke of its own to mark it changed',
  !!plan && (plan.avoid || []).includes('Chillies'), JSON.stringify(plan));

/* It is in the record now, so the scratchpad copy has to go - otherwise the
   next visit to this patient restores a consultation that is already
   saved, over the top of the new one. */
check('and the scratchpad is cleared once it is a real record',
  sent('clearConsultationDraft').includes('pat_1'),
  JSON.stringify(sent('clearConsultationDraft')));

/* CONTROL: the harness can fail. If getElementById quietly invented
   elements that nothing ever touched, every assertion above would pass on
   an empty page. */
check('CONTROL: an element nobody wires up has no handlers',
  Object.keys(doc.getElementById('nothing-uses-this').listeners).length === 0);

/* CONTROL: and the selector engine can lie in the other direction. If it
   matched anything at all, the click would have landed on a node the desk
   never rendered. */
check('CONTROL: a data attribute nothing renders finds nothing',
  queue.querySelectorAll('[data-nothing-renders-this]').length === 0);

done();

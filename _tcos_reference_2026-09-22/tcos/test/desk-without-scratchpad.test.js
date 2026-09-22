/* =========================================================================
   The desk when the consultation scratchpad is not there.

   THIS IS WHAT PRODUCTION LOOKS LIKE RIGHT NOW. The code that keeps a
   half-written consultation is deployed; the table it writes to is not,
   because migrations are not mine to run. Every one of the four scratchpad
   calls therefore fails - `no such table: consultation_drafts` comes back
   from D1 as a 500 - and the desk must carry on as if the feature had never
   been written.

   "It degrades gracefully" is a claim, and I made it in a sentence before I
   had checked it. This file checks it. The bar is not that the desk avoids
   crashing; it is that a doctor sitting in front of it cannot tell anything
   is wrong:

     - the queue paints, with no Draft markers on anybody
     - opening a patient gives a clean, empty sheet
     - she is shown no error, because there is nothing she can do about it
       and a red banner she cannot act on is worse than silence
     - SAVE STILL WORKS, and still sends the whole consultation

   The last one is the one that matters. The scratchpad is a convenience;
   the record is not. If a missing table could stop a consultation being
   saved, this feature would have made the product worse.

   Run:  node test/desk-without-scratchpad.test.js
   ========================================================================= */

import { makeDom, makeApi, runDesk, settle, reporter } from './desk-harness.js';

const { check, done } = reporter();

/* Exactly what the browser sees today: the route exists, the table does
   not, so the Worker 500s and the client throws. */
const missingTable = async () => {
  const error = new Error('Something went wrong. Please try again.');
  error.status = 500;
  throw error;
};

let attempted = 0;
const doc = makeDom();
const { api, sent } = makeApi({
  openConsultationDrafts: missingTable,
  consultationDraft: missingTable,
  saveConsultationDraft: async () => { attempted++; return missingTable(); },
  clearConsultationDraft: async () => { attempted++; return missingTable(); }
});

console.log('\nThe desk when the scratchpad table does not exist\n');

const { boot } = await runDesk(doc, api);

/* ------------------------------------------------------- it still runs --- */

check('the desk boots even though the scratchpad is unavailable',
  boot === null, boot && boot.message);

const queue = doc.getElementById('deskQueue');
check('the patient list still paints',
  /A Patient/.test(queue.innerHTML), queue.innerHTML.slice(0, 140));
check('and the walk-in still appears above it',
  /A Walk-in/.test(queue.innerHTML) &&
  queue.innerHTML.indexOf('A Walk-in') < queue.innerHTML.indexOf('A Patient'));

/* No marker, because there is genuinely nothing kept. Showing "Draft" here
   would promise a doctor that something was saved when nothing was. */
check('nobody is marked as having an unfinished consultation',
  !/desk-unfinished/.test(queue.innerHTML), queue.innerHTML.slice(0, 240));

/* --------------------------------------------------- opening a patient --- */

const person = queue.querySelectorAll('[data-patient]')
  .find(node => node.dataset.patient === 'pat_1');
check('a patient can still be opened', !!person);

for (const fn of (person ? person.listeners.click || [] : [])) fn();
await settle();

const sheet = doc.getElementById('deskSheet');
check('the sheet paints', /rx-sheet/.test(sheet.innerHTML), sheet.innerHTML.slice(0, 120));
check('with the patient on it', /A Patient/.test(sheet.innerHTML));

/* The restore failed. It must leave a clean empty consultation, not a
   half-populated one and not an error where the sheet should be. */
check('and it is empty, not half-restored',
  !/Avipattikar churna/.test(sheet.innerHTML) &&
  !/Burning in the chest/.test(sheet.innerHTML));

/* She can do nothing about a missing table. Telling her about it spends the
   one notice bar she has on something that is not hers to fix, and trains
   her to ignore the bar that will matter. */
check('the doctor is shown no error she cannot act on',
  doc.getElementById('deskMsg').textContent === '',
  JSON.stringify(doc.getElementById('deskMsg').textContent));
check('and is not falsely told anything was picked up',
  !/picked up/i.test(doc.getElementById('deskMsg').textContent));

/* ------------------------------------------------------- she types --- */

/* Drive a real keystroke through the sheet's own handler, so the autosave
   path that is going to fail is genuinely exercised rather than assumed. */
const complaints = sheet.querySelectorAll('[data-field]')
  .find(node => node.dataset.field === 'complaints');
check('the sheet has a complaints field wired', !!complaints);
if (complaints) {
  complaints.value = 'Cough for four days';
  for (const fn of complaints.listeners.input || []) fn();
}

check('typing marks the consultation unsaved',
  doc.getElementById('deskSaved').textContent === 'Unsaved',
  doc.getElementById('deskSaved').textContent);
check('and lights the Save button',
  doc.getElementById('deskSave').disabled === false);

/* The autosave fires three seconds after the last keystroke and will fail.
   Waiting it out is the point: everything below happens AFTER a rejection
   that nobody handled at the call site. */
await settle(4000);

check('the autosave was actually attempted, and failed', attempted > 0,
  'attempts: ' + attempted);
check('the failure did not put an error in front of the doctor',
  doc.getElementById('deskMsg').textContent === '',
  JSON.stringify(doc.getElementById('deskMsg').textContent));
check('and it did not claim to have kept anything',
  !/kept/i.test(doc.getElementById('deskSaved').textContent),
  doc.getElementById('deskSaved').textContent);
check('the sheet still says Unsaved, which is the truth',
  doc.getElementById('deskSaved').textContent === 'Unsaved',
  doc.getElementById('deskSaved').textContent);

/* ------------------------------------------ and the record still works --- */

/* The whole point. A missing convenience table must not stand between a
   doctor and saving a consultation. */
for (const fn of doc.getElementById('deskSave').listeners.click || []) fn();
await settle();

const visit = sent('createVisit')[0];
check('SAVE STILL WORKS: the visit is created',
  !!visit, JSON.stringify(sent('createVisit')));
check('and carries what she typed',
  !!visit && visit.complaints === 'Cough for four days',
  JSON.stringify(visit && visit.complaints));
check('the prescription is created too',
  sent('createPrescription').length === 1, JSON.stringify(sent('createPrescription')));
check('and after saving the screen says Saved, not an error',
  doc.getElementById('deskSaved').textContent === 'Saved',
  doc.getElementById('deskSaved').textContent);
check('with no error message',
  !/error/i.test(doc.getElementById('deskMsg').className),
  doc.getElementById('deskMsg').className);

/* CONTROL: this suite must be able to fail. If the desk had never called
   the API at all, every assertion above would pass over a page that does
   nothing - so prove the working calls really did go through. */
check('CONTROL: the calls that were meant to succeed did succeed',
  sent('createVisit').length === 1 && sent('createPrescription').length === 1);
check('CONTROL: and the scratchpad calls really were the failing ones',
  sent('saveConsultationDraft').length === 0 && attempted > 0,
  'recorded: ' + sent('saveConsultationDraft').length + ', attempts: ' + attempted);

done();

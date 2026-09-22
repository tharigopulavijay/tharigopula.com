/* =========================================================================
   WhatsApp.

   The two things worth being certain about are not "does it send". They are
   "does it ever send twice" and "does it ever send to somebody who said
   no". A clinic whose patients get the same reminder twice looks careless,
   and a clinic that messages somebody who opted out has broken a promise
   and WhatsApp's policy at the same time.

   Run:  node test/whatsapp.test.js
   ========================================================================= */

import {
  TEMPLATES, fill, dedupeKey, refusalFor, readWebhook,
  verifyChallenge, whenText, configured, clickToChat
} from '../worker/whatsapp.js';
import { indiaDayAfter, chooseChannel } from '../worker/messaging.js';
import { sms } from '@tharigopula/core/comms';
const { canSend, templateIdFor, TEMPLATE_VARS } = sms;

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};
const throws = (name, fn, expect) => {
  try { fn(); check(name, false, 'it was accepted'); }
  catch (e) {
    check(name, !expect || String(e.message).includes(expect), 'wrong message: ' + e.message);
  }
};

/* ------------------------------------------------------------ consent --- */
console.log('\nNobody is messaged who has not agreed\n');

const willing = {
  id: 'pat_1', full_name: 'Lakshmi', mobile: '+919812345670',
  whatsapp_opt_in: 1, whatsapp_opted_out_at: null
};

check('a patient who agreed is allowed', refusalFor(willing) === null);

check('a patient who never agreed is refused',
  /has not agreed/.test(refusalFor({ ...willing, whatsapp_opt_in: 0 })));

/* This is the one that matters most. A clinic ticking the box must not
   override the patient's own STOP. */
check('STOP beats the clinic ticking the box',
  /asked to stop/.test(refusalFor({ ...willing, whatsapp_opted_out_at: '2026-09-01T10:00:00Z' })),
  refusalFor({ ...willing, whatsapp_opted_out_at: '2026-09-01T10:00:00Z' }));

check('no mobile number is refused',
  /No mobile/.test(refusalFor({ ...willing, mobile: null })));
check('a missing patient is refused', typeof refusalFor(null) === 'string');

/* The refusal is shown to a human, so it has to name the patient and say
   what to do rather than read like a status code. */
check('the refusal names the patient',
  refusalFor({ ...willing, whatsapp_opt_in: 0 }).startsWith('Lakshmi'));

/* --------------------------------------------------------- duplicates --- */
console.log('\nThe same message about the same thing is one message\n');

const a = dedupeKey('appointment_reminder', 'appointment', 'apt_1', '2026-09-09');
const b = dedupeKey('appointment_reminder', 'appointment', 'apt_1', '2026-09-09');
check('two runs over the same appointment produce the same key', a === b);

/* Built from what the message is about, never from the clock, or a retry
   an hour later would look like a new message. */
check('the key contains no timestamp', !/\d{2}:\d{2}/.test(a), a);

check('a different appointment is a different message',
  a !== dedupeKey('appointment_reminder', 'appointment', 'apt_2', '2026-09-09'));

/* A rescheduled appointment SHOULD earn a second reminder - the patient
   needs to know about the new day. */
check('the same appointment moved to another day is a new message',
  a !== dedupeKey('appointment_reminder', 'appointment', 'apt_1', '2026-09-10'));

check('a different template about the same thing is a different message',
  a !== dedupeKey('record_ready', 'appointment', 'apt_1', '2026-09-09'));

/* ---------------------------------------------------------- templates --- */
console.log('\nNo message goes out with a hole in it\n');

const reminder = fill('appointment_reminder', {
  patientName: 'Lakshmi', clinicName: 'Sri Ayur Clinic',
  doctorName: 'Dr Rao', when: 'Tuesday, 9 September at 4:30 pm'
});
check('the variables are positional, in the declared order',
  reminder.parameters.map(p => p.text).join('|') ===
  'Lakshmi|Sri Ayur Clinic|Dr Rao|Tuesday, 9 September at 4:30 pm');
check('the template name is the one registered with Meta',
  reminder.name === 'appointment_reminder' && reminder.language === 'en');
check('the preview reads like the message the patient gets',
  reminder.preview.includes('Lakshmi') && reminder.preview.includes('Sri Ayur Clinic'));

/* Meta accepts a missing variable and sends a message with a blank in it,
   which reaches the patient looking broken. Refuse locally. */
throws('a missing variable is refused before it reaches Meta',
  () => fill('appointment_reminder', { patientName: 'Lakshmi' }),
  'missing: clinicName, doctorName, when');

throws('an empty string counts as missing',
  () => fill('record_ready', {
    patientName: 'Lakshmi', what: 'prescription', clinicName: '', link: 'https://x'
  }), 'clinicName');

throws('an unknown template', () => fill('discount_offer', {}), 'no message template');

check('both templates the clinic needs exist',
  !!TEMPLATES.appointment_reminder && !!TEMPLATES.record_ready);

/* ------------------------------------------------------------ webhook --- */
console.log('\nThe webhook, and the word STOP\n');

const hook = readWebhook({
  entry: [{
    changes: [{
      value: {
        statuses: [{ id: 'wamid.ABC', status: 'delivered' }],
        messages: [{ from: '919812345670', text: { body: ' STOP ' } }]
      }
    }]
  }]
});
check('a delivery receipt is read',
  hook.statuses.length === 1 && hook.statuses[0].status === 'delivered'
  && hook.statuses[0].providerId === 'wamid.ABC');
check('STOP is read, whitespace and case notwithstanding',
  hook.optOuts.length === 1 && hook.optOuts[0].mobile === '+919812345670');

/* Somebody typing "stop." meant stop. Making a patient guess the magic
   word is not acceptable when the subject is consent. */
const variants = ['stop.', 'Unsubscribe', 'BAND KARO'];
variants.forEach(text => {
  const read = readWebhook({
    entry: [{ changes: [{ value: { messages: [{ from: '919812345670', text: { body: text } }] } }] }]
  });
  check('"' + text + '" is understood as an opt-out', read.optOuts.length === 1);
});

const chatter = readWebhook({
  entry: [{ changes: [{ value: { messages: [{ from: '919812345670', text: { body: 'thank you doctor' } }] } }] }]
});
check('an ordinary reply is not an opt-out', chatter.optOuts.length === 0);

check('an empty webhook does not crash',
  readWebhook({}).statuses.length === 0 && readWebhook(null).optOuts.length === 0);

/* ----------------------------------------------------- webhook verify --- */
console.log('\nMeta proving it is Meta\n');

const env = { WHATSAPP_VERIFY_TOKEN: 'a-secret-we-chose' };
const url = t => new URL('https://x/webhooks/whatsapp?hub.mode=subscribe' +
  '&hub.verify_token=' + t + '&hub.challenge=12345');

check('the right token gets the challenge back',
  verifyChallenge(env, url('a-secret-we-chose')) === '12345');
check('a wrong token gets nothing', verifyChallenge(env, url('guess')) === null);
check('no token configured refuses everything',
  verifyChallenge({}, url('anything')) === null);

/* ------------------------------------------------------------- dates --- */
console.log('\nThe date a patient can actually read\n');

check('the weekday is spelled out, because 09/09 is ambiguous',
  whenText('2026-09-09', '16:30') === 'Wednesday, 9 September at 4:30 pm',
  whenText('2026-09-09', '16:30'));
check('morning reads as am', whenText('2026-09-09', '09:05').endsWith('9:05 am'));
check('noon is 12 pm, not 0 pm', whenText('2026-09-09', '12:00').endsWith('12:00 pm'));
check('midnight is 12 am', whenText('2026-09-09', '00:15').endsWith('12:15 am'));
check('a walk-in clinic with no time still reads properly',
  whenText('2026-09-09', null) === 'Wednesday, 9 September');
check('nonsense in does not crash', whenText('', '') === '');

/* Workers run in UTC. Between 18:30 and midnight IST, a UTC "tomorrow" is
   a different day from the clinic's, and reminders for the wrong day are
   worse than no reminders. */
console.log('\nTomorrow means tomorrow in India\n');

check('19:00 IST on the 8th looks ahead to the 9th',
  indiaDayAfter(new Date('2026-09-08T13:30:00Z')) === '2026-09-09',
  indiaDayAfter(new Date('2026-09-08T13:30:00Z')));
check('23:30 IST on the 8th still means the 9th, not the 10th',
  indiaDayAfter(new Date('2026-09-08T18:00:00Z')) === '2026-09-09',
  indiaDayAfter(new Date('2026-09-08T18:00:00Z')));

/* ------------------------------------------------------------- config --- */
console.log('\nSwitched off is a state, not a crash\n');

check('nothing configured is simply not configured', configured({}) === false);
check('half configured is not configured',
  configured({ WHATSAPP_TOKEN: 'x' }) === false);
check('both present is configured',
  configured({ WHATSAPP_TOKEN: 'x', WHATSAPP_PHONE_ID: '1' }) === true);

/* ------------------------------------------- a failed message may retry --- */
console.log('\nA message that failed can be tried again. One that sent cannot\n');

/* A quota failure keeps the row so the doctor can see her plan stopped it -
   but the row holds the UNIQUE dedupe key. Refusing outright meant a clinic
   that ran out of messages on Tuesday and upgraded on Wednesday could never
   send that reminder, ever. Reviving a FAILED row fixes that; reviving a
   SENT one would message the patient twice. */
const { messages: messageRepo } = await import('../worker/repo.js');

const fakeDbWith = row => ({
  prepare(sql) {
    return {
      bind: (...args) => ({
        async run() {
          if (/^INSERT INTO messages/i.test(sql.trim())) {
            if (row.exists) throw new Error('UNIQUE constraint failed: messages.dedupe_key');
            row.exists = true; row.id = args[0]; row.status = 'queued';
            return {};
          }
          /* The revive: only a failed row may be taken over. */
          if (/UPDATE messages/i.test(sql) && /status = 'failed'/.test(sql)) {
            if (row.status === 'failed') { row.status = 'queued'; row.id = args[0]; }
            return {};
          }
          return {};
        },
        async first() { return row.exists ? { id: row.id } : null; }
      })
    };
  }
});

const fresh = { exists: false };
check('a brand new message is claimed',
  (await messageRepo.claim(fakeDbWith(fresh), 'doc_1',
    { template: 'appointment_reminder', toMobile: '+91', dedupeKey: 'k' })) !== null);

const failedRow = { exists: true, id: 'old', status: 'failed' };
const revived = await messageRepo.claim(fakeDbWith(failedRow), 'doc_1',
  { template: 'appointment_reminder', toMobile: '+91', dedupeKey: 'k' });
check('a message that FAILED can be claimed again after an upgrade',
  revived !== null, String(revived));

const sentRow = { exists: true, id: 'old', status: 'sent' };
check('a message already SENT is never claimed again',
  (await messageRepo.claim(fakeDbWith(sentRow), 'doc_1',
    { template: 'appointment_reminder', toMobile: '+91', dedupeKey: 'k' })) === null);

const deliveredRow = { exists: true, id: 'old', status: 'delivered' };
check('nor one already delivered',
  (await messageRepo.claim(fakeDbWith(deliveredRow), 'doc_1',
    { template: 'appointment_reminder', toMobile: '+91', dedupeKey: 'k' })) === null);

/* ------------------------------------------------ the free way to send --- */
console.log('\nwa.me links, for before Meta approves anything\n');

const link = clickToChat('+919812345670', 'Namaste Lakshmi, see you tomorrow at 4:30 pm.');
check('the number is bare digits, no plus',
  link.startsWith('https://wa.me/919812345670?text='), link);
check('the text is url-encoded, so spaces do not break the link',
  link.includes('Namaste%20Lakshmi') || link.includes('Namaste+Lakshmi'), link);
check('no number, no link', clickToChat('', 'hello') === null);

/* The whole point of the free path is that it becomes the paid path with
   nothing the patient can see changing. If the wording differed, switching
   on the API would look to patients like a different clinic wrote to them. */
const byHand = TEMPLATES.appointment_reminder.preview({
  patientName: 'Lakshmi', clinicName: 'Sri Ayur Clinic',
  doctorName: 'Dr Rao', when: 'Tuesday, 9 September at 4:30 pm'
});
check('the hand-sent wording is identical to the automatic one',
  byHand === reminder.preview, byHand + ' vs ' + reminder.preview);

/* ------------------------------------------------------- which channel --- */
console.log('\nChoosing a channel\n');

const waEnv = { WHATSAPP_TOKEN: 'x', WHATSAPP_PHONE_ID: '1' };
const smsEnv = { SMS_API_KEY: 'k', SMS_TEMPLATE_REMINDER: '123' };

check('WhatsApp wins when both are available',
  chooseChannel({ ...waEnv, ...smsEnv }, 'appointment_reminder') === 'whatsapp');
check('SMS carries it when WhatsApp is not set up',
  chooseChannel(smsEnv, 'appointment_reminder') === 'sms');

/* Asking for SMS and silently getting WhatsApp is how a clinic messages
   somebody in a way they did not agree to. An explicit choice is kept even
   when that channel is not configured, so the caller gets a real error. */
check('an explicit choice is never silently swapped',
  chooseChannel(waEnv, 'appointment_reminder', 'sms') === 'sms');

/* --------------------------------------------------------------- DLT --- */
console.log('\nSMS will not pretend it can send\n');

/* An API key with no DLT template for this message is worse than no key: it
   looks available, and the operator drops the message silently. */
check('a key without a template for this message cannot send',
  canSend({ SMS_API_KEY: 'k' }, 'appointment_reminder') === false);
check('with the template, it can',
  canSend(smsEnv, 'appointment_reminder') === true);
check('every message we send has a template variable named for it',
  Object.keys(TEMPLATE_VARS).every(k => TEMPLATE_VARS[k].startsWith('SMS_TEMPLATE')));

throws('a missing DLT template is an explicit error, not a silent drop',
  () => templateIdFor({ SMS_API_KEY: 'k' }, 'record_ready'),
  'DLT-registered template');

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);

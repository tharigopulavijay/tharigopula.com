/* =========================================================================
   A verification code NEVER goes by WhatsApp.

   This is a product decision, not an implementation detail, which is why it
   is pinned by a test rather than left to a comment. The reasoning:

     Every Indian mobile receives SMS. WhatsApp needs a smartphone, the app
     installed, and data working that day. For most features "most patients"
     is an acceptable answer. For the code that is the only way back into an
     account it is not - the person who cannot receive it is precisely the
     person who is locked out, and they have no second route.

   So a future change that routes codes through WhatsApp "because it is
   cheaper" or "because we already have it" should fail here and be made to
   argue with the paragraph above.

   WHAT DID CHANGE, AND WHY IT IS NOT THAT.

   Vijay: "anyhow we are having the email id right - why don't you push the
   otp there. we have stopped sms because it actually costs us."

   A DOCTOR resetting her password now gets the code in her inbox, because
   TCOS holds her email, an email costs nothing, and SMS is still waiting on
   DLT approval. That does not weaken the paragraph above: the person who
   cannot receive it is not locked out of a second route, she IS on the
   second route, and she reached it by typing her own mobile.

   A PATIENT's consent code is untouched and still goes to the patient's
   mobile. She is not our customer, we hold no address for her, and the code
   has to reach the person in the room - not the doctor asking for it. That
   distinction is asserted below rather than left to be noticed.

   Run:  node test/otp-sms.test.js
   ========================================================================= */

import { issueOtp } from '../worker/otp.js';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

/* A database that remembers what it was asked, and nothing else. */
const fakeDb = () => ({
  prepare() {
    return {
      bind: () => ({
        run: async () => ({ meta: { changes: 1 } }),
        first: async () => ({ n: 0 }),
        all: async () => ({ results: [] })
      })
    };
  }
});

/* Records every outbound call instead of making one. */
function spyFetch() {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse((init && init.body) || '{}'), init });
    return { ok: true, json: async () => ({ type: 'success', request_id: 'req_1' }) };
  };
  return calls;
}

const SMS_ENV = { SMS_API_KEY: 'key', SMS_TEMPLATE_ID: 'dlt_template_1' };

/* ------------------------------------------------------------ the rule --- */
console.log('\nA code to a mobile number goes by SMS\n');

let calls = spyFetch();
let result = await issueOtp(SMS_ENV, fakeDb(),
  { purpose: 'doctor_reset', rawIdentifier: '9812345670' });

check('it reports the SMS channel', result.channel === 'sms', result.channel);
check('exactly one message was sent', calls.length === 1, String(calls.length));
check('it went to MSG91',
  calls[0] && calls[0].url.includes('msg91.com'), calls[0] && calls[0].url);
check('it carried the DLT template id',
  calls[0].body.template_id === 'dlt_template_1');
check('the number lost its plus, the way MSG91 wants it',
  calls[0].body.recipients[0].mobiles === '919812345670',
  calls[0].body.recipients[0].mobiles);
check('the code is sent as the OTP variable',
  /^\d{4,8}$/.test(String(calls[0].body.recipients[0].OTP)),
  String(calls[0].body.recipients[0].OTP));

/* The heart of it. Even with WhatsApp fully configured and cheaper, a code
   must not go that way. */
console.log('\nEven with WhatsApp switched on, the code still goes by SMS\n');

calls = spyFetch();
result = await issueOtp(
  { ...SMS_ENV, WHATSAPP_TOKEN: 't', WHATSAPP_PHONE_ID: '1', WHATSAPP_OTP_TEMPLATE: 'otp' },
  fakeDb(), { purpose: 'doctor_reset', rawIdentifier: '9812345670' });

check('still reports SMS', result.channel === 'sms', result.channel);
check('nothing was sent to Meta',
  calls.every(c => !c.url.includes('facebook.com')),
  calls.map(c => c.url).join(', '));
check('MSG91 got it', calls.some(c => c.url.includes('msg91.com')));

/* ------------------------------------------------------- email is email --- */
console.log('\nAn email address still gets an email\n');

calls = spyFetch();
result = await issueOtp({ ...SMS_ENV, RESEND_API_KEY: 'r' }, fakeDb(),
  { purpose: 'doctor_reset', rawIdentifier: 'doctor@clinic.in' });
check('the channel is email', result.channel === 'email');
check('it went to Resend, not MSG91',
  calls[0].url.includes('resend.com'), calls[0].url);

/* --------------------------------- the code goes where she can read it --- */
console.log('\nShe typed her mobile; the code goes to her inbox\n');

const MAIL_ENV = { ...SMS_ENV, RESEND_API_KEY: 'r' };

calls = spyFetch();
result = await issueOtp(MAIL_ENV, fakeDb(), {
  purpose: 'doctor_reset',
  rawIdentifier: '9812345670',
  deliverTo: 'doctor@clinic.in'
});

check('nothing was sent by SMS, so nothing was paid for',
  calls.every(c => !c.url.includes('msg91.com')),
  calls.map(c => c.url).join(', '));
check('IT WENT TO HER EMAIL ADDRESS',
  calls.length === 1 && calls[0].url.includes('resend.com'),
  calls.map(c => c.url).join(', '));
check('addressed to the account\'s email, not to the mobile',
  calls[0].body.to[0] === 'doctor@clinic.in', JSON.stringify(calls[0].body.to));
check('and it reports the channel it actually used',
  result.channel === 'email', result.channel);

/* THE ONE THAT WOULD LOCK HER OUT. verifyOtp looks the row up by exactly
   what she types on the next screen - her mobile. File it under the email
   and the code she is holding can never be redeemed, which looks from her
   side like a delivery failure and from ours like a working send. */
check('BUT THE CODE IS STILL FILED UNDER THE MOBILE SHE TYPED',
  result.identifier === '+919812345670', result.identifier);
check('and the address it went to is reported separately',
  result.sentTo === 'doctor@clinic.in', result.sentTo);

/* A patient is not our customer and we hold no address for her. Her code
   has to reach the person in the room. */
calls = spyFetch();
result = await issueOtp(MAIL_ENV, fakeDb(),
  { purpose: 'patient_consent', rawIdentifier: '9812345671' });
check('A PATIENT\'S CONSENT CODE IS NOT REROUTED - it still goes by SMS',
  result.channel === 'sms' && calls[0].url.includes('msg91.com'),
  result.channel + ' / ' + calls[0].url);

/* CONTROL: without the redirect the same call goes by SMS, so the
   assertions above are about the redirect and not about the fixture. */
calls = spyFetch();
result = await issueOtp(MAIL_ENV, fakeDb(),
  { purpose: 'doctor_reset', rawIdentifier: '9812345670' });
check('CONTROL: with no email on the account it still goes by SMS',
  result.channel === 'sms' && calls[0].url.includes('msg91.com'),
  result.channel + ' / ' + calls[0].url);

/* ------------------------------------------------------ failing loudly --- */
console.log('\nWhen it cannot send, it says so\n');

/* MSG91 answers HTTP 200 with {"type":"error"} for a rejected send. The
   previous implementation checked only the status code, so a code that was
   never delivered was reported as sent - and the doctor sat waiting for an
   SMS that was never coming, with nothing anywhere saying why. */
globalThis.fetch = async () => ({
  ok: true,
  json: async () => ({ type: 'error', message: 'Template not approved on DLT' })
});
let threw = null;
try {
  await issueOtp(SMS_ENV, fakeDb(), { purpose: 'doctor_reset', rawIdentifier: '9812345670' });
} catch (error) { threw = error; }

check('a 200-with-error is treated as a failure, not a success', threw !== null);
check('and it repeats what the provider actually said',
  threw && /DLT/.test(threw.message), threw && threw.message);

/* A missing DLT template must be an explicit error too. The operator's own
   failure mode is to drop an unregistered message in silence. */
globalThis.fetch = async () => ({ ok: true, json: async () => ({ type: 'success' }) });
threw = null;
try {
  await issueOtp({ SMS_API_KEY: 'key' }, fakeDb(),
    { purpose: 'doctor_reset', rawIdentifier: '9812345670' });
} catch (error) { threw = error; }
check('no DLT template configured is refused before sending',
  threw && /DLT-registered template/.test(threw.message), threw && threw.message);

threw = null;
try {
  await issueOtp({}, fakeDb(), { purpose: 'doctor_reset', rawIdentifier: '9812345670' });
} catch (error) { threw = error; }
check('no SMS key at all is refused with a fixable message',
  threw && /SMS_API_KEY/.test(threw.message), threw && threw.message);

/* ------------------------------------------------------ the health check --- */
console.log('\nThe health check names the actual problem\n');

/* A bad key, an empty wallet and a missing DLT template are three different
   problems with three different fixes. "SMS is not working" is none of
   them, and it is what somebody debugging this at 9pm would otherwise get. */
const health = (await import('@tharigopula/core/comms')).sms.health;
const withFetch = (fn) => { globalThis.fetch = fn; };

let h = await health({});
check('no key at all names the command to run',
  /wrangler secret put SMS_API_KEY/.test(h.reason), h.reason);

withFetch(async () => ({ status: 401, text: async () => 'unauthorised' }));
h = await health({ SMS_API_KEY: 'wrong' });
check('a rejected key says the key is wrong', /rejected the key/.test(h.reason), h.reason);

/* The legacy endpoint answers zero on a unified-wallet account while the
   dashboard shows thousands. Reporting that as "empty" told somebody who
   had just paid Rs 2,950 that his payment had failed. Unknown is not zero. */
withFetch(async () => ({
  status: 200, text: async () => JSON.stringify({ SMS: '0.00', VOICE: '0.00' })
}));
h = await health({ SMS_API_KEY: 'k' });
check('an unreadable balance is null, never zero', h.balanceRupees === null,
  String(h.balanceRupees));
check('and it does not claim the wallet is empty',
  !/empty|no balance/i.test(h.reason), h.reason);

/* Nor does an unreadable number block sending. The template does. */
h = await health({ SMS_API_KEY: 'k', SMS_TEMPLATE_ID: 'flow_1' });
check('a balance we cannot read does not stop us sending', h.ok === true, h.reason);

withFetch(async () => ({ status: 200, text: async () => JSON.stringify({ SMS: '3750.00' }) }));
h = await health({ SMS_API_KEY: 'k' });
check('no DLT template is the thing that blocks sending',
  h.ok === false && /DLT-registered template/.test(h.reason), h.reason);
check('it reports a balance when it can read one', h.balanceRupees === 3750, String(h.balanceRupees));
check('and names the variable that is missing',
  /SMS_TEMPLATE_ID/.test(h.templates.otp), h.templates.otp);

h = await health({ SMS_API_KEY: 'k', SMS_TEMPLATE_ID: 'flow_1' });
check('key plus balance plus template is ready',
  h.ok === true && /Ready to send/.test(h.reason), h.reason);

/* balance.php is the legacy per-route endpoint and does not agree with the
   newer unified wallet on every account. Rather than guess which field
   holds the money, take the largest and hand back the whole response - so a
   zero can be traced to the right cause rather than assumed to be an
   unpaid invoice. */
withFetch(async () => ({
  status: 200,
  text: async () => JSON.stringify({ SMS: '0.00', VOICE: '0.00', MSG91: '3750.00' })
}));
h = await health({ SMS_API_KEY: 'k', SMS_TEMPLATE_ID: 'flow_1' });
check('money in any field of the response is found',
  h.balanceRupees === 3750, String(h.balanceRupees));
/* Everything every candidate endpoint said, labelled, so that when none of
   them carries the money the next person has evidence rather than a hunch. */
check('and what each endpoint said is handed back, labelled',
  h.providerSaid && Object.keys(h.providerSaid).length >= 3 &&
  Object.values(h.providerSaid)[0].MSG91 === '3750.00',
  JSON.stringify(h.providerSaid));


/* This endpoint answers with JSON on success and a bare string on failure.
   Swallowing the string would turn a fixable message into a shrug. */
withFetch(async () => ({ status: 200, text: async () => 'authkey not valid' }));
h = await health({ SMS_API_KEY: 'k' });
check('a bare error string is repeated, not swallowed',
  /authkey not valid/.test(h.reason), h.reason);

withFetch(async () => { throw new Error('boom'); });
h = await health({ SMS_API_KEY: 'k' });
check('a network failure does not crash the check',
  h.ok === false && /Could not reach/.test(h.reason), h.reason);

/* ------------------------------- an undelivered code is not a used one --- */
console.log('\nA code the provider refused does not count against the allowance\n');

/* Five codes an hour is the limit, and countRecent() counts ROWS. So a row
   written for a code that was never delivered spends part of a doctor's
   allowance on nothing. Five failed sends left her locked out for an hour
   with an empty inbox - and while SMS waits on DLT, email is her ONLY way
   back into her own clinic. */
const recordingDb = () => {
  const sql = [];
  return {
    statements: sql,
    prepare(text) {
      sql.push(text.replace(/\s+/g, ' ').trim());
      return {
        bind: () => ({
          run: async () => ({ meta: { changes: 1 } }),
          first: async () => ({ n: 0 }),
          all: async () => ({ results: [] })
        })
      };
    }
  };
};

const wrote = t => db => db.statements.some(s => new RegExp(t, 'i').test(s));
const inserted = wrote('INSERT INTO otp_codes');
const discarded = wrote('DELETE FROM otp_codes');

/* Delivery succeeds: the row stays, because the code really was sent. */
spyFetch();
let db = recordingDb();
await issueOtp(SMS_ENV, db, { purpose: 'doctor_reset', rawIdentifier: '9812345670' });
check('a delivered code is recorded', inserted(db));
check('and is NOT discarded', !discarded(db));

/* Delivery fails: the row is unwound. */
globalThis.fetch = async () => ({ ok: false, status: 500, text: async () => 'provider down' });
db = recordingDb();
threw = null;
try {
  await issueOtp(SMS_ENV, db, { purpose: 'doctor_reset', rawIdentifier: '9812345670' });
} catch (error) { threw = error; }
check('a refused send still throws, so the doctor is told', threw !== null);
check('and the unsent code is discarded', discarded(db),
  db.statements.join(' | ').slice(0, 200));

/* Same for email, which is the channel that actually matters today. */
/* Resend reports the reason as JSON, which is why email.js reads it with
   .json() rather than .text() - so the stub has to answer the same way. */
globalThis.fetch = async () => ({
  ok: false, status: 422,
  json: async () => ({ message: 'domain not verified' }),
  text: async () => '{"message":"domain not verified"}'
});
db = recordingDb();
threw = null;
try {
  await issueOtp({ RESEND_API_KEY: 'k' }, db,
    { purpose: 'doctor_reset', rawIdentifier: 'doctor@example.com' });
} catch (error) { threw = error; }
check('an undelivered EMAIL code is discarded too', discarded(db));
check('and the provider reason survives', threw !== null && /domain not verified/.test(threw.message),
  threw && threw.message);

/* If the unwind itself fails, the delivery error is still what surfaces -
   the doctor needs to know the code is not coming. */
globalThis.fetch = async () => ({ ok: false, status: 500, text: async () => 'provider down' });
const brokenCleanup = {
  prepare(text) {
    return {
      bind: () => ({
        run: async () => {
          if (/DELETE FROM otp_codes/i.test(text)) throw new Error('cleanup exploded');
          return { meta: { changes: 1 } };
        },
        first: async () => ({ n: 0 }),
        all: async () => ({ results: [] })
      })
    };
  }
};
threw = null;
try {
  await issueOtp(SMS_ENV, brokenCleanup, { purpose: 'doctor_reset', rawIdentifier: '9812345670' });
} catch (error) { threw = error; }
check('a failed cleanup does not hide the delivery failure',
  threw !== null && !/cleanup exploded/.test(threw.message), threw && threw.message);

/* CONTROL. If the recorder never saw an INSERT, every assertion above would
   pass for the wrong reason. */
check('CONTROL: the recorder really does capture statements',
  db.statements.length > 0 && inserted(db), String(db.statements.length));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);

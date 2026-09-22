/* =========================================================================
   Two ways in that did not need a password.

   P1-02  The WhatsApp webhook accepted any POST.
   P1-03  Accepting an online request accepted any patient ID.

   Both were found by audit on 7 September 2026, before WhatsApp was
   switched on and before a real clinic was using online requests, so
   neither was exploited. Both are the same mistake in different clothes:
   trusting an input because it arrived, rather than because it proved
   something.

   Run:  node test/webhook-security.test.js
   ========================================================================= */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { verifySignature, signingConfigured } from '../worker/whatsapp.js';
import { normaliseMobile } from '@tharigopula/core/lib';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

/* Signs a body the way Meta does, so the tests below are checking against
   real HMAC-SHA256 rather than against our own implementation. */
async function metaWouldSend(secret, body) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return 'sha256=' + Array.from(new Uint8Array(mac))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

const SECRET = 'an-app-secret-that-is-not-real';
const env = { WHATSAPP_APP_SECRET: SECRET };

/* A real delivery receipt, and a real STOP - the two things the webhook
   acts on, and therefore the two things worth forging. */
const RECEIPT = JSON.stringify({
  entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.X', status: 'delivered' }] } }] }]
});
const STOP = JSON.stringify({
  entry: [{ changes: [{ value: { messages: [{ from: '919876543210', text: { body: 'STOP' } }] } }] }]
});

/* ------------------------------------------------------- what Meta sends --- */
console.log('\nA genuinely signed webhook is accepted\n');

let signature = await metaWouldSend(SECRET, RECEIPT);
check('a correctly signed receipt verifies',
  (await verifySignature(env, RECEIPT, signature)).ok === true);

check('and so does a signed STOP',
  (await verifySignature(env, STOP, await metaWouldSend(SECRET, STOP))).ok === true);

/* The route reads an ArrayBuffer, not a string, so that path must work too
   - this is the one that actually runs in production. */
const asBytes = new TextEncoder().encode(RECEIPT);
check('the same body as raw bytes verifies',
  (await verifySignature(env, asBytes.buffer, signature)).ok === true);
check('and as a Uint8Array',
  (await verifySignature(env, asBytes, signature)).ok === true);

/* A proxy that upper-cases the hex should not break a real webhook. */
check('an upper-cased hex signature still verifies',
  (await verifySignature(env, RECEIPT,
    'sha256=' + signature.slice(7).toUpperCase())).ok === true);

/* ----------------------------------------------------- what anyone sends --- */
console.log('\nAnything not signed by Meta is refused\n');

/* This is the finding. Before the fix, every one of these was acted on. */
check('an unsigned POST is refused',
  (await verifySignature(env, RECEIPT, null)).ok === false);
check('and says it had no signature',
  (await verifySignature(env, RECEIPT, null)).reason === 'no_signature');

check('a signature in the wrong format is refused',
  (await verifySignature(env, RECEIPT, 'deadbeef')).ok === false);
check('an empty signature is refused',
  (await verifySignature(env, RECEIPT, 'sha256=')).ok === false);

check('a signature from a different app secret is refused',
  (await verifySignature(env, RECEIPT,
    await metaWouldSend('some-other-secret', RECEIPT))).ok === false);

/* The important one. A valid signature over a DIFFERENT body must not
   validate this body - otherwise an attacker could capture one real
   webhook and reuse its signature to send anything. */
check('a valid signature lifted from another body is refused',
  (await verifySignature(env, STOP, signature)).ok === false,
  'signature for the receipt must not validate the STOP');

/* Tampering with one character must break it. */
const tampered = RECEIPT.replace('delivered', 'read');
check('a tampered body is refused',
  (await verifySignature(env, tampered, signature)).ok === false);
check('and says the signature was bad, not missing',
  (await verifySignature(env, tampered, signature)).reason === 'bad_signature');

/* Truncation and extension. */
check('a shortened signature is refused',
  (await verifySignature(env, RECEIPT, signature.slice(0, -2))).ok === false);
check('a lengthened signature is refused',
  (await verifySignature(env, RECEIPT, signature + '00')).ok === false);

/* --------------------------------------------------------- fail closed --- */
console.log('\nWith no app secret it refuses everything, rather than trusting everything\n');

/* The decision that matters. "We cannot check" must mean "do not act".
   A clinic whose delivery receipts stop updating is a visible problem
   somebody reports. A webhook quietly honouring forged opt-outs is not:
   the patient simply stops hearing from the clinic and nobody knows why. */
check('signing is reported as not configured', signingConfigured({}) === false);
check('signing is reported as configured when the secret is set', signingConfigured(env) === true);

const noSecret = await verifySignature({}, RECEIPT, signature);
check('a correctly signed webhook is STILL refused when we hold no secret',
  noSecret.ok === false, JSON.stringify(noSecret));
check('and the reason says which of the two problems it is',
  noSecret.reason === 'not_configured', noSecret.reason);

/* ------------------------------------------------------------ the route --- */
console.log('\nThe route verifies before it parses, and before it writes\n');

const router = readFileSync('worker/index.js', 'utf8');
const route = router.slice(router.indexOf("'POST /webhooks/whatsapp'"));
const handler = route.slice(0, route.indexOf('\n  },'));

check('it reads the raw bytes rather than request.json()',
  /request\.arrayBuffer\(\)/.test(handler) && !/await request\.json\(\)/.test(handler));
check('it verifies the signature', /verifySignature/.test(handler));

/* Order is the whole point: verifying after applying a receipt would be
   theatre. The signature check must come before both writes. */
const atVerify = handler.indexOf('verifySignature');
const atReceipt = handler.indexOf('applyReceipt');
const atOptOut = handler.indexOf('optOutByMobile');
const atParse = handler.indexOf('JSON.parse');
check('the check happens before any receipt is applied',
  atVerify > -1 && atReceipt > atVerify, atVerify + ' vs ' + atReceipt);
check('the check happens before any mobile is opted out',
  atOptOut > atVerify, atVerify + ' vs ' + atOptOut);
check('the check happens before the body is even parsed',
  atParse > atVerify, atVerify + ' vs ' + atParse);
check('a rejected webhook is refused, not answered with ok',
  /throw forbidden\(/.test(handler));

/* ============================ P1-03 =================================== */

console.log('\nAccepting an online request cannot attach a stranger\n');

/* Reproduced against the real schema. Note what this needs: schema.sql is
   the old monolith and holds neither appointments (migration 005) nor
   appointment_requests (006), so both are loaded on top of it. Worth
   knowing when reading any test here - schema.sql alone is NOT the shape of
   the production database, which is the same divergence the audit raised
   about the migration ledger. */
const db = new DatabaseSync(':memory:');
db.exec(readFileSync('schema.sql', 'utf8'));
db.exec(readFileSync('migrations/005-appointments.sql', 'utf8'));
db.exec(readFileSync('migrations/006-public-page.sql', 'utf8'));

db.exec(`
  INSERT INTO doctors (id, mobile, full_name, clinic_name) VALUES
    ('doc_A', '+919000000001', 'Dr A', 'Clinic A'),
    ('doc_B', '+919000000002', 'Dr B', 'Clinic B');

  -- Someone else's patient, at another clinic entirely. Patient records are
  -- shared across clinics, so doc_A can load this row by ID.
  INSERT INTO patients (id, mobile, full_name) VALUES
    ('pat_stranger', '+919555555555', 'Someone Else'),
    ('pat_asker',    '+919111111111', 'The Person Who Asked');
  INSERT INTO doctor_patients (doctor_id, patient_id) VALUES ('doc_B', 'pat_stranger');

  -- A request submitted to clinic A from the asker's number.
  INSERT INTO appointment_requests (id, doctor_id, full_name, mobile, status)
    VALUES ('req_1', 'doc_A', 'The Person Who Asked', '+919111111111', 'new');
`);

const request = db.prepare('SELECT * FROM appointment_requests WHERE id = ?').get('req_1');
const stranger = db.prepare('SELECT * FROM patients WHERE id = ?').get('pat_stranger');
const asker = db.prepare('SELECT * FROM patients WHERE id = ?').get('pat_asker');

/* The old check, exactly as it was: "does this ID exist?" */
const oldCheckPasses = p => !!p;
/* The new one: is this person actually on the number that asked? */
const newCheckPasses = (p, r) => !!p && normaliseMobile(p.mobile) === normaliseMobile(r.mobile);

check('THE FLAW: the old check let a stranger through',
  oldCheckPasses(stranger) === true);
check('the new check refuses a patient on a different number',
  newCheckPasses(stranger, request) === false);
check('and still accepts the person who actually asked',
  newCheckPasses(asker, request) === true);
check('a patient ID that does not exist is still refused',
  newCheckPasses(undefined, request) === false);

/* Formatting must not decide identity: the same number written two ways is
   the same person, and a mismatch must be a real mismatch. */
const spaced = { mobile: '+91 91111 11111' };
check('the same number written differently is still a match',
  newCheckPasses(spaced, request) === true, spaced.mobile);

/* And the route must actually be doing this. */
const acceptRoute = router.slice(router.indexOf("'POST /requests/:id/accept'"));
const acceptHandler = acceptRoute.slice(0, acceptRoute.indexOf('\n  },'));
check('the accept route compares the selected patient mobile with the request mobile',
  /normaliseMobile\(selectedPatient\.mobile\)\s*!==\s*normaliseMobile\(req\.mobile\)/.test(acceptHandler));
check('and refuses rather than linking anyway',
  /not on the number this request came from/.test(acceptHandler));
const patientRepo = readFileSync('worker/repo.js', 'utf8');
const registration = patientRepo.slice(
  patientRepo.indexOf('async registerForDoctor'), patientRepo.indexOf('async addToDoctor'));
check('the atomic patient registration repeats the mobile identity check',
  /existing\.mobile\s*!==\s*mobile/.test(registration) &&
  /not on this mobile number/.test(registration));

/* CONTROL. If the reproduction above cannot distinguish the two patients,
   every assertion in this section is vacuous. */
check('CONTROL: the two patients really are on different numbers',
  normaliseMobile(stranger.mobile) !== normaliseMobile(asker.mobile),
  stranger.mobile + ' vs ' + asker.mobile);
check('CONTROL: the request really is from the asker\'s number',
  normaliseMobile(request.mobile) === normaliseMobile(asker.mobile));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);

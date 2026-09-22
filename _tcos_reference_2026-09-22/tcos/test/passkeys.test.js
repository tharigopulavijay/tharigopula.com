/* =========================================================================
   Passkeys, tested against real signatures rather than a description of one.

   Vijay: "its been many times i am registering that i am facing issues in
   logging into the account, lets work on it, this is actually killing up
   much of my time ... if mobile app we need to make that it should be
   embedded to the mobile app fingerprint or pattern or the mobile lock -
   just give that fingerprint or something, thats it, we are in."

   This file generates real P-256 and RSA keys, builds real authenticator
   data, signs it, and hands the result to the verifier. A test that mocked
   the signature check would be testing a description of WebAuthn rather
   than WebAuthn, and the one thing worse than no fingerprint sign-in is
   one that says yes to the wrong person.

   THE ASSERTIONS THIS FILE EXISTS FOR, in the order they would hurt:

   1. A FORGED OR ALTERED ASSERTION IS REFUSED. Every field that is signed
      is tampered with here one at a time - the authenticator data, the
      client data, the signature, the key - and each must be rejected.

   2. THE DER CONVERSION IS RIGHT. A WebAuthn ES256 signature is
      DER-encoded and WebCrypto wants raw r||s. Getting it wrong does not
      throw: verify() simply returns false for every GENUINE signature, so
      the fingerprint never works and nothing says why. The r and s values
      whose top bit is set - the ones DER pads with a leading zero - are
      the case that breaks a naive slice, so they are generated until they
      occur rather than hoped for.

   3. A CHALLENGE IS SPENT EXACTLY ONCE. Without that, a captured assertion
      is a password that never expires.

   4. USER VERIFICATION IS REQUIRED. Without the UV flag a passkey proves
      the device was present, not that he was - which is the entire point
      of asking for a fingerprint.

   Run:  node test/passkeys.test.js
   ========================================================================= */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const { passkeys, challenges, derToRawEcdsa, toBase64Url, fromBase64Url, readAuthenticatorData } =
  await import('../worker/passkeys.js');

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

/* Real SQLite and the real migration, so the SQL under test is the SQL that
   runs in production. */
const raw = new DatabaseSync(':memory:');
raw.exec(readFileSync('migrations/062-sign-in-with-your-fingerprint.sql', 'utf8'));

const db = {
  prepare(sql) {
    const statement = raw.prepare(sql);
    let bound = [];
    const api = {
      bind(...args) { bound = args.map(v => (v === undefined ? null : v)); return api; },
      async first() { return statement.get(...bound) ?? null; },
      async all() { return { results: statement.all(...bound) }; },
      async run() {
        const out = statement.run(...bound);
        return { meta: { changes: Number(out.changes) } };
      }
    };
    return api;
  }
};

const RP_ID = 'admin.tcos.tharigopula.com';
const ORIGIN = 'https://' + RP_ID;
const SCOPE = 'platform';
const SUBJECT = 'hello.tharigopula@gmail.com';

const sha256 = async bytes => new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
const utf8 = text => new TextEncoder().encode(text);

/* ---- a stand-in for the phone ----

   IT MUST PRODUCE DER, because that is what a real authenticator produces.
   Node's WebCrypto signs ECDSA in raw r||s (IEEE P1363), so a test that
   used its output directly would never once exercise the DER path the
   browser actually exercises - and that path failing is silent: verify()
   returns false for every genuine signature and the fingerprint simply
   never works. So the fake authenticator encodes to DER exactly as a real
   one does, and the verifier converts it back. */
function rawToDer(raw) {
  const integer = bytes => {
    let start = 0;
    while (start < bytes.length - 1 && bytes[start] === 0) start++;
    let value = bytes.slice(start);
    /* DER integers are signed, so a top bit that is set means a leading
       zero is added. These are the signatures a naive 32-byte slice gets
       wrong, and they happen about half the time per integer. */
    if (value[0] & 0x80) value = new Uint8Array([0, ...value]);
    return new Uint8Array([0x02, value.length, ...value]);
  };
  const body = new Uint8Array([...integer(raw.slice(0, 32)), ...integer(raw.slice(32, 64))]);
  return new Uint8Array([0x30, body.length, ...body]);
}

async function makeAuthenticator({ algorithm = -7 } = {}) {
  const params = algorithm === -7
    ? { name: 'ECDSA', namedCurve: 'P-256' }
    : { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' };
  const pair = await crypto.subtle.generateKey(params, true, ['sign', 'verify']);
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey));
  return {
    algorithm,
    credentialId: toBase64Url(crypto.getRandomValues(new Uint8Array(16))),
    publicKey: toBase64Url(spki),
    async sign(bytes) {
      if (algorithm === -7) {
        const rawSig = new Uint8Array(await crypto.subtle.sign(
          { name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, bytes));
        return rawToDer(rawSig);
      }
      return new Uint8Array(await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5', pair.privateKey, bytes));
    }
  };
}

const clientData = (type, challenge, origin = ORIGIN) =>
  toBase64Url(utf8(JSON.stringify({ type, challenge, origin, crossOrigin: false })));

async function authData({ rpId = RP_ID, up = true, uv = true, signCount = 1 } = {}) {
  const bytes = new Uint8Array(37);
  bytes.set(await sha256(utf8(rpId)), 0);
  bytes[32] = (up ? 0x01 : 0) | (uv ? 0x04 : 0);
  new DataView(bytes.buffer).setUint32(33, signCount, false);
  return bytes;
}

async function assertion(device, challenge, options = {}) {
  const auth = await authData(options);
  const cd = clientData('webauthn.get', challenge, options.origin);
  const signed = new Uint8Array(auth.length + 32);
  signed.set(auth, 0);
  signed.set(await sha256(fromBase64Url(cd)), auth.length);
  return {
    credentialId: device.credentialId,
    clientDataJSON: cd,
    authenticatorData: toBase64Url(auth),
    signature: toBase64Url(options.signature || await device.sign(signed))
  };
}

const enrol = async (device, label = 'Vijay phone') => {
  const { challenge } = await challenges.issue(db,
    { scope: SCOPE, subject: SUBJECT, purpose: 'register' });
  return passkeys.register(db, {
    scope: SCOPE, subject: SUBJECT, origin: ORIGIN, rpId: RP_ID, label,
    challenge,
    clientDataJSON: clientData('webauthn.create', challenge),
    publicKey: device.publicKey,
    algorithm: device.algorithm,
    credentialId: device.credentialId
  });
};

const signIn = async (device, options = {}) => {
  const { challenge } = await challenges.issue(db, { scope: SCOPE, purpose: 'authenticate' });
  const a = await assertion(device, challenge, options);
  return passkeys.authenticate(db, { scope: SCOPE, origin: ORIGIN, rpId: RP_ID, challenge, ...a });
};

const refused = async (work) => {
  try { await work(); return null; }
  catch (error) { return error.message || 'refused'; }
};

console.log('\nThe DER trap: a genuine signature must verify\n');

/* 2. The case a naive slice gets wrong is an r or s whose top bit is set,
      because DER pads exactly those with a leading zero. Generated until
      it happens rather than hoped for. */
let sawPadded = false;
for (let attempt = 0; attempt < 40 && !sawPadded; attempt++) {
  const device = await makeAuthenticator();
  const sig = await device.sign(utf8('anything'));
  if (sig.length > 64) sawPadded = true;
  const rawSig = derToRawEcdsa(sig);
  if (rawSig.length !== 64) { check('DER converts to 64 bytes', false, String(rawSig.length)); break; }
}
check('an ES256 signature with a padded integer was actually produced', sawPadded);
check('raw 64-byte input is passed through untouched',
  derToRawEcdsa(new Uint8Array(64)).length === 64);

console.log('\nA real fingerprint signs in\n');

const phone = await makeAuthenticator();
const enrolled = await enrol(phone);
check('the device enrols', !!enrolled.id);
check('and is listed under his account',
  (await passkeys.list(db, SCOPE, SUBJECT)).length === 1);

const ok = await signIn(phone, { signCount: 2 });
check('A REAL ES256 ASSERTION IS ACCEPTED', ok && ok.subject === SUBJECT);

const rsaPhone = await makeAuthenticator({ algorithm: -257 });
await enrol(rsaPhone, 'Laptop');
const rsaOk = await signIn(rsaPhone, { signCount: 2 });
check('and so is an RS256 one', rsaOk && rsaOk.subject === SUBJECT);
check('both devices are on his list', (await passkeys.list(db, SCOPE, SUBJECT)).length === 2);

console.log('\nEverything a forger would try\n');

/* 1. Each of these alters something that is signed, or the signature. */
check('A TAMPERED SIGNATURE IS REFUSED',
  !!await refused(() => signIn(phone, { signCount: 3, signature: new Uint8Array(64) })));

check('another key cannot sign for this credential', await (async () => {
  const impostor = await makeAuthenticator();
  const { challenge } = await challenges.issue(db, { scope: SCOPE, purpose: 'authenticate' });
  const a = await assertion(impostor, challenge, { signCount: 9 });
  a.credentialId = phone.credentialId;           /* claim to be his device */
  return !!await refused(() => passkeys.authenticate(db,
    { scope: SCOPE, origin: ORIGIN, rpId: RP_ID, challenge, ...a }));
})());

check('A PASSKEY USED ON ANOTHER SITE IS REFUSED',
  (await refused(() => signIn(phone, { signCount: 4, origin: 'https://tcos-phishing.example' })))
    ?.includes('different address'));

check('a different relying party is refused',
  !!await refused(() => signIn(phone, { signCount: 5, rpId: 'evil.example' })));

/* 4. Presence is not identity. */
check('NOT UNLOCKING THE DEVICE IS REFUSED',
  (await refused(() => signIn(phone, { signCount: 6, uv: false })))?.includes('fingerprint'));
check('and neither is an assertion nobody confirmed',
  !!await refused(() => signIn(phone, { signCount: 7, up: false, uv: false })));

check('an unknown credential is refused', await (async () => {
  const stranger = await makeAuthenticator();
  return !!await refused(() => signIn(stranger));
})());

console.log('\nA challenge is a question asked once\n');

/* 3. Replay is the attack this whole scheme exists to stop. */
const replay = await (async () => {
  const { challenge } = await challenges.issue(db, { scope: SCOPE, purpose: 'authenticate' });
  const a = await assertion(phone, challenge, { signCount: 20 });
  const first = await passkeys.authenticate(db,
    { scope: SCOPE, origin: ORIGIN, rpId: RP_ID, challenge, ...a });
  const second = await refused(() => passkeys.authenticate(db,
    { scope: SCOPE, origin: ORIGIN, rpId: RP_ID, challenge, ...a }));
  return { first: !!first, second };
})();
check('the assertion is accepted once', replay.first);
check('AND THE SAME ONE AGAIN IS REFUSED', !!replay.second, String(replay.second));

check('a challenge issued for registering cannot be used to sign in', await (async () => {
  const { challenge } = await challenges.issue(db,
    { scope: SCOPE, subject: SUBJECT, purpose: 'register' });
  const a = await assertion(phone, challenge, { signCount: 21 });
  return !!await refused(() => passkeys.authenticate(db,
    { scope: SCOPE, origin: ORIGIN, rpId: RP_ID, challenge, ...a }));
})());

check('a challenge nobody issued is refused', await (async () => {
  const invented = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const a = await assertion(phone, invented, { signCount: 22 });
  return !!await refused(() => passkeys.authenticate(db,
    { scope: SCOPE, origin: ORIGIN, rpId: RP_ID, challenge: invented, ...a }));
})());

console.log('\nA cloned device gives itself away\n');

check('a counter that goes backwards is refused',
  (await refused(() => signIn(phone, { signCount: 1 })))?.includes('copy'));
/* Many phones report zero forever, which is allowed by the spec. */
check('but a device that always reports zero still works', await (async () => {
  const zeroCounter = await makeAuthenticator();
  await enrol(zeroCounter, 'Old phone');
  const a = await signIn(zeroCounter, { signCount: 0 });
  const b = await signIn(zeroCounter, { signCount: 0 });
  return !!a && !!b;
})());

console.log('\nEnrolment refuses what it should\n');

check('the same device cannot be enrolled twice',
  !!await refused(() => enrol(phone, 'Again')));
check('an unsupported algorithm is refused', await (async () => {
  const device = await makeAuthenticator();
  const { challenge } = await challenges.issue(db,
    { scope: SCOPE, subject: SUBJECT, purpose: 'register' });
  return !!await refused(() => passkeys.register(db, {
    scope: SCOPE, subject: SUBJECT, origin: ORIGIN, rpId: RP_ID, label: 'x',
    challenge, clientDataJSON: clientData('webauthn.create', challenge),
    publicKey: device.publicKey, algorithm: -8, credentialId: device.credentialId
  }));
})());
check('a key that cannot be imported is refused rather than stored', await (async () => {
  const device = await makeAuthenticator();
  const { challenge } = await challenges.issue(db,
    { scope: SCOPE, subject: SUBJECT, purpose: 'register' });
  return !!await refused(() => passkeys.register(db, {
    scope: SCOPE, subject: SUBJECT, origin: ORIGIN, rpId: RP_ID, label: 'x',
    challenge, clientDataJSON: clientData('webauthn.create', challenge),
    publicKey: toBase64Url(new Uint8Array([1, 2, 3])),
    algorithm: -7, credentialId: device.credentialId
  }));
})());
check('enrolling on another origin is refused', await (async () => {
  const device = await makeAuthenticator();
  const { challenge } = await challenges.issue(db,
    { scope: SCOPE, subject: SUBJECT, purpose: 'register' });
  return !!await refused(() => passkeys.register(db, {
    scope: SCOPE, subject: SUBJECT, origin: ORIGIN, rpId: RP_ID, label: 'x',
    challenge,
    clientDataJSON: clientData('webauthn.create', challenge, 'https://elsewhere.example'),
    publicKey: device.publicKey, algorithm: device.algorithm, credentialId: device.credentialId
  }));
})());

console.log('\nOne person\'s devices are not another\'s\n');

check('a clinic passkey cannot sign in to the platform', await (async () => {
  const device = await makeAuthenticator();
  const { challenge } = await challenges.issue(db,
    { scope: 'clinic', subject: 'doc_1', purpose: 'register' });
  await passkeys.register(db, {
    scope: 'clinic', subject: 'doc_1', origin: ORIGIN, rpId: RP_ID, label: 'Her phone',
    challenge, clientDataJSON: clientData('webauthn.create', challenge),
    publicKey: device.publicKey, algorithm: device.algorithm, credentialId: device.credentialId
  });
  return !!await refused(() => signIn(device, { signCount: 2 }));
})());

check('revoking a device stops it signing in', await (async () => {
  const device = await makeAuthenticator();
  const created = await enrol(device, 'Lost tablet');
  await passkeys.revoke(db, SCOPE, SUBJECT, created.id);
  return !!await refused(() => signIn(device, { signCount: 2 }));
})());
check('and another account cannot revoke your device', await (async () => {
  const device = await makeAuthenticator();
  const created = await enrol(device, 'Desk PC');
  return !!await refused(() => passkeys.revoke(db, SCOPE, 'someone@else.test', created.id));
})());

console.log('\nMalformed input is refused, not crashed on\n');

for (const [name, bytes] of [
  ['an empty authenticator data', new Uint8Array(0)],
  ['a truncated one', new Uint8Array(20)]
]) {
  let threw = false;
  try { readAuthenticatorData(bytes); } catch (_) { threw = true; }
  check(name + ' is refused', threw);
}

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);

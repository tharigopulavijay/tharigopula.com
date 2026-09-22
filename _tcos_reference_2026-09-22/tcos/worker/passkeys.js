/* =========================================================================
   Passkeys - the fingerprint, face or screen lock the device already has.

   Vijay: "i have my own user id and pwd, then why do i need to make that
   consistency like i need to have this email id only ... if mobile app we
   need to make that it should be embedded to the mobile app fingerprint or
   pattern or the mobile lock - just give that fingerprint or something,
   thats it, we are in."

   WHAT THIS IS REPLACING, AND WHY IT IS AN UPGRADE RATHER THAN A SHORTCUT.

   The owner console sat behind Cloudflare Access, which identified him by
   whichever Cloudflare ACCOUNT a browser happened to be signed into. That
   tied a clinical platform's console to a session on a third-party
   dashboard, it is different on every device, and it locked him out four
   separate times.

   A passkey is stronger than what it replaces, not weaker:

     * The private key never leaves the device and is not extractable.
       Nothing this server holds can be replayed anywhere - the public key
       is useless to whoever steals the database.
     * The BROWSER binds the credential to this exact hostname. A phishing
       page on another domain cannot even ask for it, which is more than a
       password plus an emailed code can say.
     * The signature answers a challenge WE issued and spend exactly once,
       so a captured assertion is worth nothing a second time.
     * It is released only when the person present unlocks the device.

   WHAT THIS DELIBERATELY DOES NOT DO: verify attestation. Attestation says
   which make and model of authenticator generated the key, and checking it
   means shipping and maintaining a root certificate list in order to tell
   a doctor her phone is the wrong brand. Enrolment already happens inside
   a session she authenticated with a password, so the question attestation
   answers is not one we are asking. The registration request says
   `attestation: "none"` and we read the public key from the browser's own
   getPublicKey() - which is also why there is no CBOR decoder in here.

   THE PART THAT LOOKS LIKE PLUMBING AND IS NOT: an ES256 WebAuthn
   signature is DER-encoded and WebCrypto wants the raw r||s pair. Handing
   the DER straight to verify() does not throw - it returns false, for
   every correct signature, forever. A passkey that never works looks
   exactly like a passkey the user set up wrong.
   ========================================================================= */

import { ApiError, badRequest, newId, nowIso, unauthorised } from '@tharigopula/core/lib';

/* Five minutes is longer than anyone takes to touch a sensor and short
   enough that a challenge left in a log is worthless by the time it is
   read. */
const CHALLENGE_MINUTES = 5;

const ES256 = -7;
const RS256 = -257;
export const SUPPORTED_ALGORITHMS = [ES256, RS256];

/* ---------------- base64url, both directions ----------------
   WebAuthn speaks base64url everywhere and atob speaks base64. The two
   differ by three characters and the padding, which is exactly the kind of
   difference that works on most inputs and fails on some. */
export function fromBase64Url(value) {
  const normalised = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalised + '='.repeat((4 - (normalised.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function toBase64Url(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < view.length; i++) binary += String.fromCharCode(view[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const sha256 = async bytes =>
  new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));

/* Constant time, because this compares a hash of something an attacker
   controls against one they are trying to guess. */
function sameBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/* ---------------- the DER trap ----------------

   An ECDSA signature is two integers, r and s. WebAuthn delivers them
   DER-encoded: SEQUENCE { INTEGER r, INTEGER s }, where each INTEGER is
   minimally encoded and gains a leading zero byte whenever its top bit is
   set. WebCrypto's P-256 verify() wants exactly 64 bytes, r||s, each left
   padded to 32.

   Getting this wrong does not throw. verify() simply returns false, so
   every genuine fingerprint is rejected and the screen says the passkey
   did not work. */
export function derToRawEcdsa(der) {
  if (der.length === 64) return der;            /* already raw */
  if (der[0] !== 0x30) throw badRequest('That signature is not in a form we can read.');

  /* The SEQUENCE length may be one byte, or 0x81 followed by one byte. */
  let index = 1;
  if (der[index] & 0x80) index += 1 + (der[index] & 0x7f);
  else index += 1;

  const readInteger = () => {
    if (der[index] !== 0x02) throw badRequest('That signature is not in a form we can read.');
    index += 1;
    const length = der[index];
    index += 1;
    let value = der.slice(index, index + length);
    index += length;
    /* Drop DER's sign-padding zeros, then left-pad to the fixed width. */
    while (value.length > 32 && value[0] === 0x00) value = value.slice(1);
    if (value.length > 32) throw badRequest('That signature is not in a form we can read.');
    const padded = new Uint8Array(32);
    padded.set(value, 32 - value.length);
    return padded;
  };

  const r = readInteger();
  const s = readInteger();
  const raw = new Uint8Array(64);
  raw.set(r, 0);
  raw.set(s, 32);
  return raw;
}

async function importKey(spkiBytes, algorithm) {
  if (algorithm === ES256) {
    return crypto.subtle.importKey('spki', spkiBytes,
      { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  }
  if (algorithm === RS256) {
    return crypto.subtle.importKey('spki', spkiBytes,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  }
  throw badRequest('That device uses a signature type TCOS does not support.');
}

async function verifySignature(spkiBytes, algorithm, signature, signedBytes) {
  const key = await importKey(spkiBytes, algorithm);
  if (algorithm === ES256) {
    return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key,
      derToRawEcdsa(signature), signedBytes);
  }
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signedBytes);
}

/* ---------------- authenticatorData ----------------
   37 bytes at minimum: rpIdHash(32) | flags(1) | signCount(4). */
const FLAG_USER_PRESENT = 0x01;
const FLAG_USER_VERIFIED = 0x04;

export function readAuthenticatorData(bytes) {
  if (!bytes || bytes.length < 37) {
    throw badRequest('That device sent something TCOS could not read.');
  }
  const flags = bytes[32];
  return {
    rpIdHash: bytes.slice(0, 32),
    userPresent: !!(flags & FLAG_USER_PRESENT),
    userVerified: !!(flags & FLAG_USER_VERIFIED),
    signCount: new DataView(bytes.buffer, bytes.byteOffset + 33, 4).getUint32(0, false)
  };
}

/* ---------------- clientDataJSON ----------------
   Plain JSON, and the only place the browser tells us which origin it
   thought it was talking to. */
function readClientData(bytes, expected) {
  let parsed;
  try { parsed = JSON.parse(new TextDecoder().decode(bytes)); }
  catch (_) { throw badRequest('That device sent something TCOS could not read.'); }

  if (parsed.type !== expected.type) {
    throw badRequest('That request was made for something other than signing in.');
  }
  /* THE ORIGIN CHECK IS THE ANTI-PHISHING PROPERTY. Without it a signature
     collected by any other site would be accepted here. */
  if (parsed.origin !== expected.origin) {
    throw unauthorised('That passkey was used on a different address.');
  }
  if (parsed.crossOrigin === true) {
    throw unauthorised('A passkey cannot be used from inside another site.');
  }
  return parsed;
}

/* ---------------- challenges ---------------- */

export const challenges = {
  async issue(db, { scope, subject = null, purpose }) {
    const challenge = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    const expiresAt = new Date(Date.now() + CHALLENGE_MINUTES * 60000).toISOString();
    await db.prepare(
      `INSERT INTO webauthn_challenges (challenge, scope, subject, purpose, expires_at)
       VALUES (?,?,?,?,?)`
    ).bind(challenge, scope, subject, purpose, expiresAt).run();
    return { challenge, expiresAt };
  },

  /* Spend it. The UPDATE is the claim: `consumed_at IS NULL` in the WHERE
     means two requests racing with one challenge cannot both win, because
     only one of them changes a row. Checking and then updating would let
     both through. */
  async spend(db, { challenge, scope, purpose }) {
    const at = nowIso();
    const claimed = await db.prepare(
      `UPDATE webauthn_challenges SET consumed_at = ?
        WHERE challenge = ? AND scope = ? AND purpose = ?
          AND consumed_at IS NULL AND expires_at > ?`
    ).bind(at, challenge, scope, purpose, at).run();
    if (!claimed.meta || claimed.meta.changes !== 1) {
      throw unauthorised('That sign-in request has expired. Try again.');
    }
    return db.prepare('SELECT * FROM webauthn_challenges WHERE challenge = ?')
      .bind(challenge).first();
  },

  /* Old rows are litter, not a security problem - they are single-use and
     time-bound either way. Swept on a schedule rather than per request. */
  async sweep(db) {
    await db.prepare('DELETE FROM webauthn_challenges WHERE expires_at < ?')
      .bind(new Date(Date.now() - 3600000).toISOString()).run();
  }
};

/* ---------------- the credentials themselves ---------------- */

export const passkeys = {
  async list(db, scope, subject) {
    const { results } = await db.prepare(
      `SELECT id, label, created_at, last_used_at FROM webauthn_credentials
        WHERE scope = ? AND subject = ? AND revoked_at IS NULL
        ORDER BY created_at`
    ).bind(scope, subject).all();
    return results || [];
  },

  async byCredentialId(db, credentialId) {
    return db.prepare(
      `SELECT * FROM webauthn_credentials
        WHERE credential_id = ? AND revoked_at IS NULL`
    ).bind(credentialId).first();
  },

  async countFor(db, scope, subject) {
    const row = await db.prepare(
      `SELECT COUNT(*) AS n FROM webauthn_credentials
        WHERE scope = ? AND subject = ? AND revoked_at IS NULL`
    ).bind(scope, subject).first();
    return row ? row.n : 0;
  },

  async revoke(db, scope, subject, id) {
    const done = await db.prepare(
      `UPDATE webauthn_credentials SET revoked_at = ?
        WHERE id = ? AND scope = ? AND subject = ? AND revoked_at IS NULL`
    ).bind(nowIso(), id, scope, subject).run();
    if (!done.meta || done.meta.changes !== 1) {
      throw new ApiError(404, 'not_found', 'That device is not on your list.');
    }
  },

  /* ---- enrolment ----

     Runs inside a session the person already authenticated. We check that
     the ceremony answers our challenge and happened on our origin, and
     take the public key from the browser. */
  async register(db, {
    scope, subject, origin, rpId, label,
    challenge, clientDataJSON, publicKey, algorithm, credentialId
  }) {
    if (!credentialId || !publicKey) throw badRequest('That device did not complete setup.');
    if (!SUPPORTED_ALGORITHMS.includes(Number(algorithm))) {
      throw badRequest('That device uses a signature type TCOS does not support.');
    }

    const clientData = readClientData(fromBase64Url(clientDataJSON),
      { type: 'webauthn.create', origin });

    const row = await challenges.spend(db, { challenge, scope, purpose: 'register' });
    if (clientData.challenge !== row.challenge) {
      throw unauthorised('That sign-in request has expired. Try again.');
    }
    if (row.subject !== subject) {
      throw unauthorised('That setup request was for a different account.');
    }

    /* The SPKI must actually import, or we would store a key that cannot
       verify anything and only find out when he tries to sign in. */
    const spki = fromBase64Url(publicKey);
    await importKey(spki, Number(algorithm));

    const existing = await this.byCredentialId(db, credentialId);
    if (existing) throw badRequest('That device is already set up.');

    const id = newId('pk');
    await db.prepare(
      `INSERT INTO webauthn_credentials
         (id, credential_id, scope, subject, public_key, algorithm, label)
       VALUES (?,?,?,?,?,?,?)`
    ).bind(id, credentialId, scope, subject, publicKey, Number(algorithm),
      String(label || '').slice(0, 60) || 'This device').run();

    /* rpId is not stored: the browser enforces it, and a credential that
       was registered for another one cannot be offered here at all. */
    void rpId;
    return { id, label: label || 'This device' };
  },

  /* ---- signing in ----

     Everything here is a reason to refuse. The happy path is the last line. */
  async authenticate(db, {
    scope, origin, rpId, challenge, credentialId,
    clientDataJSON, authenticatorData, signature
  }) {
    const stored = await this.byCredentialId(db, credentialId);
    /* Deliberately the same message as a bad signature: which credential
       ids exist is not something this endpoint should answer. */
    const no = () => { throw unauthorised('That passkey was not recognised.'); };
    if (!stored || stored.scope !== scope) no();

    const clientData = readClientData(fromBase64Url(clientDataJSON),
      { type: 'webauthn.get', origin });

    const row = await challenges.spend(db, { challenge, scope, purpose: 'authenticate' });
    if (clientData.challenge !== row.challenge) {
      throw unauthorised('That sign-in request has expired. Try again.');
    }

    const authBytes = fromBase64Url(authenticatorData);
    const auth = readAuthenticatorData(authBytes);

    /* The browser already refuses to release a credential to the wrong
       site. This is the server declining to take that on trust. */
    if (!sameBytes(auth.rpIdHash, await sha256(new TextEncoder().encode(rpId)))) no();

    if (!auth.userPresent) throw unauthorised('Nobody confirmed that sign-in on the device.');
    /* USER VERIFIED IS THE WHOLE POINT. Without it this proves the device
       was present, not that he was - which is what a fingerprint is for. */
    if (!auth.userVerified) {
      throw unauthorised('Unlock the device with your fingerprint, face or PIN to sign in.');
    }

    /* A counter that fails to advance is how a cloned authenticator gives
       itself away. Many phones report 0 and never move it, which is
       allowed - so this only applies once a device has shown a real one. */
    if (stored.sign_count > 0 && auth.signCount > 0 && auth.signCount <= stored.sign_count) {
      throw unauthorised('That passkey looks like a copy. Set it up again on this device.');
    }

    const signed = new Uint8Array(authBytes.length + 32);
    signed.set(authBytes, 0);
    signed.set(await sha256(fromBase64Url(clientDataJSON)), authBytes.length);

    const ok = await verifySignature(fromBase64Url(stored.public_key),
      stored.algorithm, fromBase64Url(signature), signed);
    if (!ok) no();

    await db.prepare(
      `UPDATE webauthn_credentials SET sign_count = ?, last_used_at = ? WHERE id = ?`
    ).bind(Math.max(auth.signCount, stored.sign_count), nowIso(), stored.id).run();

    return { subject: stored.subject, credentialId: stored.credential_id, id: stored.id };
  }
};

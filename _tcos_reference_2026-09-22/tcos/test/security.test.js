/* Production access controls: privacy-preserving edge throttles and session
   invalidation when credentials change. */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import {
  privateRateKey, enforceRateLimit, enforceSourceRateLimit, authThrottle
} from '@tharigopula/core/auth';
import { challengeConfig, verifyTurnstile } from '../worker/turnstile.js';
import { doctors } from '../worker/repo.js';
import { staff } from '../worker/staff.js';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

console.log('\nRate-limit identifiers stay private\n');

const mobile = '+919000000001';
const key = await privateRateKey('clinic_signin', mobile);
check('a limiter key is a fixed SHA-256 digest', /^[a-f0-9]{64}$/.test(key), key);
check('the submitted mobile is not present in the key', !key.includes(mobile), key);
check('normalisation is stable for casing and whitespace',
  await privateRateKey('admin', '  OWNER@TCOS.DEMO ') ===
  await privateRateKey('admin', 'owner@tcos.demo'));
check('the route purpose separates otherwise-identical identifiers',
  await privateRateKey('signin', mobile) !== await privateRateKey('reset', mobile));

let receivedKey = null;
const allowedEnv = {
  AUTH_RATE_LIMITER: {
    async limit({ key: candidate }) { receivedKey = candidate; return { success: true }; }
  }
};
const allowed = await enforceRateLimit(allowedEnv, 'AUTH_RATE_LIMITER', {
  scope: 'clinic_signin', subject: mobile
});
check('a configured limiter is called and may allow the request',
  allowed.configured === true && allowed.allowed === true && receivedKey === key);
check('an omitted local binding degrades cleanly for offline development',
  (await enforceRateLimit({}, 'AUTH_RATE_LIMITER', {
    scope: 'clinic_signin', subject: mobile
  })).configured === false);

const oldWarn = console.warn;
console.warn = () => {};
let rejected = null;
try {
  await enforceRateLimit({ AUTH_RATE_LIMITER: { limit: async () => ({ success: false }) } },
    'AUTH_RATE_LIMITER', { scope: 'clinic_signin', subject: mobile });
} catch (error) { rejected = error; }
console.warn = oldWarn;
check('a rejected request receives an explicit 429',
  rejected && rejected.status === 429 && rejected.code === 'too_many');
check('the response tells a browser when to retry',
  rejected && rejected.headers && rejected.headers['Retry-After'] === '60');

const oldError = console.error;
console.error = () => {};
const degraded = await enforceRateLimit({
  AUTH_RATE_LIMITER: { limit: async () => { throw new Error('edge unavailable'); } }
}, 'AUTH_RATE_LIMITER', { scope: 'clinic_signin', subject: mobile });
console.error = oldError;
check('a provider failure preserves clinic availability and is marked degraded',
  degraded.allowed === true && degraded.degraded === true);

let sourceKey = null;
await enforceSourceRateLimit({
  AUTH_RATE_LIMITER: {
    limit: async ({ key: candidate }) => { sourceKey = candidate; return { success: true }; }
  }
}, 'AUTH_RATE_LIMITER', new Request('https://api.example', {
  headers: { 'CF-Connecting-IP': '203.0.113.9' }
}), { scope: 'clinic_signin' });
check('cross-identifier spraying is bounded by a second digested source key',
  /^[a-f0-9]{64}$/.test(sourceKey) && !sourceKey.includes('203.0.113.9'));
check('a missing edge address does not become one global shared key',
  (await enforceSourceRateLimit(allowedEnv, 'AUTH_RATE_LIMITER',
    new Request('https://api.example'), { scope: 'clinic_signin' })).skipped === true);

console.log('\nTurnstile is verified on the server\n');

check('disabled rollout exposes no site key',
  challengeConfig({ TURNSTILE_ENFORCE: 'false', TURNSTILE_SITE_KEY: 'public' }).siteKey === null);
check('enabled rollout exposes only the public site key',
  JSON.stringify(challengeConfig({
    TURNSTILE_ENFORCE: 'true', TURNSTILE_SITE_KEY: 'public', TURNSTILE_SECRET_KEY: 'private'
  })) === JSON.stringify({ enabled: true, siteKey: 'public' }));

const turnstileEnv = {
  TURNSTILE_ENFORCE: 'true', TURNSTILE_SITE_KEY: 'public',
  TURNSTILE_SECRET_KEY: 'private', APP_ORIGIN: 'https://tcos-staging.pages.dev',
  ADMIN_ORIGIN: 'https://admin.tcos.tharigopula.com'
};
const turnstileRequest = new Request('https://api.example/auth/signin', {
  headers: { 'CF-Connecting-IP': '203.0.113.9' }
});
const originalFetch = globalThis.fetch;
let verificationForm = null;
globalThis.fetch = async (_url, init) => {
  verificationForm = init.body;
  return new Response(JSON.stringify({
    success: true, action: 'clinic_signin', hostname: 'tcos-staging.pages.dev'
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
const verified = await verifyTurnstile(turnstileEnv, turnstileRequest, {
  token: 'browser-token', action: 'clinic_signin'
});
check('a valid token, action and hostname are accepted', verified.verified === true);
check('Siteverify receives the secret, browser token and remote address',
  verificationForm.get('secret') === 'private' &&
  verificationForm.get('response') === 'browser-token' &&
  verificationForm.get('remoteip') === '203.0.113.9');

globalThis.fetch = async () => new Response(JSON.stringify({
  success: true, action: 'platform_signin', hostname: 'admin.tcos.tharigopula.com'
}), { status: 200, headers: { 'Content-Type': 'application/json' } });
const adminVerified = await verifyTurnstile(turnstileEnv, turnstileRequest, {
  token: 'admin-browser-token', action: 'platform_signin'
});
check('platform challenges are bound to the dedicated admin hostname',
  adminVerified.verified === true);

const oldTurnstileWarn = console.warn;
console.warn = () => {};
globalThis.fetch = async () => new Response(JSON.stringify({
  success: true, action: 'doctor_application', hostname: 'tcos-staging.pages.dev'
}), { status: 200, headers: { 'Content-Type': 'application/json' } });
let wrongAction = null;
try {
  await verifyTurnstile(turnstileEnv, turnstileRequest, {
    token: 'token-for-another-form', action: 'clinic_signin'
  });
} catch (error) { wrongAction = error; }
console.warn = oldTurnstileWarn;
globalThis.fetch = originalFetch;
check('a token solved for a different action is rejected',
  wrongAction && wrongAction.status === 400);

let missingToken = null;
try {
  await verifyTurnstile(turnstileEnv, turnstileRequest, {
    token: null, action: 'clinic_signin'
  });
} catch (error) { missingToken = error; }
check('an enabled form cannot omit its challenge token',
  missingToken && missingToken.status === 400);

console.log('\nCredential changes end old sessions atomically\n');

const sqlite = new DatabaseSync(':memory:');
sqlite.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE doctors (
    id TEXT PRIMARY KEY, password_hash TEXT, password_salt TEXT,
    must_change_password INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE clinic_users (
    id TEXT PRIMARY KEY, doctor_id TEXT NOT NULL, full_name TEXT NOT NULL,
    password_hash TEXT, password_salt TEXT,
    must_change_password INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY, doctor_id TEXT NOT NULL, user_id TEXT,
    expires_at TEXT NOT NULL, user_agent TEXT, revoked_at TEXT, csrf_hash TEXT
  );
  INSERT INTO doctors VALUES ('doc_a','old-owner','salt',0), ('doc_b','other','salt',0);
  INSERT INTO clinic_users VALUES
    ('usr_a','doc_a','Asha','old-staff','salt',0),
    ('usr_b','doc_a','Bina','other-staff','salt',0);
  INSERT INTO sessions (token_hash,doctor_id,user_id,expires_at) VALUES
    ('owner_a','doc_a',NULL,'2099-01-01'),
    ('staff_a','doc_a','usr_a','2099-01-01'),
    ('staff_b','doc_a','usr_b','2099-01-01'),
    ('owner_b','doc_b',NULL,'2099-01-01');
`);
sqlite.exec(readFileSync('migrations/046-auth-throttles.sql', 'utf8'));

class Statement {
  constructor(sql, args = []) { this.sql = sql; this.args = args; }
  bind(...args) { return new Statement(this.sql, args); }
  async first() { return sqlite.prepare(this.sql).get(...this.args) || null; }
  async all() { return { results: sqlite.prepare(this.sql).all(...this.args) }; }
  async run() {
    const result = sqlite.prepare(this.sql).run(...this.args);
    return { meta: { changes: Number(result.changes || 0) } };
  }
}
const db = {
  prepare: sql => new Statement(sql),
  async batch(statements) {
    sqlite.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      sqlite.exec('COMMIT');
      return results;
    } catch (error) {
      sqlite.exec('ROLLBACK');
      throw error;
    }
  }
};

await doctors.setPassword(db, 'doc_a', 'new-owner', 'new-salt');
check('changing the owner password revokes every owner session for that clinic',
  !!sqlite.prepare("SELECT revoked_at FROM sessions WHERE token_hash='owner_a'").get().revoked_at);
check('the owner password change does not sign clinic staff out',
  sqlite.prepare("SELECT revoked_at FROM sessions WHERE token_hash='staff_a'").get().revoked_at === null);
check('another clinic is never affected',
  sqlite.prepare("SELECT revoked_at FROM sessions WHERE token_hash='owner_b'").get().revoked_at === null);

await staff.resetPassword(db, 'doc_a', 'usr_a', 'temporary', 'next-salt');
const resetUser = sqlite.prepare("SELECT * FROM clinic_users WHERE id='usr_a'").get();
check('a staff reset requires first-sign-in replacement and ends old sessions',
  resetUser.password_hash === 'temporary' && resetUser.must_change_password === 1 &&
  !!sqlite.prepare("SELECT revoked_at FROM sessions WHERE token_hash='staff_a'").get().revoked_at);
check('a staff reset does not revoke another staff member',
  sqlite.prepare("SELECT revoked_at FROM sessions WHERE token_hash='staff_b'").get().revoked_at === null);

/* Prove the password and revocation are one transaction, not merely two
   operations that normally both happen. */
sqlite.exec(`
  INSERT INTO sessions (token_hash,doctor_id,user_id,expires_at)
    VALUES ('owner_atomic','doc_a',NULL,'2099-01-01');
  CREATE TRIGGER refuse_owner_revoke BEFORE UPDATE OF revoked_at ON sessions
    WHEN OLD.token_hash = 'owner_atomic'
    BEGIN SELECT RAISE(ABORT, 'forced revocation failure'); END;
`);
let atomicFailure = null;
try { await doctors.setPassword(db, 'doc_a', 'must-not-stick', 'bad-salt'); }
catch (error) { atomicFailure = error; }
check('a revocation failure rolls the password change back',
  atomicFailure &&
  sqlite.prepare("SELECT password_hash FROM doctors WHERE id='doc_a'").get().password_hash === 'new-owner');

console.log('\nExact failed-credential backstop\n');

const attemptRequest = new Request('https://api.example/auth/signin', {
  headers: { 'CF-Connecting-IP': '203.0.113.15' }
});
const attempt = { scope: 'clinic_signin', subject: '+919000000001',
  message: 'Wait and retry.' };
for (let i = 0; i < 4; i++) {
  await authThrottle.check(db, attemptRequest, attempt);
  await authThrottle.failure(db, attemptRequest, attempt);
}
check('four failed credentials do not yet lock a legitimate retry out',
  sqlite.prepare("SELECT failures FROM auth_throttles WHERE scope='clinic_signin'").get().failures === 4);

const oldBlockWarn = console.warn;
console.warn = () => {};
let fifthFailure = null;
try { await authThrottle.failure(db, attemptRequest, attempt); }
catch (error) { fifthFailure = error; }
console.warn = oldBlockWarn;
check('the fifth failure is blocked exactly, independent of edge approximation',
  fifthFailure && fifthFailure.status === 429 && Number(fifthFailure.headers['Retry-After']) > 0);

let stillBlocked = null;
try { await authThrottle.check(db, attemptRequest, attempt); }
catch (error) { stillBlocked = error; }
check('the same identifier and connection stay blocked during cooldown',
  stillBlocked && stillBlocked.status === 429);

const otherSource = new Request('https://api.example/auth/signin', {
  headers: { 'CF-Connecting-IP': '203.0.113.16' }
});
let otherAllowed = true;
try { await authThrottle.check(db, otherSource, attempt); }
catch (_) { otherAllowed = false; }
check('an attacker cannot lock the account out from a different connection', otherAllowed);

await authThrottle.failure(db, otherSource, attempt);
await authThrottle.clear(db, otherSource, attempt);
check('a successful sign-in clears only its exact failure history',
  sqlite.prepare("SELECT COUNT(*) n FROM auth_throttles WHERE scope='clinic_signin'").get().n === 1);

sqlite.prepare("UPDATE auth_throttles SET updated_at='2020-01-01'").run();
check('the nightly retention sweep removes expired throttle metadata',
  await authThrottle.sweep(db) === 1 &&
  sqlite.prepare('SELECT COUNT(*) n FROM auth_throttles').get().n === 0);

const privacyDb = new DatabaseSync(':memory:');
privacyDb.exec(`
  CREATE TABLE appointment_requests (
    id TEXT PRIMARY KEY, doctor_id TEXT NOT NULL, full_name TEXT NOT NULL,
    mobile TEXT NOT NULL, source_ip TEXT
  );
  INSERT INTO appointment_requests
    (id,doctor_id,full_name,mobile,source_ip)
    VALUES ('req_privacy','doc_privacy','Patient','9111111111','203.0.113.9');
`);
privacyDb.exec(readFileSync('migrations/045-access-security.sql', 'utf8'));
check('migration 045 removes previously retained appointment source addresses',
  privacyDb.prepare("SELECT source_ip FROM appointment_requests WHERE id='req_privacy'")
    .get().source_ip === null);

console.log('\nConfiguration and route coverage\n');

const config = readFileSync('wrangler.jsonc', 'utf8');
const router = readFileSync('worker/index.js', 'utf8');
check('production and staging both declare all three independent limiters',
  (config.match(/"name": "AUTH_RATE_LIMITER"/g) || []).length === 2 &&
  (config.match(/"name": "ADMIN_AUTH_RATE_LIMITER"/g) || []).length === 2 &&
  (config.match(/"name": "PUBLIC_RATE_LIMITER"/g) || []).length === 2);
check('sign-in, reset, admin access, applications and public bookings are covered',
  (router.match(/enforceRateLimit\(/g) || []).length >= 7 &&
  (router.match(/enforceSourceRateLimit\(/g) || []).length >= 7);
check('clinic and admin credential checks use the exact D1 backstop',
  (router.match(/authThrottle\.check\(/g) || []).length === 3 &&
  (router.match(/authThrottle\.failure\(/g) || []).length === 3 &&
  /authThrottle\.sweep\(env\.DB\)/.test(router));
check('unknown accounts perform password work before their generic rejection',
  /00000000000000000000000000000000/.test(router) &&
  /00000000000000000000000000000000/.test(readFileSync('worker/platform.js', 'utf8')));
/* A DOCTOR'S RESET NOW SENDS THE CODE TO HER EMAIL, AND THE REPLY MUST NOT
   SAY SO BY NAME.
 *
   Returning the account's masked address would tell whoever typed the
   number two things this route exists to withhold: that an account is
   there, and part of the address on it. That is the account discovery the
   generic answer prevents, reintroduced through the success reply instead
   of the error. So the mobile branch answers with a fixed phrase, and the
   address is never in the body. */
const resetStart = /'POST \/auth\/reset\/start'[\s\S]*?\n  \},/.exec(router);
check('the reset route was found to read', !!resetStart);
const resetBody = resetStart ? resetStart[0] : '';
check('a mobile reset is delivered to the email on the account',
  /deliverTo\s*=\s*channel === 'sms' && doctor && doctor\.email/.test(resetBody),
  'the whole point of the change');
check('THE REPLY NEVER CARRIES THE ACCOUNT\'S OWN EMAIL ADDRESS',
  !/sentTo:\s*maskIdentifier\(\s*doctor\./.test(resetBody) &&
  !/doctor\.email/.test(resetBody.split('return json')[1] || ''),
  'the success reply would say whether the account exists, and to whom');
check('and the mobile branch answers with a fixed phrase instead',
  /sentTo:\s*null/.test(resetBody) && /where:/.test(resetBody));

check('429 responses preserve Retry-After metadata',
  /\.\.\.\(error\.headers \|\| \{\}\)/.test(router));
check('server verification covers all seven TCOS-owned account forms',
  (router.match(/verifyTurnstile\(/g) || []).length === 7);

const loginPage = readFileSync('tcos-login.html', 'utf8');
const adminPage = readFileSync('admin.html', 'utf8');
/* The application form moved off the landing page onto its own page on
   20 Sep 2026 - Vijay: "keep each button a different page". The challenge
   went with it, and this assertion has to follow or it proves nothing. */
const landingPage = readFileSync('apply.html', 'utf8');
const publicPageSource = readFileSync('worker/publicpage.js', 'utf8');
check('doctor sign-in, reset, application and admin forms render challenges',
  loginPage.includes('signInChallenge') && loginPage.includes('resetChallenge') &&
  landingPage.includes('applicationChallenge') && adminPage.includes('adminSignInChallenge') &&
  adminPage.includes('adminRecoveryChallenge') && adminPage.includes('adminReauthChallenge'));
check('the sign-in message helper no longer inserts server text as HTML',
  /notice\.textContent = text/.test(loginPage) &&
  !/Welcome back, <b>/.test(loginPage));
check('public booking no longer retains a raw network address it never uses',
  !/details\.note \|\| null, ip/.test(publicPageSource) &&
  !/source_ip/.test(publicPageSource));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);

/* Browser-session and platform-console perimeter tests. These are separate
   from credential throttling because cookies, CSRF and Cloudflare Access are
   one boundary: weakening any one of them changes the meaning of the rest. */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import {
  generateKeyPair, exportJWK, createLocalJWKSet, SignJWT
} from 'jose';
import {
  CLINIC_SESSION_COOKIE, ADMIN_SESSION_COOKIE, sessionCredential,
  newCsrfToken, requireCookieCsrf, sessionCookie, clearSessionCookie
} from '../worker/session-security.js';
import { sha256 } from '@tharigopula/core/lib';
import { verifyPlatformAccess } from '@tharigopula/core/auth';
import { adminSessions, requireFreshAdmin, team } from '../worker/platform.js';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};
const rejection = async fn => {
  try { await fn(); return null; } catch (error) { return error; }
};

console.log('\nHost-only browser sessions\n');

const cookieRequest = new Request('https://staging.tcos.tharigopula.com/me', {
  headers: {
    Authorization: 'Bearer readable-legacy-token',
    Cookie: 'theme=light; ' + CLINIC_SESSION_COOKIE + '=cookie%20token'
  }
});
check('staging ignores a browser-readable bearer credential',
  sessionCredential(cookieRequest, CLINIC_SESSION_COOKIE,
    { COOKIE_AUTH_ENFORCE: 'true' }).token === 'cookie token' &&
  sessionCredential(cookieRequest, CLINIC_SESSION_COOKIE,
    { COOKIE_AUTH_ENFORCE: 'true' }).mode === 'cookie');
check('the compatibility mode still accepts the legacy bearer first',
  sessionCredential(cookieRequest, CLINIC_SESSION_COOKIE,
    { COOKIE_AUTH_ENFORCE: 'false' }).token === 'readable-legacy-token');
check('a missing cookie cannot be replaced by bearer when enforcement is on',
  sessionCredential(new Request('https://example.test', {
    headers: { Authorization: 'Bearer legacy' }
  }), CLINIC_SESSION_COOKIE, { COOKIE_AUTH_ENFORCE: 'true' }) === null);
check('production can enforce the owner cookie without breaking doctor compatibility',
  sessionCredential(cookieRequest, ADMIN_SESSION_COOKIE, {
    COOKIE_AUTH_ENFORCE: 'false', ADMIN_COOKIE_AUTH_ENFORCE: 'true'
  }) === null &&
  sessionCredential(cookieRequest, CLINIC_SESSION_COOKIE, {
    COOKIE_AUTH_ENFORCE: 'false', ADMIN_COOKIE_AUTH_ENFORCE: 'true'
  }).mode === 'bearer');

const issued = sessionCookie(ADMIN_SESSION_COOKIE, 'opaque token', 12);
check('issued cookies are host-only, HttpOnly, Secure and Strict',
  issued.startsWith('__Host-tcos-admin-session=opaque%20token; Path=/;') &&
  issued.includes('HttpOnly') && issued.includes('Secure') &&
  issued.includes('SameSite=Strict') && !/Domain=/i.test(issued));
const cleared = clearSessionCookie(ADMIN_SESSION_COOKIE);
check('sign-out expires the same protected cookie',
  cleared.startsWith('__Host-tcos-admin-session=; Path=/; Max-Age=0;') &&
  cleared.includes('HttpOnly') && cleared.includes('Secure'));

console.log('\nCookie requests require an exact-origin CSRF proof\n');

const csrf = newCsrfToken();
const csrfHash = await sha256(csrf);
const env = {
  APP_ORIGIN: 'https://tcos.pages.dev',
  ADMIN_ORIGIN: 'https://admin.tcos.tharigopula.com'
};
const credential = { token: 'cookie', mode: 'cookie' };
const validPost = new Request(env.APP_ORIGIN + '/patients', {
  method: 'POST', headers: { Origin: env.APP_ORIGIN, 'X-CSRF-Token': csrf }
});
check('the matching origin and CSRF token are accepted',
  await requireCookieCsrf(env, validPost, credential, csrfHash) === undefined);
check('safe reads need no CSRF token',
  await requireCookieCsrf(env, new Request(env.APP_ORIGIN + '/me'), credential, csrfHash) === undefined);
const missingOrigin = await rejection(() => requireCookieCsrf(env,
  new Request(env.APP_ORIGIN + '/patients', {
    method: 'POST', headers: { 'X-CSRF-Token': csrf }
  }), credential, csrfHash));
check('an unsafe request without Origin is rejected',
  missingOrigin && missingOrigin.status === 403 && missingOrigin.code === 'csrf_failed');
const wrongOrigin = await rejection(() => requireCookieCsrf(env,
  new Request(env.APP_ORIGIN + '/patients', {
    method: 'POST', headers: { Origin: 'https://evil.example', 'X-CSRF-Token': csrf }
  }), credential, csrfHash));
check('an unsafe cross-origin request is rejected',
  wrongOrigin && wrongOrigin.status === 403 && wrongOrigin.code === 'csrf_failed');
const wrongToken = await rejection(() => requireCookieCsrf(env,
  new Request(env.APP_ORIGIN + '/patients', {
    method: 'POST', headers: { Origin: env.APP_ORIGIN, 'X-CSRF-Token': 'wrong' }
  }), credential, csrfHash));
check('a mismatched CSRF token is rejected',
  wrongToken && wrongToken.status === 403 && wrongToken.code === 'csrf_failed');
const csrfAdminPost = new Request(env.ADMIN_ORIGIN + '/admin/team', {
  method: 'POST', headers: { Origin: env.ADMIN_ORIGIN, 'X-CSRF-Token': csrf }
});
check('the owner console uses its own exact origin for CSRF',
  await requireCookieCsrf(env, csrfAdminPost, credential, csrfHash) === undefined);
const adminFromClinicOrigin = await rejection(() => requireCookieCsrf(env,
  new Request(env.ADMIN_ORIGIN + '/admin/team', {
    method: 'POST', headers: { Origin: env.APP_ORIGIN, 'X-CSRF-Token': csrf }
  }), credential, csrfHash));
check('the public app origin cannot submit an owner-console change',
  adminFromClinicOrigin && adminFromClinicOrigin.status === 403);

console.log('\nMigrations 047 and 048 upgrade both browser boundaries\n');

const sqlite = new DatabaseSync(':memory:');
sqlite.exec(`
  CREATE TABLE sessions (token_hash TEXT PRIMARY KEY);
  CREATE TABLE platform_team (
    email TEXT PRIMARY KEY, full_name TEXT, role TEXT,
    password_hash TEXT, password_salt TEXT,
    added_at TEXT DEFAULT (datetime('now')), last_sign_in_at TEXT,
    removed_at TEXT, must_change_password INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE admin_sessions (
    token_hash TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    user_agent TEXT,
    revoked_at TEXT
  );
`);
sqlite.exec(readFileSync('migrations/047-secure-browser-sessions.sql', 'utf8'));
sqlite.exec(readFileSync('migrations/048-admin-reauthentication.sql', 'utf8'));
const columns = table => sqlite.prepare('PRAGMA table_info(' + table + ')').all().map(row => row.name);
check('clinic sessions gain only a hash of the CSRF value', columns('sessions').includes('csrf_hash'));
check('admin sessions gain only a hash of the CSRF value', columns('admin_sessions').includes('csrf_hash'));
check('admin sessions gain a separate recent-password timestamp',
  columns('admin_sessions').includes('reauthenticated_at'));

class D1Statement {
  constructor(sql, args = []) { this.sql = sql; this.args = args; }
  bind(...args) { return new D1Statement(this.sql, args); }
  async first() { return sqlite.prepare(this.sql).get(...this.args) || null; }
  async all() { return { results: sqlite.prepare(this.sql).all(...this.args) }; }
  async run() {
    const result = sqlite.prepare(this.sql).run(...this.args);
    return { meta: { changes: Number(result.changes || 0) } };
  }
}
const d1 = {
  prepare: sql => new D1Statement(sql),
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
sqlite.prepare(
  `INSERT INTO platform_team (email, full_name, role)
   VALUES (?,?,?)`
).run('owner@tcos.demo', 'Owner', 'owner');
const adminToken = 'opaque-admin-session';
const adminCsrf = 'admin-csrf';
await adminSessions.create(d1, 'owner@tcos.demo', await sha256(adminToken),
  8, 'test', await sha256(adminCsrf));
const adminEnv = {
  DB: d1, APP_ORIGIN: 'https://staging.tcos.tharigopula.com',
  COOKIE_AUTH_ENFORCE: 'true', ADMIN_REAUTH_MINUTES: '5'
};
const adminPost = () => new Request(adminEnv.APP_ORIGIN + '/admin/team', {
  method: 'POST', headers: {
    Cookie: ADMIN_SESSION_COOKIE + '=' + adminToken,
    Origin: adminEnv.APP_ORIGIN, 'X-CSRF-Token': adminCsrf
  }
});
check('a just-authenticated owner may perform a protected change',
  (await requireFreshAdmin(adminEnv, adminPost(), 'admin')).email === 'owner@tcos.demo');
sqlite.prepare('UPDATE admin_sessions SET reauthenticated_at = ?')
  .run('2020-01-01T00:00:00.000Z');
const staleAdmin = await rejection(() =>
  requireFreshAdmin(adminEnv, adminPost(), 'admin'));
check('an old password proof is refused with a specific step-up response',
  staleAdmin && staleAdmin.status === 403 && staleAdmin.code === 'reauth_required');
await adminSessions.markReauthenticated(d1, await sha256(adminToken));
check('re-entering the password refreshes only that session',
  (await requireFreshAdmin(adminEnv, adminPost(), 'admin')).email === 'owner@tcos.demo');

await team.recoverOwner(d1, { PEPPER: 'test-pepper' },
  'hello.tharigopula@gmail.com', 'A-long-owner-password', 'Vijay Tharigopula');
const recoveredOwner = sqlite.prepare(
  'SELECT role, password_hash, password_salt FROM platform_team WHERE email = ?'
).get('hello.tharigopula@gmail.com');
check('recovery provisions only the configured owner with a one-way credential',
  recoveredOwner.role === 'owner' && recoveredOwner.password_hash &&
  recoveredOwner.password_salt &&
  recoveredOwner.password_hash !== 'A-long-owner-password');

console.log('\nCloudflare Access is an independently verified outer door\n');

check('Access disabled remains a deliberate local-development no-op',
  await verifyPlatformAccess({}, new Request('https://example.test/admin')) === null);
const missingConfig = await rejection(() => verifyPlatformAccess(
  { ACCESS_ENFORCE: 'true' }, new Request('https://example.test/admin')));
check('enforcement fails closed when its audience is not configured',
  missingConfig && missingConfig.status === 503 && missingConfig.code === 'access_misconfigured');

const accessEnv = {
  ACCESS_ENFORCE: 'true', ACCESS_TEAM_DOMAIN: 'team.cloudflareaccess.com',
  ACCESS_AUD: 'tcos-staging-audience'
};
const noAssertion = await rejection(() => verifyPlatformAccess(
  accessEnv, new Request('https://example.test/admin')));
check('an unprotected Worker hostname has no assertion and is rejected',
  noAssertion && noAssertion.status === 401 && noAssertion.code === 'platform_access_required');

const { publicKey, privateKey } = await generateKeyPair('RS256');
const jwk = await exportJWK(publicKey);
jwk.kid = 'access-test-key';
jwk.alg = 'RS256';
const keySet = createLocalJWKSet({ keys: [jwk] });
const assertion = await new SignJWT({ email: 'Owner@TCOS.Demo' })
  .setProtectedHeader({ alg: 'RS256', kid: jwk.kid })
  .setIssuer('https://' + accessEnv.ACCESS_TEAM_DOMAIN)
  .setAudience(accessEnv.ACCESS_AUD)
  .setSubject('owner-id')
  .setIssuedAt()
  .setExpirationTime('5m')
  .sign(privateKey);
const verified = await verifyPlatformAccess(accessEnv,
  new Request('https://example.test/admin', {
    headers: { 'Cf-Access-Jwt-Assertion': assertion }
  }), keySet);
check('a signed assertion returns a normalised operator identity',
  verified.email === 'owner@tcos.demo' && verified.subject === 'owner-id');

const wrongAudienceToken = await new SignJWT({ email: 'owner@tcos.demo' })
  .setProtectedHeader({ alg: 'RS256', kid: jwk.kid })
  .setIssuer('https://' + accessEnv.ACCESS_TEAM_DOMAIN)
  .setAudience('another-application')
  .setIssuedAt().setExpirationTime('5m').sign(privateKey);
const oldWarn = console.warn;
console.warn = () => {};
const wrongAudience = await rejection(() => verifyPlatformAccess(accessEnv,
  new Request('https://example.test/admin', {
    headers: { 'Cf-Access-Jwt-Assertion': wrongAudienceToken }
  }), keySet));
console.warn = oldWarn;
check('an assertion for another Access application is rejected',
  wrongAudience && wrongAudience.status === 401);

console.log('\nConfiguration and browser-client coverage\n');

const config = readFileSync('wrangler.jsonc', 'utf8');
const router = readFileSync('worker/index.js', 'utf8');
const clinicClient = readFileSync('js/tcos-api.js', 'utf8');
const adminClient = readFileSync('js/tcos-admin-api.js', 'utf8');
const adminConsole = readFileSync('js/tcos-admin-console.js', 'utf8');
const adminHtml = readFileSync('admin.html', 'utf8');
check('staging has one same-origin custom domain and enforced cookie mode',
  config.includes('"pattern": "staging.tcos.tharigopula.com"') &&
  config.includes('"custom_domain": true') &&
  config.includes('"COOKIE_AUTH_ENFORCE": "true"') &&
  config.includes('"ACCESS_ENFORCE": "true"') &&
  config.includes('"ACCESS_TEAM_DOMAIN": "tharigopula.cloudflareaccess.com"'));
/* THE CONSOLE MOVED HOSTNAME on 20 Sep 2026, and Access was turned off.
 *
   Vijay, from his phone, on the fourth report of being unable to sign in:
   "no passkeys available - there arent any passkeys for
   tharigopula.cloudflareaccess.com on this device ... i can login with my
   tab or laptop or pc or mobile, my wish. what happens if the pc is lost
   or not working, i do nothing right?"
 *
   Cloudflare Access guards admin.tcos.tharigopula.com at the EDGE, so no
   Worker setting can lift it, and its login had begun demanding a passkey
   that device did not hold. The console answers on an address Access was
   never put in front of. What still has to hold is that the page and its
   API remain ONE origin - that is what makes the host-only cookie
   possible, and it is the property this assertion was always about. */
/* THE PROPERTY THAT MATTERS is that the console page and the console API
   answer on ONE origin. That is what lets the session be a host-only
   HttpOnly cookie and what makes the CSRF origin check meaningful. WHICH
   hostname that is has now changed twice and may change again - so this
   asserts the invariant, not the name.

   console.tharigopula.com was the intent. Cloudflare accepted the custom
   domain and never published its DNS: twenty minutes and a second triggers
   deploy later, 1.1.1.1 still said NXDOMAIN while the other two custom
   domains on the same zone resolved fine. Vijay had already lost days to a
   sign-in he could not reach, so the console moved to a hostname that
   answers today. */
const adminOriginInConfig = /"ADMIN_ORIGIN": "https:\/\/([^"]+)"/.exec(config);
const adminHostInClient = /const PRODUCTION_ADMIN_HOST = '([^']+)'/.exec(adminClient);
check('the config names one console origin', !!adminOriginInConfig);
check('and the client names one console host', !!adminHostInClient);
check('THE PAGE AND THE API ARE THE SAME ORIGIN',
  !!adminOriginInConfig && !!adminHostInClient &&
  adminOriginInConfig[1] === adminHostInClient[1],
  (adminOriginInConfig || [])[1] + ' vs ' + (adminHostInClient || [])[1]);
check('and that host is one the Worker actually answers on',
  !!adminHostInClient &&
  (config.includes('"pattern": "' + adminHostInClient[1] + '"') ||
   adminHostInClient[1].endsWith('.workers.dev')));

/* Every hostname the console may be reached on is declared, so isPlatformHost
   does not start reading one of them as a clinic slug. */
const consoleHosts = /"CONSOLE_HOSTS": "([^"]+)"/.exec(config);
check('the console hostnames are declared', !!consoleHosts);
check('including the one the client sends people to',
  !!consoleHosts && !!adminHostInClient &&
  consoleHosts[1].split(',').includes(adminHostInClient[1]));
check('and the old address, so a saved link is not dead',
  config.includes('"pattern": "admin.tcos.tharigopula.com"') &&
  !!consoleHosts && consoleHosts[1].includes('admin.tcos.tharigopula.com') &&
  adminClient.includes("location.hostname === 'admin.tcos.tharigopula.com'"));
/* The Pages host can never serve the console: it cannot receive the
   Worker's host-only cookie. It must always be sent away. */
check('the Pages host is always redirected, never left to fail',
  adminClient.includes("location.hostname === 'tcos.pages.dev'"));

/* A button that can only fail, sitting under the one that works, is how a
   sign-in screen wastes somebody's evening. Owner recovery REQUIRES Access
   to be enforcing, so with it off the offer has to go. */
check('OWNER RECOVERY IS HIDDEN WHEN IT CANNOT POSSIBLY WORK',
  /identity\.enforced === false[\s\S]{0,260}bootstrapHint[\s\S]{0,160}hidden = true/
    .test(adminConsole));
check('and the route it would have called really does require Access',
  /'POST \/admin\/recover'[\s\S]{0,200}if \(!accessEnforced\(env\)\)/.test(router));
check('while the emailed reset that replaces it needs no Access at all',
  !/'POST \/admin\/reset\/start'[\s\S]{0,400}accessEnforced/.test(router));
check('the cross-origin doctor app is unaffected and the console keeps its cookie',
  config.includes('"TURNSTILE_SITE_KEY": "0x4AAAAAAEtshKrWV-Zbm6Wo"') &&
  /"COOKIE_AUTH_ENFORCE": "false"[\s\S]*"ADMIN_COOKIE_AUTH_ENFORCE": "true"/.test(config));

/* WHAT REPLACED THE NETWORK GATE. Access being off is only defensible
   because these are all still true, so they are asserted rather than
   assumed. */
check('the console is still rate limited per identifier and per connection',
  /scope: 'platform_admin_signin'[\s\S]{0,400}enforceSourceRateLimit/.test(router));
check('and still blocks after repeated wrong passwords',
  /scope: 'platform_admin_signin', *\n?\s*subject: submittedEmail, maxFailures: 5/.test(router));
/* The answer to "what happens if the pc is lost": a code to the address
   the account already has, which needs no device and no dashboard. */
check('THERE IS A WAY BACK IN THAT NEEDS NO DEVICE',
  /'POST \/admin\/reset\/start'/.test(router) && /'POST \/admin\/reset\/verify'/.test(router));
check('it proves the code before it looks the account up',
  /verifyOtp\(env\.DB, \{ purpose: 'platform_reset'[\s\S]{0,400}team\.byEmail/.test(router));
check('it says the same thing whether or not the account exists',
  /if \(member\) await issueOtp[\s\S]{0,200}return json\(\{ sentTo: maskIdentifier\(id\) \}\)/.test(router));
check('and a reset ends every open console session',
  /async resetPassword[\s\S]{0,700}UPDATE admin_sessions SET revoked_at/
    .test(readFileSync('worker/platform.js', 'utf8')));
/* A passkey is an ADDITION, never the only door - that is the whole
   substance of his complaint about being fixed to one device. */
check('a password still signs in with no passkey anywhere in the way',
  !/passkey[\s\S]{0,200}required/i.test(adminHtml) &&
  adminHtml.includes('id="gateForm"'));

/* Turnstile enforcement used to be asserted "true" inside the check above,
   which was right in spirit and wrong in shape: on 12 Sep 2026 the widget
   stopped issuing tokens, and because every door - doctor sign-in, owner
   sign-in, AND password reset - verifies Turnstile first, it locked the owner
   out of production with no way to recover. The fix had to be shipped, and a
   bare "must be true" assertion would only have tempted someone to delete it.

   So it may be off, but NEVER silently. Turning it off requires saying so in
   the configuration, next to the switch, where the next person reads it. That
   keeps the thing the original assertion was protecting - nobody disables
   this by accident or in passing - while allowing a deliberate, documented,
   temporary state during an incident. */
/* Scoped to the PRODUCTION block. The first version of this read the whole
   file and passed because the staging environment further down still said
   "true" - a green tick over the exact setting it was meant to be watching. */
const productionBlock = config.slice(0, config.indexOf('"env": {'));
const turnstileOn = /"TURNSTILE_ENFORCE": "true"/.test(productionBlock);
const turnstileExcused =
  /TEMPORARILY OFF[\s\S]{0,2000}"TURNSTILE_ENFORCE": "false"/.test(productionBlock);
check('Turnstile is enforced, or its absence is explained at the switch',
  turnstileOn || turnstileExcused,
  'production has TURNSTILE_ENFORCE off with no explanation beside it');
if (!turnstileOn) {
  console.log('\n  !! Turnstile enforcement is OFF in production. Sign-in, password');
  console.log('     reset and the application form have no bot protection beyond');
  console.log('     rate limiting. This is meant to be temporary - turn it back on.\n');
}
check('the Worker serves only the allow-listed dist directory',
  config.includes('"directory": "./dist"') && config.includes('"binding": "ASSETS"') &&
  config.includes('"run_worker_first": true'));
check('every admin page and API is Access-checked before routing or assets',
  /pathname === '\/admin' \|\| pathname === '\/admin\.html'/.test(router) &&
  /isPlatformAdminPath\(url\.pathname\)/.test(router) &&
  router.indexOf('await verifyPlatformAccess(env, request)') < router.indexOf('env.ASSETS.fetch'));
for (const [name, source] of [['clinic', clinicClient], ['admin', adminClient]]) {
  check(name + ' client sends cookies and unsafe-request CSRF proof',
    /credentials: 'include'/.test(source) && /X-CSRF-Token/.test(source));
  check(name + ' client accepts an HttpOnly-cookie session marker',
    /SESSION_MARKER_KEY/.test(source) && /acceptSession\(result\)/.test(source));
}
check('an expired outer Access session tells the operator how to recover',
  /access_session_expired/.test(adminClient) &&
  /Reload this page, complete secure sign-in/.test(adminClient));
const destructiveAdminRoutes = [
  'doctors/:id/verification', 'doctors/:id/suspend', 'doctors/:id/restore',
  'ai-spend/clear', 'costs/rates/:id', 'costs', 'costs/:id', 'applications/:id',
  'applications/:id/approve', 'subscriptions/sync-plans', 'doctors',
  'doctors/:id/reissue', 'doctors/:id', 'team', 'team/:email'
];
check('every destructive platform route uses the fresh-password boundary',
  destructiveAdminRoutes.every(path => {
    const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp("'(?:POST|PATCH|DELETE) /admin/" + escaped +
      "'[\\s\\S]{0,100}requireFreshAdmin").test(router);
  }));
check('the console asks once, reauthenticates, then retries the refused change',
  adminClient.includes("request('POST', '/admin/reauth'") &&
  adminConsole.includes("error.code !== 'reauth_required'") &&
  adminConsole.includes('return operation();') &&
  adminHtml.includes('id="reauthDialog"') &&
  adminHtml.includes('autocomplete="current-password"'));
check('replacing a temporary platform password proves the current password',
  /'POST \/admin\/change-password'[\s\S]{0,500}adminSignIn\(env, admin\.email, currentPassword\)/
    .test(router));
const recoveryRoute = router.slice(
  router.indexOf("'POST /admin/recover'"),
  router.indexOf("'POST /admin/reauth'"));
check('owner recovery needs Access, the fixed owner and exact app origin',
  recoveryRoute.includes('accessEnforced(env)') &&
  recoveryRoute.includes('env.PLATFORM_OWNER_EMAIL') &&
  recoveryRoute.includes("request.headers.get('Origin') !== adminOrigin(env)") &&
  recoveryRoute.includes("action: 'platform_recover'"));
check('owner recovery revokes old sessions and is available from the console',
  readFileSync('worker/platform.js', 'utf8').includes('async recoverOwner(') &&
  readFileSync('worker/platform.js', 'utf8').includes('UPDATE admin_sessions SET revoked_at') &&
  adminClient.includes("request('POST', '/admin/recover'") &&
  adminHtml.includes('id="adminRecoveryChallenge"'));
check('owner recovery is visible before a failed inner sign-in',
  adminHtml.includes('id="bootstrapHint">') &&
  !adminHtml.includes('id="bootstrapHint" hidden'));

/* ------------------------------------------------------------------------
   CHANGING YOUR PASSWORD MUST NOT SIGN YOU OUT.

   Found in production on 13 Sep 2026. setPassword revokes every session
   opened with the old credential - correct, a stolen token must die - but it
   cannot tell the thief's session from the one making the request, so it
   killed both, and the route returned {ok:true} with no replacement. The
   doctor's next click answered 401 and the screen said "sign in again".

   It bit hardest on the first sign-in of every new account, because
   must_change_password forces exactly this flow: approve a doctor, she signs
   in, is made to set a password, and is thrown straight back out. Signing in
   again just repeats it, which is what Vijay hit on his own account.

   Both halves are asserted, because either one alone leaves the loop intact:
   a server that issues a token a client throws away is the same bug.
   ------------------------------------------------------------------------ */
const changeRoute = (() => {
  const at = router.indexOf("  'POST /auth/change-password':");
  return at < 0 ? '' : router.slice(at, at + 3000);
})();

check('old sessions still die when the password changes',
  readFileSync('worker/repo.js', 'utf8')
    .includes('UPDATE sessions SET revoked_at = ?'),
  'a token stolen under the old password must not survive the change');
check('but the change issues a replacement session',
  /setPassword\([\s\S]{0,2500}sessions\.create\(/.test(changeRoute),
  'without this, changing your password logs you out of the tab you are in');
check('and returns it the same way sign-in does',
  /cookieAuthEnforced\(env, CLINIC_SESSION_COOKIE\) \? \{\} : \{ token \}/.test(changeRoute) &&
  /csrfToken/.test(changeRoute) && /Set-Cookie/.test(changeRoute));
check('the client stores that token instead of clearing the session',
  /changePassword[\s\S]{0,1600}acceptSession\(result\)/.test(clinicClient),
  'a server that issues a token the client discards is the same bug');
/* CONTROL: the route was actually found, so the three greps above could fail. */
check('CONTROL: the change-password route was located',
  changeRoute.length > 400 && /verifyPasswordVersioned/.test(changeRoute));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);

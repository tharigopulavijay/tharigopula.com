/* =========================================================================
   Why "my password is correct" and "your password is wrong" were both true.

   Vijay, on the fourth occurrence: "i am trying to login to my account it
   is saying password is incorrect but i am entering correct details only
   and i am pretty sure on that ... this is the issue i am getting every
   now and then and it is not that good."

   He was right every time. Production has exactly two clinic accounts and
   neither is his: TCOS keeps clinic accounts in `doctors` and Tharigopula
   platform accounts in `platform_team`, and the platform owner has no
   clinic account at all. His console password typed into the doctor app is
   refused forever, however carefully he types it, and the screen says the
   password is wrong. The password is not wrong. The door is.

   THE ASSERTIONS THIS FILE EXISTS FOR, in the order they would hurt:

   1. A STRANGER STILL LEARNS NOTHING. The wrong-door answer is only given
      to somebody who already typed the matching platform password. Anyone
      guessing gets the one flat message, and no route may ever say "no such
      account" on its own.

   2. THE WRONG-DOOR CHECK COMES BEFORE THE TIMING HASH, not after. Each
      PBKDF2 is budgeted at about 10ms of Worker CPU. Running the timing
      hash and then two more for the platform check puts three in one
      request, and the request is killed - which would turn a helpful
      message into a dead sign-in screen.

   3. A REMEMBERED SESSION AND ITS COOKIE EXPIRE TOGETHER. A cookie that
      outlives its row leaves her carrying a credential the server has
      already stopped honouring, which looks exactly like the app being
      broken - the complaint this file exists to end.

   4. EVERY PASSWORD FIELD CAN BE REVEALED, including the ones that do not
      exist until a dialog opens.

   Run:  node test/signin-usability.test.js
   ========================================================================= */

import { readFileSync, readdirSync } from 'node:fs';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

/* Line endings are CRLF in this checkout and LF in CI, and a regex written
   with \n silently matches nothing against the other one - which is a test
   that passes by never running. Everything here reads normalised text. */
const source = name => readFileSync(name, 'utf8').replace(/\r\n?/g, '\n');

const router = source('worker/index.js');
const signin = /'POST \/auth\/signin':[\s\S]*?\n  \},\n/.exec(router);
check('the sign-in route was found to read', !!signin);
const route = signin ? signin[0] : '';

console.log('\nThe wrong door is named, and only to someone who knew the password\n');

check('the route knows about platform accounts', /wrongDoor/.test(route));
check('it looks the email up in platform_team', /team\.byEmail\(env\.DB, id\)/.test(route));

/* 1. THE LEAK THAT MUST NOT OPEN. Everything here is downstream of the
      password having already verified. */
check('IT ANSWERS ONLY AFTER THE PASSWORD VERIFIES',
  /verifyPasswordVersioned\([\s\S]{0,140}?member\.password_hash\);[\s\S]{0,80}?if \(!checked\.ok\) return null;/.test(route));
check('and it says where to go instead', /owner console at/.test(route));
check('a mobile number is never looked up as a platform account',
  /if \(channel !== 'email'\) return null;/.test(route));

/* The flat message must survive for everybody else. */
check('the one flat message is still what everyone else gets',
  /That mobile, email or password is not right\./.test(route));
/* It must cost an attempt like any other failure, and it must do so through
   the SAME counter - a second `authThrottle.failure` in this route is how a
   door ends up without one. test/security.test.js counts the call sites. */
check('and a failed wrong-door attempt still counts against the throttle',
  /if \(door\) await wrong\(door\);/.test(route) &&
  /const wrong = async \(instead\) => \{\n\s*await authThrottle\.failure/.test(route));
check('the wrong-door reply is the only thing that changes, not the counting',
  (route.match(/authThrottle\.failure\(/g) || []).length === 1);

/* No route anywhere may distinguish a missing account by itself. */
const enumerating = ['No account with that', 'no such account', 'Account not found',
                     'That mobile is not registered'];
for (const phrase of enumerating) {
  check('no route says "' + phrase + '"', !router.includes(phrase));
}

console.log('\nThree PBKDF2 hashes in one request would kill the Worker\n');

/* 2. Order matters for a reason that is not style. */
const doorAt = route.indexOf('const door = await wrongDoor();');
const timingAt = route.indexOf("'00000000000000000000000000000000'");
check('the wrong-door check happens first', doorAt > 0 && timingAt > 0 && doorAt < timingAt,
  'door=' + doorAt + ' timing=' + timingAt);
check('so a request never does more than two password hashes',
  /if \(door\) await wrong\(door\);\n\s*\/\* Match the password work/.test(route));

console.log('\nStaying signed in is her choice, and it is honoured on both sides\n');

check('the route accepts the choice', /rememberDevice/.test(route));
check('it is opt-in, never inferred', /rememberDevice === true/.test(route));
check('a remembered device lasts a month', /REMEMBERED_HOURS = 24 \* 30/.test(route));
check('and everything else keeps the short session',
  /Number\(env\.SESSION_TTL_HOURS \|\| 12\)/.test(route));

/* 3. The row and the cookie must agree, or she carries a dead credential. */
check('THE SESSION ROW USES THE CHOSEN LENGTH',
  /sessions\.create\(env\.DB, doctor\.id, await sha256\(token\),\n\s*ttlHours,/.test(route));
check('AND SO DOES THE COOKIE',
  /sessionCookie\(CLINIC_SESSION_COOKIE, token, ttlHours\)/.test(route));

/* Signing in must not end another device's session - that is the whole
   point of "let me sign in from any device". */
const repo = source('worker/repo.js');
const create = /async create\(db, doctorId, tokenHash[\s\S]*?\n  \},/.exec(repo);
check('creating a session was found to read', !!create);
check('SIGNING IN NEVER REVOKES ANOTHER DEVICE',
  !!create && !/revoked_at/.test(create[0]));
/* Changing a password still should, and that is a different thing. */
check('but changing the password still ends the old sessions',
  /async setPassword[\s\S]{0,700}?UPDATE sessions SET revoked_at/.test(repo));

console.log('\nThe way back in follows the identity, not a constant\n');

/* 20 Sep 2026: the Access application's only login method is a Cloudflare
   account, so Access names Vijay by whichever address that account uses. If
   that is not PLATFORM_OWNER_EMAIL, sign-in wanted a password for an account
   he was not holding AND recovery refused him for not being the configured
   owner. Two doors, both behaving correctly, both shut. */
const recover = /'POST \/admin\/recover':[\s\S]*?\n  \},\n/.exec(router);
check('the recovery route was found to read', !!recover);
const hatch = recover ? recover[0] : '';

check('it refuses when Cloudflare Access named nobody',
  /if \(!accessEmail\) throw forbidden/.test(hatch));
check('AN EXISTING OWNER MAY RECOVER THEIR OWN ACCOUNT',
  /const isExistingOwner = !!existing && existing\.role === 'owner';/.test(hatch));
check('and the configured owner still may, which is what first run needs',
  /isConfiguredOwner = !!configuredOwner && accessEmail === configuredOwner/.test(hatch));
check('anyone else is refused, and told which identity they are holding',
  /if \(!isExistingOwner && !isConfiguredOwner\)[\s\S]{0,200}not an owner of this console/.test(hatch));

/* The dangerous mistake would be resetting somebody ELSE's account. */
check('IT RESETS THE ACCESS IDENTITY AND NOTHING ELSE',
  /const target = accessEmail;/.test(hatch) &&
  /recoverOwner\(\n\s*env\.DB, env, target, password/.test(hatch));
check('the typed email must still match that identity',
  /!== target\) \{\n\s*throw forbidden\('Use the same email/.test(hatch));
check('the rate limit counts against that identity too',
  /scope: 'platform_owner_recovery', subject: target/.test(hatch));
/* A new owner must not be mintable through the recovery hatch. */
check('a name already on the row is not overwritten by a constant',
  /\(existing && existing\.full_name\) \|\| 'Platform owner'/.test(hatch));

/* Every other gate on this route has to survive the widening. */
for (const [what, pattern] of [
  ['it only works behind Cloudflare Access', /accessEnforced\(env\)/],
  ['it only accepts same-origin submissions', /Origin'\) !== adminOrigin\(env\)/],
  ['it still demands a fresh bot challenge', /verifyTurnstile/],
  ['it still demands twelve characters', /password\.length < 12/]
]) check(what, pattern.test(hatch));

const console_ = source('js/tcos-admin-console.js');
check('the recovery email is filled from the Access identity, not typed',
  /bootField\.value = identity\.email; bootField\.readOnly = true;/.test(console_));

console.log('\nShe can see what she typed\n');

const reveal = source('js/password-reveal.js');
check('there is one implementation, not fourteen', /querySelectorAll\('input\[type="password"\]'\)/.test(reveal));
check('it toggles the type rather than printing the value',
  /input\.type = showing \? 'password' : 'text'/.test(reveal));
check('the caret is put back where she left it', /setSelectionRange/.test(reveal));
check('a revealed password never survives the page', /pagehide/.test(reveal));
/* 4. The change-password dialog does not exist until it is opened. */
check('FIELDS THAT APPEAR LATER ARE WIRED TOO', /MutationObserver/.test(reveal));
check('and a field is never wired twice', /dataset\[WIRED\] === 'yes'/.test(reveal));

/* Every page with a password field must actually load it. */
const pages = readdirSync('.').filter(f => f.endsWith('.html'));
const needsIt = pages.filter(f => {
  const html = readFileSync(f, 'utf8');
  return html.includes('type="password"') || html.includes('js/nav.js');
});
check('there are pages that need it', needsIt.length > 5, String(needsIt.length));
const without = needsIt.filter(f => !readFileSync(f, 'utf8').includes('js/password-reveal.js'));
check('EVERY PAGE WITH A PASSWORD FIELD LOADS IT', without.length === 0, without.join(', '));

const login = source('tcos-login.html');
check('the sign-in screen offers to keep her signed in', /id="rememberDevice"/.test(login));
check('and the choice actually reaches the API',
  /getElementById\('rememberDevice'\)\.checked/.test(login));
check('the box is off unless she ticks it', !/id="rememberDevice"[^>]*checked/.test(login));
check('and it says not to tick it on a shared computer', /shared or clinic computer/.test(login));

const api = source('js/tcos-api.js');
check('the client never infers the choice', /rememberDevice: rememberDevice === true/.test(api));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);

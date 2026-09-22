/* =========================================================================
   The first three seconds, and the white screen that lasted fifteen minutes.

   Vijay, having installed the app on his phone: "the time i open app i am
   getting tcos. its been 15 min i am seeing the same screen, white screen
   showing TCOS, nothing is working. see tcos logo should be visible only
   till 3 seconds then enter into the platform. people dont have that much
   time right."

   Reproduced in a real browser before anything was written: a phone whose
   stored session the server no longer honours sends tcos-clinic and
   tcos-login bouncing off each other, neither page ever paints, and the
   renderer spins so hard it will not run script. On Android the install
   splash - white, with the TCOS mark - stays up throughout. That is the
   screen he sat in front of.

   THE ASSERTIONS THIS FILE EXISTS FOR, in the order they would hurt:

   1. EVERY SCREEN CAN END THE SPLASH. A page that shows the overlay and has
      no way to dismiss it is WORSE than before: it would sit for three
      seconds and then tell a doctor the app had failed, over a screen that
      was working perfectly. js/consult.js and js/desk.js draw no rail and
      were both caught by this check while it was being written.

   2. TCOSBoot EXISTS WHEREVER IT IS CALLED. A screen calling it without
      js/app-boot.js loaded throws a ReferenceError and dies completely.
      desk.html loads its script as "js/desk.js?v=1", so any check that
      matches filenames without allowing a query string misses it - which
      this one did, once.

   3. THE BOUNCE CANNOT REPEAT. The app and the sign-in screen may hand her
      over once. Twice is a disagreement, and the third time is the bug.

   4. THE DEADLINE IS REAL AND IT IS THREE SECONDS.

   Run:  node test/app-boot.test.js
   ========================================================================= */

import { readFileSync, readdirSync, existsSync } from 'node:fs';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};
const source = name => readFileSync(name, 'utf8').replace(/\r\n?/g, '\n');

const boot = source('js/app-boot.js');
const pages = readdirSync('.').filter(f => f.endsWith('.html'));

/* A page's own scripts, WITH the query string stripped. desk.html asks for
   "js/desk.js?v=1", and a matcher that insists on a bare filename silently
   decides that page has no scripts at all. */
const scriptsOf = html =>
  [...html.matchAll(/src="(js\/[^"?]+\.js)(?:\?[^"]*)?"/g)].map(m => m[1]);

console.log('\nThe logo is a deadline, not a delay\n');

check('the deadline is three seconds', /DEADLINE_MS = 3000/.test(boot));
check('and it is armed as soon as the page opens',
  /timer = setTimeout\(\(\) => \{\n\s*stall\(/.test(boot));
check('the overlay is on screen before anything else can fail',
  boot.indexOf('document.body.appendChild(overlay)') < boot.indexOf('window.TCOSBoot'));
/* A splash that waits for a stylesheet cannot cover a stylesheet failing. */
check('it carries its own styles rather than waiting for a stylesheet',
  /<style>/.test(boot) && /#tcosBoot\{position:fixed/.test(boot));
check('what she waits on is the TCOS mark', /assets\/tcos-logo\.png/.test(boot));

/* When the deadline passes she gets something she can act on. */
check('after three seconds she is given two things to press',
  /Try again/.test(boot) && /Sign in again/.test(boot));
check('and pressing Try again actually reloads', /location\.reload\(\)/.test(boot));
check('a server message is inserted as text, never as markup',
  /\.textContent = title/.test(boot) && /\.textContent = detail/.test(boot));
check('a script that fails to load is named rather than waited out',
  /tagName === 'SCRIPT'/.test(boot));

console.log('\nThe bounce cannot repeat\n');

/* 3. Two screens that disagree must not be able to argue forever. */
check('hand-overs are counted', /BOUNCE_KEY/.test(boot));
check('THE THIRD HAND-OVER IS REFUSED', /if \(n > 2\)/.test(boot));
check('and refusing it clears the session rather than trying again',
  /removeItem\('tcos-token'\)[\s\S]{0,120}removeItem\('tcos-session-present'\)/.test(boot));
check('she lands on the sign-in screen knowing why', /\?stuck=1/.test(boot));
check('a screen that paints clears the count, so a later bounce starts fresh',
  /function hide\(\)[\s\S]{0,220}drop\(BOUNCE_KEY\)/.test(boot));
check('storage that throws never takes the app down',
  (boot.match(/catch \(_\)/g) || []).length >= 3);

const login = source('tcos-login.html');
check('THE SIGN-IN SCREEN REFUSES TO HAND HER STRAIGHT BACK',
  /TCOSApi\.isSignedIn\(\) && !arrivedFromTheApp\(\)/.test(login));
check('it knows the app sent her', /signInParams\.has\('why'\) \|\| signInParams\.has\('stuck'\)/.test(login));
check('and somebody who got caught in it is told, not silently dropped',
  /signInParams\.has\('stuck'\)[\s\S]{0,200}your session had expired/.test(login));

console.log('\nEvery screen can end the splash, and none of them can throw\n');

/* 1 and 2 together: the two ways this change could be worse than the bug. */
const SIGNAL = /TCOSRail\.paint|TCOSNav\.paint|TCOSBoot\.ready/;
const bootPages = pages.filter(p => source(p).includes('js/app-boot.js'));
check('the app pages load the boot screen', bootPages.length >= 15, String(bootPages.length));

const wouldHang = [];
for (const page of bootPages) {
  const html = source(page);
  if (SIGNAL.test(html)) continue;
  const ok = scriptsOf(html).some(s => existsSync(s) && SIGNAL.test(source(s)));
  if (!ok) wouldHang.push(page);
}
check('EVERY PAGE THAT SHOWS THE SPLASH CAN DISMISS IT',
  wouldHang.length === 0, wouldHang.join(', '));

const callers = readdirSync('js').filter(f => f.endsWith('.js'))
  .filter(f => /TCOSBoot\./.test(source('js/' + f))).map(f => 'js/' + f);
check('there are screens using it', callers.length > 10, String(callers.length));

const wouldThrow = [];
for (const page of pages) {
  const html = source(page);
  const uses = scriptsOf(html).filter(s => callers.includes(s));
  if (uses.length && !html.includes('js/app-boot.js')) wouldThrow.push(page + ' (' + uses.join(' ') + ')');
}
check('TCOSBoot IS DEFINED ON EVERY PAGE THAT CALLS IT',
  wouldThrow.length === 0, wouldThrow.join(', '));

/* The old direct jumps are what the counter exists to replace. */
const strays = [];
for (const file of readdirSync('js').filter(f => f.endsWith('.js'))) {
  const s = source('js/' + file);
  if (/isSignedIn\(\)\) \{ location\.(replace|href)/.test(s)) strays.push('js/' + file);
}
check('no screen still jumps to sign-in without counting it',
  strays.length === 0, strays.join(', '));

/* The boot script must come before the client it guards. */
const misordered = bootPages.filter(page => {
  const html = source(page);
  const b = html.indexOf('js/app-boot.js');
  const a = html.indexOf('js/tcos-api.js');
  return b < 0 || a < 0 || b > a;
});
check('the boot screen loads before the API client', misordered.length === 0, misordered.join(', '));

/* The rail hook is what saves twelve screens from having to remember. */
const nav = source('js/nav.js');
check('painting the navigation is what ends the splash',
  /const painted = \(page, me\) => \{[\s\S]{0,160}TCOSBoot\.ready\(\)/.test(nav));
check('and both names for it go through that', /TCOSNav = \{ paint: \(page, me\) => painted/.test(nav) &&
  /TCOSRail = \{ paint: me => painted/.test(nav));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);

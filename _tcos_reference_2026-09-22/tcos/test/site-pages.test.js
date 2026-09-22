/* =========================================================================
   The public side of TCOS: five pages instead of one long scroll.

   Vijay: "presentation of tcos main page is not that good. i am clicking on
   create it is scrolling down and there entering details it is not that
   good presentation. keep each button a different page, everything a
   separate page, and make it present well."

   THE ASSERTIONS THIS FILE EXISTS FOR, in the order they would hurt:

   1. THE FORM STILL SENDS EVERY FIELD THE SERVER READS. The application
      form moved to its own page and was cut into three steps. If one field
      were dropped in the move it would fail silently - the application
      would be accepted with a blank registration number, and we would only
      find out when somebody tried to verify a doctor and had nothing to
      verify her against.

   2. NO PAGE STILL POINTS AT AN ANCHOR THAT NO LONGER EXISTS. #apply is
      now a page. A stale href does not error, it just lands the doctor at
      the top of a page with no form on it, and she leaves.

   3. THE SECURITY CHALLENGE IS NOT INSIDE A HIDDEN STEP. Turnstile renders
      once, when the page loads. Rendered inside a container that is hidden
      at that moment, it can fail to produce a token - which is silent, and
      every application is lost. That exact failure has already happened
      once on this form, for a different reason.

   4. EVERY PAGE CARRIES THE SAME WAY OUT. Five hand-written pages is five
      chances for one to lose the sign-in link.

   Run:  node test/site-pages.test.js
   ========================================================================= */

import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

const PAGES = ['index.html', 'products.html', 'features.html', 'how.html', 'apply.html'];
const read = name => readFileSync(name, 'utf8');
const pages = Object.fromEntries(PAGES.map(name => [name, read(name)]));

console.log('\nEach button is its own page now\n');

for (const name of PAGES) {
  check(name + ' exists and is a page', pages[name].startsWith('<!doctype html>'));
}

/* One stylesheet, five pages. Five inline <style> blocks would be five
   pages that disagree with each other inside a month. */
for (const name of PAGES) {
  check(name + ' uses the shared stylesheet',
    pages[name].includes('href="css/site.css"'));
  check(name + ' has no inline stylesheet of its own',
    !/<style[\s>]/.test(pages[name]));
}

console.log('\nNothing still points at an anchor that is now a page\n');

/* 2. The old page was one scroll with #products, #features, #how and
      #apply. Every one of those is a page now. A leftover href does not
      throw - it silently lands her somewhere with nothing on it. */
const DEAD = ['href="#apply"', 'href="#products"', 'href="#features"',
              'href="#how"', 'index.html#apply', 'index.html#'];
const everyHtml = [...PAGES, 'tcos-login.html'];
for (const name of everyHtml) {
  const html = read(name);
  const found = DEAD.filter(anchor => html.includes(anchor));
  check(name + ' has no dead anchor left', found.length === 0, found.join(' '));
}

console.log('\nEvery page keeps the way in and the way onward\n');

/* 4. Hand-written headers drift. These are the two links a visitor must
      never lose: the one that signs her in and the one that starts her. */
for (const name of PAGES) {
  check(name + ' links to sign in', pages[name].includes('href="tcos-login.html"'));
}
for (const name of PAGES.filter(p => p !== 'apply.html')) {
  check(name + ' links to the application', pages[name].includes('href="apply.html"'));
}

/* The full navigation, on every page except the form itself - which drops
   "Create account" because you are already there. */
for (const name of PAGES) {
  for (const destination of ['products.html', 'features.html', 'how.html']) {
    check(name + ' can reach ' + destination, pages[name].includes('href="' + destination + '"'));
  }
}

console.log('\nThe application form survived being cut into three\n');

const apply = pages['apply.html'];

/* 1. THE ONE THAT MATTERS. Every field the server reads in
      applications.submit must still be sent by the form. Read from the
      Worker rather than typed out here, so adding a column to the server
      and forgetting the form fails HERE instead of in production. */
const submitSource = readFileSync('worker/platform.js', 'utf8');
const submitBody = /async submit\(db, details\) \{[\s\S]*?\n  \},/.exec(submitSource);
check('the server-side submit was found to read', !!submitBody);

const serverReads = [...new Set(
  [...(submitBody ? submitBody[0] : '').matchAll(/details\.([a-zA-Z]+)/g)].map(m => m[1])
)];
check('the server reads a plausible number of fields', serverReads.length >= 14,
  String(serverReads.length));

const missing = serverReads.filter(field => !new RegExp(field + ':').test(apply));
check('THE FORM STILL SENDS EVERY FIELD THE SERVER READS',
  missing.length === 0, missing.join(', '));

/* Every one of those fields also needs an input to come from. */
const noInput = serverReads
  .filter(f => f !== 'turnstileToken' && f !== 'source')
  .filter(field => !apply.includes('id="' + field + '"'));
check('and each of them has an input on the page', noInput.length === 0, noInput.join(', '));

console.log('\nThree steps, and the end is in sight from the start\n');

check('there are exactly three steps',
  (apply.match(/class="wizard-step"/g) || []).length === 3);
check('and a rail that says which one she is on',
  apply.includes('wizard-rail') && (apply.match(/<small>Step \d<\/small>/g) || []).length === 3);
check('steps two and three start hidden',
  (apply.match(/data-step="[23]" hidden/g) || []).length === 2);
check('step one does not', /data-step="1">/.test(apply));

/* Only the three the server itself insists on. A form that argues about a
   council name is a form abandoned over a council name. */
check('only name, mobile and clinic are required to move on',
  /REQUIRED = \{[\s\S]*?\}/.test(apply) &&
  /\['fullName'/.test(apply) && /\['mobile'/.test(apply) && /\['clinicName'/.test(apply));
check('and the server-required three are checked again before sending',
  /!details\.fullName \|\| !details\.mobile \|\| !details\.clinicName/.test(apply));

/* 3. Turnstile renders on load. Inside a hidden step it may never produce a
      token, and nobody would be told. */
const challengeAt = apply.indexOf('id="applicationChallenge"');
const lastStepEnds = apply.lastIndexOf('</div>', challengeAt);
check('the security challenge is found', challengeAt > 0);
check('THE CHALLENGE IS NOT INSIDE A HIDDEN STEP',
  challengeAt > apply.lastIndexOf('data-step="3"') && lastStepEnds < challengeAt);
check('and it is still set up on load',
  /TCOSChallenge\.setup\('applicationChallenge'/.test(apply));

console.log('\nAnd she is told what happens next\n');

check('submitting replaces the form rather than leaving it looking unsent',
  /form\.replaceWith\(panel\)/.test(apply));
check('the reference is sanitised before it is written into the panel',
  /replace\(\/\[\^A-Za-z0-9_-\]\/g, ''\)/.test(apply));
check('two working days is still the promise', /two working days/.test(apply));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);

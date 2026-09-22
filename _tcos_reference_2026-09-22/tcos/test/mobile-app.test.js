/* =========================================================================
   TCOS as an app on a doctor's phone.

   A doctor using the product, through Vijay: "he is using mobile, he is
   saying it is difficulty to manage through mobile, so lets make screen
   compatability based on the screen... give me a link so he installs as a
   lightweight app on his mobile... easy access having buttons on below
   switching tabs."

   THE ASSERTION THIS FILE EXISTS FOR, above all others:

     THE SERVICE WORKER MUST NOT CACHE CLINICAL DATA.

   A service worker sits between the app and the network and can serve
   whatever it remembers. On a clinical system that is a loaded gun: a
   doctor reading yesterday's allergy list, yesterday's prescription or
   yesterday's stock count, with nothing on screen to say the page is old.
   sw.js caches ONLY files whose name contains their own content hash -
   which cannot go stale, because changing the contents changes the name.
   Everything else goes to the network every time.

   If the rule below is ever loosened, this file should be the thing that
   stops it.

   Run:  node test/mobile-app.test.js
   ========================================================================= */

import { readFileSync, existsSync, readdirSync } from 'node:fs';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

const sw = readFileSync('sw.js', 'utf8');

/* Comments stripped before any assertion about what the CODE does.
   Asserting "nothing is precached" against a file whose comment explains
   why nothing is precached fails on the explanation - which has now caught
   this project out five separate times, in isolation.test.js, twice in
   consult-fields, and here. The comment is the documentation; the code is
   the claim. */
const stripComments = source => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');
const swCode = stripComments(sw);

/* ---------------------------------------------- what may be cached --- */
console.log('\nThe service worker caches only what cannot go stale\n');

/* The real rule, lifted out of the shipped file rather than retyped - a
   copy here would be a copy that stops matching the one that runs. */
const fingerprintLine = /const FINGERPRINTED = (\/.+\/[a-z]*);/.exec(sw);
check('sw.js declares the rule this test reads', !!fingerprintLine);

const FINGERPRINTED = fingerprintLine && eval(fingerprintLine[1]);
const iconLine = /const ICON = (\/.+\/[a-z]*);/.exec(sw);
const ICON = iconLine && eval(iconLine[1]);

/* Real names, as scripts/build-public.js actually produces them. */
const CACHEABLE = [
  '/js/consult.ae2afe2621.js',
  '/css/tcos.830518963e.css',
  '/js/tcos-admin-console.431f7bd364.js'
];
for (const path of CACHEABLE) {
  check('a fingerprinted asset is cacheable: ' + path, FINGERPRINTED.test(path));
}

/* THE LIST THAT MATTERS. Every one of these would be a clinical record, a
   page, or an answer that depends on who is asking. */
const NEVER = [
  '/patients.html',
  '/consult.html',
  '/tcos-clinic.html',
  '/',
  '/index.html',
  '/js/consult.js',              /* unhashed source - the dev server's shape */
  '/css/tcos.css',
  '/prescriptions/rx_123',
  '/me',
  '/patients/pat_1',
  '/drugs'
];
for (const path of NEVER) {
  check('NEVER cached: ' + path,
    !FINGERPRINTED.test(path) && !ICON.test(path));
}

console.log('\nAnd the other doors into the cache are shut\n');

check('POST and everything else is ignored', /request\.method !== 'GET'/.test(sw));
check('another origin - which is where the API lives - is ignored',
  /url\.origin !== self\.location\.origin/.test(sw));
/* A query string means the path is not the whole key, so the path is not a
   safe thing to store the answer under. */
check('anything with a query string is ignored', /if \(url\.search\) return;/.test(sw));
check('only a clean 200 is kept', /response\.status === 200/.test(sw));
check('nothing is precached, so there is no list to get wrong',
  !/addAll|precache/i.test(swCode));
check('old caches are deleted when a new version activates',
  /caches\.delete/.test(sw) && /startsWith\('tcos-static-'\)/.test(sw));

/* ------------------------------------------------------- the manifest --- */
console.log('\nThe manifest is what makes a phone offer to install it\n');

const manifest = JSON.parse(readFileSync('manifest.webmanifest', 'utf8'));

check('it has a name and a short name',
  !!manifest.name && !!manifest.short_name && manifest.short_name.length <= 12);
check('it opens standalone, with no browser bar', manifest.display === 'standalone');
/* Installing the landing page would give a doctor an icon that opens an
   advert. It has to start on her own diary. */
check('it starts on the clinic screen, not the marketing page',
  manifest.start_url === '/tcos-clinic.html', manifest.start_url);
check('and its scope covers the whole app', manifest.scope === '/');

/* Chrome refuses to offer installation without both sizes. */
const sizes = manifest.icons.map(i => i.sizes);
check('there is a 192 and a 512 icon, which Chrome requires',
  sizes.includes('192x192') && sizes.includes('512x512'), sizes.join(' '));
check('and a maskable one, or Android crops the artwork',
  manifest.icons.some(i => i.purpose === 'maskable'));

for (const icon of manifest.icons) {
  check('the icon file exists: ' + icon.src, existsSync(icon.src));
}

/* A square icon, checked by reading the PNG header rather than trusting the
   filename - the source logo is a 1954x805 lockup and resizing it without
   padding produces a letterbox that Android renders in a circle. */
for (const src of [...new Set(manifest.icons.map(i => i.src))]) {
  const png = readFileSync(src);
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  check(src + ' is genuinely square (' + width + 'x' + height + ')', width === height);
}

/* ---------------------------------------------- the bar at the bottom --- */
console.log('\nThe tab bar, and where it is drawn\n');

const nav = readFileSync('js/nav.js', 'utf8');

check('there is a tab bar', /function paintTabBar/.test(nav));
/* The consultation screen has no rail - it is a focused workspace with its
   own top bar - and it is the screen he spends the day in. A tab bar drawn
   inside the rail branch would appear everywhere except there. */
check('IT IS DRAWN OUTSIDE THE RAIL BRANCH, so the consultation screen has it',
  /\}\s*\n\s*\/\* OUTSIDE the rail branch[\s\S]{0,400}paintTabBar\(me, may, included\);/.test(nav));

check('four tabs and a More, because five tabs is a menu',
  /TAB_ORDER = \[[^\]]*\]/.test(nav) &&
  (/\.slice\(0, 4\)/.test(nav)));
/* Built from the same list the rail is, filtered by the same capabilities -
   so a receptionist never gets a tab to a screen the server would refuse
   her, and adding a screen does not leave the phone showing a stale set. */
check('the tabs come from the same list as the rail, capability-filtered',
  /navItems\(\)\.filter\(\(\[, , , cap\]\) => may\(cap\)\)/.test(nav));
check('and it reuses the rail\'s icons rather than a second copy of them',
  /data-icon="' \+ icon \+ '"/.test(nav));

const css = readFileSync('css/tcos.css', 'utf8');
check('the bar is hidden on a desktop, so it costs one nothing',
  /\.tabbar \{ display: none; \}/.test(css));
check('targets are at least 48px - Apple asks 44, Android 48',
  /min-height: 56px/.test(css));
/* Safari zooms the page in when a field under 16px takes focus and leaves
   it zoomed, so a doctor typing a name has to drag the layout back. */
check('fields are 16px, so iOS does not zoom on focus',
  /input, select, textarea \{ font-size: 16px; \}/.test(css));
check('the iPhone home indicator is accounted for',
  /env\(safe-area-inset-bottom/.test(css));
check('content clears the bar, or the last row of every list hides behind it',
  /padding-bottom: 78px/.test(css));

console.log('\nThe consultation screen fits a phone\n');

const consultCss = readFileSync('css/consult.css', 'utf8');
/* At 375px the top bar did not wrap - it ran off the edge, so "Save draft"
   was sliced in half and "Issue & print" sat under the screen edge. The two
   controls that matter most were the two you could not press. */
check('the top bar wraps instead of running off the edge',
  /\.consult-bar \{\s*\n\s*flex-wrap: wrap;/.test(consultCss));
check('its buttons are thumb-sized', /\.consult-bar \.btn \{[\s\S]{0,80}min-height: 44px/.test(consultCss));
check('fields go to one column', /\.grid-2, \.grid-3, \.grid-4 \{ grid-template-columns: 1fr; \}/.test(consultCss));

/* --------------------------------------------------------- shipping --- */
console.log('\nIt actually reaches the browser\n');

const build = readFileSync('scripts/build-public.js', 'utf8');
/* The build is an allow-list: a file nobody names is a file nobody gets.
   Both of these must be at the ROOT - a service worker may only control
   pages at or below its own path, so one served from /js/ controls nothing. */
check('the manifest is on the publish allow-list', /'manifest\.webmanifest'/.test(build));
check('and so is the service worker', /'sw\.js'/.test(build));

const install = readFileSync('js/app-install.js', 'utf8');
check('the service worker is registered from the app', /serviceWorker\.register\('\/sw\.js'\)/.test(install));
check('a failed registration never takes a screen down with it',
  /register\('\/sw\.js'\)\.catch/.test(install));
check('localhost counts as secure, so this can be tested before a doctor sees it',
  /hostname === 'localhost'/.test(install));
/* ONLY the patient pages are excluded now. A patient must never be offered
   a clinic to install, and nothing else on this origin is hers.

   Two entries left this list on 20 Sep 2026, both because the reasoning was
   wrong rather than merely narrow. The landing page, on the grounds that it
   would give her an icon that opens an advert - but start_url is
   /tcos-clinic.html, so the icon opens the app whichever page added it. And
   the owner console, as "a screen the doctor is not the user of" - true,
   and beside the point, because Vijay is its user and asked for it. */
check('the patient pages are not installable',
  /NOT_THE_APP = \[[^\]]*'\/p\.html'[^\]]*'\/u\.html'/.test(install));
check('and nothing else is excluded any more',
  !/NOT_THE_APP = \[[^\]]*'\/index\.html'/.test(install) &&
  !/NOT_THE_APP = \[[^\]]*'\/admin\.html'/.test(install));
/* Safari has no install API at all and never will - Share, then Add to Home
   Screen. A button that cannot do anything is worse than a sentence. */
check('iOS is told what to do rather than given a dead button',
  /needsManualSteps/.test(install) && /iphone\|ipad\|ipod/.test(install));

check('the theme colour in the page matches the manifest',
  new RegExp("content = '" + manifest.theme_color + "'").test(install),
  manifest.theme_color);

console.log('\nThe doctor can actually reach it\n');

/* Vijay: "the app is not working, i am not getting the install option. can
   you add button so that doctor can click on install."

   Two separate failures, and the first is the one that made Chrome silent.

   1. THE MANIFEST WAS ONLY INJECTED BY JAVASCRIPT. Chrome decides whether
      a page is installable while it loads, and a manifest link appended
      afterwards is routinely missed - so the browser never offered to
      install anything. It must be in the HTML. */
const appPages = readdirSync('.')
  .filter(f => f.endsWith('.html'))
  .filter(f => readFileSync(f, 'utf8').includes('js/app-install.js'));

check('there are app pages to check', appPages.length > 10, String(appPages.length));
/* Either manifest counts: the clinic app declares /manifest.webmanifest and
   the owner console declares /owner.webmanifest. What must never happen is
   a page carrying NEITHER, because then Chrome decides during load that
   there is nothing to install and says nothing about it. */
const withoutManifest = appPages.filter(f =>
  !/<link rel="manifest" href="\/(manifest|owner)\.webmanifest">/.test(readFileSync(f, 'utf8')));
check('EVERY app page carries a STATIC manifest link, not an injected one',
  withoutManifest.length === 0, withoutManifest.join(', '));

/* THE PUBLIC PAGES ARE INSTALLABLE TOO, and the old reasoning here was
   wrong rather than merely narrow.

   This used to assert that index.html must NOT carry a manifest, because
   "an icon that opens an advert". But the manifest's start_url is
   /tcos-clinic.html, so an icon added from the landing page opens the APP.
   There was never an advert to protect her from.

   Vijay: "why do we have install button inside the signed in page, lets
   keep it outside, from the time of creating account till end it should be
   available." */
for (const page of ['index.html', 'apply.html', 'tcos-login.html']) {
  check(page + ' can be installed before she has an account',
    /rel="manifest"/.test(readFileSync(page, 'utf8')));
}

/* The patient pages must stay out: a patient must never be offered a clinic
   to install. They are the only ones left. */
for (const page of ['p.html', 'u.html']) {
  check(page + ' is deliberately not installable',
    !/rel="manifest"/.test(readFileSync(page, 'utf8')));
}

/* THE OWNER CONSOLE IS ITS OWN APP, with its own manifest and its own icon.
 *
   Vijay: "give me what is the owner app, tell me how can i download it ...
   i want you to give me the link." It was excluded before on the grounds
   that it is "a screen the doctor is not the user of" - but HE is its user,
   and Cloudflare Access stands in front of every /admin path either way, so
   installing it gets him an icon, not an entrance. */
const admin = readFileSync('admin.html', 'utf8');
check('the console declares its OWN manifest, not the clinic app\'s',
  /<link rel="manifest" href="\/owner\.webmanifest">/.test(admin));
check('and it can be installed from the sign-in screen',
  /data-tcos-install/.test(admin) && /js\/app-install\.js/.test(admin));

const owner = JSON.parse(readFileSync('owner.webmanifest', 'utf8'));
const clinic = JSON.parse(readFileSync('manifest.webmanifest', 'utf8'));
check('it opens the console, not the clinic', owner.start_url === '/admin');
check('THE TWO APPS ARE DIFFERENT APPS, so installing one cannot replace the other',
  owner.id !== clinic.id);
check('and they do not share an icon, so they are told apart on one home screen',
  owner.icons.every(i => !clinic.icons.some(c => c.src === i.src)));
check('the console icon exists', existsSync('assets/app/owner-512.png'));
check('its name says which one it is',
  owner.short_name === 'Owner' && /Owner Console/.test(owner.name));
check('the console wears navy where the clinic app wears teal',
  owner.theme_color === '#02254B' && clinic.theme_color !== owner.theme_color);
/* Named owner.webmanifest, NOT admin.webmanifest: Access protects every
   path beginning /admin, and a manifest answering with a login challenge
   instead of JSON is one the browser cannot read - the install option would
   simply never appear, and nothing would say why. */
check('ITS MANIFEST IS NOT BEHIND THE ACCESS PATH RULE',
  !owner.start_url.startsWith('/admin.webmanifest') &&
  /'owner\.webmanifest'/.test(build) && !/'admin\.webmanifest'/.test(build));
check('the console page declares its own apple touch icon too',
  /apple-touch-icon" href="\/assets\/app\/owner-192\.png"/.test(admin));

/* 2. NOTHING RENDERED A BUTTON. The whole install mechanism shipped and no
      screen ever offered it, which is the same as it not existing.

      The wiring now lives in app-install.js rather than nav.js, because
      nav.js only runs once she is signed in - which is the half of the
      journey she was already past. */
check('the rail still draws an Install button', /id="installAppBtn"/.test(nav));
check('and marks it for the shared wiring', /data-tcos-install/.test(nav));
check('which the rail asks for once it is painted',
  /window\.TCOSInstall\.wireAll\(\)/.test(nav));
check('the wiring itself is in app-install, not the rail',
  /wire\(button\)/.test(install) && !/function wireInstallButton/.test(nav));

/* Every public page must actually carry one, or "available from the start"
   is a claim and not a fact. */
for (const page of ['index.html', 'products.html', 'features.html',
                    'how.html', 'apply.html', 'tcos-login.html']) {
  check(page + ' offers the install button',
    /data-tcos-install/.test(readFileSync(page, 'utf8')));
}

/* ALWAYS OFFERED unless already installed. Hiding it until Chrome fires
   beforeinstallprompt is what a tidy implementation does and is wrong here:
   Safari never fires it, Chrome fires on its own schedule, and a doctor
   promised an app would find nothing and conclude the product is broken. */
check('IT IS HIDDEN ONLY WHEN THE APP IS ALREADY INSTALLED',
  /isStandalone\(\)\) \{ button\.hidden = true; return; \}[\s\S]{0,60}button\.hidden = false;/.test(install));
check('app-install exposes isStandalone so the rail can ask',
  /isStandalone,/.test(install));

/* Pressing it must always do something. */
check('pressing it prompts, or explains when there is no prompt',
  /await window\.TCOSInstall\.prompt\(\)[\s\S]{0,200}showInstallSteps/.test(install));

const steps = /steps\(\) \{[\s\S]*?\n    \},/.exec(install);
check('there are per-browser instructions', !!steps);
for (const [name, marker] of [
  ['iPhone', /Add to Home Screen/],
  ['Android', /Add to Home screen/],
  ['desktop Chrome', /install icon at the right-hand end of the address bar/],
  ['a browser that cannot', /cannot install web apps/]
]) {
  check(name + ' gets its own instructions', steps && marker.test(steps[0]));
}
/* Telling somebody to look for an icon their browser does not have is worse
   than telling them it cannot be done. */
check('and it distinguishes browsers that can install from ones that cannot',
  /isChromium/.test(install) && /isAndroid/.test(install));

console.log('\nThe check can fail\n');

/* CONTROL. If FINGERPRINTED matched everything, every "NEVER cached"
   assertion above would have passed for the wrong reason. */
check('CONTROL: the cache rule really does reject something',
  !FINGERPRINTED.test('/patients.html') && FINGERPRINTED.test('/js/a.deadbeef12.js'));
check('CONTROL: and really does accept something',
  CACHEABLE.every(p => FINGERPRINTED.test(p)));

/* =========================================================================
   HER DAILY SCREENS ON A PHONE.

   Vijay: "the doctors are saying the usage is not as per the mobile
   screen, they want a usable way - it is not good presentation."

   Bills are eight columns, patients, lab reports and the team six or
   seven. On a 375px phone every one became a sideways-scrolling strip: you
   could see whose bill it was, or whether it was paid, never both. So a
   row becomes a card, with each value beside its own column heading.

   THE MECHANISM IS OPT-IN AND THE OPT-IN HAS A COST. A cell with no
   data-label prints a bare value - "2", "300", "Paid" - with nothing
   saying what it is, which is worse than the scroll it replaced. These
   assertions are what stops a table opting in and forgetting the labels.
   ========================================================================= */

console.log('\nHer daily screens become cards on a phone\n');

const cardCss = css.replace(/\r\n?/g, '\n');

/* The card rules must live INSIDE the phone breakpoint. Outside it they
   would turn every desktop table into a column of cards. */
const phoneBlock = /@media \(max-width: 760px\) \{[\s\S]*?\n\}/.exec(cardCss);
check('the phone breakpoint was found to read', !!phoneBlock);
const phoneCss = phoneBlock ? phoneBlock[0] : '';
check('THE CARD LAYOUT IS INSIDE THE PHONE BREAKPOINT, NOT GLOBAL',
  /table\.grid\.cards/.test(phoneCss) &&
  !/table\.grid\.cards/.test(cardCss.replace(phoneCss, '')),
  'a desktop table would otherwise become a column of cards');
check('the heading of each card is NAMED, not the first cell',
  /td\[data-card-title\]/.test(phoneCss),
  'the pharmacy list opens with a toggle, so counting picks the wrong cell');
check('every other cell prints its own column heading',
  /content: attr\(data-label\)/.test(phoneCss));
check('and a cell with nothing to announce prints nothing',
  /td\[data-label=""\]::before \{ display: none/.test(phoneCss));

/* Found by this work rather than asserted before it: js/reports.js writes
   <small class="block"> and nothing anywhere defined .block, so a
   patient's number ran straight on from their name - on every screen size
   there has ever been. */
check('.block is actually defined, because the markup has always used it',
  /^\.block \{ display: block; \}/m.test(cardCss),
  'js/reports.js writes class="block" on two cells');

const CARD_TABLES = ['js/billing.js', 'js/pharmacy.js', 'js/reports.js',
  'js/team.js', 'patients.html'];

for (const page of CARD_TABLES) {
  const pageSource = readFileSync(page, 'utf8');
  check(page + ' opts its list into the card layout',
    /class="grid cards/.test(pageSource), 'no "grid cards" table');
  /* One title per card. Two would draw two headings; none would leave the
     card headed by whatever happens to come first. */
  check(page + ' names exactly one heading cell',
    (pageSource.match(/data-card-title/g) || []).length === 1,
    String((pageSource.match(/data-card-title/g) || []).length));
  /* Four is the smallest of these tables minus its title and its buttons;
     fewer means cells were left bare. */
  check(page + ' labels the rest of its cells',
    (pageSource.match(/data-label="/g) || []).length >= 4,
    (pageSource.match(/data-label="/g) || []).length + ' labels');
  /* An inline style beats a stylesheet rule, so a cell still carrying
     white-space:nowrap could not be unwrapped for the card - and its
     second button was pushed off the side of the phone. */
  check(page + ' uses the actions CLASS, not an inline nowrap',
    !/style="white-space:nowrap" data-label/.test(pageSource),
    'an inline style cannot be overridden by the card layout');
}

check('and that class still holds the buttons on one line on a desktop',
  /table\.grid td\.actions \{ white-space: nowrap; \}/.test(cardCss));
check('while inside a card it is allowed to wrap',
  /td\.actions \{ white-space: normal; \}/.test(phoneCss));

/* NOT every table. A lab trend and the capability matrix are comparisons
   ACROSS columns; turning either into a stack of cards destroys the only
   thing they are for. Those two scroll, deliberately. */
for (const [page, named] of [
  ['js/record.js', 'trend-table'], ['js/team.js', 'matrix']
]) {
  const pageSource = readFileSync(page, 'utf8');
  const opening = new RegExp('class="grid[^"]*' + named).exec(pageSource);
  check(named + ' is deliberately NOT carded - it is a comparison',
    !!opening && !/cards/.test(opening[0]), opening && opening[0]);
}

console.log('\nThe check can fail\n');

check('CONTROL: the card CSS really was read, not an empty string',
  phoneCss.length > 400 && cardCss.includes('data-card-title'),
  String(phoneCss.length));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);

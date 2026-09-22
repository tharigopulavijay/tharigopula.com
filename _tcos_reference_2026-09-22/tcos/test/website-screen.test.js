/* =========================================================================
   The Web screen.

   Vijay: "keep this button as WEB and let's give this option to doctors.
   It is real right, everyone wants their thing to be real."

   Everything it drives already existed. The point of the screen is that a
   doctor can find it, copy an address, and hand it to somebody - which she
   could not do while it sat inside Clinic setup between the working hours
   and the ABDM registry ids.

   Two things this guards, and both are honesty rather than layout:

     1. IT ONLY SHOWS ADDRESSES THAT WORK. The pretty subdomain
        (slug.clinical.tharigopula.com) has no DNS behind it yet. A doctor
        handed that address finds out from a patient that it does not
        resolve, so the screen shows the address the app actually serves.

     2. IT DOES NOT INVENT A PATIENT LOGIN. Patients have no account and no
        password - invariant 4. They open their own record through an
        unguessable link sent to them. A "Patient login" row, which is what
        the competitor screen that prompted this has, would be advertising a
        door that does not exist.

   Run:  node test/website-screen.test.js
   ========================================================================= */

import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

console.log('\nThe doctor has somewhere that is hers\n');

/* Comments stripped for every assertion that asks what the code DOES. These
   files explain the very bugs being guarded, at length, so the prose answers
   for the code - which has now caught this suite out three times in one
   session. A check that fires on its own explanation is a check nobody keeps. */
const strip = text => text
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

const page = strip(readFileSync('website.html', 'utf8'));
const ui = strip(readFileSync('js/website.js', 'utf8'));
const nav = readFileSync('js/nav.js', 'utf8');

/* ------------------------------------------------------- it is there --- */

check('the rail offers Web', /\['website\.html',[^\]]*'Web'/.test(nav));
check('and only to somebody who may change settings',
  /\['website\.html',[^\]]*'settings'/.test(nav));
check('and it is marked when the plan does not cover it',
  /\['website\.html',[^\]]*'website_connect'\]/.test(nav));
check('the screen uses the standard shell',
  /<div class="console">\s*<nav class="rail"><\/nav>\s*<main class="workspace">/.test(page));

/* --------------------------------------------- it drives what exists --- */

/* No new API. Every one of these was already built and already tested. */
for (const call of ['publicPageSettings', 'savePublicPage', 'domain',
                    'claimDomain', 'checkDomain', 'releaseDomain']) {
  check('it uses the existing ' + call + ' endpoint', ui.includes('TCOSApi.' + call));
}
check('and adds no endpoint of its own',
  !/TCOSApi\.(createWebsite|publishSite|provisionDomain)/.test(ui));

/* ------------------------------------------------------- it is honest --- */

/* `ui` is already comment-free; this alias just reads better below. */
const code = ui;

/* The subdomain is not served yet. Linking a doctor to it would be handing
   her an address that 404s, which she would discover from a patient. */
check('the links use the address the app actually serves',
  /clinic\.html\?c=/.test(code));
check('and are not built from the unrouted free subdomain',
  !/href[^;]{0,60}freeAddress/.test(code),
  'freeAddress has no DNS behind it yet');

/* Patients have no account - invariant 4. The competitor screen this came
   from lists a "Patient login"; copying that would advertise a door that
   does not exist. */
check('there is no patient login, because patients have no account',
  !/Patient login/i.test(page + ui));
check('it says instead that each patient gets their own private link',
  /own private link/i.test(ui));

/* This used to assert that a record we could not fill in was SHOWN and
   marked pending - the fix for a doctor being handed a www record, no apex,
   and no way to know her setup was incomplete.
 *
   That row is gone, and its absence is the stronger version of the same
   rule. There is no half-record left to mark: an A record was never going to
   work at all, because Cloudflare for SaaS routes by hostname and the edge
   answers 409 for a name it has not been told about. So now either every
   record is real, or none is shown and the screen says plainly that this is
   not switched on yet. */
check('when custom domains are not set up, the form is hidden entirely',
  /domainInfo\.available === false/.test(ui) &&
  /el\('domainForm'\)\.hidden = true/.test(ui),
  'showing her a form that fails on submit is the same bug in a new costume');
check('and she is told her TCOS address keeps working',
  /works today and always will/i.test(ui));

/* "Not switched on yet" and "you have not taken the add-on" are different
   sentences, and only one of them is true at a time. Showing the platform
   excuse to a doctor who simply has not paid gives her nothing to act on. */
check('a doctor without the add-on is shown the price, not a platform excuse',
  /domainInfo\.allowed === false/.test(ui) && /a month/.test(ui),
  'the two refusals must not share one message');
check('the price comes from the server, not hardcoded on the screen',
  /domainInfo\.addonPaise/.test(ui));
check('and she can ask for it without leaving the screen',
  /createSupportRequest/.test(ui) && /askDomain/.test(ui));
/* A mailto: produces no ticket and no record that she asked - the support
   flow already exists end to end, so it is used. */
check('the ask is a support request, not a mailto link',
  !/mailto:/.test(ui));
check('no A record is ever rendered, because there is no IP that works',
  !/\bA record\b/.test(ui) && !/'A'/.test(ui));

/* The two steps are separated. Proving ownership changes nothing about her
   existing website; adding the CNAME is the cutover. Shown as one flat list,
   a doctor switches her live clinic site over before the certificate exists
   and is down for the afternoon. */
check('the records are split into prove-it-is-yours and send-visitors-here',
  /Step 1 . prove the domain is yours/.test(ui) &&
  /Step 2 . send visitors/.test(ui));
check('and step 1 says it does not disturb her current website',
  /Nothing changes for your current website/i.test(ui));

/* She cannot know when a certificate lands. Without this she sits pressing a
   button, or closes the tab convinced it did not work. */
check('the screen checks for her while she waits',
  /setTimeout\(/.test(ui) && /TCOSApi\.checkDomain\(\)/.test(ui));
check('but only while there is something to wait for',
  /WAITING\.includes\(domainInfo\.status\)/.test(ui),
  'a screen left open on a live domain must not poll all day');
check('and not at all in a tab nobody is looking at',
  /visibilitychange/.test(ui) && /document\.hidden/.test(ui));
/* She did not ask for this one, so a failure must not throw an error banner
   over a screen she is not interacting with - it just tries again. */
check('a background check that fails stays silent',
  /checkDomain\(\)[\s\S]{0,220}\} catch \(_\) \{[^}]*\}/.test(ui),
  'the automatic check must not raise at her; the manual one still does');
check('while the button she pressed herself still reports failure',
  /catch \(error\) \{\s*msg\('domainMsg', error\.message, 'error'\)/.test(ui));

/* --------------------------------------------- shapes it must respect --- */

/* POST /me/domain returns {domain,status,records}; DELETE returns only
   {freeAddress}. Painting straight from either blanks the input or throws
   on records.length, so the screen re-reads. */
check('it re-reads the domain after a write rather than trusting the response',
  /await work\(\);\s*\n\s*domainInfo = await TCOSApi\.domain\(\)/.test(ui),
  'the write and read responses are different shapes');
check('and re-reads the page after saving, because the save omits the address',
  /savePublicPage\([\s\S]{0,400}publicPageSettings\(\)/.test(ui));

/* ------------------------------------------------------ it is gated --- */

check('the screen is gated on the plan like every other paid capability',
  /TCOSGate\.apply\([\s\S]{0,160}website_connect/.test(ui));
check('and turns a server refusal into the same explanation',
  /TCOSGate\.explain\(/.test(ui));

/* --------------------------------- and Clinic setup let it go --------- */

/* Two screens editing one setting is how work gets lost. Clinic setup used
   to rebuild the page hours from the weekly timings on EVERY save, so
   anything typed here was overwritten the next time she touched that
   screen. The server already falls back to the weekly timings when the page
   hours are blank, so writing them there was never needed. */
const setup = strip(readFileSync('practice.html', 'utf8'));
for (const gone of ['pageSlug', 'pageIntro', 'pagePublished', 'domainState',
                    'slugPrefix', 'connectPanel', 'savePublicPage',
                    'publicPageSettings', 'claimDomain', 'releaseDomain']) {
  check('Clinic setup no longer touches ' + gone, !setup.includes(gone));
}
check('and points at the Web screen instead',
  /href="website.html"/.test(setup));
/* Removing that block took the success message with it, which left Save
   doing nothing visible. */
check('Clinic setup still confirms a save',
  /Saved. Your next prescription uses these settings/.test(setup));
/* The things that must never have moved. */
for (const kept of ['recoveryNote', 'certificateFile', 'weeklyHours', 'closeFrom']) {
  check('and still owns ' + kept, setup.includes(kept));
}

/* The offer moved here rather than being deleted. */
check('the connect-an-existing-site offer came across',
  /Already have a website/.test(page));

/* CONTROL: these greps must be able to miss. */
check('CONTROL: the files were actually read',
  page.length > 2000 && ui.length > 3000 && nav.length > 5000,
  page.length + '/' + ui.length + '/' + nav.length);
check('CONTROL: a string nobody wrote is not found',
  !/zzzNotInTheWebScreen/.test(page + ui));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);

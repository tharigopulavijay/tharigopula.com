/* =========================================================================
   ABHA capture.

   The point of these is not that the parser is clever. It is that a real
   receptionist holding a real ABHA card can get the number into the system,
   however she happens to type it, and that the system never records
   something it cannot honestly claim.

   Run:  node test/abha.test.js
   ========================================================================= */

import {
  normaliseAbhaNumber, formatAbhaNumber, normaliseAbhaAddress,
  cleanAbhaStatus, cleanAbha, cleanHprId, cleanHfrId, ABHA_STATUSES
} from '../worker/abha.js';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};
const throws = (name, fn, expect) => {
  try { fn(); check(name, false, 'it was accepted'); }
  catch (e) {
    check(name, !expect || String(e.message).includes(expect),
      'wrong message: ' + e.message);
  }
};

/* --------------------------------------------------------- the number --- */
console.log('\nThe number, however it is typed\n');

/* Everyone writes it differently on paper. All three are the same number
   and all three must land in the database identically. */
check('bare digits', normaliseAbhaNumber('91123456789012') === '91123456789012');
check('hyphens as printed on the card',
  normaliseAbhaNumber('91-1234-5678-9012') === '91123456789012');
check('spaces', normaliseAbhaNumber('91 1234 5678 9012') === '91123456789012');
check('surrounding whitespace', normaliseAbhaNumber('  91-1234-5678-9012  ') === '91123456789012');

check('empty means empty, not an error', normaliseAbhaNumber('') === null);
check('undefined means empty', normaliseAbhaNumber(undefined) === null);

throws('13 digits is refused', () => normaliseAbhaNumber('9112345678901'), '14 digits');
throws('15 digits is refused', () => normaliseAbhaNumber('911234567890123'));
throws('letters are refused', () => normaliseAbhaNumber('91-1234-5678-901X'));

check('formatted back the way the card reads',
  formatAbhaNumber('91123456789012') === '91-1234-5678-9012');
check('formatting something incomplete does not crash',
  formatAbhaNumber('911') === '911');

/* --------------------------------------------------------- the address --- */
console.log('\nThe address\n');

check('a plain handle', normaliseAbhaAddress('vijay.t@abdm') === 'vijay.t@abdm');
check('case is folded, because nobody types it twice the same way',
  normaliseAbhaAddress('Vijay.T@ABDM') === 'vijay.t@abdm');
check('the sandbox suffix works too', normaliseAbhaAddress('test_user@sbx') === 'test_user@sbx');
check('empty means empty', normaliseAbhaAddress('   ') === null);

throws('no @ at all', () => normaliseAbhaAddress('vijaytharigopula'), 'name@abdm');
throws('a handle that is too short', () => normaliseAbhaAddress('ab@abdm'));
throws('a handle ending in a dot', () => normaliseAbhaAddress('vijay.@abdm'));
throws('a handle starting with an underscore', () => normaliseAbhaAddress('_vijay@abdm'));
throws('a spaced handle', () => normaliseAbhaAddress('vijay t@abdm'));

/* ---------------------------------------------------------- the status --- */
console.log('\nThe status\n');

check('the three states are the three states',
  ABHA_STATUSES.join(',') === 'unverified,verified,not_available');
check('nothing given defaults to unverified', cleanAbhaStatus('') === 'unverified');
check('"no ABHA" is a real answer we can record',
  cleanAbhaStatus('not_available') === 'not_available');
throws('an invented status', () => cleanAbhaStatus('probably'));

/* ------------------------------------------------------- the whole set --- */
console.log('\nThe fields have to agree with each other\n');

const saved = cleanAbha({ number: '91-1234-5678-9012', address: 'Vijay.T@abdm' });
check('a normal save keeps both, normalised',
  saved.number === '91123456789012' && saved.address === 'vijay.t@abdm'
  && saved.status === 'unverified');

check('recording that a patient has none is allowed',
  cleanAbha({ status: 'not_available' }).status === 'not_available');

/* A row saying "this patient has no ABHA" next to an ABHA number is a
   record that reads as a lie the moment anyone looks at it. */
throws('"no ABHA" together with an ABHA number',
  () => cleanAbha({ status: 'not_available', number: '91123456789012' }),
  'Pick one');

/* Nothing in TCOS has spoken to the gateway, so nothing in TCOS may put a
   tick next to a number. A hand-set "verified" would be trusted by every
   decision that came after it. */
throws('a human cannot mark an ABHA verified',
  () => cleanAbha({ status: 'verified', number: '91123456789012' }),
  'not connected to it yet');

/* ---------------------------------------------------- doctor and clinic --- */
console.log('\nHPR and HFR\n');

check('a numeric HPR id', cleanHprId('12345678901234') === '12345678901234');
check('a handle-style HPR id', cleanHprId('dr.vijay@hpr') === 'dr.vijay@hpr');
check('an HFR id', cleanHfrId('IN0710000123') === 'IN0710000123');
check('blank clears it, so a wrong id can be taken back out',
  cleanHprId('') === null && cleanHfrId('  ') === null);
throws('a sentence is not an id', () => cleanHprId('I have applied for it'));
throws('too short to be an id', () => cleanHprId('ab'));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);

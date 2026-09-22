/* Password-pepper rotation must not lock out every TCOS account. */

import { readFileSync } from 'node:fs';
import {
  hashPassword, verifyPasswordVersioned, activePepper, passwordPeppers
} from '@tharigopula/core/lib';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

console.log('\nA new pepper does not lock out an old account\n');

const password = 'DoctorPassword2026';
const old = await hashPassword(password, 'old-compromised-pepper');
const env = { PEPPER: 'old-compromised-pepper', PEPPER_V2: 'new-private-pepper' };

const oldCheck = await verifyPasswordVersioned(password, env, old.salt, old.hash);
check('an old-pepper password still verifies during rotation', oldCheck.ok === true);
check('and is explicitly marked for rehash', oldCheck.needsRehash === true);

const replacement = await hashPassword(password, activePepper(env));
const newCheck = await verifyPasswordVersioned(password, env, replacement.salt, replacement.hash);
check('the replacement uses V2', activePepper(env) === 'new-private-pepper');
check('a V2 password verifies without another rehash',
  newCheck.ok === true && newCheck.needsRehash === false);

const wrong = await verifyPasswordVersioned('WrongPassword', env, old.salt, old.hash);
check('a wrong password fails both generations', wrong.ok === false);

const legacy = passwordPeppers({ PEPPER: 'only-pepper' });
check('before V2 is installed, the existing pepper remains current',
  legacy.current === 'only-pepper' && legacy.previous === '');

console.log('\nEvery account path uses the rotation helpers\n');

const indexSource = readFileSync('worker/index.js', 'utf8');
const platformSource = readFileSync('worker/platform.js', 'utf8');
const repoSource = readFileSync('worker/repo.js', 'utf8');
const staffSource = readFileSync('worker/staff.js', 'utf8');
const shipped = indexSource + platformSource + repoSource + staffSource;

check('doctor and staff sign-in verifies both pepper generations',
  /verifyPasswordVersioned\([\s\S]{0,100}account\.password_salt/.test(indexSource));
check('platform-admin sign-in verifies both generations',
  /verifyPasswordVersioned\([\s\S]{0,100}member\.password_salt/.test(platformSource));
check('old doctor and staff hashes are upgraded after a successful sign-in',
  /staff\.rehashPassword/.test(indexSource) && /doctors\.rehashPassword/.test(indexSource));
check('old admin hashes are upgraded after a successful sign-in',
  /team\.rehashPassword/.test(platformSource));
check('new and reset passwords always use the active pepper',
  !/hashPassword\([^\n]*env\.PEPPER/.test(shipped) &&
  (shipped.match(/activePepper\(env\)/g) || []).length >= 8);
check('rehashing alone does not clear the first-login password requirement',
  /UPDATE doctors SET password_hash = \?, password_salt = \? WHERE id = \?/.test(repoSource) &&
  /UPDATE clinic_users SET password_hash = \?, password_salt = \? WHERE id = \?/.test(staffSource));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);

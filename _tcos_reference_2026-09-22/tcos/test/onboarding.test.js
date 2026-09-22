/* =========================================================================
   How a doctor joins.

   There used to be a self-signup route that created a live clinical account
   from a name, a clinic name and an SMS code. Nothing checked that the
   applicant was a doctor, and the account it made could issue prescriptions
   carrying TCOS's name. It also depended on an SMS provider that was never
   connected, so the one thing it reliably did was fail.

   It is now an application a human approves. These tests hold that shape in
   place: an application must not be an account, approval must be the only
   thing that creates one, and the queue must not be floodable.

   Run:  node test/onboarding.test.js
   ========================================================================= */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

const db = new DatabaseSync(':memory:');
db.exec(readFileSync('schema.sql', 'utf8'));

function applyMigration(path) {
  const withoutComments = readFileSync(path, 'utf8').split('\n')
    .filter(line => !line.trim().startsWith('--')).join('\n');
  for (const chunk of withoutComments.split(';')) {
    const statement = chunk.trim();
    if (!statement) continue;
    try { db.exec(statement + ';'); }
    catch (error) {
      if (!/duplicate column|already exists/i.test(error.message)) {
        console.log('  MIGRATION FAILED: ' + statement.slice(0, 60) + ' -> ' + error.message);
        failed++;
      }
    }
  }
}
/* Only what this file actually exercises. 009 is skipped deliberately: one
   of its inline comments contains a semicolon, and the splitter above cuts
   on semicolons, so it arrives here in fragments. Nothing in onboarding
   needs clinic_users. */
for (const name of ['012-products.sql', '013-doctor-applications.sql',
                    '037-doctor-council.sql']) {
  applyMigration('migrations/' + name);
}

const one = (sql, ...a) => db.prepare(sql).get(...a);
const run = (sql, ...a) => db.prepare(sql).run(...a);

const routerSource = readFileSync('worker/index.js', 'utf8');
const platformSource = readFileSync('worker/platform.js', 'utf8');

/* ------------------------------------------------------------------------ */
console.log('\nAn application is not an account\n');

run(`INSERT INTO doctor_applications
       (id, full_name, mobile, clinic_name, qualification, registration_no, discipline)
     VALUES ('app_1','Dr. Meena Iyer','+919812345678','Iyer Clinic','BHMS','CCH-1234','homeocos')`);

check('an application can be recorded with no account behind it',
  one("SELECT COUNT(*) c FROM doctor_applications WHERE id='app_1'").c === 1 &&
  one("SELECT COUNT(*) c FROM doctors WHERE mobile='+919812345678'").c === 0);

const columns = db.prepare('PRAGMA table_info(doctor_applications)').all().map(r => r.name);
check('an application carries no password of any kind',
  !columns.some(c => /password|hash|salt|token/i.test(c)),
  columns.filter(c => /password|hash|salt|token/i.test(c)).join(', '));

check('it starts as new, not approved',
  one("SELECT status FROM doctor_applications WHERE id='app_1'").status === 'new');

check('the registration number and council are kept, because they are what gets checked',
  columns.includes('registration_no') && columns.includes('council'));

const doctorColumns = db.prepare('PRAGMA table_info(doctors)').all().map(r => r.name);
check('the approved clinic keeps the council beside its registration number',
  doctorColumns.includes('council'));

check('the discipline applied for is stored, so a BHMS asking for AlloCOS is visible',
  one("SELECT discipline FROM doctor_applications WHERE id='app_1'").discipline === 'homeocos');

/* ------------------------------------------------------------------------ */
console.log('\nThe queue cannot be flooded\n');

let duplicateRejected = false;
try {
  run(`INSERT INTO doctor_applications (id, full_name, mobile, clinic_name)
       VALUES ('app_2','Dr. Meena Iyer','+919812345678','Iyer Clinic')`);
} catch (_) { duplicateRejected = true; }
check('a second OPEN application from the same mobile is refused by the database',
  duplicateRejected);

run("UPDATE doctor_applications SET status='rejected' WHERE id='app_1'");
let reapplyAllowed = true;
try {
  run(`INSERT INTO doctor_applications (id, full_name, mobile, clinic_name)
       VALUES ('app_3','Dr. Meena Iyer','+919812345678','Iyer Clinic')`);
} catch (_) { reapplyAllowed = false; }
check('but a doctor whose application was closed may apply again',
  reapplyAllowed);

check('a rejected application is kept, not deleted - it is the evidence we looked',
  one("SELECT COUNT(*) c FROM doctor_applications WHERE status='rejected'").c === 1);

/* ------------------------------------------------------------------------ */
console.log('\nApproval is the only thing that creates a doctor\n');

/* Bounded to the function body. An unbounded search finds the INSERT in
   createDoctor further down the file and reports the opposite of the truth. */
const submitBody = platformSource.slice(
  platformSource.indexOf('async submit(db, details)'),
  platformSource.indexOf('async list(db, status)'));
check('submit() writes to doctor_applications and never to doctors',
  submitBody.length > 0 &&
  /INSERT INTO doctor_applications/.test(submitBody) &&
  !/INSERT INTO doctors/.test(submitBody));

const approveBody = platformSource.slice(
  platformSource.indexOf('async approve(db, env, admin, id'),
  platformSource.indexOf('export const supportRequests'));
check('approve() creates the account through invites.createDoctor',
  /invites\.createDoctor/.test(approveBody));
check('approve() links the new doctor back to the application it came from',
  /doctor_id = \?/.test(approveBody) && /status = 'approved'/.test(approveBody));
check('approve() refuses to run twice on the same application',
  /already been approved/.test(approveBody));

check('a status field alone cannot flip an application to approved',
  /Use Approve, which creates the account/.test(platformSource));

/* ------------------------------------------------------------------------ */
console.log('\nWho may do what\n');

const routeGate = name => {
  const from = routerSource.indexOf("'" + name + "'");
  if (from === -1) return '';
  const next = routerSource.indexOf("\n  '", from + name.length + 2);
  return routerSource.slice(from, next === -1 ? routerSource.length : next);
};

check('POST /apply is public - a doctor with no account must be able to reach it',
  routeGate('POST /apply').includes('applications.submit') &&
  !routeGate('POST /apply').includes('requireAdmin'));

check('listing applications requires the applications capability',
  /requireAdminCapability\(env, request, 'applications'\)/.test(
    routeGate('GET /admin/applications')));

check('APPROVING requires fresh applications access - it creates a clinical account',
  /requireFreshAdminCapability\(env, request, 'applications'\)/.test(
    routeGate('POST /admin/applications/:id/approve')));

check('every application route records who acted, in the audit log',
  ['POST /apply', 'PATCH /admin/applications/:id', 'POST /admin/applications/:id/approve']
    .every(name => routeGate(name).includes('audit.write')));

/* ------------------------------------------------------------------------ */
console.log('\nSelf-signup stays gone\n');

check('the old signup routes no longer create a doctor',
  !/POST \/auth\/signup\/verify'[\s\S]{0,900}?doctors\.create/.test(routerSource));

check('and they explain where to go instead',
  /signup\/start'[\s\S]{0,400}?after we verify your registration/.test(routerSource));

/* ------------------------------------------------------------------------ */
console.log('\nThe account approval produces\n');

/* invites.createDoctor is shared with the manual onboarding button, so this
   is really a check on both paths at once. */
const createBody = platformSource.slice(
  platformSource.indexOf('async createDoctor(db, env, admin, details)'),
  platformSource.indexOf('async reissuePassword'));

check('starts on a temporary password the doctor must replace',
  /must_change_password/.test(createBody) && /,1\)/.test(createBody.replace(/\s/g, '')));
check('the temporary password is returned once and stored only as a hash',
  /return \{ doctorId: id, temporaryPassword,/.test(createBody) &&
  /hashPassword\(temporaryPassword/.test(createBody));
check('an unknown product falls back rather than being written as typed',
  /PRODUCTS\.includes\(details\.product\)/.test(createBody));
check('approval carries the council into the clinical account',
  /details\.council/.test(createBody) && /application\.council/.test(approveBody));

/* ------------------------------------------------------------------------
   Two bugs found by walking the real onboarding on 4 Sep 2026. Each one on
   its own stopped an approved doctor from using her account, and neither was
   visible to any test - because every other test signs in as a SEEDED doctor,
   and seeds are written already-correct. Approve is the only path that builds
   an account out of typed input, which is exactly why it was the broken one.
   ------------------------------------------------------------------------ */

/* A mobile is stored in the form sign-in looks it up in. Sign-in normalises
   9812345670 to +919812345670 before querying; approve wrote the raw string,
   the lookup missed it, and she was told her password was wrong - forever. */
check('the mobile is normalised before storing, not written as typed',
  /normaliseMobile\(details\.identifier\)/.test(createBody) &&
  /normaliseMobile\(details\.mobile\)/.test(platformSource),
  'approve creates accounts nobody can sign into');

const staffSource = readFileSync('worker/staff.js', 'utf8');
const doctorActor = staffSource.slice(
  staffSource.indexOf('export function actorFor'),
  staffSource.indexOf('let chosen = null'));

/* The staff branch always reported this; the doctor branch did not, so it read
   as undefined, every screen saw false, and the DOCTOR was never asked to
   replace her temporary password although her own receptionist was. */
check('a doctor reports mustChangePassword, exactly as a staff member does',
  /mustChangePassword:\s*!!doctor\.must_change_password/.test(doctorActor),
  'the forced password change never fires for the doctor herself');

/* ------------------------------------------------------------------------ */
console.log('\nVerification gates three things, and only three\n');

/* The argument for verifying at all is narrow on purpose: TCOS is a tool a
   doctor uses in her own clinic, and her patients already know who she is.
   It matters only where TCOS stops being her private tool and starts making
   a claim on her behalf. If this list ever grows quietly, the product has
   turned into a gatekeeper without anyone deciding to. */
/* Counted on the call itself. Matching the message string instead trips
   over the escaped apostrophe in "a patient's history" and silently counts
   one fewer than there are. */
const gatedRoutes = routerSource.match(/requireVerified\(doctor, '/g) || [];
check('exactly three routes require verification',
  gatedRoutes.length === 3, 'found ' + gatedRoutes.length);

check('publishing a public page is one of them',
  /requireVerified\(doctor, 'publish a public page/.test(routerSource));
/* Connecting a domain is the same claim as publishing, made louder: her
   registration number and our name on an address she chose. */
check('connecting a custom domain is one of them',
  /requireVerified\(doctor, 'connect your own domain'\)/.test(routerSource));
check('reaching another clinic\'s records is the other',
  /requireVerified\(doctor, 'see a patient\\\\'s history from other clinics'\)/.test(routerSource) ||
  /requireVerified\(doctor, [^)]*history from other clinics/.test(routerSource));

check('the public page withholds an unchecked registration number',
  /verification_status === 'verified'\s*\?\s*doctor\.registration_no : null/
    .test(readFileSync('worker/publicpage.js', 'utf8')));

for (const [file, label] of [['rx.html', 'the printed prescription'],
                             ['js/consult.js', 'the consultation prescription']]) {
  check(label + ' prints no registration number until it is checked',
    /signer\.verified && signer\.registrationNo/
      .test(readFileSync(file, 'utf8')));
}

/* The whole point of the tiering: a doctor who has not been verified can
   still run her practice. If one of these ever acquires a verification
   gate, TCOS has become a gatekeeper to somebody's own patient records. */
const mustStayOpen = ['POST /patients', 'POST /visits', 'POST /prescriptions',
  'POST /invoices', 'GET /me'];
const wronglyGated = mustStayOpen.filter(name => routeGate(name).includes('requireVerified'));
check('an unverified doctor can still register patients, consult, prescribe and bill',
  wronglyGated.length === 0, wronglyGated.join(', '));

/* Approving creates the account; it does not automatically claim the council
   register was checked. Those are different acts and were being conflated.

   Checking a registration against a council register takes weeks, and the
   policy is to onboard immediately and check in the background. The previous
   version marked EVERY approved doctor 'verified' with the note "Registration
   checked at onboarding", which put that claim on accounts where nobody had
   looked - and verification is what unlocks the public page, the printed
   registration number and cross-clinic history, so the claim has weight.

   `registerChecked` is the reviewer saying they genuinely looked it up there
   and then. It has to be asserted, not assumed. */
check('approving does not by itself claim the register was checked',
  /registerChecked/.test(approveBody) && /'pending'/.test(approveBody),
  'approval should record pending unless the reviewer says otherwise');
check('but a reviewer who did check can verify her on the spot',
  /checkedNow \? 'verified' : 'pending'/.test(approveBody));
check('and an unverified doctor is given a date, not left open-ended',
  /verify_by/.test(approveBody),
  'a deadline nobody set is a deadline nobody meets');

/* Withdrawing access has to say why, in words she reads. */
check('suspending a clinic requires a reason',
  /async suspend\(db, doctorId, admin, reason\)/.test(platformSource) &&
  /Say why, in words the doctor will read/.test(platformSource));
check('and the reason reaches the doctor rather than "contact support"',
  /suspended_reason/.test(routerSource) &&
  /records are safe/.test(routerSource));

check('verification can be withdrawn, not only granted',
  /'unverified', 'pending', 'verified', 'rejected'/.test(platformSource));

/* ------------------------------------------------------------------------ */
console.log('\nShe is given a way back into the account, and told her password\n');

/* approve() invites by SMS, and createDoctor used to write the email column
   as `channel === 'email' ? identifier : null`. So EVERY doctor approved
   from an application was created with no email address, and the one she
   had typed into the form was discarded.
 *
   While SMS waits on DLT, email is the only working recovery channel - so
   those accounts had no way back at all. Forget the password and the clinic
   is gone. */
check('approve() carries the applicant\'s email into the new account',
  /email:\s*overrides\.email \|\| application\.email/.test(approveBody), 'not passed through');

check('createDoctor stores an email whichever channel invited her',
  /details\.email \|\| \(channel === 'email' \? identifier : null\)/.test(createBody));
check('and the old channel-only rule is gone',
  !/^\s*channel === 'email' \? identifier : null,\s*$/m.test(createBody));

/* The thing Vijay asked for: no copying a password into WhatsApp by hand. */
check('createDoctor sends her the sign-in details', /sendDoctorWelcome/.test(createBody));
check('the temporary password is still returned as a fallback',
  /temporaryPassword,\s*emailedTo/.test(createBody));
check('a failed email is reported, not swallowed',
  /emailError = error\.message/.test(createBody));

/* Approval must survive the mail provider having a bad minute. If a send
   failure threw, a working account would be created and then reported as a
   failure, and somebody would approve her a second time. */
check('a failed email does not undo the approval',
  /catch \(error\) \{[\s\S]{0,120}emailError/.test(createBody));
check('the account is created BEFORE the email is attempted',
  createBody.indexOf('INSERT INTO doctors') < createBody.indexOf('sendDoctorWelcome'));

/* --------------------------- what she starts with ---------------------- */
console.log('\nA new doctor does not arrive to an empty examination form\n');

/* FOUND 19 SEPTEMBER 2026. js/products.js declared `defaultPacks` for each
   product - "packs a new doctor on this product starts with" - and nothing
   anywhere read it. approve() sent a hard [], so every account ever created
   through the normal flow had no clinical modules, and the consultation
   screen hides the examination card when there are none.

   An Ayurvedic doctor signed in to a workspace with no Nadi, no Jihva and no
   Prakriti. Both production doctors are still '[]' today. It survived because
   production has one prescription in it. */
const { defaultPacksFor } = await import('../worker/platform.js');

check('an Ayurveda doctor starts with the Ayurveda modules on',
  defaultPacksFor('ayurcos').includes('ayurveda') && defaultPacksFor('ayurcos').includes('nadi'),
  JSON.stringify(defaultPacksFor('ayurcos')));
check('a homeopath starts with hers', defaultPacksFor('homeocos').includes('homeopathy'));
check('an allopath starts with his', defaultPacksFor('allocos').includes('systemic'));
check('and an unknown product gets none rather than the wrong discipline\'s',
  defaultPacksFor('nonsense').length === 0);
check('the list is copied, so one doctor\'s changes cannot alter the next one\'s',
  defaultPacksFor('ayurcos') !== defaultPacksFor('ayurcos'));

/* Two copies of this list exist - the Worker creates the account, the
   browser file documents what each product is. Held equal here, the same way
   the domain add-on price is held equal across two files, because the day
   they drift a doctor is shown one thing and given another. */
const productsSource = readFileSync('js/products.js', 'utf8');
for (const product of ['ayurcos', 'homeocos', 'allocos']) {
  const block = productsSource.slice(productsSource.indexOf("id: '" + product + "'"));
  const declared = /defaultPacks:\s*\[([^\]]*)\]/.exec(block);
  const names = declared
    ? declared[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean) : null;
  check(product + ': the Worker and js/products.js agree on the starting modules',
    !!names && names.join(',') === defaultPacksFor(product).join(','),
    JSON.stringify(names) + ' vs ' + JSON.stringify(defaultPacksFor(product)));
}

/* The reviewer can still override, and an override of "none" must be
   honoured rather than quietly refilled with the defaults. */
const packChoiceSource = readFileSync('worker/platform.js', 'utf8');
check('an explicit empty choice by the reviewer is respected',
  /Array\.isArray\(details\.practicePacks\)\s*\?\s*details\.practicePacks/.test(packChoiceSource));
check('and approve passes undefined - not [] - when nobody chose',
  /Array\.isArray\(overrides\.practicePacks\)[\s\S]{0,90}:\s*undefined/.test(packChoiceSource));

/* --------------- the package and the account type, at approval --------- */
console.log('\nApproving is where the package and the account type are chosen\n');

/* Vijay, looking at the Applications screen: "i need to have a radio button
   where i check in if it is a demo or not... while aproving only i will need
   to do it."

   The console used to call approveApplication(id, {}) - it sent nothing - so
   every doctor approved here landed on Free whatever her application said,
   and there was nowhere at all to mark one as a demo. */
const consoleSource = readFileSync('js/tcos-admin-console.js', 'utf8');
const adminPageSource = readFileSync('admin.html', 'utf8');

check('the console no longer approves with an empty body',
  !/approveApplication\([^,]+,\s*\{\}\s*\)/.test(consoleSource));
check('it sends the package', /approveApplication\([\s\S]{0,200}plan:/.test(consoleSource));
check('and the account type', /approveApplication\([\s\S]{0,260}accountType/.test(consoleSource));

check('the approve dialog exists on the page', /id="approveDialog"/.test(adminPageSource));
check('with a live/demo radio, not a dropdown that can be missed',
  /name="approveAccountType"[^>]*value="live"/.test(adminPageSource) &&
  /name="approveAccountType"[^>]*value="demo"/.test(adminPageSource));
check('and a package picker covering all four',
  ['basic', 'starter', 'pro', 'pro_plus'].every(p =>
    new RegExp('id="appPlan"[\\s\\S]{0,400}value="' + p + '"').test(adminPageSource)));

/* LIVE IS THE DEFAULT, and the asymmetry is the reason. A wrongly live
   clinic complains about a bill and is fixed that day; a wrongly demo one
   is never charged and nobody notices for months. */
check('live is pre-selected in the markup',
  /value="live"[^>]*checked/.test(adminPageSource));
check('and re-selected every time the box opens, not left where it was',
  /approveAccountType"\]\[value="live"\]'\)\.checked = true/.test(consoleSource));

check('the Worker honours accountType on approval',
  /overrides\.accountType === 'demo'[\s\S]{0,120}setAccountType/.test(platformSource));
check('and nothing else can quietly turn an approval into a demo',
  (platformSource.match(/overrides\.accountType/g) || []).length === 1);

const emailSource = readFileSync('worker/email-templates.js', 'utf8');
check('the welcome email says the temporary password expires on first use',
  /stops working at that moment/.test(emailSource));
check('and gives her a way to say it was not her',
  /did not apply for this/.test(emailSource));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);

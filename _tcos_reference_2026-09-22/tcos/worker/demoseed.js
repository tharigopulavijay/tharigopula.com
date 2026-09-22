/* =========================================================================
   Twelve demonstration clinics: every product, every package.

   Vijay: "add different demo doctors in each products — like ayurcos free,
   practice, clinic, group; same with allocos and homeocos... so that how
   things are working in all the 3 i want to check."

   Three products times four packages is twelve accounts, and the point of
   having all twelve is that the differences between them are the product.
   Free next to Group in the same discipline shows what the money buys;
   AyurCOS next to HomeoCOS on the same package shows what the discipline
   changes. One of each proves nothing.

   WHY THIS IS A ROUTE AND NOT A SQL SCRIPT.
   A doctor's password is PBKDF2 over a pepper that lives in a Worker
   secret and is deliberately readable by nothing else - not by a seed file,
   not by wrangler, not by whoever is holding the laptop. So an account with
   a working password can only be created by the Worker itself. This is that
   path, behind admin authentication, rather than a hole in the wall.

   WHY ONE CLINIC PER CALL.
   Each password hash is 100,000 PBKDF2 rounds, about 10ms of CPU, and a
   Workers request has 10ms of CPU on the free plan. Twelve in one request
   is not slow, it is killed. So the console asks for them one at a time and
   shows each as it lands - which also means a failure halfway through has
   created nine real clinics rather than nothing, and pressing the button
   again finishes the job instead of starting it over.

   THEY ARE DEMO ACCOUNTS, AND THAT IS NOT DECORATION.
   account_type='demo' exempts them from the payment clock entirely: no
   trial, no grace, no nightly downgrade. A demonstration clinic that drops
   to Free on the morning it is being shown to somebody is the exact failure
   this flag exists to prevent. They are also excluded from revenue and
   attrition, so twelve fictional clinics never appear in the numbers.
   ========================================================================= */

import { newId, nowIso, badRequest, ApiError, hashPassword, activePepper,
  normaliseMobile } from '@tharigopula/core/lib';
import { defaultPacksFor } from './platform.js';

/* The four packages, in the order a doctor climbs them. 'basic' is Free. */
const PLANS = ['basic', 'starter', 'pro', 'pro_plus'];

const PLAN_WORD = {
  basic: 'Free', starter: 'Practice', pro: 'Clinic', pro_plus: 'Group'
};

/* A distinct, readable mobile per account, because the mobile IS the login
   and he will be typing these twelve times.

     9000000 1 x   AyurCOS      x = 1 Free, 2 Practice, 3 Clinic, 4 Group
     9000000 2 x   HomeoCOS
     9000000 3 x   AlloCOS

   The 9000000xxx range follows the demo convention already in this repo and
   is not a live Indian mobile series, so a real person can never be sent an
   SMS meant for a fictional clinic. */
const PRODUCT_BLOCK = { ayurcos: 1, homeocos: 2, allocos: 3 };

/* Names, clinics and credentials that read like the discipline they belong
   to. A homeopath with an Ayurvedic clinic name is the kind of detail that
   makes a demonstration feel assembled rather than real. */
const PEOPLE = {
  ayurcos: [
    ['Dr Ananya Rao', 'Ananya Ayurveda Kendra', 'BAMS', 'Hyderabad, Telangana'],
    ['Dr Harish Kulkarni', 'Sanjeevani Ayurveda Clinic', 'BAMS, MD (Ayurveda)', 'Pune, Maharashtra'],
    ['Dr Suhasini Reddy', 'Reddy Wellness Ayurveda', 'BAMS, MD (Panchakarma)', 'Hyderabad, Telangana'],
    ['Dr Vasudha Menon', 'Dhanvantari Ayurveda Group', 'BAMS, MD (Ayurveda)', 'Kochi, Kerala']
  ],
  homeocos: [
    ['Dr Meera Nair', 'Nair Homoeo Clinic', 'BHMS', 'Kochi, Kerala'],
    ['Dr Sandeep Bose', 'Bose Homoeopathy Centre', 'BHMS, MD (Hom)', 'Kolkata, West Bengal'],
    ['Dr Kavitha Iyer', 'Iyer Homoeo Care', 'BHMS, MD (Hom)', 'Chennai, Tamil Nadu'],
    ['Dr Prakash Deshmukh', 'Deshmukh Homoeopathy Group', 'BHMS, MD (Hom)', 'Nagpur, Maharashtra']
  ],
  allocos: [
    ['Dr Rakesh Menon', 'Menon Family Clinic', 'MBBS', 'Secunderabad, Telangana'],
    ['Dr Shalini Gupta', 'Gupta Polyclinic', 'MBBS, MD (Medicine)', 'Jaipur, Rajasthan'],
    ['Dr Imran Sheikh', 'Sheikh Medical Centre', 'MBBS, MS', 'Bengaluru, Karnataka'],
    ['Dr Latha Krishnan', 'Krishnan Healthcare Group', 'MBBS, MD, DNB', 'Chennai, Tamil Nadu']
  ]
};

const COUNCIL = {
  ayurcos: 'State Ayurveda Council (demo)',
  homeocos: 'State Homoeopathy Council (demo)',
  allocos: 'State Medical Council (demo)'
};

const PREFIX = { ayurcos: 'AYU', homeocos: 'HOM', allocos: 'ALO' };

/* The twelve, built rather than typed out, so adding a fourth discipline is
   an entry in PEOPLE and nothing else. */
export const DEMO_CLINICS = Object.keys(PRODUCT_BLOCK).flatMap(product =>
  PLANS.map((plan, index) => {
    const [fullName, clinicName, qualification, address] = PEOPLE[product][index];
    return {
      key: product + '-' + plan,
      product,
      plan,
      planWord: PLAN_WORD[plan],
      /* TEN DIGITS, and put through the same normaliser sign-in uses.
       *
         The first attempt at this built nine-digit numbers. They look
         perfectly fine in a table and every one of the twelve accounts
         would have been unreachable: sign-in runs the typed number through
         normaliseMobile before the lookup, so a row stored in any other
         shape is a row the query never finds. The account exists, the
         password is right, and she can never get in - which is exactly the
         bug that once broke every doctor approved through the console. */
      mobile: normaliseMobile('9' + '0000' + PRODUCT_BLOCK[product] + '000' + (index + 1)),
      fullName,
      clinicName,
      qualification,
      address,
      council: COUNCIL[product],
      registrationNo: 'DEMO/' + PREFIX[product] + '/' + (index + 1) + '00',
      patientPrefix: PREFIX[product] + (index + 1),
      tagline: PLAN_WORD[plan] + ' package · demonstration clinic',
      set: 'demo',
      setWord: 'Demonstration',
      note: 'Demo account — no billing'
    };
  })
);

/* =========================================================================
   AND THREE THAT ARE HIS, not a demonstration.

   Vijay: "i want 3 accounts in paid, as they are testing accounts, making
   vijay hospital 1,2,3 and enroll into all the 3 paid packages ... i want
   to check like each one what i am getting, so forcefully make this paid."

   THE THREE PAID PACKAGES, AND ONLY THOSE. Free is a package but it is not
   a paid one, so it is not here - three accounts, Practice, Clinic, Group.

   ALL THREE ARE AYURCOS ON PURPOSE. The question he is asking is what the
   money buys, and that comparison only holds if the discipline is the same
   on all three: one variable at a time. What the PRODUCT changes is
   already answered by the twelve above, where the same package appears in
   all three disciplines.

   "FORCEFULLY PAID" IS account_type='demo', AND THAT IS NOT A DOWNGRADE.
   featuresFor() hands a demo account its plan's whole feature set and
   never consults the payment clock - no trial, no grace, no nightly sweep
   to Free. It is the only way to hold an account at Group indefinitely
   without inventing a payment. The cost is that they are also left out of
   revenue and attrition, which is correct: three test hospitals must never
   show up as money somebody paid us.
   ========================================================================= */
const TEST_PLANS = ['starter', 'pro', 'pro_plus'];

export const OWNER_TEST_CLINICS = TEST_PLANS.map((plan, index) => ({
  key: 'test-vijay-' + (index + 1),
  product: 'ayurcos',
  plan,
  planWord: PLAN_WORD[plan],
  /* Block 9 of the same reserved range the twelve use: not a live Indian
     mobile series, so an SMS meant for a test hospital can never reach a
     real person - and put through the same normaliser sign-in uses, because
     a row stored in any other shape is a row the lookup never finds. */
  mobile: normaliseMobile('9' + '0000' + '9' + '000' + (index + 1)),
  fullName: 'Dr Vijay Tharigopula',
  clinicName: 'Vijay Hospital ' + (index + 1),
  qualification: 'BAMS',
  address: 'Hyderabad, Telangana',
  council: COUNCIL.ayurcos,
  registrationNo: 'TEST/VIJAY/' + (index + 1) + '00',
  patientPrefix: 'VH' + (index + 1),
  tagline: PLAN_WORD[plan] + ' package · owner test account',
  set: 'test',
  setWord: 'Owner test',
  note: 'Owner test account — no billing'
}));

/* Both sets go through one code path. They differ in what they are for and
   in nothing else: same hashing, same idempotency, same exemption. */
export const SEEDED_CLINICS = [...DEMO_CLINICS, ...OWNER_TEST_CLINICS];

const byKey = key => SEEDED_CLINICS.find(c => c.key === key) || null;

export const demoSeed = {
  /* What exists and what does not, so the console can show twelve rows and
     tick them off rather than reporting a single number at the end. */
  async status(db) {
    const { results } = await db.prepare(
      `SELECT id, mobile, clinic_name, plan, product, account_type, status
         FROM doctors WHERE account_type = 'demo'`
    ).all();
    const live = new Map((results || []).map(r => [r.mobile, r]));

    return SEEDED_CLINICS.map(clinic => {
      const row = live.get(clinic.mobile);
      return {
        key: clinic.key, product: clinic.product, plan: clinic.plan,
        planWord: clinic.planWord, clinicName: clinic.clinicName,
        fullName: clinic.fullName, mobile: clinic.mobile,
        set: clinic.set, setWord: clinic.setWord,
        exists: !!row,
        /* Named so a clinic that exists but drifted - somebody changed its
           plan by hand - is visible rather than silently counted as done. */
        planMatches: row ? row.plan === clinic.plan : null,
        doctorId: row ? row.id : null
      };
    });
  },

  /* Create or refresh ONE demonstration clinic.
   *
     Idempotent by mobile: pressing the button twice resets the password and
     the package rather than failing, which is what makes a half-finished
     run safe to repeat. */
  async create(db, env, key, password, actor) {
    const clinic = byKey(key);
    if (!clinic) throw new ApiError(404, 'not_found', 'No such demonstration clinic.');

    const secret = String(password || '');
    /* Short enough to type twelve times, long enough not to be the first
       thing somebody guesses at a production sign-in page. These accounts
       are real accounts on the real system; the only thing fictional about
       them is the clinic. */
    if (secret.length < 10) {
      throw badRequest('Choose a password of at least 10 characters. ' +
        'These are real accounts on the live system — only the clinics are made up.');
    }

    const { hash, salt } = await hashPassword(secret, activePepper(env));
    const now = nowIso();

    const existing = await db.prepare(
      'SELECT id FROM doctors WHERE mobile = ?').bind(clinic.mobile).first();

    if (existing) {
      await db.prepare(
        `UPDATE doctors
            SET password_hash = ?, password_salt = ?, must_change_password = 0,
                plan = ?, account_type = 'demo', plan_source = 'demo',
                plan_paid_until = NULL, plan_note = ?,
                plan_updated_at = ?, status = 'active', practice_packs = ?
          WHERE id = ?`
      ).bind(hash, salt, clinic.plan, clinic.note, now,
        JSON.stringify(defaultPacksFor(clinic.product)), existing.id).run();

      return { key, doctorId: existing.id, mobile: clinic.mobile,
        clinicName: clinic.clinicName, plan: clinic.plan, refreshed: true };
    }

    const id = newId('doc');
    await db.prepare(
      `INSERT INTO doctors
        (id, mobile, mobile_verified, email, full_name, qualification,
         registration_no, council, clinic_name, tagline, address, patient_prefix,
         practice_packs, line, plan, product, password_hash, password_salt,
         must_change_password, account_type, plan_source, plan_note,
         verification_status, verified_at, verification_note, status)
       VALUES (?,?,1,?,?,?,?,?,?,?,?,?,?,'doctor',?,?,?,?,0,'demo','demo',?,
               'verified',?,?, 'active')`
    ).bind(
      id, clinic.mobile,
      /* No email at all. A welcome mail for a clinic that does not exist is
         mail somebody real eventually receives, and a demo account has no
         recovery path to need because its password is one he sets. */
      null,
      clinic.fullName, clinic.qualification, clinic.registrationNo,
      clinic.council, clinic.clinicName, clinic.tagline, clinic.address,
      clinic.patientPrefix,
      JSON.stringify(defaultPacksFor(clinic.product)),
      clinic.plan, clinic.product, hash, salt,
      clinic.note,
      now,
      /* Verified, because an unverified clinic hides its registration
         number and its public page - two of the things he is opening these
         to look at. The note says plainly that nobody checked a register. */
      clinic.setWord + ' account. No council register was checked.'
    ).run();

    await db.prepare(
      `INSERT INTO audit_events (id, doctor_id, actor, action, target_type, target_id, detail)
       VALUES (?,?,?,?,?,?,?)`
    ).bind(newId('aud'), id, String(actor || 'platform'), 'demo_clinic_created',
      'doctor', id,
      clinic.setWord + ' · ' + clinic.product + ' · ' + clinic.planWord).run();

    return { key, doctorId: id, mobile: clinic.mobile,
      clinicName: clinic.clinicName, plan: clinic.plan, refreshed: false };
  },

  /* Remove them all. Seeded clinics are meant to be thrown away and
     rebuilt, and leaving fifteen accounts with one shared password on a
     production system after the demonstration is over is how that password
     stops being a demo password.

     THIS TAKES THE THREE TEST HOSPITALS TOO, because the selector is
     account_type='demo' and that is what holds them off the payment clock.
     Selecting by a hardcoded list instead would silently spare any seeded
     row whose mobile was later edited by hand - a fictional clinic left
     behind on a live system, which is the worse failure. The console says
     so on the button rather than surprising him with it. */
  async removeAll(db) {
    const { results } = await db.prepare(
      "SELECT id FROM doctors WHERE account_type = 'demo'").all();
    for (const row of (results || [])) {
      /* The schema cascades from doctors, so the clinic's patients, visits
         and prescriptions go with it. That is right here and nowhere else:
         these are the only clinics whose records are fiction. */
      await db.prepare('DELETE FROM doctors WHERE id = ?').bind(row.id).run();
    }
    return { removed: (results || []).length };
  }
};

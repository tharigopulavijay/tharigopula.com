/* =========================================================================
   Coupons.

   Vijay: "i want to have coupons management here - add a coupon id and the %
   discount, able to delete, like any festival offer, and i can add and
   delete or uncheck it so people can use while purchasing."

   THE ASSERTION THIS FILE EXISTS FOR.
   Razorpay charges the card against a plan. A percentage typed into TCOS
   changes nothing on their side: the doctor reads "10% off", agrees, and is
   charged the full amount. Only Razorpay's own Offer discounts the charge,
   and offers can only be created in their dashboard.

   So a coupon cannot be switched ON without a provider offer id, and what
   travels to Razorpay is that id - never our percentage. Everything else
   here is ordinary CRUD; that one rule is the difference between a discount
   and a lie.

   Run:  node test/coupons.test.js
   ========================================================================= */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { coupons, normaliseCode } from '../worker/coupons.js';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

/* Real SQLite, real schema, so the SQL under test is the SQL that runs. */
const raw = new DatabaseSync(':memory:');
raw.exec(readFileSync('schema.sql', 'utf8'));
raw.exec(readFileSync('migrations/057-coupons.sql', 'utf8'));
raw.exec(`INSERT INTO doctors (id, mobile, full_name, clinic_name)
          VALUES ('doc_A','+919000000001','Dr A','Clinic A'),
                 ('doc_B','+919000000002','Dr B','Clinic B');`);

/* The D1 shape over node:sqlite. */
const db = {
  prepare(sql) {
    const stmt = raw.prepare(sql);
    return {
      bind(...args) {
        return {
          async first() { return stmt.get(...args) ?? null; },
          async all() { return { results: stmt.all(...args) }; },
          async run() { return stmt.run(...args); },
          _args: args, _stmt: stmt
        };
      },
      async first() { return stmt.get() ?? null; },
      async all() { return { results: stmt.all() }; },
      async run() { return stmt.run(); }
    };
  },
  async batch(list) { for (const s of list) await s.run(); return []; }
};

const caught = async fn => {
  try { await fn(); return null; } catch (error) { return error; }
};

console.log('\nCoupons\n');

/* ------------------------------------------------------ the code itself --- */

check('a code is stored upper case, however it was typed',
  normaliseCode('  diwali25 ') === 'DIWALI25', normaliseCode(' diwali25 '));
check('a code with a space is refused, because nobody can read it out',
  !!(await caught(async () => normaliseCode('DIWALI 25'))));
check('and an empty one is refused', !!(await caught(async () => normaliseCode(''))));

/* ---------------------------------------------------------- creating --- */

const made = await coupons.create(db, {
  code: 'tcos10', label: 'Launch', percentOff: 10
}, 'owner@tcos');
check('a coupon is created with the code upper-cased', made.code === 'TCOS10');
check('the discount is a whole percent', made.percentOff === 10);

/* It is made, looked at, and only then switched on. There is no hurry that
   justifies a code going live in the click that typed it. */
check('a new coupon is NEVER live on creation', made.active === false);
check('and it says why it is not usable',
  made.usable === false && /Razorpay offer/i.test(made.reason), made.reason);

check('a percentage outside 1-100 is refused',
  !!(await caught(() => coupons.create(db, { code: 'X1', percentOff: 0 }))) &&
  !!(await caught(() => coupons.create(db, { code: 'X2', percentOff: 101 }))));
check('a duplicate code is refused',
  !!(await caught(() => coupons.create(db, { code: 'TCOS10', percentOff: 5 }))));
check('a malformed Razorpay offer id is refused before it can be saved',
  !!(await caught(() => coupons.create(db,
    { code: 'X3', percentOff: 5, providerOfferId: 'not-an-offer' }))));

/* ------------------------------- THE RULE THAT MAKES THIS REAL ---------- */

const refused = await caught(() => coupons.update(db, made.id, { active: true }));
check('a coupon CANNOT be switched on without a Razorpay offer', !!refused,
  'without this, the screen promises a discount the card never gets');
check('and the refusal says exactly what to do',
  refused && /Create the offer in Razorpay/i.test(refused.message), refused && refused.message);

const live = await coupons.update(db, made.id, {
  providerOfferId: 'offer_ABC123XYZ', active: true
});
check('with an offer linked it goes live', live.active === true && live.usable === true,
  live.reason);

/* ---------------------------------------------------------- editing --- */

const renamed = await coupons.update(db, made.id, { percentOff: 25, label: 'Diwali' });
check('the discount is editable', renamed.percentOff === 25);
check('and editing one field does not blank the others',
  renamed.providerOfferId === 'offer_ABC123XYZ' && renamed.active === true &&
  renamed.code === 'TCOS10');

const off = await coupons.update(db, made.id, { active: false });
check('it can be switched off without being deleted - the festival ends',
  off.active === false && off.usable === false);
await coupons.update(db, made.id, { active: true });

/* ---------------------------------------------------------- claiming --- */

let claimed = await coupons.claim(db, 'doc_A', 'tcos10', 'starter');
check('a doctor can claim it in any case', claimed.code === 'TCOS10');
check('and what comes back is the OFFER id, not our percentage',
  claimed.offerId === 'offer_ABC123XYZ',
  'the percentage is what we display; the offer is what discounts the card');

let error = await caught(() => coupons.claim(db, 'doc_A', 'NOPE99', 'starter'));
check('an unknown code is refused', !!error);
/* Deliberately vague, and only here: a specific answer would let anyone
   enumerate live codes by trying them. */
check('and says nothing that would help someone guess live codes',
  error && !/expired|switched off|redeemed/i.test(error.message), error && error.message);

await coupons.update(db, made.id, { active: false });
error = await caught(() => coupons.claim(db, 'doc_A', 'TCOS10', 'starter'));
check('a switched-off code cannot be claimed', !!error);
check('and a doctor holding a printed advert is told why',
  error && /switched off/i.test(error.message), error && error.message);
await coupons.update(db, made.id, { active: true });

/* ------------------------------------------------------ the windows --- */

const past = await coupons.create(db, { code: 'OLD1', percentOff: 5 });
await coupons.update(db, past.id, {
  providerOfferId: 'offer_OLD123456', endsOn: '2020-01-01', active: true
});
error = await caught(() => coupons.claim(db, 'doc_A', 'OLD1', 'starter'));
check('a coupon past its end date cannot be claimed', !!error &&
  /Ended on/i.test(error.message), error && error.message);

const planned = await coupons.create(db, { code: 'GRPONLY', percentOff: 20 });
await coupons.update(db, planned.id, {
  providerOfferId: 'offer_GRP1234567', plans: ['pro_plus'], active: true
});
check('a plan-limited coupon works on its plan',
  (await coupons.claim(db, 'doc_A', 'GRPONLY', 'pro_plus')).percentOff === 20);
check('and is refused on another',
  !!(await caught(() => coupons.claim(db, 'doc_A', 'GRPONLY', 'starter'))));
check('a coupon cannot be aimed at Free, which needs no discount',
  !!(await caught(() => coupons.create(db,
    { code: 'FREEBIE', percentOff: 10, plans: ['basic'] }))));

/* -------------------------------------------------- limits and usage --- */

const once = await coupons.create(db, { code: 'ONEEACH', percentOff: 15 });
await coupons.update(db, once.id, {
  providerOfferId: 'offer_ONCE123456', oncePerClinic: true, active: true
});
claimed = await coupons.claim(db, 'doc_A', 'ONEEACH', 'starter');
await coupons.recordRedemption(db, claimed, 'doc_A', 'sub_1', 'starter', 'monthly');
check('a one-per-clinic coupon is refused the second time',
  !!(await caught(() => coupons.claim(db, 'doc_A', 'ONEEACH', 'starter'))));
check('but another clinic can still use it',
  (await coupons.claim(db, 'doc_B', 'ONEEACH', 'starter')).code === 'ONEEACH');
check('a redemption is counted',
  (await coupons.list(db)).find(c => c.code === 'ONEEACH').timesRedeemed === 1);

/* A double-submit must not double-count a limited offer. */
await coupons.recordRedemption(db, claimed, 'doc_A', 'sub_1', 'starter', 'monthly');
check('and recording the same redemption twice does not double-count it',
  (await coupons.list(db)).find(c => c.code === 'ONEEACH').timesRedeemed === 1);

const capped = await coupons.create(db, { code: 'FIRST1', percentOff: 30 });
await coupons.update(db, capped.id, {
  providerOfferId: 'offer_CAP1234567', maxRedemptions: 1, active: true
});
const capClaim = await coupons.claim(db, 'doc_A', 'FIRST1', 'starter');
await coupons.recordRedemption(db, capClaim, 'doc_A', 'sub_2', 'starter', 'monthly');
error = await caught(() => coupons.claim(db, 'doc_B', 'FIRST1', 'starter'));
check('a coupon at its usage cap is refused', !!error &&
  /redeemed/i.test(error.message), error && error.message);

/* --------------------------------------------------------- deleting --- */

const unused = await coupons.create(db, { code: 'SCRATCH', percentOff: 5 });
check('an unused coupon is really deleted',
  (await coupons.remove(db, unused.id)).deleted === true);
check('and is gone from the list',
  !(await coupons.list(db)).some(c => c.code === 'SCRATCH'));

/* Deleting a used coupon would take its redemptions with it - and with them
   the answer to "how did Diwali actually do". */
const used = await coupons.remove(db, once.id);
check('a coupon that has been used is switched off, not deleted',
  used.deleted === false && used.switchedOff === true);
check('and it says why, rather than looking like the delete failed',
  /switched off rather than deleted/i.test(used.message), used.message);
check('its redemptions survive',
  (await coupons.redemptions(db, once.id)).length === 1);
check('and the record names the clinic, so the offer can be judged',
  (await coupons.redemptions(db, once.id))[0].clinic_name === 'Clinic A');

/* ------------------------------------------------------- it is wired --- */

const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const subs = strip(readFileSync('worker/subscriptions.js', 'utf8'));
check('checkout hands Razorpay the offer id',
  /offer_id: coupon\.offerId/.test(subs),
  'without this the coupon is decoration and the card is charged in full');
check('and the coupon is checked BEFORE the subscription is created',
  subs.indexOf('coupons.claim(') < subs.indexOf("providerRequest(env, '/subscriptions'"),
  'a code refused after checkout exists is refused too late');
check('the redemption is recorded only once the subscription exists',
  subs.indexOf('coupons.recordRedemption') > subs.indexOf("providerRequest(env, '/subscriptions'"),
  'an abandoned checkout must not burn a limited offer');
check('our percentage is never sent to Razorpay as the discount',
  !/percent[^:]*:\s*coupon\.percentOff/i.test(subs));

const router = strip(readFileSync('worker/index.js', 'utf8'));
for (const route of ['GET /admin/coupons', 'POST /admin/coupons',
                     'PATCH /admin/coupons/:id', 'DELETE /admin/coupons/:id']) {
  check('the console can ' + route,
    router.includes("'" + route + "':"));
}
/* Money. Every write re-checks the password, like the other money routes. */
for (const route of ['POST /admin/coupons', 'PATCH /admin/coupons/:id',
                     'DELETE /admin/coupons/:id']) {
  const at = router.indexOf("'" + route + "':");
  check(route + ' demands a fresh sign-in',
    /requireFreshAdminCapability\(env, request, 'money'\)/
      .test(router.slice(at, at + 300)));
}

const html = readFileSync('admin.html', 'utf8');
check('the console has a Coupons screen',
  /data-view="coupons"/.test(html) && /data-panel="coupons"/.test(html));
check('and it says plainly where the discount actually happens',
  /discount happens at Razorpay/i.test(html));

/* ------------------------------------------------------------ controls --- */

check('CONTROL: the database was really written',
  (await coupons.list(db)).length >= 4, String((await coupons.list(db)).length));
check('CONTROL: a code nobody created is absent',
  !(await coupons.list(db)).some(c => c.code === 'ZZNOTREAL'));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);

/* =========================================================================
   What a clinic's plan actually lets it do.

   WHY THIS EXISTS
   Until 12 September 2026 the plan controlled four things - doctor seats,
   staff seats, AI document reads and storage - and nothing else. Every
   feature was open on every plan, Free included. A clinic on Free had the
   full pharmacy, the whole billing module, lab reports and the patient
   portal.

   Vijay found it by looking at his own account: "Vijay Hospital is on Free,
   why is she getting all the options?"

   That made the plans screen a lie in the expensive direction: it told a
   doctor that ₹899 would add pharmacy, billing and reports when she already
   had all three. Nobody upgrades for something they already have, and
   anybody who did would rightly feel had.

   TWO RULES THIS FILE KEEPS

   1. A PLAN IS A PRESET, NOT A LOCK. Plan defaults come first, then
      doctors.feature_overrides on top - the admin console can switch any
      single capability on for one clinic without inventing a new plan. That
      is why "automatic on payment" and "manual override" are one mechanism
      rather than two competing ones.

   2. A DOWNGRADE NEVER TAKES AWAY WHAT SHE ALREADY ENTERED. This gates
      WRITES only. A clinic that drops to Free keeps reading its pharmacy
      stock, its invoices and its lab reports - it simply cannot add more
      until it moves back up. Her expiry dates and her old invoices are her
      records, not ours to withhold, and a locked door converts worse than a
      prompt that appears exactly when she wants to work.

   The feature lists are duplicated from js/tcos-plans.js because the
   browser cannot be trusted with a permission and the Worker cannot load a
   browser IIFE. test/entitlements.test.js fails if the two ever disagree,
   so the duplication cannot rot.
   ========================================================================= */

import { ApiError } from '@tharigopula/core/lib';

/* Always on, at every plan including Free: the things that make TCOS a
   clinical record at all. Taking any of these away would leave a doctor
   unable to see patients. */
const ALWAYS = ['patients', 'appointments', 'prescriptions', 'practice_packs'];

export const PLAN_FEATURES = {
  basic: [...ALWAYS],
  starter: [...ALWAYS,
    'lab_reports', 'pharmacy', 'billing', 'reports',
    'website_connect', 'patient_portal', 'staff_logins',
    'ai_lab_extract'],
  pro: [...ALWAYS,
    'lab_reports', 'pharmacy', 'billing', 'reports',
    'website_connect', 'patient_portal', 'staff_logins',
    'ai_lab_extract', 'ai_summary',
    'multi_doctor', 'shared_calendar', 'automation_basic'],
  pro_plus: [...ALWAYS,
    'lab_reports', 'pharmacy', 'billing', 'reports',
    'website_connect', 'patient_portal', 'staff_logins',
    'ai_lab_extract', 'ai_summary', 'insights',
    'multi_doctor', 'shared_calendar', 'multi_location',
    'automation_basic', 'priority_support']
};

/* The legacy key some rows still carry - see migration 030. Identical to
   Clinic so nobody already onboarded loses anything. */
PLAN_FEATURES.clinic = PLAN_FEATURES.pro;

/* ONE CAPABILITY IS DELIBERATELY IN NO PLAN AT ALL: custom_domain.
 *
   Everything else above is software. Switching pharmacy on for one more
   doctor costs nothing, so it can ride on a plan. A doctor's OWN domain
   does not: Cloudflare bills per custom hostname, and an apex domain needs
   two of them - drclinic.com and www.drclinic.com - because a certificate
   covers exactly one name.
 *
   Worse, Cloudflare bills a hostname from the moment it is created,
   including one that is merely pending validation. A doctor who connects a
   domain, never finishes her DNS and forgets about it costs money every
   month until somebody deletes it.
 *
   Vijay: "we need to have a button on owner side so only when the customer
   want i will enable else i will not enable... we need to tell that monthly
   50rs for this for who ever wants this."
 *
   So it is granted per clinic from the owner console, never by paying for a
   plan. The mechanism is the override that already exists - which is why
   there is no new switch here, only an absence. A doctor on Group still has
   to ask, and somebody still has to say yes.
 *
   The test suite asserts this absence, so a well-meaning edit that adds
   custom_domain to pro_plus fails rather than quietly putting every clinic
   on the bill. */

/* ---------------------------------------------------------------------
   WHAT A LAPSE COSTS, AND WHY THERE ARE TWO GRACE PERIODS.

   Vijay: "7 days is little high time. lets do one thing - the things which
   are chargable to us lets give 3 days for that, and remaining all lets
   give 7 days which are not charging us."

   That is a better rule than one number, and it is better for a reason
   worth writing down: these two kinds of feature fail differently.

   Switching pharmacy on for a clinic that has not paid costs us nothing -
   it is software that already exists, and taking it away mid-week is how a
   doctor loses her stock list while a patient is at the counter. Running
   her lab report through a model costs real money on our card, every time,
   and an unpaid clinic doing it for a fortnight is a bill we pay.

   So the expensive things stop first. */
export const METERED = new Set([
  'ai_lab_extract', 'ai_summary', 'ai_voice_rx', 'ai_copilot', 'insights',
  'whatsapp', 'messages'
]);

export const GRACE_DAYS = {
  /* Costs us money per use. Three days covers a weekend. */
  metered: 3,
  /* Costs us nothing per use. Seven days covers a holiday, a week of
     leave, or a card that failed while she was in theatre. */
  rest: 7
};

const DAY = 86400000;

/* How far past her paid-until date she is, in days. Negative while she is
   still inside the period she paid for.

   THE DATE IS INCLUSIVE, AND THAT IS NOT A DETAIL. A clinic paid "until
   19 September" owns the whole of the 19th. Parsing a bare date gives
   midnight, which would end her plan as the 19th BEGINS - a full day she
   paid for, taken back, every single month. Half a day's drift here is the
   difference between the grace window being three days and being two and a
   half, which is what this got wrong first time round.

   End of day is taken in UTC while the doctor is in IST, so she gains five
   and a half hours. That is the right direction to be imprecise in: erring
   towards the clinic keeping what it paid for. */
function daysLapsed(doctor, now) {
  const until = doctor && doctor.plan_paid_until;
  if (!until) return null;              /* no clock running - see below */
  const text = String(until);
  const ends = Date.parse(
    /^\d{4}-\d{2}-\d{2}$/.test(text) ? text + 'T23:59:59.999Z' : text);
  if (Number.isNaN(ends)) return null;  /* unreadable: treat as no clock */
  return (now - ends) / DAY;
}

/* What the doctor can use right now: the plan's preset, then what the
   payment clock says, then whatever the platform has switched on or off
   for this one clinic.

   An unknown plan falls back to `basic` rather than to everything. A typo
   in a plan name must not hand out the whole product. */
export function featuresFor(doctor, now = Date.now()) {
  const base = new Set(PLAN_FEATURES[doctor && doctor.plan] || PLAN_FEATURES.basic);

  /* A DEMO ACCOUNT NEVER MEETS ANY OF THIS.
     Vijay: "all features of that package should be present without any
     payment related thing." No clock, no grace, no downgrade. A demo that
     starts asking for a card halfway through a demonstration is worse than
     having no demo at all. */
  const isDemo = doctor && doctor.account_type === 'demo';

  if (!isDemo) {
    const lapsed = daysLapsed(doctor, now);

    /* NULL IS NOT "EXPIRED". A Free clinic, a demo, and every row that
       predates the payment clock all have no date here. Reading that as a
       lapse would take the product away from everybody at once, quietly,
       on the first nightly sweep. */
    if (lapsed !== null && lapsed > 0) {
      if (lapsed > GRACE_DAYS.metered) {
        for (const key of METERED) base.delete(key);
      }
      if (lapsed > GRACE_DAYS.rest) {
        /* Past both windows she is on Free, whatever the plan column still
           says. The nightly sweep writes that down; this makes it true
           immediately, so the gap between lapsing and the sweep running is
           not a window in which the plan is still honoured. */
        for (const key of base) {
          if (!PLAN_FEATURES.basic.includes(key)) base.delete(key);
        }
      }
    }
  }

  let overrides = {};
  try { overrides = JSON.parse((doctor && doctor.feature_overrides) || '{}'); }
  catch (_) { overrides = {}; }

  /* Overrides run LAST, so an explicit grant from the owner console
     survives a lapse. That is the point of them: "her card is failing, keep
     her pharmacy on while we sort it out" has to be expressible, and it
     cannot be if the clock overwrites it afterwards. */
  for (const [key, on] of Object.entries(overrides)) {
    if (on === true) base.add(key);
    else if (on === false) base.delete(key);
  }
  return base;
}

/* For the screens that have to explain themselves: where she is on the
   clock, in words the owner console and the doctor's own plan page can
   both use without re-deriving the rule. */
export function planStanding(doctor, now = Date.now()) {
  if (doctor && doctor.account_type === 'demo') {
    return { state: 'demo', daysLeft: null, paidUntil: null };
  }
  const lapsed = daysLapsed(doctor, now);
  if (lapsed === null) return { state: 'none', daysLeft: null, paidUntil: null };

  const paidUntil = doctor.plan_paid_until;

  /* FLOOR, NEVER CEIL. These numbers are shown to a doctor as "5 days
     left", and rounding up promises her a day she does not have - which is
     the one direction a billing countdown must never be wrong in. Half a
     day remaining reads as 0, and 0 is honest. */
  const whole = value => Math.max(0, Math.floor(value));

  if (lapsed <= 0) {
    return { state: 'paid', daysLeft: whole(-lapsed), paidUntil };
  }
  if (lapsed <= GRACE_DAYS.metered) {
    return { state: 'grace_full', daysLeft: whole(GRACE_DAYS.metered - lapsed), paidUntil };
  }
  if (lapsed <= GRACE_DAYS.rest) {
    return { state: 'grace_reduced', daysLeft: whole(GRACE_DAYS.rest - lapsed), paidUntil };
  }
  return { state: 'lapsed', daysLeft: 0, paidUntil };
}

export const hasFeature = (doctor, key) => featuresFor(doctor).has(key);

/* Names a doctor recognises. The message has to say what to do about it,
   not just that something is refused. */
const LABEL = {
  pharmacy: 'the pharmacy',
  billing: 'invoicing and payments',
  lab_reports: 'lab reports',
  patient_portal: 'the patient portal',
  website_connect: 'booking from your website',
  custom_domain: 'connecting your own domain name',
  ai_summary: 'history summaries',
  insights: 'practice insights',
  automation_basic: 'follow-up rules',
  multi_location: 'multiple branches'
};

/* Called before a WRITE, never before a read. 402 rather than 403: this is
   not "you are not allowed", it is "your plan does not include this yet",
   and the client turns a 402 into an upgrade prompt rather than an error. */
/* Paid extras that are NOT on any plan, with what they cost. Kept beside the
   refusal because the two must agree: telling a doctor to "move up a plan"
   for something no plan includes sends her to buy Group, find her domain
   still refused, and rightly feel cheated. */
export const ADDONS = {
  custom_domain: {
    pricePaise: 5000,
    message: 'Using your own domain name is an extra, because it costs us ' +
      'for every clinic that uses one. It is ₹50 a month. Ask us to switch ' +
      'it on and we will set it up with you — your free TCOS web address ' +
      'keeps working either way.'
  }
};

export function requireFeature(doctor, key) {
  if (hasFeature(doctor, key)) return;

  const extra = ADDONS[key];
  if (extra) throw new ApiError(402, 'plan_addon', extra.message);

  throw new ApiError(402, 'plan_feature',
    'Your plan does not include ' + (LABEL[key] || key) +
    '. Everything already recorded stays available to read — ' +
    'move up a plan to add more.');
}

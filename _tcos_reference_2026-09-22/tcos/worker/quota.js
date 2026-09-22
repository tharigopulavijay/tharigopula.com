/* =========================================================================
   What a plan includes, and stopping at it.

   Two things this is careful about, because both are ways clinical software
   goes wrong:

   IT NEVER STOPS SOMETHING CLINICAL. Refusing to register a patient
   standing at the counter, or to write a prescription, because a quota
   ran out is not acceptable behaviour - the doctor cannot explain it to the
   person in front of her, and the harm lands on the patient rather than on
   the account. So limits that would block care are soft: allowed, counted,
   charged. The ones that stop hard are the ones nobody is waiting on -
   adding a fifth staff account, sending marketing messages.

   IT NEVER SURPRISES. A doctor is told the number before she buys and sees
   what she has left while she works. The failure mode of metered software
   is an invoice nobody expected; the second failure mode is a wall nobody
   was warned about. Both are avoided by showing the count.
   ========================================================================= */

import { ApiError } from '@tharigopula/core/lib';

/* Read once per request rather than per check - a screen that renders ten
   things should not run ten identical queries. */
export async function limitsFor(db, plan) {
  const { results } = await db.prepare(
    'SELECT * FROM plan_limits WHERE plan = ?').bind(plan || 'basic').all();
  const limits = {};
  for (const row of (results || [])) limits[row.limit_key] = row;
  return limits;
}

/* What this clinic has used. Counts are live for the things that are a
   standing total (patients, staff) and month-to-date for the things that
   reset (messages, AI). */
export async function usageFor(db, doctorId) {
  const period = new Date().toISOString().slice(0, 7);

  const counts = await db.prepare(
    `SELECT
       (SELECT COUNT(*) FROM doctor_patients
         WHERE doctor_id = ? AND archived_at IS NULL) AS patients,
       (SELECT COUNT(*) FROM clinic_users
         WHERE doctor_id = ? AND status = 'active' AND role != 'practitioner') AS staff,
       (SELECT COUNT(*) FROM clinic_users
         WHERE doctor_id = ? AND status = 'active' AND role = 'practitioner') AS doctors`
  ).bind(doctorId, doctorId, doctorId).first();

  const metered = await db.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN event_type IN ('whatsapp_message','sms_message')
                    THEN quantity ELSE 0 END), 0) AS messages,
       COALESCE(SUM(CASE WHEN event_type = 'ai_document'
                    THEN quantity ELSE 0 END), 0) AS ai_documents
       FROM usage_events
      WHERE doctor_id = ? AND substr(occurred_at, 1, 7) = ?`
  ).bind(doctorId, period).first();

  /* Storage is what is actually stored right now, not a sum of events -
     it is a level, not a flow. Counting upload events would keep charging
     for a file that was deleted six months ago. */
  const stored = await db.prepare(
    `SELECT COALESCE(SUM(bytes), 0) AS bytes
       FROM files WHERE doctor_id = ? AND deleted_at IS NULL`
  ).bind(doctorId).first();

  return {
    patients: counts.patients || 0,
    staff: counts.staff || 0,
    /* The clinic owner is a doctor too, so she counts against the doctor
       limit - otherwise "1 doctor" would silently mean two. */
    doctors: (counts.doctors || 0) + 1,
    messages: Math.round(metered.messages || 0),
    ai_documents: Math.round(metered.ai_documents || 0),
    storage_mb: Math.round((stored.bytes || 0) / (1024 * 1024))
  };
}

/* [plural, verb, singular]. The singular matters: "covers 1 doctors" is the
   kind of thing a doctor reads as sloppiness in software holding her
   patients' records. */
const WORDS = {
  patients: ['patients', 'Your plan covers', 'patient'],
  staff: ['staff accounts', 'Your plan covers', 'staff account'],
  doctors: ['doctors', 'Your plan covers', 'doctor'],
  messages: ['messages this month', 'Your plan includes', 'message this month'],
  ai_documents: ['documents read by AI this month', 'Your plan includes',
    'document read by AI this month'],
  storage_mb: ['MB of files', 'Your plan includes', 'MB of files']
};

/* Seats stop at the limit; consumption gets a reserve. Adding a fifth staff
   account is not work in progress and nobody is waiting on it. Sending the
   message a patient is expecting is. */
const SEAT_LIMITS = new Set(['staff', 'doctors']);

async function graceDays(db) {
  const row = await db.prepare(
    "SELECT paise_per_unit FROM cost_rates WHERE id = 'grace_days'").first();
  return row ? row.paise_per_unit : 3;
}

/* Opens the reserve the first time a limit is passed, and reports how much
   is left of it. Returns null once it has run out. */
async function reserveFor(db, doctorId, key, used) {
  const existing = await db.prepare(
    'SELECT * FROM plan_grace WHERE doctor_id = ? AND limit_key = ?'
  ).bind(doctorId, key).first();

  if (existing) {
    const left = Math.ceil(
      (new Date(existing.expires_at + 'Z').getTime() - Date.now()) / 86400000);
    return left > 0 ? { ...existing, daysLeft: left } : null;
  }

  const days = await graceDays(db);
  const expires = new Date(Date.now() + days * 86400000).toISOString().slice(0, 19).replace('T', ' ');
  await db.prepare(
    `INSERT OR IGNORE INTO plan_grace (doctor_id, limit_key, expires_at, usage_at_start)
     VALUES (?,?,?,?)`
  ).bind(doctorId, key, expires, Math.round(used)).run();
  return { doctor_id: doctorId, limit_key: key, expires_at: expires, daysLeft: days };
}

/* Usage back under the line, or a bigger plan: the reserve is returned so
   the next breach starts a fresh one rather than stopping immediately. */
export async function clearReserve(db, doctorId, key) {
  await db.prepare(
    key
      ? 'DELETE FROM plan_grace WHERE doctor_id = ? AND limit_key = ?'
      : 'DELETE FROM plan_grace WHERE doctor_id = ?'
  ).bind(...(key ? [doctorId, key] : [doctorId])).run();
}

/* Called before the action, with how many units it will consume. */
export async function requireQuota(db, doctor, key, amount = 1, cached) {
  const limits = cached && cached.limits ? cached.limits : await limitsFor(db, doctor.plan);
  const rule = limits[key];
  if (!rule) return { allowed: true, overagePaise: 0 };

  /* A NEGATIVE `included` MEANS NOT METERED, and nothing below it runs.

     Patients stopped being metered on 11 September 2026. Vijay: "why limit
     patients, it does not cost us - only what we are costed is something we
     can charge." He is right. A patient row in D1 costs approximately
     nothing, so a cap on it was charging for something we do not pay for,
     and the doctor it punished first was the one with the busiest clinic -
     our best customer, meeting a wall.

     What stays metered is what is actually billed to us: documents read by
     the model, bytes held in R2, and messages when they ship. Seats stay
     too, which is not a cost but is honest value, and is the thing that
     really stops a hospital running on the ₹899 plan.

     A sentinel rather than a huge number, because a huge number still does
     arithmetic: it would have shown "3 of 2,000,000,000" on her usage
     panel and quietly started warning her at 1.6 billion patients. */
  if (rule.included < 0) {
    return { allowed: true, overagePaise: 0, used: 0, included: null, unlimited: true };
  }

  const usage = cached && cached.usage ? cached.usage : await usageFor(db, doctor.id);
  const used = usage[key] || 0;
  const after = used + amount;

  if (after <= rule.included) {
    /* Back under the line - hand the reserve back, so a busy week does not
       cost her the runway she may need next month. */
    await clearReserve(db, doctor.id, key);
    return { allowed: true, overagePaise: 0, used, included: rule.included };
  }

  const [plural, verb, singular] = WORDS[key] || [key, 'Your plan includes', key];
  const what = rule.included === 1 ? (singular || plural) : plural;

  /* A seat limit, or something simply not on this plan: stops now. */
  if (rule.hard_stop && (SEAT_LIMITS.has(key) || rule.included === 0)) {
    throw new ApiError(402, 'plan_limit',
      rule.included === 0
        ? 'That is not included on your current plan. Move up a plan to use it.'
        : verb + ' ' + rule.included + ' ' + what + ' and you have ' + used +
          '. Move up a plan to add more.');
  }

  const reserve = await reserveFor(db, doctor.id, key, used);
  if (!reserve) {
    throw new ApiError(402, 'plan_limit_expired',
      'You passed your ' + plural + ' a few days ago and the extra time has run out. ' +
      'Move up a plan and everything starts working again straight away.');
  }

  const over = after - Math.max(rule.included, used);
  return {
    allowed: true,
    inReserve: true,
    daysLeft: reserve.daysLeft,
    overagePaise: over * rule.overage_paise,
    used, included: rule.included, overUnits: over
  };
}

/* Everything a doctor should be able to see about her own plan, so the app
   can show "847 of 1,000 patients" rather than letting her discover the
   ceiling by hitting it. */
export async function planStatus(db, doctor) {
  const [limits, usage] = await Promise.all([
    limitsFor(db, doctor.plan), usageFor(db, doctor.id)
  ]);
  const price = await db.prepare(
    'SELECT paise_monthly FROM plan_prices WHERE plan = ?').bind(doctor.plan).first();

  const { results: graces } = await db.prepare(
    'SELECT * FROM plan_grace WHERE doctor_id = ?').bind(doctor.id).all();
  const graceBy = Object.fromEntries((graces || []).map(g => [g.limit_key, g]));

  /* The reserve length is read from the database, so building a line is
     async - Promise.all rather than map, or every line would be a pending
     promise and the whole panel would render as [object Promise]. */
  const days = await graceDays(db);
  const lines = Object.entries(limits).map(([key, rule]) => {
    const used = usage[key] || 0;
    /* Not metered at all - see requireQuota. It still gets a line, because
       "Patients — unlimited" is worth her seeing, but it has no ceiling to
       be a share of and can never be approaching one. */
    const unlimited = rule.included < 0;
    const unavailable = !unlimited && rule.included === 0 && rule.hard_stop === 1;
    const share = unlimited ? 0
      : rule.included > 0 ? used / rule.included : (used > 0 ? 1 : 0);

    const grace = graceBy[key];
    const daysLeft = grace
      ? Math.ceil((new Date(grace.expires_at + 'Z').getTime() - Date.now()) / 86400000)
      : null;

    /* The states the doctor actually needs to tell apart. "approaching"
       exists so she is asked to pay while everything still works, which is
       the whole point - a wall converts worse than a warning.

       Two things this has to get right, and both were wrong first time:

       A seat limit never gets a reserve, so being over it is "blocked", not
       "expired" - the difference being that no clock is running and nothing
       is about to break.

       And a consumption limit that is over WITHOUT a reserve row has simply
       not started its clock yet: the reserve opens on the next action. It
       must read as "over, with the full runway left", not as "expired",
       which would tell a doctor her clinic has stopped when it has not. */
    let state = 'ok';
    if (unlimited) state = 'unlimited';
    else if (unavailable) state = 'unavailable';
    else if (used > rule.included) {
      if (SEAT_LIMITS.has(key)) state = 'blocked';
      else if (grace) state = daysLeft > 0 ? 'over' : 'expired';
      else state = 'over';
    } else if (share >= 0.8) state = 'approaching';

    /* Not yet started means the whole reserve is still ahead of her. */
    const runway = state === 'over' ? (grace ? daysLeft : days) : null;

    return {
      key,
      label: (WORDS[key] || [key])[0],
      /* null, not -1. Every screen that prints this would otherwise have to
         know the sentinel, and the first one to forget prints "-1". */
      included: unlimited ? null : rule.included,
      unlimited,
      used,
      state,
      seat: SEAT_LIMITS.has(key),
      daysLeft: runway,
      unavailable,
      hardStop: rule.hard_stop === 1,
      overagePaise: rule.overage_paise,
      remaining: unlimited ? null : Math.max(0, rule.included - used),
      percent: unlimited ? 0 : Math.min(999, Math.round(share * 100))
    };
  }).sort((a, b) => a.key.localeCompare(b.key));

  /* One flag the app can act on without re-deriving it on every screen.
     Ordered by how close it is to costing her something: expired has
     already stopped, blocked stops one action, over is a countdown,
     approaching is only a nudge. */
  const worst = lines.find(l => l.state === 'expired')
    || lines.find(l => l.state === 'blocked')
    || lines.find(l => l.state === 'over')
    || lines.find(l => l.state === 'approaching');

  return {
    plan: doctor.plan,
    pricePaise: price ? price.paise_monthly : 0,
    attention: worst ? { key: worst.key, label: worst.label, state: worst.state,
      daysLeft: worst.daysLeft } : null,
    limits: lines
  };
}

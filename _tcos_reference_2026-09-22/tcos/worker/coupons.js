/* =========================================================================
   Coupons: a code a doctor can remember, bolted to a discount that is real.

   THE RULE THIS FILE EXISTS TO KEEP.
   Razorpay charges the card against a plan. A percentage typed into TCOS
   changes nothing on their side - the doctor would read "10% off", agree,
   and be charged the full amount. Only Razorpay's own Offer discounts the
   charge, referenced by offer_id when the subscription is created, and
   offers can only be created in their dashboard.

   So a coupon cannot be switched ON until it carries a provider offer id.
   Everything else here - windows, plan limits, usage caps - is ours to
   enforce and is enforced. The discount itself is not ours to invent.

   WHAT A DOCTOR SEES WHEN A CODE IS REFUSED.
   Every refusal says which rule stopped it, because "invalid coupon" on a
   code printed in an advertisement she is holding turns into a support call
   we cannot answer either. The one exception is a code that does not exist,
   which is told nothing beyond "not a code we recognise" - guessing at
   coupon codes should not be a way to enumerate them.
   ========================================================================= */

import { ApiError, badRequest, newId, nowIso } from '@tharigopula/core/lib';

const PAID_PLANS = ['starter', 'pro', 'pro_plus'];

/* Upper case, trimmed, and nothing exotic. A coupon that works only in
   capitals is a support call on every festival, and one carrying a space is
   a coupon nobody can read out over the phone. */
export function normaliseCode(input) {
  const code = String(input == null ? '' : input).trim().toUpperCase();
  if (!code) throw badRequest('Enter a coupon code.');
  if (!/^[A-Z0-9][A-Z0-9-]{1,23}$/.test(code)) {
    throw badRequest('Use 2-24 letters, numbers or hyphens, like DIWALI25.');
  }
  return code;
}

function percentOf(input) {
  const percent = Number.parseInt(input, 10);
  if (!Number.isInteger(percent) || percent < 1 || percent > 100) {
    throw badRequest('The discount must be a whole number between 1 and 100.');
  }
  return percent;
}

/* Razorpay's own id shape. Checked rather than trusted, because a typo here
   is not caught until a real customer's checkout fails at the till. */
function offerIdOf(input) {
  const id = String(input == null ? '' : input).trim();
  if (!id) return null;
  if (!/^offer_[A-Za-z0-9]{6,}$/.test(id)) {
    throw badRequest('That is not a Razorpay offer id. It looks like offer_ABC123, ' +
      'and you create it in Razorpay under Offers.');
  }
  return id;
}

const plansOf = (input) => {
  if (input == null) return null;
  const list = (Array.isArray(input) ? input : [input])
    .map(p => String(p).trim()).filter(Boolean);
  if (!list.length) return null;
  const unknown = list.filter(p => !PAID_PLANS.includes(p));
  if (unknown.length) badRequestPlans(unknown);
  return list;
};
const badRequestPlans = unknown => {
  throw badRequest('Not a plan a coupon can apply to: ' + unknown.join(', ') +
    '. Free needs no discount.');
};

const publicRow = row => ({
  id: row.id,
  code: row.code,
  label: row.label,
  percentOff: row.percent_off,
  providerOfferId: row.provider_offer_id,
  active: !!row.active,
  /* Said plainly rather than left for the screen to work out, because the
     reason a coupon is not usable is the whole question being asked. */
  usable: usableNow(row).ok,
  reason: usableNow(row).reason,
  startsOn: row.starts_on,
  endsOn: row.ends_on,
  plans: (() => { try { return JSON.parse(row.plans || 'null'); } catch (_) { return null; } })(),
  maxRedemptions: row.max_redemptions,
  timesRedeemed: row.times_redeemed,
  oncePerClinic: !!row.once_per_clinic,
  note: row.note,
  createdAt: row.created_at
});

/* Everything that does not depend on WHO is redeeming. Shared by the console
   list and the checkout check so the two can never disagree about whether a
   coupon is live. */
function usableNow(row, today = new Date().toISOString().slice(0, 10)) {
  /* The missing offer is reported BEFORE "switched off", because it is the
     blocking prerequisite and the only one with something to do about it.
     On a coupon just created, "switched off" is true and useless - she knows,
     she made it thirty seconds ago - while "no Razorpay offer linked" is the
     next action. Ordered the other way round, the list told every new coupon
     the one thing its author already knew. */
  if (!row.provider_offer_id) {
    return { ok: false, reason: 'No Razorpay offer linked, so it would not actually discount.' };
  }
  if (!row.active) return { ok: false, reason: 'Switched off.' };
  if (row.starts_on && today < row.starts_on) {
    return { ok: false, reason: 'Starts on ' + row.starts_on + '.' };
  }
  if (row.ends_on && today > row.ends_on) {
    return { ok: false, reason: 'Ended on ' + row.ends_on + '.' };
  }
  if (row.max_redemptions != null && row.times_redeemed >= row.max_redemptions) {
    return { ok: false, reason: 'Fully redeemed (' + row.times_redeemed + ').' };
  }
  return { ok: true, reason: null };
}

export const coupons = {
  async list(db) {
    const { results } = await db.prepare(
      'SELECT * FROM coupons ORDER BY active DESC, created_at DESC').all();
    return (results || []).map(publicRow);
  },

  async create(db, details, actor) {
    const code = normaliseCode(details.code);
    const existing = await db.prepare(
      'SELECT id FROM coupons WHERE code = ?').bind(code).first();
    if (existing) {
      throw badRequest('That code already exists. Edit it, or choose another.');
    }

    const id = newId('cpn');
    const plans = plansOf(details.plans);
    await db.prepare(
      `INSERT INTO coupons
        (id, code, label, percent_off, provider_offer_id, active,
         starts_on, ends_on, plans, max_redemptions, once_per_clinic,
         created_by, note)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(id, code, details.label || null, percentOf(details.percentOff),
      offerIdOf(details.providerOfferId),
      /* Never live on creation, whatever was sent. A coupon is made, looked
         at, and then switched on - there is no hurry that justifies a code
         going live in the same click that typed it. */
      0,
      details.startsOn || null, details.endsOn || null,
      plans ? JSON.stringify(plans) : null,
      details.maxRedemptions == null ? null : Math.max(1, Number(details.maxRedemptions) | 0),
      details.oncePerClinic ? 1 : 0, actor || null, details.note || null).run();

    return publicRow(await db.prepare('SELECT * FROM coupons WHERE id = ?').bind(id).first());
  },

  /* Edit anything, including the code. Only the fields sent are touched, so
     flipping `active` from the list does not quietly blank the note. */
  async update(db, id, patch) {
    const row = await db.prepare('SELECT * FROM coupons WHERE id = ?').bind(id).first();
    if (!row) throw new ApiError(404, 'not_found', 'No such coupon.');

    const next = {
      code: patch.code === undefined ? row.code : normaliseCode(patch.code),
      label: patch.label === undefined ? row.label : (patch.label || null),
      percent_off: patch.percentOff === undefined
        ? row.percent_off : percentOf(patch.percentOff),
      provider_offer_id: patch.providerOfferId === undefined
        ? row.provider_offer_id : offerIdOf(patch.providerOfferId),
      starts_on: patch.startsOn === undefined ? row.starts_on : (patch.startsOn || null),
      ends_on: patch.endsOn === undefined ? row.ends_on : (patch.endsOn || null),
      plans: patch.plans === undefined ? row.plans
        : (plansOf(patch.plans) ? JSON.stringify(plansOf(patch.plans)) : null),
      max_redemptions: patch.maxRedemptions === undefined ? row.max_redemptions
        : (patch.maxRedemptions == null ? null : Math.max(1, Number(patch.maxRedemptions) | 0)),
      once_per_clinic: patch.oncePerClinic === undefined
        ? row.once_per_clinic : (patch.oncePerClinic ? 1 : 0),
      note: patch.note === undefined ? row.note : (patch.note || null),
      active: patch.active === undefined ? row.active : (patch.active ? 1 : 0)
    };

    /* THE REFUSAL THAT MAKES THIS HONEST. Switching a coupon on without a
       Razorpay offer behind it would put a discount on the screen that never
       reaches the card. */
    if (next.active && !next.provider_offer_id) {
      throw badRequest('Link a Razorpay offer before switching this on, or the ' +
        'doctor is shown a discount and charged the full price. Create the offer ' +
        'in Razorpay under Offers, then paste its offer_ id here.');
    }
    if (next.code !== row.code) {
      const clash = await db.prepare(
        'SELECT id FROM coupons WHERE code = ? AND id != ?').bind(next.code, id).first();
      if (clash) throw badRequest('Another coupon already uses that code.');
    }

    await db.prepare(
      `UPDATE coupons SET code = ?, label = ?, percent_off = ?, provider_offer_id = ?,
              active = ?, starts_on = ?, ends_on = ?, plans = ?, max_redemptions = ?,
              once_per_clinic = ?, note = ?
        WHERE id = ?`
    ).bind(next.code, next.label, next.percent_off, next.provider_offer_id,
      next.active, next.starts_on, next.ends_on, next.plans, next.max_redemptions,
      next.once_per_clinic, next.note, id).run();

    return publicRow(await db.prepare('SELECT * FROM coupons WHERE id = ?').bind(id).first());
  },

  /* Deleting a coupon that has been used would take its redemptions with it
     (ON DELETE CASCADE) and with them the answer to "how did Diwali do".
     A used coupon is switched off instead; an unused one is really deleted. */
  async remove(db, id) {
    const row = await db.prepare('SELECT * FROM coupons WHERE id = ?').bind(id).first();
    if (!row) throw new ApiError(404, 'not_found', 'No such coupon.');

    if (row.times_redeemed > 0) {
      await db.prepare('UPDATE coupons SET active = 0 WHERE id = ?').bind(id).run();
      return {
        deleted: false, switchedOff: true,
        message: 'This coupon has been used ' + row.times_redeemed +
          ' time(s), so it was switched off rather than deleted - deleting it ' +
          'would erase the record of what it earned.'
      };
    }
    await db.prepare('DELETE FROM coupons WHERE id = ?').bind(id).run();
    return { deleted: true, switchedOff: false };
  },

  /* What checkout asks: may THIS clinic use THIS code for THIS plan?
     Returns the offer id to hand to Razorpay, or throws with the reason. */
  async claim(db, doctorId, rawCode, plan) {
    const code = normaliseCode(rawCode);
    const row = await db.prepare('SELECT * FROM coupons WHERE code = ?').bind(code).first();
    /* Deliberately vague, and only here: a specific answer would let anyone
       enumerate live codes by trying them. */
    if (!row) throw badRequest('That is not a code we recognise.');

    const state = usableNow(row);
    if (!state.ok) throw badRequest('That code cannot be used: ' + state.reason);

    let plans = null;
    try { plans = JSON.parse(row.plans || 'null'); } catch (_) { plans = null; }
    if (plans && !plans.includes(plan)) {
      throw badRequest('That code does not apply to this plan.');
    }

    if (row.once_per_clinic) {
      const used = await db.prepare(
        'SELECT id FROM coupon_redemptions WHERE coupon_id = ? AND doctor_id = ?'
      ).bind(row.id, doctorId).first();
      if (used) throw badRequest('You have already used that code.');
    }

    return { id: row.id, code: row.code, percentOff: row.percent_off,
      offerId: row.provider_offer_id };
  },

  /* Written only once the subscription actually exists, so an abandoned
     checkout does not burn a limited offer. The unique index on
     (coupon_id, doctor_id) is what makes a double-submit harmless. */
  async recordRedemption(db, coupon, doctorId, subscriptionId, plan, cadence) {
    try {
      await db.batch([
        db.prepare(
          `INSERT INTO coupon_redemptions
            (id, coupon_id, doctor_id, subscription_id, plan, cadence, percent_off, redeemed_at)
           VALUES (?,?,?,?,?,?,?,?)`
        ).bind(newId('rdm'), coupon.id, doctorId, subscriptionId || null,
          plan || null, cadence || null, coupon.percentOff, nowIso()),
        db.prepare(
          'UPDATE coupons SET times_redeemed = times_redeemed + 1 WHERE id = ?'
        ).bind(coupon.id)
      ]);
      return { recorded: true };
    } catch (_) {
      /* Already redeemed by this clinic. Not an error worth failing a paid
         subscription over - the money has moved and the row that matters
         exists. */
      return { recorded: false };
    }
  },

  /* How a coupon actually did, for the console. */
  async redemptions(db, couponId) {
    const { results } = await db.prepare(
      `SELECT r.redeemed_at, r.plan, r.cadence, r.percent_off,
              d.clinic_name, d.full_name
         FROM coupon_redemptions r
         JOIN doctors d ON d.id = r.doctor_id
        WHERE r.coupon_id = ?
        ORDER BY r.redeemed_at DESC LIMIT 200`
    ).bind(couponId).all();
    return results || [];
  }
};

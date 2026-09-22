/* =========================================================================
   A payment that arrived outside Razorpay, recorded as a payment.

   Vijay: "sometimes payment is getting failed due to some reason, so he
   connects us and asks for upi or any other means of payment. so i should
   be able to check paid — it doesnot mean i check paid it is paid — should
   be through out: i select the payment date and save, so that doctor will
   have that package enabled, and will give the dates, start and end, or
   will tell you monthly or yearly and accordingly the expiry date will come
   into the picture."

   HE IS DESCRIBING A BUG THAT WAS ALREADY IN HERE.
   `plan_source = 'manual_override'` let an owner set a clinic's plan by
   hand. It had no amount, no date, no method and no end. Six months on,
   nobody could say whether that clinic had paid, how much, or until when -
   and nothing ever took the plan away, so a clinic that paid once for one
   month kept Clinic forever. A tick is not a payment record. It is somebody
   remembering.

   So an offline payment writes the SAME two rows a Razorpay payment writes:
   a subscription carrying an end date, and a payment carrying an amount, a
   date, a method and a reference you can check against a bank statement.
   The nightly sweep expires it like any other. The only thing that differs
   is which provider the money came through.

   WHAT THE OWNER CHOOSES, AND WHAT IS DERIVED.
   He picks the plan, monthly or yearly, and the date the money arrived.
   Everything else follows: the amount from the price list, so a typo cannot
   record ₹89 for a ₹899 plan, and the expiry from the date plus the term.
   The fewer numbers a human types at 9pm, the fewer are wrong.
   ========================================================================= */

import { newId, nowIso, badRequest, ApiError } from '@tharigopula/core/lib';

export const METHODS = ['upi', 'bank', 'cash', 'cheque', 'card', 'other'];
export const TERMS = { monthly: 1, yearly: 12 };

/* The same figures js/tcos-plans.js sells. Held here in paise because money
   is never a float, and asserted equal to the browser's copy by
   test/offline-payments.test.js - a doctor must never be quoted one price
   and charged another. */
export const PRICE_PAISE = {
  starter: { monthly: 89900, yearly: 899000 },
  pro: { monthly: 219900, yearly: 2199000 },
  pro_plus: { monthly: 449900, yearly: 4499000 }
};

const isDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));

/* Add whole months to a date, and do it the way a person expects: a payment
   on 31 January for one month runs to 28 February, not to 3 March.
   JavaScript's Date rolls over; a doctor reading her own expiry date does
   not. */
export function addMonths(isoDate, months) {
  const [y, m, d] = String(isoDate).slice(0, 10).split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0))
    .getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

export const offlinePayments = {
  /* Record one. Returns what the clinic now has and until when, because
     that is the sentence the owner console has to show back to him - and
     showing him the derived date is the only way he can catch having picked
     the wrong term. */
  async record(db, doctor, details, actor) {
    if (!doctor) throw new ApiError(404, 'not_found', 'No such clinic.');

    /* A demo account has no money attached to it, and recording a payment
       against one would put a fictional clinic into real revenue. */
    if (doctor.account_type === 'demo') {
      throw badRequest('That is a demo account. Switch it to a live account ' +
        'before recording a payment against it.');
    }

    const plan = String(details.plan || '');
    if (!PRICE_PAISE[plan]) {
      throw badRequest('Choose the package this payment is for: Practice, Clinic or Group.');
    }

    const term = String(details.term || '');
    if (!TERMS[term]) throw badRequest('Say whether this is monthly or yearly.');

    const paidOn = String(details.paidOn || '').slice(0, 10);
    if (!isDate(paidOn)) throw badRequest('Pick the date the money arrived.');

    /* A payment dated next month would hand out a package nobody has paid
       for yet. Backdating is allowed and normal - he is often entering it
       days after the UPI landed. */
    if (paidOn > nowIso().slice(0, 10)) {
      throw badRequest('That date is in the future. Record the payment on the day it arrived.');
    }

    const method = String(details.method || '').toLowerCase();
    if (!METHODS.includes(method)) {
      throw badRequest('How did the money arrive? UPI, bank transfer, cash, cheque or card.');
    }

    /* A reference is what makes this checkable against a bank statement. It
       is the difference between a record and an assertion, so cash is the
       only method that may go without one. */
    const reference = String(details.reference || '').trim().slice(0, 120);
    if (!reference && method !== 'cash') {
      throw badRequest('Enter the UPI reference, bank transaction id or cheque number. ' +
        'Without it this payment cannot be checked against the bank later.');
    }

    /* PAYING EARLY MUST NOT COST HER DAYS.
       A doctor whose month runs to the 30th who pays on the 25th gets her
       new month added to the 30th, not to the 25th. Counting from the
       payment date would quietly take five days off every doctor who pays
       before she has to - which is exactly the doctors we want. */
    const today = nowIso().slice(0, 10);
    const current = doctor.plan_paid_until ? String(doctor.plan_paid_until).slice(0, 10) : null;
    const startFrom = (current && current > paidOn && current > today) ? current : paidOn;
    const coversUntil = addMonths(startFrom, TERMS[term]);

    const amountPaise = Number.isFinite(details.amountPaise) && details.amountPaise > 0
      ? Math.round(details.amountPaise)          /* a negotiated or part payment */
      : PRICE_PAISE[plan][term];                 /* the list price, by default */

    /* One manual subscription per clinic, carried forward rather than a new
       row per payment - so "what is this clinic on, and until when" has one
       answer. The payments beneath it are the history. */
    const existing = await db.prepare(
      `SELECT id FROM subscriptions
        WHERE doctor_id = ? AND provider = 'manual'`
    ).bind(doctor.id).first();

    const subscriptionId = existing ? existing.id : newId('sub');
    const paymentId = newId('pay');
    const now = nowIso();

    const statements = [];

    if (existing) {
      statements.push(db.prepare(
        `UPDATE subscriptions
            SET plan = ?, cadence = ?, price_paise = ?, status = 'active',
                current_start = ?, current_end = ?, access_until = ?, updated_at = ?
          WHERE id = ? AND doctor_id = ?`
      ).bind(plan, term, amountPaise, startFrom, coversUntil, coversUntil,
        now, subscriptionId, doctor.id));
    } else {
      statements.push(db.prepare(
        `INSERT INTO subscriptions
           (id, doctor_id, provider, provider_subscription_id, provider_plan_id,
            plan, cadence, price_paise, status, current_start, current_end, access_until)
         VALUES (?,?,'manual',?,?,?,?,?,'active',?,?,?)`
      ).bind(subscriptionId, doctor.id, 'manual:' + doctor.id, 'manual:' + plan,
        plan, term, amountPaise, startFrom, coversUntil, coversUntil));
    }

    statements.push(db.prepare(
      `INSERT INTO subscription_payments
         (id, doctor_id, subscription_id, provider, provider_payment_id,
          amount_paise, status, occurred_at, method, reference, recorded_by,
          covers_from, covers_until)
       VALUES (?,?,?,'manual',?,?,'captured',?,?,?,?,?,?)`
    ).bind(paymentId, doctor.id, subscriptionId, paymentId, amountPaise,
      paidOn, method, reference || null, String(actor || '').slice(0, 120),
      startFrom, coversUntil));

    /* The clinic's own row. `plan_paid_until` is the one clock everything
       downstream reads - featuresFor(), the nightly sweep and her own plan
       screen - so a trial ending and a payment lapsing cannot behave
       differently by accident. */
    statements.push(db.prepare(
      `UPDATE doctors
          SET plan = ?, plan_source = 'manual_payment', plan_paid_until = ?,
              plan_note = ?, plan_override_reason = NULL, plan_updated_at = ?
        WHERE id = ?`
    ).bind(plan, coversUntil,
      'Paid ' + method.toUpperCase() + ' on ' + paidOn + (reference ? ' · ' + reference : ''),
      now, doctor.id));

    statements.push(db.prepare(
      `INSERT INTO audit_events (id, doctor_id, actor, action, target_type, target_id, detail)
       VALUES (?,?,?,?,?,?,?)`
    ).bind(newId('aud'), doctor.id, String(actor || 'platform'),
      'offline_payment_recorded', 'subscription', subscriptionId,
      plan + ' ' + term + ' · ' + method + ' · ' + paidOn + ' → ' + coversUntil));

    await db.batch(statements);

    return {
      doctorId: doctor.id, plan, term, method, reference: reference || null,
      paidOn, coversFrom: startFrom, coversUntil, amountPaise,
      /* Said back to him in full, because the expiry is derived and the one
         thing he can get wrong is the term. Reading "until 19 Oct" when he
         meant a year is how he catches it. */
      summary: plan + ', ' + term + ', paid ' + paidOn + ' — active until ' + coversUntil
    };
  },

  /* What this clinic has paid, newest first. The owner console shows it
     under the clinic, because "has this one actually paid" is a question
     asked far more often than it is answered well. */
  async history(db, doctorId) {
    const { results } = await db.prepare(
      `SELECT id, amount_paise, status, occurred_at, method, reference,
              recorded_by, covers_from, covers_until, provider, recorded_at
         FROM subscription_payments
        WHERE doctor_id = ?
        ORDER BY recorded_at DESC
        LIMIT 100`
    ).bind(doctorId).all();
    return results || [];
  }
};

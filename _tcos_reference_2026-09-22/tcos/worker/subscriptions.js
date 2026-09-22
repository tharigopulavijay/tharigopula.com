/* =========================================================================
   Recurring billing and entitlement activation.

   Razorpay owns the mandate and payment method. TCOS never receives or
   stores card, UPI mandate or bank details. It accepts only two kinds of
   proof from Razorpay:

     * an authenticated API response fetched with server-side credentials;
     * a webhook whose signature matches the exact raw request bytes.

   Webhook event ids are claimed before processing and every resulting write
   is one D1 batch transaction. Duplicate and out-of-order delivery therefore
   cannot double-count a payment or roll a paid clinic back to an older event.
   ========================================================================= */

import { ApiError, badRequest, newId, nowIso, safeEqual, sha256 } from '@tharigopula/core/lib';
import { coupons } from './coupons.js';

const PROVIDER = 'razorpay';
const API = 'https://api.razorpay.com/v1';
/* `authenticated` proves the mandate was authorised, not that the paid
   subscription period has started. Only Razorpay's canonical `active`
   state grants paid TCOS entitlements. */
const ACTIVE = new Set(['active']);
const TROUBLE = new Set(['pending', 'halted', 'paused']);
const TERMINAL = new Set(['cancelled', 'completed', 'expired']);
const KNOWN = new Set(['created', 'authenticated', ...ACTIVE, ...TROUBLE, ...TERMINAL]);
const LABEL = { starter: 'Practice', pro: 'Clinic', pro_plus: 'Group' };

const configured = env => !!(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET &&
  env.RAZORPAY_WEBHOOK_SECRET);

const publicHealth = env => ({
  configured: configured(env),
  provider: PROVIDER
});

export function adminHealth(env) {
  const missing = [];
  if (!env.RAZORPAY_KEY_ID) missing.push('RAZORPAY_KEY_ID');
  if (!env.RAZORPAY_KEY_SECRET) missing.push('RAZORPAY_KEY_SECRET');
  if (!env.RAZORPAY_WEBHOOK_SECRET) missing.push('RAZORPAY_WEBHOOK_SECRET');
  return { ...publicHealth(env), missing };
}

function requireConfigured(env) {
  if (!configured(env)) {
    throw new ApiError(503, 'payments_unavailable',
      'Online plan payments are not available yet. Your current access is unchanged.');
  }
}

function utf8(value) {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return new TextEncoder().encode(String(value));
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw', utf8(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, utf8(message));
  return Array.from(new Uint8Array(signed))
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyWebhookSignature(secret, raw, received) {
  if (!secret || !received || !/^[a-f0-9]{64}$/i.test(received)) return false;
  return safeEqual((await hmacHex(secret, raw)).toLowerCase(), received.toLowerCase());
}

async function providerRequest(env, path, { method = 'GET', payload } = {}) {
  requireConfigured(env);
  const auth = btoa(env.RAZORPAY_KEY_ID + ':' + env.RAZORPAY_KEY_SECRET);
  let response;
  try {
    response = await fetch(API + path, {
      method,
      headers: {
        Authorization: 'Basic ' + auth,
        Accept: 'application/json',
        ...(payload ? { 'Content-Type': 'application/json' } : {})
      },
      body: payload ? JSON.stringify(payload) : undefined
    });
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', event: 'payment_provider_unreachable',
      provider: PROVIDER, path, message: error instanceof Error ? error.message : 'unknown' }));
    throw new ApiError(502, 'payment_provider_unavailable',
      'The payment provider could not be reached. Nothing was charged. Try again.');
  }

  let result = null;
  try { result = await response.json(); } catch { /* handled below */ }
  if (!response.ok) {
    console.error(JSON.stringify({ level: 'error', event: 'payment_provider_refused',
      provider: PROVIDER, path, status: response.status,
      code: result && result.error && result.error.code }));
    throw new ApiError(502, 'payment_provider_refused',
      'The payment provider could not complete that request. Nothing was changed.');
  }
  return result;
}

const stamp = seconds => Number(seconds) > 0
  ? new Date(Number(seconds) * 1000).toISOString() : null;

const plusDays = days => new Date(Date.now() + days * 86400000).toISOString();

async function catalogRow(db, plan, cadence) {
  return db.prepare(
    `SELECT * FROM subscription_plan_catalog
      WHERE provider = ? AND plan = ? AND cadence = ? AND active = 1`
  ).bind(PROVIDER, plan, cadence).first();
}

async function ensureProviderPlan(db, env, plan, cadence) {
  const row = await catalogRow(db, plan, cadence);
  if (!row) throw badRequest('That plan or billing period is not available.');
  if (row.provider_plan_id) return row;

  const key = ['tcos', plan, cadence, row.price_paise].join('_');
  const listed = await providerRequest(env, '/plans?count=100');
  let remote = ((listed && listed.items) || []).find(item =>
    item && item.notes && item.notes.tcos_key === key);

  if (!remote) {
    remote = await providerRequest(env, '/plans', {
      method: 'POST',
      payload: {
        period: cadence === 'yearly' ? 'yearly' : 'monthly',
        interval: 1,
        item: {
          name: 'TCOS ' + LABEL[plan] + ' — ' + cadence,
          amount: row.price_paise,
          currency: row.currency,
          description: LABEL[plan] + ' plan for Clinical OS'
        },
        notes: { tcos_key: key, tcos_plan: plan, tcos_cadence: cadence }
      }
    });
  }

  await db.prepare(
    `UPDATE subscription_plan_catalog
        SET provider_plan_id = ?, synced_at = ?, updated_at = ?
      WHERE id = ?`
  ).bind(remote.id, nowIso(), nowIso(), row.id).run();
  return { ...row, provider_plan_id: remote.id };
}

async function localByProviderId(db, providerSubscriptionId) {
  return db.prepare(
    `SELECT * FROM subscriptions
      WHERE provider = ? AND provider_subscription_id = ?`
  ).bind(PROVIDER, providerSubscriptionId).first();
}

/* Started, but no money has moved. Razorpay says `created` before the first
   charge, and `authenticated` once a mandate exists but nothing has settled.
   Neither is a plan anybody has, and neither is worth protecting. */
const UNPAID = new Set(['created', 'authenticated']);

/* Drop a subscription nobody paid for, so she can start a different one.
   Best effort at the provider on purpose: if Razorpay will not cancel it,
   the local row is still marked abandoned and a new subscription is still
   created. The stranded one carries expire_by of 24 hours and
   customer_notify:false, so it cannot charge her and cannot contact her -
   whereas refusing to continue would leave her unable to buy anything,
   which is the failure this exists to prevent. */
async function abandon(db, env, row) {
  try {
    await providerRequest(env,
      '/subscriptions/' + encodeURIComponent(row.provider_subscription_id) + '/cancel',
      { method: 'POST', payload: { cancel_at_cycle_end: false } });
  } catch (error) {
    console.warn(JSON.stringify({
      level: 'warn', event: 'subscription_abandon_provider_failed',
      subscription: row.id,
      error: error instanceof Error ? error.message : 'unknown'
    }));
  }
  await db.prepare(
    `UPDATE subscriptions SET status = 'cancelled', access_until = NULL
      WHERE id = ? AND doctor_id = ?`
  ).bind(row.id, row.doctor_id).run();
}

async function currentLocal(db, doctorId) {
  return db.prepare(
    `SELECT * FROM subscriptions WHERE doctor_id = ?
      ORDER BY created_at DESC LIMIT 1`
  ).bind(doctorId).first();
}

function publicSubscription(row) {
  if (!row) return null;
  return {
    id: row.id,
    reference: row.provider_subscription_id,
    plan: row.plan,
    cadence: row.cadence,
    pricePaise: row.price_paise,
    currency: row.currency,
    status: row.status,
    checkoutUrl: row.status === 'created' ? row.checkout_url : null,
    currentStart: row.current_start,
    currentEnd: row.current_end,
    accessUntil: row.access_until,
    cancelAtCycleEnd: !!row.cancel_at_cycle_end,
    updatedAt: row.updated_at
  };
}

export function subscriptionIdFromEvent(event) {
  return event && event.payload && event.payload.subscription &&
    event.payload.subscription.entity && event.payload.subscription.entity.id ||
    event && event.payload && event.payload.payment &&
    event.payload.payment.entity && event.payload.payment.entity.subscription_id || null;
}

function paymentFromEvent(event) {
  return event && event.payload && event.payload.payment &&
    event.payload.payment.entity || null;
}

/* Provider truth becomes entitlement truth in one transaction. The caller
   has already fetched the snapshot over authenticated Basic auth. */
async function applySnapshot(db, local, snapshot, context = {}) {
  const status = String(snapshot && snapshot.status || '');
  if (!KNOWN.has(status)) {
    throw new ApiError(502, 'payment_provider_state',
      'The payment provider returned a state TCOS does not understand. Access was not changed.');
  }

  const mapping = await db.prepare(
    `SELECT plan, cadence, price_paise, currency
       FROM subscription_plan_catalog
      WHERE provider = ? AND provider_plan_id = ?`
  ).bind(PROVIDER, snapshot.plan_id || local.provider_plan_id).first();
  if (!mapping) {
    throw new ApiError(502, 'payment_plan_unknown',
      'The payment belongs to an unknown plan. Access was not changed.');
  }

  const currentStart = stamp(snapshot.current_start) || local.current_start;
  const currentEnd = stamp(snapshot.current_end) || local.current_end;
  let accessUntil = local.access_until;

  if (ACTIVE.has(status)) {
    accessUntil = currentEnd || plusDays(mapping.cadence === 'yearly' ? 370 : 35);
  } else if (TROUBLE.has(status)) {
    /* Open once. Repeated pending webhooks must not manufacture another
       three days every morning. */
    if (!TROUBLE.has(local.status)) accessUntil = plusDays(3);
  } else if (TERMINAL.has(status)) {
    accessUntil = currentEnd || accessUntil || nowIso();
  }

  const eventAt = Number(context.eventAt || snapshot.created_at || 0) || null;
  const cancelAtEnd = !!(snapshot.has_scheduled_changes &&
    snapshot.schedule_change_at === 'cycle_end');
  const statements = [
    db.prepare(
      `UPDATE subscriptions
          SET provider_plan_id = ?, plan = ?, cadence = ?, price_paise = ?,
              currency = ?, status = ?, current_start = ?, current_end = ?,
              access_until = ?, cancel_at_cycle_end = ?,
              last_provider_event_at = CASE
                WHEN ? IS NULL THEN last_provider_event_at
                WHEN last_provider_event_at IS NULL OR ? > last_provider_event_at THEN ?
                ELSE last_provider_event_at END,
              updated_at = ?
        WHERE id = ? AND doctor_id = ?`
    ).bind(snapshot.plan_id || local.provider_plan_id, mapping.plan, mapping.cadence,
      mapping.price_paise, mapping.currency, status, currentStart, currentEnd,
      accessUntil, cancelAtEnd ? 1 : 0, eventAt, eventAt, eventAt, nowIso(),
      local.id, local.doctor_id)
  ];

  if (ACTIVE.has(status)) {
    statements.push(db.prepare(
      `UPDATE doctors SET plan = ?, plan_source = 'payment',
              plan_override_reason = NULL, plan_updated_at = ? WHERE id = ?`
    ).bind(mapping.plan, nowIso(), local.doctor_id));
    statements.push(db.prepare(
      'DELETE FROM plan_grace WHERE doctor_id = ?').bind(local.doctor_id));
  } else if (TERMINAL.has(status) && accessUntil && new Date(accessUntil) <= new Date()) {
    statements.push(db.prepare(
      `UPDATE doctors SET plan = 'basic', plan_source = 'payment_expired',
              plan_override_reason = NULL, plan_updated_at = ? WHERE id = ?`
    ).bind(nowIso(), local.doctor_id));
  }

  const payment = context.payment;
  if (payment && payment.id) {
    statements.push(db.prepare(
      `INSERT INTO subscription_payments
        (id, doctor_id, subscription_id, provider, provider_payment_id,
         provider_invoice_id, amount_paise, currency, status, occurred_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(provider, provider_payment_id) DO UPDATE SET
         status = excluded.status, provider_invoice_id = excluded.provider_invoice_id`
    ).bind(newId('spay'), local.doctor_id, local.id, PROVIDER, payment.id,
      payment.invoice_id || null, Number(payment.amount || 0), payment.currency || 'INR',
      payment.status || 'unknown', stamp(payment.created_at)));
  }

  const auditKey = context.eventId ||
    [snapshot.id, status, snapshot.current_end || 0].join(':');
  statements.push(db.prepare(
    `INSERT OR IGNORE INTO audit_events
      (id, doctor_id, actor, action, target_type, target_id, detail)
     VALUES (?,?,?,?,?,?,?)`
  ).bind('aud_' + (await sha256(PROVIDER + ':' + auditKey)).slice(0, 24),
    local.doctor_id, 'system:' + PROVIDER, 'subscription_' + status,
    'subscription', local.id, mapping.plan + ' ' + mapping.cadence));

  if (context.eventId) {
    statements.push(db.prepare(
      `UPDATE payment_webhook_events
          SET status = 'processed', processed_at = ?, last_error = NULL
        WHERE provider = ? AND event_id = ?`
    ).bind(nowIso(), PROVIDER, context.eventId));
  }

  await db.batch(statements);
  return currentLocal(db, local.doctor_id);
}

async function fetchAndApply(db, env, local, context = {}) {
  const snapshot = await providerRequest(env,
    '/subscriptions/' + encodeURIComponent(local.provider_subscription_id));
  return applySnapshot(db, local, snapshot, context);
}

export const subscriptions = {
  configured,

  async plans(db) {
    const { results } = await db.prepare(
      `SELECT plan, cadence, price_paise, currency
         FROM subscription_plan_catalog
        WHERE provider = ? AND active = 1
     ORDER BY price_paise`
    ).bind(PROVIDER).all();
    return results || [];
  },

  async status(db, env, doctorId) {
    return {
      ...publicHealth(env),
      subscription: publicSubscription(await currentLocal(db, doctorId)),
      plans: await this.plans(db)
    };
  },

  async start(db, env, doctor, { plan, cadence, couponCode }) {
    requireConfigured(env);
    if (!['starter', 'pro', 'pro_plus'].includes(plan)) {
      throw badRequest('Choose Practice, Clinic or Group. Free needs no payment.');
    }
    if (!['monthly', 'yearly'].includes(cadence)) {
      throw badRequest('Choose monthly or yearly billing.');
    }

    const existing = await currentLocal(db, doctor.id);
    if (existing && !TERMINAL.has(existing.status)) {
      /* Same plan, same billing period, still unpaid: hand back the
         checkout she already has rather than opening a second one. */
      if (existing.status === 'created' && existing.plan === plan &&
          existing.cadence === cadence && existing.checkout_url) {
        return publicSubscription(existing);
      }

      /* A DIFFERENT plan, and the one she started was never paid.
         This used to be refused - "already has a subscription in progress" -
         and it was wrong. Vijay: "people not paying does not mean they are
         not paying, they may upgrade."

         Exactly so. Somebody who opened a ₹899 checkout, thought about it,
         and came back wanting Clinic is the best thing that happens on this
         screen, and the software told her no. Worse, she could not undo it
         herself, so the answer to "I would like to pay you more" was a dead
         end.

         Nothing is at stake in dropping it: no money has moved, the old
         checkout is set to expire in 24 hours anyway, and customer_notify
         is false so Razorpay has never contacted her about it. */
      if (UNPAID.has(existing.status)) {
        await abandon(db, env, existing);
      } else {
        /* Paid, and running. Changing plan mid-period is a proration
           question, not a checkout - so it gets a real answer rather than a
           second subscription quietly charging her twice. */
        throw badRequest(
          'Your ' + (LABEL[existing.plan] || existing.plan) + ' plan is active and paid. ' +
          'Stop the renewal first and you can choose a different plan when the ' +
          'period you have paid for ends.');
      }
    }

    const catalog = await ensureProviderPlan(db, env, plan, cadence);

    /* A coupon is checked BEFORE the subscription is created, so a code that
       is expired, used up or for another plan is refused while she can still
       do something about it - rather than after a checkout exists.

       What travels to Razorpay is their offer id, never our percentage. The
       percentage is what we display; the offer is what discounts the card,
       and coupons.js will not let a coupon be switched on without one. */
    const coupon = couponCode
      ? await coupons.claim(db, doctor.id, couponCode, plan)
      : null;

    const id = newId('sub');
    const remote = await providerRequest(env, '/subscriptions', {
      method: 'POST',
      payload: {
        plan_id: catalog.provider_plan_id,
        total_count: cadence === 'yearly' ? 10 : 120,
        quantity: 1,
        ...(coupon ? { offer_id: coupon.offerId } : {}),
        /* TCOS presents the recorded hosted URL. Leaving provider delivery
           off means a rare failed local write can never email a customer an
           orphan checkout that TCOS cannot reconcile. */
        customer_notify: false,
        expire_by: Math.floor(Date.now() / 1000) + 86400,
        notes: { tcos_subscription_ref: id }
      }
    });

    await db.prepare(
      `INSERT INTO subscriptions
        (id, doctor_id, provider, provider_subscription_id, provider_plan_id,
         plan, cadence, price_paise, currency, status, checkout_url,
         current_start, current_end, access_until)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(id, doctor.id, PROVIDER, remote.id, catalog.provider_plan_id,
      plan, cadence, catalog.price_paise, catalog.currency,
      remote.status || 'created', remote.short_url || null,
      stamp(remote.current_start), stamp(remote.current_end), null).run();

    /* Recorded only now the subscription exists, so an abandoned checkout
       does not burn a limited offer. */
    if (coupon) {
      await coupons.recordRedemption(db, coupon, doctor.id, id, plan, cadence);
    }

    return publicSubscription(await currentLocal(db, doctor.id));
  },

  async refresh(db, env, doctorId) {
    requireConfigured(env);
    const local = await currentLocal(db, doctorId);
    if (!local) throw badRequest('This clinic has no subscription to refresh.');
    return publicSubscription(await fetchAndApply(db, env, local));
  },

  async cancel(db, env, doctorId) {
    requireConfigured(env);
    const local = await currentLocal(db, doctorId);
    if (!local || TERMINAL.has(local.status)) {
      throw badRequest('There is no active subscription to cancel.');
    }
    /* At cycle end only if there IS a cycle. A subscription she has paid
       for keeps running to the end of what she bought - stopping it the
       moment she clicks would be taking money for time she does not get.

       One she never paid for has no such period, and asking Razorpay to end
       an unstarted cycle is a request it refuses. That left a doctor who
       picked the wrong plan unable to cancel it and unable to choose
       another, because `start` will not open a second one while the first
       is alive. Vijay hit exactly that: a ₹8,990 yearly sitting unpaid with
       every other Choose button erroring. */
    const started = ACTIVE.has(local.status);
    const snapshot = await providerRequest(env,
      '/subscriptions/' + encodeURIComponent(local.provider_subscription_id) + '/cancel', {
        method: 'POST', payload: { cancel_at_cycle_end: started }
      });
    return publicSubscription(await applySnapshot(db, local, snapshot));
  },

  async syncPlans(db, env) {
    requireConfigured(env);
    const rows = await this.plans(db);
    const synced = [];
    for (const row of rows) {
      const result = await ensureProviderPlan(db, env, row.plan, row.cadence);
      synced.push({ plan: row.plan, cadence: row.cadence,
        providerPlanId: result.provider_plan_id });
    }
    return synced;
  },

  async adminList(db, env) {
    const { results } = await db.prepare(
      `SELECT s.id, s.doctor_id, d.clinic_name, d.full_name, s.plan, s.cadence,
              s.price_paise, s.currency, s.status, s.current_end,
              s.access_until, s.cancel_at_cycle_end, s.updated_at
         FROM subscriptions s JOIN doctors d ON d.id = s.doctor_id
     ORDER BY s.updated_at DESC LIMIT 500`
    ).all();
    return { health: adminHealth(env), subscriptions: results || [] };
  },

  async webhook(db, env, request) {
    requireConfigured(env);
    const raw = await request.arrayBuffer();
    const received = request.headers.get('x-razorpay-signature');
    if (!await verifyWebhookSignature(env.RAZORPAY_WEBHOOK_SECRET, raw, received)) {
      throw new ApiError(403, 'bad_webhook_signature', 'Webhook signature was not accepted.');
    }

    const eventId = String(request.headers.get('x-razorpay-event-id') || '').trim();
    if (!eventId) throw badRequest('Webhook event id is required.');
    const rawText = new TextDecoder().decode(raw);
    let event;
    try { event = JSON.parse(rawText); }
    catch { throw badRequest('Webhook body is not valid JSON.'); }
    const eventType = String(event.event || 'unknown').slice(0, 100);

    await db.prepare(
      `INSERT OR IGNORE INTO payment_webhook_events
        (provider, event_id, event_type, payload_sha256)
       VALUES (?,?,?,?)`
    ).bind(PROVIDER, eventId, eventType, await sha256(rawText)).run();

    /* One worker owns it. A worker that died while processing can be
       reclaimed after ten minutes when Razorpay retries. */
    const claim = await db.prepare(
      `UPDATE payment_webhook_events
          SET status = 'processing', attempts = attempts + 1,
              last_attempt_at = datetime('now'), last_error = NULL
        WHERE provider = ? AND event_id = ?
          AND (status IN ('received','failed') OR
               (status = 'processing' AND last_attempt_at < datetime('now','-10 minutes')))`
    ).bind(PROVIDER, eventId).run();
    if (!claim.meta || claim.meta.changes !== 1) {
      const prior = await db.prepare(
        `SELECT status FROM payment_webhook_events
          WHERE provider = ? AND event_id = ?`
      ).bind(PROVIDER, eventId).first();
      return { accepted: true, duplicate: true, status: prior && prior.status };
    }

    const providerSubscriptionId = subscriptionIdFromEvent(event);
    if (!providerSubscriptionId) {
      await db.prepare(
        `UPDATE payment_webhook_events SET status = 'ignored', processed_at = ?
          WHERE provider = ? AND event_id = ?`
      ).bind(nowIso(), PROVIDER, eventId).run();
      return { accepted: true, ignored: true };
    }

    const local = await localByProviderId(db, providerSubscriptionId);
    if (!local) {
      await db.prepare(
        `UPDATE payment_webhook_events SET status = 'ignored', processed_at = ?,
                last_error = 'subscription_not_mapped'
          WHERE provider = ? AND event_id = ?`
      ).bind(nowIso(), PROVIDER, eventId).run();
      return { accepted: true, ignored: true };
    }

    try {
      const applied = await fetchAndApply(db, env, local, {
        eventId, eventAt: event.created_at, payment: paymentFromEvent(event)
      });
      return { accepted: true, status: applied.status };
    } catch (error) {
      await db.prepare(
        `UPDATE payment_webhook_events SET status = 'failed', last_error = ?
          WHERE provider = ? AND event_id = ?`
      ).bind(String(error && error.message || 'processing failed').slice(0, 400),
        PROVIDER, eventId).run();
      throw error;
    }
  },

  /* The one clock, swept.
   *
     `sweepExpired` below handles subscriptions Razorpay has already told us
     are finished. This handles the other three ways a clinic runs out:
     a trial nobody converted, an offline payment nobody renewed, and a card
     that has quietly stopped working while the subscription still reads
     'active' because no webhook ever arrived to say otherwise.

     It moves her to Free only after BOTH grace windows have passed -
     Vijay's rule: three days for what costs us money per use, seven for
     what does not. featuresFor() already stops the expensive things on day
     three without waiting for this to run; this is what writes it down.

     DEMO ACCOUNTS ARE EXCLUDED IN THE QUERY, not filtered afterwards. A
     demo has no payment machinery at all, and the worst possible outcome
     here is a demonstration clinic quietly dropping to Free the morning he
     shows it to somebody. */
  async sweepLapsedClocks(db, graceDays) {
    const cutoff = new Date(Date.now() - graceDays * 86400000)
      .toISOString().slice(0, 10);

    const { results } = await db.prepare(
      `SELECT id, plan, plan_paid_until FROM doctors
        WHERE account_type != 'demo'
          AND plan_paid_until IS NOT NULL
          AND plan_paid_until < ?
          AND plan != 'basic'
          AND status = 'active'`
    ).bind(cutoff).all();

    for (const row of (results || [])) {
      await db.batch([
        db.prepare(
          `UPDATE doctors
              SET plan = 'basic', plan_source = 'payment_expired',
                  plan_note = ?, plan_paid_until = NULL, plan_updated_at = ?
            WHERE id = ?`
        ).bind('Moved to Free on ' + nowIso().slice(0, 10) +
          '; was ' + row.plan + ' until ' + String(row.plan_paid_until).slice(0, 10) +
          '. Nothing was deleted.', nowIso(), row.id),
        db.prepare(
          `INSERT OR IGNORE INTO audit_events
            (id, doctor_id, actor, action, target_type, target_id, detail)
           VALUES (?,?,?,?,?,?,?)`
        ).bind('aud_' + (await sha256('clock-lapsed:' + row.id + ':' + row.plan_paid_until)).slice(0, 24),
          row.id, 'system:billing', 'plan_clock_lapsed', 'doctor', row.id,
          'Was ' + row.plan + ' until ' + row.plan_paid_until + '; moved to Free. Data retained')
      ]);
    }
    return { moved: (results || []).length };
  },

  async sweepExpired(db) {
    const { results } = await db.prepare(
      `SELECT id, doctor_id FROM subscriptions
        WHERE status IN ('pending','halted','paused','cancelled','completed','expired')
          AND access_until IS NOT NULL AND access_until <= ?`
    ).bind(nowIso()).all();
    for (const row of (results || [])) {
      await db.batch([
        db.prepare(
          `UPDATE doctors SET plan = 'basic', plan_source = 'payment_expired',
                  plan_override_reason = NULL, plan_updated_at = ? WHERE id = ?`
        ).bind(nowIso(), row.doctor_id),
        db.prepare(
          `UPDATE subscriptions SET access_until = NULL, updated_at = ?
            WHERE id = ? AND doctor_id = ?`
        ).bind(nowIso(), row.id, row.doctor_id),
        db.prepare(
          `INSERT OR IGNORE INTO audit_events
            (id, doctor_id, actor, action, target_type, target_id, detail)
           VALUES (?,?,?,?,?,?,?)`
        ).bind('aud_' + (await sha256('subscription-expired:' + row.id)).slice(0, 24),
          row.doctor_id, 'system:billing', 'subscription_access_expired',
          'subscription', row.id, 'Moved to Free; data retained')
      ]);
    }
    return { checked: (results || []).length };
  }
};

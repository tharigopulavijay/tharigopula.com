/* =========================================================================
   A successful payment changes access without a person doing it.

   These tests guard the parts that are expensive to discover in production:
   accepting a forged callback, processing the same event twice, trusting an
   old event over current provider state, storing payment credentials, and a
   payment that succeeds but leaves the clinic on its old plan.
   ========================================================================= */

import { createHmac } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { subscriptions, verifyWebhookSignature,
         subscriptionIdFromEvent } from '../worker/subscriptions.js';

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};

console.log('\nThe schema stores entitlement proof, never payment credentials\n');

const db = new DatabaseSync(':memory:');
db.exec(readFileSync('schema.sql', 'utf8'));
const migration = readFileSync('migrations/038-subscriptions.sql', 'utf8');
db.exec(migration);
db.exec(`
  ALTER TABLE doctors ADD COLUMN plan_source TEXT NOT NULL DEFAULT 'legacy';
  ALTER TABLE doctors ADD COLUMN plan_override_reason TEXT;
  ALTER TABLE doctors ADD COLUMN plan_updated_at TEXT;
`);

const tables = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%subscription%'"
).all().map(row => row.name);
check('plan catalogue, subscriptions and payment receipts exist',
  ['subscription_plan_catalog', 'subscriptions', 'subscription_payments']
    .every(name => tables.includes(name)), tables.join(', '));

const allColumns = ['subscriptions', 'subscription_payments', 'payment_webhook_events']
  .flatMap(table => db.prepare('PRAGMA table_info(' + table + ')').all().map(row => row.name));
check('no card, CVV, bank account, UPI mandate or raw payload is stored',
  !allColumns.some(name => /card|cvv|bank|upi|mandate|raw|payload_json/i.test(name)),
  allColumns.filter(name => /card|cvv|bank|upi|mandate|raw|payload_json/i.test(name)).join(', '));

check('all six monthly and yearly price snapshots are present',
  db.prepare('SELECT COUNT(*) AS n FROM subscription_plan_catalog').get().n === 6);
check('only one active price can exist for a plan and cadence',
  db.prepare("SELECT sql FROM sqlite_master WHERE name='idx_subscription_catalog_one_active'")
    .get().sql.includes('WHERE active = 1'));
check('replaying seed rows cannot erase an existing provider plan mapping',
  /INSERT OR IGNORE INTO subscription_plan_catalog/.test(migration) &&
  !/INSERT OR REPLACE INTO subscription_plan_catalog/.test(migration));

console.log('\nOnly Razorpay can say a payment happened\n');

const secret = 'test-webhook-secret';
const raw = Buffer.from('{"event":"subscription.activated","n":1}');
const signature = createHmac('sha256', secret).update(raw).digest('hex');
check('the signature over the exact raw bytes is accepted',
  await verifyWebhookSignature(secret, raw, signature));
check('changing one byte is refused',
  !await verifyWebhookSignature(secret, Buffer.from('{"event":"subscription.activated","n":2}'), signature));
check('missing and malformed signatures are refused',
  !await verifyWebhookSignature(secret, raw, null) &&
  !await verifyWebhookSignature(secret, raw, 'not-a-signature'));

check('subscription events identify the subscription directly',
  subscriptionIdFromEvent({ payload: { subscription: { entity: { id: 'sub_1' } } } }) === 'sub_1');
check('payment events fall back to payment.subscription_id',
  subscriptionIdFromEvent({ payload: { payment: { entity: { subscription_id: 'sub_2' } } } }) === 'sub_2');
check('an unrelated event cannot select a subscription',
  subscriptionIdFromEvent({ payload: { payment: { entity: { id: 'pay_1' } } } }) === null);

/* A tiny D1-compatible wrapper over the same SQLite engine the schema test
   uses. This runs the real webhook repository code, including db.batch. */
class D1Statement {
  constructor(sql, args = []) { this.sql = sql; this.args = args; }
  bind(...args) { return new D1Statement(this.sql, args); }
  async first() { return db.prepare(this.sql).get(...this.args) || null; }
  async all() { return { results: db.prepare(this.sql).all(...this.args) }; }
  async run() {
    const result = db.prepare(this.sql).run(...this.args);
    return { meta: { changes: Number(result.changes || 0) } };
  }
}
const d1 = {
  prepare: sql => new D1Statement(sql),
  async batch(statements) {
    db.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      db.exec('COMMIT');
      return results;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
};

db.exec(`
  CREATE TABLE plan_grace (doctor_id TEXT NOT NULL, limit_key TEXT NOT NULL);
  INSERT INTO doctors (id, mobile, full_name, clinic_name, plan)
    VALUES ('doc_pay', '+919000000099', 'Dr Pay', 'Payment Clinic', 'basic');
  UPDATE subscription_plan_catalog SET provider_plan_id = 'plan_test'
    WHERE id = 'rzp_starter_monthly_v1';
  INSERT INTO subscriptions
    (id, doctor_id, provider, provider_subscription_id, provider_plan_id,
     plan, cadence, price_paise, currency, status, checkout_url)
    VALUES ('sub_local', 'doc_pay', 'razorpay', 'sub_remote', 'plan_test',
            'starter', 'monthly', 89900, 'INR', 'created', 'https://rzp.io/i/test');
`);

const webhookEvent = {
  event: 'subscription.activated',
  created_at: 1788883200,
  payload: {
    subscription: { entity: { id: 'sub_remote' } },
    payment: { entity: { id: 'pay_remote', subscription_id: 'sub_remote',
      invoice_id: 'inv_remote', amount: 89900, currency: 'INR',
      status: 'captured', created_at: 1788883200 } }
  }
};
const webhookBody = JSON.stringify(webhookEvent);
const webhookSecret = 'full-flow-webhook-secret';
const webhookSignature = createHmac('sha256', webhookSecret)
  .update(webhookBody).digest('hex');
const env = { RAZORPAY_KEY_ID: 'rzp_test_id', RAZORPAY_KEY_SECRET: 'test-secret',
  RAZORPAY_WEBHOOK_SECRET: webhookSecret };
const request = () => new Request('https://api.test/webhooks/razorpay', {
  method: 'POST', body: webhookBody,
  headers: { 'x-razorpay-signature': webhookSignature,
    'x-razorpay-event-id': 'event_1' }
});

const originalFetch = globalThis.fetch;
globalThis.fetch = async url => {
  if (!String(url).endsWith('/subscriptions/sub_remote')) {
    return new Response('{}', { status: 404, headers: { 'Content-Type': 'application/json' } });
  }
  return new Response(JSON.stringify({
    id: 'sub_remote', plan_id: 'plan_test', status: 'active',
    current_start: 1788883200, current_end: 1791475200,
    has_scheduled_changes: false
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

const firstDelivery = await subscriptions.webhook(d1, env, request());
const secondDelivery = await subscriptions.webhook(d1, env, request());
globalThis.fetch = originalFetch;

check('a signed active subscription changes the clinic plan immediately',
  firstDelivery.status === 'active' &&
  db.prepare("SELECT plan FROM doctors WHERE id='doc_pay'").get().plan === 'starter');
check('the provider payment is recorded once',
  db.prepare("SELECT COUNT(*) AS n FROM subscription_payments WHERE doctor_id='doc_pay'").get().n === 1);
check('the webhook is completed, not left half-claimed',
  db.prepare("SELECT status FROM payment_webhook_events WHERE event_id='event_1'").get().status === 'processed');
check('redelivery is acknowledged without changing anything twice',
  secondDelivery.duplicate === true &&
  db.prepare("SELECT COUNT(*) AS n FROM subscription_payments WHERE doctor_id='doc_pay'").get().n === 1);

/* Existing subscribers remain valid after TCOS publishes a new price. The
   old catalogue row becomes inactive for new checkout but is still the
   immutable price/entitlement mapping that customer authorised. */
db.exec("UPDATE subscription_plan_catalog SET active = 0 WHERE provider_plan_id = 'plan_test'");
const historicalBody = JSON.stringify({ ...webhookEvent, created_at: 1788886800 });
const historicalSignature = createHmac('sha256', webhookSecret)
  .update(historicalBody).digest('hex');
globalThis.fetch = async url => {
  if (!String(url).endsWith('/subscriptions/sub_remote')) return new Response('{}', { status: 404 });
  return new Response(JSON.stringify({
    id: 'sub_remote', plan_id: 'plan_test', status: 'active',
    current_start: 1788883200, current_end: 1791475200,
    has_scheduled_changes: false
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
const historicalDelivery = await subscriptions.webhook(d1, env,
  new Request('https://api.test/webhooks/razorpay', {
    method: 'POST', body: historicalBody,
    headers: { 'x-razorpay-signature': historicalSignature,
      'x-razorpay-event-id': 'event_historical_plan' }
  }));
globalThis.fetch = originalFetch;
check('a paid subscriber survives a later catalogue price change',
  historicalDelivery.status === 'active' &&
  db.prepare("SELECT plan FROM doctors WHERE id='doc_pay'").get().plan === 'starter');

db.exec(`
  INSERT INTO doctors (id, mobile, full_name, clinic_name, plan)
    VALUES ('doc_authorised', '+919000000098', 'Dr Authorised', 'Authorisation Clinic', 'basic');
  INSERT INTO subscriptions
    (id, doctor_id, provider, provider_subscription_id, provider_plan_id,
     plan, cadence, price_paise, currency, status, checkout_url)
    VALUES ('sub_auth_local', 'doc_authorised', 'razorpay', 'sub_auth_remote', 'plan_test',
            'starter', 'monthly', 89900, 'INR', 'created', 'https://rzp.io/i/auth');
`);
const authorisedEvent = JSON.stringify({ event: 'subscription.authenticated',
  created_at: 1788886900,
  payload: { subscription: { entity: { id: 'sub_auth_remote' } } } });
const authorisedSignature = createHmac('sha256', webhookSecret)
  .update(authorisedEvent).digest('hex');
globalThis.fetch = async url => {
  if (!String(url).endsWith('/subscriptions/sub_auth_remote')) return new Response('{}', { status: 404 });
  return new Response(JSON.stringify({
    id: 'sub_auth_remote', plan_id: 'plan_test', status: 'authenticated',
    has_scheduled_changes: false
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
await subscriptions.webhook(d1, env,
  new Request('https://api.test/webhooks/razorpay', {
    method: 'POST', body: authorisedEvent,
    headers: { 'x-razorpay-signature': authorisedSignature,
      'x-razorpay-event-id': 'event_authorised_only' }
  }));
globalThis.fetch = originalFetch;
check('an authorised mandate does not unlock the paid plan before it is active',
  db.prepare("SELECT plan FROM doctors WHERE id='doc_authorised'").get().plan === 'basic');

console.log('\nThe webhook is idempotent, current and atomic\n');

const source = readFileSync('worker/subscriptions.js', 'utf8');
const router = readFileSync('worker/index.js', 'utf8');
const ui = readFileSync('js/subscription.js', 'utf8');
const page = readFileSync('subscription.html', 'utf8');
const adminPage = readFileSync('admin.html', 'utf8');
const adminUi = readFileSync('js/tcos-admin-console.js', 'utf8');
const adminApi = readFileSync('js/tcos-admin-api.js', 'utf8');

const webhook = source.slice(source.indexOf('async webhook(db, env, request)'),
  source.indexOf('async sweepExpired(db)'));
check('raw bytes are read before the webhook is parsed',
  webhook.indexOf('request.arrayBuffer()') > -1 &&
  webhook.indexOf('request.arrayBuffer()') < webhook.indexOf('JSON.parse'));
check('Razorpay event ids are the duplicate key',
  /x-razorpay-event-id/.test(webhook) && /INSERT OR IGNORE INTO payment_webhook_events/.test(webhook));
check('a claimed event cannot be processed concurrently',
  /status = 'processing'/.test(webhook) && /claim\.meta\.changes !== 1/.test(webhook));
check('a stale event is reconciled against the provider now',
  /fetchAndApply\(db, env, local/.test(webhook) &&
  source.includes("'/subscriptions/' + encodeURIComponent(local.provider_subscription_id)"));
check('historical provider plans still resolve after a price change',
  /WHERE provider = \? AND provider_plan_id = \?`/.test(source));
check('subscription, entitlement, receipt and event completion share a D1 transaction',
  /await db\.batch\(statements\)/.test(source));
check('a captured payment is unique at the database boundary',
  /ON CONFLICT\(provider, provider_payment_id\) DO UPDATE/.test(source));

console.log('\nAccess follows money without deleting care records\n');

check('only provider-active state grants the paid plan',
  /if \(ACTIVE\.has\(status\)\)[\s\S]{0,400}UPDATE doctors SET plan = \?/.test(source));
check('mandate authentication alone is not treated as paid access',
  /const ACTIVE = new Set\(\['active'\]\)/.test(source));
check('failed renewal gets exactly a three-day reserve opened once',
  /if \(!TROUBLE\.has\(local\.status\)\) accessUntil = plusDays\(3\)/.test(source));
check('expiry moves to Free and says data was retained',
  /UPDATE doctors SET plan = 'basic'/.test(source) && /data retained/.test(source));
check('the nightly Worker runs the reserve-expiry sweep',
  /sweepSubscriptionAccess\(env\)/.test(router));

console.log('\nThe doctor controls payment without exposing secrets\n');

for (const route of ['GET /subscription', 'POST /subscription/checkout',
  'POST /subscription/refresh', 'POST /subscription/cancel']) {
  const at = router.indexOf("'" + route + "':");
  const body = at < 0 ? '' : router.slice(at, at + 700);
  check(route + ' belongs to the clinic owner',
    /requireDoctor/.test(body) && /CAN\.SETTINGS/.test(body));
}
check('the webhook has no doctor or admin session gate',
  /'POST \/webhooks\/razorpay':[\s\S]{0,180}subscriptions\.webhook/.test(router));
check('the browser receives a hosted URL, not a Razorpay secret',
  /checkoutUrl/.test(ui) && /target="_blank"/.test(ui) &&
  !/KEY_SECRET|WEBHOOK_SECRET/.test(ui + page));
check('the signed-in payment page uses the standard rail/workspace shell',
  /<div class="console">\s*<nav class="rail"><\/nav>\s*<main class="workspace">/.test(page));
check('the payment page paints the signed-in clinic identity, not a page-name string',
  /TCOSRail\.paint\(me\)/.test(ui) && !/TCOSRail\.paint\(['"]subscription/.test(ui));
/* Was `class="stat plan-card"` in css/tcos.css until 11 September 2026. The
   card moved to its own stylesheet when the screen stopped being a price
   and a button - Vijay: "payment should not be a payment, it should show
   what they would be getting" - so the assertion follows it rather than
   pinning a class name that no longer exists. The intent is unchanged: a
   plan is a tall card you can read down, never a row of squeezed stats. */
const plansCss = readFileSync('css/plans.css', 'utf8');
check('plan choices use their own vertical card rather than a squeezed stat row',
  /<article class="plan/.test(ui) && !/class="stat plan-card"/.test(ui) &&
  /\.plan\s*\{[^}]*flex-direction:\s*column/s.test(plansCss));
/* And the card has to carry the thing it exists for. A doctor deciding to
   spend ₹2,199 a month needs what she gets beside the number. */
check('and the card shows what the plan includes, not just its price',
  /plan-features/.test(ui) && /FEATURE_LABEL/.test(ui) && /plan-limits/.test(ui));
/* Was `cancel_at_cycle_end: true`, unconditionally. The rule it protects is
   right and unchanged: a subscription somebody has PAID for runs to the end
   of what they bought, because cutting it off early is taking money for
   time they do not get.

   But a subscription that was never paid has no cycle to end, and Razorpay
   refuses to schedule one - which left a doctor who started the wrong plan
   unable to cancel it AND unable to choose another, since `start` will not
   open a second while the first is alive. So the flag now follows whether
   the thing ever actually started. */
check('a paid subscription is cancelled at period end, not deleted immediately',
  /cancel_at_cycle_end:\s*started/.test(source) &&
  /const started = ACTIVE\.has\(local\.status\)/.test(source));
check('and one that was never paid is cancelled immediately, so she is not stuck',
  /ACTIVE\.has\(local\.status\)/.test(source) && !/cancel_at_cycle_end:\s*true/.test(source));
check('Razorpay cannot deliver an unrecorded orphan checkout',
  /customer_notify: false/.test(source));

console.log('\nThe owner can see whether the automation is healthy\n');

check('the platform console has a subscription operations screen',
  /data-view="subscriptions"/.test(adminPage) &&
  /data-panel="subscriptions"/.test(adminPage));
check('the console reports provider setup without exposing a secret',
  /health\.configured/.test(adminUi) && /health\.missing/.test(adminUi) &&
  !/KEY_SECRET|WEBHOOK_SECRET/.test(adminPage + adminUi));
check('only a teammate with subscription access is offered provider plan synchronisation',
  /syncPaymentPlans'\)\.hidden = !may\('subscriptions'\)/.test(adminUi) &&
  /requireFreshAdminCapability\(env, request, 'subscriptions'\)/.test(router));
check('plan sync cannot be clicked before provider credentials are configured',
  /syncButton\.disabled = !health\.configured/.test(adminUi));
check('subscription operations use the dedicated admin client',
  /subscriptions: \(\) => request\('GET', '\/admin\/subscriptions'\)/.test(adminApi) &&
  /syncSubscriptionPlans: \(\) => request\('POST', '\/admin\/subscriptions\/sync-plans'\)/.test(adminApi));
check('manual onboarding offers every real TCOS plan',
  /\['basic', 'starter', 'pro', 'pro_plus'\]/.test(adminUi));

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);

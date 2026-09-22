/* =========================================================================
   TCOS API - Cloudflare Worker

   Every request that touches clinical data goes through requireDoctor(),
   which resolves a session to exactly one doctor id. That id is then passed
   as the first argument to every repo call. A handler never chooses which
   doctor's data to read - the session decides.
   ========================================================================= */

import {
  json, ApiError, badRequest, unauthorised, notFound, forbidden,
  newSessionToken, sha256, hashPassword, verifyPasswordVersioned, activePepper,
  normaliseMobile, maskIdentifier, nowIso, isEmail, appOrigin, appHost
} from '@tharigopula/core/lib';
import { issueOtp, verifyOtp, classifyIdentifier } from './otp.js';
import {
  passkeys, challenges as passkeyChallenges, toBase64Url, SUPPORTED_ALGORITHMS
} from './passkeys.js';
import {
  doctors, sessions, patients, visits, prescriptions,
  labReports, stock, consent, audit, usage, appointments, drugs, messages, consultNotes,
  carePlans
} from './repo.js';
import {
  team, adminSessions, requireAdmin, requireFreshAdmin, adminSignIn,
  requireAdminCapability, requireFreshAdminCapability, platformCapabilities,
  generateTempPassword,
  tenants, invites, bootstrap,
  platformPatients, platformAnalytics, supportRequests, applications
} from './platform.js';
import {
  staff, actorFor, actorKey, requireCan, requireCan as need,
  CAN, roleList, temporaryPassword
} from './staff.js';
import { billing } from './billing.js';
import { reports } from './reports.js';
import * as patientView from './patientview.js';
import * as publicPage from './publicpage.js';
import { cleanWeek, describeWeek, closures } from './schedule.js';
import { costs, rates, businessCosts } from './costs.js';
import { requireQuota, planStatus, clearReserve } from './quota.js';
import { requireFeature, featuresFor, hasFeature, ADDONS,
  GRACE_DAYS, planStanding } from './entitlements.js';
import { offlinePayments, PRICE_PAISE, METHODS, TERMS } from './offlinepayments.js';
import { demoSeed, DEMO_CLINICS } from './demoseed.js';
import { clinicSiteResponse, clinicSiteFallback } from './clinicsite.js';
import { files, fileHeaders } from './files.js';
import { aiops, stopped } from './aiops.js';
import { domains, dnsRecords, freeHost } from './domains.js';
import * as customHostname from './customhostname.js';
import { ownerDashboard } from './ownerdashboard.js';
import { coupons } from './coupons.js';
import { domainAdmin } from './domainadmin.js';
import { leads } from './leads.js';
import { clinicFields, PRINT_MAX } from './clinicfields.js';
import { ai, batch } from './ai.js';
import { cleanAbha, cleanHprId, cleanHfrId, formatAbhaNumber } from './abha.js';
import * as wa from './whatsapp.js';
import { sms } from '@tharigopula/core/comms';
import { email } from '@tharigopula/core/comms';
import { transcribe, draftNote, costPaise as consultCost,
         checkLength as checkRecording, configured as scribeReady } from './scribe.js';
import { sendToPatient, sendDayReminders, indiaDayAfter, runNightlyReminders,
         reminderLinks } from './messaging.js';
import { drafts } from './drafts.js';
import { consultationDrafts } from './consultationdraft.js';
import { preflights } from './preflights.js';
import { subscriptions } from './subscriptions.js';
import {
  enforceRateLimit, enforceSourceRateLimit, authThrottle
} from '@tharigopula/core/auth';
import { challengeConfig, verifyTurnstile } from './turnstile.js';
import {
  CLINIC_SESSION_COOKIE, ADMIN_SESSION_COOKIE, sessionCredential,
  newCsrfToken, requireCookieCsrf, sessionCookie, clearSessionCookie,
  cookieAuthEnforced
} from './session-security.js';
import {
  ACCESS_EMAIL_HEADER, accessEnforced, verifyPlatformAccess
} from '@tharigopula/core/auth';

/* The doctor is told WHY, and what happens to her patients.

   "This account is suspended. Contact TCOS support." tells somebody with a
   waiting room full of people nothing they can act on, and leaves them
   fearing their records are gone. Both halves of this message matter: the
   reason, so she knows whether to send a certificate or ring us, and the
   reassurance, because the patients' own access links keep working and their
   history is not lost. */
function suspendedError(doctor) {
  const reason = (doctor.suspended_reason || '').trim();
  return new ApiError(403, 'suspended',
    (reason || 'This clinic\'s access has been paused.') +
    ' Your patients\' records are safe and their own record links still work. ' +
    'Reply to this or write to hello@tharigopula.com and we will sort it out.');
}

/* Provider cleanup cannot be allowed to undo a successful clinical read.
   It records its own state, retries independently and escalates after three
   failed attempts. The support ticket contains provider machine state only,
   never a patient name or report content. */
async function cleanBatchProviderFiles(env, doctorId, queueId, fileIds) {
  let cleaned;
  try {
    cleaned = await batch.deleteFiles(env, fileIds);
  } catch (error) {
    cleaned = {
      complete: false,
      failures: [error instanceof Error ? error.message : 'provider cleanup failed']
    };
  }
  const state = await aiops.noteProviderCleanup(env.DB, doctorId, queueId, cleaned);
  if (!cleaned.complete && state && state.attempts === 3) {
    await aiops.alertProviderCleanup(env.DB, doctorId, queueId, state.error);
  }
  return cleaned;
}

async function sweepProviderFiles(env) {
  const rows = await aiops.providerCleanupPendingAll(env.DB, 100);
  let complete = 0, failed = 0;
  for (const row of rows) {
    const result = await cleanBatchProviderFiles(env, row.doctor_id, row.id, [
      row.provider_input_file_id, row.provider_output_file_id,
      row.provider_error_file_id
    ]);
    if (result.complete) complete++; else failed++;
  }
  return { checked: rows.length, complete, failed };
}

async function sweepSubscriptionAccess(env) {
  /* Two sweeps, because a clinic runs out in two different ways.
   *
     sweepExpired closes subscriptions Razorpay has told us are finished.
     sweepLapsedClocks catches the ones nobody was told about: a trial that
     nobody converted, an offline payment nobody renewed, and a card that
     stopped working while the subscription still reads 'active' because no
     webhook ever arrived.

     GRACE_DAYS.rest is the longer of the two windows, so this only writes
     'Free' once BOTH have passed. The expensive features stopped three days
     earlier, in featuresFor(), without waiting for a nightly job - because
     a sweep that runs at 13:30 is not a control over something billed per
     use at 09:00. */
  const closed = await subscriptions.sweepExpired(env.DB);
  const lapsed = await subscriptions.sweepLapsedClocks(env.DB, GRACE_DAYS.rest);
  return { ...closed, ...lapsed };
}

const CORS = origin => {
  const headers = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-CSRF-Token',
    'Vary': 'Origin'
  };
  /* Credentials are not permitted alongside '*', and the public endpoints
     have no session to send. */
  if (origin !== '*') headers['Access-Control-Allow-Credentials'] = 'true';
  return headers;
};

/* Two different CORS answers, because there are two kinds of caller.

   Signed-in screens are ours, so they get an allowlist and credentials.

   The public endpoints are the opposite: a doctor's own website may live on
   any domain in the world, and we cannot know it in advance. Those get "*"
   and no credentials - which is safe precisely because they carry no session.
   Restricting them by origin would mean every doctor emailing us to be added
   to a list, which is the per-doctor work this whole feature exists to
   avoid. */
/* Reachable without a session. '/u/' is the patient upload link - the
   only public path that WRITES, and it is held to the same rule as the
   read path: the token decides everything and nothing is taken from the
   request. */
const PUBLIC_PREFIXES = ['/clinic/', '/p/', '/u/'];
const isPublicPath = pathname => PUBLIC_PREFIXES.some(p => pathname.startsWith(p));

/* WHERE THE APP IS SERVED FROM - one answer, in one place.
 *
 * This hostname was written out separately in three places: the CORS
 * allow-list, the platform-host check, and the patient link base. Three
 * copies of a fact is three chances to change two of them, and it made
 * moving the site off a hostname a code change in three files rather than
 * one variable - which mattered on 8 Sep 2026, when the old hostname had to
 * be abandoned because Cloudflare's edge kept serving cached copies of
 * files that had already been deleted from the deployment.
 *
 * Set APP_ORIGIN in wrangler.jsonc to move the app. Nothing else changes. */
/* appOrigin/appHost now live in lib.js, because platform.js needs the same
   answer for the sign-in link in the welcome email. */
const adminOrigin = env => (env.ADMIN_ORIGIN || appOrigin(env)).replace(/\/+$/, '');

/* A passkey's relying party is a HOSTNAME, never an origin with a scheme.
   Passing the origin makes the browser refuse to create the credential at
   all, with an error about the RP id not being valid for this domain - and
   the screen just says setup failed. */
const rpIdFor = origin => { try { return new URL(origin).hostname; } catch { return ''; } };

/* Who a clinic passkey belongs to. A doctor is her own subject; a member of
   staff is scoped under the clinic, because the same person could in
   principle work in two and the credential must not carry her across.

   Reads the ACTOR that requireDoctor hangs on the doctor object, not the
   doctor row - the row is the clinic either way, so keying on it would
   give the receptionist and the doctor one shared passkey. */
const clinicPasskeySubject = doctor =>
  doctor.actor && doctor.actor.userId
    ? doctor.id + ':' + doctor.actor.userId
    : doctor.id;
const adminHost = env => { try { return new URL(adminOrigin(env)).hostname; } catch { return ''; } };

function allowedOrigin(env, request, pathname) {
  if (isPublicPath(pathname)) return '*';
  const origin = request.headers.get('Origin') || '';
  const defaults = [appOrigin(env), adminOrigin(env), 'http://localhost:8899'];
  const allowed = (env.ALLOWED_ORIGINS || defaults.join(','))
    .split(',').map(s => s.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : allowed[0];
}

/* Both the canonical extensionless page and the legacy .html bookmark are
   part of the platform perimeter, as are all admin APIs. Static Assets may
   redirect admin.html to /admin, but the first request must not bypass the
   outer Access check. */
const isPlatformAdminPath = pathname =>
  pathname === '/admin' || pathname === '/admin.html' || pathname.startsWith('/admin/');

/* `_headers` protects static assets. Worker-generated API, error and file
   responses do not inherit those rules, so apply the non-content-specific
   browser protections again at the final response boundary. */
function hardenResponse(response) {
  const hardened = new Response(response.body, response);
  const headers = hardened.headers;
  if (!headers.has('X-Content-Type-Options')) headers.set('X-Content-Type-Options', 'nosniff');
  if (!headers.has('X-Frame-Options')) headers.set('X-Frame-Options', 'DENY');
  if (!headers.has('Referrer-Policy')) {
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  }
  if (!headers.has('Strict-Transport-Security')) {
    headers.set('Strict-Transport-Security', 'max-age=31536000');
  }
  if (!headers.has('Permissions-Policy')) {
    headers.set('Permissions-Policy',
      'camera=(), geolocation=(self), microphone=(self), payment=(), usb=()');
  }
  return hardened;
}

/* ---------------- session ---------------- */

/* Resolves a token into two facts: whose clinic this is, and who is holding
   the session. The first has always decided which rows are visible. The
   second now decides which of them this person may open.

   Everything downstream still receives the doctor object, so no existing
   call site changes meaning - the actor rides along on it. */
async function requireDoctor(env, request) {
  const credential = sessionCredential(request, CLINIC_SESSION_COOKIE, env);
  if (!credential) throw unauthorised();

  const resolved = await sessions.resolve(env.DB, await sha256(credential.token));
  if (!resolved) throw unauthorised();
  await requireCookieCsrf(env, request, credential, resolved.csrfHash);

  const doctor = await doctors.byId(env.DB, resolved.doctorId);
  if (!doctor) throw unauthorised();
  if (doctor.status === 'suspended') throw suspendedError(doctor);

  let user = null;
  if (resolved.userId) {
    user = await staff.byId(env.DB, doctor.id, resolved.userId);
    /* Revoked mid-session, or moved to another clinic: the token is dead. */
    if (!user || user.status !== 'active') throw unauthorised();
  }
  doctor.actor = actorFor(doctor, user);
  return doctor;
}

/* Shorthand at the call sites, so a guarded route reads as one line. */
const gate = (doctor, capability) => requireCan(doctor.actor, capability);

/* The API's own hostnames, where "/" means the health check rather than a
   clinic page. Anything else reaching the root is a clinic address. */
function isPlatformHost(env, host) {
  const clean = String(host || '').toLowerCase().split(':')[0];
  if (!clean || clean === 'localhost' || clean === '127.0.0.1') return true;
  const platform = env.CLINIC_DOMAIN || 'tcos.in';
  /* CONSOLE_HOSTS keeps the OLD console address working after the canonical
     one moved. Without it, admin.tcos.tharigopula.com stops being a
     platform host the moment ADMIN_ORIGIN changes, and a link Vijay has
     been given several times starts being read as a clinic slug. */
  const extra = String(env.CONSOLE_HOSTS || '').toLowerCase()
    .split(',').map(host => host.trim()).filter(Boolean);
  return clean === platform || clean.endsWith('.workers.dev') ||
    clean === appHost(env) || clean === adminHost(env) || extra.includes(clean);
}

/* Verification gates three things and nothing else - see migration 014.
   Everything a doctor does inside her own clinic works unverified; what
   needs this is publishing under our name, printing a registration number
   we have not seen, and reaching into another clinic's records. */
const isVerified = doctor => doctor.verification_status === 'verified';

function requireVerified(doctor, what) {
  if (isVerified(doctor)) return;
  throw new ApiError(403, 'not_verified',
    'We need to verify your registration before you can ' + what +
    '. Send your certificate from My practice and we will confirm it within two working days.');
}

const body = async request => {
  try { return await request.json(); }
  catch (_) { throw badRequest('Expected a JSON body.'); }
};

/* ---------------- routes ---------------- */

const routes = {

  /* Public configuration contains only the site key. The verification key
     remains a Worker secret and is never returned to the browser. */
  'GET /security/challenge': async env => json(challengeConfig(env)),

  /* --- signup: identifier first, code, then the account --- */

  /* --- how a doctor joins ---

     Public, unauthenticated, and it creates NOTHING she can sign into. It
     records an application; a person at Tharigopula checks the registration
     number and approves it, and approval is what creates the account.

     This replaced a self-signup route that minted a live clinical account
     from a form and an SMS code, with nobody verifying the doctor was a
     doctor. That route is gone; see migration 013. */
  'POST /apply': async (env, request) => {
    const details = await body(request);
    await enforceRateLimit(env, 'PUBLIC_RATE_LIMITER', {
      scope: 'doctor_application',
      subject: normaliseMobile(details.mobile) || details.mobile,
      message: 'Several applications were sent from this number. Wait a minute and try again.'
    });
    await enforceSourceRateLimit(env, 'PUBLIC_RATE_LIMITER', request, {
      scope: 'doctor_application',
      message: 'Several applications were sent from this connection. Wait a minute and try again.'
    });
    await verifyTurnstile(env, request, {
      token: details.turnstileToken, action: 'doctor_application'
    });
    const application = await applications.submit(env.DB, details);
    await audit.write(env.DB, {
      actor: 'public', action: 'application_submitted',
      targetType: 'application', targetId: application.id,
      detail: application.clinic_name
    });
    return json({
      applicationId: application.id,
      received: true,
      message: 'Thank you. We verify every doctor before activating an account, and will call you within two working days.'
    }, 201);
  },

  /* ONE CUSTOMER, IN FULL - and nothing clinical.

     Vijay: "i want to look into his account full access, like how many
     doctors and how many devices he is logging in and how many staffs he
     added ... if doctor says this is not working we will have access to
     check."

     Everything this returns is operational: her people, her live devices,
     her plan and what she has paid, how much of it she uses, and what has
     happened on the account. Patients, visits and prescriptions are
     COUNTED, never opened. See tenants.overview for why that line is where
     it is.

     The open is audited against her clinic, so she can see that somebody
     from the platform looked - which is the price of being able to. */
  'GET /admin/doctors/:id/overview': async (env, request, params) => {
    const admin = await requireAdminCapability(env, request, 'doctors');
    const overview = await tenants.overview(env.DB, params.id);
    await audit.write(env.DB, {
      doctorId: params.id, actor: 'platform:' + admin.email,
      action: 'clinic_overview_opened', targetType: 'doctor', targetId: params.id
    });
    return json(overview);
  },

  /* The certificate itself, so whoever verifies a registration is looking
     at the document rather than at a filename. Admin rank, and every open
     is written to the audit log - reading a doctor's papers is a thing that
     should leave a trace. */
  'GET /admin/doctors/:id/certificate': async (env, request, params) => {
    const admin = await requireAdminCapability(env, request, 'doctors');
    const certificate = await files.certificateFor(env.DB, params.id);
    if (!certificate) throw notFound('This doctor has not sent a certificate.');
    const { meta, object } = await files.open(
      env.DB, env, params.id, certificate.id);
    await audit.write(env.DB, {
      doctorId: params.id, actor: 'platform:' + admin.email,
      action: 'certificate_opened', targetType: 'file', targetId: meta.id
    });
    return new Response(object.body, { headers: fileHeaders(meta) });
  },

  /* Verify a doctor who did not come through an application - one who
     signed in with Google, or one whose registration we need to withdraw. */
  'POST /admin/doctors/:id/verification': async (env, request, params) => {
    const admin = await requireFreshAdminCapability(env, request, 'doctors');
    const { status, note } = await body(request);
    const doctor = await tenants.setVerification(env.DB, params.id, admin, { status, note });
    if (!doctor) throw notFound('No such doctor.');
    await audit.write(env.DB, {
      doctorId: params.id, actor: 'platform:' + admin.email,
      action: 'verification_' + status, targetType: 'doctor', targetId: params.id,
      detail: note || null
    });
    return json({ doctor });
  },

  /* What the business is making. Finance rank, because it is the only
     screen that shows revenue - and it shows no clinical data at all. */
  /* What the AI is spending right now, and whether anything has been
     stopped. Separate from /admin/costs, which reports last month's margin -
     that answers "did we make money", this answers "is something wrong at
     this moment", and they are different questions asked in different moods. */
  /* Who still needs their registration checked, soonest first. The work is
     visible before it is overdue rather than after. */
  'GET /admin/verification-queue': async (env, request) => {
    await requireAdminCapability(env, request, 'applications');
    const waiting = await tenants.awaitingVerification(env.DB);
    return json({
      waiting,
      overdue: waiting.filter(d => d.days_left !== null && d.days_left < 0).length,
      dueThisWeek: waiting.filter(d => d.days_left !== null &&
        d.days_left >= 0 && d.days_left <= 7).length
    });
  },

  /* Withdrawing access needs a reason, and the reason is shown to her. */
  'POST /admin/doctors/:id/suspend': async (env, request, params) => {
    const admin = await requireFreshAdminCapability(env, request, 'doctors');
    const { reason } = await body(request);
    const doctor = await tenants.suspend(env.DB, params.id, admin, reason);
    await audit.write(env.DB, {
      doctorId: params.id, actor: 'platform:' + admin.email,
      action: 'clinic_suspended', detail: reason
    });
    return json({ doctor });
  },

  'POST /admin/doctors/:id/restore': async (env, request, params) => {
    const admin = await requireFreshAdminCapability(env, request, 'doctors');
    const doctor = await tenants.restore(env.DB, params.id, admin);
    await audit.write(env.DB, {
      doctorId: params.id, actor: 'platform:' + admin.email, action: 'clinic_restored'
    });
    return json({ doctor });
  },

  'GET /admin/ai-spend': async (env, request) => {
    await requireAdminCapability(env, request, 'money');
    return json(await aiops.report(env.DB));
  },

  /* Let a human close a breaker rather than waiting out the timer, once they
     have looked and decided it was a false alarm. */
  'POST /admin/ai-spend/clear': async (env, request) => {
    const admin = await requireFreshAdminCapability(env, request, 'money');
    const { scope } = await body(request);
    if (!scope) throw badRequest('Say which one to clear.');
    await aiops.close(env.DB, scope, 'platform:' + admin.email);
    await audit.write(env.DB, {
      doctorId: null, actor: 'platform:' + admin.email,
      action: 'ai_breaker_cleared', detail: scope
    });
    return json({ ok: true, scope });
  },

  'GET /admin/costs': async (env, request) => {
    await requireAdminCapability(env, request, 'money');
    const month = new URL(request.url).searchParams.get('month');

    return json({
      ...await costs.report(env.DB, month),
      monthsWithActivity: await costs.monthsWithActivity(env.DB)
    });
  },

  'PATCH /admin/costs/rates/:id': async (env, request, params) => {
    const admin = await requireFreshAdminCapability(env, request, 'money');
    const { paisePerUnit } = await body(request);
    const rate = await rates.update(env.DB, params.id, paisePerUnit);
    if (!rate) throw notFound('No such rate.');
    await audit.write(env.DB, {
      actor: 'platform:' + admin.email, action: 'cost_rate_changed',
      targetType: 'rate', targetId: params.id, detail: String(paisePerUnit)
    });
    return json({ rate });
  },

  'POST /admin/costs': async (env, request) => {
    const admin = await requireFreshAdminCapability(env, request, 'money');
    const cost = await businessCosts.create(env.DB, admin.email, await body(request));
    await audit.write(env.DB, {
      actor: 'platform:' + admin.email, action: 'business_cost_added',
      targetType: 'business_cost', targetId: cost.id,
      detail: cost.label + ' ' + cost.amount_paise
    });
    return json({ cost }, 201);
  },

  'DELETE /admin/costs/:id': async (env, request, params) => {
    const admin = await requireFreshAdminCapability(env, request, 'money');
    const cost = await businessCosts.archive(env.DB, params.id);
    if (!cost) throw notFound('No such cost.');
    await audit.write(env.DB, {
      actor: 'platform:' + admin.email, action: 'business_cost_archived',
      targetType: 'business_cost', targetId: params.id
    });
    return json({ ok: true });
  },

  'GET /admin/applications': async (env, request) => {
    await requireAdminCapability(env, request, 'applications');
    const status = new URL(request.url).searchParams.get('status');
    return json({ applications: await applications.list(env.DB, status) });
  },

  'PATCH /admin/applications/:id': async (env, request, params) => {
    const admin = await requireFreshAdminCapability(env, request, 'applications');
    const patch = await body(request);
    const updated = await applications.update(env.DB, params.id, admin, patch);
    if (!updated) throw notFound('No such application.');
    await audit.write(env.DB, {
      actor: 'platform:' + admin.email, action: 'application_updated',
      targetType: 'application', targetId: params.id, detail: patch.status || 'note'
    });
    return json({ application: updated });
  },

  /* Approving is what creates the doctor, so it needs a real admin, not
     support. The temporary password comes back exactly once. */
  'POST /admin/applications/:id/approve': async (env, request, params) => {
    const admin = await requireFreshAdminCapability(env, request, 'applications');
    const overrides = await body(request);
    const result = await applications.approve(env.DB, env, admin, params.id, overrides);
    await audit.write(env.DB, {
      doctorId: result.doctorId, actor: 'platform:' + admin.email,
      action: 'application_approved', targetType: 'application', targetId: params.id
    });
    return json(result, 201);
  },

  /* Self-signup is deliberately gone.

     It used to mint a live clinical account from a name, a clinic name and
     an SMS code. Nothing checked that the applicant was a doctor, nothing
     looked at a registration number, and the account it created could issue
     prescriptions carrying TCOS's name. It also depended on an SMS provider
     that was never connected, so in practice it returned an error and the
     button beside it was a mailto: link.

     Onboarding is POST /apply above: an application a human approves. This
     route stays only so an old client gets an explanation instead of a
     404. */
  'POST /auth/signup/start': async () => {
    throw badRequest('TCOS accounts are created by our team after we verify your registration. Apply from the home page and we will call you.');
  },

  'POST /auth/signup/verify': async () => {
    throw badRequest('TCOS accounts are created by our team after we verify your registration. Apply from the home page and we will call you.');
  },

  /* --- sign in --- */

  'POST /auth/signin': async (env, request) => {
    const { identifier, password, turnstileToken, rememberDevice } = await body(request);
    const { channel, identifier: id } = classifyIdentifier(identifier);
    await enforceRateLimit(env, 'AUTH_RATE_LIMITER', {
      scope: 'clinic_signin', subject: id,
      message: 'Too many sign-in attempts. Wait a minute and try again.'
    });
    await enforceSourceRateLimit(env, 'AUTH_RATE_LIMITER', request, {
      scope: 'clinic_signin',
      message: 'Too many sign-in attempts from this connection. Wait a minute and try again.'
    });
    await verifyTurnstile(env, request, {
      token: turnstileToken, action: 'clinic_signin'
    });

    const throttle = { scope: 'clinic_signin', subject: id,
      message: 'Too many incorrect sign-in attempts. Wait five minutes and try again.' };
    await authThrottle.check(env.DB, request, throttle);

    /* Same message either way - never reveal whether an account exists.

       ONE call site for the failure counter, deliberately: an alternative
       reply (see wrongDoor below) still has to cost an attempt, and a
       second `authThrottle.failure` somewhere else in this route is how a
       door quietly ends up without one. test/security.test.js counts them. */
    const wrong = async (instead) => {
      await authThrottle.failure(env.DB, request, throttle);
      throw instead || unauthorised('That mobile, email or password is not right.');
    };

    /* THE WRONG DOOR.
     *
       Vijay, for the fourth time: "i am trying to login to my account it is
       saying password is incorrect but i am entering correct details only
       and i am pretty sure on that."
     *
       He was right every time. TCOS has two separate sets of accounts - the
       clinic accounts in `doctors`, and the Tharigopula platform accounts in
       `platform_team` - and the platform owner has no clinic account at all.
       So his console password typed into the doctor app is refused forever,
       no matter how carefully he types it, and the screen tells him the
       password is wrong. The password is not wrong. The door is.
     *
       This does not leak anything: it answers only for somebody who already
       typed the matching password, so it tells them nothing they did not
       already know. An attacker guessing blindly still gets the one flat
       message above.
     *
       Only for an email. A platform account has no mobile number, so there
       is nothing to look up for one, and doing it anyway would spend a
       PBKDF2 on every mistyped mobile in the country. */
    const wrongDoor = async () => {
      if (channel !== 'email') return null;
      const member = await team.byEmail(env.DB, id);
      if (!member || !member.password_hash) return null;
      const checked = await verifyPasswordVersioned(
        password, env, member.password_salt, member.password_hash);
      if (!checked.ok) return null;
      return new ApiError(409, 'platform_account',
        'That is your Tharigopula platform account, not a clinic account. ' +
        'Sign in to the owner console at ' + adminOrigin(env) + ' instead.');
    };

    let doctor = channel === 'email'
      ? await doctors.byEmail(env.DB, id)
      : await doctors.byMobile(env.DB, id);
    let user = null;

    /* Not a doctor's number: it may be one of her staff. They are looked up
       across every clinic because the person typing has not told us which
       clinic they belong to - their account has. */
    if (!doctor && channel !== 'email') {
      user = await staff.byMobile(env.DB, id);
      if (user) doctor = await doctors.byId(env.DB, user.doctor_id);
    }

    const account = user || doctor;
    if (!doctor || !account || !account.password_hash) {
      /* Checked BEFORE the timing hash below rather than after, because both
         cost a PBKDF2 and doing them one after the other would put three of
         them in one request - which is past what a Worker may spend on CPU. */
      const door = await wrongDoor();
      if (door) await wrong(door);
      /* Match the password work done for a real account so a timing probe
         cannot cheaply enumerate valid mobile numbers or emails. */
      await hashPassword(String(password || ''), activePepper(env), '00000000000000000000000000000000');
      await wrong();
    }
    const checked = await verifyPasswordVersioned(
      password, env, account.password_salt, account.password_hash);
    if (!checked.ok) await wrong();
    await authThrottle.clear(env.DB, request, throttle);
    if (checked.needsRehash) {
      const next = await hashPassword(password, activePepper(env));
      if (user) await staff.rehashPassword(env.DB, user.id, next.hash, next.salt);
      else await doctors.rehashPassword(env.DB, doctor.id, next.hash, next.salt);
    }
    if (doctor.status === 'suspended') throw suspendedError(doctor);

    /* HOW LONG SHE STAYS SIGNED IN.
     *
       Vijay: "i have my user id and pwd, let me signin from any device."
     *
       Signing in has never revoked another device's session - that part
       already worked. What did not was the length: twelve hours means a
       doctor is signed out of her own phone twice a day, which is
       indistinguishable from being locked out if you are not counting hours.
     *
       So it is her choice, and off by default. A shared front-desk tablet
       keeps the short session; her own phone, where the app is installed,
       keeps her signed in for a month. The box says "this device" because
       that is exactly what it means - it changes nothing anywhere else. */
    const REMEMBERED_HOURS = 24 * 30;
    const ttlHours = rememberDevice === true
      ? REMEMBERED_HOURS
      : Number(env.SESSION_TTL_HOURS || 12);

    const token = newSessionToken();
    const csrfToken = newCsrfToken();
    await sessions.create(env.DB, doctor.id, await sha256(token),
      ttlHours, request.headers.get('User-Agent'),
      user ? user.id : null, await sha256(csrfToken));

    if (user) await staff.markSignedIn(env.DB, user.id);
    else await doctors.markSignedIn(env.DB, doctor.id);

    await audit.write(env.DB, {
      doctorId: doctor.id,
      actor: user ? 'staff:' + user.id : 'doctor:' + doctor.id,
      action: 'sign_in', detail: user ? user.full_name + ' (' + user.role + ')' : null
    });

    return json({
      ...(cookieAuthEnforced(env, CLINIC_SESSION_COOKIE) ? {} : { token }),
      csrfToken,
      doctor: {
        id: doctor.id, fullName: account.full_name, clinicName: doctor.clinic_name,
        plan: doctor.plan, mustChangePassword: !!account.must_change_password,
        role: user ? user.role : 'doctor'
      }
    }, 200, {
      /* The cookie must not outlive the row, or she carries a credential the
         server has already stopped honouring - which looks exactly like the
         app being broken. */
      'Set-Cookie': sessionCookie(CLINIC_SESSION_COOKIE, token, ttlHours)
    });
  },

  /* ---- the clinic's own passkeys ----

     Vijay: "if mobile app we need to make that it should be embedded to
     the mobile app fingerprint or pattern or the mobile lock."

     Same verification as the console's, one scope along. A doctor's phone
     unlock becomes her way in, and the twelve-hour session stops being the
     thing that decides how often she types a password on a touchscreen. */

  'POST /passkeys/challenge': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    const subject = clinicPasskeySubject(doctor);
    const { challenge } = await passkeyChallenges.issue(env.DB,
      { scope: 'clinic', subject, purpose: 'register' });
    return json({
      challenge, rpId: rpIdFor(appOrigin(env)), rpName: 'TCOS',
      userId: toBase64Url(new TextEncoder().encode(subject)),
      userName: doctor.mobile || subject,
      userDisplayName: doctor.full_name || doctor.clinic_name || 'TCOS',
      algorithms: SUPPORTED_ALGORITHMS,
      existing: (await passkeys.list(env.DB, 'clinic', subject)).map(row => row.id)
    });
  },

  'POST /passkeys': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    const subject = clinicPasskeySubject(doctor);
    const body_ = await body(request);
    const created = await passkeys.register(env.DB, {
      scope: 'clinic', subject,
      origin: appOrigin(env), rpId: rpIdFor(appOrigin(env)),
      label: body_.label, challenge: body_.challenge,
      clientDataJSON: body_.clientDataJSON, publicKey: body_.publicKey,
      algorithm: body_.algorithm, credentialId: body_.credentialId
    });
    await audit.write(env.DB, {
      doctorId: doctor.id, actor: actorKey(doctor),
      action: 'passkey_added', detail: created.label
    });
    return json(created, 201);
  },

  'GET /passkeys': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    return json({ passkeys: await passkeys.list(env.DB, 'clinic', clinicPasskeySubject(doctor)) });
  },

  'DELETE /passkeys/:id': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    await passkeys.revoke(env.DB, 'clinic', clinicPasskeySubject(doctor), params.id);
    await audit.write(env.DB, {
      doctorId: doctor.id, actor: actorKey(doctor), action: 'passkey_removed'
    });
    return json({ ok: true });
  },

  'POST /auth/passkey/challenge': async (env, request) => {
    await enforceSourceRateLimit(env, 'AUTH_RATE_LIMITER', request, {
      scope: 'clinic_passkey_signin',
      message: 'Too many sign-in attempts from this connection. Wait a minute and try again.'
    });
    const { challenge } = await passkeyChallenges.issue(env.DB,
      { scope: 'clinic', purpose: 'authenticate' });
    return json({ challenge, rpId: rpIdFor(appOrigin(env)) });
  },

  'POST /auth/passkey': async (env, request) => {
    await enforceSourceRateLimit(env, 'AUTH_RATE_LIMITER', request, {
      scope: 'clinic_passkey_signin',
      message: 'Too many sign-in attempts from this connection. Wait a minute and try again.'
    });
    const body_ = await body(request);
    const proven = await passkeys.authenticate(env.DB, {
      scope: 'clinic', origin: appOrigin(env), rpId: rpIdFor(appOrigin(env)),
      challenge: body_.challenge, credentialId: body_.credentialId,
      clientDataJSON: body_.clientDataJSON,
      authenticatorData: body_.authenticatorData, signature: body_.signature
    });

    /* The subject is "doc_x" for a doctor and "doc_x:usr_y" for a member of
       staff, so one lookup cannot serve both. */
    const [doctorId, userId] = String(proven.subject).split(':');
    const doctor = await doctors.byId(env.DB, doctorId);
    if (!doctor) throw unauthorised('That clinic no longer exists.');
    if (doctor.status === 'suspended') throw suspendedError(doctor);

    let user = null;
    if (userId) {
      /* Scoped by clinic AND id, the same way every other staff lookup in
         this file is - the doctor id is not decoration, it is the tenant
         boundary. */
      user = await staff.byId(env.DB, doctor.id, userId);
      /* Removed mid-life, or suspended: the credential stops working the
         moment the row says so, not when the key expires. */
      if (!user || user.status !== 'active') {
        throw unauthorised('That account no longer has access to this clinic.');
      }
    }
    const account = user || doctor;
    /* Built here because this route resolved the doctor and the user by
       hand rather than through requireDoctor, which is what normally hangs
       the actor on. Without it the audit line would name the clinic owner
       for work a second practitioner did. */
    doctor.actor = actorFor(doctor, user);

    const token = newSessionToken();
    const csrfToken = newCsrfToken();
    /* A passkey IS the device, so the long session it grants is not a
       weaker promise than the short one a password gets - it is the
       stronger of the two proofs being remembered. */
    await sessions.create(env.DB, doctor.id, await sha256(token), 24 * 30,
      request.headers.get('User-Agent'), user ? user.id : null, await sha256(csrfToken));
    if (user) await staff.markSignedIn(env.DB, user.id);
    else await doctors.markSignedIn(env.DB, doctor.id);
    await audit.write(env.DB, {
      doctorId: doctor.id,
      actor: actorKey(doctor),
      action: 'sign_in', detail: 'passkey'
    });

    return json({
      ...(cookieAuthEnforced(env, CLINIC_SESSION_COOKIE) ? {} : { token }),
      csrfToken,
      doctor: {
        id: doctor.id, fullName: account.full_name, clinicName: doctor.clinic_name,
        plan: doctor.plan, mustChangePassword: !!account.must_change_password,
        role: user ? user.role : 'doctor'
      }
    }, 200, { 'Set-Cookie': sessionCookie(CLINIC_SESSION_COOKIE, token, 24 * 30) });
  },

  'POST /auth/signout': async (env, request) => {
    const credential = sessionCredential(request, CLINIC_SESSION_COOKIE, env);
    if (credential) {
      const tokenHash = await sha256(credential.token);
      const resolved = await sessions.resolve(env.DB, tokenHash);
      if (resolved) await requireCookieCsrf(env, request, credential, resolved.csrfHash);
      await sessions.revoke(env.DB, tokenHash);
    }
    return json({ ok: true }, 200,
      { 'Set-Cookie': clearSessionCookie(CLINIC_SESSION_COOKIE) });
  },

  /* --- password reset by OTP --- */

  'POST /auth/reset/start': async (env, request) => {
    const { identifier, turnstileToken } = await body(request);
    const { channel, identifier: id } = classifyIdentifier(identifier);
    await enforceRateLimit(env, 'AUTH_RATE_LIMITER', {
      scope: 'password_reset_start', subject: id,
      message: 'Too many reset requests. Wait a minute and try again.'
    });
    await enforceSourceRateLimit(env, 'AUTH_RATE_LIMITER', request, {
      scope: 'password_reset_start',
      message: 'Too many reset requests from this connection. Wait a minute and try again.'
    });
    await verifyTurnstile(env, request, {
      token: turnstileToken, action: 'password_reset'
    });
    const doctor = channel === 'email'
      ? await doctors.byEmail(env.DB, id) : await doctors.byMobile(env.DB, id);

    /* SHE TYPED HER MOBILE; THE CODE GOES TO HER INBOX.
     *
       Vijay: "anyhow we are having the email id right - why don't you push
       the otp there. we have stopped sms because it actually costs us."
     *
       An SMS costs money and waits on DLT approval; an email costs nothing
       and works today. The code is still FILED under the mobile she typed,
       because that is what she types again on the next screen - see the
       note above issueOtp. */
    const deliverTo = channel === 'sms' && doctor && doctor.email
      ? doctor.email : null;

    /* Always report success, so this cannot be used to discover accounts. */
    if (doctor) {
      await issueOtp(env, env.DB, { purpose: 'doctor_reset', rawIdentifier: id, deliverTo });
    }

    /* AND THE ANSWER IS BUILT FROM WHAT SHE TYPED, NEVER FROM THE LOOKUP.
       Returning the account's masked email would tell an attacker both that
       the account exists and part of the address on it - the account
       discovery this route is written to prevent, reintroduced through the
       reply instead of the error. So a mobile always gets the same two
       sentences, and both of them are true either way. */
    if (channel === 'email') return json({ channel, sentTo: maskIdentifier(id) });
    return json({
      channel: 'email',
      sentTo: null,
      where: 'the email address on your account',
      note: 'If that account has no email address on file, the code has ' +
            'gone to your mobile by SMS instead.'
    });
  },

  'POST /auth/reset/verify': async (env, request) => {
    const { identifier, code, newPassword } = await body(request);
    const resetIdentity = classifyIdentifier(identifier).identifier;
    await enforceRateLimit(env, 'AUTH_RATE_LIMITER', {
      scope: 'password_reset_verify', subject: resetIdentity,
      message: 'Too many reset attempts. Wait a minute and request a new code.'
    });
    await enforceSourceRateLimit(env, 'AUTH_RATE_LIMITER', request, {
      scope: 'password_reset_verify',
      message: 'Too many reset attempts from this connection. Wait a minute and try again.'
    });
    await verifyOtp(env.DB, { purpose: 'doctor_reset', rawIdentifier: identifier, code });
    if (!newPassword || newPassword.length < 8) throw badRequest('Password must be at least 8 characters.');

    const { channel, identifier: id } = classifyIdentifier(identifier);
    const doctor = channel === 'email'
      ? await doctors.byEmail(env.DB, id) : await doctors.byMobile(env.DB, id);
    if (!doctor) throw badRequest('Request a new code first.');

    const { hash, salt } = await hashPassword(newPassword, activePepper(env));
    await doctors.setPassword(env.DB, doctor.id, hash, salt);
    await audit.write(env.DB, { doctorId: doctor.id, actor: 'doctor:' + doctor.id, action: 'password_reset' });
    return json({ ok: true });
  },

  /* --- the signed-in doctor --- */

  'GET /me': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    return json({
      id: doctor.id, fullName: doctor.full_name, clinicName: doctor.clinic_name,
      tagline: doctor.tagline, qualification: doctor.qualification,
      registrationNo: doctor.registration_no, council: doctor.council,
      address: doctor.address,
      /* Every field the practice screen can edit must come back here too, or
         it loads empty and the next save quietly wipes it. */
      website: doctor.website, patientPrefix: doctor.patient_prefix,
      /* Her recovery address. Returned so the practice screen can show it -
         and, when it is missing, say so while she can still do something
         about it rather than at the moment she is locked out. */
      email: doctor.email,
      /* Which of AyurCOS / HomeoCOS / AlloCOS she signs into. Read-only here:
         it follows her registration, so only the platform sets it. */
      product: doctor.product || 'ayurcos',
      /* What her plan includes and what she has used, so the app can show
         "847 of 1,000" rather than letting her find the ceiling by hitting
         it. Nothing here is unlimited and the number is never a surprise. */
      planStatus: await planStatus(env.DB, doctor),
      /* What her plan actually includes, resolved server-side from the plan
         preset plus any per-clinic overrides. The app uses it to stop
         offering a screen she cannot write to - but it is PRESENTATION
         only. Every one of these is enforced again on the route, because a
         hidden button has never been a permission. */
      features: [...featuresFor(doctor)],
      /* Read-only. Gates the public page, the printed registration number
         and cross-clinic history - see migration 014. She sees her own
         number in settings either way; what changes is whether it goes out
         under our name. */
      verification: {
        status: doctor.verification_status || 'unverified',
        verified: isVerified(doctor),
        verifiedAt: doctor.verified_at,
        note: doctor.verification_note
      },
      practicePacks: JSON.parse(doctor.practice_packs || '[]'),
      weeklyHours: cleanWeek(JSON.parse(doctor.weekly_hours || '{}')),
      /* The ABDM registries. Held now, used the day we are certified - see
         worker/abha.js. Nothing here talks to a gateway. */
      abdm: {
        hprId: doctor.hpr_id || null,
        hfrId: doctor.hfr_id || null,
        connected: false
      },
      certificate: {
        name: doctor.certificate_name,
        status: doctor.certificate_status || 'not_uploaded',
        submittedAt: doctor.certificate_submitted_at,
        /* So she can open what she sent. Scoped like any other file - the
           id alone opens nothing without her session. */
        fileId: doctor.certificate_file_id || null
      },
      plan: doctor.plan, line: doctor.line,
      featureOverrides: JSON.parse(doctor.feature_overrides || '{}'),
      trialEndsOn: doctor.trial_ends_on,
      /* Who is actually signed in. The rail shows their name, not the
         doctor's, and the navigation hides what they cannot open. */
      me: {
        name: doctor.actor.name, role: doctor.actor.role,
        roleLabel: doctor.actor.roleLabel, isDoctor: doctor.actor.isDoctor,
        isPractitioner: !!doctor.actor.isPractitioner,
        qualification: doctor.actor.qualification || null,
        registrationNo: doctor.actor.registrationNo || null,
        verified: !!doctor.actor.verified,
        mustChangePassword: !!doctor.actor.mustChangePassword,
        can: Object.values(CAN).filter(c => doctor.actor.can(c))
      }
    });
  },

  /* --- the clinic's TCOS subscription --------------------------------

     The hosted Razorpay page collects the mandate. TCOS never receives a
     card or bank detail. Signed webhooks below activate access, and refresh
     is a safe fallback when the browser returns before the webhook. */
  'GET /subscription': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.SETTINGS);
    return json(await subscriptions.status(env.DB, env, doctor.id));
  },

  'POST /subscription/checkout': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.SETTINGS);
    const selected = await body(request);
    const subscription = await subscriptions.start(env.DB, env, doctor, selected);
    await audit.write(env.DB, {
      doctorId: doctor.id, actor: actorKey(doctor),
      action: 'subscription_checkout_started', targetType: 'subscription',
      targetId: subscription.id, detail: subscription.plan + ' ' + subscription.cadence
    });
    return json({ subscription }, 201);
  },

  'POST /subscription/refresh': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.SETTINGS);
    return json({ subscription: await subscriptions.refresh(env.DB, env, doctor.id) });
  },

  'POST /subscription/cancel': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.SETTINGS);
    const subscription = await subscriptions.cancel(env.DB, env, doctor.id);
    await audit.write(env.DB, {
      doctorId: doctor.id, actor: actorKey(doctor),
      action: 'subscription_cancel_scheduled', targetType: 'subscription',
      targetId: subscription.id, detail: subscription.currentEnd
    });
    return json({ subscription });
  },

  /* --- the medicine catalogue -----------------------------------------

     Signed-in doctors only. Not because the list is secret - it is public
     knowledge - but because an open endpoint that runs a LIKE scan on every
     keystroke is free load for anyone who finds it.

     One call returns both the names and the strengths each is sold in, so
     picking a name does not cost a second round trip while she is typing. */
  'GET /drugs': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.WRITE_NOTES);
    const url = new URL(request.url);
    /* Her own practice packs decide what she sees first: an Ayurvedic doctor
       should not have to scroll past antibiotics to reach Ashwagandha. */
    const packs = JSON.parse(doctor.practice_packs || '[]');
    const asked = url.searchParams.get('system');
    const system = asked || (packs.includes('ayurveda') && packs.length === 1 ? 'ayurveda' : 'all');
    return json({
      drugs: await drugs.search(env.DB, {
        term: url.searchParams.get('q'),
        system,
        limit: url.searchParams.get('limit')
      })
    });
  },

  /* --- patients --- */

  /* Typing a number shows the household. The doctor's own patients by name;
     anyone else's only as a count, until the patient approves sharing. */
  'GET /patients/lookup': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.PATIENTS);
    const raw = new URL(request.url).searchParams.get('mobile');
    const mobile = normaliseMobile(raw);
    if (!mobile) throw badRequest('Enter a valid mobile number.');
    const found = await patients.lookup(env.DB, doctor.id, mobile);
    return json({ mobile, ...found });
  },

  'GET /patients': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.PATIENTS);
    return json({ patients: await patients.listForDoctor(env.DB, doctor.id) });
  },

  'POST /patients': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.PATIENTS);
    const { mobile, fullName, sex, dateOfBirth, bloodGroup,
            relation, locality, existingPatientId, idempotencyKey } = await body(request);
    const normalised = normaliseMobile(mobile);
    if (!normalised) throw badRequest('Enter a valid mobile number.');
    if (!fullName && !existingPatientId) throw badRequest('Patient name is required.');

    /* On a paid plan this is soft: a patient is standing at the counter and
       refusing to register her because of a quota is not something the
       doctor can explain, and the harm lands on the patient rather than on
       the account. On the free plan it IS a hard stop - that is what makes
       free cost us nothing - and requireQuota raises it. */
    /* A retry after a successful registration must still succeed if that
       first registration reached the plan boundary. Check the durable retry
       result before evaluating a new unit of quota. */
    const repeated = await patients.registrationByKey(
      env.DB, doctor.id, idempotencyKey);
    if (repeated) return json({ patient: repeated }, 201);
    await requireQuota(env.DB, doctor, 'patients', 1);

    /* If the caller names an existing person on this number, link to them.
       Otherwise create a new person. Never guess. */
    let existing = null;
    if (existingPatientId) {
      existing = await patients.byId(env.DB, existingPatientId);
      if (!existing || existing.mobile !== normalised) {
        throw badRequest('That person is not on this number.');
      }
    }
    const patient = await patients.registerForDoctor(
      env.DB, doctor.id, doctor.patient_prefix, {
        mobile: normalised, fullName, sex, dateOfBirth, bloodGroup, relation,
        /* Where she travels in from. Capped hard and deliberately coarse -
           a locality, never a postal address. See migration 061. */
        locality: String(locality || '').trim().slice(0, 80) || null,
        existingPatientId: existing && existing.id,
        idempotencyKey, actor: actorKey(doctor)
    });
    return json({ patient }, 201);
  },

  'GET /patients/:id': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.READ_NOTES);
    await patients.requireOnList(env.DB, doctor.id, params.id);
    const patient = await patients.byIdForDoctor(env.DB, doctor.id, params.id);
    if (!patient) throw notFound('Patient not found.');
    return json({
      patient,
      visits: await visits.listForPatient(env.DB, doctor.id, params.id),
      prescriptions: await prescriptions.listForPatient(env.DB, doctor.id, params.id),
      labReports: await labReports.listForPatient(env.DB, doctor.id, params.id)
    });
  },

  /* The patient's national health id.

     Written on the shared person row, so every clinic that knows this
     patient sees it - which is right, because a human has one ABHA, not one
     per clinic. Two consequences are handled deliberately:

       the doctor must already have this patient on her own list, or typing
       ids would become a way to write into strangers' records;

       it is audited, because this is the only field in TCOS a doctor edits
       that other doctors read. */
  'PUT /patients/:id/abha': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.WRITE_NOTES);
    await patients.requireOnList(env.DB, doctor.id, params.id);

    const abha = cleanAbha(await body(request));
    const patient = await patients.setAbha(env.DB, params.id, abha);

    await audit.write(env.DB, {
      doctorId: doctor.id, actor: actorKey(doctor),
      action: 'abha_recorded', targetType: 'patient', targetId: params.id,
      detail: abha.status === 'not_available'
        ? 'no ABHA'
        : (abha.number ? formatAbhaNumber(abha.number) : abha.address)
    });
    return json({ patient });
  },

  /* --- the scribe: listen to a consultation, draft the note --------------
     Consent, then audio, then a draft the doctor confirms. The order is the
     protection: there is no route that records without a consent row, and
     none that writes a note into the record without a clinician. */

  'POST /consult-notes': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.WRITE_NOTES);
    const { patientId } = await body(request);
    await patients.requireOnList(env.DB, doctor.id, patientId);

    /* Written BEFORE the microphone opens, and stamped with who asked -
       the front desk asking is not the same as the doctor asking, and a
       complaint months later is about exactly that. */
    const note = await consultNotes.open(env.DB, doctor.id, {
      patientId,
      consentBy: actorKey(doctor)
    });
    await audit.write(env.DB, {
      doctorId: doctor.id, actor: actorKey(doctor),
      action: 'consult_recording_consented', targetType: 'patient', targetId: patientId
    });
    return json({ note }, 201);
  },

  'GET /consult-notes': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.READ_NOTES);
    return json({
      configured: scribeReady(env),
      notes: await consultNotes.listForDoctor(env.DB, doctor.id)
    });
  },

  'GET /consult-notes/:id': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.READ_NOTES);
    const note = await consultNotes.byId(env.DB, doctor.id, params.id);
    if (!note) throw notFound('No such note.');
    return json({ note });
  },

  /* The recording arrives, is transcribed, a note is drafted, and the audio
     is deleted before the response is even sent. */
  'POST /consult-notes/:id/audio': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.WRITE_NOTES);

    const note = await consultNotes.byId(env.DB, doctor.id, params.id);
    if (!note) throw notFound('No such note.');
    if (note.status === 'confirmed') throw badRequest('That note is already in the record.');

    const form = await request.formData();
    const file = form.get('audio');
    const seconds = Number(form.get('seconds')) || 0;
    if (!file || typeof file.arrayBuffer !== 'function') {
      throw badRequest('No recording was attached.');
    }
    const tooLong = checkRecording(seconds);
    if (tooLong) throw badRequest(tooLong);

    /* Charged and guarded like every other AI call, before a rupee is
       spent rather than after. */
    const estimate = consultCost(seconds);
    const verdict = await aiops.check(env.DB, doctor.id, estimate);
    if (!verdict.allowed) {
      /* The guard reports rather than throws, so this has to read the
         verdict. Nothing is uploaded and nothing is spent - and unlike a
         parked lab report there is nothing to retry later, because the
         audio only exists in the browser. So the doctor is told plainly
         that she should write this one by hand. */
      await aiops.record(env.DB, doctor.id,
        { kind: 'consult_note', outcome: 'blocked', detail: verdict.reason });
      await consultNotes.fail(env.DB, doctor.id, note.id, verdict.reason);
      throw new ApiError(429, 'ai_paused',
        (verdict.message || verdict.reason) +
        ' The recording has not been kept - please write this note by hand.');
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const audioKey = 'consult/' + doctor.id + '/' + note.id + '.webm';
    await env.FILES.put(audioKey, bytes);
    await consultNotes.setAudio(env.DB, doctor.id, note.id, { audioKey, seconds });

    /* The audio is deleted whatever happens next - a transcription that
       failed is not a reason to keep a patient's voice on disk. */
    const forget = async () => {
      try { await env.FILES.delete(audioKey); } catch (_) { /* swept nightly */ }
      await consultNotes.markAudioDeleted(env.DB, doctor.id, note.id);
    };

    try {
      const heard = await transcribe(env, { bytes, filename: 'consultation.webm' });
      const drafted = await draftNote(env, heard.text);
      await consultNotes.setDraft(env.DB, doctor.id, note.id, {
        transcript: heard.text, language: heard.language, note: drafted,
        costPaise: estimate
      });
      await aiops.record(env.DB, doctor.id, {
        kind: 'consult_note', model: 'gpt-4o-transcribe + gpt-5.4-mini',
        costPaise: estimate, outcome: 'ok'
      });
      await usage.record(env.DB, doctor.id, {
        eventType: 'ai_consult_minute',
        quantity: Math.max(1, Math.ceil(seconds / 60)),
        unit: 'minute', provider: 'openai', estimatedCost: estimate,
        idempotencyKey: 'consult:' + note.id
      });
    } catch (error) {
      await consultNotes.fail(env.DB, doctor.id, note.id, error.message);
      await forget();
      throw error;
    }
    await forget();

    return json({ note: await consultNotes.byId(env.DB, doctor.id, note.id) });
  },

  /* The doctor's corrections, then into the record. Nothing reaches a visit
     any other way. */
  'POST /consult-notes/:id/confirm': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.WRITE_NOTES);
    const note = await consultNotes.byId(env.DB, doctor.id, params.id);
    if (!note) throw notFound('No such note.');
    if (note.status === 'confirmed') throw badRequest('That note is already in the record.');

    const edited = await body(request);
    const visit = await consultNotes.confirmAsVisit(env.DB, doctor.id, note.id, {
      visitedOn: (edited.visitedOn || nowIso()).slice(0, 10),
      visitType: edited.visitType || 'follow_up',
      /* Whatever the doctor left in the boxes, not whatever the model
         wrote - she may have rewritten every word of it. */
      complaints: edited.complaints ?? note.complaints,
      diagnosis: edited.diagnosis || null,
      advice: [edited.advice ?? note.advice, edited.examination ?? note.examination]
        .filter(Boolean).join('\n\n') || null,
      followUpOn: edited.followUpOn || null
    }, {
      actor: actorKey(doctor), practitionerId: doctor.actor.userId
    });
    return json({ visit });
  },

  'POST /consult-notes/:id/reject': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.WRITE_NOTES);
    await consultNotes.reject(env.DB, doctor.id, params.id);
    return json({ ok: true });
  },

  /* --- WhatsApp --- */

  /* The patient agreeing to be messaged, ticked at the desk with her in
     front of you. Off by default: WhatsApp's own policy and the DPDP Act
     both want a real yes, and "she gave us her number" is not one. */
  /* Allergies. Free text, shared across clinics, and the one field on the
     prescription sheet that prints even when it is empty.
   *
     WRITE_NOTES rather than PATIENTS: this is a clinical fact that changes
     what may safely be prescribed, so it is not front-desk data entry. An
     allergy recorded by the wrong person is worse than one not recorded,
     because it will be believed. */
  'PUT /patients/:id/allergies': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.WRITE_NOTES);
    await patients.requireOnList(env.DB, doctor.id, params.id);

    const { allergies } = await body(request);
    const text = String(allergies == null ? '' : allergies).trim();
    if (text.length > 500) {
      throw badRequest('Keep the allergy note under 500 characters.');
    }

    /* Empty means NOT RECORDED, which is a different thing from "no known
       allergies" and must stay different. A doctor who means the latter
       types it, and that sentence then prints on the sheet where a
       pharmacist can see somebody actually asked. */
    const patient = await patients.setAllergies(env.DB, params.id, text || null);
    await audit.write(env.DB, {
      doctorId: doctor.id, actor: actorKey(doctor),
      action: text ? 'allergies_recorded' : 'allergies_cleared',
      targetType: 'patient', targetId: params.id
    });
    return json({ patient });
  },

  /* --- the consultation she has not finished yet -----------------------
     A scratchpad, not a record. See worker/consultationdraft.js for why it
     is not a draft prescription. Nothing here appears in a chart, a report
     or a patient's copy, and none of it is clinical until she saves. */

  'GET /patients/:id/consultation-draft': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.READ_NOTES);
    await patients.requireOnList(env.DB, doctor.id, params.id);
    return json({ draft: await consultationDrafts.get(env.DB, doctor.id, params.id) });
  },

  /* Called by the desk every few seconds while she types, so it writes one
     row and nothing else. Deliberately NOT audited: an audit trail is for
     what entered the record, and forty rows an hour saying somebody was
     typing would bury the entries that matter. Saving is audited. */
  'PUT /patients/:id/consultation-draft': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.WRITE_NOTES);
    await patients.requireOnList(env.DB, doctor.id, params.id);
    const { payload } = await body(request);
    return json({
      draft: await consultationDrafts.put(env.DB, doctor.id, params.id, {
        payload, author: doctor.actor.userId || null
      })
    });
  },

  'DELETE /patients/:id/consultation-draft': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.WRITE_NOTES);
    await patients.requireOnList(env.DB, doctor.id, params.id);
    return json(await consultationDrafts.remove(env.DB, doctor.id, params.id));
  },

  /* Which names in the queue have a sheet waiting behind them. Ids and
     times, never the typing. */
  'GET /consultation-drafts': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.READ_NOTES);
    return json({ drafts: await consultationDrafts.listOpen(env.DB, doctor.id) });
  },

  'PUT /patients/:id/whatsapp': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.WRITE_NOTES);
    await patients.requireOnList(env.DB, doctor.id, params.id);

    const { agreed } = await body(request);
    const existing = await patients.byId(env.DB, params.id);
    /* A patient who replied STOP has decided for every clinic, not just
       this one. No front desk gets to undo that by ticking a box. */
    if (agreed && existing && existing.whatsapp_opted_out_at) {
      throw badRequest(
        existing.full_name + ' has asked WhatsApp to stop these messages. ' +
        'Only they can undo that, from their own phone.');
    }

    const patient = await patients.setWhatsappConsent(env.DB, params.id, !!agreed);
    await audit.write(env.DB, {
      doctorId: doctor.id, actor: actorKey(doctor),
      action: agreed ? 'whatsapp_opt_in' : 'whatsapp_opt_out',
      targetType: 'patient', targetId: params.id
    });
    return json({ patient });
  },

  /* Everything this clinic has sent, newest first, with what the patient
     actually saw. When a patient rings up asking why she got a message,
     the front desk needs to read the message. */
  'GET /messages': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    /* The person who answers "why did I get this message?" is the front
       desk, not the doctor. Same reasoning as /messages/links. */
    gate(doctor, CAN.PATIENTS);
    return json({
      configured: wa.configured(env),
      messages: await messages.listForDoctor(env.DB, doctor.id)
    });
  },

  /* Is SMS actually going to work? Answers without sending anything.

     Admin-only: it names the secret to set and reports the wallet balance,
     which is operational detail rather than something a clinic needs. */
  'GET /admin/sms-health': async (env, request) => {
    await requireAdminCapability(env, request, 'delivery');
    /* Both channels in one answer. Email matters as much as SMS while DLT
       is pending: until that clears, an emailed code is the ONLY way back
       into an account, and a doctor with neither is locked out for good. */
    /* NOT `const [sms, ...]`. That declaration shadows the imported `sms`
       for the whole block including its own initialiser, so `sms.health`
       reads a const in the temporal dead zone: ReferenceError, every call,
       since the day the line was written. The one screen that answers "is
       delivery working" has never once answered it. */
    const [smsHealth, mail] = await Promise.all([sms.health(env), email.health(env)]);
    /* WhatsApp is reported here too because its receiving half fails
       silently: without WHATSAPP_APP_SECRET the webhook refuses everything,
       so reminders still go out while every delivery receipt and every STOP
       is dropped. That is worth seeing on the same screen as the rest. */
    return json({ ...smsHealth, email: mail, whatsapp: wa.health(env) });
  },

  /* Tomorrow's list with a wa.me link per patient, for the front desk to
     tap through. Free, and needs nothing from Meta - so a clinic can send
     reminders on its first day rather than waiting on template approval. */
  'GET /messages/links': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    /* Front-desk work, so gated on PATIENTS rather than READ_NOTES. This
       screen is a list of who to message about tomorrow; gating it behind
       clinical notes put it out of reach of the only people who would ever
       open it. Nothing clinical is shown - a name, a time, and the reminder
       wording the patient will read. */
    gate(doctor, CAN.PATIENTS);
    const day = new URL(request.url).searchParams.get('day') || indiaDayAfter();
    return json(await reminderLinks(env, doctor, day));
  },

  /* Tomorrow's reminders, on demand. The timer does this nightly; this is
     the same code path so that what a doctor tests by hand is exactly what
     runs at night, rather than a demo version of it. */
  'POST /messages/reminders': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.SETTINGS);
    const { day } = await body(request).catch(() => ({}));
    return json(await sendDayReminders(env, doctor, day || indiaDayAfter()));
  },

  /* "Your prescription is ready" - with the patient's own portal link.

     The link is minted here rather than passed in, because a link is a
     credential: accepting one from the caller would let anyone who could
     reach this route mail out a token of their choosing. */
  'POST /messages/record-ready': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.WRITE_NOTES);
    const { patientId, what } = await body(request);
    await patients.requireOnList(env.DB, doctor.id, patientId);

    const label = ['prescription', 'lab report', 'record'].includes(what) ? what : 'record';
    const link = await patientView.createLink(env.DB, doctor.id, patientId, {
      ttlDays: 90, createdBy: doctor.id
    });

    const result = await sendToPatient(env, doctor, {
      patientId,
      template: 'record_ready',
      values: {
        patientName: (await patients.byId(env.DB, patientId)).full_name,
        what: label,
        clinicName: doctor.clinic_name || 'the clinic',
        link: (env.PATIENT_LINK_BASE || appOrigin(env) + '/p.html#') + link.token
      },
      aboutType: 'record',
      /* One "your record is ready" per patient per day. A doctor issuing
         three prescriptions in one visit should not send three messages. */
      aboutId: patientId,
      dedupeDay: new Date().toISOString().slice(0, 10)
    });
    return json(result);
  },

  /* Meta's webhook. Public by necessity - Meta has no session - so it
     proves itself with the verify token we chose, and the only things acted
     on are delivery receipts and the word STOP. */
  'GET /webhooks/whatsapp': async (env, request) => {
    const challenge = wa.verifyChallenge(env, new URL(request.url));
    if (challenge === null) throw forbidden('Bad verify token.');
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  },

  'POST /webhooks/whatsapp': async (env, request) => {
    /* Read the bytes, verify, and only then parse. Verifying a re-serialised
       object would never match: Meta signs the exact body it sent, down to
       key order and whitespace. */
    const raw = await request.arrayBuffer();
    const check = await wa.verifySignature(
      env, raw, request.headers.get('x-hub-signature-256'));

    if (!check.ok) {
      /* Deliberately the same 403 whatever went wrong, so probing the
         endpoint cannot tell an attacker whether signing is switched on. The
         distinction is kept in the log, where only we can read it. */
      console.log('whatsapp webhook rejected: ' + check.reason);
      throw forbidden('This webhook only accepts signed requests from Meta.');
    }

    let payload;
    try { payload = JSON.parse(new TextDecoder().decode(raw)); }
    catch { throw badRequest('That webhook body was not JSON.'); }

    const { statuses, optOuts } = wa.readWebhook(payload);

    for (const receipt of statuses) {
      await messages.applyReceipt(env.DB, receipt.providerId, receipt.status, receipt.error);
    }
    /* An opt-out is honoured across every clinic holding that number, which
       is why it matches on the number and not on a doctor. */
    for (const out of optOuts) {
      await patients.optOutByMobile(env.DB, out.mobile);
    }
    /* Meta retries anything that is not a 200, forever. */
    return json({ ok: true });
  },

  /* Razorpay signs the exact bytes and supplies a unique event id. The
     handler claims that id before doing anything, then fetches the current
     subscription from Razorpay so an old event cannot roll access back. */
  'POST /webhooks/razorpay': async (env, request) =>
    json(await subscriptions.webhook(env.DB, env, request)),

  /* --- consent: the patient unlocks their own history --- */

  /* A number may carry a whole family, so the code proves control of the
     phone and the NAME says which person it is for. The doctor does not
     need to see the household to ask - the patient is standing there and
     says their own name. Nothing is revealed before approval. */
  'POST /consent/request': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.READ_NOTES);
    /* Reaching into another clinic's records is the one thing here that
       puts OTHER doctors' patients at risk rather than only this doctor's
       own. Whoever we let into the shared graph has to be somebody we
       actually checked. */
    requireVerified(doctor, 'see a patient\'s history from other clinics');
    const { patientMobile } = await body(request);
    const normalised = normaliseMobile(patientMobile);
    if (!normalised) throw badRequest('Enter a valid patient mobile number.');

    const household = await patients.householdOn(env.DB, normalised);
    /* Same answer whether or not records exist, so a doctor cannot use this
       to discover who is registered where. */
    if (household.length) {
      await issueOtp(env, env.DB, {
        purpose: 'patient_consent',
        rawIdentifier: normalised,
        context: { mobile: normalised, doctorId: doctor.id }
      });
    }
    return json({
      sentTo: maskIdentifier(normalised),
      note: 'If records exist for this number, a code has been sent to it. ' +
            'Ask the patient to read it out, and to confirm their own name.'
    });
  },

  'POST /consent/approve': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.READ_NOTES);
    const { patientMobile, code, patientName } = await body(request);
    if (!patientName || !patientName.trim()) {
      throw badRequest('Enter the name of the person whose records you are opening.');
    }

    const { context } = await verifyOtp(env.DB, {
      purpose: 'patient_consent', rawIdentifier: patientMobile, code
    });
    if (!context || context.doctorId !== doctor.id) {
      throw badRequest('That code was not issued for this clinic.');
    }

    /* The code proved the phone. The name picks the person on it. */
    const household = await patients.householdOn(env.DB, context.mobile);
    const wanted = patientName.trim().toLowerCase();
    const person = household.find(p => p.full_name.trim().toLowerCase() === wanted);
    if (!person) {
      throw notFound('Nobody by that name is registered on this number. ' +
        'Check the spelling with the patient.');
    }

    const grant = await consent.grant(env.DB, {
      patientId: person.id, doctorId: doctor.id,
      ttlHours: Number(env.CONSENT_TTL_HOURS || 24)
    });
    await audit.write(env.DB, {
      doctorId: doctor.id, actor: 'patient:' + person.id,
      action: 'consent_granted', targetType: 'patient', targetId: person.id
    });
    return json({
      grantId: grant.id,
      expiresAt: grant.expires_at,
      patient: { id: person.id, name: person.full_name, code: person.patient_code }
    });
  },

  'GET /patients/:id/shared-history': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.READ_NOTES);
    return json(await consent.sharedHistory(env.DB, doctor.id, params.id));
  },

  /* --- pharmacy --- */

  'GET /stock': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.PHARMACY);
    return json({
      items: await stock.list(env.DB, doctor.id),
      expiring: await stock.expiring(env.DB, doctor.id, 60),
      belowReorder: await stock.belowReorder(env.DB, doctor.id)
    });
  },

  'GET /stock/items/:id/batches': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.PHARMACY);
    return json({ batches: await stock.batchesFor(env.DB, doctor.id, params.id) });
  },

  'POST /stock/items': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.PHARMACY);
    requireFeature(doctor, 'pharmacy');
    const item = await body(request);
    if (!item.medicineName) throw badRequest('Medicine name is required.');
    return json({ item: await stock.addItem(env.DB, doctor.id, item, {
      actor: actorKey(doctor), idempotencyKey: item.idempotencyKey
    }) }, 201);
  },

  'POST /stock/batches': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.PHARMACY);
    requireFeature(doctor, 'pharmacy');
    const batch = await body(request);
    if (!batch.expiresOn) throw badRequest('Expiry date is required for every batch.');
    if (!(batch.quantity > 0)) throw badRequest('Quantity must be more than zero.');
    return json({ batch: await stock.receiveBatch(env.DB, doctor.id, batch, {
      actor: actorKey(doctor), idempotencyKey: batch.idempotencyKey
    }) }, 201);
  },

  'POST /stock/dispense': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.PHARMACY);
    requireFeature(doctor, 'pharmacy');
    const { stockItemId, quantity, patientId, prescriptionItemId,
            idempotencyKey } = await body(request);
    if (patientId) await patients.requireOnList(env.DB, doctor.id, patientId);
    const drawn = await stock.dispense(env.DB, doctor.id,
      { stockItemId, quantity, patientId, prescriptionItemId,
        idempotencyKey, actor: actorKey(doctor) });
    return json({ drawnFrom: drawn });
  },

  /* =====================================================================
     PLATFORM ADMIN

     Separate session store, separate prefix. requireAdmin() never consults
     the doctor sessions table, so a doctor token cannot reach any of this.
     Nothing below returns clinical content - names, plans and counts only.
     ===================================================================== */

  /* WHO DOES CLOUDFLARE ACCESS THINK YOU ARE?
   *
     Vijay, three separate times: "i am not able to login, my user id is
     correct password also correct still not working."
   *
     He was right every time, and the password was never reached. The route
     below refuses before it looks at one, because the email typed into the
     TCOS form must match the email Cloudflare Access authenticated - and
     hello@tharigopula.com, hello.tharigopula@gmail.com and
     vijaytharigopula14@gmail.com are three addresses that are nearly
     impossible to tell apart at a glance.
   *
     The console had the answer in a request header the whole time and
     never showed it. It asked him to retype an address it already knew,
     and then refused him for getting it wrong.
   *
     So this says it out loud, before he types anything. It also says
     whether a TCOS owner account exists for that address, which turns
     "it just does not work" into one readable sentence.
   *
     SAFE TO ANSWER. It is behind Cloudflare Access, the header is set by
     the Worker itself after signature validation - a caller-supplied one
     has no authority - and the only identity it can ever report is the
     caller's own. Nobody can learn about an address that is not theirs. */
  'GET /admin/access-identity': async (env, request) => {
    const enforced = accessEnforced(env);
    const email = String(request.headers.get(ACCESS_EMAIL_HEADER) || '')
      .trim().toLowerCase();

    if (!enforced) return json({ enforced: false, email: null, hasAccount: null });
    if (!email) return json({ enforced: true, email: null, hasAccount: null });

    /* team.byEmail rather than SQL here: the router holds no SQL, and
       test/isolation.test.js fails the build if it ever does. */
    const member = await team.byEmail(env.DB, email);

    return json({
      enforced: true,
      email,
      /* The sentence that ends the guessing: Access let you in, but there
         is no console account for this address. */
      hasAccount: !!member
    });
  },

  'POST /admin/signin': async (env, request) => {
    const { email, password, turnstileToken } = await body(request);
    const submittedEmail = String(email || '').trim().toLowerCase();
    /* THE EMAIL NO LONGER HAS TO MATCH THE CLOUDFLARE IDENTITY.
     *
       Vijay: "as an owner i can login from anywhere - my tab or pc or
       laptop or phone - and we have multiple email ids. it is impossible
       that i need to have every system logging into a specific email
       account. i have my own user id and pwd, why do i need that
       consistency."
     *
       He is right. This rule made the console's sign-in depend on which
       Cloudflare account a browser happened to be signed into, and it cost
       him hours across four separate reports. Cloudflare Access, where it
       is still in front, remains a gate on the network path; what it is no
       longer allowed to do is decide WHICH TCOS account he may use once he
       is through it. The password is what proves who he is, and from
       today a passkey is what proves it is his device. */
    await enforceRateLimit(env, 'ADMIN_AUTH_RATE_LIMITER', {
      scope: 'platform_admin_signin', subject: submittedEmail,
      message: 'Too many platform sign-in attempts. Wait a minute and try again.'
    });
    await enforceSourceRateLimit(env, 'ADMIN_AUTH_RATE_LIMITER', request, {
      scope: 'platform_admin_signin',
      message: 'Too many platform sign-in attempts from this connection. Wait a minute and try again.'
    });
    await verifyTurnstile(env, request, {
      token: turnstileToken, action: 'platform_signin'
    });
    const throttle = { scope: 'platform_admin_signin',
      subject: submittedEmail, maxFailures: 5,
      blockMinutes: 15,
      message: 'Too many incorrect platform sign-in attempts. Wait fifteen minutes and try again.' };
    await authThrottle.check(env.DB, request, throttle);
    let member;
    try {
      member = await adminSignIn(env, email, password);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await authThrottle.failure(env.DB, request, throttle);
      }
      throw error;
    }
    await authThrottle.clear(env.DB, request, throttle);
    const token = newSessionToken();
    const csrfToken = newCsrfToken();
    await adminSessions.create(env.DB, member.email, await sha256(token), 8,
      request.headers.get('User-Agent'), await sha256(csrfToken));
    await audit.write(env.DB, {
      actor: 'platform:' + member.email, action: 'admin_sign_in'
    });
    return json({
      ...(cookieAuthEnforced(env, ADMIN_SESSION_COOKIE) ? {} : { token }),
      csrfToken,
      member: { email: member.email, name: member.full_name, role: member.role }
    }, 200, { 'Set-Cookie': sessionCookie(ADMIN_SESSION_COOKIE, token, 8) });
  },

  /* ------------------------------------------------------- passkeys ---

     Vijay: "as an owner i can login from anywhere, my tab or pc or laptop
     or phone, and we have multiple email ids ... remove that dependency
     ... just give that fingerprint or something, thats it, we are in."

     Enrolment happens INSIDE a session he has already authenticated with a
     password, which is why registration needs no second proof: the answer
     to "is this really you" was given a moment ago. Signing in with one
     needs no password at all - the signature is the proof. */

  'POST /admin/passkeys/challenge': async (env, request) => {
    const member = await requireAdmin(env, request);
    const { challenge } = await passkeyChallenges.issue(env.DB,
      { scope: 'platform', subject: member.email, purpose: 'register' });
    return json({
      challenge, rpId: rpIdFor(adminOrigin(env)), rpName: 'TCOS Owner Console',
      userId: toBase64Url(new TextEncoder().encode(member.email)),
      userName: member.email, userDisplayName: member.full_name || member.email,
      algorithms: SUPPORTED_ALGORITHMS,
      /* So the browser refuses to enrol a device that is already on the
         list, instead of creating a second credential nobody asked for. */
      existing: (await passkeys.list(env.DB, 'platform', member.email))
        .map(row => row.id)
    });
  },

  'POST /admin/passkeys': async (env, request) => {
    const member = await requireAdmin(env, request);
    const body_ = await body(request);
    const created = await passkeys.register(env.DB, {
      scope: 'platform', subject: member.email,
      origin: adminOrigin(env), rpId: rpIdFor(adminOrigin(env)),
      label: body_.label, challenge: body_.challenge,
      clientDataJSON: body_.clientDataJSON, publicKey: body_.publicKey,
      algorithm: body_.algorithm, credentialId: body_.credentialId
    });
    await audit.write(env.DB, {
      actor: 'platform:' + member.email, action: 'passkey_added', detail: created.label
    });
    return json(created, 201);
  },

  'GET /admin/passkeys': async (env, request) => {
    const member = await requireAdmin(env, request);
    return json({ passkeys: await passkeys.list(env.DB, 'platform', member.email) });
  },

  'DELETE /admin/passkeys/:id': async (env, request, params) => {
    const member = await requireAdmin(env, request);
    await passkeys.revoke(env.DB, 'platform', member.email, params.id);
    await audit.write(env.DB, {
      actor: 'platform:' + member.email, action: 'passkey_removed'
    });
    return json({ ok: true });
  },

  /* Signing in. No session and no password - which is exactly why the
     rate limit and the single-use challenge matter here. */
  'POST /admin/passkeys/signin/challenge': async (env, request) => {
    await enforceSourceRateLimit(env, 'ADMIN_AUTH_RATE_LIMITER', request, {
      scope: 'platform_passkey_signin',
      message: 'Too many sign-in attempts from this connection. Wait a minute and try again.'
    });
    const { challenge } = await passkeyChallenges.issue(env.DB,
      { scope: 'platform', purpose: 'authenticate' });
    return json({ challenge, rpId: rpIdFor(adminOrigin(env)) });
  },

  'POST /admin/passkeys/signin': async (env, request) => {
    await enforceSourceRateLimit(env, 'ADMIN_AUTH_RATE_LIMITER', request, {
      scope: 'platform_passkey_signin',
      message: 'Too many sign-in attempts from this connection. Wait a minute and try again.'
    });
    const body_ = await body(request);
    const proven = await passkeys.authenticate(env.DB, {
      scope: 'platform', origin: adminOrigin(env), rpId: rpIdFor(adminOrigin(env)),
      challenge: body_.challenge, credentialId: body_.credentialId,
      clientDataJSON: body_.clientDataJSON,
      authenticatorData: body_.authenticatorData, signature: body_.signature
    });

    /* The signature proves the device. The row proves the account is still
       one this console honours - a removed colleague's phone must stop
       working the moment their row goes, not when their key expires. */
    const member = await team.byEmail(env.DB, proven.subject);
    if (!member) throw unauthorised('That account no longer has console access.');

    const token = newSessionToken();
    const csrfToken = newCsrfToken();
    await adminSessions.create(env.DB, member.email, await sha256(token), 8,
      request.headers.get('User-Agent'), await sha256(csrfToken));
    await audit.write(env.DB, {
      actor: 'platform:' + member.email, action: 'admin_sign_in', detail: 'passkey'
    });
    return json({
      ...(cookieAuthEnforced(env, ADMIN_SESSION_COOKIE) ? {} : { token }),
      csrfToken,
      member: { email: member.email, name: member.full_name, role: member.role }
    }, 200, { 'Set-Cookie': sessionCookie(ADMIN_SESSION_COOKIE, token, 8) });
  },

  /* ---- the way back in that needs no device and no dashboard ----

     Vijay: "what happens if the pc is lost or not working - i do nothing
     right?"

     Right, and that was the hole. Owner recovery below is gated on a
     Cloudflare Access identity, so with Access off it cannot run at all,
     and a passkey is by definition tied to a device that may be the thing
     that was lost. So the console gets what every other product has: a
     code to the address the account already has on file, which arrives on
     whatever he can open his email on.

     It reveals nothing - the reply is identical whether the address is a
     console account or not - and it cannot be rushed, because the code is
     six digits with five attempts and a five-minute life. */
  'POST /admin/reset/start': async (env, request) => {
    const { email } = await body(request);
    const id = String(email || '').trim().toLowerCase();
    if (!isEmail(id)) throw badRequest('Enter the email address of your console account.');
    await enforceRateLimit(env, 'ADMIN_AUTH_RATE_LIMITER', {
      scope: 'platform_reset_start', subject: id,
      message: 'Too many reset requests. Wait a minute and try again.'
    });
    await enforceSourceRateLimit(env, 'ADMIN_AUTH_RATE_LIMITER', request, {
      scope: 'platform_reset_start',
      message: 'Too many reset requests from this connection. Wait a minute and try again.'
    });
    const member = await team.byEmail(env.DB, id);
    /* Always the same answer, so this cannot be used to find out who is on
       the platform team. */
    if (member) await issueOtp(env, env.DB, { purpose: 'platform_reset', rawIdentifier: id });
    return json({ sentTo: maskIdentifier(id) });
  },

  'POST /admin/reset/verify': async (env, request) => {
    const { email, code, newPassword } = await body(request);
    const id = String(email || '').trim().toLowerCase();
    if (!isEmail(id)) throw badRequest('Enter the email address of your console account.');
    await enforceRateLimit(env, 'ADMIN_AUTH_RATE_LIMITER', {
      scope: 'platform_reset_verify', subject: id,
      message: 'Too many reset attempts. Wait a minute and request a new code.'
    });
    await enforceSourceRateLimit(env, 'ADMIN_AUTH_RATE_LIMITER', request, {
      scope: 'platform_reset_verify',
      message: 'Too many reset attempts from this connection. Wait a minute and try again.'
    });
    /* The code is checked BEFORE the account is looked up or the new
       password is judged, so nothing downstream can be reached by anyone
       who does not hold it. */
    await verifyOtp(env.DB, { purpose: 'platform_reset', rawIdentifier: id, code });

    if (!newPassword || newPassword.length < 12 ||
        !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      throw badRequest('Choose a password of at least 12 characters, with letters and numbers.');
    }
    const member = await team.byEmail(env.DB, id);
    if (!member) throw badRequest('Request a new code first.');

    const { hash, salt } = await hashPassword(newPassword, activePepper(env));
    await team.resetPassword(env.DB, member.email, hash, salt);
    await audit.write(env.DB, {
      actor: 'platform:' + member.email, action: 'platform_password_reset'
    });
    return json({ ok: true, email: member.email });
  },

  /* Break-glass owner recovery has no TCOS session by definition. Its
     authority is the signed Cloudflare Access identity, an exact configured
     owner address, same-origin submission and a fresh bot challenge. It can
     reset only that fixed owner and revokes every old owner session. */
  'POST /admin/recover': async (env, request) => {
    if (!accessEnforced(env)) {
      throw new ApiError(503, 'recovery_unavailable',
        'Owner recovery is available only behind Cloudflare Access.');
    }
    const configuredOwner = String(env.PLATFORM_OWNER_EMAIL || '').trim().toLowerCase();
    const accessEmail = String(request.headers.get(ACCESS_EMAIL_HEADER) || '').toLowerCase();
    if (!accessEmail) throw forbidden('Cloudflare Access did not say who you are.');

    /* RECOVERY FOLLOWS THE IDENTITY, NOT A CONSTANT.
     *
       This used to allow only PLATFORM_OWNER_EMAIL, and on 20 Sep 2026 that
       locked Vijay out of his own console. The Access application's only
       login method is a Cloudflare account, so Access names him by whichever
       address that account uses - and if that is not the one written into
       wrangler.jsonc, then sign-in wants a password for an account he is
       not holding AND recovery refuses him for not being the configured
       owner. Two doors, both correct, both shut.
     *
       So the rule is now: Cloudflare Access has authenticated you as an
       address that is ALREADY an owner of this console. You may reset that
       account and no other.
     *
       This is not a widening of who gets in. It is still gated on passing
       Access as that exact person, on same-origin submission, on a fresh
       bot challenge and on a rate limit. What it removes is the single
       point of failure where a constant in a config file disagrees with
       the identity provider - and nobody can say which is wrong from the
       screen that refuses them.
     *
       A NEW owner still cannot be minted this way: the configured address
       is the only one allowed to exist yet, which is what first run needs. */
    const existing = await team.byEmail(env.DB, accessEmail);
    const isExistingOwner = !!existing && existing.role === 'owner';
    const isConfiguredOwner = !!configuredOwner && accessEmail === configuredOwner;
    if (!isExistingOwner && !isConfiguredOwner) {
      throw forbidden('Cloudflare Access signed you in as ' + accessEmail +
        ', which is not an owner of this console.');
    }
    const target = accessEmail;

    if (request.headers.get('Origin') !== adminOrigin(env)) {
      throw forbidden('Open the TCOS platform console to recover owner access.');
    }
    const { email, password, turnstileToken } = await body(request);
    if (String(email || '').trim().toLowerCase() !== target) {
      throw forbidden('Use the same email you used for Cloudflare Access.');
    }
    if (!password || password.length < 12) {
      throw badRequest('Choose a password with at least 12 characters.');
    }
    await enforceRateLimit(env, 'ADMIN_AUTH_RATE_LIMITER', {
      scope: 'platform_owner_recovery', subject: target,
      message: 'Too many recovery attempts. Wait a minute and try again.'
    });
    await enforceSourceRateLimit(env, 'ADMIN_AUTH_RATE_LIMITER', request, {
      scope: 'platform_owner_recovery',
      message: 'Too many recovery attempts from this connection. Wait a minute and try again.'
    });
    await verifyTurnstile(env, request, {
      token: turnstileToken, action: 'platform_recover'
    });
    /* Keep the name the row already carries. Overwriting it with a constant
       would rename whichever owner used this, which is somebody else's row
       now that more than one address can get here. */
    const member = await team.recoverOwner(
      env.DB, env, target, password,
      (existing && existing.full_name) || 'Platform owner');
    await audit.write(env.DB, {
      actor: 'platform:' + member.email, action: 'owner_access_recovered'
    });
    return json({ ok: true, email: member.email });
  },

  /* Step-up authentication for changes that can stop a clinic, replace a
     credential, alter money, or grant access. The existing session and
     Cloudflare identity still have to be valid; this adds a recent password
     proof and updates only that one session. */
  'POST /admin/reauth': async (env, request) => {
    const admin = await requireAdmin(env, request);
    const { password, turnstileToken } = await body(request);
    await enforceRateLimit(env, 'ADMIN_AUTH_RATE_LIMITER', {
      scope: 'platform_admin_reauth', subject: admin.email,
      message: 'Too many verification attempts. Wait a minute and try again.'
    });
    await enforceSourceRateLimit(env, 'ADMIN_AUTH_RATE_LIMITER', request, {
      scope: 'platform_admin_reauth',
      message: 'Too many verification attempts from this connection. Wait a minute and try again.'
    });
    await verifyTurnstile(env, request, {
      token: turnstileToken, action: 'platform_reauth'
    });
    const throttle = {
      scope: 'platform_admin_reauth', subject: admin.email,
      maxFailures: 5, blockMinutes: 15,
      message: 'Too many incorrect verification attempts. Wait fifteen minutes and try again.'
    };
    await authThrottle.check(env.DB, request, throttle);
    try {
      await adminSignIn(env, admin.email, password);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await authThrottle.failure(env.DB, request, throttle);
      }
      throw error;
    }
    await authThrottle.clear(env.DB, request, throttle);
    const credential = sessionCredential(request, ADMIN_SESSION_COOKIE, env);
    if (!credential) throw unauthorised('Sign in to the platform console.');
    const reauthenticatedAt = await adminSessions.markReauthenticated(
      env.DB, await sha256(credential.token));
    await audit.write(env.DB, {
      actor: 'platform:' + admin.email, action: 'admin_reauthenticated'
    });
    return json({ ok: true, reauthenticatedAt });
  },

  'POST /admin/signout': async (env, request) => {
    const credential = sessionCredential(request, ADMIN_SESSION_COOKIE, env);
    if (credential) {
      const tokenHash = await sha256(credential.token);
      const resolved = await adminSessions.resolve(env.DB, tokenHash);
      if (resolved) await requireCookieCsrf(env, request, credential, resolved.csrfHash);
      await adminSessions.revoke(env.DB, tokenHash);
    }
    return json({ ok: true }, 200,
      { 'Set-Cookie': clearSessionCookie(ADMIN_SESSION_COOKIE) });
  },

  'GET /admin/me': async (env, request) => {
    const admin = await requireAdmin(env, request);
    return json({ email: admin.email, name: admin.full_name, role: admin.role,
      capabilities: platformCapabilities(admin),
      mustChangePassword: !!admin.must_change_password });
  },

  'POST /admin/change-password': async (env, request) => {
    const admin = await requireAdmin(env, request);
    const { currentPassword, newPassword } = await body(request);
    if (!newPassword || newPassword.length < 12 ||
        !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      throw badRequest('Choose at least 12 characters with letters and numbers.');
    }
    await adminSignIn(env, admin.email, currentPassword);
    const { hash, salt } = await hashPassword(newPassword, activePepper(env));
    const credential = sessionCredential(request, ADMIN_SESSION_COOKIE, env);
    if (!credential) throw unauthorised('Sign in to the platform console.');
    await team.changeOwnPassword(
      env.DB, admin.email, hash, salt, await sha256(credential.token));
    await audit.write(env.DB, {
      actor: 'platform:' + admin.email, action: 'platform_password_changed'
    });
    return json({ ok: true });
  },

  'GET /admin/doctors': async (env, request) => {
    await requireAdminCapability(env, request, 'doctors');
    return json({ doctors: await tenants.list(env.DB) });
  },

  'GET /admin/patients': async (env, request) => {
    await requireAdminCapability(env, request, 'patients');
    return json({ patients: await platformPatients.list(env.DB) });
  },

  'GET /admin/patients/:id': async (env, request, params) => {
    const admin = await requireAdminCapability(env, request, 'patients');
    const detail = await platformPatients.detail(env.DB, params.id);
    await audit.write(env.DB, {
      actor: 'platform:' + admin.email, action: 'patient_operational_viewed',
      targetType: 'patient', targetId: params.id
    });
    return json(detail);
  },

  /* The business on one screen: clinics, plans, joiners, attrition, storage,
     messages and who is actually using it. Counts clinical rows, reads none
     of them - see the header of ownerdashboard.js. */
  /* --- doctors' own domains, from the owner's side --------------------
     Who asked, who has it, and what it costs against what we charge. */

  'GET /admin/domains': async (env, request) => {
    await requireAdminCapability(env, request, 'money');
    return json(await domainAdmin.overview(env.DB, env, env.AI_USD_INR));
  },

  /* Granting merges one key into feature_overrides rather than replacing the
     object, so turning domains on cannot silently erase another override. */
  'POST /admin/domains/:id': async (env, request, params) => {
    const admin = await requireFreshAdminCapability(env, request, 'money');
    const { allowed, note } = await body(request);
    const result = await domainAdmin.setAllowed(env.DB, params.id, !!allowed);
    /* Answering the request is part of granting it, or the same clinic is
       granted three times and the queue never empties. */
    await domainAdmin.closeRequests(env.DB, params.id,
      note || (allowed ? 'Own domain switched on.' : 'Own domain switched off.'));
    await audit.write(env.DB, {
      doctorId: params.id, actor: 'platform:' + admin.email,
      action: allowed ? 'custom_domain_granted' : 'custom_domain_revoked',
      targetType: 'doctor', targetId: params.id
    });
    return json(result);
  },

  /* --- coupons -------------------------------------------------------
     A code a doctor can remember, bolted to a Razorpay offer that does the
     actual discounting. A coupon cannot be switched on without one - see
     worker/coupons.js. Money, so every write needs a fresh sign-in. */

  'GET /admin/coupons': async (env, request) => {
    await requireAdminCapability(env, request, 'money');
    return json({ coupons: await coupons.list(env.DB) });
  },

  'GET /admin/coupons/:id/redemptions': async (env, request, params) => {
    await requireAdminCapability(env, request, 'money');
    return json({ redemptions: await coupons.redemptions(env.DB, params.id) });
  },

  'POST /admin/coupons': async (env, request) => {
    const admin = await requireFreshAdminCapability(env, request, 'money');
    const created = await coupons.create(env.DB, await body(request), admin.email);
    await audit.write(env.DB, { actor: 'platform:' + admin.email,
      action: 'coupon_created', targetType: 'coupon', targetId: created.id,
      detail: created.code });
    return json({ coupon: created }, 201);
  },

  'PATCH /admin/coupons/:id': async (env, request, params) => {
    const admin = await requireFreshAdminCapability(env, request, 'money');
    const patch = await body(request);
    const updated = await coupons.update(env.DB, params.id, patch);
    await audit.write(env.DB, { actor: 'platform:' + admin.email,
      action: patch.active === undefined ? 'coupon_updated'
        : (patch.active ? 'coupon_switched_on' : 'coupon_switched_off'),
      targetType: 'coupon', targetId: params.id, detail: updated.code });
    return json({ coupon: updated });
  },

  'DELETE /admin/coupons/:id': async (env, request, params) => {
    const admin = await requireFreshAdminCapability(env, request, 'money');
    const result = await coupons.remove(env.DB, params.id);
    await audit.write(env.DB, { actor: 'platform:' + admin.email,
      action: result.deleted ? 'coupon_deleted' : 'coupon_switched_off',
      targetType: 'coupon', targetId: params.id });
    return json(result);
  },

  'GET /admin/dashboard': async (env, request) => {
    await requireAdminCapability(env, request, 'analytics');
    return json(await ownerDashboard.summary(env.DB));
  },

  'GET /admin/analytics/health': async (env, request) => {
    await requireAdminCapability(env, request, 'analytics');
    return json(await platformAnalytics.summary(env.DB));
  },

  'GET /admin/subscriptions': async (env, request) => {
    await requireAdminCapability(env, request, 'subscriptions');
    return json(await subscriptions.adminList(env.DB, env));
  },

  /* What doctors' own domains are costing us this month.
   *
     Custom hostnames are the one thing in TCOS billed per clinic, so the
     number belongs where the owner already looks rather than in a Cloudflare
     billing page nobody opens. `pending` is the one to watch: billed from
     creation, serving nobody, and usually a doctor who gave up halfway. */
  'GET /admin/domains/usage': async (env, request) => {
    await requireAdminCapability(env, request, 'subscriptions');
    try {
      return json(await customHostname.usage(env, env.AI_USD_INR));
    } catch (error) {
      /* Cloudflare being unreachable must not blank the console page this
         sits on. Say why, and let the rest of the screen render. */
      return json({ configured: customHostname.configured(env),
        error: error.detail || error.message });
    }
  },

  /* Provider plans are immutable price snapshots. This idempotently finds
     or creates the six current monthly/yearly plans, with no dashboard data
     entry and no plan ids copied into source control. */
  'POST /admin/subscriptions/sync-plans': async (env, request) => {
    const admin = await requireFreshAdminCapability(env, request, 'subscriptions');
    const synced = await subscriptions.syncPlans(env.DB, env);
    await audit.write(env.DB, {
      actor: 'platform:' + admin.email, action: 'subscription_plans_synced',
      detail: synced.length + ' plans'
    });
    return json({ synced });
  },

  'GET /admin/support': async (env, request) => {
    await requireAdminCapability(env, request, 'support');
    return json({ requests: await supportRequests.listAll(env.DB) });
  },

  'GET /admin/support/:id': async (env, request, params) => {
    await requireAdminCapability(env, request, 'support');
    return json(await supportRequests.detail(env.DB, params.id));
  },

  'PATCH /admin/support/:id': async (env, request, params) => {
    const admin = await requireAdminCapability(env, request, 'support');
    const patch = await body(request);
    if (patch.status && !['open', 'in_progress', 'waiting', 'resolved'].includes(patch.status)) {
      throw badRequest('Unknown support status.');
    }
    let updated = await supportRequests.update(env.DB, params.id, patch);
    if ('assignedTo' in patch) {
      updated = (await supportRequests.assign(env.DB, params.id,
        patch.assignedTo || null)).request;
    }
    await audit.write(env.DB, { actor: 'platform:' + admin.email,
      action: 'support_updated', targetType: 'support', targetId: params.id });
    return json({ request: updated });
  },

  'POST /admin/support/:id/messages': async (env, request, params) => {
    const admin = await requireAdminCapability(env, request, 'support');
    const details = await body(request);
    const thread = await supportRequests.reply(
      env.DB, params.id, admin, details.message, { internal: details.internal === true });
    await audit.write(env.DB, {
      doctorId: thread.request.doctor_id, actor: 'platform:' + admin.email,
      action: details.internal === true ? 'support_note_added' : 'support_replied',
      targetType: 'support', targetId: params.id
    });
    return json(thread, 201);
  },

  /* Create the account and hand back a temporary password ONCE. This is how
     a doctor actually joins: no email provider, no SMS, no waiting. */
  'POST /admin/doctors': async (env, request) => {
    const admin = await requireFreshAdminCapability(env, request, 'doctors');
    const details = await body(request);
    if (!details.fullName || !details.clinicName) {
      throw badRequest('Doctor name and clinic name are required.');
    }
    const { channel, identifier } = classifyIdentifier(details.identifier);

    const existing = channel === 'email'
      ? await doctors.byEmail(env.DB, identifier)
      : await doctors.byMobile(env.DB, identifier);
    if (existing) throw badRequest('A doctor already exists with that mobile or email.');

    const result = await invites.createDoctor(env.DB, env, admin, { ...details, channel, identifier });
    await audit.write(env.DB, {
      doctorId: result.doctorId, actor: 'platform:' + admin.email,
      action: 'doctor_invited', targetType: 'doctor', targetId: result.doctorId,
      detail: details.clinicName + ' via ' + channel
    });
    return json({
      doctorId: result.doctorId,
      identifier,
      channel,
      temporaryPassword: result.temporaryPassword,
      note: 'Shown once. It is not stored in the clear and cannot be retrieved again.'
    }, 201);
  },

  'POST /admin/doctors/:id/reissue': async (env, request, params) => {
    const admin = await requireFreshAdminCapability(env, request, 'doctors');
    const result = await invites.reissuePassword(env.DB, env, admin, params.id);
    await audit.write(env.DB, {
      doctorId: params.id, actor: 'platform:' + admin.email,
      action: 'password_reissued', targetType: 'doctor', targetId: params.id
    });
    return json(result);
  },

  'PATCH /admin/doctors/:id': async (env, request, params) => {
    const admin = await requireFreshAdminCapability(env, request, 'doctors');
    const patch = await body(request);
    const changed = [];

    if (patch.plan) {
      await tenants.setPlan(env.DB, params.id, patch.plan, patch.planReason);
      /* Paying hands the reserve back the moment the plan changes, so a
         clinic that upgrades is not still counting down someone else's
         clock. This is the "they pay and everything works again" step. */
      await clearReserve(env.DB, params.id);
      changed.push('plan=' + patch.plan + ', reason=' + String(patch.planReason || '').slice(0, 120));
    }
    if (patch.status) { await tenants.setStatus(env.DB, params.id, patch.status); changed.push('status=' + patch.status); }
    if (patch.featureOverrides) { await tenants.setOverrides(env.DB, params.id, patch.featureOverrides); changed.push('features'); }
    if (patch.practicePacks) { await tenants.setPacks(env.DB, params.id, patch.practicePacks); changed.push('packs'); }
    if ('trial' in patch) { await tenants.setTrial(env.DB, params.id, patch.trial); changed.push('trial'); }
    if (patch.accountType) {
      await tenants.setAccountType(env.DB, params.id, patch.accountType);
      changed.push('account=' + patch.accountType);
    }

    await audit.write(env.DB, {
      doctorId: params.id, actor: 'platform:' + admin.email,
      action: 'doctor_updated', targetType: 'doctor', targetId: params.id,
      detail: changed.join(', ')
    });
    return json({ ok: true, changed });
  },

  /* --- a payment that arrived outside Razorpay -------------------------
     Vijay: "sometimes payment is getting failed, so he connects us and asks
     for upi... i select the payment date and save, and tell you monthly or
     yearly, and accordingly the expiry date will come into the picture."

     Fresh admin re-authentication, like every other money route: recording
     a payment grants a paid package, and a borrowed console tab must not be
     able to do it. */
  'POST /admin/doctors/:id/payment': async (env, request, params) => {
    const admin = await requireFreshAdminCapability(env, request, 'doctors');
    const doctor = await doctors.byId(env.DB, params.id);
    const details = await body(request);
    const result = await offlinePayments.record(
      env.DB, doctor, details, 'platform:' + admin.email);
    /* A clinic that has just paid gets its reserve back immediately - the
       same step the plan-change path does, so "they paid and everything
       works again" is true the moment he presses save. */
    await clearReserve(env.DB, params.id);
    return json(result, 201);
  },

  'GET /admin/doctors/:id/payments': async (env, request, params) => {
    await requireAdminCapability(env, request, 'doctors');
    const doctor = await doctors.byId(env.DB, params.id);
    if (!doctor) throw notFound('No such clinic.');
    return json({
      payments: await offlinePayments.history(env.DB, params.id),
      standing: planStanding(doctor),
      accountType: doctor.account_type || 'live',
      paidUntil: doctor.plan_paid_until,
      note: doctor.plan_note,
      /* The form's own options, served rather than hardcoded in the
         console, so a price change is one deploy and not two. */
      options: { prices: PRICE_PAISE, methods: METHODS, terms: Object.keys(TERMS) }
    });
  },

  /* --- twelve demonstration clinics ------------------------------------
     Vijay: "add different demo doctors in each products — ayurcos free,
     practice, clinic, group; same with allocos and homeocos."

     ONE PER CALL, deliberately. Each password is 100,000 PBKDF2 rounds,
     roughly 10ms of CPU, and a Workers request has 10ms on the free plan.
     Twelve in one request is not slow, it is killed - so the console asks
     for them one at a time. A run that dies halfway has made nine real
     clinics, and pressing the button again finishes rather than restarts. */

  'GET /admin/demo-clinics': async (env, request) => {
    await requireAdminCapability(env, request, 'doctors');
    return json({ clinics: await demoSeed.status(env.DB) });
  },

  'POST /admin/demo-clinics/:key': async (env, request, params) => {
    const admin = await requireFreshAdminCapability(env, request, 'doctors');
    const { password } = await body(request);
    const result = await demoSeed.create(
      env.DB, env, params.key, password, 'platform:' + admin.email);
    return json(result, 201);
  },

  /* Thrown away and rebuilt is the normal life of these. Twelve accounts
     sharing one password, left on a production system after the
     demonstration is over, is how that password stops being a demo one. */
  'DELETE /admin/demo-clinics': async (env, request) => {
    const admin = await requireFreshAdminCapability(env, request, 'doctors');
    const result = await demoSeed.removeAll(env.DB);
    await audit.write(env.DB, { actor: 'platform:' + admin.email,
      action: 'demo_clinics_removed', detail: String(result.removed) });
    return json(result);
  },

  'GET /admin/team': async (env, request) => {
    await requireAdminCapability(env, request, 'team');
    return json({ team: await team.list(env.DB) });
  },

  'POST /admin/team': async (env, request) => {
    const admin = await requireFreshAdminCapability(env, request, 'team');
    const { email, fullName, role, capabilities } = await body(request);
    const password = generateTempPassword();
    const member = await team.add(env.DB, {
      email, fullName, role, capabilities, password, pepper: activePepper(env),
      invitedBy: admin.email
    });
    await audit.write(env.DB, {
      actor: 'platform:' + admin.email, action: 'team_added', detail: member.email + ' as ' + role
    });
    return json({
      member: { email: member.email, name: member.full_name, role: member.role,
        capabilities: JSON.parse(member.capabilities || '[]') },
      temporaryPassword: password,
      accessReminder: 'Add the same email to the Cloudflare Access policy before handover.'
    }, 201);
  },

  'PATCH /admin/team/:email': async (env, request, params) => {
    const admin = await requireFreshAdminCapability(env, request, 'team');
    const patch = await body(request);
    const member = await team.setAccess(env.DB, params.email, patch);
    await audit.write(env.DB, {
      actor: 'platform:' + admin.email, action: 'team_access_changed',
      targetType: 'platform_team', targetId: member.email,
      detail: member.role + ' ' + member.capabilities
    });
    return json({ member: { ...member, capabilities: JSON.parse(member.capabilities || '[]') } });
  },

  'DELETE /admin/team/:email': async (env, request, params) => {
    const admin = await requireFreshAdminCapability(env, request, 'team');
    await team.remove(env.DB, params.email);
    await audit.write(env.DB, {
      actor: 'platform:' + admin.email, action: 'team_removed', detail: params.email
    });
    return json({ ok: true });
  },

  /* First run only. Sets the password for a pre-listed owner email, and
     self-disables the moment any team member has a password. Nobody - me
     included - ever handles the value; it goes straight from the owner's
     browser into a hash. */
  'POST /admin/bootstrap': async (env, request) => {
    if (await bootstrap.anyAdminHasPassword(env.DB)) {
      throw forbidden('Already set up. Use the sign-in page, or reset from an existing admin.');
    }
    const { email, password, turnstileToken } = await body(request);
    if (accessEnforced(env) && request.headers.get(ACCESS_EMAIL_HEADER) !==
        String(email || '').trim().toLowerCase()) {
      throw forbidden('Set up the same email you used for Cloudflare Access.');
    }
    await enforceRateLimit(env, 'ADMIN_AUTH_RATE_LIMITER', {
      scope: 'platform_admin_bootstrap', subject: String(email || '').trim().toLowerCase(),
      message: 'Too many setup attempts. Wait a minute and try again.'
    });
    await enforceSourceRateLimit(env, 'ADMIN_AUTH_RATE_LIMITER', request, {
      scope: 'platform_admin_bootstrap',
      message: 'Too many setup attempts from this connection. Wait a minute and try again.'
    });
    await verifyTurnstile(env, request, {
      token: turnstileToken, action: 'platform_bootstrap'
    });
    if (!password || password.length < 12) {
      throw badRequest('Choose a password of at least 12 characters for the owner account.');
    }
    const member = await bootstrap.setOwnerPassword(env.DB, env, email, password);
    await audit.write(env.DB, { actor: 'platform:' + member.email, action: 'admin_bootstrapped' });
    return json({ ok: true, email: member.email, role: member.role });
  },


  /* --- the team: who else may use this clinic ------------------------- */

  /* The roles and what each one may do, sent to the screen so the interface
     and the router can never disagree about it. */
  'GET /team': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.TEAM);
    return json({ roles: roleList(), staff: await staff.listFor(env.DB, doctor.id) });
  },

  /* Creates the account and hands back a temporary password ONCE.

     It is generated on the server, never stored in readable form, and the
     new account cannot do anything until it has been replaced. That is why
     the response says it will not be shown again - it genuinely cannot be. */
  'POST /team': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.TEAM);
    /* A practitioner is another doctor in this practice, so their own
       qualification and council number come in here - their number is what
       prints on the prescriptions they issue. Ignored for staff roles. */
    const { fullName, mobile, role, qualification, registrationNo, council } =
      await body(request);

    /* A hard stop, because nobody is waiting on it. Adding a colleague can
       reasonably wait for an upgrade; a patient at the counter cannot. */
    await requireQuota(env.DB, doctor, role === 'practitioner' ? 'doctors' : 'staff', 1);

    const normalised = normaliseMobile(mobile);
    if (!normalised) throw badRequest('Enter a valid mobile number.');
    /* Their number is their login, so it cannot be a number that already
       signs somebody in. */
    if (await doctors.byMobile(env.DB, normalised)) {
      throw badRequest('That mobile number already signs in as a doctor.');
    }

    const password = temporaryPassword();
    const { hash, salt } = await hashPassword(password, activePepper(env));
    const user = await staff.create(env.DB, doctor.id, {
      fullName, mobile: normalised, role, passwordHash: hash, passwordSalt: salt,
      qualification, registrationNo, council
    });

    await audit.write(env.DB, {
      doctorId: doctor.id, actor: actorKey(doctor), action: 'staff_added',
      targetType: 'user', targetId: user.id, detail: user.full_name + ' as ' + role
    });

    return json({
      user: { id: user.id, fullName: user.full_name, mobile: user.mobile, role: user.role },
      temporaryPassword: password,
      note: 'Give this to them now. It is not stored and cannot be shown again. ' +
            'They must choose their own password the first time they sign in.'
    }, 201);
  },

  'POST /team/:id/reset': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.TEAM);
    const password = temporaryPassword();
    const { hash, salt } = await hashPassword(password, activePepper(env));
    const user = await staff.resetPassword(env.DB, doctor.id, params.id, hash, salt);
    await audit.write(env.DB, {
      doctorId: doctor.id, actor: actorKey(doctor), action: 'staff_password_reset',
      targetType: 'user', targetId: user.id
    });
    return json({ temporaryPassword: password, fullName: user.full_name });
  },

  /* Revoking ends the sessions they already hold. Without that they stay
     signed in until the token expires, which is not what the doctor means
     when she clicks it. */
  'POST /team/:id/status': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.TEAM);
    const { status } = await body(request);
    if (!['active', 'revoked'].includes(status)) throw badRequest('Unknown status.');
    const user = await staff.setStatus(env.DB, doctor.id, params.id, status);
    await audit.write(env.DB, {
      doctorId: doctor.id, actor: actorKey(doctor),
      action: status === 'revoked' ? 'staff_revoked' : 'staff_restored',
      targetType: 'user', targetId: user.id, detail: user.full_name
    });
    return json({ ok: true });
  },

  'PATCH /team/:id/capabilities': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.TEAM);
    const { capabilities } = await body(request);
    const user = await staff.setCapabilities(env.DB, doctor.id, params.id, capabilities);
    await audit.write(env.DB, { doctorId: doctor.id, actor: actorKey(doctor),
      action: 'staff_capabilities_changed', targetType: 'user', targetId: user.id,
      detail: JSON.stringify(capabilities || []) });
    return json({ user });
  },

  'GET /support': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.SETTINGS);
    return json({ requests: await supportRequests.listForDoctor(env.DB, doctor.id) });
  },

  'GET /support/:id': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.SETTINGS);
    return json(await supportRequests.detail(env.DB, params.id, doctor.id));
  },

  'POST /support': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.SETTINGS);
    const details = await body(request);
    if (!details.subject || !details.message) throw badRequest('Subject and message are required.');
    const created = await supportRequests.create(env.DB, doctor.id,
      actorKey(doctor), details);
    await audit.write(env.DB, { doctorId: doctor.id, actor: actorKey(doctor),
      action: 'support_requested', targetType: 'support', targetId: created.id });
    return json({ request: created }, 201);
  },

  'POST /support/:id/messages': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.SETTINGS);
    const details = await body(request);
    const thread = await supportRequests.replyFromClinic(
      env.DB, params.id, doctor.id, actorKey(doctor), details.message);
    await audit.write(env.DB, {
      doctorId: doctor.id, actor: actorKey(doctor), action: 'support_replied',
      targetType: 'support', targetId: params.id
    });
    return json(thread, 201);
  },

  /* Anyone signed in may change their own password, and someone on a
     temporary one must, before the rest of TCOS opens to them. */
  'POST /auth/change-password': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    const { currentPassword, newPassword } = await body(request);
    if (!newPassword || newPassword.length < 8) {
      throw badRequest('Choose a password of at least 8 characters.');
    }
    if (!/[0-9]/.test(newPassword) || !/[a-zA-Z]/.test(newPassword)) {
      throw badRequest('Use both letters and numbers.');
    }

    const actor = doctor.actor;
    const account = actor.isDoctor
      ? doctor
      : await staff.byId(env.DB, doctor.id, actor.userId);

    const checked = await verifyPasswordVersioned(currentPassword, env,
      account.password_salt, account.password_hash);
    if (!checked.ok) {
      throw badRequest('That is not your current password.');
    }

    const { hash, salt } = await hashPassword(newPassword, activePepper(env));
    if (actor.isDoctor) await doctors.setPassword(env.DB, doctor.id, hash, salt);
    else await staff.setPassword(env.DB, doctor.id, actor.userId, hash, salt);

    /* CHANGING YOUR PASSWORD MUST NOT SIGN YOU OUT OF THE SESSION YOU ARE IN.
     *
       setPassword revokes every session opened with the old credential, which
       is right - a stolen token has to die the moment the password changes.
       But it cannot tell the thief's session from the one making the request,
       so it killed both, and this route returned {ok:true} without issuing a
       replacement. The doctor's very next click answered 401 and the screen
       said "sign in again".
     *
       That bit hardest on the first sign-in of every new account, because
       must_change_password forces this exact flow: approve a doctor, she
       signs in, is made to set a password, and is thrown straight back out.
       Vijay hit it on his own account: "doctor is not able to go to the tabs
       it is giving error like sign in again i tried signing in again twice
       still same issue." Twice, because signing in again just repeats it.
     *
       So the old sessions still all die, and a fresh one is issued here. The
       security property is kept - every token minted under the old password
       is dead, including this request's - and she keeps working. */
    const token = newSessionToken();
    const csrfToken = newCsrfToken();
    await sessions.create(env.DB, doctor.id, await sha256(token),
      Number(env.SESSION_TTL_HOURS || 12), request.headers.get('User-Agent'),
      actor.isDoctor ? null : actor.userId, await sha256(csrfToken));

    await audit.write(env.DB, {
      doctorId: doctor.id,
      actor: actorKey(doctor),
      action: 'password_changed'
    });
    return json({
      ok: true,
      /* Same shape as sign-in, so the client stores it the same way. */
      ...(cookieAuthEnforced(env, CLINIC_SESSION_COOKIE) ? {} : { token }),
      csrfToken
    }, 200, {
      'Set-Cookie': sessionCookie(
        CLINIC_SESSION_COOKIE, token, Number(env.SESSION_TTL_HOURS || 12))
    });
  },


  /* --- billing ---------------------------------------------------------

     A bill follows the same rules as a prescription, because it has the same
     character once it is in the patient's hand: a draft is editable, issuing
     assigns a gap-free number and freezes it, and a mistake is cancelled with
     a stated reason rather than quietly rewritten. */

  'GET /invoices': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.BILLING);
    const q = new URL(request.url).searchParams;
    const to = q.get('to') || new Date().toISOString().slice(0, 10);
    const from = q.get('from') || new Date(Date.parse(to) - 29 * 864e5).toISOString().slice(0, 10);
    return json({
      from, to,
      invoices: await billing.list(env.DB, doctor.id, {
        status: q.get('status'), patientId: q.get('patient'), from, to
      }),
      summary: await billing.summary(env.DB, doctor.id, from, to),
      daily: await billing.dailyCollected(env.DB, doctor.id, from, to),
      fees: await billing.fees(env.DB, doctor.id)
    });
  },

  'GET /invoices/:id': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.BILLING);
    return json({ invoice: await billing.withItems(env.DB, doctor.id, params.id) });
  },

  'POST /invoices': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.BILLING);
    requireFeature(doctor, 'billing');
    const { patientId, visitId } = await body(request);
    await patients.requireOnList(env.DB, doctor.id, patientId);
    const invoice = await billing.createDraft(env.DB, doctor.id, { patientId, visitId });
    return json({ invoice }, 201);
  },

  'PATCH /invoices/:id': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.BILLING);
    requireFeature(doctor, 'billing');
    const { items, discount, taxRate, note } = await body(request);
    return json({
      invoice: await billing.replaceItems(env.DB, doctor.id, params.id, items,
        { discount, taxRate, note })
    });
  },

  'POST /invoices/:id/issue': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.BILLING);
    requireFeature(doctor, 'billing');
    const invoice = await billing.issue(env.DB, doctor.id, params.id,
      doctor.patient_prefix, actorKey(doctor));
    return json({ invoice });
  },

  'POST /invoices/:id/cancel': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.BILLING);
    requireFeature(doctor, 'billing');
    const { reason } = await body(request);
    const invoice = await billing.cancel(env.DB, doctor.id, params.id,
      reason, actorKey(doctor));
    return json({ invoice });
  },

  'POST /invoices/:id/payments': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.BILLING);
    requireFeature(doctor, 'billing');
    const payment = await body(request);
    /* Who took the money matters more than who owns the clinic. */
    const invoice = await billing.addPayment(env.DB, doctor.id, params.id, {
      ...payment, receivedBy: doctor.actor.userId, actor: actorKey(doctor)
    });
    return json({ invoice });
  },

  'POST /fees': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.SETTINGS);
    return json({ fee: await billing.addFee(env.DB, doctor.id, await body(request)) }, 201);
  },

  'DELETE /fees/:id': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.SETTINGS);
    await billing.removeFee(env.DB, doctor.id, params.id);
    return json({ ok: true });
  },

  /* --- everything she has issued -------------------------------------- */

  'GET /prescriptions': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.READ_NOTES);
    const q = new URL(request.url).searchParams;
    return json({
      prescriptions: await prescriptions.listForDoctor(env.DB, doctor.id, {
        from: q.get('from'), to: q.get('to'), search: q.get('q')
      })
    });
  },

  /* --- what the practice has been doing -------------------------------- */

  'GET /reports': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.REPORTS);
    const q = new URL(request.url).searchParams;
    const to = q.get('to') || new Date().toISOString().slice(0, 10);
    const from = q.get('from') || new Date(Date.parse(to) - 29 * 864e5).toISOString().slice(0, 10);
    return json({
      from, to,
      practice: await reports.practice(env.DB, doctor.id, from, to),
      money: await billing.summary(env.DB, doctor.id, from, to),
      daily: await billing.dailyCollected(env.DB, doctor.id, from, to),
      topMedicines: await reports.topMedicines(env.DB, doctor.id, from, to),
      topDiagnoses: await reports.topDiagnoses(env.DB, doctor.id, from, to),
      firstVisits: await reports.firstVisits(env.DB, doctor.id, from, to)
    });
  },

  'GET /diagnostics': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.READ_NOTES);
    return json({ reports: await labReports.listForDoctor(env.DB, doctor.id) });
  },

  /* --- visits --- */

  'POST /visits': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.WRITE_NOTES);
    const visit = await body(request);
    await patients.requireOnList(env.DB, doctor.id, visit.patientId);
    if (!visit.visitedOn) throw badRequest('A visit needs a date.');
    /* Taken from the session, never from the body: who wrote a clinical
       note is not something the caller gets to state. NULL is the clinic
       owner, so a single-doctor clinic behaves exactly as before. */
    const saved = await visits.create(env.DB, doctor.id,
      { ...visit, practitionerId: doctor.actor.userId }, {
        actor: actorKey(doctor), idempotencyKey: visit.idempotencyKey
      });
    return json({ visit: saved }, 201);
  },

  /* --- prescriptions --- */

  'POST /prescriptions': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.WRITE_NOTES);
    const { patientId, visitId, items, idempotencyKey } = await body(request);
    await patients.requireOnList(env.DB, doctor.id, patientId);
    const draft = await prescriptions.createDraft(env.DB, doctor.id,
      {
        patientId, visitId, items, practitionerId: doctor.actor.userId,
        idempotencyKey, actor: actorKey(doctor)
      });
    return json({ prescription: draft }, 201);
  },

  'GET /prescriptions/:id': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.READ_NOTES);
    const prescription = await prescriptions.withItems(env.DB, doctor.id, params.id);

    /* Split HERE rather than in each renderer. Three screens draw this
       document - the prescriptions list, the desk and the patient's own
       link - and a rule about what reaches paper that is re-derived three
       times is a rule that will disagree with itself. */
    let findings = {};
    try { findings = JSON.parse(prescription.findings || '{}'); } catch (_) {}
    const split = clinicFields.splitFindings(findings,
      clinicFields.printList(doctor), await clinicFields.labels(env.DB, doctor.id));

    return json({
      prescription: {
        ...prescription,
        /* What goes on the sheet, in her order, at most six. */
        findings: split.printed,
        /* Everything else she recorded. Shown beside the prescription on
           screen, never on the paper - which is the entire point. */
        findingsOffSheet: split.recorded
      }
    });
  },

  /* Only a draft accepts this. An issued prescription refuses, because the
     patient is holding paper that has to keep matching the record. */
  'PATCH /prescriptions/:id': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.WRITE_NOTES);
    const { items, visitId } = await body(request);
    const updated = await prescriptions.replaceItems(
      env.DB, doctor.id, params.id, items || [], { visitId });
    return json({ prescription: updated });
  },

  'POST /prescriptions/:id/issue': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.WRITE_NOTES);
    const issued = await prescriptions.issue(
      env.DB, doctor.id, params.id, doctor.patient_prefix, actorKey(doctor));

    /* Follow-up creation is inside the same D1 transaction as issue. This
       read only returns the appointment that transaction committed. */
    const bookedFollowUp = await appointments.fromVisit(
      env.DB, doctor.id, issued.visit_id);
    return json({ prescription: issued, followUp: bookedFollowUp });
  },

  'POST /prescriptions/:id/amend': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.WRITE_NOTES);
    const { items, reason } = await body(request);
    const amended = await prescriptions.amend(env.DB, doctor.id, params.id, {
      items, reason, actor: actorKey(doctor)
    });
    return json({ prescription: amended }, 201);
  },

  'GET /prescriptions/:id/dispensing': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.PHARMACY);
    return json({ lines: await stock.prescribedVersusDispensed(env.DB, doctor.id, params.id) });
  },

  /* --- pharmacy --- */

  'POST /stock/batches/:id/quarantine': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.PHARMACY);
    requireFeature(doctor, 'pharmacy');
    const { reason, idempotencyKey } = await body(request);
    const result = await stock.quarantine(env.DB, doctor.id, params.id,
      reason, actorKey(doctor), idempotencyKey);
    return json(result);
  },

  'POST /stock/batches/:id/write-off': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.PHARMACY);
    requireFeature(doctor, 'pharmacy');
    const { reason, idempotencyKey } = await body(request);
    const result = await stock.writeOff(env.DB, doctor.id, params.id,
      reason, actorKey(doctor), idempotencyKey);
    return json(result);
  },

  /* --- sharing a record with the patient (doctor side) --- */

  'POST /patients/:id/share': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.READ_NOTES);
    requireFeature(doctor, 'patient_portal');
    await patients.requireOnList(env.DB, doctor.id, params.id);
    const { ttlDays } = await body(request).catch(() => ({}));
    const result = await patientView.createLink(env.DB, doctor.id, params.id, {
      ttlDays: Math.min(Math.max(Number(ttlDays) || 90, 1), 365),
      createdBy: doctor.id
    });
    await audit.write(env.DB, {
      doctorId: doctor.id, actor: actorKey(doctor), action: 'patient_link_created',
      targetType: 'patient', targetId: params.id
    });
    return json({
      token: result.token,
      expiresInDays: result.expiresInDays,
      note: 'Shown once. Only a hash is stored, so this cannot be retrieved again.'
    }, 201);
  },

  'GET /patients/:id/share': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.READ_NOTES);
    await patients.requireOnList(env.DB, doctor.id, params.id);
    return json({ links: await patientView.listLinks(env.DB, doctor.id, params.id) });
  },

  'POST /patients/:id/share/:linkId/revoke': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.READ_NOTES);
    await patientView.revokeLink(env.DB, doctor.id, params.linkId);
    await audit.write(env.DB, {
      doctorId: doctor.id, actor: actorKey(doctor), action: 'patient_link_revoked',
      targetType: 'patient', targetId: params.id
    });
    return json({ ok: true });
  },

  /* --- the patient reading their own record ---
     The ONLY unauthenticated endpoint in TCOS. The token decides everything;
     nothing selectable is read from the request. See worker/patientview.js. */

  'GET /p/:token': async (env, request, params) => {
    return json(await patientView.readRecord(env.DB, params.token));
  },

  /* A doctor edits their own practice. Only their own row - updateSelf takes
     the id from the session and filters the fields against an allow-list, so
     nothing here can reach another doctor or a column that should not move. */
  'PATCH /me': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.SETTINGS);
    const patch = await body(request);
    const fields = {};

    const text = {
      fullName: 'full_name', qualification: 'qualification',
      registrationNo: 'registration_no', clinicName: 'clinic_name',
      tagline: 'tagline', address: 'address', website: 'website',
      patientPrefix: 'patient_prefix', email: 'email'
    };
    Object.entries(text).forEach(([from, column]) => {
      if (typeof patch[from] === 'string') fields[column] = patch[from].trim() || null;
    });

    if (patch.weeklyHours && typeof patch.weeklyHours === 'object') {
      /* Sessions per day now, not one open/close pair - see migration 015.
         cleanWeek rejects overlapping sittings and a close before an open
         rather than storing a day nobody can attend. */
      fields.weekly_hours = JSON.stringify(cleanWeek(patch.weeklyHours));
    }

    if (typeof patch.certificateName === 'string' && patch.certificateName.trim()) {
      if (doctor.certificate_status && !['not_uploaded', 'not_submitted'].includes(doctor.certificate_status)) {
        throw badRequest('The certificate is already submitted. Request a replacement through TCOS support.');
      }
      fields.certificate_name = patch.certificateName.trim().slice(0, 180);
      fields.certificate_status = 'pending_review';
      fields.certificate_submitted_at = nowIso();
    }

    /* The ABDM registries: the practitioner (HPR) and the facility (HFR).
       Cleared by sending an empty string, because a doctor who typed the
       wrong id must be able to take it back out again. */
    if (typeof patch.hprId === 'string') fields.hpr_id = cleanHprId(patch.hprId);
    if (typeof patch.hfrId === 'string') fields.hfr_id = cleanHfrId(patch.hfrId);

    /* A recovery address that is not an address is worse than none: it
       looks like a way back in, right up until the code is sent nowhere. */
    if (fields.email && !isEmail(fields.email)) {
      throw badRequest('That does not look like an email address.');
    }
    if (fields.email) fields.email = fields.email.toLowerCase();

    if (!Object.keys(fields).length) throw badRequest('Nothing to update.');
    if (fields.clinic_name === null) throw badRequest('Clinic name cannot be empty.');
    if (fields.full_name === null) throw badRequest('Your name cannot be empty.');

    await doctors.updateSelf(env.DB, doctor.id, fields);
    await audit.write(env.DB, {
      doctorId: doctor.id, actor: actorKey(doctor), action: 'practice_updated',
      detail: Object.keys(fields).join(', ')
    });
    const updated = await doctors.byId(env.DB, doctor.id);
    return json({
      id: updated.id, fullName: updated.full_name, clinicName: updated.clinic_name,
      tagline: updated.tagline, qualification: updated.qualification,
      registrationNo: updated.registration_no, address: updated.address,
      website: updated.website, patientPrefix: updated.patient_prefix,
      practicePacks: JSON.parse(updated.practice_packs || '[]'),
      weeklyHours: cleanWeek(JSON.parse(updated.weekly_hours || '{}')),
      certificate: { name: updated.certificate_name,
        status: updated.certificate_status || 'not_uploaded',
        submittedAt: updated.certificate_submitted_at }
    });
  },

  /* --- lab reports --- */

  'POST /lab-reports': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.WRITE_NOTES);
    requireFeature(doctor, 'lab_reports');
    const report = await body(request);
    await patients.requireOnList(env.DB, doctor.id, report.patientId);
    if (!report.reportName) throw badRequest('Give the report a name.');
    if (!report.reportedOn) throw badRequest('A report needs the date it was taken.');
    if (!Array.isArray(report.values) || !report.values.length) {
      throw badRequest('Record at least one value.');
    }
    const saved = await labReports.create(env.DB, doctor.id, report, {
      actor: actorKey(doctor), verifiedBy: doctor.actor.name,
      practitionerId: doctor.actor.userId,
      idempotencyKey: report.idempotencyKey
    });
    return json({ report: saved }, 201);
  },

  'GET /lab-reports/:id': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.READ_NOTES);
    return json({ report: await labReports.withValues(env.DB, doctor.id, params.id) });
  },

  /* --- reading a report with AI ---------------------------------------
     Every route here is gated on the clinical capabilities, not the patient
     one. A front-desk assistant may upload the photograph; only somebody who
     can write a clinical note may turn what the model read into a record. */

  'POST /ai/preflight': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.WRITE_NOTES);

    const { fileId, patientId } = await body(request);
    if (!fileId) throw badRequest('Upload the report first.');
    if (!patientId) throw badRequest('Choose the patient before uploading the report.');
    await patients.requireOnList(env.DB, doctor.id, patientId);
    const patient = await patients.byIdForDoctor(env.DB, doctor.id, patientId);
    const expectedName = patient && patient.full_name;

    /* Checking is cheap, but it still honours the clinic's document limit so
       an exhausted account cannot use preflight as an unlimited AI route. */
    await requireQuota(env.DB, doctor, 'ai_documents', 1);
    const { meta, object } = await files.open(env.DB, env, doctor.id, fileId);
    const bytes = await object.arrayBuffer();

    /* The spend guard, before a single token is bought. The plan allowance
       counts DOCUMENTS; this counts MONEY, and the two come apart exactly
       when something is wrong - a hundred retries of one document is a
       hundred documents to the allowance and a hundred bills to us.

       File size stands in for cost because it is the one thing known before
       the call: bytes drive image tokens, and a 300-page PDF is the case no
       rolling window can catch, since the damage happens inside one call. */
    const estimate = aiops.estimatePaise(meta.bytes, meta.content_type);
    const verdict = await aiops.check(env.DB, doctor.id, estimate);

    if (!verdict.allowed) {
      /* Parked, never dropped. Being told "not now" is survivable for a
         clinic; losing a lab report is not, and a billing guard that damages
         the clinic has protected the wrong thing. */
      if (verdict.park) {
        await aiops.park(env.DB, doctor.id, { patientId, fileId, kind: 'preflight' });
        await aiops.record(env.DB, doctor.id,
          { kind: 'preflight', outcome: 'blocked', detail: verdict.reason });

        /* Told once, not on every blocked call - an alert that repeats forty
           times an hour is an alert people learn to ignore. */
        if (verdict.justTripped || !verdict.alreadyNotified) {
          await aiops.alert(env.DB, doctor.id, {
            scope: verdict.scope || 'platform', reason: verdict.reason
          }).catch(() => {});
          if (verdict.scope) await aiops.markNotified(env.DB, verdict.scope).catch(() => {});
        }
      }
      await audit.write(env.DB, {
        doctorId: doctor.id, actor: actorKey(doctor),
        action: 'ai_spend_blocked', detail: verdict.reason
      });
      throw stopped(verdict.message);
    }

    const startedAt = Date.now();
    let result;
    try {
      result = await ai.preflight(env, {
        contentType: meta.content_type, bytes,
        filename: meta.original_name, expectedName
      });
    } catch (error) {
      /* A failed call still burned tokens. Recording only successes
         under-reports precisely when things are going wrong, and a rising
         failure rate is the earliest warning there is - failures cost money
         and produce nothing. */
      await aiops.record(env.DB, doctor.id, {
        kind: 'preflight', outcome: error.code === 'ai_declined' ? 'refused' : 'failed',
        detail: error.message, durationMs: Date.now() - startedAt
      }).catch(() => {});
      throw error;
    }

    const costPaise = ai.costPaise(result.usage, env.AI_USD_INR);
    await aiops.record(env.DB, doctor.id, {
      kind: 'preflight', model: result.usage.model, usage: result.usage,
      costPaise, outcome: 'ok', durationMs: Date.now() - startedAt
    });

    const preflight = await preflights.create(env.DB, doctor.id, {
      patientId, fileId, result, usage: result.usage, costPaise
    });

    await audit.write(env.DB, {
      doctorId: doctor.id, actor: actorKey(doctor),
      action: 'ai_document_preflight', targetType: 'ai_preflight',
      targetId: preflight.id,
      detail: preflight.nameVerdict + ': ' + (preflight.nameOnDocument || 'no name')
    });
    return json({ preflight }, 201);
  },

  'POST /ai/preflights/:id/approve': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.WRITE_NOTES);
    const details = await body(request);
    const preflight = await preflights.approve(env.DB, doctor, params.id, details.note);
    await audit.write(env.DB, {
      doctorId: doctor.id, actor: actorKey(doctor),
      action: 'ai_identity_override', targetType: 'ai_preflight',
      targetId: preflight.id,
      detail: preflight.nameVerdict + ': ' + (details.note || 'confirmed by clinician')
    });
    return json({ preflight });
  },

  'POST /ai/preflights/:id/reject': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.WRITE_NOTES);
    const details = await body(request);
    const preflight = await preflights.reject(env.DB, doctor, params.id, details.note);
    await audit.write(env.DB, {
      doctorId: doctor.id, actor: actorKey(doctor),
      action: 'ai_wrong_document_stopped', targetType: 'ai_preflight',
      targetId: preflight.id, detail: details.note || preflight.nameReason
    });
    return json({ preflight });
  },

  'POST /ai/read-report': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.WRITE_NOTES);

    const { preflightId, urgent } = await body(request);
    if (!preflightId) throw badRequest('Check the patient name before reading the report.');
    const checked = await preflights.byId(env.DB, doctor.id, preflightId);
    if (checked.status !== 'approved') {
      throw badRequest('Confirm that this document belongs to the patient before reading it.');
    }
    if (checked.consumedAt) throw badRequest('That document has already been read.');
    await requireQuota(env.DB, doctor, 'ai_documents', 1);

    const { meta, object } = await files.open(env.DB, env, doctor.id, checked.fileId);
    const bytes = await object.arrayBuffer();

    /* Overnight unless she says otherwise. Batch costs exactly half for the
       same model and the same answer, and the instant route is not instant
       anyway - the first real read took 294 seconds. Nobody watches that.

       So the default is the cheap one, and "now" is the exception somebody
       has to ask for. Defaulting the other way would have every clinic
       paying double for a wait they were going to have regardless. */
    if (!urgent) {
      const submitted = await batch.submit(env, {
        customId: 'rx_' + checked.id,
        options: ai.extractionRequest({
          expectedName: checked.registeredName,
          clinicalPages: checked.clinicalPages,
          contentType: meta.content_type, bytes, filename: meta.original_name
        })
      });
      const queueId = await aiops.queueBatch(env.DB, doctor.id, {
        patientId: checked.patientId, fileId: checked.fileId, preflightId: checked.id,
        batchId: submitted.batchId, providerStatus: submitted.status,
        providerInputFileId: submitted.inputFileId, urgency: 'normal'
      });
      await audit.write(env.DB, {
        doctorId: doctor.id, actor: actorKey(doctor),
        action: 'ai_report_queued', targetType: 'ai_queue', targetId: queueId,
        detail: 'batch ' + submitted.batchId
      });
      return json({
        queued: true, id: queueId,
        message: 'Sent for reading. It usually comes back within a few hours and ' +
                 'will be waiting on the Readings screen — you do not need to keep ' +
                 'this open. Choose "read it now" if you need it during this visit.'
      }, 202);
    }

    const result = await ai.readReport(env, {
      contentType: meta.content_type, bytes, filename: meta.original_name,
      expectedName: checked.registeredName, clinicalPages: checked.clinicalPages
    });
    const costPaise = ai.costPaise(result.usage, env.AI_USD_INR);

    const draft = await drafts.create(env.DB, doctor.id, {
      patientId: checked.patientId, fileId: checked.fileId, kind: 'lab_report',
      result, usage: result.usage, costPaise
    });
    await preflights.consume(env.DB, doctor.id, checked.id);

    await usage.record(env.DB, doctor.id, { eventType: 'ai_document_read' });
    await audit.write(env.DB, {
      doctorId: doctor.id, actor: actorKey(doctor), action: 'ai_report_read',
      targetType: 'ai_draft', targetId: draft.id,
      detail: draft.legible ? draft.values.length + ' values' : 'not legible'
    });

    return json({ draft }, 201);
  },

  /* Collects anything the overnight queue has finished, and turns it into a
     draft waiting for her.

     Polled from the Readings screen rather than run by a scheduled job:
     there is no cron in this worker, and the person who cares whether a
     reading has arrived is the one looking at the screen. A background job
     would also mean a doctor learning her report was ready from a database
     row nobody rendered. */
  'GET /ai/queue': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.READ_NOTES);

    /* Retry provider cleanup independently of clinical processing. A partial
       DELETE (for example input removed, output timed out) is safe to retry:
       OpenAI's 404 means that file is already gone. */
    for (const old of await aiops.providerCleanupPending(env.DB, doctor.id)) {
      await cleanBatchProviderFiles(env, doctor.id, old.id, [
        old.provider_input_file_id, old.provider_output_file_id,
        old.provider_error_file_id
      ]);
    }

    const pending = await aiops.pendingBatches(env.DB, doctor.id);
    const still = [];
    let collected = 0;

    for (const item of pending) {
      let outcome;
      try { outcome = await batch.collect(env, item.batch_id); }
      catch (_) { still.push(item); continue; }   /* provider hiccup - try again next time */

      if (!outcome.done) {
        if (outcome.status && outcome.status !== item.provider_status) {
          await aiops.noteBatchStatus(env.DB, doctor.id, item.id,
            outcome.provider || outcome.status);
        }
        still.push({ ...item, provider_status: outcome.status || item.provider_status });
        continue;
      }

      /* Save every provider file id before changing the queue state. If the
         Worker stops between these writes, the cleanup retry still knows
         exactly which objects must be deleted. */
      await aiops.noteBatchStatus(env.DB, doctor.id, item.id,
        outcome.provider || { status: item.provider_status });

      if (outcome.failed) {
        await aiops.settleQueued(env.DB, doctor.id, item.id,
          { status: 'abandoned', error: outcome.reason });
        await aiops.record(env.DB, doctor.id,
          { kind: 'extraction', outcome: 'failed', detail: outcome.reason });
        await cleanBatchProviderFiles(env, doctor.id, item.id, [
          outcome.provider && outcome.provider.inputFileId,
          outcome.provider && outcome.provider.outputFileId,
          outcome.provider && outcome.provider.errorFileId,
          item.provider_input_file_id
        ]);
        continue;
      }

      /* Billed at the batch rate, so the Money screen and the spend guard
         both see what was actually charged rather than list price. */
      const costPaise = ai.costPaise(outcome.usage, env.AI_USD_INR, true);
      await aiops.record(env.DB, doctor.id, {
        kind: 'extraction', model: outcome.usage.model, usage: outcome.usage,
        costPaise, outcome: 'ok', batched: true
      });

      const draft = await drafts.create(env.DB, doctor.id, {
        patientId: item.patient_id, fileId: item.file_id, kind: 'lab_report',
        result: { draft: ai.withCompleteness(outcome.data) },
        usage: outcome.usage, costPaise
      });
      await aiops.finishQueued(env.DB, doctor.id, item.id, { draftId: draft.id });
      if (item.preflight_id) {
        await preflights.consume(env.DB, doctor.id, item.preflight_id).catch(() => {});
      }
      await cleanBatchProviderFiles(env, doctor.id, item.id, [
        outcome.provider && outcome.provider.inputFileId,
        outcome.provider && outcome.provider.outputFileId,
        outcome.provider && outcome.provider.errorFileId,
        item.provider_input_file_id
      ]);
      collected++;
    }

    return json({
      arrived: collected,
      waiting: still.map(i => ({
        id: i.id, patientId: i.patient_id, since: i.created_at,
        status: i.provider_status || 'queued'
      }))
    });
  },

  'GET /ai/drafts': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.READ_NOTES);
    const url = new URL(request.url);
    return json({
      drafts: await drafts.list(env.DB, doctor.id, {
        status: url.searchParams.get('status') || 'pending',
        patientId: url.searchParams.get('patientId') || null
      }),
      pending: await drafts.pendingCount(env.DB, doctor.id)
    });
  },

  'GET /ai/drafts/:id': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.READ_NOTES);
    return json({ draft: await drafts.byId(env.DB, doctor.id, params.id) });
  },

  /* Confirming is what creates the clinical record. The values sent back are
     the ones SHE has, after any correction - the draft is never copied
     across on trust, which is the entire point of the two-table design. */
  'POST /ai/drafts/:id/confirm': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.WRITE_NOTES);

    const draft = await drafts.byId(env.DB, doctor.id, params.id);
    if (!draft.legible) {
      throw badRequest('This page could not be read. Upload a clearer photograph instead.');
    }

    const edited = await body(request);
    const patientId = edited.patientId || draft.patientId;
    if (!patientId) throw badRequest('Choose which patient this report belongs to.');
    await patients.requireOnList(env.DB, doctor.id, patientId);

    const report = {
      patientId,
      reportName: (edited.reportName || draft.reportName || '').trim(),
      reportedOn: edited.reportedOn || draft.reportedOn,
      labName: edited.labName || draft.labName,
      values: Array.isArray(edited.values) ? edited.values : draft.values
    };
    if (!report.reportName) throw badRequest('Give the report a name.');
    if (!report.reportedOn) throw badRequest('A report needs the date it was taken.');
    if (!report.values.length) throw badRequest('Record at least one value.');

    const saved = await labReports.confirmDraft(env.DB, doctor.id, params.id, report, {
      reviewedBy: actorKey(doctor),
      verifiedBy: doctor.actor.name,
      practitionerId: doctor.actor.userId
    });
    return json({ report: saved }, 201);
  },

  'POST /ai/drafts/:id/reject': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.WRITE_NOTES);
    const { reason } = await body(request);
    const rejected = await drafts.reject(env.DB, doctor.id, params.id, {
      reason,
      reviewedBy: actorKey(doctor)
    });
    await audit.write(env.DB, {
      doctorId: doctor.id, actor: actorKey(doctor), action: 'ai_draft_rejected',
      targetType: 'ai_draft', targetId: params.id, detail: reason || ''
    });
    return json({ draft: rejected });
  },

  'POST /lab-reports/:id/verify': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.WRITE_NOTES);
    requireFeature(doctor, 'lab_reports');
    const verified = await labReports.verify(env.DB, doctor.id, params.id, doctor.actor.name);
    await audit.write(env.DB, {
      doctorId: doctor.id, actor: actorKey(doctor), action: 'lab_report_verified',
      targetType: 'lab_report', targetId: params.id
    });
    return json({ report: verified });
  },

  /* --- the patient uploading a report from her own phone --- */

  /* The clinic shows this as a QR. Gated on PATIENTS rather than
     WRITE_NOTES: the front desk is exactly who does this, and it adds a
     file to a record rather than writing anything clinical. */
  'POST /patients/:id/upload-link': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.PATIENTS);
    await patients.requireOnList(env.DB, doctor.id, params.id);

    const link = await patientView.createUploadLink(env.DB, doctor.id, params.id,
      { createdBy: actorKey(doctor) });
    await audit.write(env.DB, {
      doctorId: doctor.id, actor: actorKey(doctor), action: 'upload_link_created',
      targetType: 'patient', targetId: params.id
    });
    return json({
      ...link,
      url: appOrigin(env) + '/u.html#' + link.token
    }, 201);
  },

  /* UNAUTHENTICATED, like GET /p/:token, and held to the same rules: the
     token decides everything, nothing is read from the request, and the
     answer says as little as it can. A first name and a clinic name, so
     whoever is holding the phone can tell they are in the right place. */
  'GET /u/:token': async (env, request, params) => {
    const link = await patientView.resolveUploadLink(env.DB, params.token);
    return json({
      patientFirstName: link.patientFirstName,
      clinicName: link.clinicName,
      remaining: link.remaining
    });
  },

  /* The one place in TCOS where an unauthenticated caller writes anything.
     So: the token names the patient, the size and type are capped, and the
     file lands as an attachment nobody has confirmed - the same standing
     rule as an AI draft. Nothing a patient sends enters the clinical record
     until a clinician says so. */
  'POST /u/:token/file': async (env, request, params) => {
    const link = await patientView.resolveUploadLink(env.DB, params.token);

    await enforceSourceRateLimit(env, 'PUBLIC_RATE_LIMITER', request, {
      scope: 'patient_upload',
      message: 'Several files were sent from this connection. Wait a minute and try again.'
    });

    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') {
      throw badRequest('No file was attached.');
    }

    /* A phone photograph of a report page. Bigger than this is not a
       report, and a cap here is what stops one link filling the bucket. */
    const MAX_BYTES = 12 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      throw badRequest('That file is larger than 12 MB. Photograph one page at a time.');
    }
    const type = String(file.type || '').toLowerCase();
    if (!/^image\/(jpeg|png|heic|heif|webp)$/.test(type) && type !== 'application/pdf') {
      throw badRequest('Send a photo or a PDF.');
    }

    /* files.put wants a doctor because every file is keyed under one. The
       token already decided which clinic this belongs to, so the id comes
       from there and from nowhere in the request - the same rule the read
       path lives by. */
    const saved = await files.put(env.DB, env, { id: link.doctorId }, {
      kind: 'lab',
      name: file.name || 'report',
      contentType: type,
      body: file.stream(),
      bytes: file.size,
      patientId: link.patientId,
      /* Recorded as coming from the patient, not from a member of staff.
         When a clinician later confirms these values she should be able to
         see who put the page there. */
      uploadedBy: 'patient:upload-link'
    });
    await patientView.countUpload(env.DB, link.linkId);
    await audit.write(env.DB, {
      doctorId: link.doctorId, actor: 'patient:upload-link',
      action: 'patient_uploaded_file', targetType: 'patient', targetId: link.patientId
    });
    return json({ ok: true, remaining: link.remaining - 1, fileId: saved && saved.id }, 201);
  },

  /* --- the diet, lifestyle and exercise plan --- */

  /* Read the plan for one consultation. Falls back to the patient's most
     recent plan when this visit has none, because a doctor writing today's
     advice almost always starts from what she said last time rather than
     from a blank sheet - and retyping it is how it stops being written. */
  'GET /visits/:id/care-plan': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.READ_NOTES);
    const visit = await visits.byId(env.DB, doctor.id, params.id);
    if (!visit) throw notFound('No such visit.');
    const plan = await carePlans.forVisit(env.DB, doctor.id, params.id);
    return json({
      plan,
      /* Marked, so the desk can offer it rather than silently presenting
         last month's advice as though it were today's. */
      previous: plan ? null : await carePlans.latestForPatient(env.DB, doctor.id, visit.patient_id)
    });
  },

  'PUT /visits/:id/care-plan': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.WRITE_NOTES);
    const visit = await visits.byId(env.DB, doctor.id, params.id);
    if (!visit) throw notFound('No such visit.');

    const plan = await body(request);
    /* A plan is short advice, not an essay. The cap is here rather than in
       the browser because the browser is not where rules live. */
    for (const key of ['meals', 'prefer', 'avoid', 'routine', 'exercises', 'precautions']) {
      const list = plan[key];
      if (list != null && (!Array.isArray(list) || list.length > 40)) {
        throw badRequest('Keep each part of the plan to 40 lines or fewer.');
      }
    }

    const saved = await carePlans.save(
      env.DB, doctor.id, visit.patient_id, params.id, plan);
    await audit.write(env.DB, {
      doctorId: doctor.id, actor: actorKey(doctor), action: 'care_plan_saved',
      targetType: 'visit', targetId: params.id
    });
    return json({ plan: saved });
  },

  'GET /patients/:id/lab-series': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.READ_NOTES);
    await patients.requireOnList(env.DB, doctor.id, params.id);
    return json({ series: await labReports.series(env.DB, doctor.id, params.id) });
  },

  /* --- appointments --- */

  'GET /appointments': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.APPOINTMENTS);
    const params = new URL(request.url).searchParams;
    const day = params.get('day') || new Date().toISOString().slice(0, 10);
    return json({
      day,
      requests: await publicPage.listRequests(env.DB, doctor.id, 'new'),
      today: await appointments.forDay(env.DB, doctor.id, day),
      upcoming: await appointments.upcoming(env.DB, doctor.id, day, 14),
      unresolved: await appointments.unresolved(env.DB, doctor.id, day),
      /* Six days behind and today, which is the week she is actually in. */
      week: await appointments.dailyCounts(env.DB, doctor.id,
        new Date(Date.parse(day) - 6 * 864e5).toISOString().slice(0, 10), day)
    });
  },

  'POST /appointments': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.APPOINTMENTS);
    const appointment = await body(request);
    await patients.requireOnList(env.DB, doctor.id, appointment.patientId);
    if (!appointment.scheduledOn) throw badRequest('Pick a date.');
    const saved = await appointments.create(env.DB, doctor.id, appointment);
    await usage.record(env.DB, doctor.id, { eventType: 'appointment_booked' });
    await audit.write(env.DB, {
      doctorId: doctor.id, actor: actorKey(doctor), action: 'appointment_booked',
      targetType: 'appointment', targetId: saved.id
    });
    return json({ appointment: saved }, 201);
  },

  'POST /appointments/:id/status': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.APPOINTMENTS);
    const { status, reason } = await body(request);
    const updated = await appointments.setStatus(env.DB, doctor.id, params.id, status, reason);
    return json({ appointment: updated });
  },

  'POST /appointments/:id/reschedule': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.APPOINTMENTS);
    const { scheduledOn, scheduledAt } = await body(request);
    const updated = await appointments.reschedule(env.DB, doctor.id, params.id,
      { scheduledOn, scheduledAt });
    await audit.write(env.DB, {
      doctorId: doctor.id, actor: actorKey(doctor), action: 'appointment_rescheduled',
      targetType: 'appointment', targetId: params.id, detail: scheduledOn
    });
    return json({ appointment: updated });
  },

  'GET /patients/:id/appointments': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.APPOINTMENTS);
    await patients.requireOnList(env.DB, doctor.id, params.id);
    return json({ appointments: await appointments.forPatient(env.DB, doctor.id, params.id) });
  },

  /* --- the doctor's public page (unauthenticated read) --- */

  'GET /clinic/:slug': async (env, request, params) => {
    return json(await publicPage.profileBySlug(env.DB, params.slug));
  },

  /* The only thing a stranger may write anywhere in TCOS. It creates a
     REQUEST, never an appointment - the doctor accepts it first. */
  'POST /clinic/:slug/request': async (env, request, params) => {
    const details = await body(request);
    await enforceRateLimit(env, 'PUBLIC_RATE_LIMITER', {
      scope: 'appointment_request:' + params.slug,
      subject: normaliseMobile(details.mobile) || details.mobile,
      message: 'Several appointment requests were sent from this number. Wait a minute and try again.'
    });
    await enforceSourceRateLimit(env, 'PUBLIC_RATE_LIMITER', request, {
      scope: 'appointment_request:' + params.slug,
      message: 'Several appointment requests were sent from this connection. Wait a minute and try again.'
    });
    return json(await publicPage.requestAppointment(env.DB, params.slug, details), 201);
  },

  /* --- the doctor managing their page and its requests --- */

  'GET /me/public-page': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.SETTINGS);
    return json({
      slug: doctor.public_slug,
      published: !!doctor.public_page_on,
      intro: doctor.public_intro,
      hours: doctor.public_hours,
      customDomain: doctor.custom_domain,
      suggestedSlug: publicPage.slugify(doctor.clinic_name)
    });
  },

  /* --- files: lab reports, certificates, logos ---

     Multipart, because that is what a file input sends. Everything about
     the stored object is decided here from ids we generated - the key never
     contains anything the caller typed. */
  'POST /files': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.PATIENTS);

    let form;
    try { form = await request.formData(); }
    catch (_) { throw badRequest('Send the file as multipart form data.'); }

    const file = form.get('file');
    if (!file || typeof file === 'string') throw badRequest('Choose a file.');

    const kind = String(form.get('kind') || 'attachment');
    /* A certificate is about the doctor herself, so it needs the settings
       capability rather than the patient one. */
    if (kind === 'certificate' || kind === 'logo') gate(doctor, CAN.SETTINGS);

    const patientId = form.get('patientId') || null;
    if (patientId) await patients.requireOnList(env.DB, doctor.id, patientId);

    /* Storage is a soft limit with a reserve, like the other consumption
       limits: refusing to attach a lab report to a chart mid-consultation
       is the behaviour this whole model exists to avoid. */
    await requireQuota(env.DB, doctor, 'storage_mb', Math.ceil(file.size / (1024 * 1024)));

    const saved = await files.put(env.DB, env, doctor, {
      kind, name: file.name, contentType: file.type,
      body: file.stream(), bytes: file.size,
      patientId, labReportId: form.get('labReportId') || null,
      uploadedBy: actorKey(doctor)
    });

    /* A certificate is the one upload that changes the doctor's own record:
       it puts her into the verification queue with something a human can
       actually open. Before this, certificate_name held a filename with no
       document behind it, so the platform could mark a registration
       "verified" having never seen it. */
    await files.attachToDoctor(env.DB, doctor.id, kind, saved);

    await usage.record(env.DB, doctor.id, {
      eventType: 'file_stored', quantity: file.size, unit: 'bytes'
    });
    await audit.write(env.DB, {
      doctorId: doctor.id, actor: actorKey(doctor), action: 'file_uploaded',
      targetType: 'file', targetId: saved.id, detail: kind
    });
    return json({ file: saved }, 201);
  },

  'GET /files': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.PATIENTS);
    const url = new URL(request.url);
    return json({
      files: await files.listFor(env.DB, doctor.id, {
        patientId: url.searchParams.get('patientId'),
        kind: url.searchParams.get('kind')
      })
    });
  },

  /* The bytes themselves. Served through here rather than from a public R2
     URL, which is the only reason the scoping above means anything. */
  'GET /files/:id': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.PATIENTS);
    const { meta, object } = await files.open(env.DB, env, doctor.id, params.id);
    const download = new URL(request.url).searchParams.get('download') === '1';
    await audit.write(env.DB, {
      doctorId: doctor.id, actor: actorKey(doctor), action: 'file_opened',
      targetType: 'file', targetId: params.id
    });
    return new Response(object.body, { headers: fileHeaders(meta, { download }) });
  },

  'DELETE /files/:id': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.SETTINGS);
    const { reason } = await body(request);
    const result = await files.remove(env.DB, env, doctor, params.id, {
      reason, by: actorKey(doctor)
    });
    await audit.write(env.DB, {
      doctorId: doctor.id, actor: actorKey(doctor), action: 'file_removed',
      targetType: 'file', targetId: params.id, detail: reason
    });
    return json(result);
  },

  /* --- when the clinic is open --- */

  'GET /me/closures': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.SETTINGS);
    return json({ closures: await closures.list(env.DB, doctor.id) });
  },

  /* "I am away on the 14th." Deliberately not a change to the weekly
     pattern: an exception expires by itself, an edited pattern does not,
     and a doctor who has to remember to reopen Thursday will not. */
  'POST /me/closures': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.SETTINGS);
    const details = await body(request);
    const closure = await closures.add(env.DB, doctor.id, details);
    await audit.write(env.DB, {
      doctorId: doctor.id, actor: actorKey(doctor), action: 'clinic_closed',
      detail: closure.starts_on + ' to ' + closure.ends_on + (closure.reason ? ' - ' + closure.reason : '')
    });
    return json({ closure }, 201);
  },

  'DELETE /me/closures/:id': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.SETTINGS);
    return json(await closures.remove(env.DB, doctor.id, params.id));
  },

  /* --- her own web address --- */

  'GET /me/domain': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.SETTINGS);
    /* The records are read back from the row rather than rebuilt, because
       Cloudflare's ownership and certificate challenges are per-domain values
       we cannot regenerate - and she is copying them into another tab. */
    let proofs = [];
    try { proofs = JSON.parse(doctor.custom_domain_records || '[]'); } catch (_) { proofs = []; }

    return json({
      freeAddress: freeHost(env, doctor.public_slug),
      customDomain: doctor.custom_domain,
      status: doctor.custom_domain_status || 'none',
      sslStatus: doctor.custom_domain_ssl_status || null,
      error: doctor.custom_domain_error,
      checkedAt: doctor.custom_domain_checked_at,
      activeAt: doctor.custom_domain_active_at,
      /* So the screen can say "not available yet" in place of instructions,
         instead of showing her a form that will fail on submit. */
      available: customHostname.configured(env),
      /* Whether THIS clinic is allowed to use one. Separate from `available`
         on purpose: available says the platform can do it at all, allowed
         says this doctor has the paid add-on switched on. The screen needs
         both to say the right thing - "not ready yet" and "ask us to switch
         it on" are different sentences and only one of them is true. */
      allowed: hasFeature(doctor, 'custom_domain'),
      addonPaise: ADDONS.custom_domain.pricePaise,
      /* The same sentence she gets after pressing Check now, from the same
         function - so opening the screen and refreshing it never disagree. */
      ...(doctor.custom_domain
        ? customHostname.explain(doctor.custom_domain_status, doctor.custom_domain_error)
        : {}),
      records: doctor.custom_domain ? dnsRecords(env, doctor.custom_domain, proofs) : []
    });
  },

  'POST /me/domain': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.SETTINGS);
    /* Her domain carries her registration number in front of patients. */
    requireVerified(doctor, 'connect your own domain');
    /* And the paid add-on: THIS is the route that spends money. Cloudflare
       bills per custom hostname from creation. See entitlements.js. */
    requireFeature(doctor, 'custom_domain');
    const { domain } = await body(request);
    /* Registers the hostname with Cloudflare and comes back with the records
       Cloudflare generated for HER domain. */
    const claimed = await domains.claim(env.DB, env, doctor.id, domain);
    await audit.write(env.DB, {
      doctorId: doctor.id, actor: actorKey(doctor),
      action: 'domain_claimed', detail: claimed.domain
    });
    return json(claimed, 201);
  },

  'POST /me/domain/check': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.SETTINGS);
    if (!doctor.custom_domain) throw badRequest('Add your domain first.');
    const result = await domains.check(
      env.DB, env, doctor.id, doctor.custom_domain, doctor);
    return json({ domain: doctor.custom_domain, ...result });
  },

  'DELETE /me/domain': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.SETTINGS);
    await domains.release(env.DB, env, doctor.id, doctor);
    await audit.write(env.DB, {
      doctorId: doctor.id, actor: actorKey(doctor), action: 'domain_released',
      detail: doctor.custom_domain || null
    });
    return json({ freeAddress: freeHost(env, doctor.public_slug) });
  },

  'POST /me/public-page': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.SETTINGS);
    const { slug, published, intro, hours } = await body(request);
    const finalSlug = slug
      ? await publicPage.claimSlug(env.DB, doctor.id, slug)
      : doctor.public_slug;

    if (published && !finalSlug) {
      throw badRequest('Choose a web address before publishing your page.');
    }
    /* The page sits on a TCOS address and carries her qualification and
       registration number. A patient who finds it is trusting our domain,
       not her waiting room, so we have to have checked her first. Editing
       and previewing stay open - only going public needs this. */
    if (published) {
      requireVerified(doctor, 'publish a public page for your clinic');
    }
    await publicPage.setPageDetails(env.DB, doctor.id, { intro, hours });
    if (typeof published === 'boolean') {
      await publicPage.setPublished(env.DB, doctor.id, published);
    }
    await audit.write(env.DB, {
      doctorId: doctor.id, actor: actorKey(doctor), action: 'public_page_updated',
      detail: (published ? 'published' : 'hidden') + (finalSlug ? ' /' + finalSlug : '')
    });
    const updated = await doctors.byId(env.DB, doctor.id);
    return json({
      slug: updated.public_slug, published: !!updated.public_page_on,
      intro: updated.public_intro, hours: updated.public_hours
    });
  },

  'GET /requests': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.APPOINTMENTS);
    return json({
      requests: await publicPage.listRequests(env.DB, doctor.id, 'new'),
      count: await publicPage.countNewRequests(env.DB, doctor.id),
      /* Where her bookings came from, so Practo and Justdial can be judged
         on what they actually deliver rather than on their invoice. */
      sources: await leads.summary(env.DB, doctor.id, 30)
    });
  },

  /* --- her own examination fields ------------------------------------
     What a doctor examines is hers. The practice packs are our guess at it
     and they are a good guess, but a real Ayurvedic examination has Naabhi
     and ANG in it and neither is in any pack we wrote. See
     worker/clinicfields.js for why the cap sits on what PRINTS and not on
     what she is allowed to record. */

  'GET /me/fields': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    /* Read-gated on notes, not settings: this is the shape of the
       examination form, and everyone who opens a consultation needs it. */
    gate(doctor, CAN.READ_NOTES);
    return json({
      fields: await clinicFields.list(env.DB, doctor.id),
      printFields: clinicFields.printList(doctor),
      max: PRINT_MAX
    });
  },

  /* WRITE_NOTES, not SETTINGS. She realises she needs the field while a
     patient is in front of her, and sending her to a settings screen to add
     it is how an observation ends up on the back of a file instead. */
  'POST /me/fields': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.WRITE_NOTES);
    const { label } = await body(request);
    const field = await clinicFields.add(env.DB, doctor.id, label);
    return json({ field }, 201);
  },

  /* Removing one changes the form for the whole clinic and can cost a print
     slot, so this is the owner's decision rather than a mid-consultation
     one. Nothing recorded under it is touched - see the module. */
  'DELETE /me/fields/:id': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.SETTINGS);
    return json(await clinicFields.archive(env.DB, doctor.id, params.id));
  },

  /* Set once, used every prescription after it. Vijay: "setting the
     prescription once and use it everytime means they make chagnes to their
     prescripton and save it and everytime same format comes in." */
  'PUT /me/rx-layout': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.SETTINGS);
    const { fields } = await body(request);
    const saved = await clinicFields.setPrintList(env.DB, doctor.id, fields);
    await audit.write(env.DB, { doctorId: doctor.id, actor: actorKey(doctor),
      action: 'rx_layout_set', detail: String(saved.fields.length) + ' fields' });
    return json(saved);
  },

  /* --- bookings from other platforms ---------------------------------
     One authenticated URL per clinic. Anything that can POST to it lands in
     the same inbox as her own page: Practo forwarded through an automation,
     a Justdial webhook, her own site, the front desk. */

  'GET /me/leads': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.SETTINGS);
    return json({
      /* The secret is shown because she has to paste it into another
         company's settings screen. It is per clinic and revocable. */
      webhookUrl: doctor.lead_webhook_secret
        ? new URL(request.url).origin + '/leads/inbound?key=' + doctor.lead_webhook_secret
        : null,
      sources: await leads.summary(env.DB, doctor.id, 90),
      known: leads.SOURCES
    });
  },

  'POST /me/leads/secret': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.SETTINGS);
    /* Bookings arriving from outside her own page are a paid capability -
       the same one that covers booking from her website, because that is
       what this is: a booking she did not take at the desk. Free stays as
       the diary and the records. */
    requireFeature(doctor, 'website_connect');
    const secret = await leads.issueSecret(env.DB, doctor.id);
    await audit.write(env.DB, { doctorId: doctor.id, actor: actorKey(doctor),
      action: 'lead_webhook_issued' });
    /* Derived from the request rather than configured: it is by definition
       the host her lead platform will be POSTing to. */
    return json({ webhookUrl: new URL(request.url).origin + '/leads/inbound?key=' + secret });
  },

  'DELETE /me/leads/secret': async (env, request) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.SETTINGS);
    await leads.revokeSecret(env.DB, doctor.id);
    await audit.write(env.DB, { doctorId: doctor.id, actor: actorKey(doctor),
      action: 'lead_webhook_revoked' });
    return json({ webhookUrl: null });
  },

  /* PUBLIC. The clinic is identified by the secret alone - there is no
     doctor id in the URL to guess at, so enumeration gets nowhere. */
  'POST /leads/inbound': async (env, request) => {
    const url = new URL(request.url);
    const secret = url.searchParams.get('key') ||
      request.headers.get('X-Lead-Key') || '';

    await enforceSourceRateLimit(env, 'PUBLIC_RATE_LIMITER', request, {
      scope: 'lead_inbound',
      message: 'Too many bookings from this connection. Wait a minute.'
    });

    const clinic = await leads.clinicFor(env.DB, secret);
    /* 401 and nothing else. Saying "no such clinic" would turn this into a
       way to test whether a secret is live. */
    if (!clinic) throw new ApiError(401, 'unauthorised', 'That key is not valid.');

    /* Checked on every booking, not only when the URL is issued. A clinic
       that drops to Free would otherwise keep a working webhook for as long
       as nobody noticed. Worded for whoever reads the far end's delivery
       log, because no doctor is watching this request. */
    if (!hasFeature(clinic, 'website_connect')) {
      throw new ApiError(402, 'plan_feature',
        'This clinic\'s plan no longer includes bookings from other platforms. ' +
        'Nothing was lost — ask the clinic to move up a plan and resend.');
    }

    const lead = leads.normalise(await body(request),
      url.searchParams.get('source'));
    const result = await leads.accept(env.DB, clinic.id, lead);

    /* A retry is a no-op and says so, rather than a second person in the
       diary at the same time. */
    if (result.duplicate) {
      return json({ status: 'already_received', id: result.id });
    }
    await audit.write(env.DB, { doctorId: clinic.id, actor: 'lead:' + lead.source,
      action: 'lead_received', targetType: 'request', targetId: result.id,
      detail: lead.source });
    return json({ status: 'received', id: result.id }, 201);
  },

  /* Accepting turns a stranger into a patient and books the appointment in
     one step, because that is one decision for the doctor even though it is
     three rows. */
  'POST /requests/:id/accept': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.APPOINTMENTS);
    const { scheduledOn, scheduledAt, existingPatientId } = await body(request);
    const req = await publicPage.requestById(env.DB, doctor.id, params.id);
    /* A response lost after the database commit is still success. Return the
       appointment already created rather than making the desk wonder if it
       needs to book the patient again. */
    if (req.status === 'accepted' && req.patient_id && req.appointment_id) {
      return json({
        patient: await patients.byId(env.DB, req.patient_id),
        appointment: await appointments.byId(env.DB, doctor.id, req.appointment_id),
        repeated: true
      });
    }
    if (req.status !== 'new') throw badRequest('That request has already been handled.');

    const registrationKey = 'request-accept:' + params.id;
    let patient = await patients.registrationByKey(
      env.DB, doctor.id, registrationKey);
    let selectedPatient = null;
    if (!patient && existingPatientId) {
      selectedPatient = await patients.byId(env.DB, existingPatientId);
      if (!selectedPatient) throw badRequest('That patient no longer exists.');
      /* The ID arrives from the browser, and patient records are SHARED
         across clinics - so an ID that merely exists is not evidence of
         anything. Without this check, a member of staff who obtains or
         guesses another clinic's patient ID could attach that stranger's
         whole shared identity to this appointment, and from then on the
         clinic holds a record belonging to someone who never came.
       *
         The rule is the one POST /patients already uses: the person must be
         reachable on the number the request was actually submitted from.
         Both sides are normalised because req.mobile is stored normalised
         but older rows predate that. */
      if (normaliseMobile(selectedPatient.mobile) !== normaliseMobile(req.mobile)) {
        throw badRequest('That person is not on the number this request came from.');
      }
    } else if (!patient) {
      const household = await patients.householdOn(env.DB, req.mobile);
      selectedPatient = household.find(x =>
        x.full_name.trim().toLowerCase() === req.full_name.trim().toLowerCase());
    }

    if (!patient) {
      await requireQuota(env.DB, doctor, 'patients', 1);
      patient = await patients.registerForDoctor(
        env.DB, doctor.id, doctor.patient_prefix, {
          mobile: req.mobile,
          fullName: selectedPatient ? selectedPatient.full_name : req.full_name,
          existingPatientId: selectedPatient && selectedPatient.id,
          relation: 'self', idempotencyKey: registrationKey,
          actor: actorKey(doctor)
        });
    }

    const accepted = await publicPage.acceptRequest(env.DB, doctor.id, params.id, {
      patientId: patient.id,
      scheduledOn: scheduledOn || req.preferred_on || new Date().toISOString().slice(0, 10),
      scheduledAt: scheduledAt || req.preferred_time || null,
      reason: req.reason || 'Requested online',
      actor: actorKey(doctor)
    });
    patient = await patients.byId(env.DB, accepted.patientId);
    const appointment = await appointments.byId(env.DB, doctor.id, accepted.appointmentId);
    return json({ patient, appointment, repeated: accepted.repeated });
  },

  'POST /requests/:id/decline': async (env, request, params) => {
    const doctor = await requireDoctor(env, request);
    gate(doctor, CAN.APPOINTMENTS);
    const declined = await publicPage.declineRequest(
      env.DB, doctor.id, params.id, actorKey(doctor));
    return json({ ok: true, repeated: declined.repeated });
  },

  'GET /health': async () => json({ ok: true, at: nowIso() })
};

/* ---------------- router ---------------- */

function match(method, pathname) {
  const key = method + ' ' + pathname;
  if (routes[key]) return { handler: routes[key], params: {} };

  for (const route of Object.keys(routes)) {
    const [routeMethod, pattern] = route.split(' ');
    if (routeMethod !== method || !pattern.includes(':')) continue;
    const patternParts = pattern.split('/');
    const pathParts = pathname.split('/');
    if (patternParts.length !== pathParts.length) continue;

    const params = {};
    const ok = patternParts.every((part, index) => {
      if (part.startsWith(':')) { params[part.slice(1)] = decodeURIComponent(pathParts[index]); return true; }
      return part === pathParts[index];
    });
    if (ok) return { handler: routes[route], params };
  }
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = allowedOrigin(env, request, url.pathname);
    if (request.method === 'OPTIONS') {
      return hardenResponse(new Response(null, { status: 204, headers: CORS(origin) }));
    }

    try {
      let routedRequest = request;
      if (isPlatformAdminPath(url.pathname)) {
        const access = await verifyPlatformAccess(env, request);
        if (access) {
          const headers = new Headers(request.headers);
          /* Always overwrite this internal header after signature validation.
             A caller-supplied value therefore has no authority. */
          headers.set(ACCESS_EMAIL_HEADER, access.email);
          routedRequest = new Request(request, { headers });
        }
      }

      /* A clinic reached by its OWN address - drdevi.tcos.in, or the domain
         she connected - asking for "/" means "my clinic page".

         This runs before static assets so a clinic custom domain can never
         receive the TCOS marketing/index page by accident. */
      const host = routedRequest.headers.get('Host') || '';
      const atRoot = url.pathname === '/' || url.pathname === '';
      if (routedRequest.method === 'GET' && atRoot && !isPlatformHost(env, host)) {
        const site = await domains.bySiteHost(env.DB, env, host);
        if (site) {
          /* HER PAGE, NOT HER DATA. This answered with the profile as JSON,
             so a patient who typed drdevi.com into her phone got a wall of
             curly braces. Everything needed to serve a website was already
             here; the last step handed back the data instead of the page.

             The HTML is the real built shell, fetched from the app and
             rewritten - never a second copy of the renderer. */
          try {
            return hardenResponse(await clinicSiteResponse(env, site.public_slug));
          } catch (error) {
            console.warn(JSON.stringify({
              level: 'warn', event: 'clinic_shell_unavailable', host,
              error: error instanceof Error ? error.message : 'unknown'
            }));
            return clinicSiteFallback(env, site.public_slug);
          }
        }
        return hardenResponse(json(
          { error: 'not_found', message: 'No clinic page at this address.' },
          404, CORS('*')));
      }

      const routePath = url.pathname.replace(/\/$/, '') || '/';
      const found = match(routedRequest.method, routePath);
      if (!found && ['GET', 'HEAD'].includes(routedRequest.method) &&
          env.ASSETS && isPlatformHost(env, host)) {
        return hardenResponse(await env.ASSETS.fetch(routedRequest));
      }
      if (!found) throw notFound('No such endpoint.');
      const response = await found.handler(env, routedRequest, found.params);
      Object.entries(CORS(origin)).forEach(([k, v]) => response.headers.set(k, v));
      return hardenResponse(response);
    } catch (error) {
      if (error instanceof ApiError) {
        return hardenResponse(json(
          { error: error.code, message: error.message }, error.status,
          { ...CORS(origin), ...(error.headers || {}) }));
      }
      console.error('unhandled', error && error.stack);
      /* Never leak internals to the client. */
      return hardenResponse(json(
        { error: 'server_error', message: 'Something went wrong. Try again.' },
        500, CORS(origin)));
    }
  },

  /* Tomorrow's appointment reminders, nightly. See wrangler.jsonc for when.

     waitUntil rather than await so a slow clinic cannot make the whole run
     time out, and every error is swallowed here on purpose: a cron that
     throws is retried by the platform, and a retried reminder run is the
     one thing this feature must never do. The dedupe key would catch it,
     but relying on that as the only defence is thin. */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      runNightlyReminders(env)
        .then(summary => console.log('reminders', JSON.stringify(summary)))
        .catch(error => console.error('reminders run failed', error && error.stack))
    );
    ctx.waitUntil(
      sweepProviderFiles(env)
        .then(summary => console.log('ai provider cleanup', JSON.stringify(summary)))
        .catch(error => console.error('ai provider cleanup failed', error && error.stack))
    );
    ctx.waitUntil(
      sweepSubscriptionAccess(env)
        .then(summary => console.log('subscription access sweep', JSON.stringify(summary)))
        .catch(error => console.error('subscription access sweep failed', error && error.stack))
    );
    ctx.waitUntil(
      authThrottle.sweep(env.DB)
        .then(removed => console.log('expired auth throttles', removed))
        .catch(error => console.error('auth throttle sweep failed', error && error.stack))
    );
    /* Unfinished consultations older than a day. This is the tidy, not the
       rule: the read path already refuses an expired sheet, so a night when
       this does not run changes nothing anybody can see. */
    ctx.waitUntil(
      consultationDrafts.sweep(env.DB)
        .then(removed => console.log('expired consultation drafts', removed))
        .catch(error => console.error('consultation draft sweep failed', error && error.stack))
    );
    /* Doctors' own domains that are still waiting on a certificate. She
       should not have to sit pressing a button for something that arrives
       forty minutes later - she sets up her DNS, and opens TCOS the next
       morning to find her domain live. */
    ctx.waitUntil(
      domains.sweep(env.DB, env)
        .then(summary => console.log('custom domain sweep', JSON.stringify(summary)))
        .catch(error => console.error('custom domain sweep failed', error && error.stack))
    );
  }
};

/* =========================================================================
   PLATFORM ADMIN - the only code allowed to read across doctors.

   Everything in worker/repo.js is scoped to one doctor. This file is the
   deliberate exception: the platform console needs to see every tenant. That
   makes it the most dangerous file in the codebase, so:

     1. Every function here takes an `admin` object that requireAdmin() built
        from a verified admin session. There is no way to call these with a
        doctor session.
     2. Nothing here returns patient-level clinical content. Names, plans,
        counts and timestamps may be operationally visible. Health analytics
        are de-identified aggregates with a minimum cohort; never a note,
        prescription line or lab value attached to a named patient.
     3. Every write records who did it.
   ========================================================================= */

import {
  ApiError, newId, nowIso, plusHours, isPast,
  unauthorised, forbidden, badRequest, notFound
} from '@tharigopula/core/lib';
import {
  hashPassword, verifyPasswordVersioned, activePepper,
  sha256, normaliseMobile, appOrigin
} from '@tharigopula/core/lib';
import {
  ADMIN_SESSION_COOKIE, sessionCredential, requireCookieCsrf
} from './session-security.js';
/* Transport is shared; the words are ours. See worker/email-templates.js. */
import { sendDoctorWelcome } from './email-templates.js';
import { email } from '@tharigopula/core/comms';
const emailConfigured = env => email.configured(env);
import { ACCESS_EMAIL_HEADER, accessEnforced } from '@tharigopula/core/auth';

const ROLE_RANK = { viewer: 0, finance: 1, support: 2, admin: 3, owner: 4 };
const atLeast = (role, needed) => (ROLE_RANK[role] ?? -1) >= ROLE_RANK[needed];

/* Platform access is a set of jobs, not a seniority ladder. The old rank
   check accidentally meant a support teammate could read finance because
   "support" happened to rank above "finance". Roles remain useful presets,
   while this capability list is the server-side authority behind the owner's
   checkboxes. */
export const PLATFORM_CAPABILITIES = [
  'applications', 'doctors', 'patients', 'analytics', 'money',
  'subscriptions', 'delivery', 'support', 'team'
];

export const PLATFORM_ROLE_PRESETS = {
  owner: [...PLATFORM_CAPABILITIES],
  admin: [...PLATFORM_CAPABILITIES],
  support: ['applications', 'doctors', 'patients', 'delivery', 'support'],
  finance: ['money', 'subscriptions'],
  viewer: ['applications', 'doctors']
};

/* Stored JSON that a screen is about to read. A clinic whose column holds
   something unreadable should look empty on the support screen, not take
   the whole screen down - the moment somebody opens this is the moment
   something is already wrong with that account. */
const safeList = value => {
  try { const out = JSON.parse(value); return Array.isArray(out) ? out : []; }
  catch (_) { return []; }
};
const safeObject = value => {
  try {
    const out = JSON.parse(value);
    return out && typeof out === 'object' && !Array.isArray(out) ? out : {};
  } catch (_) { return {}; }
};

const cleanCapabilities = value => {
  const requested = Array.isArray(value) ? value : [];
  return [...new Set(requested.filter(capability =>
    PLATFORM_CAPABILITIES.includes(capability)))];
};

export function platformCapabilities(member) {
  if (!member) return [];
  if (member.role === 'owner') return [...PLATFORM_CAPABILITIES];
  if (member.capabilities) {
    try { return cleanCapabilities(JSON.parse(member.capabilities)); }
    catch (_) { return []; }
  }
  return [...(PLATFORM_ROLE_PRESETS[member.role] || [])];
}

/* The products a doctor can be activated on. The browser has a richer copy
   in js/products.js - names, logos, default packs. The server needs only
   the list, so an unknown value cannot be written to the column. */
const PRODUCTS = ['ayurcos', 'homeocos', 'allocos'];

/* What a newly approved doctor's examination form starts as.
 *
   FOUND 19 SEPTEMBER 2026, AND IT HAD ALWAYS BEEN BROKEN. js/products.js
   declares `defaultPacks` for each product and describes it as "packs a new
   doctor on this product starts with". Nothing anywhere read it. Approval
   wrote `details.practicePacks || []`, so every account ever created through
   the normal flow started with NO clinical modules at all - and the
   consultation screen hides the examination card when there are none.

   An Ayurvedic doctor therefore signed in to a workspace with no Nadi, no
   Jihva, no Prakriti and no way to know any of it existed. Both production
   doctors are `practice_packs = '[]'` today. It went unnoticed because
   production has one prescription in it; with ten doctors it would have been
   ten first impressions of an empty product.

   She can still change these afterwards - packs are approved by the
   platform, and this is only where she starts. test/onboarding.test.js
   holds this equal to js/products.js so the two cannot drift. */
const DEFAULT_PACKS = {
  ayurcos: ['ayurveda', 'nadi', 'yoga', 'referral'],
  homeocos: ['homeopathy', 'repertory', 'referral'],
  allocos: ['systemic', 'history', 'referral']
};
export const defaultPacksFor = product => (DEFAULT_PACKS[product] || []).slice();

export const team = {
  async byEmail(db, email) {
    return db.prepare(
      'SELECT * FROM platform_team WHERE email = ? AND removed_at IS NULL'
    ).bind(String(email || '').toLowerCase()).first();
  },

  async list(db) {
    const { results } = await db.prepare(
      `SELECT email, full_name, role, capabilities, invited_by,
              must_change_password, added_at, last_sign_in_at
         FROM platform_team WHERE removed_at IS NULL ORDER BY added_at`
    ).all();
    return (results || []).map(member => ({
      ...member, capabilities: platformCapabilities(member)
    }));
  },

  async supportAssignees(db) {
    const { results } = await db.prepare(
      `SELECT email, full_name, role, capabilities
         FROM platform_team WHERE removed_at IS NULL ORDER BY full_name, email`
    ).all();
    return (results || [])
      .map(member => ({ ...member, capabilities: platformCapabilities(member) }))
      .filter(member => member.capabilities.includes('support'))
      .map(({ email, full_name }) => ({ email, full_name }));
  },

  async add(db, { email, fullName, role, capabilities, password, pepper, invitedBy }) {
    const key = String(email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(key)) throw badRequest('Enter a valid email address.');
    if (!(role in PLATFORM_ROLE_PRESETS) || role === 'owner') {
      throw badRequest('Pick a team role. Owner access cannot be delegated here.');
    }
    if (await this.byEmail(db, key)) throw badRequest('That email already has access.');

    const { hash, salt } = await hashPassword(password, pepper);
    const selected = capabilities === undefined
      ? PLATFORM_ROLE_PRESETS[role] : cleanCapabilities(capabilities);
    if (!selected.length) throw badRequest('Choose at least one area this teammate can use.');
    await db.prepare(
      `INSERT INTO platform_team
         (email, full_name, role, capabilities, invited_by,
          password_hash, password_salt, must_change_password)
       VALUES (?,?,?,?,?,?,?,1)`
    ).bind(key, fullName || key, role, JSON.stringify(selected),
      invitedBy || null, hash, salt).run();
    return this.byEmail(db, key);
  },

  async rehashPassword(db, email, hash, salt) {
    await db.prepare(
      'UPDATE platform_team SET password_hash = ?, password_salt = ? WHERE email = ?'
    ).bind(hash, salt, String(email || '').toLowerCase()).run();
  },

  /* A password reset proved by a code sent to the account's own email.
   *
     EVERY session goes, with no exception kept - unlike changeOwnPassword
     below, which spares the browser doing the changing because that person
     is already holding a session we trust. Here we are not: the whole
     reason this route exists is that he may be on a borrowed device, or
     that somebody else may be holding a session he wants ended. One D1
     batch, so there is no instant where the new password works and an old
     session is still valid. */
  async resetPassword(db, email, hash, salt) {
    const key = String(email || '').trim().toLowerCase();
    const at = nowIso();
    await db.batch([
      db.prepare(
        `UPDATE platform_team SET password_hash = ?, password_salt = ?,
                must_change_password = 0 WHERE email = ?`
      ).bind(hash, salt, key),
      db.prepare(
        'UPDATE admin_sessions SET revoked_at = ? WHERE email = ? AND revoked_at IS NULL'
      ).bind(at, key)
    ]);
  },

  async changeOwnPassword(db, email, hash, salt, keepTokenHash) {
    const at = nowIso();
    await db.batch([
      db.prepare(
        `UPDATE platform_team SET password_hash = ?, password_salt = ?,
                must_change_password = 0 WHERE email = ?`
      ).bind(hash, salt, email),
      db.prepare(
        `UPDATE admin_sessions SET revoked_at = ?
          WHERE email = ? AND token_hash <> ? AND revoked_at IS NULL`
      ).bind(at, email, keepTokenHash)
    ]);
  },

  /* Recovery is available only through the Access-verified owner route in
     worker/index.js. The configured owner may not exist yet on a freshly
     seeded environment, so the first recovery also creates that one fixed
     identity. No caller-supplied address can become owner. */
  async recoverOwner(db, env, email, password, fullName) {
    const key = String(email || '').trim().toLowerCase();
    await db.prepare(
      `INSERT OR IGNORE INTO platform_team (email, full_name, role)
       VALUES (?,?, 'owner')`
    ).bind(key, fullName || 'Platform owner').run();
    const member = await this.byEmail(db, key);
    if (!member || member.role !== 'owner') {
      throw forbidden('The configured recovery identity is not an active owner.');
    }
    const { hash, salt } = await hashPassword(password, activePepper(env));
    const at = nowIso();
    await db.batch([
      db.prepare(
        `UPDATE platform_team
            SET password_hash = ?, password_salt = ?, must_change_password = 0,
                last_sign_in_at = NULL
          WHERE email = ? AND role = 'owner' AND removed_at IS NULL`
      ).bind(hash, salt, key),
      db.prepare(
        `UPDATE admin_sessions SET revoked_at = ?
          WHERE email = ? AND revoked_at IS NULL`
      ).bind(at, key)
    ]);
    return member;
  },

  async setRole(db, email, role) {
    const member = await this.byEmail(db, email);
    if (!member) throw badRequest('Not found.');
    if (member.role === 'owner') throw forbidden('The owner role cannot be changed.');
    if (!ROLE_RANK[role]) throw badRequest('Unknown role.');
    await db.prepare('UPDATE platform_team SET role = ? WHERE email = ?').bind(role, member.email).run();
  },

  async setAccess(db, email, { role, capabilities }) {
    const member = await this.byEmail(db, email);
    if (!member) throw notFound('No such platform teammate.');
    if (member.role === 'owner') throw forbidden('Owner access cannot be changed here.');
    if (!(role in PLATFORM_ROLE_PRESETS) || role === 'owner') throw badRequest('Pick a team role.');
    const selected = cleanCapabilities(capabilities);
    if (!selected.length) throw badRequest('Choose at least one area this teammate can use.');
    await db.prepare(
      'UPDATE platform_team SET role = ?, capabilities = ? WHERE email = ?'
    ).bind(role, JSON.stringify(selected), member.email).run();
    return this.byEmail(db, member.email);
  },

  async remove(db, email) {
    const member = await this.byEmail(db, email);
    if (!member) return;
    if (member.role === 'owner') throw forbidden('The owner cannot be removed.');
    await db.prepare('UPDATE platform_team SET removed_at = ? WHERE email = ?')
      .bind(nowIso(), member.email).run();
    await db.prepare('UPDATE admin_sessions SET revoked_at = ? WHERE email = ?')
      .bind(nowIso(), member.email).run();
  }
};

export const adminSessions = {
  async create(db, email, tokenHash, ttlHours, userAgent, csrfHash = null) {
    await db.prepare(
      `INSERT INTO admin_sessions
         (token_hash, email, expires_at, user_agent, csrf_hash, reauthenticated_at)
       VALUES (?,?,?,?,?,?)`
    ).bind(tokenHash, email, plusHours(ttlHours), userAgent || null,
      csrfHash, nowIso()).run();
  },

  async resolve(db, tokenHash) {
    const row = await db.prepare(
      `SELECT email, expires_at, revoked_at, csrf_hash, reauthenticated_at
         FROM admin_sessions WHERE token_hash = ?`
    ).bind(tokenHash).first();
    if (!row || row.revoked_at || isPast(row.expires_at)) return null;
    return {
      email: row.email,
      csrfHash: row.csrf_hash || null,
      reauthenticatedAt: row.reauthenticated_at || null
    };
  },

  async markReauthenticated(db, tokenHash) {
    const at = nowIso();
    await db.prepare(
      `UPDATE admin_sessions SET reauthenticated_at = ?
        WHERE token_hash = ? AND revoked_at IS NULL`
    ).bind(at, tokenHash).run();
    return at;
  },

  async revoke(db, tokenHash) {
    await db.prepare('UPDATE admin_sessions SET revoked_at = ? WHERE token_hash = ?')
      .bind(nowIso(), tokenHash).run();
  }
};

/* Resolves an admin session. Note this never touches the doctor sessions
   table, so a doctor token cannot reach an admin route. */
export async function requireAdmin(env, request, minimumRole = 'viewer') {
  const credential = sessionCredential(request, ADMIN_SESSION_COOKIE, env);
  if (!credential) throw unauthorised('Sign in to the platform console.');

  const resolved = await adminSessions.resolve(env.DB, await sha256(credential.token));
  if (!resolved) throw unauthorised('Sign in to the platform console.');
  await requireCookieCsrf(env, request, credential, resolved.csrfHash);

  const member = await team.byEmail(env.DB, resolved.email);
  if (!member) throw unauthorised('Sign in to the platform console.');
  const accessEmail = request.headers.get(ACCESS_EMAIL_HEADER) || '';
  if (accessEnforced(env) && accessEmail !== member.email) {
    throw forbidden('Your Cloudflare Access identity does not match this platform account.');
  }
  if (!atLeast(member.role, minimumRole)) {
    throw forbidden('Your role does not allow that.');
  }
  return member;
}

export async function requireAdminCapability(env, request, capability) {
  const member = await requireAdmin(env, request);
  if (member.must_change_password) {
    throw new ApiError(403, 'password_change_required',
      'Choose your own platform password before using the console.');
  }
  if (!PLATFORM_CAPABILITIES.includes(capability) ||
      !platformCapabilities(member).includes(capability)) {
    throw forbidden('Your platform access does not include this area.');
  }
  return member;
}

/* A valid eight-hour session proves who is operating the console. It does
   not prove that the same person is still at the keyboard when an account is
   suspended, a password is replaced, or a teammate is removed. Those
   actions require the platform password again within a short window. */
export async function requireFreshAdmin(env, request, minimumRole = 'admin') {
  const member = await requireAdmin(env, request, minimumRole);
  const credential = sessionCredential(request, ADMIN_SESSION_COOKIE, env);
  const resolved = credential && await adminSessions.resolve(
    env.DB, await sha256(credential.token));
  const freshAt = resolved && Date.parse(resolved.reauthenticatedAt || '');
  const configured = Number.parseInt(env.ADMIN_REAUTH_MINUTES, 10);
  const minutes = Number.isFinite(configured) && configured > 0
    ? Math.min(configured, 30) : 5;
  if (!Number.isFinite(freshAt) || Date.now() - freshAt > minutes * 60000) {
    throw new ApiError(403, 'reauth_required',
      'Enter your platform password again before making this change.');
  }
  return member;
}

export async function requireFreshAdminCapability(env, request, capability) {
  const member = await requireAdminCapability(env, request, capability);
  const credential = sessionCredential(request, ADMIN_SESSION_COOKIE, env);
  const resolved = credential && await adminSessions.resolve(
    env.DB, await sha256(credential.token));
  const freshAt = resolved && Date.parse(resolved.reauthenticatedAt || '');
  const configured = Number.parseInt(env.ADMIN_REAUTH_MINUTES, 10);
  const minutes = Number.isFinite(configured) && configured > 0
    ? Math.min(configured, 30) : 5;
  if (!Number.isFinite(freshAt) || Date.now() - freshAt > minutes * 60000) {
    throw new ApiError(403, 'reauth_required',
      'Enter your platform password again before making this change.');
  }
  return member;
}

export async function adminSignIn(env, email, password) {
  const member = await team.byEmail(env.DB, email);
  const wrong = () => { throw unauthorised('That email or password is not right.'); };
  if (!member || !member.password_hash) {
    await hashPassword(String(password || ''), activePepper(env),
      '00000000000000000000000000000000');
    wrong();
  }
  const checked = await verifyPasswordVersioned(
    password, env, member.password_salt, member.password_hash);
  if (!checked.ok) wrong();
  if (checked.needsRehash) {
    const next = await hashPassword(password, activePepper(env));
    await team.rehashPassword(env.DB, member.email, next.hash, next.salt);
  }
  await env.DB.prepare('UPDATE platform_team SET last_sign_in_at = ? WHERE email = ?')
    .bind(nowIso(), member.email).run();
  return member;
}

/* ---------------------------------------------------------------- tenants
   Counts and status only. Deliberately no clinical content. */

export const tenants = {
  /* Verify or un-verify a doctor who did not arrive through an application -
     someone who signed in with Google, or one we need to withdraw. Rejection
     is a stated state rather than a silent removal: she is told, and she can
     submit again. */
  /* Who has not been checked yet, soonest deadline first. The console shows
     this so the work is visible BEFORE it is overdue - a deadline nobody can
     see until it passes is a deadline that gets enforced as a surprise
     against a doctor with patients in her waiting room. */
  async awaitingVerification(db) {
    const { results } = await db.prepare(
      `SELECT id, full_name, clinic_name, mobile, registration_no, council,
              verification_status, verify_by, verify_reminded_at, created_at,
              CAST(julianday(verify_by) - julianday('now') AS INTEGER) AS days_left
         FROM doctors
        WHERE verification_status IN ('unverified', 'pending')
          AND status <> 'suspended'
        ORDER BY verify_by IS NULL, verify_by`
    ).all();
    return results || [];
  },

  /* Withdrawing access, with the sentence the doctor will read.

     "This account is suspended. Contact TCOS support." tells somebody with a
     waiting room full of patients nothing they can act on. If we are going
     to stop a doctor working we owe her the reason and a way back.

     Her patients keep their own access links either way. The records are the
     patient's history, not the doctor's property, and a patient losing her
     results because her doctor's paperwork failed would be a second wrong
     done to the person who did nothing. */
  async suspend(db, doctorId, admin, reason) {
    const said = String(reason || '').trim();
    if (!said) throw badRequest('Say why, in words the doctor will read.');
    await db.prepare(
      `UPDATE doctors
          SET status = 'suspended', suspended_reason = ?, suspended_at = ?, suspended_by = ?
        WHERE id = ?`
    ).bind(said.slice(0, 400), nowIso(), admin.email, doctorId).run();
    return db.prepare(
      'SELECT id, full_name, clinic_name, status, suspended_reason FROM doctors WHERE id = ?'
    ).bind(doctorId).first();
  },

  async restore(db, doctorId, admin) {
    await db.prepare(
      `UPDATE doctors
          SET status = 'active', suspended_reason = NULL, suspended_at = NULL,
              suspended_by = NULL
        WHERE id = ?`
    ).bind(doctorId).run();
    return db.prepare(
      'SELECT id, full_name, clinic_name, status FROM doctors WHERE id = ?'
    ).bind(doctorId).first();
  },

  async setVerification(db, doctorId, admin, { status, note }) {
    const known = ['unverified', 'pending', 'verified', 'rejected'];
    if (!known.includes(status)) throw badRequest('Unknown verification status.');
    const verified = status === 'verified';
    await db.prepare(
      `UPDATE doctors SET verification_status = ?,
              verified_at = ?, verified_by = ?, verification_note = COALESCE(?, verification_note)
        WHERE id = ?`
    ).bind(status, verified ? nowIso() : null, verified ? admin.email : null,
      note == null ? null : note, doctorId).run();
    return db.prepare(
      'SELECT id, full_name, clinic_name, verification_status, verified_at FROM doctors WHERE id = ?'
    ).bind(doctorId).first();
  },

  async list(db) {
    const { results } = await db.prepare(
      `SELECT d.id, d.full_name, d.clinic_name, d.qualification, d.mobile, d.email,
              d.line, d.plan, d.plan_source, d.plan_override_reason,
              d.plan_updated_at, d.product, d.status, d.trial_offer, d.trial_ends_on,
              d.registration_no, d.verification_status, d.verified_at,
              d.practice_packs, d.feature_overrides, d.created_at, d.last_sign_in_at,
              (SELECT COUNT(*) FROM doctor_patients dp WHERE dp.doctor_id = d.id) AS patient_count,
              (SELECT COUNT(*) FROM prescriptions p WHERE p.doctor_id = d.id) AS rx_count,
              (SELECT COUNT(*) FROM stock_items s WHERE s.doctor_id = d.id) AS stock_count
         FROM doctors d ORDER BY d.created_at DESC`
    ).all();
    return results || [];
  },

  /* ---- one customer, in full ----

     Vijay: "doctors - i want to look into his account full access, like how
     many doctors and how many devices he is logging in and how many staffs
     he added, soo on. if doctor says this is not working we will have
     access to check."

     Everything here is OPERATIONAL: who is on the account, what they may
     do, which devices hold a live session, how much of the plan is used,
     what has been paid, what the clinic has switched on. That is what
     answers a support call - "her prescription button does nothing" is
     answered by her plan, her capabilities and her last error, never by
     reading a patient's record.

     SO NOTHING CLINICAL IS READ HERE. Patients, visits, prescriptions,
     invoices and lab reports are COUNTED and never opened: no name, no
     complaint, no diagnosis, no medicine, no value. That is rule 1 in
     CLAUDE.md and test/isolation.test.js holds the console to it. If a
     support case ever genuinely needs the content, that is the
     consent-gated route patients already have, not a widening of this.

     Every query is scoped to the one clinic being looked at. */
  async overview(db, doctorId) {
    const clinic = await db.prepare(
      `SELECT id, full_name, clinic_name, qualification, registration_no, council,
              mobile, mobile_verified, email, line, product, plan, plan_source,
              plan_override_reason, plan_updated_at, plan_paid_until, account_type,
              status, suspended_reason, verification_status, verified_at,
              practice_packs, feature_overrides, patient_prefix, address,
              public_slug, public_page_on, custom_domain, custom_domain_status,
              created_at, last_sign_in_at
         FROM doctors WHERE id = ?`
    ).bind(doctorId).first();
    if (!clinic) throw new ApiError(404, 'not_found', 'No clinic with that id.');

    /* Who else is in the practice. A second practitioner and a receptionist
       are different answers to "why can she not open a record". */
    const { results: people } = await db.prepare(
      `SELECT id, full_name, role, capabilities, status, mobile,
              registration_no, must_change_password, created_at, last_sign_in_at
         FROM clinic_users WHERE doctor_id = ? ORDER BY created_at`
    ).bind(doctorId).all();

    /* WHICH DEVICES ARE SIGNED IN. The user agent and the times, never the
       token or its hash - nothing here could be used to become them. */
    const { results: devices } = await db.prepare(
      `SELECT user_id, user_agent, created_at, expires_at
         FROM sessions
        WHERE doctor_id = ? AND revoked_at IS NULL AND expires_at > ?
        ORDER BY created_at DESC LIMIT 30`
    ).bind(doctorId, nowIso()).all();

    /* Passkeys are devices too, and a doctor who set one up on a phone she
       no longer has is a support call waiting to happen. */
    const { results: passkeys } = await db.prepare(
      `SELECT label, created_at, last_used_at FROM webauthn_credentials
        WHERE scope = 'clinic' AND subject LIKE ? AND revoked_at IS NULL
        ORDER BY created_at`
    ).bind(doctorId + '%').all();

    /* COUNTS ONLY. Note what is absent: no join reaches a name, a note, a
       medicine or a value. */
    const usage = await db.prepare(
      `SELECT
         (SELECT COUNT(*) FROM doctor_patients WHERE doctor_id = ?) AS patients,
         (SELECT COUNT(*) FROM visits         WHERE doctor_id = ?) AS visits,
         (SELECT COUNT(*) FROM prescriptions  WHERE doctor_id = ?) AS prescriptions,
         (SELECT COUNT(*) FROM invoices       WHERE doctor_id = ?) AS invoices,
         (SELECT COUNT(*) FROM appointments   WHERE doctor_id = ?) AS appointments,
         (SELECT COUNT(*) FROM stock_items    WHERE doctor_id = ?) AS stock_items,
         (SELECT COUNT(*) FROM lab_reports    WHERE doctor_id = ?) AS lab_reports,
         (SELECT COUNT(*) FROM ai_drafts      WHERE doctor_id = ?) AS ai_drafts,
         (SELECT COALESCE(SUM(bytes), 0) FROM files
            WHERE doctor_id = ? AND deleted_at IS NULL) AS storage_bytes`
    ).bind(doctorId, doctorId, doctorId, doctorId, doctorId,
      doctorId, doctorId, doctorId, doctorId).first();

    const subscription = await db.prepare(
      `SELECT provider, plan, status, current_end, created_at
         FROM subscriptions WHERE doctor_id = ? ORDER BY created_at DESC LIMIT 1`
    ).bind(doctorId).first();

    const { results: payments } = await db.prepare(
      /* occurred_at is when the money moved; recorded_at is when we wrote
         it down. There is no paid_at, which the test caught. method and
         reference are what make a manual payment checkable against a bank
         statement, so they come too. */
      `SELECT provider, amount_paise, status, occurred_at, method, reference,
              provider_payment_id
         FROM subscription_payments WHERE doctor_id = ?
        ORDER BY occurred_at DESC LIMIT 5`
    ).bind(doctorId).all();

    /* What she has been DOING - the action names and who did them, which is
       what tells you whether a button was ever actually pressed. The audit
       log holds no clinical content by design; `detail` is a label like a
       role or a device name. */
    const { results: activity } = await db.prepare(
      `SELECT action, actor, detail, created_at FROM audit_events
        WHERE doctor_id = ? ORDER BY created_at DESC LIMIT 25`
    ).bind(doctorId).all();

    const { results: support } = await db.prepare(
      `SELECT id, message, status, created_at FROM support_requests
        WHERE doctor_id = ? ORDER BY created_at DESC LIMIT 5`
    ).bind(doctorId).all();

    return {
      clinic: {
        ...clinic,
        practicePacks: safeList(clinic.practice_packs),
        featureOverrides: safeObject(clinic.feature_overrides)
      },
      people: (people || []).map(person => ({
        ...person, capabilities: safeList(person.capabilities)
      })),
      devices: devices || [],
      passkeys: passkeys || [],
      usage: usage || {},
      subscription: subscription || null,
      payments: payments || [],
      activity: activity || [],
      support: support || []
    };
  },

  async setPlan(db, doctorId, plan, reason) {
    if (!['basic', 'starter', 'pro', 'pro_plus'].includes(plan)) {
      throw badRequest('Unknown TCOS plan.');
    }
    const said = String(reason || '').trim();
    if (!said) throw badRequest('Say why this manual plan override is needed.');
    await db.prepare(
      `UPDATE doctors SET plan = ?, plan_source = 'manual_override',
              plan_override_reason = ?, plan_updated_at = ? WHERE id = ?`
    ).bind(plan, said.slice(0, 400), nowIso(), doctorId).run();
  },

  /* Demo or live.
   *
     Vijay: "if i select demo then it should be demo, all features of that
     package should be present without any payment related thing."

     Switching TO demo clears the payment clock, because a demo has no clock
     to run out. Switching BACK to live deliberately does NOT invent one: a
     live clinic with no paid-until date sits on whatever plan it has and
     nothing expires it, which is the safe direction to fail. Somebody then
     records a payment or sets a trial, and both of those set the clock
     honestly. Guessing one here would either bill a clinic that has not
     agreed to pay or hand one a month it never bought. */
  async setAccountType(db, doctorId, accountType) {
    if (!['live', 'demo'].includes(accountType)) {
      throw badRequest('An account is either live or demo.');
    }
    if (accountType === 'demo') {
      await db.prepare(
        `UPDATE doctors SET account_type = 'demo', plan_paid_until = NULL,
                plan_source = 'demo', plan_note = 'Demo account — no billing',
                plan_updated_at = ? WHERE id = ?`
      ).bind(nowIso(), doctorId).run();
    } else {
      await db.prepare(
        `UPDATE doctors SET account_type = 'live', plan_note = NULL,
                plan_updated_at = ? WHERE id = ?`
      ).bind(nowIso(), doctorId).run();
    }
    return { doctorId, accountType };
  },

  async setStatus(db, doctorId, status) {
    await db.prepare('UPDATE doctors SET status = ? WHERE id = ?').bind(status, doctorId).run();
    if (status === 'suspended') {
      await db.prepare('UPDATE sessions SET revoked_at = ? WHERE doctor_id = ?')
        .bind(nowIso(), doctorId).run();
    }
  },

  async setOverrides(db, doctorId, overrides) {
    await db.prepare('UPDATE doctors SET feature_overrides = ? WHERE id = ?')
      .bind(JSON.stringify(overrides || {}), doctorId).run();
  },

  async setPacks(db, doctorId, packs) {
    await db.prepare('UPDATE doctors SET practice_packs = ? WHERE id = ?')
      .bind(JSON.stringify(packs || []), doctorId).run();
  },

  async setTrial(db, doctorId, trial) {
    await db.prepare('UPDATE doctors SET trial_offer = ?, trial_ends_on = ? WHERE id = ?')
      .bind(trial ? trial.offer : null, trial ? trial.endsOn : null, doctorId).run();
  }
};

/* Identity and operational context only. The platform can help a patient
   find their clinic without seeing a complaint, diagnosis, medicine or lab. */
export const platformPatients = {
  async list(db) {
    const { results } = await db.prepare(
      `SELECT p.id, p.full_name, p.mobile, p.patient_code, p.created_at,
              COUNT(DISTINCT dp.doctor_id) AS clinic_count,
              GROUP_CONCAT(DISTINCT d.clinic_name) AS clinics,
              MAX(dp.last_seen_on) AS last_seen_on
         FROM patients p
         JOIN doctor_patients dp ON dp.patient_id = p.id
         JOIN doctors d ON d.id = dp.doctor_id
        GROUP BY p.id, p.full_name, p.mobile, p.patient_code, p.created_at
        ORDER BY p.created_at DESC LIMIT 500`
    ).all();
    return results || [];
  },

  async detail(db, id) {
    const patient = await db.prepare(
      `SELECT p.id, p.full_name, p.mobile, p.patient_code, p.sex,
              p.date_of_birth, p.created_at,
              COUNT(DISTINCT dp.doctor_id) AS clinic_count,
              MAX(dp.last_seen_on) AS last_seen_on,
              (SELECT COUNT(*) FROM patient_access_links pal
                WHERE pal.patient_id = p.id) AS access_links,
              (SELECT COALESCE(SUM(opened_count), 0) FROM patient_access_links pal
                WHERE pal.patient_id = p.id) AS link_opens
         FROM patients p
    LEFT JOIN doctor_patients dp ON dp.patient_id = p.id
        WHERE p.id = ?
        GROUP BY p.id, p.full_name, p.mobile, p.patient_code, p.sex,
                 p.date_of_birth, p.created_at`
    ).bind(id).first();
    if (!patient) throw notFound('No such patient.');

    const { results: connections } = await db.prepare(
      `SELECT d.id AS doctor_id, d.clinic_name, d.full_name AS doctor_name,
              d.product, d.status, dp.local_ref, dp.first_seen_on,
              dp.last_seen_on,
              (SELECT COUNT(*) FROM visits v
                WHERE v.doctor_id = d.id AND v.patient_id = dp.patient_id) AS visit_count,
              (SELECT COUNT(*) FROM prescriptions rx
                WHERE rx.doctor_id = d.id AND rx.patient_id = dp.patient_id) AS prescription_count,
              (SELECT COUNT(*) FROM lab_reports lr
                WHERE lr.doctor_id = d.id AND lr.patient_id = dp.patient_id) AS report_count
         FROM doctor_patients dp
         JOIN doctors d ON d.id = dp.doctor_id
        WHERE dp.patient_id = ?
        ORDER BY dp.last_seen_on DESC, dp.first_seen_on DESC`
    ).bind(id).all();
    return { patient, connections: connections || [] };
  }
};

/* Aggregate opportunity and public-health signals. Exact groups smaller than
   five patients are suppressed. This lets the owner see what TCOS should
   teach, improve or partner around without turning the console into a way to
   browse an individual person's diagnosis. */
export const platformAnalytics = {
  async summary(db, minimumCohort = 5) {
    const floor = Math.max(5, Number.parseInt(minimumCohort, 10) || 5);
    const grouped = async (sql) => {
      const { results } = await db.prepare(sql).bind(floor).all();
      return results || [];
    };
    const diagnoses = await grouped(
      `SELECT lower(trim(diagnosis)) AS label,
              COUNT(DISTINCT patient_id) AS patients, COUNT(*) AS events
         FROM visits
        WHERE diagnosis IS NOT NULL AND trim(diagnosis) <> ''
        GROUP BY lower(trim(diagnosis))
       HAVING COUNT(DISTINCT patient_id) >= ?
        ORDER BY patients DESC, events DESC LIMIT 20`);
    const tests = await grouped(
      `SELECT lower(trim(report_name)) AS label,
              COUNT(DISTINCT patient_id) AS patients, COUNT(*) AS events
         FROM lab_reports
        WHERE report_name IS NOT NULL AND trim(report_name) <> ''
        GROUP BY lower(trim(report_name))
       HAVING COUNT(DISTINCT patient_id) >= ?
        ORDER BY events DESC, patients DESC LIMIT 20`);
    const laboratories = await grouped(
      `SELECT lower(trim(lab_name)) AS label,
              COUNT(DISTINCT patient_id) AS patients, COUNT(*) AS events
         FROM lab_reports
        WHERE lab_name IS NOT NULL AND trim(lab_name) <> ''
        GROUP BY lower(trim(lab_name))
       HAVING COUNT(DISTINCT patient_id) >= ?
        ORDER BY events DESC, patients DESC LIMIT 20`);
    const { results: monthly } = await db.prepare(
      `SELECT substr(visited_on, 1, 7) AS month, COUNT(*) AS visits,
              COUNT(DISTINCT patient_id) AS patients
         FROM visits
        WHERE visited_on >= date('now','-12 months')
        GROUP BY substr(visited_on, 1, 7) ORDER BY month`
    ).all();
    return { minimumCohort: floor, diagnoses, tests, laboratories,
      monthly: monthly || [] };
  }
};

/* ------------------------------------------------------- applications
   How a doctor joins. An application is not an account: it holds what she
   typed, and approving it is what creates the doctor. See migration 013.  */
export const applications = {
  /* Public - called with no session at all, from the landing page. Every
     field is treated as hostile: trimmed, length-capped, and the discipline
     checked against the product list rather than stored as typed. */
  async submit(db, details) {
    const text = (value, max) => {
      const clean = String(value == null ? '' : value).trim();
      return clean ? clean.slice(0, max) : null;
    };

    const fullName = text(details.fullName, 120);
    const clinicName = text(details.clinicName, 140);
    const mobile = normaliseMobile(details.mobile);
    if (!fullName || !clinicName || !mobile) {
      throw badRequest('Your name, clinic name and mobile number are required.');
    }
    /* Already a customer? Say so plainly instead of queueing a review that
       ends in "you already have an account". */
    const existing = await db.prepare(
      'SELECT id FROM doctors WHERE mobile = ?').bind(mobile).first();
    if (existing) {
      throw badRequest('An account already exists for that mobile number. Please sign in, or use "Forgot password".');
    }

    const open = await db.prepare(
      `SELECT id, status FROM doctor_applications
        WHERE mobile = ? AND status IN ('new','reviewing')`).bind(mobile).first();
    if (open) {
      throw badRequest('We already have your application and are reviewing it. We will call you on this number.');
    }

    /* Counts arrive as strings from a form and may be blank, junk, or a
       number somebody padded to impress. Clamped rather than trusted. */
    const count = value => {
      const n = Number.parseInt(value, 10);
      return Number.isFinite(n) && n > 0 ? Math.min(n, 9999) : null;
    };
    const FACILITIES = ['clinic', 'multi_doctor', 'hospital'];

    const id = newId('app');
    await db.prepare(
      `INSERT INTO doctor_applications
         (id, full_name, mobile, email, qualification, registration_no, council,
          clinic_name, city, state, discipline,
          facility_type, doctor_count, staff_count, message, source)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(id, fullName, mobile, text(details.email, 140),
      text(details.qualification, 120), text(details.registrationNo, 60),
      text(details.council, 120), clinicName, text(details.city, 80),
      text(details.state, 80),
      PRODUCTS.includes(details.discipline) ? details.discipline : 'ayurcos',
      FACILITIES.includes(details.facilityType) ? details.facilityType : null,
      count(details.doctorCount), count(details.staffCount),
      text(details.message, 1000),
      text(details.source, 60) || 'landing').run();

    return db.prepare('SELECT id, full_name, clinic_name FROM doctor_applications WHERE id = ?')
      .bind(id).first();
  },

  async list(db, status) {
    const known = ['new', 'reviewing', 'approved', 'rejected'];
    if (status && known.includes(status)) {
      const { results } = await db.prepare(
        `SELECT * FROM doctor_applications WHERE status = ?
          ORDER BY created_at DESC LIMIT 300`).bind(status).all();
      return results || [];
    }
    const { results } = await db.prepare(
      `SELECT * FROM doctor_applications ORDER BY
         CASE status WHEN 'new' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END,
         created_at DESC LIMIT 300`).all();
    return results || [];
  },

  async byId(db, id) {
    return db.prepare('SELECT * FROM doctor_applications WHERE id = ?').bind(id).first();
  },

  async update(db, id, admin, { status, reviewNote, rejectionReason }) {
    const known = ['new', 'reviewing', 'approved', 'rejected'];
    if (status && !known.includes(status)) throw badRequest('Unknown application status.');
    /* Approval happens through approve(), which creates the account. Letting
       a status field alone flip a row to "approved" would mark a doctor
       verified without ever giving her a way in. */
    if (status === 'approved') {
      throw badRequest('Use Approve, which creates the account.');
    }
    await db.prepare(
      `UPDATE doctor_applications
          SET status = COALESCE(?, status),
              review_note = COALESCE(?, review_note),
              rejection_reason = COALESCE(?, rejection_reason),
              reviewed_by = ?, reviewed_at = ?, updated_at = ?
        WHERE id = ?`
    ).bind(status || null, reviewNote == null ? null : reviewNote,
      rejectionReason == null ? null : rejectionReason,
      admin.email, nowIso(), nowIso(), id).run();
    return this.byId(db, id);
  },

  /* The moment that matters: this creates the doctor. The temporary
     password is returned ONCE and stored nowhere in readable form, so it
     has to be passed on there and then. She must change it on first use. */
  async approve(db, env, admin, id, overrides = {}) {
    const application = await this.byId(db, id);
    if (!application) throw notFound('No such application.');
    if (application.status === 'approved') {
      throw badRequest('This application has already been approved.');
    }

    const result = await invites.createDoctor(db, env, admin, {
      channel: 'sms',
      identifier: application.mobile,
      /* The address she typed into the application form. Carried through
         so the account has a recovery route and so the sign-in details can
         actually be sent to her. It was dropped here until 10 Sep 2026. */
      email: overrides.email || application.email || null,
      fullName: overrides.fullName || application.full_name,
      clinicName: overrides.clinicName || application.clinic_name,
      qualification: overrides.qualification || application.qualification,
      registrationNo: overrides.registrationNo || application.registration_no,
      council: overrides.council || application.council,
      address: [application.city, application.state].filter(Boolean).join(', ') || null,
      patientPrefix: overrides.patientPrefix || 'TCOS',
      /* Undefined, not [], when the reviewer did not choose - so the
         product's own defaults apply. This line sent a hard [] until
         19 Sep 2026, which is how every approved doctor ended up with an
         empty examination form. */
      practicePacks: Array.isArray(overrides.practicePacks)
        ? overrides.practicePacks : undefined,
      plan: overrides.plan || 'basic',
      product: overrides.product || application.discipline
    });

    /* Approving creates the account. Whether it also VERIFIES her depends on
       what was actually done, and the two are not the same thing.

       Checking a registration number against a council register takes time -
       weeks, sometimes - and the policy is to onboard immediately and check
       in the background. So approval records the truth: PENDING, with a date
       by which the check must be finished. She runs her whole clinic
       meanwhile; migration 014 already makes that safe by gating only the
       three things where TCOS speaks on her behalf.

       `registerChecked` is the exception: when the reviewer has genuinely
       looked the number up there and then, she is verified immediately and
       there is nothing to chase. Recording that as a deliberate claim rather
       than a default is the point - the previous version marked EVERY
       approved doctor verified, which meant the badge said "we checked the
       council register" on accounts where nobody had. */
    /* Demo or live, decided here because this is the only moment anybody is
       looking at who this clinic actually is.
     *
       A demo account is exempted from the whole payment machinery - no
       trial clock, no grace, no nightly downgrade - so the flag is set in
       the same breath as the plan rather than left for somebody to remember
       on the Doctors screen. Defaulting to LIVE is deliberate: a wrongly
       live clinic complains about a bill and gets fixed that day, while a
       wrongly demo one is never charged and nobody notices for months. */
    if (overrides.accountType === 'demo') {
      await tenants.setAccountType(db, result.doctorId, 'demo');
    }

    const checkedNow = overrides.registerChecked === true;
    const deadline = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);

    await db.prepare(
      `UPDATE doctors
          SET verification_status = ?, verified_at = ?, verified_by = ?,
              verification_note = ?, verify_by = ?
        WHERE id = ?`
    ).bind(
      checkedNow ? 'verified' : 'pending',
      checkedNow ? nowIso() : null,
      checkedNow ? admin.email : null,
      overrides.reviewNote ||
        (checkedNow ? 'Registration checked against the council register at onboarding.'
                    : 'Onboarded before the council check. Verification due by ' + deadline + '.'),
      checkedNow ? null : deadline,
      result.doctorId
    ).run();

    await db.prepare(
      `UPDATE doctor_applications
          SET status = 'approved', doctor_id = ?, reviewed_by = ?,
              reviewed_at = ?, updated_at = ?,
              review_note = COALESCE(?, review_note)
        WHERE id = ?`
    ).bind(result.doctorId, admin.email, nowIso(), nowIso(),
      overrides.reviewNote == null ? null : overrides.reviewNote, id).run();

    return { ...result, applicationId: id };
  }
};

export const supportRequests = {
  async listForDoctor(db, doctorId) {
    const { results } = await db.prepare(
      `SELECT id, category, subject, message, priority, status, admin_note,
              created_at, updated_at,
              (SELECT COUNT(*) FROM support_messages sm
                WHERE sm.request_id = support_requests.id AND sm.internal = 0) AS message_count
         FROM support_requests WHERE doctor_id = ? ORDER BY created_at DESC`
    ).bind(doctorId).all();
    return results || [];
  },

  async create(db, doctorId, actor, request) {
    const id = newId('sup');
    const said = String(request.message || '').trim().slice(0, 10000);
    await db.batch([
      db.prepare(
        `INSERT INTO support_requests
           (id, doctor_id, created_by, category, subject, message, priority)
         VALUES (?,?,?,?,?,?,?)`
      ).bind(id, doctorId, actor, request.category,
        String(request.subject || '').trim().slice(0, 180), said,
        request.priority || 'normal'),
      db.prepare(
        `INSERT INTO support_messages
           (id, request_id, author_type, author_ref, body)
         VALUES (?,?,?,?,?)`
      ).bind(newId('supmsg'), id, 'clinic', actor, said)
    ]);
    return db.prepare('SELECT * FROM support_requests WHERE id = ? AND doctor_id = ?')
      .bind(id, doctorId).first();
  },

  async listAll(db) {
    const { results } = await db.prepare(
      `SELECT s.id, s.doctor_id, s.category, s.subject, s.message, s.priority,
              s.status, s.admin_note, s.assigned_to, s.first_response_at,
              s.resolved_at, s.created_at, s.updated_at,
              (SELECT COUNT(*) FROM support_messages sm
                WHERE sm.request_id = s.id) AS message_count,
              d.clinic_name, d.full_name AS doctor_name
         FROM support_requests s JOIN doctors d ON d.id = s.doctor_id
     ORDER BY
          CASE s.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
          s.created_at DESC`
    ).all();
    return results || [];
  },

  async update(db, id, { status, adminNote }) {
    const resolvedAt = status === 'resolved' ? nowIso() : null;
    await db.prepare(
      `UPDATE support_requests SET status = COALESCE(?, status),
              admin_note = COALESCE(?, admin_note),
              resolved_at = CASE WHEN ? = 'resolved' THEN ?
                                 WHEN ? IS NOT NULL THEN NULL ELSE resolved_at END,
              updated_at = ?
        WHERE id = ?`
    ).bind(status || null, adminNote == null ? null : adminNote,
      status || null, resolvedAt, status || null, nowIso(), id).run();
    return db.prepare('SELECT * FROM support_requests WHERE id = ?')
      .bind(id).first();
  },

  async detail(db, id, doctorId = null) {
    const request = doctorId
      ? await db.prepare(
        `SELECT s.*, d.clinic_name, d.full_name AS doctor_name
           FROM support_requests s JOIN doctors d ON d.id = s.doctor_id
          WHERE s.id = ? AND s.doctor_id = ?`).bind(id, doctorId).first()
      : await db.prepare(
        `SELECT s.*, d.clinic_name, d.full_name AS doctor_name
           FROM support_requests s JOIN doctors d ON d.id = s.doctor_id
          WHERE s.id = ?`).bind(id).first();
    if (!request) throw notFound('No such support request.');
    const { results } = await db.prepare(
      `SELECT id, author_type, author_ref, body, internal, created_at
         FROM support_messages WHERE request_id = ?
          AND (? IS NULL OR internal = 0)
        ORDER BY created_at, id`
    ).bind(id, doctorId).all();
    const assignees = doctorId ? undefined : await team.supportAssignees(db);
    return { request, messages: results || [], ...(assignees ? { assignees } : {}) };
  },

  async assign(db, id, email) {
    const assignee = email ? await team.byEmail(db, email) : null;
    if (email && (!assignee || !platformCapabilities(assignee).includes('support'))) {
      throw badRequest('Choose an active teammate who has Support access.');
    }
    await db.prepare(
      'UPDATE support_requests SET assigned_to = ?, updated_at = ? WHERE id = ?'
    ).bind(assignee ? assignee.email : null, nowIso(), id).run();
    return this.detail(db, id);
  },

  async reply(db, id, admin, message, { internal = false } = {}) {
    const said = String(message || '').trim();
    if (!said) throw badRequest('Write a reply first.');
    if (said.length > 10000) throw badRequest('Keep the reply under 10,000 characters.');
    const existing = await db.prepare(
      'SELECT id, first_response_at FROM support_requests WHERE id = ?'
    ).bind(id).first();
    if (!existing) throw notFound('No such support request.');
    const at = nowIso();
    await db.batch([
      db.prepare(
        `INSERT INTO support_messages
           (id, request_id, author_type, author_ref, body, internal, created_at)
         VALUES (?,?,?,?,?,?,?)`
      ).bind(newId('supmsg'), id, 'platform', admin.email, said, internal ? 1 : 0, at),
      db.prepare(
        `UPDATE support_requests
            SET first_response_at = COALESCE(first_response_at, ?),
                admin_note = CASE WHEN ? = 0 THEN ? ELSE admin_note END,
                status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END,
                updated_at = ? WHERE id = ?`
      ).bind(at, internal ? 1 : 0, said, at, id)
    ]);
    return this.detail(db, id);
  },

  async replyFromClinic(db, id, doctorId, actor, message) {
    const said = String(message || '').trim();
    if (!said) throw badRequest('Write a reply first.');
    if (said.length > 10000) throw badRequest('Keep the reply under 10,000 characters.');
    const existing = await db.prepare(
      'SELECT id, status FROM support_requests WHERE id = ? AND doctor_id = ?'
    ).bind(id, doctorId).first();
    if (!existing) throw notFound('No such support request.');
    const at = nowIso();
    await db.batch([
      db.prepare(
        `INSERT INTO support_messages
           (id, request_id, author_type, author_ref, body, created_at)
         VALUES (?,?,?,?,?,?)`
      ).bind(newId('supmsg'), id, 'clinic', actor, said, at),
      db.prepare(
        `UPDATE support_requests SET status = 'open', resolved_at = NULL,
                updated_at = ? WHERE id = ?`
      ).bind(at, id)
    ]);
    return this.detail(db, id, doctorId);
  }
};

/* ---------------------------------------------------------------- invites
   How a doctor actually joins: the platform team creates the account and
   hands over a temporary password. No email provider, no SMS, no waiting.
   The doctor is forced to change it the first time they sign in. */

export function generateTempPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return 'T7-' + Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('');
}

export const invites = {
  async createDoctor(db, env, admin, details) {
    const { channel } = details;

    /* A mobile is STORED in the form sign-in LOOKS IT UP in. Sign-in runs the
       typed number through normaliseMobile, so 9812345670 becomes
       +919812345670 before the query. This used to store whatever the
       application form captured, so every doctor approved through the console
       got a row keyed 9812345670, the lookup missed it, and she was told her
       password was wrong. The account existed, the password was correct, and
       she could never get in.

       Nothing caught it because the demo doctors are seeded already
       normalised - every test and every manual sign-in used one of them, and
       approve is the only path that creates an account from typed input. */
    const identifier = channel === 'sms'
      ? (normaliseMobile(details.identifier) || details.identifier)
      : details.identifier;

    const temporaryPassword = details.temporaryPassword || generateTempPassword();
    const { hash, salt } = await hashPassword(temporaryPassword, activePepper(env));
    const id = newId('doc');

    /* Which product she is activated on. Set here and nowhere else: it
       follows the registration the platform just verified, and a doctor
       cannot move herself between products. An unknown value would leave
       her signing into a workspace that does not exist, so it fails closed
       to the default rather than being stored as typed. */
    const product = PRODUCTS.includes(details.product) ? details.product : 'ayurcos';

    await db.prepare(
      `INSERT INTO doctors (id, mobile, mobile_verified, email, full_name, qualification,
        registration_no, council, clinic_name, tagline, address, patient_prefix, practice_packs,
        line, plan, product, password_hash, password_salt, must_change_password)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`
    ).bind(
      id,
      channel === 'sms' ? identifier : 'pending:' + crypto.randomUUID().slice(0, 8),
      channel === 'sms' ? 1 : 0,
      /* Her email, whichever channel the invite went by.
       *
       * This used to be `channel === 'email' ? identifier : null`, so every
       * doctor approved from an application - all of them, because approve()
       * invites by SMS - was created with NO email address, and the address
       * she had typed into the application form was thrown away.
       *
       * That is not a missing nicety. Email is the only working way back
       * into an account while SMS waits on DLT, so those accounts had no
       * recovery path at all: forget the password and the account is gone. */
      details.email || (channel === 'email' ? identifier : null),
      details.fullName, details.qualification || null, details.registrationNo || null,
      details.council || null, details.clinicName, details.tagline || null, details.address || null,
      details.patientPrefix || 'TCOS',
      /* An explicit choice wins, including an explicit empty one - somebody
         who deliberately unticked everything meant it. It is only the
         absence of a choice that falls back to the product's own defaults,
         which is what approval has always sent. */
      JSON.stringify(Array.isArray(details.practicePacks)
        ? details.practicePacks : defaultPacksFor(product)),
      'doctor', details.plan || 'basic', product, hash, salt
    ).run();

    await db.prepare(
      'INSERT INTO doctor_invites (id, doctor_id, invited_by, identifier) VALUES (?,?,?,?)'
    ).bind(newId('inv'), id, admin.email, identifier).run();

    /* Send it to her, rather than making somebody copy it into WhatsApp.
     *
     * Best effort, and deliberately AFTER the account exists: approval has
     * already succeeded and a mail provider having a bad minute must not
     * undo it. So the outcome is REPORTED instead of thrown, and the
     * temporary password is still returned - the console shows it either
     * way, so the owner can fall back to telling her by hand when the
     * email did not go. Silently failing here would be the worst of both:
     * nobody copies it because everybody assumes it was sent. */
    const address = details.email || (channel === 'email' ? identifier : null);
    let emailedTo = null;
    let emailError = null;

    if (address && emailConfigured(env)) {
      try {
        await sendDoctorWelcome(env, {
          to: address,
          fullName: details.fullName,
          clinicName: details.clinicName,
          mobile: channel === 'sms' ? identifier : details.identifier,
          temporaryPassword,
          signInUrl: appOrigin(env) + '/tcos-login.html'
        });
        emailedTo = address;
      } catch (error) {
        emailError = error.message || 'The welcome email could not be sent.';
      }
    } else if (address) {
      emailError = 'Email sending is not configured, so nothing was sent.';
    }

    /* The password is returned once, right now. It is not stored in the
       clear anywhere, so it cannot be looked up again later. */
    return { doctorId: id, temporaryPassword, emailedTo, emailError };
  },

  async reissuePassword(db, env, admin, doctorId) {
    const temporaryPassword = generateTempPassword();
    const { hash, salt } = await hashPassword(temporaryPassword, activePepper(env));
    await db.prepare(
      `UPDATE doctors SET password_hash = ?, password_salt = ?, must_change_password = 1
        WHERE id = ?`
    ).bind(hash, salt, doctorId).run();
    /* Any session opened with the old password stops working. */
    await db.prepare('UPDATE sessions SET revoked_at = ? WHERE doctor_id = ?')
      .bind(nowIso(), doctorId).run();
    return { temporaryPassword };
  }
};

/* ---------------------------------------------------------------- bootstrap
   Kept here rather than in the router so the "no SQL outside the data layer"
   rule holds without exception. The isolation test enforces that. */

export const bootstrap = {
  async anyAdminHasPassword(db) {
    const row = await db.prepare(
      'SELECT 1 AS ok FROM platform_team WHERE password_hash IS NOT NULL LIMIT 1'
    ).first();
    return !!row;
  },

  async setOwnerPassword(db, env, email, password) {
    const member = await team.byEmail(db, email);
    if (!member) throw forbidden('That email is not listed as platform team.');
    const { hash, salt } = await hashPassword(password, activePepper(env));
    await db.prepare(
      'UPDATE platform_team SET password_hash = ?, password_salt = ? WHERE email = ?'
    ).bind(hash, salt, member.email).run();
    return member;
  }
};

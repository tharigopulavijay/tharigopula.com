/* =========================================================================
   Doctors' own domains, from the owner's side.

   Vijay: "i asked right web control i cant see that here in owner page where
   i said right they will request as per page we are getting cost so lets
   charge him that."

   Three questions, one screen:

     WHO ASKED      a doctor without the add-on presses "Ask us to switch it
                    on" on her Web tab, which files a real support request.
                    They are gathered here rather than left to be spotted
                    among general support.

     WHO HAS IT     granted per clinic - custom_domain is in no plan, so the
                    only way to have it is somebody here saying yes. Shown
                    with her domain and what the certificate is doing, so
                    "it isn't working" can be answered without asking her.

     CAPACITY       Cloudflare returns the account's actual hostname quota.
                    Its bill is provider/account specific, so the console
                    shows revenue and capacity without inventing a margin.

   GRANTING IS A MERGE, NEVER A REPLACE. The existing route takes the whole
   feature_overrides object, so a screen that sends only this key would
   silently erase every other override a clinic has. This reads, merges the
   one key, and writes back.
   ========================================================================= */

import { ApiError, nowIso } from '@tharigopula/core/lib';
import * as customHostname from './customhostname.js';

/* What the doctor's screen files when she presses the button. Matched rather
   than guessed at: js/website.js sends exactly this subject. */
export const REQUEST_SUBJECT = 'Own domain add-on';

/* ₹50 a month. One place, and entitlements.js holds the same figure for the
   doctor-facing refusal - test/coupons-and-addons keeps them equal so she is
   never quoted two prices. */
export const ADDON_PAISE = 5000;

const overridesOf = row => {
  try { return JSON.parse(row.feature_overrides || '{}'); } catch (_) { return {}; }
};

export const domainAdmin = {
  async overview(db, env, usdInr) {
    const { results: doctors } = await db.prepare(
      `SELECT id, full_name, clinic_name, plan, status, feature_overrides,
              custom_domain, custom_domain_status, custom_domain_ssl_status,
              custom_domain_active_at, custom_domain_error, public_slug
         FROM doctors
        WHERE status != 'deleted'
        ORDER BY clinic_name`
    ).all();

    /* Open requests for this add-on, newest first. A doctor who asked twice
       appears once - she is one decision, not two. */
    const { results: asked } = await db.prepare(
      `SELECT s.id, s.doctor_id, s.created_at, s.message,
              d.full_name, d.clinic_name, d.plan
         FROM support_requests s
         JOIN doctors d ON d.id = s.doctor_id
        WHERE s.subject = ? AND s.status != 'resolved'
        ORDER BY s.created_at DESC`
    ).bind(REQUEST_SUBJECT).all();

    const granted = (doctors || []).filter(d => overridesOf(d).custom_domain === true);
    const grantedIds = new Set(granted.map(d => d.id));

    const seen = new Set();
    const requests = (asked || []).filter(r => {
      /* Already granted? Then the request is answered, whatever its status.
         Leaving it in the queue invites granting it twice. */
      if (grantedIds.has(r.doctor_id) || seen.has(r.doctor_id)) return false;
      seen.add(r.doctor_id);
      return true;
    }).map(r => ({
      requestId: r.id, doctorId: r.doctor_id, name: r.full_name,
      clinicName: r.clinic_name, plan: r.plan, askedAt: r.created_at
    }));

    let usage = { configured: customHostname.configured(env) };
    try {
      if (usage.configured) usage = await customHostname.usage(env);
    } catch (error) {
      /* Cloudflare being unreachable must not blank the screen the grant
         buttons live on. */
      usage = { configured: true, error: error.detail || error.message };
    }

    const revenuePaise = granted.length * ADDON_PAISE;

    return {
      requests,
      connected: granted.map(d => ({
        doctorId: d.id, name: d.full_name, clinicName: d.clinic_name, plan: d.plan,
        domain: d.custom_domain,
        status: d.custom_domain_status || 'none',
        sslStatus: d.custom_domain_ssl_status,
        error: d.custom_domain_error,
        liveSince: d.custom_domain_active_at,
        /* Granted but never used. Worth seeing: she is being charged ₹50 for
           something she has not set up, which is a refund conversation before
           it is a complaint. */
        unused: !d.custom_domain
      })),
      money: {
        addonPaise: ADDON_PAISE,
        clinics: granted.length,
        revenuePaise,
        /* Provider pricing is account-specific. Do not turn an old public
           price into a false financial statement. */
        costPaise: null,
        marginPaise: null
      },
      usage
    };
  },

  /* Grant or revoke the add-on for one clinic, without disturbing anything
     else she has been given. */
  async setAllowed(db, doctorId, allowed) {
    const row = await db.prepare(
      'SELECT id, feature_overrides, custom_domain FROM doctors WHERE id = ?'
    ).bind(doctorId).first();
    if (!row) throw new ApiError(404, 'not_found', 'No such clinic.');

    const overrides = overridesOf(row);
    if (allowed) overrides.custom_domain = true;
    else delete overrides.custom_domain;

    await db.prepare('UPDATE doctors SET feature_overrides = ? WHERE id = ?')
      .bind(JSON.stringify(overrides), doctorId).run();

    return { doctorId, allowed: !!allowed, hadDomain: !!row.custom_domain };
  },

  /* Answering the request is part of granting it, or the queue never empties
     and the same clinic is granted three times. */
  async closeRequests(db, doctorId, note) {
    await db.prepare(
      `UPDATE support_requests
          SET status = 'resolved', admin_note = ?, updated_at = ?
        WHERE doctor_id = ? AND subject = ? AND status != 'resolved'`
    ).bind(String(note || '').slice(0, 400), nowIso(), doctorId, REQUEST_SUBJECT).run();
  }
};

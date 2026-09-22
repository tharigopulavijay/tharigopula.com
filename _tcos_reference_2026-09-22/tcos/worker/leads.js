/* =========================================================================
   Bookings from everywhere, in one inbox.

   Vijay: "we need to bring the different platforms integration so that
   doctors can track their different lead platforms from one place."

   A doctor in Hyderabad is listed on Practo, on Justdial, on Google, and has
   her own page. Four places to watch, four tabs open, and the one she forgets
   is where the patient waited. This puts all of them in the diary she already
   uses.

   WHAT THIS IS HONEST ABOUT.
   There is no official Practo API for a competing practice-management
   product, and pretending otherwise would put a logo on the screen that does
   nothing. What exists is one authenticated inbound URL per clinic. Anything
   that can POST to it - a Zapier hook off her Practo notification email, a
   Justdial webhook, her own site, the front desk - lands in the same place,
   normalised. When a platform does offer a direct hook, it points here and
   nothing else changes.

   ONE MOBILE IS A HOUSEHOLD - AND THIS IS WHERE THAT NEARLY BROKE.
   The instinct is to upsert the patient on (doctor_id, mobile): booking
   arrives, find-or-create the patient, link them. That is exactly the bug
   that once merged a wife's records into her husband's chart, because in
   India one number is shared by the whole family. A lead therefore creates
   NO patient and links to none. It carries a name and a number, and the
   doctor decides which person that is when she accepts it - which she is
   already doing today for bookings from her own page.
   ========================================================================= */

import { newId, nowIso, badRequest, ApiError, normaliseMobile }
  from '@tharigopula/core/lib';

/* Where a booking can come from. Free text in the database on purpose - a new
   portal appearing should not need a migration - but the ones we know how to
   read are named here so the screen can label them properly. */
export const SOURCES = {
  website: 'Her own page',
  practo: 'Practo',
  justdial: 'Justdial',
  google: 'Google',
  whatsapp: 'WhatsApp',
  phone: 'Phone',
  walk_in: 'Walk-in',
  other: 'Other'
};

/* Each platform spells the same four facts differently, and none of them
   document it. Rather than a parser per platform - which becomes eight
   parsers nobody can test - every known spelling for each fact is listed and
   the first one present wins.

   Adding a platform is adding its field names here. */
const FIELDS = {
  name: ['patient_name', 'patientName', 'name', 'full_name', 'fullName',
         'LeadName', 'customer_name', 'sender_name'],
  mobile: ['patient_phone', 'patientPhone', 'phone', 'mobile', 'Phone',
           'Mobile', 'contact_number', 'phone_number', 'from'],
  when: ['preferred_time', 'appointment_time', 'appointmentTime', 'slot',
         'preferred_on', 'datetime', 'booking_time'],
  reason: ['reason', 'complaint', 'speciality', 'specialty', 'purpose',
           'message', 'query', 'notes'],
  ref: ['booking_id', 'bookingId', 'lead_id', 'leadId', 'id', 'reference',
        'transaction_id']
};

const pick = (payload, names) => {
  for (const name of names) {
    const value = payload[name];
    if (value != null && String(value).trim() !== '') return String(value).trim();
  }
  return null;
};

/* A lead is a name, a number and a time. Nothing clinical travels in, and
   `reason` is capped hard because a platform that sends a paragraph of
   symptoms must not turn a booking row into a medical record we never asked
   for and cannot lawfully hold on that basis. */
export function normalise(payload, declaredSource) {
  const body = (payload && typeof payload === 'object') ? payload : {};
  const source = String(declaredSource || body.source || 'other')
    .toLowerCase().replace(/[^a-z_]/g, '') || 'other';

  const name = pick(body, FIELDS.name);
  const rawMobile = pick(body, FIELDS.mobile);
  if (!name) throw badRequest('That booking has no patient name.');
  if (!rawMobile) throw badRequest('That booking has no mobile number.');

  const mobile = normaliseMobile(rawMobile);
  if (!mobile) throw badRequest('That mobile number is not one we can call back: ' + rawMobile);

  /* A date we cannot read becomes "she asked, ring her" rather than a wrong
     slot in the diary. A booking in the wrong place is worse than a booking
     with no time on it. */
  const whenRaw = pick(body, FIELDS.when);
  let preferredOn = null, preferredTime = null;
  if (whenRaw) {
    const parsed = new Date(whenRaw);
    if (!Number.isNaN(parsed.getTime())) {
      preferredOn = parsed.toISOString().slice(0, 10);
      preferredTime = parsed.toISOString().slice(11, 16);
    } else {
      const date = whenRaw.match(/\d{4}-\d{2}-\d{2}/);
      const time = whenRaw.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
      if (date) preferredOn = date[0];
      if (time) preferredTime = time[0].padStart(5, '0');
    }
  }

  return {
    source,
    fullName: name.slice(0, 120),
    mobile,
    preferredOn,
    preferredTime,
    reason: (pick(body, FIELDS.reason) || '').slice(0, 300) || null,
    externalRef: (pick(body, FIELDS.ref) || '').slice(0, 120) || null,
    /* Kept verbatim: the first time a doctor says "Practo says 4pm and TCOS
       says 4:30", the only useful thing is the bytes that arrived. */
    payload: JSON.stringify(body).slice(0, 4000)
  };
}

export const leads = {
  /* Which clinic owns this webhook secret?
   *
     Looked up BY the secret rather than by a clinic id in the URL, so a
     guessed or enumerated doctor id gets nobody anywhere - the secret is the
     whole credential and there is nothing else to get wrong. */
  async clinicFor(db, secret) {
    const clean = String(secret || '').trim();
    if (clean.length < 20) return null;
    /* plan and feature_overrides come back so the caller can check the
       clinic is still entitled. A doctor who drops to Free keeps a working
       webhook URL otherwise, and a paid capability carries on for free
       because nobody remembered to revoke it. */
    return db.prepare(
      `SELECT id, full_name, clinic_name, status, plan, feature_overrides
         FROM doctors
        WHERE lead_webhook_secret = ? AND status = 'active'`
    ).bind(clean).first();
  },

  /* Turn the inbound URL on, or roll the secret. Long and random: it travels
     in a URL configured at a third party and will end up in their logs. */
  async issueSecret(db, doctorId) {
    const secret = newId('lw') + newId('').replace(/^_/, '');
    await db.prepare('UPDATE doctors SET lead_webhook_secret = ? WHERE id = ?')
      .bind(secret, doctorId).run();
    return secret;
  },

  async revokeSecret(db, doctorId) {
    await db.prepare('UPDATE doctors SET lead_webhook_secret = NULL WHERE id = ?')
      .bind(doctorId).run();
    return { revoked: true };
  },

  /* Take one booking.
   *
     Creates NO patient and links to none - see the header. It lands in the
     same inbox as a booking from her own page, and she decides who it is
     when she accepts it. */
  async accept(db, doctorId, lead) {
    if (lead.externalRef) {
      const already = await db.prepare(
        `SELECT id, status FROM appointment_requests
          WHERE doctor_id = ? AND source = ? AND external_ref = ?`
      ).bind(doctorId, lead.source, lead.externalRef).first();
      /* Every one of these platforms retries when it does not get a clean
         200. A retry must be a no-op, not a second person in the diary. */
      if (already) return { id: already.id, duplicate: true };
    }

    const id = newId('req');
    await db.prepare(
      `INSERT INTO appointment_requests
        (id, doctor_id, full_name, mobile, preferred_on, preferred_time,
         reason, status, source, external_ref, source_payload, created_at)
       VALUES (?,?,?,?,?,?,?,'new',?,?,?,?)`
    ).bind(id, doctorId, lead.fullName, lead.mobile, lead.preferredOn,
      lead.preferredTime, lead.reason, lead.source, lead.externalRef,
      lead.payload, nowIso()).run();

    return { id, duplicate: false };
  },

  /* Her inbox, and where the bookings came from. */
  async summary(db, doctorId, days = 30) {
    const { results } = await db.prepare(
      `SELECT source, COUNT(*) AS total,
              SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) AS waiting,
              SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) AS accepted,
              SUM(CASE WHEN status = 'declined' THEN 1 ELSE 0 END) AS declined
         FROM appointment_requests
        WHERE doctor_id = ? AND created_at >= date('now', ?)
        GROUP BY source
        ORDER BY total DESC`
    ).bind(doctorId, '-' + Math.max(1, Number(days) | 0) + ' days').all();

    const rows = (results || []).map(r => ({
      source: r.source,
      label: SOURCES[r.source] || r.source,
      total: r.total,
      waiting: r.waiting,
      accepted: r.accepted,
      declined: r.declined,
      /* What she is really asking: is this platform worth its fee? A source
         that sends fifty bookings she declines is costing her money. */
      acceptedPercent: r.total ? Math.round(r.accepted / r.total * 100) : 0
    }));

    return {
      days: Math.max(1, Number(days) | 0),
      sources: rows,
      total: rows.reduce((n, r) => n + r.total, 0),
      waiting: rows.reduce((n, r) => n + r.waiting, 0)
    };
  }
};

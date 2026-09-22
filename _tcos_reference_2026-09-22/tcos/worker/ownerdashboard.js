/* =========================================================================
   What the business actually looks like, on one screen.

   Vijay: "as an owner i need to have a dashboard right means complete - how
   many customers are there, which package they are using, attrition rate,
   new joiners, database used by each person, no of messages by each one, no
   of customers by each."

   EVERY NUMBER HERE IS COUNTED, NOT ESTIMATED. Each one names the table it
   comes from, because a dashboard whose figures cannot be traced is a
   dashboard nobody trusts the second it disagrees with the bank.

     clinics        doctors
     package        doctors.plan
     new joiners    doctors.created_at
     attrition      doctors.status, and a paid plan that stopped
     storage        SUM(files.bytes) - the real R2 bytes, per clinic
     messages       messages, by channel
     patients       doctor_patients
     activity       last sign-in, and visits recorded in the last 30 days

   THIS READS ACROSS EVERY CLINIC, WHICH IS THE ONE THING TCOS OTHERWISE
   FORBIDS. So it is declared by name in test/isolation.test.js, exactly like
   platform.platformPatients, and it is held to the same limit: it counts
   clinical rows, and never reads one. There is no diagnosis, no medicine, no
   lab value and no patient name in this file. A business needs to know that
   a clinic recorded 40 visits last month. It does not need to know what was
   wrong with anybody.
   ========================================================================= */

export const ownerDashboard = {
  async summary(db) {
    /* One row per clinic, with everything the owner asked to see beside it.
       One query rather than a dozen per doctor: at a hundred clinics the
       per-doctor version is a hundred round trips to answer one screen.

       WRITTEN INLINE, NOT LIFTED INTO A CONST. test/isolation.test.js finds
       SQL by looking inside db.prepare(...), so a query held in a variable
       is a query that scan never reads - which is how this module first
       slipped past it. Keep it here where the scanner can see it. */
    const { results } = await db.prepare(`
  SELECT d.id, d.full_name, d.clinic_name, d.plan, d.product, d.status,
         d.created_at, d.last_sign_in_at, d.custom_domain, d.custom_domain_status,
         (SELECT COUNT(*) FROM doctor_patients dp WHERE dp.doctor_id = d.id)
           AS patients,
         (SELECT COALESCE(SUM(f.bytes), 0) FROM files f WHERE f.doctor_id = d.id)
           AS storage_bytes,
         (SELECT COUNT(*) FROM messages m WHERE m.doctor_id = d.id)
           AS messages_all,
         (SELECT COUNT(*) FROM messages m
           WHERE m.doctor_id = d.id AND m.channel = 'whatsapp')
           AS messages_whatsapp,
         (SELECT COUNT(*) FROM messages m
           WHERE m.doctor_id = d.id AND m.channel = 'sms')
           AS messages_sms,
         (SELECT COUNT(*) FROM messages m
           WHERE m.doctor_id = d.id AND m.channel = 'email')
           AS messages_email,
         (SELECT COUNT(*) FROM visits v
           WHERE v.doctor_id = d.id AND v.visited_on >= date('now','-30 days'))
           AS visits_30d,
         (SELECT COUNT(*) FROM prescriptions p
           WHERE p.doctor_id = d.id AND p.created_at >= date('now','-30 days'))
           AS prescriptions_30d,
         (SELECT COUNT(*) FROM clinic_users u
           WHERE u.doctor_id = d.id AND u.status = 'active')
           AS staff,
         /* WHEN SHE LAST DID WORK - a timestamp, never a record.
          *
            Vijay: "anjan has reset the password, thats it. that doesn't
            mean you are resetting his usage data."
          *
            He was right and it was worse than he said. Engagement was read
            off last_sign_in_at alone, and the password-reset flow signs her
            straight back in - so a reset wrote a fresh timestamp and the
            screen reported a clinic as freshly active seventeen seconds
            after somebody had merely got locked out. Opening the door is
            not using the room.
          *
            So work is measured from the things she actually DID. Six
            tables, listed by name rather than inferred from audit_events:
            a new kind of audit line would otherwise default to counting as
            work, which is precisely the failure being fixed.
          *
            These are MAX(timestamp) and nothing else. This file may count
            clinical rows and may know WHEN one was written. It still never
            reads one. */
         (SELECT MAX(v.created_at) FROM visits v WHERE v.doctor_id = d.id)
           AS last_visit_at,
         (SELECT MAX(p.created_at) FROM prescriptions p WHERE p.doctor_id = d.id)
           AS last_rx_at,
         (SELECT MAX(i.created_at) FROM invoices i WHERE i.doctor_id = d.id)
           AS last_invoice_at,
         (SELECT MAX(a.created_at) FROM appointments a WHERE a.doctor_id = d.id)
           AS last_appointment_at,
         (SELECT MAX(dp.first_seen_on) FROM doctor_patients dp WHERE dp.doctor_id = d.id)
           AS last_patient_at,
         (SELECT MAX(l.created_at) FROM lab_reports l WHERE l.doctor_id = d.id)
           AS last_lab_at
    FROM doctors d
   ORDER BY d.created_at DESC`).all();

/* TWO DATE SHAPES LIVE IN THIS DATABASE and they do not parse the same
   way. Rows written by the Worker are ISO with a Z; rows written by
   SQLite's own CURRENT_TIMESTAMP are "2026-09-19 08:56:39" - no zone, and
   Date.parse reads that as LOCAL time. On a machine at +05:30 that is a
   five and a half hour error, which is enough to move a clinic across a
   day boundary and change what this screen says about it. */
function parseStamp(value) {
  if (!value) return null;
  const text = String(value).trim();
  /* A bare date is midnight UTC: the conservative reading, since it can
     only ever make activity look older than it was, never newer. */
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return Date.parse(text + 'T00:00:00Z');
  const hasZone = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(text);
  const at = Date.parse(text.replace(' ', 'T') + (hasZone ? '' : 'Z'));
  return Number.isNaN(at) ? null : at;
}

/* The six things that count as having done work. */
const WORK_STAMPS = ['last_visit_at', 'last_rx_at', 'last_invoice_at',
  'last_appointment_at', 'last_patient_at', 'last_lab_at'];

function lastWorkAt(row) {
  let newest = null;
  for (const key of WORK_STAMPS) {
    const at = parseStamp(row[key]);
    if (at !== null && (newest === null || at > newest)) newest = at;
  }
  return newest;
}

/* A clinic that is two days old has not "gone quiet". */
const SETTLING_IN_DAYS = 14;

/* IS SHE USING IT - measured by what she did, not by the door opening.
 *
   The order matters and each rung answers a different question:

     active    she recorded something this week
     new       she joined days ago; there is nothing to worry about yet
     slipping  she is still opening it, but has stopped recording - this is
               the rung that predicts churn, and it is why signing in is
               kept as a signal rather than thrown away
     dormant   neither, for over a month
     never     she has not signed in once since being approved

   Sign-in alone can no longer reach `active`. That is the whole fix: a
   password reset signs her back in, and used to be indistinguishable from
   a full day's clinic. */
function engagement(row, now = Date.now()) {
  const asDays = at => (at === null ? null : Math.floor((now - at) / 86400000));

  const workedAt = lastWorkAt(row);
  const sinceSignIn = asDays(parseStamp(row.last_sign_in_at));
  const sinceWork = asDays(workedAt);
  const sinceJoined = asDays(parseStamp(row.created_at));

  const seen = {
    daysSinceSignIn: sinceSignIn,
    daysSinceWork: sinceWork,
    lastWorkAt: workedAt === null ? null : new Date(workedAt).toISOString()
  };

  if (sinceSignIn === null) return { state: 'never', ...seen };
  if (sinceWork !== null && sinceWork <= 7) return { state: 'active', ...seen };
  if (sinceJoined !== null && sinceJoined <= SETTLING_IN_DAYS) {
    return { state: 'new', ...seen };
  }
  if ((sinceWork !== null && sinceWork <= 30) || sinceSignIn <= 30) {
    return { state: 'slipping', ...seen };
  }
  return { state: 'dormant', ...seen };
}

const PAID = new Set(['starter', 'pro', 'pro_plus', 'clinic']);

    const clinics = (results || []).map(row => ({
      id: row.id,
      name: row.full_name,
      clinicName: row.clinic_name,
      plan: row.plan || 'basic',
      product: row.product,
      status: row.status,
      joinedOn: row.created_at,
      lastSignInAt: row.last_sign_in_at,
      customDomain: row.custom_domain,
      customDomainStatus: row.custom_domain_status,
      patients: row.patients,
      staff: row.staff,
      storageBytes: row.storage_bytes,
      messages: {
        total: row.messages_all,
        whatsapp: row.messages_whatsapp,
        sms: row.messages_sms,
        email: row.messages_email
      },
      visits30d: row.visits_30d,
      prescriptions30d: row.prescriptions_30d,
      ...engagement(row)
    }));

    /* ---- the headline numbers ---- */
    const byPlan = {};
    for (const c of clinics) {
      byPlan[c.plan] = (byPlan[c.plan] || 0) + 1;
    }

    const now = Date.now();
    /* Through parseStamp, not Date.parse. created_at is written by SQLite
       as "2026-09-19 08:56:39" with no zone, which Date.parse reads as
       local time - five and a half hours of drift on this laptop, enough to
       move a clinic in or out of "joined this week". */
    const within = (iso, days) => {
      const at = parseStamp(iso);
      return at !== null && (now - at) <= days * 86400000;
    };

    const active = clinics.filter(c => c.status === 'active');
    const paying = active.filter(c => PAID.has(c.plan));
    const lost = clinics.filter(c => c.status === 'suspended');

    /* Attrition as a rate needs a denominator, and "everyone who ever
       signed up" flatters it forever. This is the share of clinics that
       were here 30 days ago and are suspended now. With a handful of
       clinics the percentage is noise, so the counts are given too and the
       screen shows the rate only once there is enough to mean anything. */
    const thirtyDaysAgo = clinics.filter(c => !within(c.joinedOn, 30));
    const churnedOfThose = thirtyDaysAgo.filter(c => c.status === 'suspended');

    return {
      totals: {
        clinics: clinics.length,
        active: active.length,
        paying: paying.length,
        free: active.length - paying.length,
        suspended: lost.length,
        patients: clinics.reduce((n, c) => n + c.patients, 0),
        storageBytes: clinics.reduce((n, c) => n + c.storageBytes, 0),
        messages: clinics.reduce((n, c) => n + c.messages.total, 0)
      },
      byPlan,
      joiners: {
        last7: clinics.filter(c => within(c.joinedOn, 7)).length,
        last30: clinics.filter(c => within(c.joinedOn, 30)).length,
        last90: clinics.filter(c => within(c.joinedOn, 90)).length
      },
      attrition: {
        suspended: churnedOfThose.length,
        outOf: thirtyDaysAgo.length,
        /* Null rather than a made-up 0% when there is nothing to divide by.
           A dashboard that prints "0% churn" over two customers is lying
           with arithmetic. */
        rate: thirtyDaysAgo.length >= 10
          ? Number((churnedOfThose.length / thirtyDaysAgo.length * 100).toFixed(1))
          : null,
        meaningful: thirtyDaysAgo.length >= 10
      },
      engagement: {
        active: clinics.filter(c => c.state === 'active').length,
        /* Settling in is its own number, not a share of "going quiet".
           Folding the two together is how a week-old customer ends up on a
           list of people to ring about leaving. */
        settling: clinics.filter(c => c.state === 'new').length,
        slipping: clinics.filter(c => c.state === 'slipping').length,
        dormant: clinics.filter(c => c.state === 'dormant').length,
        never: clinics.filter(c => c.state === 'never').length
      },
      clinics
    };
  }
};

/* =========================================================================
   When the clinic is open.

   Two separate things, kept separate on purpose:

     the weekly pattern   what a normal week looks like. Changes rarely.
     closures             "I am away on the 14th". Changes constantly, and
                          expires by itself.

   Folding the second into the first is the obvious shortcut and it is wrong:
   a doctor who closes Thursday for a wedding by editing her weekly hours has
   to remember to put Thursday back. She will not, and her clinic will look
   shut every Thursday for a month before a patient tells her.
   ========================================================================= */

import { newId, badRequest, notFound } from '@tharigopula/core/lib';

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const minutes = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/* One session, validated. A close before an open is the commonest typo and
   produces a day that is open for negative time, so it is rejected rather
   than silently swapped - swapping would hide the mistake from the doctor. */
function cleanSession(raw, day) {
  const open = String((raw && raw.open) || '').trim();
  const close = String((raw && raw.close) || '').trim();
  if (!TIME.test(open) || !TIME.test(close)) {
    throw badRequest('Use 24-hour times like 09:00 and 13:30 (' + day + ').');
  }
  if (minutes(close) <= minutes(open)) {
    throw badRequest('On ' + day + ', the closing time must be after the opening time.');
  }
  return { open, close };
}

/* Sessions for one day: sorted, and checked for overlap. Two sittings that
   overlap mean the appointment slots would be offered twice. */
export function cleanSessions(list, day) {
  const sessions = (Array.isArray(list) ? list : [])
    .map(s => cleanSession(s, day))
    .sort((a, b) => minutes(a.open) - minutes(b.open));

  if (sessions.length > 4) throw badRequest('Four sittings in a day is already a lot (' + day + ').');

  for (let i = 1; i < sessions.length; i++) {
    if (minutes(sessions[i].open) < minutes(sessions[i - 1].close)) {
      throw badRequest('Two sittings on ' + day + ' overlap. Give the second one a later start.');
    }
  }
  return sessions;
}

/* Rows written before migration 015 hold one {open, close} pair per day
   instead of a session list. They are upgraded here, on read, rather than by
   a bulk UPDATE: the SQL to do it needs a seven-branch UNION per row and D1
   rejects that with "too many terms in compound SELECT". Reading it costs
   nothing and cannot half-apply.

   Without this the old shape would produce a day with no sittings, which
   cleanWeek treats as closed - so every doctor who had hours set would have
   silently lost them and appeared shut all week. */
function sessionsOf(value, day) {
  if (Array.isArray(value.sessions)) return cleanSessions(value.sessions, day);
  if (value.open && value.close) return cleanSessions([{ open: value.open, close: value.close }], day);
  return [];
}

export function cleanWeek(input) {
  const week = {};
  for (const day of DAYS) {
    const value = (input && input[day]) || {};
    const sessions = value.closed ? [] : sessionsOf(value, day);
    /* A day with no sittings IS closed, whatever the flag said. Otherwise a
       doctor who deletes both sittings gets a day that claims to be open
       with no hours, and the public page shows a blank. */
    week[day] = { closed: value.closed === true || sessions.length === 0, sessions };
  }
  return week;
}

/* What a patient reads. Consecutive days with identical hours collapse, so
   it says "Mon-Fri 9:00-13:00, 17:00-20:00" rather than listing five
   identical lines. */
export function describeWeek(week) {
  const label = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
  const of = day => {
    const d = week[day];
    if (!d || d.closed || !d.sessions.length) return 'Closed';
    return d.sessions.map(s => s.open + '-' + s.close).join(', ');
  };

  const parts = [];
  let runStart = 0;
  for (let i = 1; i <= DAYS.length; i++) {
    if (i < DAYS.length && of(DAYS[i]) === of(DAYS[runStart])) continue;
    const hours = of(DAYS[runStart]);
    if (hours !== 'Closed') {
      const span = runStart === i - 1
        ? label[DAYS[runStart]]
        : label[DAYS[runStart]] + '-' + label[DAYS[i - 1]];
      parts.push(span + ' ' + hours);
    }
    runStart = i;
  }
  return parts.join(' · ') || 'By appointment';
}

/* ------------------------------------------------------------- closures */

export const closures = {
  async list(db, doctorId, { includePast = false } = {}) {
    const { results } = await db.prepare(
      `SELECT * FROM clinic_closures
        WHERE doctor_id = ?` + (includePast ? '' : " AND ends_on >= date('now')") +
      ' ORDER BY starts_on LIMIT 200'
    ).bind(doctorId).all();
    return results || [];
  },

  async add(db, doctorId, { startsOn, endsOn, reason, sessions }) {
    const from = String(startsOn || '').trim();
    const to = String(endsOn || from).trim();
    if (!DATE.test(from) || !DATE.test(to)) throw badRequest('Choose the dates you are closed.');
    if (to < from) throw badRequest('The last day cannot be before the first day.');

    /* A half day is stored as sessions; a full closure stores none. */
    const half = sessions && sessions.length
      ? JSON.stringify(cleanSessions(sessions, from)) : null;

    const id = newId('cls');
    await db.prepare(
      `INSERT INTO clinic_closures (id, doctor_id, starts_on, ends_on, reason, sessions)
       VALUES (?,?,?,?,?,?)`
    ).bind(id, doctorId, from, to,
      reason ? String(reason).trim().slice(0, 120) : null, half).run();

    return db.prepare('SELECT * FROM clinic_closures WHERE id = ? AND doctor_id = ?')
      .bind(id, doctorId).first();
  },

  async remove(db, doctorId, id) {
    const row = await db.prepare(
      'SELECT id FROM clinic_closures WHERE id = ? AND doctor_id = ?').bind(id, doctorId).first();
    if (!row) throw notFound('That closure is not on your calendar.');
    await db.prepare('DELETE FROM clinic_closures WHERE id = ? AND doctor_id = ?')
      .bind(id, doctorId).run();
    return { removed: id };
  },

  /* Is the clinic open on a given date, and on what hours? Used by the
     public page, and by the diary before it offers a slot. */
  async on(db, doctorId, date, week) {
    const closure = await db.prepare(
      `SELECT * FROM clinic_closures
        WHERE doctor_id = ? AND starts_on <= ? AND ends_on >= ?
        ORDER BY starts_on LIMIT 1`
    ).bind(doctorId, date, date).first();

    if (closure) {
      let sessions = [];
      try { sessions = closure.sessions ? JSON.parse(closure.sessions) : []; } catch (_) {}
      return {
        open: sessions.length > 0,
        sessions,
        reason: closure.reason || 'Closed',
        exceptional: true
      };
    }

    const day = DAYS[(new Date(date + 'T00:00:00Z').getUTCDay() + 6) % 7];
    const pattern = (week && week[day]) || { closed: true, sessions: [] };
    return {
      open: !pattern.closed && pattern.sessions.length > 0,
      sessions: pattern.sessions || [],
      reason: pattern.closed ? 'Closed' : null,
      exceptional: false
    };
  }
};

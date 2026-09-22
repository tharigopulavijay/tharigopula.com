/* =========================================================================
   What the practice has actually been doing.

   Nothing here records anything. Every number is counted out of rows that
   already exist - visits, prescriptions, patients, payments - so a report can
   never disagree with the screen it came from, and there is no second copy of
   the truth to go stale.

   Every query names doctor_id, like everything else that touches a clinic's
   data. A report that quietly summed across doctors would be the worst
   possible place to leak, because the number looks plausible either way.
   ========================================================================= */

import { newId } from '@tharigopula/core/lib';

export const reports = {

  /* The four figures a doctor would give if you asked how the month went. */
  async practice(db, doctorId, from, to) {
    const visits = await db.prepare(
      `SELECT COUNT(*) AS n, COUNT(DISTINCT patient_id) AS people
         FROM visits WHERE doctor_id = ? AND visited_on BETWEEN ? AND ?`
    ).bind(doctorId, from, to).first();

    const rx = await db.prepare(
      `SELECT COUNT(*) AS n FROM prescriptions
        WHERE doctor_id = ? AND status = 'issued' AND issued_on BETWEEN ? AND ?`
    ).bind(doctorId, from, to).first();

    /* Attendance, which is the number that actually moves the business: an
       empty slot costs the same as a full one. */
    const appts = await db.prepare(
      `SELECT COUNT(*) AS booked,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS seen,
              SUM(CASE WHEN status = 'no_show'   THEN 1 ELSE 0 END) AS missed
         FROM appointments WHERE doctor_id = ? AND scheduled_on BETWEEN ? AND ?`
    ).bind(doctorId, from, to).first();

    const booked = appts.booked || 0;
    return {
      visits: visits.n || 0,
      patientsSeen: visits.people || 0,
      prescriptions: rx.n || 0,
      booked,
      seen: appts.seen || 0,
      missed: appts.missed || 0,
      /* Null rather than zero when nothing was booked: "0% missed" out of no
         appointments reads like a fact and is not one. */
      missedRate: booked ? Math.round((appts.missed || 0) / booked * 1000) / 10 : null
    };
  },

  /* People whose FIRST visit to this clinic fell in the period.

     Not "new patients": someone added to her list but not yet seen has no
     first visit, and counting them would inflate the figure with people who
     have never walked in. The screen uses the same words. */
  async firstVisits(db, doctorId, from, to) {
    const row = await db.prepare(
      `SELECT COUNT(*) AS n FROM doctor_patients
        WHERE doctor_id = ? AND first_seen_on BETWEEN ? AND ?`
    ).bind(doctorId, from, to).first();
    return row ? row.n || 0 : 0;
  },

  /* What she reaches for most. Useful for two different reasons at once:
     it tells her what to keep in stock, and it tells her what her practice
     has quietly become. */
  async topMedicines(db, doctorId, from, to, limit = 8) {
    const { results } = await db.prepare(
      `SELECT pi.medicine_name AS name, pi.system, COUNT(*) AS n
         FROM prescription_items pi
         JOIN prescriptions p
           ON p.id = pi.prescription_id AND p.doctor_id = pi.doctor_id
        WHERE pi.doctor_id = ? AND p.status = 'issued'
          AND p.issued_on BETWEEN ? AND ?
     GROUP BY LOWER(pi.medicine_name), pi.system
     ORDER BY n DESC, name LIMIT ?`
    ).bind(doctorId, from, to, limit).all();
    return results || [];
  },

  async topDiagnoses(db, doctorId, from, to, limit = 8) {
    const { results } = await db.prepare(
      `SELECT TRIM(diagnosis) AS name, COUNT(*) AS n
         FROM visits
        WHERE doctor_id = ? AND visited_on BETWEEN ? AND ?
          AND diagnosis IS NOT NULL AND TRIM(diagnosis) != ''
     GROUP BY LOWER(TRIM(diagnosis))
     ORDER BY n DESC, name LIMIT ?`
    ).bind(doctorId, from, to, limit).all();
    return results || [];
  }
};

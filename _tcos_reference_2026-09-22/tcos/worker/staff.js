/* =========================================================================
   Staff accounts, and what each of them may do.

   The tenant boundary has not moved. A staff account belongs to exactly one
   doctor, every clinical query still filters by that doctor's id, and none of
   the isolation rules in repo.js change.

   What this file adds is the second question. The first is "whose data is
   this?", answered by the session. The second is "may THIS PERSON see it?",
   answered here.

   The capability list is deliberately short and deliberately blunt. A long
   permission matrix looks impressive and is impossible to reason about; the
   only line that really matters is that nobody but the doctor reads a
   clinical note, and a short list makes that obvious at a glance.
   ========================================================================= */

import { newId, nowIso, badRequest, forbidden, notFound } from '@tharigopula/core/lib';

/* Named so a route reads like a sentence: requireCan(actor, CAN.WRITE_NOTES) */
export const CAN = {
  APPOINTMENTS: 'appointments',   // the diary, arrivals, requests
  PATIENTS:     'patients',       // add someone, edit their details
  VITALS:       'vitals',         // BP, pulse, weight - taken by staff
  PHARMACY:     'pharmacy',       // stock, batches, dispensing
  READ_NOTES:   'read_notes',     // diagnosis, notes, prescriptions, reports
  WRITE_NOTES:  'write_notes',    // writing and issuing them
  BILLING:      'billing',        // raise a bill, take the money
  REPORTS:      'reports',        // what the practice earned and treated
  SETTINGS:     'settings',       // the practice itself
  TEAM:         'team'            // who has access
};

/* The doctor is not in this table. She is not a role with a long list of
   permissions - she is the practice, and the code says so by never asking. */
const ROLES = {
  front_desk: {
    label: 'Front desk',
    blurb: 'Books patients, checks them in and takes payment. Cannot open a clinical record.',
    can: [CAN.APPOINTMENTS, CAN.PATIENTS, CAN.BILLING]
  },
  pharmacist: {
    label: 'Pharmacist',
    blurb: 'Runs the stock, hands medicines over and bills for them. Cannot open a clinical record.',
    can: [CAN.PHARMACY, CAN.PATIENTS, CAN.BILLING]
  },
  assistant: {
    label: 'Clinical assistant',
    blurb: 'Books patients and records vitals. Cannot open a clinical record.',
    can: [CAN.APPOINTMENTS, CAN.PATIENTS, CAN.VITALS]
  },

  /* A second (or fifth) doctor in the same practice - see migration 018.

     Deliberately NOT reachable from the capability tick-list. Everything
     above is a job the doctor hands out; this is another doctor, and giving
     someone the clinical record has to be a decision with a registration
     number attached rather than a checkbox somebody finds on a Tuesday.

     Kept out of ASSIGNABLE below for exactly that reason: rule 2 says no
     member of staff can open a clinical record, and the way that rule dies
     is by a tick appearing next to it. */
  practitioner: {
    label: 'Doctor',
    blurb: 'Another doctor in this practice. Sees patients, writes notes and issues prescriptions under their own registration number.',
    clinical: true,
    can: [CAN.APPOINTMENTS, CAN.PATIENTS, CAN.VITALS,
      CAN.READ_NOTES, CAN.WRITE_NOTES, CAN.BILLING]
  }
};

/* A role is the sensible starting point; the doctor may then combine the
   operational duties one real person performs. Clinical notes remain outside
   this list deliberately: patient details are not clinical judgement. */
const ASSIGNABLE = [CAN.APPOINTMENTS, CAN.PATIENTS, CAN.VITALS,
  CAN.PHARMACY, CAN.BILLING];

export const roleList = () => Object.entries(ROLES)
  .map(([id, r]) => ({ id, label: r.label, blurb: r.blurb, can: r.can,
    /* Marks the roles that are another doctor rather than staff. The Team
       screen uses it to keep them out of the tick-list, and the tests use
       it to exempt them from "staff cannot open a clinical record" by
       intent rather than by name. */
    clinical: r.clinical === true,
    assignable: ASSIGNABLE }));

export const roleLabel = id => (ROLES[id] || {}).label || id;

/* An actor is either the doctor herself or one of her staff. Everything
   downstream asks this object, never the session, never the request. */
export function actorFor(doctor, user) {
  if (!user) {
    return {
      doctorId: doctor.id, userId: null, isDoctor: true,
      name: doctor.full_name, role: 'doctor', roleLabel: 'Doctor',
      isPractitioner: false,
      registrationNo: doctor.registration_no || null,
      qualification: doctor.qualification || null,
      verified: doctor.verification_status === 'verified',
      /* The staff branch below reports this; the doctor branch did not, so
         it read as undefined and every screen saw false. The effect was that
         a DOCTOR was never asked to replace the temporary password she was
         handed, while her own receptionist was. That password stayed valid
         indefinitely, and everyone who saw the handover screen still knew
         it. */
      mustChangePassword: !!doctor.must_change_password,
      can: () => true
    };
  }
  let chosen = null;
  try { chosen = user.capabilities ? JSON.parse(user.capabilities) : null; } catch (_) {}

  /* A practitioner's permissions come from the role, never from the stored
     tick-list. Reading capabilities here would mean a saved array could
     grant READ_NOTES to anyone whose row happened to hold it - and the
     filter below only removes what is not ASSIGNABLE, which is precisely
     the clinical capabilities. Fail closed by not looking. */
  const preset = (ROLES[user.role] || { can: [] });
  const allowed = new Set(preset.clinical || !Array.isArray(chosen)
    ? preset.can
    : chosen.filter(capability => ASSIGNABLE.includes(capability)));
  return {
    doctorId: doctor.id, userId: user.id, isDoctor: false,
    name: user.full_name, role: user.role, roleLabel: roleLabel(user.role),
    /* A practitioner signs their own work. Prescriptions and notes carry
       this rather than the clinic owner's name, and their registration
       number only prints once we have checked it. */
    isPractitioner: preset.clinical === true,
    registrationNo: user.registration_no || null,
    qualification: user.qualification || null,
    verified: user.verification_status === 'verified',
    mustChangePassword: !!user.must_change_password,
    can: capability => allowed.has(capability)
  };
}

/* One canonical audit identity for every clinic action. The clinic owner,
   another doctor and operational staff are different legal actors even
   though they all share the same tenant boundary. Keeping this in one
   helper prevents a staff route from quietly attributing work to the owner
   (and prevents practitioners being flattened into "staff"). */
export function actorKey(doctor) {
  const actor = doctor && doctor.actor;
  if (!actor || !actor.userId) return 'doctor:' + doctor.id;
  return (actor.isPractitioner ? 'practitioner:' : 'staff:') + actor.userId;
}

export function requireCan(actor, capability) {
  if (actor.can(capability)) return;
  /* Says what is missing, not who they are. A member of staff who hits this
     should understand it is the role, not a mistake they made. */
  throw forbidden('Your role (' + actor.roleLabel + ') cannot do this. Ask the doctor.');
}

/* --------------------------------------------------------------- storage */

export const staff = {
  async listFor(db, doctorId) {
    const { results } = await db.prepare(
      `SELECT id, full_name, mobile, role, capabilities, status, must_change_password,
              qualification, registration_no, council, verification_status,
              created_at, last_sign_in_at
         FROM clinic_users WHERE doctor_id = ? ORDER BY created_at`
    ).bind(doctorId).all();
    return results || [];
  },

  async byId(db, doctorId, id) {
    return db.prepare(
      'SELECT * FROM clinic_users WHERE id = ? AND doctor_id = ?'
    ).bind(id, doctorId).first();
  },

  /* Sign-in looks a number up across every clinic, because the person typing
     it has not told us which clinic they belong to - their account has. */
  async byMobile(db, mobile) {
    return db.prepare(
      "SELECT * FROM clinic_users WHERE mobile = ? AND status = 'active'"
    ).bind(mobile).first();
  },

  async create(db, doctorId, { fullName, mobile, role, passwordHash, passwordSalt,
                               qualification, registrationNo, council }) {
    if (!ROLES[role]) throw badRequest('Choose a role for this person.');
    if (!fullName) throw badRequest('Enter their name.');

    /* A practitioner issues prescriptions under their own number, so we
       take it at the point of adding them - not as an optional field they
       fill in later, because the first prescription would go out without
       it. They start unverified: the number is theirs to state and ours to
       check, and it does not print until we have. */
    const clinical = ROLES[role].clinical === true;
    if (clinical && !registrationNo) {
      throw badRequest('A doctor needs their own council registration number.');
    }

    const id = newId('usr');
    try {
      await db.prepare(
        `INSERT INTO clinic_users (id, doctor_id, full_name, mobile, role,
           qualification, registration_no, council,
           password_hash, password_salt, must_change_password)
         VALUES (?,?,?,?,?,?,?,?,?,?,1)`
      ).bind(id, doctorId, fullName, mobile, role,
        clinical ? (qualification || null) : null,
        clinical ? registrationNo : null,
        clinical ? (council || null) : null,
        passwordHash, passwordSalt).run();
    } catch (error) {
      if (String(error.message || '').includes('UNIQUE')) {
        throw badRequest('That mobile number already has a TCOS account.');
      }
      throw error;
    }
    return this.byId(db, doctorId, id);
  },

  async setPassword(db, doctorId, userId, hash, salt) {
    await db.batch([
      db.prepare(
        `UPDATE clinic_users SET password_hash = ?, password_salt = ?,
           must_change_password = 0 WHERE id = ? AND doctor_id = ?`
      ).bind(hash, salt, userId, doctorId),
      db.prepare(
        `UPDATE sessions SET revoked_at = ?
          WHERE doctor_id = ? AND user_id = ? AND revoked_at IS NULL`
      ).bind(nowIso(), doctorId, userId)
    ]);
  },

  async rehashPassword(db, userId, hash, salt) {
    await db.prepare(
      'UPDATE clinic_users SET password_hash = ?, password_salt = ? WHERE id = ?'
    ).bind(hash, salt, userId).run();
  },

  /* A temporary password does not clear must_change_password - that is the
     whole point of it. */
  async resetPassword(db, doctorId, userId, hash, salt) {
    const user = await this.byId(db, doctorId, userId);
    if (!user) throw notFound('That person is not on your team.');
    await db.batch([
      db.prepare(
        `UPDATE clinic_users SET password_hash = ?, password_salt = ?,
           must_change_password = 1 WHERE id = ? AND doctor_id = ?`
      ).bind(hash, salt, userId, doctorId),
      db.prepare(
        `UPDATE sessions SET revoked_at = ?
          WHERE doctor_id = ? AND user_id = ? AND revoked_at IS NULL`
      ).bind(nowIso(), doctorId, userId)
    ]);
    return user;
  },

  async setStatus(db, doctorId, userId, status) {
    const user = await this.byId(db, doctorId, userId);
    if (!user) throw notFound('That person is not on your team.');
    await db.prepare(
      'UPDATE clinic_users SET status = ? WHERE id = ? AND doctor_id = ?'
    ).bind(status, userId, doctorId).run();
    /* Revoking access has to end the sessions they already hold, or they stay
       signed in until the token expires - which is not what "revoke" means to
       the doctor who just clicked it. */
    if (status === 'revoked') {
      await db.prepare(
        'UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL'
      ).bind(nowIso(), userId).run();
    }
    return user;
  },

  async setCapabilities(db, doctorId, userId, capabilities) {
    const user = await this.byId(db, doctorId, userId);
    if (!user) throw notFound('That person is not on your team.');
    const allowed = Array.from(new Set((capabilities || [])
      .filter(capability => ASSIGNABLE.includes(capability))));
    if (!allowed.length) throw badRequest('Choose at least one responsibility.');
    await db.prepare(
      'UPDATE clinic_users SET capabilities = ? WHERE id = ? AND doctor_id = ?'
    ).bind(JSON.stringify(allowed), userId, doctorId).run();
    return this.byId(db, doctorId, userId);
  },

  async markSignedIn(db, userId) {
    await db.prepare('UPDATE clinic_users SET last_sign_in_at = ? WHERE id = ?')
      .bind(nowIso(), userId).run();
  }
};

/* A temporary password a person can read down a phone line without spelling
   anything out. No look-alike characters, because "l" and "1" get typed wrong
   and the person then believes the account is broken. */
export function temporaryPassword() {
  const words = ['clinic', 'garden', 'lotus', 'river', 'silver', 'mango',
    'copper', 'ginger', 'temple', 'monsoon', 'jasmine', 'sandal'];
  const pick = () => words[crypto.getRandomValues(new Uint32Array(1))[0] % words.length];
  const digits = String(crypto.getRandomValues(new Uint32Array(1))[0] % 9000 + 1000);
  return pick() + '-' + pick() + '-' + digits;
}

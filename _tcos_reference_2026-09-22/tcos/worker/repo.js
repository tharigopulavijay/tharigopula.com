/* =========================================================================
   THE DATA LAYER - the only place in TCOS that builds SQL.

   D1 has no row-level security. That protection has to live somewhere, and
   this file is it. The rules:

     1. Every function that touches a clinical table takes `doctorId` as its
        FIRST argument, and the SQL includes "WHERE doctor_id = ?".
     2. No route handler ever calls db.prepare() directly. If a query is
        needed, it gets a function here.
     3. Cross-doctor reads happen only through the consented* functions,
        which check for a live grant and write an access log line.
     4. test/isolation.test.js proves 1-3 and has to stay green.

   Read that list again before adding anything. One query without the
   doctor_id clause silently joins every doctor's patients together, and
   nothing in the interface will look wrong.
   ========================================================================= */

import { newId, nowIso, plusHours, isPast, notFound, forbidden, badRequest } from '@tharigopula/core/lib';

const changedRows = result => Number(result &&
  (result.meta ? result.meta.changes : result.changes) || 0);

/* ------------------------------------------------------------------ doctors */

export const doctors = {
  async byId(db, id) {
    return db.prepare('SELECT * FROM doctors WHERE id = ?').bind(id).first();
  },

  async byMobile(db, mobile) {
    return db.prepare('SELECT * FROM doctors WHERE mobile = ?').bind(mobile).first();
  },

  async byEmail(db, email) {
    return db.prepare('SELECT * FROM doctors WHERE email = ?').bind(email).first();
  },

  async create(db, doctor) {
    const id = doctor.id || newId('doc');
    await db.prepare(
      `INSERT INTO doctors (id, mobile, mobile_verified, email, full_name, qualification,
        registration_no, clinic_name, tagline, address, website, patient_prefix,
        practice_packs, line, plan, password_hash, password_salt, must_change_password)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      id, doctor.mobile, doctor.mobileVerified ? 1 : 0, doctor.email || null,
      doctor.fullName, doctor.qualification || null, doctor.registrationNo || null,
      doctor.clinicName, doctor.tagline || null, doctor.address || null,
      doctor.website || null, doctor.patientPrefix || 'TCOS',
      JSON.stringify(doctor.practicePacks || []), 'doctor', doctor.plan || 'basic',
      doctor.passwordHash || null, doctor.passwordSalt || null,
      doctor.mustChangePassword ? 1 : 0
    ).run();
    return this.byId(db, id);
  },

  /* Only ever updates the signed-in doctor's own row. */
  async updateSelf(db, doctorId, patch) {
    const allowed = ['full_name', 'qualification', 'registration_no', 'clinic_name',
      'tagline', 'address', 'website', 'logo_key', 'theme_ink', 'theme_accent',
      'patient_prefix', 'practice_packs', 'email', 'weekly_hours',
      'certificate_name', 'certificate_status', 'certificate_submitted_at',
      'hpr_id', 'hfr_id'];
    const fields = Object.keys(patch).filter(k => allowed.includes(k));
    if (!fields.length) return this.byId(db, doctorId);
    const sql = 'UPDATE doctors SET ' + fields.map(f => f + ' = ?').join(', ') + ' WHERE id = ?';
    await db.prepare(sql).bind(...fields.map(f => patch[f]), doctorId).run();
    return this.byId(db, doctorId);
  },

  async setPassword(db, doctorId, hash, salt) {
    /* A changed credential ends every owner session opened with the old one.
       Staff sessions belong to different people and stay live. D1 batch is a
       transaction, so there is no instant where the new password is active
       while an old owner token remains valid. */
    await db.batch([
      db.prepare(
        'UPDATE doctors SET password_hash = ?, password_salt = ?, must_change_password = 0 WHERE id = ?'
      ).bind(hash, salt, doctorId),
      db.prepare(
        `UPDATE sessions SET revoked_at = ?
          WHERE doctor_id = ? AND user_id IS NULL AND revoked_at IS NULL`
      ).bind(nowIso(), doctorId)
    ]);
  },

  /* Pepper rotation must not clear a first-login password requirement. */
  async rehashPassword(db, doctorId, hash, salt) {
    await db.prepare(
      'UPDATE doctors SET password_hash = ?, password_salt = ? WHERE id = ?'
    ).bind(hash, salt, doctorId).run();
  },

  async markSignedIn(db, doctorId) {
    await db.prepare('UPDATE doctors SET last_sign_in_at = ? WHERE id = ?')
      .bind(nowIso(), doctorId).run();
  }
};

/* ----------------------------------------------------------------- sessions */

export const sessions = {
  /* userId is null when the doctor signs in herself. That is why every
     session that existed before staff accounts keeps working, and keeps
     full rights. */
  async create(db, doctorId, tokenHash, ttlHours, userAgent, userId, csrfHash = null) {
    await db.prepare(
      `INSERT INTO sessions
         (token_hash, doctor_id, user_id, expires_at, user_agent, csrf_hash)
       VALUES (?,?,?,?,?,?)`
    ).bind(tokenHash, doctorId, userId || null, plusHours(ttlHours),
      userAgent || null, csrfHash).run();
  },

  async resolve(db, tokenHash) {
    const row = await db.prepare(
      `SELECT doctor_id, user_id, expires_at, revoked_at, csrf_hash
         FROM sessions WHERE token_hash = ?`
    ).bind(tokenHash).first();
    if (!row || row.revoked_at || isPast(row.expires_at)) return null;
    return {
      doctorId: row.doctor_id, userId: row.user_id || null,
      csrfHash: row.csrf_hash || null
    };
  },

  async revoke(db, tokenHash) {
    await db.prepare('UPDATE sessions SET revoked_at = ? WHERE token_hash = ?')
      .bind(nowIso(), tokenHash).run();
  }
};

/* --------------------------------------------------------------- otp codes */

export const otps = {
  async create(db, { purpose, identifier, codeHash, context, expiresAt }) {
    const id = newId('otp');
    await db.prepare(
      'INSERT INTO otp_codes (id, purpose, mobile, code_hash, context, expires_at) VALUES (?,?,?,?,?,?)'
    ).bind(id, purpose, identifier, codeHash, context ? JSON.stringify(context) : null, expiresAt).run();
    return id;
  },

  async latest(db, purpose, identifier) {
    return db.prepare(
      `SELECT * FROM otp_codes WHERE purpose = ? AND mobile = ? AND consumed_at IS NULL
       ORDER BY created_at DESC LIMIT 1`
    ).bind(purpose, identifier).first();
  },

  async countRecent(db, identifier, sinceIso) {
    const row = await db.prepare(
      'SELECT COUNT(*) AS n FROM otp_codes WHERE mobile = ? AND created_at > ?'
    ).bind(identifier, sinceIso).first();
    return row ? row.n : 0;
  },

  async bumpAttempts(db, id) {
    await db.prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?').bind(id).run();
  },

  async consume(db, id) {
    await db.prepare('UPDATE otp_codes SET consumed_at = ? WHERE id = ?').bind(nowIso(), id).run();
  },

  /* A code the provider refused to carry was never issued, so it must not
     count against the five-an-hour allowance. The row is removed rather
     than flagged because countRecent() counts rows, and a flag would need a
     migration and a second place to remember to check.

     It holds a hash and an expiry, nothing a record or an audit needs -
     issuing and resetting are audited separately. */
  async discard(db, id) {
    await db.prepare('DELETE FROM otp_codes WHERE id = ? AND consumed_at IS NULL')
      .bind(id).run();
  }
};

/* ---------------------------------------------------------------- patients
   `patients` is global - one row per human being, keyed by mobile. It holds
   identity only, never anything clinical. A doctor can look someone up by
   mobile to add them, but that reveals nothing about their care. */

export const patients = {
  cleanRegistrationKey(value) {
    const key = String(value || '').trim();
    if (key.length < 8 || key.length > 100 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
      throw badRequest('This patient registration has expired. Reopen the form and try again.');
    }
    return key;
  },

  async registrationByKey(db, doctorId, value) {
    const key = this.cleanRegistrationKey(value);
    const operation = await db.prepare(
      `SELECT patient_id FROM patient_registration_operations
        WHERE doctor_id = ? AND operation_key = ?`
    ).bind(doctorId, key).first();
    if (!operation || !operation.patient_id) return null;
    return this.byIdForDoctor(db, doctorId, operation.patient_id);
  },

  /* A number belongs to a household, so this returns everyone on it.
     byMobile used to return ONE person and silently merged the family. */
  async householdOn(db, mobile) {
    const { results } = await db.prepare(
      `SELECT id, patient_code, full_name, sex, date_of_birth, relation
         FROM patients WHERE mobile = ? ORDER BY created_at`
    ).bind(mobile).all();
    return results || [];
  },

  async byId(db, id) {
    return db.prepare('SELECT * FROM patients WHERE id = ?').bind(id).first();
  },

  /* The same person, plus the number THIS clinic files them under. Two
     doctors know the same patient by two different numbers, so it cannot
     live on the person's own row. */
  async byIdForDoctor(db, doctorId, id) {
    return db.prepare(
      `SELECT p.*, dp.local_ref, dp.first_seen_on, dp.last_seen_on
         FROM patients p
         JOIN doctor_patients dp ON dp.patient_id = p.id AND dp.doctor_id = ?
        WHERE p.id = ?`
    ).bind(doctorId, id).first();
  },

  async byCode(db, code) {
    return db.prepare('SELECT * FROM patients WHERE patient_code = ?').bind(code).first();
  },

  /* Creates a person. Never guesses that a matching number means a matching
     human - the caller decides, explicitly, which it is. */
  async createPerson(db, { mobile, fullName, sex, dateOfBirth, bloodGroup, relation, locality }) {
    const id = newId('pat');
    const code = 'P-' + id.replace('pat_', '').slice(0, 10);
    try {
      await db.prepare(
        `INSERT INTO patients (id, patient_code, mobile, full_name, sex,
          date_of_birth, blood_group, relation, locality)
         VALUES (?,?,?,?,?,?,?,?,?)`
      ).bind(id, code, mobile, fullName, sex || null, dateOfBirth || null,
        bloodGroup || null, relation || 'self', locality || null).run();
    } catch (error) {
      if (String(error.message || '').includes('UNIQUE')) {
        throw badRequest(fullName + ' is already registered on this number.');
      }
      throw error;
    }
    return this.byId(db, id);
  },

  /* Create or link the human, allocate this clinic's number, count usage and
     record who did it as one D1 transaction. The operation key is checked
     first so a response lost after commit is ordinary success on retry. */
  async registerForDoctor(db, doctorId, prefix, {
    mobile, fullName, sex, dateOfBirth, bloodGroup, relation, locality,
    existingPatientId, idempotencyKey, actor
  }) {
    const key = this.cleanRegistrationKey(idempotencyKey);
    const repeated = await this.registrationByKey(db, doctorId, key);
    if (repeated) return repeated;

    let patientId = existingPatientId || null;
    let createsPerson = false;
    if (patientId) {
      const existing = await this.byId(db, patientId);
      if (!existing) throw notFound('That patient no longer exists.');
      if (existing.mobile !== mobile) {
        throw badRequest('That person is not on this mobile number.');
      }
      const alreadyMine = await this.byIdForDoctor(db, doctorId, patientId);
      if (alreadyMine) return alreadyMine;
    } else {
      patientId = newId('pat');
      createsPerson = true;
    }

    const safePrefix = String(prefix || 'P').trim().toUpperCase() || 'P';
    const operationId = newId('pro');
    const statements = [db.prepare(
      `INSERT INTO patient_registration_operations
         (id, doctor_id, operation_key, actor)
       VALUES (?, ?, ?, ?)`
    ).bind(operationId, doctorId, key, actor || 'doctor:' + doctorId)];

    if (createsPerson) {
      const patientCode = 'P-' + patientId.replace('pat_', '').slice(0, 10);
      statements.push(db.prepare(
        `INSERT INTO patients
           (id, patient_code, mobile, full_name, sex, date_of_birth, blood_group,
            relation, locality)
         VALUES (?,?,?,?,?,?,?,?,?)`
      ).bind(patientId, patientCode, mobile, fullName, sex || null,
        dateOfBirth || null, bloodGroup || null, relation || 'self',
        locality || null));
    }

    /* `next_no` is the last number handed out. The SELECT also repairs a
       counter that an import left behind, inside the same transaction that
       consumes the next number. */
    statements.push(db.prepare(
      `INSERT INTO patient_sequences (doctor_id, next_no)
       SELECT ?, COALESCE(MAX(CAST(substr(local_ref, length(?) + 2) AS INTEGER)), 1000) + 1
         FROM doctor_patients
        WHERE doctor_id = ? AND local_ref LIKE ? || '-%'
        ON CONFLICT(doctor_id) DO UPDATE SET next_no =
          MAX(patient_sequences.next_no + 1, excluded.next_no)`
    ).bind(doctorId, safePrefix, doctorId, safePrefix));
    statements.push(db.prepare(
      `INSERT INTO doctor_patients (doctor_id, patient_id, local_ref)
       SELECT ?, ?, ? || '-' || printf('%04d', next_no)
         FROM patient_sequences WHERE doctor_id = ?`
    ).bind(doctorId, patientId, safePrefix, doctorId));
    statements.push(db.prepare(
      `UPDATE patient_registration_operations
          SET patient_id = ?,
              local_ref = (SELECT local_ref FROM doctor_patients
                            WHERE doctor_id = ? AND patient_id = ?)
        WHERE id = ? AND doctor_id = ?`
    ).bind(patientId, doctorId, patientId, operationId, doctorId));
    statements.push(db.prepare(
      `INSERT INTO usage_events
         (id, doctor_id, event_type, quantity, unit, idempotency_key)
       SELECT ?, ?, 'patient_created', 1, 'patient', ?
        WHERE EXISTS (SELECT 1 FROM patient_registration_operations
                       WHERE id = ? AND doctor_id = ? AND patient_id = ?)`
    ).bind(newId('use'), doctorId, 'patient-add:' + key,
      operationId, doctorId, patientId));
    statements.push(db.prepare(
      `INSERT INTO audit_events
         (id, doctor_id, actor, action, target_type, target_id)
       SELECT ?, ?, ?, 'patient_added', 'patient', ?
        WHERE EXISTS (SELECT 1 FROM patient_registration_operations
                       WHERE id = ? AND doctor_id = ? AND patient_id = ?)`
    ).bind(newId('aud'), doctorId, actor || 'doctor:' + doctorId,
      patientId, operationId, doctorId, patientId));

    try {
      await db.batch(statements);
    } catch (error) {
      if (String(error.message || '').includes('UNIQUE')) {
        const won = await this.registrationByKey(db, doctorId, key);
        if (won) return won;
        if (createsPerson) {
          const same = await db.prepare(
            `SELECT id FROM patients
              WHERE mobile = ? AND LOWER(full_name) = LOWER(?)`
          ).bind(mobile, fullName).first();
          if (same) {
            throw badRequest(fullName + ' is already registered on this number. ' +
              'Choose that household member instead of creating another.');
          }
        } else {
          const linked = await this.byIdForDoctor(db, doctorId, patientId);
          if (linked) return linked;
        }
      }
      throw error;
    }

    const registered = await this.byIdForDoctor(db, doctorId, patientId);
    if (!registered) {
      throw new Error('Patient registration did not create the clinic list entry.');
    }
    return registered;
  },

  /* The national identifier belongs to the PERSON, not to one clinic's copy
     of them, so it is written on the shared patients row and every clinic
     that already knows this patient sees it.

     That is correct - there is one ABHA per human being - but it means a
     doctor is writing into a row other doctors read, which is the only
     place in TCOS where that happens on purpose. The caller must therefore
     have proved the patient is on their own list first, and the change is
     audited. */
  async setAbha(db, patientId, { number, address, status }) {
    await db.prepare(
      `UPDATE patients
          SET abha_number = ?, abha_address = ?, abha_status = ?
        WHERE id = ?`
    ).bind(number, address, status, patientId).run();
    return this.byId(db, patientId);
  },

  /* The patient agreeing, at the desk, to be messaged. Recorded with a time
     because "did she agree, and when" is the entire question if it is ever
     asked. Turning it off clears the timestamp; it is not an opt-out, just
     an absence of consent. */
  /* Allergies live on `patients`, not on doctor_patients, because a
     penicillin allergy is a fact about a person rather than about her
     relationship with one clinic. The Ayurvedic physician she sees on
     Tuesday and the allopath she sees on Friday prescribe into the same
     body, and an allergy known to one and hidden from the other is exactly
     the failure this platform exists to prevent.

     NULL means not recorded. It is never written as an empty string, so
     "we do not know" and "she told us there are none" stay distinguishable
     all the way to the printed sheet. */
  async setAllergies(db, patientId, allergies) {
    await db.prepare('UPDATE patients SET allergies = ? WHERE id = ?')
      .bind(allergies || null, patientId).run();
    return this.byId(db, patientId);
  },

  async setWhatsappConsent(db, patientId, agreed) {
    await db.prepare(
      `UPDATE patients SET whatsapp_opt_in = ?, whatsapp_opt_in_at = ? WHERE id = ?`
    ).bind(agreed ? 1 : 0, agreed ? nowIso() : null, patientId).run();
    return this.byId(db, patientId);
  },

  /* The patient replying STOP. Different from the above in one way that
     matters: this is the patient's own decision, it applies to every clinic
     that holds this number, and no front desk can undo it by ticking a box.
     Only the patient messaging again could, and that is not built. */
  async optOutByMobile(db, mobile) {
    const result = await db.prepare(
      `UPDATE patients SET whatsapp_opted_out_at = ?, whatsapp_opt_in = 0
        WHERE mobile = ? AND whatsapp_opted_out_at IS NULL`
    ).bind(nowIso(), mobile).run();
    return (result.meta && result.meta.changes) || 0;
  },

  /* What the doctor may see when they type a number.
     Their own patients by name; anyone else's only as a count, because a
     doctor typing numbers must not be able to learn who is a patient
     somewhere else. Names come only after the patient approves. */
  async lookup(db, doctorId, mobile) {
    const { results: mine } = await db.prepare(
      `SELECT p.id, p.patient_code, p.full_name, p.sex, p.date_of_birth,
              p.relation, dp.local_ref, dp.last_seen_on
         FROM patients p
         JOIN doctor_patients dp ON dp.patient_id = p.id AND dp.doctor_id = ?
        WHERE p.mobile = ? ORDER BY p.created_at`
    ).bind(doctorId, mobile).all();

    const other = await db.prepare(
      `SELECT COUNT(DISTINCT p.id) AS n
         FROM patients p
         JOIN doctor_patients dp ON dp.patient_id = p.id
        WHERE p.mobile = ? AND dp.doctor_id != ?
          AND p.id NOT IN (SELECT patient_id FROM doctor_patients WHERE doctor_id = ?)`
    ).bind(mobile, doctorId, doctorId).first();

    return { mine: mine || [], elsewhere: other ? other.n : 0 };
  },

  /* The doctor's own patient list. Scoped. */
  async listForDoctor(db, doctorId, { limit = 100, offset = 0 } = {}) {
    const { results } = await db.prepare(
      `SELECT p.id, p.full_name, p.mobile, p.sex, p.date_of_birth,
              dp.local_ref, dp.first_seen_on, dp.last_seen_on
         FROM doctor_patients dp
         JOIN patients p ON p.id = dp.patient_id
        WHERE dp.doctor_id = ? AND dp.archived_at IS NULL
        ORDER BY COALESCE(dp.last_seen_on, dp.first_seen_on) DESC
        LIMIT ? OFFSET ?`
    ).bind(doctorId, limit, offset).all();
    return results || [];
  },

  /* Is this patient on this doctor's list? The gate for every patient read. */
  async isOnList(db, doctorId, patientId) {
    const row = await db.prepare(
      'SELECT 1 AS ok FROM doctor_patients WHERE doctor_id = ? AND patient_id = ?'
    ).bind(doctorId, patientId).first();
    return !!row;
  },

  /* TCOS hands out the patient number, never the doctor. She has enough to
     do without inventing a filing system, and two doctors left to their own
     devices would produce two people called "1". */
  async nextLocalRef(db, doctorId, prefix) {
    /* Atomic: the increment and the read are one statement, so two adds in
       the same second cannot be given the same number. */
    const row = await db.prepare(
      `INSERT INTO patient_sequences (doctor_id, next_no) VALUES (?, 1001)
       ON CONFLICT(doctor_id) DO UPDATE SET next_no = next_no + 1
       RETURNING next_no`
    ).bind(doctorId).first();
    const number = row ? row.next_no : 1001;
    /* Four digits to start; at 10,000 patients it simply becomes five. */
    return (prefix || 'P') + '-' + String(number).padStart(4, '0');
  },

  async addToList(db, doctorId, patientId, prefix) {
    const existing = await db.prepare(
      'SELECT local_ref FROM doctor_patients WHERE doctor_id = ? AND patient_id = ?'
    ).bind(doctorId, patientId).first();
    /* Already on her list: keep the number they already know. Burning a new
       one here would renumber a patient mid-treatment. */
    if (existing) return existing.local_ref;

    /* There is a UNIQUE index on (doctor_id, local_ref), and the counter can
       fall behind the rows - a seed or an import that wrote local_refs
       directly leaves patient_sequences pointing at a number already taken.

       INSERT OR IGNORE then swallows the collision, and the old code
       returned the number anyway: the caller got a patient reference, the
       API answered 201, and the patient was never on the doctor's list.
       She had simply vanished, and her mobile was now taken so she could
       not be added again.

       So the number is only ours once the row is READ BACK. If it collided,
       take the next one. This self-heals a lagging counter instead of
       failing forever on the same number. */
    for (let attempt = 0; attempt < 50; attempt++) {
      const localRef = await this.nextLocalRef(db, doctorId, prefix);
      await db.prepare(
        `INSERT OR IGNORE INTO doctor_patients (doctor_id, patient_id, local_ref)
         VALUES (?,?,?)`
      ).bind(doctorId, patientId, localRef).run();

      const landed = await db.prepare(
        'SELECT local_ref FROM doctor_patients WHERE doctor_id = ? AND patient_id = ?'
      ).bind(doctorId, patientId).first();
      if (landed) return landed.local_ref;
    }

    /* Fifty consecutive collisions is not a busy clinic, it is something
       broken. Loud, because the alternative is the silent orphaning above. */
    throw new Error(
      'Could not assign a patient number for ' + doctorId +
      ' after 50 attempts - patient_sequences is far behind doctor_patients.');
  },

  async requireOnList(db, doctorId, patientId) {
    if (!(await this.isOnList(db, doctorId, patientId))) {
      /* Deliberately "not found", not "forbidden" - a doctor should not be
         able to probe whether a patient exists on someone else's list. */
      throw notFound('That patient is not on your list.');
    }
  }
};

/* ------------------------------------------------------------------ visits */

export const visits = {
  async byId(db, doctorId, id) {
    return db.prepare('SELECT * FROM visits WHERE id = ? AND doctor_id = ?')
      .bind(id, doctorId).first();
  },

  async listForPatient(db, doctorId, patientId) {
    const { results } = await db.prepare(
      `SELECT * FROM visits WHERE doctor_id = ? AND patient_id = ?
        ORDER BY visited_on DESC`
    ).bind(doctorId, patientId).all();
    return results || [];
  },

  async create(db, doctorId, visit, { actor, idempotencyKey } = {}) {
    const key = String(idempotencyKey || '').trim();
    if (key.length < 8 || key.length > 100) {
      throw badRequest('This consultation save has expired. Reopen it and try again.');
    }
    const repeated = await db.prepare(
      'SELECT * FROM visits WHERE doctor_id = ? AND idempotency_key = ?'
    ).bind(doctorId, key).first();
    if (repeated) return repeated;

    const id = newId('vis');
    const statements = [db.prepare(
      `INSERT INTO visits (id, doctor_id, patient_id, visited_on, visit_type,
        complaints, diagnosis, vitals, findings, advice, follow_up_on,
        practitioner_id, idempotency_key)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(id, doctorId, visit.patientId, visit.visitedOn, visit.visitType || 'follow_up',
      visit.complaints || null, visit.diagnosis || null,
      JSON.stringify(visit.vitals || {}), JSON.stringify(visit.findings || {}),
      visit.advice || null, visit.followUpOn || null,
      /* Which doctor in this practice saw them. NULL is the clinic owner,
         so single-doctor clinics are unaffected. */
      visit.practitionerId || null, key), db.prepare(
      `UPDATE doctor_patients
          SET last_seen_on = CASE
                WHEN last_seen_on IS NULL OR last_seen_on < ? THEN ?
                ELSE last_seen_on END
        WHERE doctor_id = ? AND patient_id = ?
          AND EXISTS (SELECT 1 FROM visits
                       WHERE id = ? AND doctor_id = ? AND idempotency_key = ?)`
    ).bind(visit.visitedOn, visit.visitedOn, doctorId, visit.patientId,
      id, doctorId, key), db.prepare(
      `INSERT INTO usage_events
         (id, doctor_id, event_type, quantity, unit, idempotency_key)
       SELECT ?, ?, 'visit_recorded', 1, 'visit', ?
        WHERE EXISTS (SELECT 1 FROM visits
                       WHERE id = ? AND doctor_id = ? AND idempotency_key = ?)`
    ).bind(newId('use'), doctorId, 'visit-save:' + key, id, doctorId, key), db.prepare(
      `INSERT INTO audit_events
         (id, doctor_id, actor, action, target_type, target_id)
       SELECT ?, ?, ?, 'visit_created', 'visit', ?
        WHERE EXISTS (SELECT 1 FROM visits
                       WHERE id = ? AND doctor_id = ? AND idempotency_key = ?)`
    ).bind(newId('aud'), doctorId, actor || 'doctor:' + doctorId,
      id, id, doctorId, key)];
    try {
      await db.batch(statements);
    } catch (error) {
      if (!String(error.message || '').includes('UNIQUE')) throw error;
      const won = await db.prepare(
        'SELECT * FROM visits WHERE doctor_id = ? AND idempotency_key = ?'
      ).bind(doctorId, key).first();
      if (won) return won;
      throw error;
    }
    return db.prepare('SELECT * FROM visits WHERE id = ? AND doctor_id = ?')
      .bind(id, doctorId).first();
  }
};

/* ----------------------------------------------------------- prescriptions */

function cleanPrescriptionItems(items) {
  const rows = Array.isArray(items) ? items : [];
  return rows.map((item, index) => {
    const medicineName = item && String(item.medicineName || '').trim();
    if (!medicineName) {
      throw badRequest('Line ' + (index + 1) + ' has no medicine name. ' +
        'Add one, or remove the line.');
    }
    const dispenseQuantity = item.dispenseQuantity == null
      ? null : Number(item.dispenseQuantity);
    if (dispenseQuantity !== null &&
        (!Number.isFinite(dispenseQuantity) || dispenseQuantity < 0)) {
      throw badRequest('Line ' + (index + 1) + ' has an invalid dispense quantity.');
    }
    return {
      id: newId('rxi'), medicineName,
      system: item.system || 'allopathy', dose: item.dose || null,
      frequency: item.frequency || null, duration: item.duration || null,
      instructions: item.instructions || null,
      attributes: JSON.stringify(item.attributes || {}),
      dispenseQuantity, stockItemId: item.stockItemId || null, index
    };
  });
}

function prescriptionItemStatement(db, doctorId, prescriptionId, item) {
  return db.prepare(
    `INSERT INTO prescription_items
       (id, prescription_id, doctor_id, medicine_name, system, dose, frequency,
        duration, instructions, attributes, sort_order, dispense_quantity, stock_item_id)
     SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?
      WHERE EXISTS (SELECT 1 FROM prescriptions
                     WHERE id = ? AND doctor_id = ? AND status = 'draft')`
  ).bind(item.id, prescriptionId, doctorId, item.medicineName, item.system,
    item.dose, item.frequency, item.duration, item.instructions, item.attributes,
    item.index, item.dispenseQuantity, item.stockItemId, prescriptionId, doctorId);
}

async function requirePrescriptionVisit(db, doctorId, patientId, visitId) {
  const visit = await db.prepare(
    'SELECT patient_id FROM visits WHERE id = ? AND doctor_id = ?'
  ).bind(visitId, doctorId).first();
  if (!visit) throw notFound('Visit not found.');
  if (visit.patient_id !== patientId) {
    throw badRequest('The prescription and visit must belong to the same patient.');
  }
  return visit;
}

export const prescriptions = {
  /* Everything this clinic has issued, newest first.

     Drafts are excluded on purpose. An unissued prescription is a thought,
     not a document, and listing it beside real ones invites somebody to read
     it as though a patient had been given it. */
  async listForDoctor(db, doctorId, { from, to, search, limit = 200 } = {}) {
    const where = ['p.doctor_id = ?', "p.status != 'draft'"];
    const bind = [doctorId];
    if (from) { where.push('p.issued_on >= ?'); bind.push(from); }
    if (to) { where.push('p.issued_on <= ?'); bind.push(to); }
    if (search && String(search).trim()) {
      /* One box, three things she might remember: the number on the paper,
         the person, or the medicine she wrote. */
      const like = '%' + String(search).trim().toLowerCase() + '%';
      where.push(`(LOWER(p.rx_number) LIKE ? OR LOWER(pt.full_name) LIKE ?
                   OR EXISTS (SELECT 1 FROM prescription_items pi
                               WHERE pi.prescription_id = p.id
                                 AND pi.doctor_id = p.doctor_id
                                 AND LOWER(pi.medicine_name) LIKE ?))`);
      bind.push(like, like, like);
    }

    const { results } = await db.prepare(
      `SELECT p.*, pt.full_name, pt.mobile, dp.local_ref,
              (SELECT COUNT(*) FROM prescription_items pi
                WHERE pi.prescription_id = p.id AND pi.doctor_id = p.doctor_id) AS item_count,
              (SELECT GROUP_CONCAT(pi.medicine_name, ', ') FROM prescription_items pi
                WHERE pi.prescription_id = p.id AND pi.doctor_id = p.doctor_id) AS medicines
         FROM prescriptions p
         JOIN patients pt ON pt.id = p.patient_id
    LEFT JOIN doctor_patients dp
           ON dp.patient_id = p.patient_id AND dp.doctor_id = p.doctor_id
        WHERE ${where.join(' AND ')}
     ORDER BY p.issued_on DESC, p.created_at DESC
        LIMIT ?`
    ).bind(...bind, Math.min(Number(limit) || 200, 500)).all();
    return results || [];
  },

  async listForPatient(db, doctorId, patientId) {
    const { results } = await db.prepare(
      `SELECT * FROM prescriptions WHERE doctor_id = ? AND patient_id = ?
        ORDER BY issued_on DESC, created_at DESC`
    ).bind(doctorId, patientId).all();
    const rows = results || [];
    return Promise.all(rows.map(async rx => {
      const items = await db.prepare(
        `SELECT * FROM prescription_items WHERE prescription_id = ? AND doctor_id = ?
          ORDER BY sort_order`
      ).bind(rx.id, doctorId).all();
      return { ...rx, items: items.results || [] };
    }));
  },

  async withItems(db, doctorId, prescriptionId) {
    const rx = await db.prepare(
      `SELECT p.*, pt.full_name, pt.mobile, pt.sex, pt.date_of_birth, dp.local_ref,
              v.diagnosis, v.complaints, v.vitals, v.advice, v.follow_up_on,
              /* The structured examination - Nadi, Jihva, and whatever she
                 named herself. Selected since 19 Sep 2026: it was recorded
                 on every consultation and reached no prescription, so an
                 Ayurvedic examination was being taken and then thrown away
                 at the one moment the patient could have seen it. */
              v.findings,
              d.clinic_name,
              /* Which of the three products issued it. Carried so the sheet
                 can wear that product's accent; nothing else on the
                 document differs by it. */
              d.product,
              COALESCE(pr.full_name, d.full_name) AS doctor_name,
              COALESCE(pr.qualification, d.qualification) AS qualification,
              COALESCE(pr.registration_no, d.registration_no) AS registration_no,
              CASE WHEN p.practitioner_id IS NULL
                   THEN d.verification_status ELSE pr.verification_status END
                   AS practitioner_verification_status,
              d.address
         FROM prescriptions p
         JOIN patients pt ON pt.id = p.patient_id
         JOIN doctors d ON d.id = p.doctor_id
    LEFT JOIN clinic_users pr ON pr.id = p.practitioner_id
                              AND pr.doctor_id = p.doctor_id
                              AND pr.role = 'practitioner'
    LEFT JOIN doctor_patients dp ON dp.doctor_id = p.doctor_id AND dp.patient_id = p.patient_id
    LEFT JOIN visits v ON v.id = p.visit_id AND v.doctor_id = p.doctor_id
        WHERE p.id = ? AND p.doctor_id = ?`
    ).bind(prescriptionId, doctorId).first();
    if (!rx) throw notFound('Prescription not found.');
    const { results } = await db.prepare(
      `SELECT * FROM prescription_items WHERE prescription_id = ? AND doctor_id = ?
        ORDER BY sort_order`
    ).bind(prescriptionId, doctorId).all();
    return { ...rx, items: results || [] };
  },

  /* Gap-free, per doctor, per year. Allocated with a single atomic upsert so
     two prescriptions written in the same second cannot take the same
     number. Format: <clinic prefix>/2026/0001 */
  async nextNumber(db, doctorId, prefix) {
    const year = new Date().getFullYear();
    const row = await db.prepare(
      `INSERT INTO rx_sequences (doctor_id, year, next_no) VALUES (?, ?, 1)
       ON CONFLICT(doctor_id, year) DO UPDATE SET next_no = next_no + 1
       RETURNING next_no`
    ).bind(doctorId, year).first();
    const sequence = row ? row.next_no : 1;
    return {
      sequenceNo: sequence,
      rxNumber: (prefix || 'RX') + '/' + year + '/' + String(sequence).padStart(4, '0')
    };
  },

  /* Drafts are freely editable. Nothing is numbered until it is issued -
     a number handed out to a draft that is later abandoned leaves a gap. */
  async createDraft(db, doctorId, {
    patientId, visitId, items = [], practitionerId, idempotencyKey, actor
  }) {
    const key = String(idempotencyKey || '').trim();
    if (key.length < 8 || key.length > 100) {
      throw badRequest('This prescription draft has expired. Reopen it and try again.');
    }
    const repeated = await db.prepare(
      'SELECT id FROM prescriptions WHERE doctor_id = ? AND idempotency_key = ?'
    ).bind(doctorId, key).first();
    if (repeated) return this.withItems(db, doctorId, repeated.id);
    if (visitId) await requirePrescriptionVisit(db, doctorId, patientId, visitId);

    const id = newId('rx');
    const cleanItems = cleanPrescriptionItems(items);
    const statements = [db.prepare(
      `INSERT INTO prescriptions (id, doctor_id, patient_id, visit_id, issued_on,
         status, practitioner_id, idempotency_key)
       VALUES (?,?,?,?,?, 'draft', ?, ?)`
    ).bind(id, doctorId, patientId, visitId || null,
      new Date().toISOString().slice(0, 10),
      /* Whoever is writing it signs it. NULL is the clinic owner. */
      practitionerId || null, key)];
    for (const item of cleanItems) {
      statements.push(prescriptionItemStatement(db, doctorId, id, item));
    }
    statements.push(db.prepare(
      `INSERT INTO audit_events
         (id, doctor_id, actor, action, target_type, target_id)
       SELECT ?, ?, ?, 'prescription_draft_created', 'prescription', ?
        WHERE EXISTS (SELECT 1 FROM prescriptions
                       WHERE id = ? AND doctor_id = ? AND idempotency_key = ?)`
    ).bind(newId('aud'), doctorId, actor || 'doctor:' + doctorId,
      id, id, doctorId, key));
    try {
      await db.batch(statements);
    } catch (error) {
      if (!String(error.message || '').includes('UNIQUE')) throw error;
      const won = await db.prepare(
        'SELECT id FROM prescriptions WHERE doctor_id = ? AND idempotency_key = ?'
      ).bind(doctorId, key).first();
      if (won) return this.withItems(db, doctorId, won.id);
      throw error;
    }
    return this.withItems(db, doctorId, id);
  },

  async replaceItems(db, doctorId, prescriptionId, items, { visitId } = {}) {
    const rx = await db.prepare(
      'SELECT status, patient_id FROM prescriptions WHERE id = ? AND doctor_id = ?'
    ).bind(prescriptionId, doctorId).first();
    if (!rx) throw notFound('Prescription not found.');
    if (rx.status === 'issued') {
      throw forbidden('This prescription has been issued and cannot be changed. Amend it instead.');
    }
    if (visitId) await requirePrescriptionVisit(db, doctorId, rx.patient_id, visitId);

    const cleanItems = cleanPrescriptionItems(items);
    const statements = [db.prepare(
      `DELETE FROM prescription_items
        WHERE prescription_id = ? AND doctor_id = ?
          AND EXISTS (SELECT 1 FROM prescriptions
                       WHERE id = ? AND doctor_id = ? AND status = 'draft')`
    ).bind(prescriptionId, doctorId, prescriptionId, doctorId)];
    for (const item of cleanItems) {
      statements.push(prescriptionItemStatement(db, doctorId, prescriptionId, item));
    }
    /* A no-op claim at the end gives us an authoritative row count after all
       item writes. If Issue won first, none of this batch changes anything. */
    statements.push(db.prepare(
      `UPDATE prescriptions
          SET status = 'draft', visit_id = COALESCE(?, visit_id)
        WHERE id = ? AND doctor_id = ? AND status = 'draft'`
    ).bind(visitId || null, prescriptionId, doctorId));
    const results = await db.batch(statements);
    if (changedRows(results[results.length - 1]) !== 1) {
      throw forbidden('This prescription was issued while it was being edited. Refresh it.');
    }
    return this.withItems(db, doctorId, prescriptionId);
  },

  /* The moment that matters. After this the row is frozen: the patient is
     holding paper that has to keep matching it. */
  async issue(db, doctorId, prescriptionId, prefix, actor) {
    const rx = await this.withItems(db, doctorId, prescriptionId);
    if (rx.status === 'issued') return rx;
    if (!rx.items.length) throw badRequest('Add at least one line before issuing.');
    const year = new Date().getFullYear();
    const at = nowIso();
    const safePrefix = String(prefix || 'RX').trim() || 'RX';
    const followUpId = newId('apt');
    const statements = [db.prepare(
      `UPDATE prescriptions SET status = 'issuing'
        WHERE id = ? AND doctor_id = ? AND status = 'draft'
          AND EXISTS (SELECT 1 FROM prescription_items
                       WHERE prescription_id = ? AND doctor_id = ?)`
    ).bind(prescriptionId, doctorId, prescriptionId, doctorId), db.prepare(
      `INSERT INTO rx_sequences (doctor_id, year, next_no)
       SELECT ?, ?, 1
        WHERE EXISTS (SELECT 1 FROM prescriptions
                       WHERE id = ? AND doctor_id = ? AND status = 'issuing')
       ON CONFLICT(doctor_id, year) DO UPDATE SET next_no = next_no + 1`
    ).bind(doctorId, year, prescriptionId, doctorId), db.prepare(
      `INSERT INTO usage_events
         (id, doctor_id, event_type, quantity, unit, idempotency_key)
       SELECT ?, ?, 'prescription_issued', 1, 'prescription', ?
        WHERE EXISTS (SELECT 1 FROM prescriptions
                       WHERE id = ? AND doctor_id = ? AND status = 'issuing')`
    ).bind(newId('use'), doctorId, 'rx_issue_' + prescriptionId,
      prescriptionId, doctorId), db.prepare(
      `INSERT INTO audit_events
         (id, doctor_id, actor, action, target_type, target_id, detail)
       SELECT ?, ?, ?, 'prescription_issued', 'prescription', id,
              ? || '/' || ? || '/' || printf('%04d',
                (SELECT next_no FROM rx_sequences WHERE doctor_id = ? AND year = ?))
         FROM prescriptions
        WHERE id = ? AND doctor_id = ? AND status = 'issuing'`
    ).bind(newId('aud'), doctorId, actor || 'doctor:' + doctorId,
      safePrefix, year, doctorId, year, prescriptionId, doctorId), db.prepare(
      `INSERT OR IGNORE INTO appointments
         (id, doctor_id, patient_id, scheduled_on, duration_mins, reason,
          source, from_visit_id)
       SELECT ?, p.doctor_id, p.patient_id, v.follow_up_on, 15,
              'Follow-up review', 'follow_up', v.id
         FROM prescriptions p
         JOIN visits v ON v.id = p.visit_id AND v.doctor_id = p.doctor_id
        WHERE p.id = ? AND p.doctor_id = ? AND p.status = 'issuing'
          AND v.patient_id = p.patient_id
          AND v.follow_up_on IS NOT NULL AND TRIM(v.follow_up_on) != ''`
    ).bind(followUpId, prescriptionId, doctorId), db.prepare(
      `UPDATE prescriptions
          SET status = 'issued', issued_at = ?,
              sequence_no = (SELECT next_no FROM rx_sequences
                               WHERE doctor_id = ? AND year = ?),
              rx_number = ? || '/' || ? || '/' || printf('%04d',
                (SELECT next_no FROM rx_sequences WHERE doctor_id = ? AND year = ?))
        WHERE id = ? AND doctor_id = ? AND status = 'issuing'`
    ).bind(at, doctorId, year, safePrefix, year, doctorId, year,
      prescriptionId, doctorId)];
    const results = await db.batch(statements);
    if (changedRows(results[0]) !== 1) {
      return this.withItems(db, doctorId, prescriptionId);
    }
    return this.withItems(db, doctorId, prescriptionId);
  },

  /* A correction never edits history. It writes a new prescription carrying
     the reason, and marks the old one superseded so both are readable and
     the order between them is unambiguous. */
  async amend(db, doctorId, prescriptionId, { items, reason, actor }) {
    const original = await this.withItems(db, doctorId, prescriptionId);
    if (original.status !== 'issued') {
      throw badRequest('Only an issued prescription needs amending. Edit the draft instead.');
    }
    if (original.superseded_by) {
      return this.withItems(db, doctorId, original.superseded_by);
    }
    if (!reason) throw badRequest('Give a reason for the amendment. It becomes part of the record.');

    const id = newId('rx');
    const chosen = items && items.length ? items : original.items.map(i => ({
      medicineName: i.medicine_name, system: i.system, dose: i.dose,
      frequency: i.frequency, duration: i.duration, instructions: i.instructions,
      dispenseQuantity: i.dispense_quantity, stockItemId: i.stock_item_id
    }));
    const cleanItems = cleanPrescriptionItems(chosen);
    const statements = [db.prepare(
      `UPDATE prescriptions SET superseded_by = ?
        WHERE id = ? AND doctor_id = ? AND status = 'issued' AND superseded_by IS NULL`
    ).bind(id, prescriptionId, doctorId), db.prepare(
      `INSERT INTO prescriptions (id, doctor_id, patient_id, visit_id, issued_on,
        status, amends, amend_reason, practitioner_id)
       SELECT ?, doctor_id, patient_id, visit_id, ?, 'draft', id, ?, practitioner_id
         FROM prescriptions
        WHERE id = ? AND doctor_id = ? AND superseded_by = ?`
    ).bind(id, new Date().toISOString().slice(0, 10), String(reason).trim(),
      prescriptionId, doctorId, id)];
    for (const item of cleanItems) {
      statements.push(prescriptionItemStatement(db, doctorId, id, item));
    }
    statements.push(db.prepare(
      `INSERT INTO audit_events
         (id, doctor_id, actor, action, target_type, target_id, detail)
       SELECT ?, ?, ?, 'prescription_amended', 'prescription', ?, ?
        WHERE EXISTS (SELECT 1 FROM prescriptions
                       WHERE id = ? AND doctor_id = ? AND amends = ?)`
    ).bind(newId('aud'), doctorId, actor || 'doctor:' + doctorId,
      prescriptionId, String(reason).trim(), id, doctorId, prescriptionId));
    const results = await db.batch(statements);
    if (changedRows(results[0]) !== 1) {
      const current = await this.withItems(db, doctorId, prescriptionId);
      if (current.superseded_by) return this.withItems(db, doctorId, current.superseded_by);
      throw forbidden('This prescription has already been amended.');
    }
    return this.withItems(db, doctorId, id);
  }
};

/* ------------------------------------------------------------ lab reports */

export const labReports = {
  async listForDoctor(db, doctorId) {
    const { results } = await db.prepare(
      `SELECT lr.*, pt.full_name, dp.local_ref,
              COUNT(lv.id) AS value_count,
              SUM(CASE WHEN lv.flag IS NOT NULL AND lv.flag != 'normal' THEN 1 ELSE 0 END) AS flagged_count,
              GROUP_CONCAT(CASE WHEN lv.flag IS NOT NULL AND lv.flag != 'normal'
                THEN lv.analyte || ' ' || lv.value || COALESCE(' ' || lv.unit, '') END, ' · ') AS abnormal_values
         FROM lab_reports lr
         JOIN patients pt ON pt.id = lr.patient_id
    LEFT JOIN doctor_patients dp ON dp.doctor_id = lr.doctor_id AND dp.patient_id = lr.patient_id
    LEFT JOIN lab_values lv ON lv.lab_report_id = lr.id AND lv.doctor_id = lr.doctor_id
        WHERE lr.doctor_id = ? AND lr.source != 'patient_upload'
     GROUP BY lr.id
     ORDER BY lr.reported_on DESC
        LIMIT 300`
    ).bind(doctorId).all();
    return results || [];
  },
  async listForPatient(db, doctorId, patientId) {
    const { results } = await db.prepare(
      `SELECT * FROM lab_reports WHERE doctor_id = ? AND patient_id = ?
        ORDER BY reported_on DESC`
    ).bind(doctorId, patientId).all();
    return results || [];
  },

  async withValues(db, doctorId, reportId) {
    const report = await db.prepare(
      'SELECT * FROM lab_reports WHERE id = ? AND doctor_id = ?'
    ).bind(reportId, doctorId).first();
    if (!report) throw notFound('Report not found.');
    const { results } = await db.prepare(
      'SELECT * FROM lab_values WHERE lab_report_id = ? AND doctor_id = ? ORDER BY rowid'
    ).bind(reportId, doctorId).all();
    return { ...report, values: results || [] };
  },

  /* Marking a report verified is the doctor saying they have read it. Only
     verified reports reach the patient's own page. */
  async verify(db, doctorId, reportId, verifiedBy) {
    const report = await db.prepare(
      'SELECT status FROM lab_reports WHERE id = ? AND doctor_id = ?'
    ).bind(reportId, doctorId).first();
    if (!report) throw notFound('Report not found.');
    await db.prepare(
      `UPDATE lab_reports SET status = 'verified', verified_by = ?, verified_at = ?
        WHERE id = ? AND doctor_id = ?`
    ).bind(verifiedBy, nowIso(), reportId, doctorId).run();
    return this.withValues(db, doctorId, reportId);
  },

  /* Every reading of every analyte for one patient, oldest first, so the
     screen can show how a number has moved rather than only where it is. */
  async series(db, doctorId, patientId) {
    const { results } = await db.prepare(
      `SELECT lv.analyte, lv.value, lv.unit, lv.reference, lv.flag,
              lr.reported_on, lr.report_name, lr.status
         FROM lab_values lv
         JOIN lab_reports lr ON lr.id = lv.lab_report_id AND lr.doctor_id = lv.doctor_id
        WHERE lv.doctor_id = ? AND lr.patient_id = ?
     ORDER BY lv.analyte, lr.reported_on ASC`
    ).bind(doctorId, patientId).all();
    return results || [];
  },

  async create(db, doctorId, report, {
    actor, verifiedBy, practitionerId, idempotencyKey
  }) {
    const key = String(idempotencyKey || '').trim();
    if (key.length < 8 || key.length > 100) {
      throw badRequest('This save request has expired. Reopen the report form and try again.');
    }
    const repeated = await db.prepare(
      `SELECT id FROM lab_reports WHERE doctor_id = ? AND idempotency_key = ?`
    ).bind(doctorId, key).first();
    if (repeated) return this.withValues(db, doctorId, repeated.id);

    const id = newId('lab');
    const at = nowIso();
    const statements = [db.prepare(
      `INSERT INTO lab_reports (id, doctor_id, patient_id, report_name, lab_name,
        reported_on, source, status, verified_by, verified_at, file_key,
        practitioner_id, idempotency_key)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(id, doctorId, report.patientId, report.reportName,
      report.labName || null, report.reportedOn,
      report.source || 'manual', 'verified', verifiedBy, at,
      report.fileKey || null, practitionerId || null, key)];
    for (const value of report.values || []) {
      statements.push(db.prepare(
        `INSERT INTO lab_values (id, lab_report_id, doctor_id, analyte, value, unit, reference, flag)
         VALUES (?,?,?,?,?,?,?,?)`
      ).bind(newId('lv'), id, doctorId, value.analyte,
        value.value == null ? null : value.value,
        value.unit || null, value.reference || null, value.flag || 'normal'));
    }
    statements.push(db.prepare(
      `INSERT INTO usage_events
         (id, doctor_id, event_type, quantity, unit, idempotency_key)
       VALUES (?, ?, 'lab_report_recorded', 1, 'report', ?)`
    ).bind(newId('use'), doctorId, 'lab-save:' + key));
    statements.push(db.prepare(
      `INSERT INTO audit_events
         (id, doctor_id, actor, action, target_type, target_id, detail)
       VALUES (?, ?, ?, 'lab_report_added', 'lab_report', ?, ?)`
    ).bind(newId('aud'), doctorId, actor, id, report.reportName));
    /* The report and every value are one clinical write. A failed third row
       must not leave the first two looking like a complete result. A retry
       that races the first request resolves to the record that already won. */
    try {
      await db.batch(statements);
    } catch (error) {
      if (!String(error.message || '').includes('UNIQUE')) throw error;
      const won = await db.prepare(
        `SELECT id FROM lab_reports WHERE doctor_id = ? AND idempotency_key = ?`
      ).bind(doctorId, key).first();
      if (won) return this.withValues(db, doctorId, won.id);
      throw error;
    }
    return this.withValues(db, doctorId, id);
  },

  /* Claim one pending AI draft and turn the doctor's corrected values into
     one verified clinical record. D1 executes a batch as one transaction:
     either the report, all values, the usage line, the audit line and the
     draft transition exist together, or none of them do.

     The first INSERT is conditional on the draft still being pending. A
     retry or double-click therefore inserts zero rows and cannot create a
     second report. */
  async confirmDraft(db, doctorId, draftId, report, {
    reviewedBy, verifiedBy, practitionerId
  }) {
    const id = newId('lab');
    const at = nowIso();
    const statements = [db.prepare(
      `INSERT INTO lab_reports
         (id, doctor_id, patient_id, report_name, lab_name, reported_on,
          source, status, verified_by, verified_at, file_key, practitioner_id,
          idempotency_key)
       SELECT ?, ?, ?, ?, ?, ?, 'ai_extracted', 'verified', ?, ?, f.r2_key, ?, ?
         FROM ai_drafts d
    LEFT JOIN files f ON f.id = d.file_id AND f.doctor_id = d.doctor_id
        WHERE d.id = ? AND d.doctor_id = ? AND d.status = 'pending'`
    ).bind(id, doctorId, report.patientId, report.reportName,
      report.labName || null, report.reportedOn, verifiedBy, at,
      practitionerId || null, 'ai:' + draftId, draftId, doctorId)];

    for (const value of report.values || []) {
      statements.push(db.prepare(
        `INSERT INTO lab_values
           (id, lab_report_id, doctor_id, analyte, value, unit, reference, flag)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?
          WHERE EXISTS (SELECT 1 FROM lab_reports WHERE id = ? AND doctor_id = ?)`
      ).bind(newId('lv'), id, doctorId, value.analyte,
        value.value == null ? null : value.value,
        value.unit || null, value.reference || null, value.flag || 'normal',
        id, doctorId));
    }

    statements.push(db.prepare(
      `UPDATE ai_drafts
          SET status = 'confirmed', lab_report_id = ?, reviewed_by = ?, reviewed_at = ?
        WHERE id = ? AND doctor_id = ? AND status = 'pending'
          AND EXISTS (SELECT 1 FROM lab_reports WHERE id = ? AND doctor_id = ?)`
    ).bind(id, reviewedBy, at, draftId, doctorId, id, doctorId));
    statements.push(db.prepare(
      `INSERT INTO usage_events
         (id, doctor_id, event_type, quantity, unit, idempotency_key)
       SELECT ?, ?, 'lab_report_recorded', 1, 'report', ?
        WHERE EXISTS (SELECT 1 FROM lab_reports WHERE id = ? AND doctor_id = ?)`
    ).bind(newId('use'), doctorId, 'ai-confirm:' + draftId, id, doctorId));
    statements.push(db.prepare(
      `INSERT INTO audit_events
         (id, doctor_id, actor, action, target_type, target_id, detail)
       SELECT ?, ?, ?, 'ai_draft_confirmed', 'lab_report', ?, ?
        WHERE EXISTS (SELECT 1 FROM lab_reports WHERE id = ? AND doctor_id = ?)`
    ).bind(newId('aud'), doctorId, reviewedBy, id, report.reportName, id, doctorId));

    const results = await db.batch(statements);
    if (changedRows(results[0]) !== 1) {
      throw badRequest('That reading has already been handled. Refresh the review queue.');
    }
    return this.withValues(db, doctorId, id);
  }
};

/* -------------------------------------------------------------- pharmacy */

function cleanStockOperationKey(value) {
  const key = String(value || '').trim();
  if (key.length < 8 || key.length > 100 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
    throw badRequest('This stock action has expired. Reopen it and try again.');
  }
  return key;
}

async function priorStockOperation(db, doctorId, key, kind) {
  const row = await db.prepare(
    `SELECT * FROM stock_operations
      WHERE doctor_id = ? AND operation_key = ?`
  ).bind(doctorId, key).first();
  if (!row) return null;
  if (row.kind !== kind) {
    throw badRequest('That stock action key was already used. Reopen the action and try again.');
  }
  let result = {};
  try { result = JSON.parse(row.result_json || '{}'); } catch (_) {}
  return { ...row, result };
}

export const stock = {
  async list(db, doctorId) {
    const { results } = await db.prepare(
      `SELECT si.*,
              COALESCE(SUM(sb.quantity), 0) AS on_hand,
              MIN(CASE WHEN sb.quantity > 0 THEN sb.expires_on END) AS next_expiry
         FROM stock_items si
    LEFT JOIN stock_batches sb ON sb.stock_item_id = si.id AND sb.doctor_id = si.doctor_id
                                AND sb.quarantined_at IS NULL
                                AND sb.expires_on >= date('now')
        WHERE si.doctor_id = ?
     GROUP BY si.id
     ORDER BY si.medicine_name`
    ).bind(doctorId).all();
    return results || [];
  },

  /* Anything expiring inside `days`, and anything already expired with
     stock still on the shelf. Both need to reach the doctor. */
  async expiring(db, doctorId, days = 60) {
    const cutoff = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
    const { results } = await db.prepare(
      `SELECT sb.*, si.medicine_name, si.system
         FROM stock_batches sb
         JOIN stock_items si ON si.id = sb.stock_item_id AND si.doctor_id = sb.doctor_id
        WHERE sb.doctor_id = ? AND sb.quantity > 0 AND sb.expires_on <= ?
     ORDER BY sb.expires_on`
    ).bind(doctorId, cutoff).all();
    return results || [];
  },

  async belowReorder(db, doctorId) {
    const { results } = await db.prepare(
      `SELECT si.*, COALESCE(SUM(sb.quantity), 0) AS on_hand
         FROM stock_items si
    LEFT JOIN stock_batches sb ON sb.stock_item_id = si.id AND sb.doctor_id = si.doctor_id
                                AND sb.quarantined_at IS NULL
                                AND sb.expires_on >= date('now')
        WHERE si.doctor_id = ? AND si.reorder_level > 0
     GROUP BY si.id
       HAVING on_hand <= si.reorder_level`
    ).bind(doctorId).all();
    return results || [];
  },

  /* Every batch behind one item, including expired and quarantined ones -
     the doctor needs to see those precisely because they cannot be used. */
  /* Every batch behind one item, including expired and quarantined ones -
     the doctor needs to see those precisely because they cannot be used. */
  async batchesFor(db, doctorId, stockItemId) {
    const { results } = await db.prepare(
      `SELECT sb.*, si.medicine_name, si.unit,
              CAST(julianday(sb.expires_on) - julianday(date('now')) AS INTEGER) AS days_to_expiry
         FROM stock_batches sb
         JOIN stock_items si ON si.id = sb.stock_item_id AND si.doctor_id = sb.doctor_id
        WHERE sb.doctor_id = ? AND sb.stock_item_id = ?
     ORDER BY sb.expires_on ASC`
    ).bind(doctorId, stockItemId).all();
    return results || [];
  },

  async addItem(db, doctorId, item, { actor, idempotencyKey } = {}) {
    const key = cleanStockOperationKey(idempotencyKey);
    const prior = await priorStockOperation(db, doctorId, key, 'item_created');
    if (prior) {
      return db.prepare('SELECT * FROM stock_items WHERE id = ? AND doctor_id = ?')
        .bind(prior.target_id, doctorId).first();
    }
    const id = newId('sit');
    const operationId = newId('sop');
    const resultJson = JSON.stringify({ itemId: id });
    try {
      await db.batch([db.prepare(
        `INSERT INTO stock_operations
           (id, doctor_id, operation_key, kind, target_id, result_json, actor)
         VALUES (?, ?, ?, 'item_created', ?, ?, ?)`
      ).bind(operationId, doctorId, key, id, resultJson,
        actor || 'doctor:' + doctorId), db.prepare(
      `INSERT INTO stock_items (id, doctor_id, medicine_name, system, form, unit, reorder_level)
       VALUES (?,?,?,?,?,?,?)`
      ).bind(id, doctorId, item.medicineName, item.system || 'allopathy',
        item.form || null, item.unit || null, item.reorderLevel || 0), db.prepare(
        `INSERT INTO audit_events
           (id, doctor_id, actor, action, target_type, target_id, detail)
         SELECT ?, ?, ?, 'stock_item_created', 'stock_item', id, medicine_name
           FROM stock_items WHERE id = ? AND doctor_id = ?`
      ).bind(newId('aud'), doctorId, actor || 'doctor:' + doctorId, id, doctorId)]);
    } catch (error) {
      if (!String(error.message || '').includes('UNIQUE')) throw error;
      const won = await priorStockOperation(db, doctorId, key, 'item_created');
      if (!won) throw error;
      return db.prepare('SELECT * FROM stock_items WHERE id = ? AND doctor_id = ?')
        .bind(won.target_id, doctorId).first();
    }
    return db.prepare('SELECT * FROM stock_items WHERE id = ? AND doctor_id = ?')
      .bind(id, doctorId).first();
  },

  async receiveBatch(db, doctorId, batch, { actor, idempotencyKey } = {}) {
    const key = cleanStockOperationKey(idempotencyKey);
    const prior = await priorStockOperation(db, doctorId, key, 'stock_received');
    if (prior) {
      return db.prepare('SELECT * FROM stock_batches WHERE id = ? AND doctor_id = ?')
        .bind(prior.target_id, doctorId).first();
    }
    const owns = await db.prepare(
      'SELECT 1 AS ok FROM stock_items WHERE id = ? AND doctor_id = ?'
    ).bind(batch.stockItemId, doctorId).first();
    if (!owns) throw notFound('Stock item not found.');

    const quantity = Number(batch.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw badRequest('Quantity must be more than zero.');
    }
    const expiresOn = String(batch.expiresOn || '');
    const today = new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresOn) || expiresOn <= today) {
      throw badRequest('The expiry date must be after today. Check the pack.');
    }

    const id = newId('bat');
    const operationId = newId('sop');
    const resultJson = JSON.stringify({ batchId: id, quantity });
    try {
      await db.batch([db.prepare(
        `INSERT INTO stock_operations
           (id, doctor_id, operation_key, kind, target_id, quantity, result_json, actor)
         VALUES (?, ?, ?, 'stock_received', ?, ?, ?, ?)`
      ).bind(operationId, doctorId, key, id, quantity, resultJson,
        actor || 'doctor:' + doctorId), db.prepare(
      `INSERT INTO stock_batches (id, stock_item_id, doctor_id, batch_no, expires_on,
        quantity, cost_price, sale_price) VALUES (?,?,?,?,?,?,?,?)`
      ).bind(id, batch.stockItemId, doctorId, batch.batchNo || null, expiresOn,
        quantity, batch.costPrice == null ? null : batch.costPrice,
        batch.salePrice == null ? null : batch.salePrice), db.prepare(
      `INSERT INTO stock_movements
         (id, doctor_id, batch_id, direction, quantity, reason, operation_id)
       VALUES (?,?,?,'in',?,'received',?)`
      ).bind(newId('mov'), doctorId, id, quantity, operationId), db.prepare(
        `INSERT INTO audit_events
           (id, doctor_id, actor, action, target_type, target_id, detail)
         SELECT ?, ?, ?, 'stock_received', 'batch', id,
                COALESCE(batch_no, 'unbatched') || ' x' || quantity
           FROM stock_batches WHERE id = ? AND doctor_id = ?`
      ).bind(newId('aud'), doctorId, actor || 'doctor:' + doctorId, id, doctorId)]);
    } catch (error) {
      if (!String(error.message || '').includes('UNIQUE')) throw error;
      const won = await priorStockOperation(db, doctorId, key, 'stock_received');
      if (!won) throw error;
      return db.prepare('SELECT * FROM stock_batches WHERE id = ? AND doctor_id = ?')
        .bind(won.target_id, doctorId).first();
    }
    return db.prepare('SELECT * FROM stock_batches WHERE id = ? AND doctor_id = ?')
      .bind(id, doctorId).first();
  },

  /* Dispense oldest-expiring stock first, and never anything already
     expired. Returns the batches drawn from. */
  async dispense(db, doctorId, {
    stockItemId, quantity, patientId, prescriptionItemId, idempotencyKey, actor
  }) {
    const key = cleanStockOperationKey(idempotencyKey);
    const prior = await priorStockOperation(db, doctorId, key, 'stock_dispensed');
    if (prior) return prior.result.drawnFrom || [];

    const cleanQuantity = Number(quantity);
    if (!Number.isFinite(cleanQuantity) || cleanQuantity <= 0) {
      throw badRequest('Quantity must be more than zero.');
    }
    const owns = await db.prepare(
      'SELECT 1 AS ok FROM stock_items WHERE id = ? AND doctor_id = ?'
    ).bind(stockItemId, doctorId).first();
    if (!owns) throw notFound('Stock item not found.');
    if (prescriptionItemId) {
      const line = await db.prepare(
        `SELECT 1 AS ok FROM prescription_items
          WHERE id = ? AND doctor_id = ?`
      ).bind(prescriptionItemId, doctorId).first();
      if (!line) throw badRequest('That prescription line does not belong to this clinic.');
    }
    const today = new Date().toISOString().slice(0, 10);
    /* In date, on the shelf, and not quarantined. */
    const { results: batches } = await db.prepare(
      `SELECT * FROM stock_batches
        WHERE doctor_id = ? AND stock_item_id = ? AND quantity > 0
          AND expires_on >= ? AND quarantined_at IS NULL
     ORDER BY expires_on ASC`
    ).bind(doctorId, stockItemId, today).all();

    const available = (batches || []).reduce((sum, b) => sum + b.quantity, 0);
    if (available < cleanQuantity) {
      throw forbidden('Only ' + available + ' in date. Receive stock before dispensing.');
    }

    let remaining = cleanQuantity;
    const drawn = [];
    for (const batch of batches) {
      if (remaining <= 0) break;
      const take = Math.min(batch.quantity, remaining);
      drawn.push({ batchId: batch.id, batchNo: batch.batch_no,
        expiresOn: batch.expires_on, quantity: take });
      remaining -= take;
    }

    const operationId = newId('sop');
    const resultJson = JSON.stringify({ drawnFrom: drawn });
    const statements = [db.prepare(
      `INSERT INTO stock_operations
         (id, doctor_id, operation_key, kind, target_id, quantity, result_json, actor)
       VALUES (?, ?, ?, 'stock_dispensed', ?, ?, ?, ?)`
    ).bind(operationId, doctorId, key, stockItemId, cleanQuantity, resultJson,
      actor || 'doctor:' + doctorId)];
    for (const draw of drawn) {
      statements.push(db.prepare(
        `INSERT INTO stock_movements (id, doctor_id, batch_id, patient_id, direction,
          quantity, reason, prescription_item_id, operation_id)
         SELECT ?,?,?,?,'out',?,'dispensed',?,?
          WHERE EXISTS (SELECT 1 FROM stock_operations
                         WHERE id = ? AND doctor_id = ?)`
      ).bind(newId('mov'), doctorId, draw.batchId, patientId || null,
        draw.quantity, prescriptionItemId || null, operationId,
        operationId, doctorId));
      statements.push(db.prepare(
        `UPDATE stock_batches SET quantity = quantity - ?
          WHERE id = ? AND doctor_id = ?
            AND EXISTS (SELECT 1 FROM stock_operations
                         WHERE id = ? AND doctor_id = ?)`
      ).bind(draw.quantity, draw.batchId, doctorId, operationId, doctorId));
    }
    statements.push(db.prepare(
      `INSERT INTO usage_events
         (id, doctor_id, event_type, quantity, unit, idempotency_key)
       SELECT ?, ?, 'stock_dispensed', ?, 'unit', ?
        WHERE EXISTS (SELECT 1 FROM stock_operations
                       WHERE id = ? AND doctor_id = ?)`
    ).bind(newId('use'), doctorId, cleanQuantity, 'stock-dispense:' + key,
      operationId, doctorId));
    statements.push(db.prepare(
      `INSERT INTO audit_events
         (id, doctor_id, actor, action, target_type, target_id, detail)
       SELECT ?, ?, ?, 'stock_dispensed', 'stock_item', ?, ?
        WHERE EXISTS (SELECT 1 FROM stock_operations
                       WHERE id = ? AND doctor_id = ?)`
    ).bind(newId('aud'), doctorId, actor || 'doctor:' + doctorId,
      stockItemId, String(cleanQuantity), operationId, doctorId));
    try {
      await db.batch(statements);
    } catch (error) {
      if (String(error.message || '').includes('UNIQUE')) {
        const won = await priorStockOperation(db, doctorId, key, 'stock_dispensed');
        if (won) return won.result.drawnFrom || [];
      }
      if (/stock batch is no longer usable or sufficient/i.test(String(error.message || ''))) {
        const latest = await this.list(db, doctorId);
        const item = latest.find(row => row.id === stockItemId);
        throw forbidden('Stock changed while dispensing. Only ' +
          Number(item && item.on_hand || 0) + ' is usable now. Refresh and try again.');
      }
      throw error;
    }
    return drawn;
  },

  /* Take a batch off the shelf without pretending it was used: a recall,
     damage, a failed check. Expiry alone does not cover any of those. */
  async quarantine(db, doctorId, batchId, reason, actor, idempotencyKey) {
    if (!reason) throw badRequest('Say why the batch is being quarantined.');
    const key = cleanStockOperationKey(idempotencyKey);
    const prior = await priorStockOperation(db, doctorId, key, 'batch_quarantined');
    if (prior) return prior.result;
    const batch = await db.prepare(
      'SELECT * FROM stock_batches WHERE id = ? AND doctor_id = ?'
    ).bind(batchId, doctorId).first();
    if (!batch) throw notFound('Batch not found.');
    if (batch.quarantined_at) {
      return { batchId, quantityHeld: batch.quantity, repeated: true };
    }
    const operationId = newId('sop');
    const at = nowIso();
    const result = { batchId, quantityHeld: batch.quantity };
    let results;
    try {
      results = await db.batch([db.prepare(
        `INSERT INTO stock_operations
           (id, doctor_id, operation_key, kind, target_id, quantity, result_json, actor)
         SELECT ?, ?, ?, 'batch_quarantined', id, quantity, ?, ?
           FROM stock_batches
          WHERE id = ? AND doctor_id = ? AND quarantined_at IS NULL`
      ).bind(operationId, doctorId, key, JSON.stringify(result),
        actor || 'doctor:' + doctorId, batchId, doctorId), db.prepare(
        `UPDATE stock_batches SET quarantined_at = ?, quarantine_reason = ?
          WHERE id = ? AND doctor_id = ? AND quarantined_at IS NULL
            AND EXISTS (SELECT 1 FROM stock_operations WHERE id = ? AND doctor_id = ?)`
      ).bind(at, String(reason).trim(), batchId, doctorId, operationId, doctorId), db.prepare(
        `INSERT INTO audit_events
           (id, doctor_id, actor, action, target_type, target_id, detail)
         SELECT ?, ?, ?, 'batch_quarantined', 'batch', ?, ?
          WHERE EXISTS (SELECT 1 FROM stock_operations WHERE id = ? AND doctor_id = ?)`
      ).bind(newId('aud'), doctorId, actor || 'doctor:' + doctorId,
        batchId, String(reason).trim(), operationId, doctorId)]);
    } catch (error) {
      if (!String(error.message || '').includes('UNIQUE')) throw error;
      const won = await priorStockOperation(db, doctorId, key, 'batch_quarantined');
      if (won) return won.result;
      throw error;
    }
    if (changedRows(results[0]) !== 1) {
      const current = await db.prepare(
        'SELECT * FROM stock_batches WHERE id = ? AND doctor_id = ?'
      ).bind(batchId, doctorId).first();
      return { batchId, quantityHeld: current ? current.quantity : 0, repeated: true };
    }
    return result;
  },

  /* Writing off expired stock records where it went. Quietly zeroing the
     quantity would leave the shelf and the record disagreeing. */
  async writeOff(db, doctorId, batchId, reason, actor, idempotencyKey) {
    const key = cleanStockOperationKey(idempotencyKey);
    const prior = await priorStockOperation(db, doctorId, key, 'batch_written_off');
    if (prior) return prior.result;
    const batch = await db.prepare(
      'SELECT * FROM stock_batches WHERE id = ? AND doctor_id = ?'
    ).bind(batchId, doctorId).first();
    if (!batch) throw notFound('Batch not found.');
    const quantity = Number(batch.quantity);
    if (!(quantity > 0)) return { written: 0, batchId, repeated: true };
    const operationId = newId('sop');
    const cleanReason = String(reason || 'expired').trim() || 'expired';
    const result = { written: quantity, batchId };
    let results;
    try {
      results = await db.batch([db.prepare(
        `INSERT INTO stock_operations
           (id, doctor_id, operation_key, kind, target_id, quantity, result_json, actor)
         SELECT ?, ?, ?, 'batch_written_off', id, quantity, ?, ?
           FROM stock_batches
          WHERE id = ? AND doctor_id = ? AND quantity = ? AND quantity > 0`
      ).bind(operationId, doctorId, key, JSON.stringify(result),
        actor || 'doctor:' + doctorId, batchId, doctorId, quantity), db.prepare(
        `INSERT INTO stock_movements
           (id, doctor_id, batch_id, direction, quantity, reason, operation_id)
         SELECT ?, ?, ?, 'expired', ?, ?, ?
          WHERE EXISTS (SELECT 1 FROM stock_operations WHERE id = ? AND doctor_id = ?)`
      ).bind(newId('mov'), doctorId, batchId, quantity, cleanReason, operationId,
        operationId, doctorId), db.prepare(
        `UPDATE stock_batches SET quantity = 0
          WHERE id = ? AND doctor_id = ? AND quantity = ?
            AND EXISTS (SELECT 1 FROM stock_operations WHERE id = ? AND doctor_id = ?)`
      ).bind(batchId, doctorId, quantity, operationId, doctorId), db.prepare(
        `INSERT INTO audit_events
           (id, doctor_id, actor, action, target_type, target_id, detail)
         SELECT ?, ?, ?, 'batch_written_off', 'batch', ?, ?
          WHERE EXISTS (SELECT 1 FROM stock_operations WHERE id = ? AND doctor_id = ?)`
      ).bind(newId('aud'), doctorId, actor || 'doctor:' + doctorId,
        batchId, cleanReason + ' x' + quantity, operationId, doctorId)]);
    } catch (error) {
      if (String(error.message || '').includes('UNIQUE')) {
        const won = await priorStockOperation(db, doctorId, key, 'batch_written_off');
        if (won) return won.result;
      }
      throw error;
    }
    if (changedRows(results[0]) !== 1) {
      const current = await db.prepare(
        'SELECT quantity FROM stock_batches WHERE id = ? AND doctor_id = ?'
      ).bind(batchId, doctorId).first();
      if (!current || !(current.quantity > 0)) {
        return { written: 0, batchId, repeated: true };
      }
      throw forbidden('Stock changed before write-off. Refresh the batch and try again.');
    }
    return result;
  },

  /* The question the whole module exists to answer: did the patient get
     what was written for them? */
  async prescribedVersusDispensed(db, doctorId, prescriptionId) {
    const { results } = await db.prepare(
      `SELECT pi.id, pi.medicine_name, pi.system, pi.dispense_quantity,
              COALESCE((SELECT SUM(sm.quantity) FROM stock_movements sm
                         WHERE sm.prescription_item_id = pi.id
                           AND sm.doctor_id = pi.doctor_id
                           AND sm.direction = 'out'), 0) AS dispensed
         FROM prescription_items pi
        WHERE pi.prescription_id = ? AND pi.doctor_id = ?
     ORDER BY pi.sort_order`
    ).bind(prescriptionId, doctorId).all();
    return (results || []).map(row => ({
      ...row,
      outstanding: row.dispense_quantity == null
        ? null : Math.max(0, row.dispense_quantity - row.dispensed)
    }));
  }
};

/* =========================================================================
   CONSENT - the only route to another doctor's records.

   activeGrant() is the gate. Nothing below it runs without one, and every
   read writes a line to consent_access_log so the patient can see who
   looked at their history.
   ========================================================================= */

export const consent = {
  async activeGrant(db, patientId, readerDoctorId) {
    const row = await db.prepare(
      `SELECT * FROM consent_grants
        WHERE patient_id = ? AND granted_to_doctor = ?
          AND revoked_at IS NULL AND expires_at > ?
     ORDER BY granted_at DESC LIMIT 1`
    ).bind(patientId, readerDoctorId, nowIso()).first();
    return row || null;
  },

  async grant(db, { patientId, doctorId, ttlHours, scope = 'full_history' }) {
    const id = newId('con');
    await db.prepare(
      `INSERT INTO consent_grants (id, patient_id, granted_to_doctor, scope, method, expires_at)
       VALUES (?,?,?,?,'patient_otp',?)`
    ).bind(id, patientId, doctorId, scope, plusHours(ttlHours)).run();
    return db.prepare('SELECT * FROM consent_grants WHERE id = ?').bind(id).first();
  },

  async revoke(db, grantId, patientId) {
    await db.prepare(
      'UPDATE consent_grants SET revoked_at = ? WHERE id = ? AND patient_id = ?'
    ).bind(nowIso(), grantId, patientId).run();
  },

  async logAccess(db, grant, readerId, ownerId, recordType, recordId) {
    await db.prepare(
      `INSERT INTO consent_access_log (id, grant_id, patient_id, reader_id, owner_id, record_type, record_id)
       VALUES (?,?,?,?,?,?,?)`
    ).bind(newId('cal'), grant.id, grant.patient_id, readerId, ownerId, recordType, recordId || null).run();
  },

  async accessLogForPatient(db, patientId) {
    const { results } = await db.prepare(
      `SELECT cal.*, d.clinic_name AS reader_clinic
         FROM consent_access_log cal
    LEFT JOIN doctors d ON d.id = cal.reader_id
        WHERE cal.patient_id = ? ORDER BY cal.accessed_at DESC LIMIT 200`
    ).bind(patientId).all();
    return results || [];
  },

  /* The whole point of the platform: the previous doctors' record of this
     patient, readable because the patient approved it. Notice this is the
     ONLY function in the file that reads rows belonging to another doctor,
     and it cannot run without a grant. */
  async sharedHistory(db, readerDoctorId, patientId) {
    const grant = await this.activeGrant(db, patientId, readerDoctorId);
    if (!grant) {
      throw forbidden('The patient has not approved sharing their history with you yet.');
    }

    const { results: priorVisits } = await db.prepare(
      `SELECT v.id, v.doctor_id, v.visited_on, v.visit_type, v.complaints, v.diagnosis,
              v.advice, d.clinic_name, d.full_name AS doctor_name
         FROM visits v JOIN doctors d ON d.id = v.doctor_id
        WHERE v.patient_id = ? AND v.doctor_id != ?
     ORDER BY v.visited_on DESC LIMIT 100`
    ).bind(patientId, readerDoctorId).all();

    const { results: priorMedicines } = await db.prepare(
      `SELECT pi.medicine_name, pi.system, pi.dose, pi.frequency, pi.duration,
              p.issued_on, p.doctor_id, d.clinic_name
         FROM prescription_items pi
         JOIN prescriptions p ON p.id = pi.prescription_id
         JOIN doctors d ON d.id = p.doctor_id
        WHERE p.patient_id = ? AND p.doctor_id != ?
     ORDER BY p.issued_on DESC LIMIT 200`
    ).bind(patientId, readerDoctorId).all();

    const { results: priorLabs } = await db.prepare(
      `SELECT lr.id, lr.doctor_id, lr.report_name, lr.reported_on, lr.status,
              d.clinic_name, lv.analyte, lv.value, lv.unit, lv.reference, lv.flag
         FROM lab_reports lr
         JOIN doctors d ON d.id = lr.doctor_id
    LEFT JOIN lab_values lv ON lv.lab_report_id = lr.id
        WHERE lr.patient_id = ? AND lr.doctor_id != ?
     ORDER BY lr.reported_on DESC LIMIT 300`
    ).bind(patientId, readerDoctorId).all();

    /* Private notes are never shared, under any grant. They are the
       doctor's own working thoughts, not the patient's record. */
    await this.logAccess(db, grant, readerDoctorId, 'multiple', 'shared_history', patientId);

    return {
      grantExpiresAt: grant.expires_at,
      visits: priorVisits || [],
      medicines: priorMedicines || [],
      labs: priorLabs || []
    };
  }
};


/* --------------------------------------------------------------- appointments
   A day is a list of people, not a grid of slots. Time is optional because
   plenty of these clinics are walk-in; order is what matters. */

export const appointments = {
  async forDay(db, doctorId, day) {
    const { results } = await db.prepare(
      `SELECT a.*, p.full_name, p.mobile, p.patient_code, p.sex
         FROM appointments a
         JOIN patients p ON p.id = a.patient_id
        WHERE a.doctor_id = ? AND a.scheduled_on = ?
     ORDER BY CASE WHEN a.scheduled_at IS NULL THEN 1 ELSE 0 END,
              a.scheduled_at, a.created_at`
    ).bind(doctorId, day).all();
    return results || [];
  },

  /* What is coming, so the doctor can see past today without paging. */
  /* One row per day either side of today, for the strip on Today.

     Nothing new is recorded to make this: it counts appointments that were
     already there. Grouped in SQL rather than by pulling every row down and
     counting in the browser, because a busy clinic's fortnight is a lot of
     rows to send in order to display fourteen numbers. */
  async dailyCounts(db, doctorId, fromDay, toDay) {
    const { results } = await db.prepare(
      `SELECT scheduled_on AS day,
              COUNT(*) AS booked,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS seen,
              SUM(CASE WHEN status = 'no_show'   THEN 1 ELSE 0 END) AS missed
         FROM appointments
        WHERE doctor_id = ? AND scheduled_on >= ? AND scheduled_on <= ?
     GROUP BY scheduled_on ORDER BY scheduled_on`
    ).bind(doctorId, fromDay, toDay).all();
    return results || [];
  },

  async upcoming(db, doctorId, fromDay, days = 14) {
    const { results } = await db.prepare(
      `SELECT a.*, p.full_name, p.mobile, p.patient_code
         FROM appointments a
         JOIN patients p ON p.id = a.patient_id
        WHERE a.doctor_id = ? AND a.scheduled_on > ?
          AND a.scheduled_on <= date(?, '+' || ? || ' days')
          AND a.status = 'scheduled'
     ORDER BY a.scheduled_on, a.scheduled_at LIMIT 100`
    ).bind(doctorId, fromDay, fromDay, days).all();
    return results || [];
  },

  /* Anyone booked before today who was never marked seen. Left alone these
     quietly rot, and the doctor loses track of who never came back. */
  async unresolved(db, doctorId, before) {
    const { results } = await db.prepare(
      `SELECT a.*, p.full_name, p.mobile
         FROM appointments a
         JOIN patients p ON p.id = a.patient_id
        WHERE a.doctor_id = ? AND a.scheduled_on < ?
          AND a.status IN ('scheduled', 'arrived')
     ORDER BY a.scheduled_on DESC LIMIT 50`
    ).bind(doctorId, before).all();
    return results || [];
  },

  async forPatient(db, doctorId, patientId) {
    const { results } = await db.prepare(
      `SELECT * FROM appointments WHERE doctor_id = ? AND patient_id = ?
    ORDER BY scheduled_on DESC LIMIT 50`
    ).bind(doctorId, patientId).all();
    return results || [];
  },

  async byId(db, doctorId, id) {
    const row = await db.prepare(
      'SELECT * FROM appointments WHERE id = ? AND doctor_id = ?'
    ).bind(id, doctorId).first();
    if (!row) throw notFound('Appointment not found.');
    return row;
  },

  async create(db, doctorId, appointment) {
    const id = newId('apt');
    await db.prepare(
      `INSERT INTO appointments (id, doctor_id, patient_id, scheduled_on, scheduled_at,
        duration_mins, reason, source, from_visit_id, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).bind(id, doctorId, appointment.patientId, appointment.scheduledOn,
      appointment.scheduledAt || null, appointment.durationMins || 15,
      appointment.reason || null, appointment.source || 'manual',
      appointment.fromVisitId || null, appointment.notes || null).run();
    return this.byId(db, doctorId, id);
  },

  /* Called when a prescription is issued. The unique index on from_visit_id
     means re-issuing cannot book the same patient twice, so this quietly
     does nothing the second time rather than failing the prescription. */
  async createFromFollowUp(db, doctorId, { patientId, visitId, on, reason }) {
    if (!on || !visitId) return null;
    try {
      return await this.create(db, doctorId, {
        patientId, scheduledOn: on, source: 'follow_up',
        fromVisitId: visitId, reason: reason || 'Follow-up review'
      });
    } catch (error) {
      if (String(error.message || '').includes('UNIQUE')) return null;
      throw error;
    }
  },

  async setStatus(db, doctorId, id, status, reason) {
    const allowed = ['scheduled', 'arrived', 'completed', 'no_show', 'cancelled'];
    if (!allowed.includes(status)) throw badRequest('Unknown appointment status.');
    await this.byId(db, doctorId, id);
    await db.prepare(
      `UPDATE appointments
          SET status = ?,
              arrived_at = CASE WHEN ? = 'arrived' THEN ? ELSE arrived_at END,
              completed_at = CASE WHEN ? = 'completed' THEN ? ELSE completed_at END,
              cancel_reason = CASE WHEN ? IN ('cancelled','no_show') THEN ? ELSE cancel_reason END,
              updated_at = ?
        WHERE id = ? AND doctor_id = ?`
    ).bind(status, status, nowIso(), status, nowIso(), status, reason || null,
      nowIso(), id, doctorId).run();
    return this.byId(db, doctorId, id);
  },

  async reschedule(db, doctorId, id, { scheduledOn, scheduledAt }) {
    if (!scheduledOn) throw badRequest('A new date is required.');
    await this.byId(db, doctorId, id);
    await db.prepare(
      `UPDATE appointments SET scheduled_on = ?, scheduled_at = ?,
              status = 'scheduled', updated_at = ?
        WHERE id = ? AND doctor_id = ?`
    ).bind(scheduledOn, scheduledAt || null, nowIso(), id, doctorId).run();
    return this.byId(db, doctorId, id);
  }
};

/* -------------------------------------------------------- audit + usage */

export const audit = {
  async write(db, { doctorId, actor, action, targetType, targetId, detail, ip }) {
    await db.prepare(
      `INSERT INTO audit_events (id, doctor_id, actor, action, target_type, target_id, detail, ip)
       VALUES (?,?,?,?,?,?,?,?)`
    ).bind(newId('aud'), doctorId || null, actor, action, targetType || null,
      targetId || null, detail || null, ip || null).run();
  }
};

export const usage = {
  /* idempotencyKey is UNIQUE, so a retried request counts once. */
  async record(db, doctorId, { eventType, quantity = 1, unit, provider, model, estimatedCost, idempotencyKey, metadata }) {
    try {
      await db.prepare(
        `INSERT INTO usage_events (id, doctor_id, event_type, quantity, unit, provider,
          model, estimated_cost, idempotency_key, metadata)
         VALUES (?,?,?,?,?,?,?,?,?,?)`
      ).bind(newId('use'), doctorId, eventType, quantity, unit || null, provider || null,
        model || null, estimatedCost || null, idempotencyKey || newId('idem'),
        metadata ? JSON.stringify(metadata) : null).run();
    } catch (error) {
      if (!String(error.message || '').includes('UNIQUE')) throw error;
    }
  },

  async summary(db, doctorId, sinceIso) {
    const { results } = await db.prepare(
      `SELECT event_type, SUM(quantity) AS total, SUM(COALESCE(estimated_cost,0)) AS cost
         FROM usage_events WHERE doctor_id = ? AND occurred_at > ?
     GROUP BY event_type`
    ).bind(doctorId, sinceIso).all();
    return results || [];
  }
};

/* ------------------------------------------------------------- messages */

/* Everything WhatsApp, on the database side. See migration 031 and
   worker/whatsapp.js for why consent and de-duplication are treated as
   seriously as they are here. */
export const messages = {
  /* Claims the right to send, and returns null if somebody already has.

     The UNIQUE constraint on dedupe_key is what actually prevents a double
     send - not a SELECT first, which two overlapping timer runs would both
     pass. Writing the row BEFORE the network call means the loser of that
     race gets null and stops, and the worst case is a row marked queued
     that never sends, which is visible and recoverable. The other order
     round loses that: two messages, one row. */
  async claim(db, doctorId, { patientId, template, toMobile, aboutType, aboutId,
                              bodyPreview, dedupeKey, channel = 'whatsapp' }) {
    const id = newId('msg');
    try {
      await db.prepare(
        `INSERT INTO messages (id, doctor_id, patient_id, channel, template, to_mobile,
           body_preview, about_type, about_id, dedupe_key)
         VALUES (?,?,?,?,?,?,?,?,?,?)`
      ).bind(id, doctorId, patientId || null, channel, template, toMobile,
        bodyPreview || null, aboutType || null, aboutId || null, dedupeKey).run();
    } catch (error) {
      if (!String(error.message || '').includes('UNIQUE')) throw error;

      /* Something already holds this key. If it FAILED, it may be tried
         again - a clinic that ran out of messages on Tuesday and upgraded on
         Wednesday must not be silently barred from that reminder forever,
         which is what refusing outright used to do.

         The revival is the claim: WHERE status = 'failed' means only one of
         two concurrent attempts can win it, exactly as the INSERT does for a
         fresh key. A row already sent or delivered is never revived.

         Whether we won is decided by READING BACK the row rather than by
         trusting the driver's `changes` count - that field is absent in some
         D1 contexts, and treating absent as zero would silently block the
         message, which is the exact fault this block exists to repair. */
      await db.prepare(
        `UPDATE messages
            SET status = 'queued', error = NULL, id = ?, channel = ?,
                body_preview = ?, updated_at = ?
          WHERE dedupe_key = ? AND status = 'failed'`
      ).bind(id, channel, bodyPreview || null, nowIso(), dedupeKey).run();

      const now = await db.prepare(
        'SELECT id FROM messages WHERE dedupe_key = ?').bind(dedupeKey).first();
      return now && now.id === id ? id : null;
    }
    return id;
  },

  async markSent(db, id, providerId) {
    await db.prepare(
      `UPDATE messages SET status = 'sent', provider_id = ?, sent_at = ?, updated_at = ?
        WHERE id = ?`
    ).bind(providerId, nowIso(), nowIso(), id).run();
  },

  /* A failed send releases its claim by deleting the row, so tomorrow's run
     tries again. Keeping a failed row would silently retire the reminder -
     the patient never hears from us and nobody finds out. */
  async markFailed(db, id, reason, { retry = true } = {}) {
    if (retry) {
      await db.prepare('DELETE FROM messages WHERE id = ?').bind(id).run();
      return;
    }
    await db.prepare(
      `UPDATE messages SET status = 'failed', error = ?, updated_at = ? WHERE id = ?`
    ).bind(String(reason || '').slice(0, 300), nowIso(), id).run();
  },

  /* Delivery receipts arrive knowing only Meta's id. */
  async applyReceipt(db, providerId, status, error) {
    await db.prepare(
      `UPDATE messages SET status = ?, error = ?, updated_at = ?
        WHERE provider_id = ?`
    ).bind(status, error || null, nowIso(), providerId).run();
  },

  async listForDoctor(db, doctorId, limit = 100) {
    const { results } = await db.prepare(
      `SELECT m.*, p.full_name AS patient_name
         FROM messages m
         LEFT JOIN patients p ON p.id = m.patient_id
        WHERE m.doctor_id = ?
     ORDER BY m.created_at DESC LIMIT ?`
    ).bind(doctorId, limit).all();
    return results || [];
  },

  /* Tomorrow's appointments that still need a reminder.

     Scoped by doctor like everything else, and it checks consent in SQL
     rather than filtering afterwards: a patient who never opted in should
     not even be read into memory by a job that exists to message people. */
  async dueReminders(db, doctorId, day) {
    const { results } = await db.prepare(
      `SELECT a.id, a.scheduled_on, a.scheduled_at,
              p.id AS patient_id, p.full_name, p.mobile,
              p.whatsapp_opt_in, p.whatsapp_opted_out_at
         FROM appointments a
         JOIN patients p ON p.id = a.patient_id
        WHERE a.doctor_id = ?
          AND a.scheduled_on = ?
          AND a.status = 'scheduled'
          AND p.whatsapp_opt_in = 1
          AND p.whatsapp_opted_out_at IS NULL
     ORDER BY a.scheduled_at`
    ).bind(doctorId, day).all();
    return results || [];
  },

  /* The same day's appointments, for a HUMAN to message one at a time.

     Consent is treated differently here on purpose. Opting in is consent to
     be messaged AUTOMATICALLY; a receptionist choosing to message a patient
     of her own clinic is what already happens every day without any
     software, and requiring a tickbox for it would be theatre.

     What is NOT different: somebody who replied STOP stays excluded. That
     was the patient's own decision and it does not care which end the thumb
     is on. */
  async remindableByHand(db, doctorId, day) {
    const { results } = await db.prepare(
      `SELECT a.id, a.scheduled_on, a.scheduled_at,
              p.id AS patient_id, p.full_name, p.mobile,
              p.whatsapp_opt_in,
              (SELECT COUNT(*) FROM messages m
                WHERE m.about_type = 'appointment' AND m.about_id = a.id
                  AND m.status <> 'failed') AS already_messaged
         FROM appointments a
         JOIN patients p ON p.id = a.patient_id
        WHERE a.doctor_id = ?
          AND a.scheduled_on = ?
          AND a.status = 'scheduled'
          AND p.whatsapp_opted_out_at IS NULL
          AND p.mobile IS NOT NULL
     ORDER BY a.scheduled_at`
    ).bind(doctorId, day).all();
    return results || [];
  }
};

/* ------------------------------------------------------- consult notes */

/* The AI scribe's drafts. See migration 034 for why consent, deletion and
   the confirm step are shaped the way they are. */
export const consultNotes = {
  /* Consent first, always. The row exists before the microphone opens, so
     there is no path that records without one. */
  async open(db, doctorId, { patientId, consentBy }) {
    const id = newId('cn');
    await db.prepare(
      `INSERT INTO consult_notes (id, doctor_id, patient_id, consent_at, consent_by, status)
       VALUES (?,?,?,?,?, 'recording')`
    ).bind(id, doctorId, patientId, nowIso(), consentBy).run();
    return this.byId(db, doctorId, id);
  },

  async byId(db, doctorId, id) {
    return db.prepare('SELECT * FROM consult_notes WHERE id = ? AND doctor_id = ?')
      .bind(id, doctorId).first();
  },

  async listForDoctor(db, doctorId, limit = 40) {
    const { results } = await db.prepare(
      `SELECT n.*, p.full_name AS patient_name
         FROM consult_notes n
         LEFT JOIN patients p ON p.id = n.patient_id
        WHERE n.doctor_id = ?
     ORDER BY n.created_at DESC LIMIT ?`
    ).bind(doctorId, limit).all();
    return results || [];
  },

  async setAudio(db, doctorId, id, { audioKey, seconds }) {
    await db.prepare(
      `UPDATE consult_notes SET audio_key = ?, audio_seconds = ?,
              status = 'transcribing', updated_at = ?
        WHERE id = ? AND doctor_id = ?`
    ).bind(audioKey, seconds, nowIso(), id, doctorId).run();
  },

  async setDraft(db, doctorId, id, { transcript, language, note, costPaise }) {
    await db.prepare(
      `UPDATE consult_notes
          SET transcript = ?, language = ?, complaints = ?, history = ?,
              examination = ?, advice = ?, follow_up = ?,
              speakers = ?, speaker_confidence = ?,
              cost_paise = ?, status = 'ready', error = NULL, updated_at = ?
        WHERE id = ? AND doctor_id = ?`
    ).bind(transcript, language || null, note.complaints, note.history,
      note.examination, note.advice, note.followUp,
      /* Anything the model did not answer is stored as "unclear", never as
         fine - the safe default is the one that makes her read it. */
      note.speakers || null, note.confidence || 'unclear',
      costPaise || 0, nowIso(), id, doctorId).run();
  },

  async fail(db, doctorId, id, reason) {
    await db.prepare(
      `UPDATE consult_notes SET status = 'failed', error = ?, updated_at = ?
        WHERE id = ? AND doctor_id = ?`
    ).bind(String(reason || '').slice(0, 300), nowIso(), id, doctorId).run();
  },

  /* The audio is gone. NULLing the key in the same statement that stamps
     the time means a row can never point at bytes that no longer exist. */
  async markAudioDeleted(db, doctorId, id) {
    await db.prepare(
      `UPDATE consult_notes SET audio_key = NULL, audio_deleted_at = ?, updated_at = ?
        WHERE id = ? AND doctor_id = ?`
    ).bind(nowIso(), nowIso(), id, doctorId).run();
  },

  async confirm(db, doctorId, id, visitId) {
    const result = await db.prepare(
      `UPDATE consult_notes SET status = 'confirmed', visit_id = ?, updated_at = ?
        WHERE id = ? AND doctor_id = ? AND status = 'ready'`
    ).bind(visitId || null, nowIso(), id, doctorId).run();
    if (changedRows(result) !== 1) {
      throw badRequest('That note is not ready, or has already been handled.');
    }
  },

  async fromVisit(db, doctorId, visitId) {
    if (!visitId) return null;
    return db.prepare(
      `SELECT * FROM appointments
        WHERE doctor_id = ? AND from_visit_id = ? AND source = 'follow_up'`
    ).bind(doctorId, visitId).first();
  },

  /* A confirmed AI note and the visit it becomes are one medical event.
     Conditional INSERT claims the ready draft; the batch prevents a retry,
     double-click or later statement failure from leaving an orphan visit or
     a confirmed note with no visit. */
  async confirmAsVisit(db, doctorId, id, visit, { actor, practitionerId }) {
    const visitId = newId('vis');
    const at = nowIso();
    const statements = [db.prepare(
      `INSERT INTO visits
         (id, doctor_id, patient_id, visited_on, visit_type, complaints,
          diagnosis, vitals, findings, advice, follow_up_on, practitioner_id)
       SELECT ?, n.doctor_id, n.patient_id, ?, ?, ?, ?, ?, ?, ?, ?, ?
         FROM consult_notes n
        WHERE n.id = ? AND n.doctor_id = ? AND n.status = 'ready'`
    ).bind(visitId, visit.visitedOn, visit.visitType || 'follow_up',
      visit.complaints || null, visit.diagnosis || null,
      JSON.stringify(visit.vitals || {}), JSON.stringify(visit.findings || {}),
      visit.advice || null, visit.followUpOn || null, practitionerId || null,
      id, doctorId), db.prepare(
      `UPDATE doctor_patients SET last_seen_on = ?
        WHERE doctor_id = ?
          AND patient_id = (SELECT patient_id FROM visits
                              WHERE id = ? AND doctor_id = ?)`
    ).bind(visit.visitedOn, doctorId, visitId, doctorId), db.prepare(
      `UPDATE consult_notes
          SET status = 'confirmed', visit_id = ?, updated_at = ?
        WHERE id = ? AND doctor_id = ? AND status = 'ready'
          AND EXISTS (SELECT 1 FROM visits WHERE id = ? AND doctor_id = ?)`
    ).bind(visitId, at, id, doctorId, visitId, doctorId), db.prepare(
      `INSERT INTO audit_events
         (id, doctor_id, actor, action, target_type, target_id)
       SELECT ?, ?, ?, 'consult_note_confirmed', 'visit', ?
        WHERE EXISTS (SELECT 1 FROM visits WHERE id = ? AND doctor_id = ?)`
    ).bind(newId('aud'), doctorId, actor, visitId, visitId, doctorId)];

    const results = await db.batch(statements);
    if (changedRows(results[0]) !== 1) {
      throw badRequest('That note is not ready, or has already been handled. Refresh the list.');
    }
    return visits.byId(db, doctorId, visitId);
  },

  async reject(db, doctorId, id) {
    const result = await db.prepare(
      `UPDATE consult_notes SET status = 'rejected', updated_at = ?
        WHERE id = ? AND doctor_id = ? AND status != 'confirmed' AND status != 'rejected'`
    ).bind(nowIso(), id, doctorId).run();
    if (changedRows(result) !== 1) {
      throw badRequest('That note has already been handled.');
    }
  },

  /* Rows still holding a voice. The sweep that empties them runs on the
     same nightly timer as the reminders. */
  async stillHoldingAudio(db, olderThanIso) {
    const { results } = await db.prepare(
      `SELECT id, doctor_id, audio_key FROM consult_notes
        WHERE audio_key IS NOT NULL AND created_at < ?`
    ).bind(olderThanIso).all();
    return results || [];
  }
};

/* The medicine catalogue a doctor types against. Reference data shared by
   every clinic - deliberately no doctor_id, because the medicines that exist
   in India do not differ by practice and nothing here is about a patient.

   It is a typing aid. It never decides a dose, never blocks a prescription,
   and the doctor can always type something that is not in the list. */
export const drugs = {
  /* One round trip per search: the names AND the strengths each is sold in,
     so choosing a name does not cost another call.

     Ranking matters more than it looks. A doctor typing "para" wants
     Paracetamol first, not Paradichlorobenzene, and an Ayurvedic doctor
     typing "ashwa" wants Ashwagandha ahead of a herb whose Sanskrit synonym
     merely contains those letters. */
  async search(db, { term, system, limit = 8 }) {
    const q = String(term || '').trim().toLowerCase();
    if (q.length < 2) return [];

    const like = q.replace(/[%_]/g, '') + '%';
    const params = [q, like, '% ' + like, '%' + like];
    let where = 'search_text LIKE ?';
    const bind = ['%' + like];

    if (system && system !== 'all') { where += ' AND system = ?'; bind.push(system); }

    const { results } = await db.prepare(
      `SELECT id, system, name, detail,
              CASE WHEN LOWER(name) = ?        THEN 0
                   WHEN LOWER(name) LIKE ?     THEN 1
                   WHEN search_text LIKE ?     THEN 2
                   WHEN search_text LIKE ?     THEN 3
                   ELSE 4 END AS rank
         FROM drug_catalogue
        WHERE ${where}
     ORDER BY rank, popularity DESC, name
        LIMIT ?`
    ).bind(...params, ...bind, Math.min(Number(limit) || 8, 25)).all();

    const found = results || [];
    if (!found.length) return [];

    const holes = found.map(() => '?').join(',');
    const { results: doses } = await db.prepare(
      `SELECT drug_id, strength, form FROM drug_strengths
        WHERE drug_id IN (${holes}) ORDER BY drug_id, weight DESC`
    ).bind(...found.map(d => d.id)).all();

    const byDrug = new Map();
    for (const d of doses || []) {
      if (!byDrug.has(d.drug_id)) byDrug.set(d.drug_id, []);
      byDrug.get(d.drug_id).push({ strength: d.strength, form: d.form || null });
    }

    return found.map(d => ({
      id: d.id, system: d.system, name: d.name, detail: d.detail,
      strengths: byDrug.get(d.id) || []
    }));
  }
};

/* ------------------------------------------------------------- care plans
   The diet, lifestyle and exercise plan a doctor writes at a consultation.

   Clinic-scoped, unlike allergies: what a homeopath advises a patient to eat
   is her clinical opinion, not a fact about the patient, and it is not for
   another clinic to publish under its own name.

   The lists are stored as JSON text because each one is short, typed by the
   doctor, read back whole and never queried across - "find every patient
   told to avoid sugar" is not a question this product asks. Five child
   tables and five joins would buy nothing.

   Reading and writing both go through here so the JSON never leaks into the
   router: a caller hands over arrays and gets arrays back. */
const PLAN_LISTS = ['meals', 'prefer', 'avoid', 'routine', 'exercises', 'precautions'];

const readPlan = row => {
  if (!row) return null;
  const plan = { id: row.id, visitId: row.visit_id, updatedAt: row.updated_at };
  for (const key of PLAN_LISTS) {
    try { plan[key] = JSON.parse(row[key] || '[]'); }
    catch (_) { plan[key] = []; }
    if (!Array.isArray(plan[key])) plan[key] = [];
  }
  return plan;
};

export const carePlans = {
  async forVisit(db, doctorId, visitId) {
    const row = await db.prepare(
      'SELECT * FROM care_plans WHERE doctor_id = ? AND visit_id = ?'
    ).bind(doctorId, visitId).first();
    return readPlan(row);
  },

  async latestForPatient(db, doctorId, patientId) {
    const row = await db.prepare(
      `SELECT * FROM care_plans WHERE doctor_id = ? AND patient_id = ?
        ORDER BY updated_at DESC LIMIT 1`
    ).bind(doctorId, patientId).first();
    return readPlan(row);
  },

  /* One plan per visit. The UNIQUE index carries the rule; this uses it
     rather than checking first and racing, so two saves a second apart
     update one row instead of leaving the patient holding two plans. */
  async save(db, doctorId, patientId, visitId, plan) {
    const values = PLAN_LISTS.map(key =>
      JSON.stringify(Array.isArray(plan[key]) ? plan[key] : []));
    await db.prepare(
      `INSERT INTO care_plans
         (id, doctor_id, patient_id, visit_id, meals, prefer, avoid, routine,
          exercises, precautions)
       VALUES (?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(doctor_id, visit_id) DO UPDATE SET
         meals = excluded.meals, prefer = excluded.prefer,
         avoid = excluded.avoid, routine = excluded.routine,
         exercises = excluded.exercises, precautions = excluded.precautions,
         updated_at = datetime('now')`
    ).bind(newId('plan'), doctorId, patientId, visitId, ...values).run();
    return this.forVisit(db, doctorId, visitId);
  }
};

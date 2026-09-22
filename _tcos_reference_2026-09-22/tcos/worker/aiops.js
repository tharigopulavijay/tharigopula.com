/* =========================================================================
   The thing that watches what the AI is spending.

   VIJAY'S QUESTION, which is the right one: if an agent burns 80% of the
   credits in minutes, who notices, who stops it, and who tells the doctor?
   Today: nobody, nothing, and nobody. This file is the answer to all three.

   WHY IT MATTERS MORE HERE THAN IN MOST SOFTWARE. TCOS sells FIXED monthly
   plans and pays VARIABLE per-call costs. Revenue is capped; spend is not.
   The per-plan allowance does not protect against this, because allowances
   count DOCUMENTS and the bill counts TOKENS - and those two come apart
   exactly when something is wrong. A hundred documents is a busy Tuesday.
   A hundred retries of ONE document is a bug, and it is also "a hundred
   documents" as far as the allowance is concerned.

   FOUR THINGS THAT GO WRONG, and what stops each:

     a retry loop            -> the rolling-window spend cap
     one pathological file   -> the per-call ceiling, checked BEFORE calling
     a bug in our own code   -> the platform-wide cap, which is the only one
                                that can see a fault affecting every clinic
     one clinic bulk-loading -> the per-clinic cap, which stops her without
                                stopping anybody else

   THE RULE THE WHOLE FILE OBEYS. When it says no, the work is PARKED, never
   lost. The doctor is told plainly that her document is safe and will be
   read shortly. A clinic that loses a lab report because our billing guard
   fired would be right never to trust us again - the guard exists to protect
   the business, and it must not do it by damaging the clinic.
   ========================================================================= */

import { newId, nowIso, ApiError } from '@tharigopula/core/lib';

/* Kept small on purpose. Every one of these is a question somebody will ask
   at 11pm - "what is the limit", "why did it stop", "when does it come
   back" - and the answer should be one row, not a code search. */
const DEFAULT_LIMITS = {
  call_ceiling: 2500,
  clinic_hour: 15000,
  clinic_day: 60000,
  platform_hour: 100000,
  platform_day: 400000
};

/* How long a breaker stays open before it lets one call through to test the
   water. Long enough that a runaway does not simply resume; short enough
   that a clinic is not dead for the afternoon. */
const OPEN_MINUTES = 20;

export const aiops = {

  /* ---------------------------------------------------- what it may cost --
     The only honest signal available BEFORE the call is the file itself.
     Bytes drive image tokens, and pages drive PDF tokens, so size is a fair
     proxy - and the case this exists to catch, a 300-page PDF, is enormous
     by exactly this measure.

     Deliberately pessimistic. Being wrong high means one large document is
     refused and somebody splits it; being wrong low means the ceiling does
     not fire on the only occasion it was needed. */
  estimatePaise(bytes = 0, contentType = '') {
    const mb = Math.max(0, Number(bytes) || 0) / (1024 * 1024);

    /* CALIBRATED AGAINST A REAL DOCUMENT, 4 Sep 2026. The first live read was
       a 24-page master health check-up, 1997 KB, of which preflight passed 21
       pages to extraction. It returned 148 values and cost ₹77.75.

       That is ~3900 paise per MB, not the 900 guessed here originally - and
       the guess mattered, because the per-call ceiling is only a protection
       if the estimate is in the right order of magnitude. At 900 this
       document was estimated at ₹20.75, sailed under the ₹25 ceiling, and
       then cost nearly four times the estimate. A ceiling that only fires
       after the money is spent is not a ceiling.

       The real unit is roughly ₹3.70 PER PAGE, and for a PDF the page count
       is what drives everything. Photographs are one page by definition, so
       they stay cheap and their rate is unchanged. */
    const perMb = contentType === 'application/pdf' ? 3900 : 260;
    const base = 320;                       /* the fixed prompt and schema */
    return Math.round(base + mb * perMb);
  },


  /* ------------------------------------------------------------ limits --
     Read from the database so a limit can be raised without a deploy. Falls
     back to the constants above if the table is missing, because a guard
     that crashes when its own configuration is unavailable has made things
     worse rather than better. */
  async limits(db) {
    try {
      const { results } = await db.prepare('SELECT key, value_paise FROM ai_limits').all();
      const found = Object.fromEntries((results || []).map(r => [r.key, r.value_paise]));
      return { ...DEFAULT_LIMITS, ...found };
    } catch (_) {
      return { ...DEFAULT_LIMITS };
    }
  },

  /* ------------------------------------------------------------- spend --
     What has been spent in a rolling window. Rolling rather than calendar,
     because a runaway at 11:50pm should not be forgiven at midnight. */
  async spentSince(db, doctorId, minutes) {
    const row = doctorId
      ? await db.prepare(
          `SELECT COALESCE(SUM(cost_paise),0) AS paise, COUNT(*) AS calls
             FROM ai_spend
            WHERE doctor_id = ? AND created_at >= datetime('now', ?)`
        ).bind(doctorId, '-' + minutes + ' minutes').first()
      : await db.prepare(
          `SELECT COALESCE(SUM(cost_paise),0) AS paise, COUNT(*) AS calls
             FROM ai_spend
            WHERE created_at >= datetime('now', ?)`
        ).bind('-' + minutes + ' minutes').first();
    return { paise: row ? row.paise : 0, calls: row ? row.calls : 0 };
  },

  /* ------------------------------------------------------------ breaker */
  async breaker(db, scope) {
    const row = await db.prepare('SELECT * FROM ai_breaker WHERE scope = ?')
      .bind(scope).first();
    if (!row) return { scope, state: 'closed' };

    /* An open breaker heals itself into half_open once its timer passes.
       Computed on read rather than by a scheduled job: there is no cron in
       this worker, and a breaker that needs one to recover would stay open
       until somebody noticed. */
    if (row.state === 'open' && row.resets_at && row.resets_at <= nowIso()) {
      return { ...row, state: 'half_open' };
    }
    return row;
  },

  async trip(db, scope, { reason, windowPaise }) {
    const resetsAt = new Date(Date.now() + OPEN_MINUTES * 60000).toISOString();
    await db.prepare(
      `INSERT INTO ai_breaker (scope, state, reason, tripped_at, resets_at, window_paise)
       VALUES (?, 'open', ?, ?, ?, ?)
       ON CONFLICT(scope) DO UPDATE SET
         state = 'open', reason = excluded.reason, tripped_at = excluded.tripped_at,
         resets_at = excluded.resets_at, window_paise = excluded.window_paise,
         cleared_at = NULL, cleared_by = NULL`
    ).bind(scope, reason, nowIso(), resetsAt, windowPaise).run();
    return { scope, state: 'open', reason, resetsAt };
  },

  async close(db, scope, clearedBy) {
    await db.prepare(
      `UPDATE ai_breaker
          SET state = 'closed', cleared_at = ?, cleared_by = ?, resets_at = NULL
        WHERE scope = ?`
    ).bind(nowIso(), clearedBy || 'automatic', scope).run();
  },

  /* Marks that an admin has been told, so they are told once rather than on
     every blocked call. An alert that repeats forty times an hour is an
     alert people filter out. */
  async markNotified(db, scope) {
    await db.prepare('UPDATE ai_breaker SET notified_at = ? WHERE scope = ?')
      .bind(nowIso(), scope).run();
  },

  /* -------------------------------------------------------------- alert --
     Raised into the support queue the admin console already shows, rather
     than into a new place nobody has a habit of looking. An alert that needs
     a new screen to be noticed is an alert that is noticed late.

     Marked urgent, and written so it can be acted on without opening the
     code: what tripped, what was spent, and what to check first. */
  async alert(db, doctorId, { scope, reason }) {
    await db.prepare(
      `INSERT INTO support_requests
         (id, doctor_id, created_by, category, subject, message, priority, status)
       VALUES (?,?,?,?,?,?,'urgent','open')`
    ).bind(
      newId('sup'), doctorId, 'system:aiops', 'billing',
      'AI reading stopped automatically — ' + scope,
      reason + '\n\n' +
      'Automatic document reading is paused for this scope. Documents are being ' +
      'queued, not lost, and will be read once it is cleared.\n\n' +
      'Check first: is one clinic uploading in bulk, is one document unusually ' +
      'large, or is the same document being retried? It reopens by itself in ' +
      OPEN_MINUTES + ' minutes to test whether it is safe.'
    ).run();
  },

  /* --------------------------------------------------------------- ask --
     Called BEFORE spending anything. Returns { allowed } or the reason it
     said no, plus whether this is the moment an admin should be told.

     estimatedPaise is what this one call could cost at worst. Checking it
     first is what stops a single 300-page PDF, which no rolling window can
     catch because the damage is done inside one call. */
  async check(db, doctorId, estimatedPaise = 0) {
    const limits = await this.limits(db);
    const scope = 'doctor:' + doctorId;

    if (estimatedPaise > limits.call_ceiling) {
      return {
        allowed: false, kind: 'too_expensive',
        reason: 'One document would cost ₹' + (estimatedPaise / 100).toFixed(2) +
                ', over the ₹' + (limits.call_ceiling / 100).toFixed(2) + ' ceiling.',
        message: 'This document is unusually large, so it has not been read automatically. ' +
                 'Split it into single reports and upload them separately.',
        park: false
      };
    }

    for (const [key, minutes, who] of [
      ['platform_hour', 60, null], ['platform_day', 1440, null],
      ['clinic_hour', 60, doctorId], ['clinic_day', 1440, doctorId]
    ]) {
      const openScope = who ? scope : 'platform';
      const state = await this.breaker(db, openScope);
      if (state.state === 'open') {
        return {
          allowed: false, kind: 'stopped', scope: openScope,
          reason: state.reason, resetsAt: state.resets_at,
          message: waitingMessage(), park: true, alreadyNotified: !!state.notified_at
        };
      }

      const spent = await this.spentSince(db, who, minutes);
      if (spent.paise + estimatedPaise > limits[key]) {
        const reason = (who ? 'This clinic' : 'The platform') + ' has spent ₹' +
          (spent.paise / 100).toFixed(2) + ' on AI in the last ' +
          (minutes === 60 ? 'hour' : 'day') + ' across ' + spent.calls +
          ' calls, over the ₹' + (limits[key] / 100).toFixed(2) + ' limit.';
        await this.trip(db, openScope, { reason, windowPaise: spent.paise });
        return {
          allowed: false, kind: 'stopped', scope: openScope, reason,
          message: waitingMessage(), park: true, justTripped: true
        };
      }
    }

    return { allowed: true };
  },

  /* -------------------------------------------------------------- record --
     Every call, successful or not. A ledger that only records successes
     under-reports precisely when things are going wrong, which is the one
     time it is being read. */
  async record(db, doctorId, { kind, model, usage = {}, costPaise = 0,
                               outcome = 'ok', detail = null, durationMs = null,
                               batched = false }) {
    await db.prepare(
      `INSERT INTO ai_spend (id, doctor_id, kind, model, input_tokens, cached_tokens,
        output_tokens, cost_paise, outcome, detail, duration_ms, batched)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      newId('spend'), doctorId, kind, model || null,
      usage.inputTokens || 0, usage.cachedTokens || 0, usage.outputTokens || 0,
      costPaise || 0, outcome, detail ? String(detail).slice(0, 300) : null, durationMs,
      batched ? 1 : 0
    ).run();
  },

  /* --------------------------------------------------------------- park --
     The document is kept and retried later. This is the half that makes the
     guard acceptable to a clinic: being told "not now" is survivable, being
     told "your report is gone" is not. */
  async park(db, doctorId, { patientId, fileId, kind = 'preflight' }) {
    const id = newId('q');
    await db.prepare(
      `INSERT INTO ai_queue (id, doctor_id, patient_id, file_id, kind)
       VALUES (?,?,?,?,?)`
    ).bind(id, doctorId, patientId || null, fileId || null, kind).run();
    return id;
  },

  /* Records that a document has been sent to the overnight queue. Same table
     as a document parked by the spend guard, because from the clinic's side
     they are the same thing: accepted, not yet read, not lost. */
  async queueBatch(db, doctorId, { patientId, fileId, preflightId, batchId,
                                   providerStatus, providerInputFileId,
                                   urgency = 'normal' }) {
    const id = newId('q');
    await db.prepare(
      `INSERT INTO ai_queue (id, doctor_id, patient_id, file_id, kind, status,
        batch_id, provider_status, preflight_id, urgency,
        provider_input_file_id, provider_cleanup_status)
       VALUES (?,?,?,?,'extraction','waiting',?,?,?,?,?,'pending')`
    ).bind(id, doctorId, patientId || null, fileId || null,
           batchId, providerStatus || null, preflightId || null, urgency,
           providerInputFileId || null).run();
    return id;
  },

  /* Everything this clinic is still waiting on. The screen polls this rather
     than a background job doing it, because there is no cron in this worker
     and the person who cares is the one looking at the screen. */
  async pendingBatches(db, doctorId) {
    const { results } = await db.prepare(
      `SELECT * FROM ai_queue
        WHERE doctor_id = ? AND status = 'waiting' AND batch_id IS NOT NULL
        ORDER BY created_at`
    ).bind(doctorId).all();
    return results || [];
  },

  async noteBatchStatus(db, doctorId, id, provider) {
    const state = typeof provider === 'string' ? { status: provider } : (provider || {});
    await db.prepare(
      `UPDATE ai_queue SET provider_status = ?,
          provider_input_file_id = COALESCE(?, provider_input_file_id),
          provider_output_file_id = COALESCE(?, provider_output_file_id),
          provider_error_file_id = COALESCE(?, provider_error_file_id)
        WHERE doctor_id = ? AND id = ?`
    ).bind(state.status || null, state.inputFileId || null,
           state.outputFileId || null, state.errorFileId || null,
           doctorId, id).run();
  },

  async providerCleanupPending(db, doctorId) {
    const { results } = await db.prepare(
      `SELECT id, provider_input_file_id, provider_output_file_id,
              provider_error_file_id
         FROM ai_queue
        WHERE doctor_id = ?
          AND provider_cleanup_status IN ('pending','failed')
          AND provider_status IN ('completed','failed','expired','cancelled')
        ORDER BY created_at`
    ).bind(doctorId).all();
    return results || [];
  },

  /* Cross-clinic only for provider object identifiers and machine cleanup
     state. No patient, report, diagnosis or extracted value is selected. */
  async providerCleanupPendingAll(db, limit = 100) {
    const { results } = await db.prepare(
      `SELECT id, doctor_id, provider_input_file_id, provider_output_file_id,
              provider_error_file_id
         FROM ai_queue
        WHERE provider_cleanup_status IN ('pending','failed')
          AND provider_status IN ('completed','failed','expired','cancelled')
        ORDER BY provider_cleanup_last_attempt_at, created_at
        LIMIT ?`
    ).bind(Math.max(1, Math.min(500, Number(limit) || 100))).all();
    return results || [];
  },

  async noteProviderCleanup(db, doctorId, id, result) {
    await db.prepare(
      `UPDATE ai_queue
          SET provider_cleanup_status = ?, provider_cleanup_error = ?,
              provider_cleanup_attempts = provider_cleanup_attempts + 1,
              provider_cleanup_last_attempt_at = ?, provider_files_deleted_at = ?
        WHERE doctor_id = ? AND id = ?`
    ).bind(result.complete ? 'complete' : 'failed',
           result.complete ? null : String((result.failures || []).join('; ')).slice(0, 500),
           nowIso(), result.complete ? nowIso() : null, doctorId, id).run();
    return await db.prepare(
      `SELECT provider_cleanup_status AS status,
              provider_cleanup_attempts AS attempts,
              provider_cleanup_error AS error
         FROM ai_queue WHERE doctor_id = ? AND id = ?`
    ).bind(doctorId, id).first();
  },

  async alertProviderCleanup(db, doctorId, queueId, detail) {
    await db.prepare(
      `INSERT INTO support_requests
         (id, doctor_id, created_by, category, subject, message, priority, status)
       VALUES (?,?,?,?,?,?,'urgent','open')`
    ).bind(
      newId('sup'), doctorId, 'system:ai-cleanup', 'privacy',
      'AI provider file deletion needs attention',
      'TCOS could not confirm deletion of every provider file after three attempts. ' +
      'Queue item: ' + queueId + '. Last error: ' + String(detail || 'unknown').slice(0, 300) +
      '. The clinical draft is safe; investigate provider access and retry cleanup.'
    ).run();
  },

  async finishQueued(db, doctorId, id, { draftId }) {
    await db.prepare(
      `UPDATE ai_queue SET status = 'done', draft_id = ?, processed_at = ?,
              attempts = attempts + 1
        WHERE doctor_id = ? AND id = ?`
    ).bind(draftId, nowIso(), doctorId, id).run();
  },

  async waiting(db, doctorId) {
    const { results } = await db.prepare(
      `SELECT * FROM ai_queue
        WHERE doctor_id = ? AND status = 'waiting' ORDER BY created_at`
    ).bind(doctorId).all();
    return results || [];
  },

  async settleQueued(db, doctorId, id, { status, error = null }) {
    await db.prepare(
      `UPDATE ai_queue
          SET status = ?, last_error = ?, attempts = attempts + 1, processed_at = ?
        WHERE doctor_id = ? AND id = ?`
    ).bind(status, error, nowIso(), doctorId, id).run();
  },

  /* ------------------------------------------------------------- report --
     What the admin console shows. Deliberately answers the questions in the
     order somebody panicking would ask them: is anything stopped, what is
     being spent, and who is spending it. */
  async report(db) {
    const [hour, day] = await Promise.all([
      this.spentSince(db, null, 60), this.spentSince(db, null, 1440)
    ]);
    const { results: open } = await db.prepare(
      `SELECT * FROM ai_breaker WHERE state <> 'closed' ORDER BY tripped_at DESC`
    ).all();
    const { results: top } = await db.prepare(
      `SELECT s.doctor_id, d.clinic_name,
              SUM(s.cost_paise) AS paise, COUNT(*) AS calls,
              SUM(CASE WHEN s.outcome <> 'ok' THEN 1 ELSE 0 END) AS failures
         FROM ai_spend s JOIN doctors d ON d.id = s.doctor_id
        WHERE s.created_at >= datetime('now','-1440 minutes')
        GROUP BY s.doctor_id ORDER BY paise DESC LIMIT 10`
    ).all();
    const queued = await db.prepare(
      `SELECT COUNT(*) AS n FROM ai_queue WHERE status = 'waiting'`).first();

    /* A rising failure rate is the earliest signal that something is wrong,
       and it arrives before the spend does - failures cost money and produce
       nothing, so they are pure loss and they precede the runaway. */
    const failures = await db.prepare(
      `SELECT COUNT(*) AS n FROM ai_spend
        WHERE outcome <> 'ok' AND created_at >= datetime('now','-60 minutes')`).first();

    return {
      lastHour: hour, lastDay: day,
      openBreakers: open || [],
      byClinic: top || [],
      queued: queued ? queued.n : 0,
      failuresLastHour: failures ? failures.n : 0,
      limits: await this.limits(db)
    };
  }
};

/* One message, used everywhere, so a doctor never gets two different
   explanations for the same pause. It says what happened, that her document
   is safe, and what happens next - and it does not blame her, because it is
   not her fault. */
function waitingMessage() {
  return 'Automatic reading is paused while we check something on our side. ' +
         'Your document is saved and will be read as soon as this is cleared — ' +
         'you do not need to upload it again. Enter the values by hand if it is urgent.';
}

/* Thrown when the guard says no. 429 rather than 500: this is a deliberate,
   temporary refusal, and it should read that way in any log and to any
   client that retries. */
export function stopped(message) {
  return new ApiError(429, 'ai_paused', message);
}

/* =========================================================================
   Sending a message to a patient, with everything that has to be true first.

   worker/whatsapp.js knows how to talk to Meta. This knows what a clinic is
   allowed to send, in what order the checks happen, and what to do when one
   of them says no.

   THE ORDER IS THE DESIGN
   -----------------------
     1. consent      refuse before anything else. Never spend a rupee, or a
                     row, on somebody who has not agreed.
     2. wording      fill the template locally and refuse if a variable is
                     missing, rather than letting Meta send a message with a
                     hole in it.
     3. claim        write the row and let the UNIQUE key decide whether this
                     send is a duplicate.
     4. quota        the clinic's plan allowance.
     5. deliver      the network call, last, because it is the only step
                     that cannot be taken back.

   A failure at step 5 deletes the claim so the next run tries again. A
   failure at step 4 keeps it, because being over your allowance is not
   something a retry five minutes later will fix.
   ========================================================================= */

import { patients, messages, usage } from './repo.js';
import { requireQuota } from './quota.js';
import * as wa from './whatsapp.js';
import { sms } from '@tharigopula/core/comms';
import { ApiError } from '@tharigopula/core/lib';

/* Roughly what one WhatsApp utility conversation costs us, in paise, so the
   clinic's usage screen shows something honest rather than nothing. Meta
   bills per conversation in India and the rate moves; this is only ever a
   display figure and no decision is made from it. */
const APPROX_PAISE = { whatsapp: 15, sms: 15 };

/* Which channel actually carries this message.

   WhatsApp first when it can: same price as SMS, delivery receipts, and the
   patient can reply. SMS second, because it reaches the person with no
   WhatsApp - which is the only reason to keep it and a good one.

   An explicit choice is honoured even if that channel is not configured, so
   the caller is told "SMS is not switched on" rather than silently getting
   WhatsApp instead. Silently substituting a channel is how a clinic ends up
   messaging somebody in a way they did not agree to. */
export function chooseChannel(env, templateKey, wanted = 'auto') {
  if (wanted !== 'auto') return wanted;
  if (wa.configured(env)) return 'whatsapp';
  if (sms.canSend(env, templateKey)) return 'sms';
  return 'whatsapp';
}

/* One message, all the checks. Returns what happened rather than throwing
   for the ordinary "no" answers, because the reminder job needs to carry on
   through a patient who has not opted in and the doctor needs to be told
   which ones were skipped and why. */
export async function sendToPatient(env, doctor, {
  patientId, template, values, aboutType, aboutId, dedupeDay, patient,
  channel: wanted = 'auto'
}) {
  const person = patient || await patients.byId(env.DB, patientId);
  const channel = chooseChannel(env, template, wanted);

  const refusal = wa.refusalFor(person);
  if (refusal) return { sent: false, skipped: true, reason: refusal, patientId };

  let filled;
  try {
    filled = wa.fill(template, values);
  } catch (error) {
    return { sent: false, skipped: true, reason: error.message, patientId };
  }

  const key = wa.dedupeKey(template, aboutType, aboutId, dedupeDay);
  const messageId = await messages.claim(env.DB, doctor.id, {
    patientId: person.id,
    template,
    toMobile: person.mobile,
    aboutType,
    aboutId,
    bodyPreview: filled.preview,
    dedupeKey: key,
    channel
  });

  /* Somebody already sent this. Not an error - the desired state is exactly
     what it already is. */
  if (!messageId) {
    return { sent: false, duplicate: true, reason: 'Already sent.', patientId: person.id };
  }

  try {
    await requireQuota(env.DB, doctor, 'messages', 1);
  } catch (error) {
    /* Over the allowance. Keep the row as a failure rather than deleting
       it: retrying tonight will fail the same way, and the doctor needs to
       see that her plan stopped this and not think it vanished. */
    await messages.markFailed(env.DB, messageId, error.message, { retry: false });
    return { sent: false, skipped: true, reason: error.message, patientId: person.id };
  }

  try {
    const providerId = channel === 'sms'
      /* MSG91 substitutes by variable NAME; WhatsApp by position. The same
         values object serves both because it is keyed by name either way -
         whatsapp.js is what turns it into an ordered list. */
      ? await sms.deliver(env, { to: person.mobile, templateKey: template, variables: values })
      : await wa.deliver(env, { to: person.mobile, template: filled });
    await messages.markSent(env.DB, messageId, providerId);
  } catch (error) {
    /* The provider said no, or the network did. Release the claim so this
       is tried again rather than quietly retired. */
    await messages.markFailed(env.DB, messageId, error.message, { retry: true });
    return { sent: false, failed: true, reason: error.message, patientId: person.id };
  }

  await usage.record(env.DB, doctor.id, {
    /* Both count against the same plan allowance, because to a doctor they
       are the same thing: one message to one patient. quota.js already sums
       whatsapp_message and sms_message together. */
    eventType: channel === 'sms' ? 'sms_message' : 'whatsapp_message',
    quantity: 1,
    unit: 'message',
    provider: channel === 'sms' ? 'msg91' : 'meta',
    estimatedCost: APPROX_PAISE[channel] || 15,
    idempotencyKey: channel + ':' + key
  });

  return { sent: true, channel, patientId: person.id, preview: filled.preview };
}

/* ------------------------------------------------- the free way to send --- */

/* Tomorrow's list, each with a wa.me link the front desk can tap.

   Costs nothing and needs nothing from Meta, which is the point: a clinic
   going live before template approval still gets reminders out. The wording
   is identical to the automatic message, so when approval lands the patient
   sees no change - the message just stops needing a thumb. */
export async function reminderLinks(env, doctor, day) {
  const rows = await messages.remindableByHand(env.DB, doctor.id, day);

  return {
    day,
    automatic: wa.configured(env),
    patients: rows.map(row => {
      const text = wa.TEMPLATES.appointment_reminder.preview({
        patientName: row.full_name,
        clinicName: doctor.clinic_name || 'the clinic',
        doctorName: doctor.full_name,
        when: wa.whenText(row.scheduled_on, row.scheduled_at)
      });
      return {
        appointmentId: row.id,
        patientId: row.patient_id,
        name: row.full_name,
        at: row.scheduled_at,
        /* So the desk can see who would also get it automatically, and stop
           sending those by hand once the API is live. */
        optedIn: !!row.whatsapp_opt_in,
        alreadyMessaged: row.already_messaged > 0,
        text,
        link: wa.clickToChat(row.mobile, text)
      };
    })
  };
}

/* Tomorrow's appointments, for one clinic.

   Tomorrow rather than today on purpose: a reminder that arrives on the
   morning of the appointment is too late to be useful to somebody who has
   to arrange to be somewhere. */
export async function sendDayReminders(env, doctor, day) {
  if (!wa.configured(env)) {
    throw new ApiError(503, 'no_whatsapp_provider',
      'WhatsApp is not switched on yet.');
  }

  const due = await messages.dueReminders(env.DB, doctor.id, day);
  const results = [];

  for (const appointment of due) {
    results.push(await sendToPatient(env, doctor, {
      patient: {
        id: appointment.patient_id,
        full_name: appointment.full_name,
        mobile: appointment.mobile,
        whatsapp_opt_in: appointment.whatsapp_opt_in,
        whatsapp_opted_out_at: appointment.whatsapp_opted_out_at
      },
      template: 'appointment_reminder',
      values: {
        patientName: appointment.full_name,
        clinicName: doctor.clinic_name || 'the clinic',
        doctorName: doctor.full_name,
        when: wa.whenText(appointment.scheduled_on, appointment.scheduled_at)
      },
      aboutType: 'appointment',
      aboutId: appointment.id,
      /* The day is part of the key so a rescheduled appointment earns a
         second reminder, while the same appointment on the same day cannot
         produce two however often this runs. */
      dedupeDay: appointment.scheduled_on
    }));
  }

  return {
    day,
    considered: due.length,
    sent: results.filter(r => r.sent).length,
    skipped: results.filter(r => r.skipped).length,
    duplicates: results.filter(r => r.duplicate).length,
    failed: results.filter(r => r.failed).length,
    results
  };
}

/* The nightly run, across every clinic.

   One clinic's bad number, expired token or exhausted allowance must not
   stop the next clinic's reminders, so each is wrapped. The failure is
   logged and the loop carries on - the alternative is that a single broken
   tenant silently cancels reminders for everybody. */
export async function runNightlyReminders(env) {
  if (!wa.configured(env)) return { skipped: 'WhatsApp is not configured.' };

  const day = indiaDayAfter();
  const { results } = await env.DB.prepare(
    `SELECT id, full_name, clinic_name, plan, line, feature_overrides, trial_ends_on
       FROM doctors WHERE status <> 'suspended'`
  ).all();

  const summary = { day, clinics: 0, sent: 0, failed: 0 };
  for (const doctor of (results || [])) {
    try {
      const result = await sendDayReminders(env, doctor, day);
      summary.clinics++;
      summary.sent += result.sent;
      summary.failed += result.failed;
    } catch (error) {
      summary.failed++;
      console.error('reminders failed for ' + doctor.id, error && error.message);
    }
  }
  return summary;
}

/* Tomorrow, in the clinic's day, as YYYY-MM-DD.

   Fixed to India rather than read from the server: Workers run in UTC, and
   between 18:30 and midnight IST a UTC "tomorrow" is a different day from
   the clinic's. Reminders sent for the wrong day are worse than none. */
export function indiaDayAfter(now = new Date()) {
  const ist = new Date(now.getTime() + (5.5 * 3600 * 1000) + (24 * 3600 * 1000));
  return ist.toISOString().slice(0, 10);
}

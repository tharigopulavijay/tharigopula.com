/* =========================================================================
   What TCOS says on WhatsApp.

   The SENDING moved to @tharigopula/core/comms on 18 Sep 2026 - the Meta
   Cloud API call, the HMAC webhook verification, the timing-safe compare,
   opt-out handling and dedupe keys are the same job in a clinic, a school
   or a factory.

   These are not. A template naming patientName, clinicName and doctorName
   is TCOS speaking, and refusalFor reads consent off a patient row. A school
   reminding a parent about a fee shares the transport and none of the words.
   ========================================================================= */

import { badRequest } from '@tharigopula/core/lib';

export const TEMPLATES = {
  /* "Namaste {{1}}, this is a reminder of your appointment at {{2}} with
      {{3}} on {{4}}. Reply STOP to stop these messages." */
  appointment_reminder: {
    name: 'appointment_reminder',
    language: 'en',
    variables: ['patientName', 'clinicName', 'doctorName', 'when'],
    preview: v => 'Namaste ' + v.patientName + ', this is a reminder of your ' +
      'appointment at ' + v.clinicName + ' with ' + v.doctorName + ' on ' + v.when + '.'
  },

  /* "Namaste {{1}}, your {{2}} from {{3}} is ready. You can read it here:
      {{4}}. Reply STOP to stop these messages." */
  record_ready: {
    name: 'record_ready',
    language: 'en',
    variables: ['patientName', 'what', 'clinicName', 'link'],
    preview: v => 'Namaste ' + v.patientName + ', your ' + v.what + ' from ' +
      v.clinicName + ' is ready. You can read it here: ' + v.link
  }
};


export function refusalFor(patient) {
  if (!patient) return 'That patient no longer exists.';
  if (patient.whatsapp_opted_out_at) {
    return patient.full_name + ' has asked to stop receiving WhatsApp messages.';
  }
  if (!patient.whatsapp_opt_in) {
    return patient.full_name + ' has not agreed to WhatsApp messages yet. ' +
      'Ask at the next visit and tick the box on their record.';
  }
  if (!patient.mobile) return 'No mobile number on that record.';
  return null;
}


export function fill(templateKey, values) {
  const template = TEMPLATES[templateKey];
  if (!template) throw badRequest('There is no message template called ' + templateKey + '.');

  const missing = template.variables.filter(
    name => values[name] === undefined || values[name] === null || values[name] === '');
  if (missing.length) {
    /* Meta would accept this and send a message with a blank in it, which
       reaches the patient looking broken. Refuse locally instead. */
    throw badRequest('The ' + templateKey + ' message is missing: ' + missing.join(', ') + '.');
  }

  return {
    name: template.name,
    language: template.language,
    /* Positional, in the declared order. */
    parameters: template.variables.map(name => ({ type: 'text', text: String(values[name]) })),
    preview: template.preview(values)
  };
}

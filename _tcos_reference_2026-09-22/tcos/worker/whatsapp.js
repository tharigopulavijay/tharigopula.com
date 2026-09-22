/* =========================================================================
   WhatsApp, as TCOS uses it.

   This file is now a composition, not an implementation. Split on
   18 Sep 2026:

     the SENDING   @tharigopula/core/comms - the Meta Cloud API call, HMAC
                   webhook verification, timing-safe comparison, fail-closed
                   semantics, opt-out handling, dedupe keys. Identical work
                   in a clinic, a school or a factory, and expensive enough
                   to get subtly wrong that nobody should write it twice.

     the WORDS     worker/whatsapp-templates.js - appointment_reminder and
                   record_ready, whose variables are patientName, clinicName
                   and doctorName, plus refusalFor(), which reads consent off
                   a patient row. A school reminding a parent about a fee
                   shares the transport and none of this.

   Everything that imported `* as wa from './whatsapp.js'` still works
   unchanged, which is the point: where a function lives is our business,
   not the caller's.
   ========================================================================= */

export * from '@tharigopula/core/comms/whatsapp';
export { TEMPLATES, fill, refusalFor } from './whatsapp-templates.js';

/* =========================================================================
   What TCOS says in an email.

   The SENDING moved to @tharigopula/core/comms on 17 Sep 2026, because
   talking to Resend is the same job in a clinic, a school or a factory. What
   gets said is not: a school welcoming a parent and a clinic welcoming a
   doctor have nothing in common but the call to the provider.

   So the transport is shared and the words stay here, where the product that
   means them can change them without touching anything else.
   ========================================================================= */

import { email } from '@tharigopula/core/comms';

/* The one email a doctor gets before she has an account to read it from.
 *
   The temporary password travels by email, which is worth saying out loud:
   it is single-use and dies the moment she chooses her own, so the window is
   one sign-in wide. The message says so, because a doctor who reads
   "temporary password" in her inbox should be told why that is not careless.
 */
export async function sendDoctorWelcome(env, { to, fullName, clinicName, mobile, temporaryPassword, signInUrl }) {
  const name = String(fullName || '').trim() || 'Doctor';
  const text = [
    'Namaste ' + name + ',',
    '',
    'Your TCOS account for ' + clinicName + ' is ready.',
    '',
    'Sign in here:  ' + signInUrl,
    '  Mobile number:       ' + mobile,
    '  Temporary password:  ' + temporaryPassword,
    '',
    'You will be asked to choose your own password the first time you sign',
    'in. The temporary one above stops working at that moment, so it does',
    'not matter that it travelled by email.',
    '',
    'If you did not apply for this, please tell us and we will remove the',
    'account: hello@tharigopula.com',
    '',
    'Tharigopula Technologies'
  ].join('\n');

  return email.deliver(env, {
    to,
    subject: 'Your TCOS sign-in details for ' + clinicName,
    text
  });
}

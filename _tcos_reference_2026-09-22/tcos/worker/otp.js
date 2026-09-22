/* =========================================================================
   OTP - one code, two delivery channels.

   The channel is chosen by what the person typed. An email address gets an
   email; a mobile number gets an SMS. Nothing else in the codebase needs to
   know which was used.

   We generate, hash, store, expire and verify the code ourselves (see the
   otp_codes table). A provider only carries the message. That keeps the
   provider swappable and means no identity vendor holds our doctor accounts.
   ========================================================================= */

import { newOtpCode, sha256, isEmail, isMobile, normaliseMobile,
         plusMinutes, isPast, badRequest, tooMany, ApiError } from '@tharigopula/core/lib';
import { otps } from './repo.js';
import { sms } from '@tharigopula/core/comms';
import { email } from '@tharigopula/core/comms';

const MAX_ATTEMPTS = 5;
const MAX_PER_HOUR = 5;

export function classifyIdentifier(raw) {
  const value = String(raw || '').trim();
  if (isEmail(value)) return { channel: 'email', identifier: value.toLowerCase() };
  if (isMobile(value)) return { channel: 'sms', identifier: normaliseMobile(value) };
  throw badRequest('Enter a mobile number or an email address.');
}

/* ---------------- delivery ----------------
   Each sender returns nothing on success and throws on failure. Adding a
   provider means adding a function here and nothing else. */

async function sendEmail(env, to, code, purpose) {
  /* The words have to match what the person is actually doing. A code that
     says "continue signing in" while somebody is resetting a password is
     the small kind of wrong that makes people distrust the big things. */
  const WORDING = {
    patient_consent: {
      subject: 'Approve sharing your health records',
      line: 'A doctor has asked to see your health records. Share this code only if you are with them right now.'
    },
    doctor_reset: {
      subject: 'Reset your TCOS password',
      line: 'Use this code to set a new password for your TCOS account.'
    },
    platform_reset: {
      subject: 'Reset your TCOS console password',
      line: 'Use this code to set a new password for your Tharigopula platform console account.'
    }
  };
  const words = WORDING[purpose] || {
    subject: 'Your TCOS verification code',
    line: 'Use this code to continue signing in to TCOS.'
  };
  const subject = words.subject;
  const line = words.line;

  await email.deliver(env, {
    to,
    subject,
    text: line + '\n\nCode: ' + code + '\n\nIt expires in ' +
          (env.OTP_TTL_MINUTES || 5) + ' minutes. If you did not expect this, ignore it.'
  });
}

/* A code to a mobile number always goes by SMS.

   Not WhatsApp, and this is a deliberate decision rather than an oversight.
   Every Indian mobile receives SMS; WhatsApp needs a smartphone, an app and
   data that day. For most features "most patients" is fine. For the code
   that is the only way back into an account it is not - the person who
   cannot receive it is exactly the person locked out, and they have no
   second route. So OTP uses the channel everyone has, and pays the DLT
   registration cost that comes with it.

   The MSG91 particulars live in sms.js so there is one implementation of
   them, not two that drift apart. */
async function sendSms(env, to, code, purpose) {
  const text = purpose === 'patient_consent'
    ? code + ' is your code to share your health records with the doctor you are with. Do not share otherwise.'
    : code + ' is your TCOS verification code. Do not share it with anyone.';

  await sms.deliver(env, {
    to,
    templateKey: 'otp',
    /* MSG91 substitutes by variable name. Which names exist is decided by
       the DLT template, so both are sent: a template written as ##OTP##
       uses the first, one written as ##MESSAGE## uses the second, and an
       unused variable is ignored rather than being an error. */
    variables: { OTP: code, MESSAGE: text }
  });
}

/* ---------------- issue ---------------- */

/* WHERE THE CODE IS SENT IS NOT WHAT THE CODE IS FILED UNDER.
 *
   Vijay: "if the doctor is using his mobile number, anyhow we are having
   the email id right - why don't you push the otp there. we have stopped
   sms because it actually costs us. lets make use of what we have."
 *
   So a doctor who types her mobile gets the code in her inbox. The row
   still has to be keyed to what she TYPED, because that is what she will
   type again on the next screen and verifyOtp looks it up by exactly that
   string. Filing it under the email instead would send a code that can
   never be redeemed - a lockout that looks like a delivery failure.
 *
   Hence two values, kept apart on purpose: `identifier` is the key, and
   `deliverTo` is the address. The hourly allowance counts the key, so
   routing to email cannot be used to get five extra codes. */
export async function issueOtp(env, db, { purpose, rawIdentifier, context, deliverTo }) {
  const { channel, identifier } = classifyIdentifier(rawIdentifier);

  const sendVia = deliverTo ? classifyIdentifier(deliverTo) : { channel, identifier };

  const anHourAgo = new Date(Date.now() - 3600000).toISOString();
  if (await otps.countRecent(db, identifier, anHourAgo) >= MAX_PER_HOUR) {
    throw tooMany('Too many codes requested. Try again in an hour.');
  }

  const code = newOtpCode();
  const ttl = Number(env.OTP_TTL_MINUTES || 5);
  const otpId = await otps.create(db, {
    purpose,
    identifier,
    codeHash: await sha256(code),
    context,
    expiresAt: plusMinutes(ttl)
  });

  /* The row is written before the send, because a code must never reach
     somebody without a record of it existing. But an undelivered code must
     not be charged to the allowance: countRecent() counts rows, so five
     failed sends used to leave a doctor locked out for an hour having
     received nothing.
   *
     That is not a hypothetical while email is the ONLY recovery channel -
     SMS is waiting on DLT approval - so a few minutes of provider trouble
     was enough to lock a doctor out of her own clinic for an hour, with
     nothing in her inbox to explain it.
   *
     So a refused send unwinds the row and rethrows. The doctor sees the
     real error and may try again immediately. */
  try {
    /* Email to an email address, SMS to a number - of the DELIVERY address,
       which is usually the typed one and sometimes the account's email.
       See the note above sendSms for why a code never goes by WhatsApp. */
    if (sendVia.channel === 'email') await sendEmail(env, sendVia.identifier, code, purpose);
    else await sendSms(env, sendVia.identifier, code, purpose);
  } catch (error) {
    /* Best effort. If the unwind itself fails the original error is still
       the one worth reporting - the doctor needs to know the code is not
       coming, not that our cleanup had a bad day. */
    try { await otps.discard(db, otpId); } catch (_) { /* nothing useful to do */ }
    throw error;
  }

  /* `channel` is where it WENT, because that is what the screen has to tell
     her; `identifier` is still what she typed, because that is what she
     types next. */
  return {
    channel: sendVia.channel,
    identifier,
    sentTo: sendVia.identifier,
    expiresInMinutes: ttl
  };
}

/* ---------------- verify ----------------
   Single use, attempt-capped, expiry-checked. Returns the stored context so
   the caller knows what the code was for. */

export async function verifyOtp(db, { purpose, rawIdentifier, code }) {
  const { identifier } = classifyIdentifier(rawIdentifier);
  const record = await otps.latest(db, purpose, identifier);

  if (!record) throw badRequest('Request a new code first.');
  if (isPast(record.expires_at)) throw badRequest('That code has expired. Request a new one.');
  if (record.attempts >= MAX_ATTEMPTS) {
    throw tooMany('Too many incorrect attempts. Request a new code.');
  }

  const attemptHash = await sha256(String(code || '').trim());
  if (attemptHash !== record.code_hash) {
    await otps.bumpAttempts(db, record.id);
    throw badRequest('That code is not correct.');
  }

  await otps.consume(db, record.id);
  return {
    identifier,
    context: record.context ? JSON.parse(record.context) : null
  };
}

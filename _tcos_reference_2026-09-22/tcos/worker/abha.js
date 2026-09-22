/* =========================================================================
   ABHA, HPR, HFR - the national identifiers, captured and checked locally.

   Migration 028 added the columns. This is the half that lets a front desk
   actually put something in them, today, by hand, before any gateway
   integration exists. The day certification lands the data is already here.

   ON NOT CHECKING THE CHECKSUM
   ----------------------------
   A 14-digit ABHA is widely believed to carry a Verhoeff check digit, the
   same scheme Aadhaar uses. I could not confirm that from any authority, so
   this file does not enforce it.

   That restraint is deliberate. The cost of a wrong structural rule here is
   not an untidy database - it is a receptionist holding a real ABHA card,
   typing the real number, and being told by the software that it is
   invalid. She has no way to argue with that, so she leaves the field
   empty, and the patient's national record never gets linked. A slightly
   loose field that a human can correct beats a strict one that locks out
   the truth.

   So: structure only. Real verification happens against the ABDM gateway
   when we are certified for it, which is what abha_status is for.
   ========================================================================= */

import { badRequest } from '@tharigopula/core/lib';

/* unverified  we were told this number, nobody has checked it
   verified    the gateway confirmed it (nothing can set this yet)
   not_available  the patient does not have one and does not want one.
                  A real answer, and recordable, so the front desk is not
                  asked the same question at every single visit. */
export const ABHA_STATUSES = ['unverified', 'verified', 'not_available'];

/* ---------------------------------------------------------- the number --- */

/* Stored as 14 bare digits. Displayed grouped. Everyone writes it
   differently on paper - spaces, hyphens, neither - so accept all three
   rather than making the front desk match our formatting. */
export function normaliseAbhaNumber(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return null;

  const digits = value.replace(/[\s-]/g, '');
  if (!/^\d{14}$/.test(digits)) {
    throw badRequest('An ABHA number is 14 digits, like 91-1234-5678-9012.');
  }
  return digits;
}

/* 91-1234-5678-9012 - the grouping printed on the card, so what is on
   screen matches what the patient is holding. */
export function formatAbhaNumber(digits) {
  const value = String(digits ?? '').replace(/\D/g, '');
  if (value.length !== 14) return value || null;
  return value.slice(0, 2) + '-' + value.slice(2, 6) + '-' +
         value.slice(6, 10) + '-' + value.slice(10);
}

/* --------------------------------------------------------- the address --- */

/* A handle like vijay.t@abdm. This is what a patient actually remembers and
   types; the 14-digit number is what is on the card. Both are worth having
   and they are not interchangeable.

   Published guidance disagrees with itself on the minimum length (four
   characters in one place, eight in another), so this takes the permissive
   figure. See the note at the top of the file about who pays for a rule
   that is too tight. */
export function normaliseAbhaAddress(raw) {
  const value = String(raw ?? '').trim().toLowerCase();
  if (!value) return null;

  const at = value.indexOf('@');
  if (at === -1) {
    throw badRequest('An ABHA address looks like name@abdm.');
  }

  const handle = value.slice(0, at);
  const suffix = value.slice(at + 1);

  if (!/^[a-z0-9]([a-z0-9._]{2,30})[a-z0-9]$/.test(handle)) {
    throw badRequest(
      'The part before the @ can use letters, numbers, dots and underscores, ' +
      'and must start and end with a letter or number.');
  }
  if (!/^[a-z]{2,12}$/.test(suffix)) {
    throw badRequest('The part after the @ is usually abdm or sbx.');
  }
  return handle + '@' + suffix;
}

export function cleanAbhaStatus(raw) {
  const value = String(raw ?? '').trim() || 'unverified';
  if (!ABHA_STATUSES.includes(value)) {
    throw badRequest('That is not a status we recognise.');
  }
  return value;
}

/* One patient's ABHA fields, validated together.

   The combination matters, not just each field: saying "no ABHA" while
   handing over a number is a contradiction, and silently keeping one of the
   two would leave a record that reads as a lie later. */
export function cleanAbha(input) {
  const status = cleanAbhaStatus(input && input.status);
  const number = normaliseAbhaNumber(input && input.number);
  const address = normaliseAbhaAddress(input && input.address);

  if (status === 'not_available' && (number || address)) {
    throw badRequest(
      'This patient is marked as having no ABHA, but an ABHA was entered. ' +
      'Pick one.');
  }
  if (status === 'verified') {
    /* Nothing in TCOS can honestly claim this yet. Letting a human set it
       by hand would put an unearned tick next to a number nobody checked,
       and every later decision would trust it. */
    throw badRequest(
      'Only the ABDM gateway can mark an ABHA as verified, and we are not ' +
      'connected to it yet.');
  }
  return { number, address, status };
}

/* ------------------------------------------------- the doctor and clinic --- */

/* HPR (the practitioner) and HFR (the facility) come in more than one shape
   depending on where a doctor registered and when - a bare number, a
   handle, a handle@hpr. Since we cannot yet ask a registry which is right,
   this checks only that it is short, printable and not a sentence. */
function cleanRegistryId(raw, label) {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9._@-]{3,63}$/.test(value)) {
    throw badRequest('That does not look like a ' + label + ' id.');
  }
  return value;
}

export const cleanHprId = raw => cleanRegistryId(raw, 'HPR');
export const cleanHfrId = raw => cleanRegistryId(raw, 'HFR');

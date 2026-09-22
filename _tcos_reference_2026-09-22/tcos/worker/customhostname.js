/* =========================================================================
   A certificate for a domain we do not own.

   THE THING THAT WAS MISSING.
   Until this file existed, connecting a doctor's own domain went: she types
   drclinic.com, we store it, we show her a CNAME, she creates it, we look it
   up over DNS and say "verifying" - and a patient typing drclinic.com got
   nothing. Not a slow page, not a warning: nothing. Proved by hand on
   12 September 2026, pointing a domain we owned at our address:

     https  TLS handshake FAILS   - no certificate exists for that name
     http   409                    - Cloudflare refuses a hostname it does
                                     not know

   Both answers come from Cloudflare's edge, before any of our code runs. No
   DNS record a doctor can create changes either one. The edge has to be told
   about her hostname first, and a certificate has to be issued for it. That
   is what Cloudflare for SaaS (custom hostnames) is, and that is all this
   file does.

   INERT UNTIL CONFIGURED, like payments.
   It needs an API token, a zone, and a fallback origin. Without them every
   call here refuses rather than half-working, the Web screen says plainly
   that connecting an own domain is not available yet, and the free
   drdevi.tharigopula.com address - which needs none of this - carries on
   exactly as before. A doctor is never shown instructions that cannot
   succeed. That was the original bug, in a different costume.

   WHAT CLOUDFLARE ASKS FOR, IN HER TERMS.
   Two separate proofs, and confusing them is why this normally takes three
   support calls:

     1. Ownership   - a TXT record proving the domain is hers. Cloudflare
                      will not issue a certificate for a name anybody could
                      have typed into our form.
     2. Routing     - a CNAME sending her visitors to us.

   Both are DNS records at her registrar, both are returned by `create`, and
   the screen shows them together. The ownership TXT can be added before the
   CNAME, which matters: she can prove the domain is hers today and switch
   her live website over next week, with the certificate already waiting.
   ========================================================================= */

import { ApiError } from '@tharigopula/core/lib';

const API = 'https://api.cloudflare.com/client/v4';

/* The fallback origin is the hostname inside OUR zone that every doctor's
   domain is CNAME'd to. It is what tells the edge which account a stranger's
   hostname belongs to. Cloudflare requires it to exist and be proxied before
   any custom hostname will serve. */
/* A certificate alone is not a working clinic site. Cloudflare for SaaS
   also needs the provider-zone Worker route that brings custom-hostname
   traffic to TCOS. It is configured once and proved with a harmless test
   domain before this flag is enabled, not created per doctor at runtime. */
const edgeRoutingReady = env =>
  String(env && env.CUSTOM_HOSTNAME_EDGE_ROUTING_READY || '').toLowerCase() === 'true';

/* Can speak to Cloudflare's certificate API. This remains true while new
   claims are paused, so a doctor can always disconnect an existing hostname
   and stop future provider charges. */
export const serviceConfigured = env =>
  !!(env.CF_API_TOKEN && env.CF_ZONE_ID && env.CLINIC_FALLBACK_ORIGIN);

/* Safe to offer a NEW domain to a doctor. */
export const configured = env => serviceConfigured(env) && edgeRoutingReady(env);

export function health(env) {
  const missing = [];
  if (!env.CF_API_TOKEN) missing.push('CF_API_TOKEN');
  if (!env.CF_ZONE_ID) missing.push('CF_ZONE_ID');
  if (!env.CLINIC_FALLBACK_ORIGIN) missing.push('CLINIC_FALLBACK_ORIGIN');
  if (!edgeRoutingReady(env)) missing.push('CUSTOM_HOSTNAME_EDGE_ROUTING_READY');
  return { configured: configured(env), missing };
}

/* The refusal, as a value, because callers raise it before they get anywhere
   near an API call - and a doctor must be told "not yet" rather than handed
   DNS instructions that cannot succeed. That was the original bug. */
export const unavailable = () => new ApiError(503, 'custom_domains_unavailable',
  'Connecting your own domain is not switched on yet. Your free TCOS web ' +
  'address keeps working, and we will tell you as soon as this is ready.');

function requireConfigured(env) {
  if (!serviceConfigured(env)) throw unavailable();
}

/* Cloudflare answers 200 with success:false and an errors array as readily as
   it answers 4xx, so the status code alone is not the test. */
async function call(env, path, { method = 'GET', payload } = {}) {
  requireConfigured(env);

  let response;
  try {
    response = await fetch(API + '/zones/' + env.CF_ZONE_ID + path, {
      method,
      headers: {
        Authorization: 'Bearer ' + env.CF_API_TOKEN,
        'Content-Type': 'application/json'
      },
      body: payload === undefined ? undefined : JSON.stringify(payload)
    });
  } catch (_) {
    /* Her domain is not broken and her records are not wrong - we could not
       reach Cloudflare. Saying so stops her undoing correct DNS. */
    throw new ApiError(502, 'certificate_service_unreachable',
      'We could not reach the certificate service just now. Your settings ' +
      'are saved - try checking again in a few minutes.');
  }

  let data = null;
  try { data = await response.json(); } catch (_) { data = null; }

  if (!data || data.success !== true) {
    const first = (data && data.errors && data.errors[0]) || null;
    const detail = first ? (first.message || String(first.code)) : ('HTTP ' + response.status);
    const error = new ApiError(502, 'certificate_service_failed',
      'The certificate service refused that domain.');
    /* Kept off the doctor's screen but present in logs and in the admin
       health view: her registrar is not the place to debug our API token. */
    error.detail = detail;
    error.cfCode = first ? first.code : null;
    throw error;
  }
  return data.result;
}

/* Cloudflare's shape, flattened to the four things the rest of TCOS needs.
   Everything else in that response is either an echo of what we sent or
   detail no doctor should be shown. */
function shape(result) {
  const ssl = result.ssl || {};
  const validation = (ssl.validation_records || [])[0] || {};
  const owner = result.ownership_verification || {};

  return {
    id: result.id,
    hostname: result.hostname,
    /* 'pending', 'active', 'blocked', 'moved' - whether the EDGE accepts
       this hostname. */
    hostnameStatus: result.status || 'pending',
    /* 'initializing', 'pending_validation', 'pending_issuance',
       'pending_deployment', 'active', or a failure. Separate from the above
       because a hostname can be correctly pointed at us with the certificate
       still minutes away, and telling a doctor "not working" in that window
       is wrong. */
    sslStatus: ssl.status || 'initializing',
    /* The proof-of-ownership TXT. Cloudflare stops returning it once the
       hostname is verified, so a caller must treat absence as "no longer
       needed" rather than as an error. */
    ownership: owner.name && owner.value
      ? { type: 'TXT', name: owner.name, value: owner.value }
      : null,
    /* The certificate-validation TXT, when DV is being done over DNS. */
    validation: validation.txt_name && validation.txt_value
      ? { type: 'TXT', name: validation.txt_name, value: validation.txt_value }
      : null,
    /* Why it failed, when it did. Cloudflare's wording, because paraphrasing
       "CAA record prevents issuance" into something friendlier loses the one
       word she needs to search for. */
    error: (ssl.validation_errors || [])
      .map(e => e && e.message).filter(Boolean)[0] || null
  };
}

/* Register a doctor's domain with the edge and start a certificate.
 *
   Idempotent on purpose. A doctor who submits twice, or a retry after a
   timeout we never saw the answer to, must not create a second custom
   hostname for the same name - Cloudflare would refuse, and we would show
   her an error for having done nothing wrong. */
export async function create(env, hostname) {
  const name = String(hostname || '').trim().toLowerCase();
  if (!name) throw new ApiError(400, 'bad_request', 'No domain given.');

  const existing = await find(env, name);
  if (existing) return existing;

  const result = await call(env, '/custom_hostnames', {
    method: 'POST',
    payload: {
      hostname: name,
      ssl: {
        /* DNS validation rather than HTTP. HTTP validation needs her traffic
           to already be reaching us, which is exactly what cannot be true
           before the certificate exists on a domain that is still serving her
           old website. TXT lets her prove ownership and get the certificate
           issued FIRST, then switch the CNAME over with no gap - the
           difference between a planned cutover and a day of downtime on a
           clinic's live site. */
        method: 'txt',
        type: 'dv',
        settings: { min_tls_version: '1.2' },
        /* No wildcard. She is connecting drclinic.com and www.drclinic.com,
           not delegating every name under her domain to us. */
        wildcard: false
      }
    }
  });
  return shape(result);
}

/* Already registered? Asked before creating, and when our stored id is lost.
   Returns null rather than throwing: not finding a hostname is an ordinary
   answer here, not a failure. */
export async function find(env, hostname) {
  const results = await call(env,
    '/custom_hostnames?hostname=' + encodeURIComponent(hostname));
  const match = (results || []).find(
    r => String(r.hostname || '').toLowerCase() === String(hostname).toLowerCase());
  return match ? shape(match) : null;
}

/* Where the certificate has got to. Polled from the Web screen while she
   waits, and from the nightly sweep for the ones that finish overnight. */
export async function status(env, id) {
  if (!id) return null;
  try {
    return shape(await call(env, '/custom_hostnames/' + encodeURIComponent(id)));
  } catch (error) {
    /* 1436 / not found: the hostname was deleted at Cloudflare - by hand, or
       by a failed earlier release. Reporting "gone" lets the caller start
       again; reporting a 502 would leave her stuck forever. */
    if (error && error.cfCode === 1436) return null;
    throw error;
  }
}

/* Disconnecting. Deleting the custom hostname is not optional housekeeping:
   leave it behind and Cloudflare keeps billing for a hostname nobody uses,
   and no other account can ever connect that domain - including the doctor
   herself, if she comes back. */
export async function remove(env, id) {
  if (!id) return { removed: false };
  try {
    await call(env, '/custom_hostnames/' + encodeURIComponent(id), { method: 'DELETE' });
    return { removed: true };
  } catch (error) {
    /* Already gone is the outcome we wanted. */
    if (error && error.cfCode === 1436) return { removed: true };
    throw error;
  }
}

/* WHAT THIS IS COSTING, for the owner console.
 *
   Vijay, before switching Cloudflare for SaaS on: "i want to understand
   what is it and how much do it cost how to know i want to see."
 *
   Fair question, and the answer should not live in a Cloudflare billing
   page nobody opens. Cloudflare includes 100 custom hostnames at no charge
   and bills $0.10 a month for each one after that - and it bills a hostname
   from the moment it is created, INCLUDING one still pending validation. So
   a doctor who starts and wanders off costs money until somebody deletes
   hers, which is exactly why `remove()` runs on disconnect.
 *
   An apex domain uses TWO hostnames - drclinic.com and www.drclinic.com -
   so the free allowance is about 50 doctors, not 100. */
/* Capacity comes from Cloudflare's quota endpoint, not a price copied into
   source code. Included hostnames and usage pricing are account-specific and
   may change. We show provider-confirmed capacity; a monthly rupee cost
   belongs in the actual provider bill, never in an estimate presented as
   fact. */
export async function usage(env) {
  if (!configured(env)) return { configured: false };

  const quota = await call(env, '/custom_hostnames/quota');
  /* The list identifies hostname records that are not active yet. Quota is
     the authoritative usage count; this operational list is capped. */
  const rows = await call(env, '/custom_hostnames?per_page=1000');
  const pending = (rows || []).filter(
    r => !(r.ssl && r.ssl.status === 'active' && r.status === 'active')).length;

  return {
    configured: true,
    total: Number(quota && quota.used) || 0,
    allocated: Number(quota && quota.allocated) || 0,
    hardCap: Number(quota && quota.hard_cap) || null,
    exceeded: !!(quota && quota.exceeded),
    /* Counted separately because these are the ones worth chasing: billed,
       and serving nobody. It is an operational first-page count, not a
       billing calculation. */
    pending,
    pendingCountIsPartial: (rows || []).length >= 1000
  };
}

/* Cloudflare's vocabulary, in the words a doctor can act on. The status
   strings are not shown raw anywhere: "pending_deployment" tells her nothing
   about whether she needs to do something, which is the only question she is
   asking. */
/* ONE place, because this sentence is shown on two different requests - when
   she opens the screen, and when she presses Check now. Two copies of it
   would drift, and a doctor who sees "add the records below" on load and
   "your records are correct" a second later has no idea which is true. */
const MESSAGE = {
  pending: 'Add the records below at your domain provider. We check every few ' +
           'minutes and this page updates on its own.',
  issuing: 'Your records are correct. The security certificate is being issued - ' +
           'this usually takes a few minutes and needs nothing from you.',
  active: 'Your domain is live and secure.',
  failed: 'Something is not right with this domain yet. Check the records below ' +
          'against your domain provider, or contact us and we will look at it with you.'
};

export function explain(state, error) {
  const known = MESSAGE[state] ? state : 'pending';
  /* Cloudflare's own wording is appended rather than replaced. Paraphrasing
     "CAA record prevents issuance" into something friendlier loses the one
     term her domain provider's support will recognise. */
  return {
    state: known,
    message: known === 'failed' && error
      ? MESSAGE.failed + ' Cloudflare says: ' + error
      : MESSAGE[known]
  };
}

/* =========================================================================
   The clinic's own web address.

   Two addresses, always, and the free one never goes away:

     drdevi.tcos.in          works the moment she switches her page on
     www.drdevi-clinic.com   once her DNS points here

   Keeping the free address alive after a custom domain is connected is the
   part that matters. DNS takes hours; registrars are slow; domains lapse
   when a card expires. A clinic whose only address stops resolving has no
   website and no way to fix it that afternoon. So the free one is permanent
   and the custom one is additional.

   THE CERTIFICATE IS NOT OPTIONAL, AND IT IS NOT OURS TO SELF-SIGN.
   This file used to stop one step short: it stored the domain, printed a
   CNAME, looked the record up over DNS and reported "verifying". A doctor
   who followed those instructions perfectly still had nothing - Cloudflare
   refuses to present a certificate for, or serve, a hostname that is not
   registered to the account. `worker/customhostname.js` is the piece that
   registers it, and this file now drives that rather than guessing at DNS.

   Which means the honest statuses are Cloudflare's, not ours:

     pending   she still has records to add
     issuing   her records are right; the certificate is being made
     active    a patient typing her domain reaches her page over HTTPS
     failed    something is wrong and it is named

   Nothing here reports 'active' on the strength of a DNS lookup. That was
   the old bug: DNS resolving proves she typed a record, not that a browser
   will accept the site.
   ========================================================================= */

import { nowIso, badRequest, forbidden } from '@tharigopula/core/lib';
import * as customHostname from './customhostname.js';

/* Where a clinic's free address lives. One env var, so moving the platform
   to another domain is a config change and not a migration. */
export const freeHost = (env, slug) =>
  slug ? slug + '.' + (env.CLINIC_DOMAIN || 'tcos.in') : null;

/* Every record she must create, in the order she should create them, with
   the exact strings her registrar's panel expects.
 *
   `proofs` are what Cloudflare handed back for the one or two hostnames this
   domain needs - the ownership TXT, and the DV TXT while the certificate is
   being validated.
 *
   The routing CNAME points at the FALLBACK ORIGIN, not at the platform
   domain. This was wrong until 12 Sep 2026 and is the whole difference
   between a record that resolves and a record that works: the fallback origin
   is the proxied hostname inside our zone that tells Cloudflare's edge which
   account a stranger's domain belongs to. Pointing at tharigopula.com
   resolved beautifully and returned 409. */
export function dnsRecords(env, domain, proofs) {
  const target = env.CLINIC_FALLBACK_ORIGIN || '';
  const records = [];

  /* Proof records come FIRST on the screen, because they can be added while
     her existing website carries on serving. In this order the certificate is
     issued and waiting BEFORE she switches the CNAME, so there is no window
     where a clinic's live site is down. Doing it the other way round is the
     usual way this goes wrong. */
  for (const proof of (proofs || [])) {
    if (!proof) continue;
    if (proof.ownership) {
      records.push({ type: 'TXT', name: proof.ownership.name,
        value: proof.ownership.value, purpose: 'ownership', for: proof.hostname,
        note: 'Proves ' + proof.hostname + ' is yours.' });
    }
    if (proof.validation) {
      records.push({ type: 'TXT', name: proof.validation.name,
        value: proof.validation.value, purpose: 'certificate', for: proof.hostname,
        note: 'Gets the padlock (HTTPS) for ' + proof.hostname + '.' });
    }
  }

  if (!target) {
    /* Nothing truthful to print. Better an empty list the screen explains
       than a CNAME to a hostname that will answer 409. */
    return records;
  }

  if (isApex(domain)) {
    /* An apex (drclinic.com, no subdomain) cannot legally be a CNAME, and
       there is no IP to offer instead: Cloudflare for SaaS routes by
       hostname, not by address, so an A record pointing anywhere is a record
       that resolves to a 409.
     *
       Two honest options, both stated. Providers that support ALIAS/ANAME or
       CNAME flattening - Cloudflare's own DNS, Squarespace, Google Domains -
       take the first. The rest use www and forward the bare name to it,
       which every Indian registrar does support. */
    records.push({ type: 'CNAME', name: '@', value: target, purpose: 'routing',
      note: 'Your domain with no www. Some providers call this ALIAS or ' +
            'ANAME. If yours will not accept a CNAME here, skip this row and ' +
            'use your provider\'s forwarding to send ' + domain + ' to www.' + domain + '.' });
    records.push({ type: 'CNAME', name: 'www', value: target, purpose: 'routing',
      note: 'www.' + domain });
  } else {
    records.push({ type: 'CNAME', name: labelOf(domain), value: target,
      purpose: 'routing', note: domain });
  }
  return records;
}

/* Second-level suffixes that are part of the registrable name rather than a
   subdomain of it. Counting labels alone said clinic.co.in had three parts
   and was therefore a subdomain, so a doctor on a .co.in - an ordinary
   Indian business domain - was handed a CNAME record where an apex record
   was needed, and the connection silently never worked.
 *
   This is not the full public suffix list; pulling that in for one check is
   not worth the weight. It is the suffixes an Indian clinic actually
   registers, plus the handful of foreign ones a returning doctor might
   hold. Anything not listed falls back to label counting, which is correct
   for .com, .in, .clinic, .health and every other single-label TLD. */
const MULTI_PART_SUFFIXES = [
  'co.in', 'net.in', 'org.in', 'firm.in', 'gen.in', 'ind.in',
  'ac.in', 'edu.in', 'res.in', 'gov.in', 'mil.in', 'nic.in',
  'co.uk', 'org.uk', 'me.uk', 'com.au', 'net.au', 'co.nz',
  'co.za', 'com.sg', 'com.my', 'ae.org'
];

const isApex = domain => {
  const value = String(domain || '').toLowerCase().replace(/\.$/, '');
  const parts = value.split('.').filter(Boolean);
  if (parts.length < 2) return false;
  const lastTwo = parts.slice(-2).join('.');
  /* clinic.co.in -> three labels, but "co.in" is the suffix, so the apex is
     the last THREE labels. */
  if (MULTI_PART_SUFFIXES.includes(lastTwo)) return parts.length === 3;
  return parts.length === 2;
};
const labelOf = domain => String(domain || '').split('.')[0];

/* Accepts what a doctor will actually paste: a full URL, a trailing slash,
   capitals, stray spaces. Rejects what cannot work rather than storing it
   and failing silently at DNS time. */
export function normaliseDomain(input) {
  let value = String(input || '').trim().toLowerCase();
  if (!value) return null;

  value = value.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/\.$/, '');
  /* www is stripped: she is claiming the site, and we serve both. Storing
     "www.x.com" and "x.com" as different rows would let two clinics claim
     halves of the same domain. */
  value = value.replace(/^www\./, '');

  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(value)) {
    throw badRequest('That does not look like a domain. Enter it like yourclinic.com');
  }
  if (value.length > 200) throw badRequest('That domain is too long.');
  return value;
}

/* The one or two hostnames a claimed domain needs at the edge. An apex also
   needs www, because patients type it out of habit and it is a different
   hostname as far as a certificate is concerned. */
export const hostnamesFor = domain =>
  isApex(domain) ? [domain, 'www.' + domain] : [domain];

/* Cloudflare's status words for one or two hostnames, collapsed into the one
   thing a doctor is actually asking: is there anything for me to do?
 *
   Always the LEAST advanced of them, never the primary. An apex carries www
   alongside it, and a www that is still validating means half her patients
   get a certificate error - which looks to them like her clinic has been
   hacked. Reporting the primary's state would have called that "live". */
function slowest(proofs) {
  const order = ['failed', 'pending', 'issuing', 'active'];
  const rank = p => {
    if (p.error) return 0;
    if (p.sslStatus === 'active' && p.hostnameStatus === 'active') return 3;
    if (p.sslStatus === 'pending_issuance' || p.sslStatus === 'pending_deployment') return 2;
    if (p.sslStatus && !['initializing', 'pending_validation', 'active']
        .includes(p.sslStatus)) return 0;
    return 1;
  };
  const list = (proofs || []).filter(Boolean);
  if (!list.length) return { state: 'pending', proof: null };
  const worst = list.reduce((a, b) => (rank(b) < rank(a) ? b : a));
  return { state: order[rank(worst)], proof: worst };
}
const overall = proofs => slowest(proofs).state;

/* One write, so a half-finished status can never be left behind by a request
   that failed between two updates. */
async function persist(db, doctorId, domain, proofs, wasActiveAt) {
  const list = (proofs || []).filter(Boolean);
  const worst = slowest(list);
  const status = worst.state;
  const primary = list[0] || null;

  /* The moment her domain first started serving patients, kept across later
     checks. Computed here rather than in a SQL CASE: this is the kind of
     conditional that reads as obviously correct and is not, because
     COALESCE against the row being updated depends on the order SQLite
     evaluates the SET list. */
  const activeAt = status === 'active' ? (wasActiveAt || nowIso()) : null;

  await db.prepare(
    `UPDATE doctors
        SET custom_hostname_id = ?, custom_hostname_www_id = ?,
            custom_domain_records = ?, custom_domain_ssl_status = ?,
            custom_domain_status = ?, custom_domain_error = ?,
            custom_domain_checked_at = ?, custom_domain_active_at = ?
      WHERE id = ? AND custom_domain = ?`
  ).bind(
    primary ? primary.id : null,
    list[1] ? list[1].id : null,
    JSON.stringify(list.map(p => ({
      hostname: p.hostname, ownership: p.ownership, validation: p.validation
    }))),
    primary ? primary.sslStatus : null,
    status,
    list.map(p => p.error).filter(Boolean)[0] || null,
    nowIso(), activeAt, doctorId, domain
  ).run();

  /* `worst` travels with the result so the caller explains the hostname that
     is actually holding her up, not the first one in the list. */
  return { status, proofs: list, worst: worst.proof, activeAt };
}

export const domains = {
  /* Claim a domain for this clinic.
   *
     This now REGISTERS the domain with Cloudflare before returning, rather
     than just writing a row. That is the point: the records we are about to
     show her are the ones Cloudflare generated for her specific domain, and
     they do not exist until the custom hostname does. The old version showed
     a generic CNAME it had made up, which she could follow exactly and still
     reach nothing. */
  async claim(db, env, doctorId, input) {
    const domain = normaliseDomain(input);

    /* Refuse up front rather than storing a domain we cannot serve. A doctor
       told "not available yet" can plan around it; a doctor given
       instructions that cannot work loses an afternoon and then trusts
       nothing else on the screen. */
    if (!customHostname.configured(env)) {
      throw customHostname.unavailable();
    }

    /* Never let a clinic claim the platform's own domains - it would take
       over the sign-in page or another clinic's free address. */
    const reserved = ['tcos.in', 'tharigopula.com', 'localhost'];
    if (reserved.some(r => domain === r || domain.endsWith('.' + r))) {
      throw badRequest('That address belongs to TCOS. Enter a domain you own.');
    }

    const taken = await db.prepare(
      'SELECT id FROM doctors WHERE custom_domain = ? AND id != ?').bind(domain, doctorId).first();
    if (taken) {
      throw forbidden('Another clinic has already connected that domain. If it is yours, contact TCOS support.');
    }

    /* Stored BEFORE Cloudflare is called, so a domain can never be live at
       the edge with no row here saying who it belongs to. The reverse - a row
       with no custom hostname - is recoverable, because check() creates the
       missing one. */
    await db.prepare(
      `UPDATE doctors SET custom_domain = ?, custom_domain_status = 'pending',
              custom_domain_error = NULL, custom_domain_active_at = NULL,
              custom_domain_checked_at = NULL, custom_domain_ssl_status = NULL,
              custom_hostname_id = NULL, custom_hostname_www_id = NULL,
              custom_domain_records = NULL
        WHERE id = ?`
    ).bind(domain, doctorId).run();

    const proofs = [];
    for (const hostname of hostnamesFor(domain)) {
      proofs.push(await customHostname.create(env, hostname));
    }
    const saved = await persist(db, doctorId, domain, proofs);

    return { domain, status: saved.status,
      records: dnsRecords(env, domain, saved.proofs) };
  },

  /* Disconnecting must never leave the clinic unreachable, which is why the
     free address is not something she can give up.
   *
     Deleting the custom hostnames at Cloudflare is done FIRST and is not
     optional: an orphaned custom hostname keeps costing money and, worse,
     locks that domain out of every Cloudflare account on earth - including
     hers, if she sets it up somewhere else tomorrow. If Cloudflare refuses,
     the local row stays as it is rather than being cleared, so the id is not
     lost and a retry can still find it. */
  async release(db, env, doctorId, doctor) {
    const domain = doctor && doctor.custom_domain;

    for (const id of [doctor && doctor.custom_hostname_id,
                      doctor && doctor.custom_hostname_www_id]) {
      /* Pausing new domains must never orphan a hostname already created at
         Cloudflare. Certificate API access is enough to remove it; the edge
         routing readiness flag governs only whether a NEW claim is sold. */
      if (id && customHostname.serviceConfigured(env)) await customHostname.remove(env, id);
    }

    await db.prepare(
      `UPDATE doctors SET custom_domain = NULL, custom_domain_status = 'none',
              custom_domain_error = NULL, custom_domain_active_at = NULL,
              custom_domain_checked_at = NULL, custom_domain_ssl_status = NULL,
              custom_hostname_id = NULL, custom_hostname_www_id = NULL,
              custom_domain_records = NULL
        WHERE id = ?`
    ).bind(doctorId).run();
    return { released: true };
  },

  /* Where has she got to?
   *
     This used to resolve her domain over DNS-over-HTTPS and decide for
     itself. That was the heart of the bug: a CNAME that resolves proves she
     typed a record, and nothing more. Cloudflare could still be refusing the
     hostname, and the browser would still show a certificate error, and we
     would be reporting progress.
   *
     So the question is now put to the only thing that can answer it - the
     edge that will actually serve her patients. Slower, one API call, and
     true. */
  async check(db, env, doctorId, domain, doctor) {
    if (!customHostname.configured(env)) throw customHostname.unavailable();

    const wanted = hostnamesFor(domain);
    const known = [doctor && doctor.custom_hostname_id,
                   doctor && doctor.custom_hostname_www_id];

    const proofs = [];
    for (let i = 0; i < wanted.length; i++) {
      /* By stored id first - one request, and it is the same record she has
         been reading values from. */
      let proof = known[i] ? await customHostname.status(env, known[i]) : null;
      /* Then by name, for a domain claimed before this shipped, or one whose
         id we lost to a request that died between the API call and the write.
         Then create, because a domain she has claimed and cannot see records
         for is indistinguishable from broken. */
      if (!proof) proof = await customHostname.find(env, wanted[i]);
      if (!proof) proof = await customHostname.create(env, wanted[i]);
      proofs.push(proof);
    }

    const saved = await persist(db, doctorId, domain, proofs,
      doctor && doctor.custom_domain_active_at);
    const error = saved.proofs.map(p => p.error).filter(Boolean)[0] || null;

    /* The aggregate, which is the SLOWEST hostname and not the first one. An
       apex carries www alongside it, and describing the apex while www is
       still validating would tell her the domain is live while half her
       patients get a certificate error. */
    return {
      status: saved.status,
      error,
      activeAt: saved.activeAt,
      /* What she should do next, in words. Cloudflare's own status strings
         ("pending_deployment") answer a question she is not asking. */
      ...customHostname.explain(saved.status, error),
      records: dnsRecords(env, domain, saved.proofs)
    };
  },


  /* Which clinic does this Host header belong to? Both routes resolve here:
     her own domain, and her free subdomain. Only a published page answers -
     an unpublished one is not there, exactly as with the slug route. */
  /* Every domain still waiting, checked once a night.
   *
     A doctor should not have to sit on the screen pressing a button for a
     certificate that arrives forty minutes later. The screen polls while she
     is watching; this catches the ones she set up and walked away from, so
     she opens TCOS the next morning and her domain is simply live.
   *
     Failures are per-domain and swallowed deliberately: one doctor whose
     registrar is misconfigured must not stop the other nineteen from being
     checked. The batch is capped because this shares a cron invocation with
     the reminders, and a hundred sequential API calls would run it out of
     time - the ones that miss a night are picked up the next. */
  async sweep(db, env, limit = 40) {
    if (!customHostname.configured(env)) return { skipped: 'not_configured' };

    const { results } = await db.prepare(
      `SELECT id, custom_domain, custom_hostname_id, custom_hostname_www_id,
              custom_domain_active_at
         FROM doctors
        WHERE custom_domain IS NOT NULL
          AND custom_domain_status IN ('pending','issuing','verifying')
        ORDER BY COALESCE(custom_domain_checked_at, '') ASC
        LIMIT ?`
    ).bind(limit).all();

    const summary = { checked: 0, active: 0, failed: 0 };
    for (const row of (results || [])) {
      try {
        const result = await domains.check(db, env, row.id, row.custom_domain, row);
        summary.checked++;
        if (result.status === 'active') summary.active++;
        if (result.status === 'failed') summary.failed++;
      } catch (error) {
        console.error('domain sweep', row.custom_domain, error && error.message);
      }
    }
    return summary;
  },

  async bySiteHost(db, env, host) {
    const clean = String(host || '').toLowerCase().split(':')[0].replace(/^www\./, '');
    if (!clean) return null;

    const platform = env.CLINIC_DOMAIN || 'tcos.in';
    if (clean === platform) return null;

    if (clean.endsWith('.' + platform)) {
      const slug = clean.slice(0, -(platform.length + 1));
      if (!slug || slug.includes('.')) return null;
      return db.prepare(
        `SELECT id, public_slug FROM doctors
          WHERE public_slug = ? AND public_page_on = 1 AND status = 'active'`
      ).bind(slug).first();
    }

    /* NOT gated on custom_domain_status, deliberately.
     *
       Reaching this line means Cloudflare's edge accepted this hostname and
       routed it to us, which it only does for a custom hostname registered
       to our account with a valid certificate - so the verification has
       already happened, upstream, in the only place that can actually
       enforce it. Our column is a record of when we last ASKED.
     *
       Gating on it added nothing and cost real time: a certificate can go
       live hours before the next sweep, and a doctor whose domain was
       working would have got nothing until we got round to noticing. The
       locks that matter are still here - her page must be published, and her
       account must be active. */
    return db.prepare(
      `SELECT id, public_slug FROM doctors
        WHERE custom_domain = ? AND public_page_on = 1 AND status = 'active'`
    ).bind(clean).first();
  }
};

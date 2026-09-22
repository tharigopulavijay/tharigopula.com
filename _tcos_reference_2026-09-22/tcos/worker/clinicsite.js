/* =========================================================================
   Serving a clinic's page on the clinic's OWN address.

   The Worker has resolved a host to a clinic since custom domains were
   built - and then answered with JSON. A patient typing drdevi.com into her
   phone got a wall of curly braces. Everything needed to serve her a website
   was present; the last step returned the data instead of the page.

   ONE RENDERER, NOT TWO.
   The obvious fix is to build the clinic page's HTML here in the Worker.
   That would be a second renderer of a document that already has one
   (js/clinic-page.js), and this repository has paid for that mistake before
   - three hand-built copies of the prescription drifted apart before one
   renderer replaced them.

   So this fetches the REAL built shell from the app origin and rewrites it:
   asset paths become absolute so they resolve from her domain, and the slug
   is handed over in a data attribute. The page a patient sees on drdevi.com
   is byte-for-byte the page she sees on the platform address, including the
   content hashes in the asset names - which the Worker could never have
   guessed on its own, because the build stamps them at publish time.

   THE SLUG TRAVELS IN AN ATTRIBUTE, NOT AN INLINE SCRIPT.
   An inline <script> would need its hash in the CSP below, and that hash
   would change with every slug - so the policy could not be written down.
   A data attribute needs no exception.
   ========================================================================= */

import { appOrigin } from '@tharigopula/core/lib';

/* The shell is one small file that changes only on deploy, so it is held in
   the isolate rather than fetched for every visitor. A few minutes is long
   enough to matter on a busy clinic page and short enough that a deploy is
   picked up without anybody thinking about it. */
const SHELL_TTL_MS = 5 * 60 * 1000;
let cached = { at: 0, origin: '', html: '' };

/* Relative asset paths resolve against the CLINIC's domain, where nothing is
   served. Absolute ones resolve against the app, where everything is. */
function absolutise(html, origin) {
  return html
    .replace(/(<link[^>]+href=")(?!https?:|\/\/|\/)/g, '$1' + origin + '/')
    .replace(/(<script[^>]+src=")(?!https?:|\/\/|\/)/g, '$1' + origin + '/');
}

async function shell(env) {
  const origin = appOrigin(env);
  const fresh = cached.html && cached.origin === origin &&
    (Date.now() - cached.at) < SHELL_TTL_MS;
  if (fresh) return cached.html;

  const response = await fetch(origin + '/clinic.html', {
    /* Ask the edge for its copy: this is the same file every visitor of
       every clinic needs, and it changes only when the app is deployed. */
    cf: { cacheTtl: 300, cacheEverything: true }
  });
  if (!response.ok) throw new Error('clinic shell ' + response.status);

  const html = absolutise(await response.text(), origin);
  cached = { at: Date.now(), origin, html };
  return html;
}

/* A clinic page is public, reads one API, and runs no inline script. The
   policy can therefore be tight and specific rather than inherited.

   Written here rather than left to _headers because _headers belongs to the
   Pages deployment and this response never passes through it. */
const csp = (env) => [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  /* Cloudflare injects its own analytics beacon into HTML it serves on the
     zone, so blocking it does not stop it being requested - it only logs a
     violation on every visit to every clinic page. It sets no cookie and
     the request is Cloudflare's own, so it is named rather than fought. */
  "script-src " + appOrigin(env) + " https://static.cloudflareinsights.com",
  "style-src " + appOrigin(env) + " 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com data:",
  "img-src " + appOrigin(env) + " data: blob:",
  /* Her page fetches her own profile and posts an appointment request. */
  "connect-src 'self'",
  "upgrade-insecure-requests"
].join('; ');

/* The page, ready to serve. `slug` is the clinic this host belongs to. */
export async function clinicSiteResponse(env, slug) {
  const html = (await shell(env)).replace(
    '<div id="page">',
    '<div id="page" data-slug="' + String(slug).replace(/"/g, '&quot;') + '">');

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      /* Short, because publishing or unpublishing must take effect for a
         patient who is looking at it now, not in an hour. */
      'Cache-Control': 'public, max-age=60',
      'Content-Security-Policy': csp(env),
      /* A clinic page is the one thing here that SHOULD be found. Every
         other TCOS surface carries noindex. */
      'X-Robots-Tag': 'index, follow'
    }
  });
}

/* Only used when the shell cannot be fetched - a deploy in flight, or the
   app origin briefly unreachable. Sending her to the address that always
   works beats an error page on a doctor's own domain. */
export const clinicSiteFallback = (env, slug) =>
  Response.redirect(
    appOrigin(env) + '/clinic.html?c=' + encodeURIComponent(slug), 302);

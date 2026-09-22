/* Browser-session boundary.

   Staging uses host-only HttpOnly cookies. Production can keep accepting the
   legacy bearer header until its own same-origin hostname is cut over. The
   compatibility switch is server-side: a browser cannot choose bearer mode
   once COOKIE_AUTH_ENFORCE is true.

   The CSRF value is not a session credential. It is readable by the app, but
   useful only beside the host-only cookie that JavaScript cannot read. */

import { ApiError, newSessionToken, safeEqual, sha256 } from '@tharigopula/core/lib';

export const CLINIC_SESSION_COOKIE = '__Host-tcos-session';
export const ADMIN_SESSION_COOKIE = '__Host-tcos-admin-session';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const cookieAuthEnforced = (env, cookieName) => {
  /* Production's owner console already has a same-origin Worker hostname,
     while the doctor app temporarily remains on Pages and calls workers.dev.
     Enforcing one global cookie switch there would silently break every
     doctor login. Keep the admin boundary independently enforceable until
     the doctor-facing app receives its own same-origin hostname. */
  if (cookieName === ADMIN_SESSION_COOKIE &&
      env && env.ADMIN_COOKIE_AUTH_ENFORCE !== undefined) {
    return String(env.ADMIN_COOKIE_AUTH_ENFORCE).toLowerCase() === 'true';
  }
  return String(env && env.COOKIE_AUTH_ENFORCE || '').toLowerCase() === 'true';
};

function cookieValue(request, name) {
  const line = request.headers.get('Cookie') || '';
  for (const part of line.split(';')) {
    const split = part.indexOf('=');
    if (split < 0) continue;
    if (part.slice(0, split).trim() !== name) continue;
    try { return decodeURIComponent(part.slice(split + 1).trim()); }
    catch (_) { return null; }
  }
  return null;
}

export function sessionCredential(request, cookieName, env) {
  const header = request.headers.get('Authorization') || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  const cookie = cookieValue(request, cookieName);

  if (cookieAuthEnforced(env, cookieName)) {
    return cookie ? { token: cookie, mode: 'cookie' } : null;
  }
  if (bearer) return { token: bearer, mode: 'bearer' };
  return cookie ? { token: cookie, mode: 'cookie' } : null;
}

export const newCsrfToken = () => newSessionToken();

function expectedOrigin(env, request) {
  const path = new URL(request.url).pathname;
  const configured = path === '/admin' || path === '/admin.html' || path.startsWith('/admin/')
    ? (env.ADMIN_ORIGIN || env.APP_ORIGIN)
    : env.APP_ORIGIN;
  return String(configured || '').replace(/\/+$/, '');
}

export async function requireCookieCsrf(env, request, credential, csrfHash) {
  if (!credential || credential.mode !== 'cookie' || SAFE_METHODS.has(request.method)) return;

  const trustedOrigin = expectedOrigin(env, request);
  const suppliedOrigin = request.headers.get('Origin') || '';
  if (!trustedOrigin || suppliedOrigin !== trustedOrigin) {
    throw new ApiError(403, 'csrf_failed',
      'This request did not come from the signed-in TCOS app. Refresh and try again.');
  }

  const value = request.headers.get('X-CSRF-Token') || '';
  if (!value || !csrfHash || !safeEqual(await sha256(value), csrfHash)) {
    throw new ApiError(403, 'csrf_failed',
      'Your secure form token expired. Refresh the page and try again.');
  }
}

export function sessionCookie(name, token, ttlHours) {
  const maxAge = Math.max(60, Math.floor(Number(ttlHours || 12) * 3600));
  return name + '=' + encodeURIComponent(token) +
    '; Path=/; Max-Age=' + maxAge + '; HttpOnly; Secure; SameSite=Strict';
}

export function clearSessionCookie(name) {
  return name + '=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT' +
    '; HttpOnly; Secure; SameSite=Strict';
}


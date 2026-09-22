/* Cloudflare Turnstile verification for the TCOS-owned account surfaces.

   Rendering a widget is not protection. Every token is verified here with
   Siteverify, then its action and hostname are checked so a token solved for
   one TCOS form cannot be replayed on another. Turnstile tokens are already
   single-use and expire after five minutes; the browser resets the widget
   after every submission.

   Rollout is explicit. TURNSTILE_ENFORCE=false means disabled. Switching it
   to true without both the public site key and server-only secret fails
   closed on protected forms and never silently pretends they were checked. */

import { ApiError, badRequest } from '@tharigopula/core/lib';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export const turnstileEnabled = env =>
  String(env && env.TURNSTILE_ENFORCE || '').toLowerCase() === 'true';

export function challengeConfig(env) {
  const enabled = turnstileEnabled(env);
  return {
    enabled,
    siteKey: enabled && env.TURNSTILE_SITE_KEY ? env.TURNSTILE_SITE_KEY : null
  };
}

function expectedHostname(env, action) {
  const origin = String(action || '').startsWith('platform_')
    ? (env.ADMIN_ORIGIN || env.APP_ORIGIN)
    : env.APP_ORIGIN;
  try { return new URL(origin).hostname.toLowerCase(); }
  catch (_) { return ''; }
}

export async function verifyTurnstile(env, request, { token, action }) {
  if (!turnstileEnabled(env)) return { enabled: false, verified: false };
  if (!env.TURNSTILE_SITE_KEY || !env.TURNSTILE_SECRET_KEY) {
    console.error(JSON.stringify({
      level: 'error', event: 'turnstile_misconfigured', action
    }));
    throw new ApiError(503, 'security_check_unavailable',
      'The security check is unavailable. Please try again shortly.');
  }
  if (!token || typeof token !== 'string') {
    throw badRequest('Complete the security check and try again.');
  }

  const form = new FormData();
  form.set('secret', env.TURNSTILE_SECRET_KEY);
  form.set('response', token);
  const remoteIp = request && request.headers && request.headers.get('CF-Connecting-IP');
  if (remoteIp) form.set('remoteip', remoteIp);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  let response;
  try {
    response = await fetch(VERIFY_URL, {
      method: 'POST', body: form, signal: controller.signal
    });
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error', event: 'turnstile_verification_unavailable', action,
      error: error instanceof Error ? error.message : 'unknown'
    }));
    throw new ApiError(503, 'security_check_unavailable',
      'The security check could not be verified. Please try again.');
  } finally {
    clearTimeout(timeout);
  }

  let result = null;
  try { result = await response.json(); } catch (_) {}
  const hostname = String(result && result.hostname || '').toLowerCase();
  const hostMatches = !!hostname && hostname === expectedHostname(env, action);
  const actionMatches = result && result.action === action;

  if (!response.ok || !result || result.success !== true ||
      !hostMatches || !actionMatches) {
    console.warn(JSON.stringify({
      level: 'warn', event: 'turnstile_rejected', action,
      providerAction: result && result.action || null,
      hostnameMatched: hostMatches,
      errorCodes: result && result['error-codes'] || []
    }));
    throw badRequest('The security check expired or could not be verified. Try it again.');
  }

  return { enabled: true, verified: true };
}

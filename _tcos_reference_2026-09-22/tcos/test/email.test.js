/* =========================================================================
   Email, and why it is not the lesser channel.

   A verification code goes by SMS because every Indian mobile receives one.
   But SMS to an Indian number needs DLT registration - a five-figure fee
   and several days - and until that clears there is NO route for a code at
   all. In that window an emailed code is the only way back into an account,
   and a doctor with no address on file is locked out permanently with her
   patients' records inside.

   So these assertions are about one thing: never look configured while
   being unable to deliver.

   Run:  node test/email.test.js
   ========================================================================= */

import { email } from '@tharigopula/core/comms';
const { configured, from, deliver, health } = email;

let passed = 0, failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
};
const withFetch = fn => { globalThis.fetch = fn; };

/* --------------------------------------------------------- configured --- */
console.log('\nSwitched off is a state, not a crash\n');

check('no key is not configured', configured({}) === false);
check('a key is configured', configured({ RESEND_API_KEY: 'x' }) === true);
check('the default sender is on our own domain',
  from({}).includes('@tharigopula.com'), from({}));
check('and it can be overridden', from({ MAIL_FROM: 'A <a@b.com>' }) === 'A <a@b.com>');

/* ------------------------------------------------------------- health --- */
console.log('\nThe health check names the actual problem\n');

let h = await health({});
check('no key names what to do about it',
  /resend.com/.test(h.reason) && /RESEND_API_KEY/.test(h.reason), h.reason);

withFetch(async () => ({
  status: 401, ok: false, text: async () => '{"message":"API key is invalid"}'
}));
h = await health({ RESEND_API_KEY: 'wrong' });
check('a genuinely invalid key says so',
  h.ok === false && /rejected the key/.test(h.reason), h.reason);

/* A sending-scoped key CANNOT list domains, and sending-only is the scope
   we want - a leaked key could post an email and nothing else. Calling that
   "rejected" would be a false alarm about a key that works perfectly. */
withFetch(async () => ({
  status: 401, ok: false,
  text: async () => '{"message":"This API key is restricted to sending access"}'
}));
h = await health({ RESEND_API_KEY: 'sending-only' });
check('a sending-only key is not mistaken for a bad one', h.ok === true, h.reason);
check('and it says where to confirm instead',
  h.scope === 'sending-only' && /Resend dashboard/.test(h.reason), h.reason);

/* The one people miss. Resend accepts the key happily and then refuses
   every message from a domain that has not cleared DNS - so "the key
   works" is not the same as "email works", and saying only the first would
   send somebody away believing they were done. */
withFetch(async () => ({
  status: 200, ok: true,
  json: async () => ({ data: [{ name: 'tharigopula.com', status: 'pending' }] })
}));
h = await health({ RESEND_API_KEY: 'k' });
check('a domain added but not verified is NOT ready', h.ok === false);
check('and it says DNS is the unfinished part',
  /not verified yet/.test(h.reason) && /DNS/.test(h.reason), h.reason);

withFetch(async () => ({
  status: 200, ok: true, json: async () => ({ data: [] })
}));
h = await health({ RESEND_API_KEY: 'k' });
check('a domain never added is its own message',
  /not added in Resend/.test(h.reason), h.reason);
check('and it names the domain we would send from',
  /tharigopula\.com/.test(h.reason), h.reason);

withFetch(async () => ({
  status: 200, ok: true,
  json: async () => ({ data: [{ name: 'tharigopula.com', status: 'verified' }] })
}));
h = await health({ RESEND_API_KEY: 'k' });
check('key plus verified domain is ready', h.ok === true && /Ready to send/.test(h.reason));
check('and it reports the address codes will come from',
  h.sendingAs === 'noreply@tharigopula.com', h.sendingAs);

/* The sending domain is whatever MAIL_FROM says, so the check has to follow
   it - checking a hardcoded domain would pass while sending failed. */
withFetch(async () => ({
  status: 200, ok: true,
  json: async () => ({ data: [{ name: 'tharigopula.com', status: 'verified' }] })
}));
h = await health({ RESEND_API_KEY: 'k', MAIL_FROM: 'TCOS <hello@example.org>' });
check('it checks the domain we actually send from, not a fixed one',
  h.ok === false && /example\.org is not added/.test(h.reason), h.reason);

withFetch(async () => { throw new Error('boom'); });
h = await health({ RESEND_API_KEY: 'k' });
check('a network failure does not crash the check',
  h.ok === false && /Could not reach Resend/.test(h.reason), h.reason);

/* ------------------------------------------------------------- send --- */
console.log('\nSending, and failing out loud\n');

let sent = null;
withFetch(async (url, init) => {
  sent = { url: String(url), body: JSON.parse(init.body), headers: init.headers };
  return { ok: true, json: async () => ({ id: 'em_1' }) };
});
const id = await deliver({ RESEND_API_KEY: 'k' },
  { to: 'doctor@clinic.in', subject: 'Your TCOS verification code', text: 'Code: 1234' });

check('it posts to Resend', sent.url === 'https://api.resend.com/emails', sent.url);
check('the key travels in the header, never the body',
  sent.headers.Authorization === 'Bearer k' && !JSON.stringify(sent.body).includes('Bearer'));
check('the recipient is an array, the way Resend wants it',
  Array.isArray(sent.body.to) && sent.body.to[0] === 'doctor@clinic.in');
check('it returns the provider id so a send can be traced', id === 'em_1');

let threw = null;
withFetch(async () => ({
  ok: false,
  json: async () => ({ message: 'The tharigopula.com domain is not verified.' })
}));
try {
  await deliver({ RESEND_API_KEY: 'k' }, { to: 'a@b.com', subject: 's', text: 't' });
} catch (error) { threw = error; }

/* "The domain is not verified" and "invalid API key" are different problems
   with different fixes. Flattening both to "could not send" throws away the
   half that helps. */
check('a refused send throws', threw !== null);
check('and repeats what Resend actually said',
  threw && /domain is not verified/.test(threw.message), threw && threw.message);

threw = null;
try {
  await deliver({}, { to: 'a@b.com', subject: 's', text: 't' });
} catch (error) { threw = error; }
check('no key at all is refused with a fixable message',
  threw && /RESEND_API_KEY/.test(threw.message), threw && threw.message);

console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);

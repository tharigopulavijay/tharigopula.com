/* =========================================================================
   Signing in with the fingerprint, face or lock the device already has.

   Vijay: "i have my own user id and pwd, then why do i need ... this email
   id only ... if mobile app we need to make that it should be embedded to
   the mobile app fingerprint or pattern or the mobile lock - just give that
   fingerprint or something, thats it, we are in."

   The browser does the hard part. This file's whole job is translating
   between the base64url the server speaks and the ArrayBuffers
   navigator.credentials speaks, and turning the four or five ways this can
   fail into sentences somebody can act on.

   ONE FILE FOR BOTH SIDES. The owner console and the clinic app post to
   different paths and nothing else differs, so the paths are arguments.
   Two copies of this would be two copies of the base64url handling, and
   that is exactly the kind of code that is subtly wrong in one of them.
   ========================================================================= */
(() => {
  'use strict';

  const toBytes = value => {
    const normalised = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalised + '='.repeat((4 - (normalised.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  };

  const toText = buffer => {
    const view = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < view.length; i++) binary += String.fromCharCode(view[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  /* Can this device do it at all? A desktop with no sensor and no phone
     paired cannot, and saying so is better than a button that fails. */
  const supported = () =>
    typeof window.PublicKeyCredential === 'function' &&
    !!(navigator.credentials && navigator.credentials.create);

  async function platformAvailable() {
    if (!supported()) return false;
    try {
      /* "Is there a fingerprint reader, a face camera or a device PIN on
         THIS machine" - as opposed to a USB key, which works but is not
         what he asked for. */
      return await window.PublicKeyCredential
        .isUserVerifyingPlatformAuthenticatorAvailable();
    } catch (_) { return false; }
  }

  /* A name he will recognise in a list of devices six months from now. */
  function deviceName() {
    const ua = navigator.userAgent;
    if (/iPhone/i.test(ua)) return 'iPhone';
    if (/iPad/i.test(ua)) return 'iPad';
    if (/Android/i.test(ua)) return 'Android phone';
    if (/Macintosh/i.test(ua)) return 'Mac';
    if (/Windows/i.test(ua)) return 'Windows PC';
    return 'This device';
  }

  /* The browser's errors are precise and unreadable. These are the four
     that actually happen, in words that say what to do next. */
  function readable(error) {
    const name = error && error.name;
    if (name === 'NotAllowedError') {
      return new Error('That was cancelled, or it timed out. Try again and ' +
        'confirm with your fingerprint, face or device PIN.');
    }
    if (name === 'InvalidStateError') {
      return new Error('This device is already set up. Use "Sign in with fingerprint".');
    }
    if (name === 'SecurityError') {
      return new Error('This page cannot use a passkey. It must be opened over https ' +
        'on the address you set the passkey up on.');
    }
    if (name === 'NotSupportedError') {
      return new Error('This device cannot store a passkey.');
    }
    return error instanceof Error ? error : new Error('That did not work. Try again.');
  }

  window.TCOSPasskeys = {
    supported,
    platformAvailable,
    deviceName,

    /* ---- enrol this device ----
       Runs inside a session already signed in, so the server needs no
       second proof of who this is. */
    async enrol(api, paths, label) {
      if (!supported()) throw new Error('This browser cannot use passkeys.');
      const options = await api.post(paths.challenge, {});

      let credential;
      try {
        credential = await navigator.credentials.create({
          publicKey: {
            challenge: toBytes(options.challenge),
            rp: { id: options.rpId, name: options.rpName },
            user: {
              id: toBytes(options.userId),
              name: options.userName,
              displayName: options.userDisplayName
            },
            pubKeyCredParams: (options.algorithms || [-7, -257])
              .map(alg => ({ type: 'public-key', alg })),
            authenticatorSelection: {
              /* THE DEVICE ITSELF, not a USB key - he asked for the phone's
                 own fingerprint. And the credential must be discoverable,
                 or signing in would mean naming the account first, which
                 is the typing this exists to remove. */
              authenticatorAttachment: 'platform',
              residentKey: 'required',
              userVerification: 'required'
            },
            /* Checking a make and model would mean shipping a certificate
               list to tell a doctor her phone is the wrong brand. */
            attestation: 'none',
            timeout: 120000
          }
        });
      } catch (error) { throw readable(error); }
      if (!credential) throw new Error('That did not work. Try again.');

      const response = credential.response;
      /* getPublicKey() is why there is no CBOR decoder anywhere in TCOS.
         It is not in the oldest browsers, and one that lacks it should say
         so rather than send something the server cannot read. */
      if (typeof response.getPublicKey !== 'function') {
        throw new Error('This browser is too old to set up a passkey. Update it and try again.');
      }
      const publicKey = response.getPublicKey();
      if (!publicKey) throw new Error('This device did not provide a key TCOS can use.');

      return api.post(paths.register, {
        challenge: options.challenge,
        credentialId: credential.id,
        clientDataJSON: toText(response.clientDataJSON),
        publicKey: toText(publicKey),
        algorithm: response.getPublicKeyAlgorithm(),
        label: label || deviceName()
      });
    },

    /* ---- sign in ----
       No password and no email typed: the credential says who he is. */
    async signIn(api, paths) {
      if (!supported()) throw new Error('This browser cannot use passkeys.');
      const options = await api.post(paths.challenge, {});

      let assertion;
      try {
        assertion = await navigator.credentials.get({
          publicKey: {
            challenge: toBytes(options.challenge),
            rpId: options.rpId,
            userVerification: 'required',
            timeout: 120000
          },
          /* No allowCredentials list on purpose: the browser offers the
             passkeys it holds for this site and he picks, which is what
             makes this work on a device the server has never seen naming
             an account nobody typed. */
        });
      } catch (error) { throw readable(error); }
      if (!assertion) throw new Error('No passkey was used.');

      const response = assertion.response;
      return api.post(paths.verify, {
        challenge: options.challenge,
        credentialId: assertion.id,
        clientDataJSON: toText(response.clientDataJSON),
        authenticatorData: toText(response.authenticatorData),
        signature: toText(response.signature)
      });
    }
  };
})();

/* =========================================================================
   The Web screen.

   Vijay: "keep this button as WEB and let's give this option to doctors.
   It is real right, everyone wants their thing to be real."

   Every API this uses already existed. The address, the publish switch, the
   page text and the custom-domain flow were all built and all buried inside
   Clinic setup, below the working hours and the ABDM registry ids - where a
   doctor never found them and never once felt she had a website.

   NOTHING HERE INVENTS AN ADDRESS THAT DOES NOT WORK. The links shown are
   the ones TCOS actually serves today. The pretty subdomain is reported
   exactly as the server reports it, pending included, because a doctor who
   hands out an address that 404s finds out from a patient.
   ========================================================================= */
(async () => {
  'use strict';

  const el = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const msg = (id, text, kind) => {
    el(id).innerHTML = text
      ? '<div class="notice ' + (kind || 'info') + '" style="max-width:none">' + esc(text) + '</div>' : '';
  };

  if (!TCOSApi.isSignedIn()) { TCOSBoot.toSignIn('signed-out'); return; }

  let me, page, domainInfo;
  try { me = await TCOSApi.me(); }
  catch (error) {
    if (error.status === 401) { location.replace('tcos-login.html'); return; }
    msg('pageMsg', error.message, 'error'); return;
  }
  TCOSNav.paint('website.html', me);

  /* Her own website is a paid capability. The screen still opens and still
     shows what she has - a downgrade never hides her own page - but the
     controls that would change it are off, with the reason on screen. */
  window.TCOSGate.apply(me, {
    feature: 'website_connect',
    actions: ['#saveBtn', '#claimDomain', '#checkDomain', '#releaseDomain']
  });

  /* ------------------------------------------------------- the links --- */

  /* Where a patient actually lands today. The clinic page is served by the
     app, so this is the address that genuinely works right now - not the
     subdomain, which needs DNS that is not in place yet. Showing the real
     one and being honest about the other is the whole point. */
  const appBase = location.origin;
  const pageUrl = slug => slug ? appBase + '/clinic.html?c=' + encodeURIComponent(slug) : null;

  function linkRow(label, what, url, ready) {
    if (!url) {
      return '<div class="web-link is-empty"><div class="web-link-what">' +
        '<b>' + esc(label) + '</b><small>' + esc(what) + '</small></div>' +
        '<span class="web-link-url muted">Choose an address below first</span></div>';
    }
    return '<div class="web-link"><div class="web-link-what">' +
      '<b>' + esc(label) + '</b><small>' + esc(what) + '</small></div>' +
      '<code class="web-link-url">' + esc(url) + '</code>' +
      '<div class="web-link-do">' +
        '<button class="btn btn-ghost btn-sm" data-copy="' + esc(url) + '">Copy</button>' +
        '<a class="btn btn-ghost btn-sm" href="' + esc(url) + '" target="_blank" rel="noopener">Open ↗</a>' +
      '</div>' + (ready ? '' : '<span class="pill trial">Not published</span>') + '</div>';
  }

  function paintLinks() {
    const slug = page.slug;
    const live = !!(slug && page.published);
    el('liveState').textContent = live ? 'Live' : slug ? 'Not published' : 'No address yet';
    el('liveState').className = 'pill ' + (live ? 'active' : 'trial');

    el('links').innerHTML =
      linkRow('Clinic website', 'What a patient sees', pageUrl(slug), live) +
      linkRow('Booking page', 'Where appointment requests come from',
        slug ? pageUrl(slug) + '#book' : null, live) +
      /* Not a per-clinic address: a patient opens her own record through an
         unguessable link sent to her, never a login. Saying otherwise would
         promise a door that does not exist. */
      '<div class="web-link"><div class="web-link-what"><b>Patient records</b>' +
        '<small>Each patient gets their own private link</small></div>' +
        '<span class="web-link-url muted">Sent to the patient from their record</span></div>';

    el('linksNote').innerHTML = slug
      ? 'These work now. Connecting your own domain below changes the address ' +
        'a patient sees; this one keeps working either way.'
      : 'Pick a short name below and your page goes live straight away.';

    document.querySelectorAll('[data-copy]').forEach(button =>
      button.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(button.dataset.copy);
          const was = button.textContent;
          button.textContent = 'Copied';
          setTimeout(() => { button.textContent = was; }, 1400);
        } catch (_) { msg('pageMsg', 'Could not copy. Select the address and copy it by hand.', 'warn'); }
      }));
  }

  /* ------------------------------------------------------ the domain --- */

  /* 'verifying' is the status the old DNS-guessing check wrote and some rows
     still carry, so it is mapped rather than falling through to "no domain
     connected" on a domain that is serving patients right now. */
  const DOMAIN_STATE = {
    none: ['No domain connected', 'trial'],
    pending: ['Waiting for your DNS', 'trial'],
    verifying: ['Waiting for your DNS', 'trial'],
    issuing: ['Getting your certificate', 'trial'],
    active: ['Live and secure', 'active'],
    failed: ['Needs attention', 'suspended']
  };

  /* The records come back in two groups and they are NOT interchangeable.
     The proof records can be added while her existing website carries on
     serving; the routing record is the cutover. Presenting them as one flat
     list is how a doctor switches her live clinic site over to a certificate
     that has not been issued yet, and is down for an afternoon. */
  const GROUPS = [
    { of: r => r.purpose === 'ownership' || r.purpose === 'certificate',
      title: 'Step 1 — prove the domain is yours',
      lead: 'Add these first. Nothing changes for your current website, and ' +
            'they let us get your security certificate ready in advance.' },
    { of: r => r.purpose === 'routing',
      title: 'Step 2 — send visitors to your TCOS page',
      lead: 'Add this once Step 1 shows as done. This is the switch: from ' +
            'then on your domain opens your clinic page.' }
  ];

  const rowsFor = records =>
    '<div class="dns-table"><table><thead><tr>' +
      '<th>Type</th><th>Name</th><th>Value</th></tr></thead><tbody>' +
    records.map(record =>
      '<tr><td><code>' + esc(record.type) + '</code></td>' +
        '<td><code>' + esc(record.name) + '</code></td>' +
        '<td><code>' + esc(record.value) + '</code>' +
          (record.note ? '<small>' + esc(record.note) + '</small>' : '') + '</td>' +
      '</tr>').join('') +
    '</tbody></table></div>';

  function paintDomain() {
    const [label, tone] = DOMAIN_STATE[domainInfo.status] || DOMAIN_STATE.none;
    el('domainState').textContent = label;
    el('domainState').className = 'pill ' + tone;
    el('domain').value = domainInfo.customDomain || '';

    /* TWO different reasons the form can be wrong to show, and they are not
       the same sentence.

       `available` false - the platform cannot do this for anyone yet.
       `allowed` false   - it can, but this clinic has not taken the add-on.

       Telling a doctor who simply has not paid that the feature "is not
       ready yet" would be a lie she cannot act on; telling a doctor to pay
       for something that is not built would be worse. */
    if (domainInfo.available === false) {
      el('domainForm').hidden = true;
      el('dns').innerHTML =
        '<div class="notice" style="max-width:none">' +
          '<b>Connecting your own domain is not switched on yet.</b><br>' +
          'Your TCOS web address above works today and always will. We will ' +
          'tell you the moment you can point your own domain here.' +
        '</div>';
      return;
    }

    if (domainInfo.allowed === false && !domainInfo.customDomain) {
      const price = '₹' + ((domainInfo.addonPaise || 5000) / 100).toLocaleString('en-IN');
      el('domainForm').hidden = true;
      el('dns').innerHTML =
        '<div class="notice" style="max-width:none">' +
          '<b>Your own domain — ' + price + ' a month.</b><br>' +
          'Use an address like <code>www.yourclinic.com</code> instead of the ' +
          'TCOS one. This is the one thing here that costs us for every ' +
          'clinic, so it is a small extra rather than part of a plan. ' +
          'Your TCOS address above stays free and keeps working.' +
          '<div style="margin-top:10px">' +
            '<button class="btn btn-primary btn-sm" id="askDomain">' +
              'Ask us to switch it on</button>' +
          '</div>' +
        '</div>';
      /* Routed through the support request that already exists end to end,
         rather than a mailto: link - a doctor who emails gets no ticket and
         no record that she asked. */
      el('askDomain').addEventListener('click', async (event) => {
        event.target.disabled = true;
        try {
          await TCOSApi.createSupportRequest({
            subject: 'Own domain add-on',
            message: 'I would like to connect my own domain name to my clinic page.'
          });
          msg('domainMsg', 'Asked. We will get back to you and set it up with you.', 'ok');
        } catch (error) {
          msg('domainMsg', error.message, 'error');
          event.target.disabled = false;
        }
      });
      return;
    }
    el('domainForm').hidden = false;

    if (!domainInfo.records.length) { el('dns').innerHTML = ''; return; }

    /* What to do next, in one sentence, before any table. She is reading
       this screen to answer one question: is it my turn? */
    const next = domainInfo.message
      ? '<div class="notice ' + (domainInfo.state === 'failed' ? 'warn' : '') +
        '" style="max-width:none">' + esc(domainInfo.message) + '</div>'
      : '';

    el('dns').innerHTML = next +
      GROUPS.map(group => {
        const rows = domainInfo.records.filter(group.of);
        if (!rows.length) return '';
        return '<div class="dns-step"><p class="dns-title">' + group.title + '</p>' +
          '<p class="dns-lead">' + group.lead + '</p>' + rowsFor(rows) + '</div>';
      }).join('') +
      '<p class="dns-foot">Added them? Press <b>Check now</b>. DNS can take a ' +
        'few hours to spread, and the certificate follows within minutes of ' +
        'that - you can close this page and come back.</p>' +
      (domainInfo.error ? '<div class="notice warn" style="max-width:none">' +
        esc(domainInfo.error) + '</div>' : '');
  }

  /* ---------------------------------------------------------- loading --- */

  try {
    [page, domainInfo] = await Promise.all([
      TCOSApi.publicPageSettings(),
      TCOSApi.domain()
    ]);
  } catch (error) { msg('pageMsg', error.message, 'error'); return; }

  /* What sits in front of her chosen name. Shown as the address that
     ACTUALLY works today - the app serving her page - not the pretty
     subdomain, which needs DNS that is not in place. Stripping back to the
     last slash produced "http://localhost:8899/", which is not an address
     anybody could use and told her nothing about what she was choosing.

     The scheme is dropped because she is reading this, not typing it. */
  el('slugPrefix').textContent =
    appBase.replace(/^https?:\/\//, '') + '/clinic.html?c=';
  el('slug').value = page.slug || '';
  el('slug').placeholder = page.suggestedSlug || 'your-clinic';
  el('published').checked = !!page.published;
  el('intro').value = page.intro || '';
  el('hours').value = page.hours || '';

  paintLinks();
  paintDomain();

  /* ----------------------------------------------------------- saving --- */

  el('saveBtn').addEventListener('click', async () => {
    const button = el('saveBtn');
    button.disabled = true;
    msg('pageMsg', '');
    try {
      await TCOSApi.savePublicPage({
        slug: el('slug').value.trim() || null,
        published: el('published').checked,
        intro: el('intro').value.trim() || null,
        hours: el('hours').value.trim() || null
      });
      /* Re-read both: saving a slug for the first time changes the free
         address too, and the save response does not carry it. */
      [page, domainInfo] = await Promise.all([
        TCOSApi.publicPageSettings(), TCOSApi.domain()
      ]);
      el('slug').value = page.slug || '';
      paintLinks();
      paintDomain();
      msg('pageMsg', 'Saved.', 'ok');
    } catch (error) {
      msg('pageMsg', error.message, 'error');
      window.TCOSGate.explain(error);
    } finally { button.disabled = false; }
  });

  /* THE WRITE RESPONSES ARE A DIFFERENT SHAPE FROM THE READ, so this
     re-reads rather than assigning what came back. POST /me/domain returns
     {domain, status, records} with no customDomain; DELETE returns only
     {freeAddress}, with no records at all. Painting straight from those
     would have blanked the input after a connect and thrown on
     records.length after a disconnect.

     One extra request, one shape, nothing to keep in step. */
  const domainAction = async (work, saying) => {
    msg('domainMsg', saying, 'info');
    try {
      await work();
      domainInfo = await TCOSApi.domain();
      paintDomain();
      msg('domainMsg', '');
      watch();
    } catch (error) {
      msg('domainMsg', error.message, 'error');
      window.TCOSGate.explain(error, 'domainMsg');
    }
  };

  /* While she is waiting, the screen checks for her.
   *
     A certificate arrives minutes after her DNS spreads, and she has no way
     to know when that is. Without this she either sits pressing a button or
     - far more likely - closes the tab convinced it did not work. The
     overnight sweep catches the ones she walks away from; this is for the
     doctor who is still watching.
   *
     Every 20 seconds, and only while there is something to wait for. It
     stops the moment the domain is live, fails, or is disconnected, so a
     screen left open on a finished domain is not calling the API all day. */
  let timer = null;
  const WAITING = ['pending', 'verifying', 'issuing'];

  function watch() {
    clearTimeout(timer);
    timer = null;
    if (!domainInfo.customDomain || !WAITING.includes(domainInfo.status)) return;

    timer = setTimeout(async () => {
      /* Silent. She did not ask for this one, so a failure here must not
         throw an error message over a screen she is not interacting with -
         it simply tries again on the next tick. */
      try {
        await TCOSApi.checkDomain();
        domainInfo = await TCOSApi.domain();
        paintDomain();
      } catch (_) { /* offline, rate limited, or Cloudflare briefly down */ }
      watch();
    }, 20000);
  }

  /* Nothing polls a tab nobody is looking at. */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearTimeout(timer); timer = null; }
    else watch();
  });

  el('claimDomain').addEventListener('click', () =>
    domainAction(() => TCOSApi.claimDomain(el('domain').value.trim()), 'Connecting…'));
  el('checkDomain').addEventListener('click', () =>
    domainAction(() => TCOSApi.checkDomain(), 'Checking with your domain provider…'));
  el('releaseDomain').addEventListener('click', () => {
    if (!confirm('Disconnect this domain? Your page stays available at the address above.')) return;
    domainAction(() => TCOSApi.releaseDomain(), 'Disconnecting…');
  });

  watch();
})();

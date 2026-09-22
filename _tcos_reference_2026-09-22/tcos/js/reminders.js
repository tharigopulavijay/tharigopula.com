/* =========================================================================
   Tomorrow's reminders, sent by a human thumb.

   This exists because Meta's template approval is not on our schedule. A
   clinic going live before it clears still needs its patients reminded, and
   a wa.me link costs nothing, needs no account and no review - the price is
   somebody pressing send.

   The wording is the SAME STRING the automatic message uses. When approval
   lands, the patient sees no change; the message simply stops needing a
   thumb. This screen then becomes the exception list: the people the
   nightly run could not reach.

   Front-desk work, so it is gated on `patients`, not on clinical notes.
   Nothing on this page is clinical - a name, a time, and the sentence the
   patient will read.
   ========================================================================= */
(async () => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const el = id => document.getElementById(id);
  const msg = (text, kind) => {
    el('pageMsg').innerHTML = text
      ? '<div class="notice ' + kind + '" style="max-width:none">' + text + '</div>' : '';
  };

  if (!TCOSApi.isSignedIn()) { TCOSBoot.toSignIn('signed-out'); return; }

  let me;
  try { me = await TCOSApi.me(); }
  catch (error) {
    if (error.status === 401) { location.replace('tcos-login.html'); return; }
    msg(esc(error.message), 'error');
    return;
  }
  TCOSRail.paint(me);

  /* Tomorrow in the CLINIC's day. The browser is in the clinic, so its own
     date is the right one here - unlike the nightly job, which runs on a
     server in UTC and has to be told what day it is in India. */
  const tomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  };
  el('remDay').value = tomorrow();

  const pretty = at => {
    if (!at) return '—';
    const [hh, mm] = String(at).split(':').map(Number);
    if (Number.isNaN(hh)) return at;
    const hour = hh % 12 === 0 ? 12 : hh % 12;
    return hour + ':' + String(mm || 0).padStart(2, '0') + (hh < 12 ? ' am' : ' pm');
  };

  async function load() {
    const day = el('remDay').value;
    el('remList').innerHTML = '<div class="empty">Loading…</div>';

    let data;
    try { data = await TCOSApi.reminderLinks(day); }
    catch (error) {
      msg(esc(error.message), 'error');
      el('remList').innerHTML = '<div class="empty">Could not load.</div>';
      return;
    }
    msg('');

    el('remMode').innerHTML = data.automatic
      ? 'Reminders also go out automatically at 7pm the evening before. ' +
        'Use this for anyone the automatic run could not reach.'
      : 'Automatic WhatsApp is not switched on yet, so these are sent by hand. ' +
        'The wording is exactly what the automatic message will say, so nothing ' +
        'changes for the patient when it is.';

    const rows = data.patients || [];
    el('remCount').textContent = rows.length
      ? rows.length + (rows.length === 1 ? ' patient' : ' patients')
      : '';

    if (!rows.length) {
      el('remList').innerHTML =
        '<div class="empty">Nobody booked for ' + esc(day) + '.</div>';
      return;
    }

    el('remList').innerHTML = rows.map(r =>
      '<div class="rem-row' + (r.alreadyMessaged ? ' done' : '') + '">' +
        '<span class="rem-when">' + esc(pretty(r.at)) + '</span>' +
        '<span class="rem-who"><b>' + esc(r.name) + '</b>' +
          '<small>' + (r.alreadyMessaged ? 'Already reminded'
            : (r.optedIn ? 'Agreed to WhatsApp' : 'Not asked about WhatsApp yet')) +
          '</small></span>' +
        '<span class="rem-text">' + esc(r.text) + '</span>' +
        '<a class="btn btn-primary btn-sm rem-send" target="_blank" rel="noopener" ' +
          'href="' + esc(r.link) + '">' +
          (r.alreadyMessaged ? 'Sent' : 'Send') + '</a>' +
      '</div>').join('');
  }

  el('remDay').addEventListener('change', load);
  await load();
})();

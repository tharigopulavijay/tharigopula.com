/* =========================================================================
   The patient sending a report from her own phone.

   She has scanned a QR at the counter. She has no account, has never seen
   this product, and will use it once. So the page is one button that opens
   the camera, a list of what has gone, and a plain statement of where it is
   going - no menu, no explanation of what TCOS is, nothing to read.

   It can WRITE and it cannot READ. The token adds files to one record; it
   cannot open a prescription or show anything clinical, because that QR is
   held up across a counter and photographed by whoever is standing nearby.
   The most this page will ever say about her is a first name.
   ========================================================================= */
(async () => {
  'use strict';

  const API = ['localhost', '127.0.0.1'].includes(location.hostname)
    ? 'http://127.0.0.1:8787'
    : (location.hostname === 'tcos-staging.pages.dev' ||
       location.hostname.endsWith('.tcos-staging.pages.dev'))
      ? 'https://tcos-api-staging.hello-tharigopula.workers.dev'
      : 'https://tcos-api.hello-tharigopula.workers.dev';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const wrap = document.getElementById('wrap');

  /* The token travels in the hash, not the path or the query, so it never
     reaches a server log, a referrer header or browser history in a form
     anyone else can read. Same reasoning as the patient's read link. */
  const token = location.hash.replace(/^#/, '') ||
    new URLSearchParams(location.search).get('t') || '';

  const fail = (title, detail) => {
    wrap.innerHTML = '<div class="card message"><h1>' + esc(title) + '</h1>' +
      '<p>' + esc(detail) + '</p></div>';
  };

  if (!token) {
    fail('This link is incomplete', 'Scan the code at the clinic again.');
    return;
  }

  let link;
  try {
    const response = await fetch(API + '/u/' + encodeURIComponent(token));
    link = await response.json();
    if (!response.ok) {
      fail('This code is no longer valid',
        link.message || 'Ask the clinic to show it again.');
      return;
    }
  } catch (_) {
    fail('Could not connect', 'Check your internet and try again.');
    return;
  }

  /* What has been sent, this session. Kept in memory only: the page is
     deliberately unable to ask the server what is already in the record. */
  const sent = [];
  let remaining = link.remaining;

  function paint(busy) {
    wrap.innerHTML =
      '<header class="head">' +
        '<h1>Send your report</h1>' +
        '<p>To <b>' + esc(link.clinicName) + '</b>' +
          (link.patientFirstName
            ? ', for <b>' + esc(link.patientFirstName) + '</b>' : '') + '</p>' +
      '</header>' +

      (sent.length
        ? '<div class="card sent"><h2>Sent</h2><ul>' + sent.map(name =>
            '<li>' + esc(name) + '</li>').join('') + '</ul></div>'
        : '') +

      '<label class="pick' + (busy || remaining <= 0 ? ' off' : '') + '">' +
        '<input type="file" id="pick" accept="image/*,application/pdf" ' +
          'capture="environment" multiple' + (busy ? ' disabled' : '') + ' hidden>' +
        '<span>' + (busy ? 'Sending…'
          : sent.length ? 'Add another page' : 'Take a photo or choose a file') + '</span>' +
      '</label>' +

      '<div id="note" class="note"></div>' +

      '<div class="card guide">' +
        '<p><b>One page per photo.</b> Lay the report flat, fill the frame, ' +
          'and check the numbers are readable before you send.</p>' +
        (remaining > 0
          ? '<p class="small">You can send ' + remaining + ' more.</p>'
          : '<p class="small">That is all this code will take. ' +
            'Ask the clinic to show it again if you have more.</p>') +
      '</div>' +

      '<footer>' +
        '<p>Your doctor checks every page before anything is added to your ' +
          'record.</p>' +
        '<p class="credit">TCOS &middot; A Tharigopula Technologies product</p>' +
      '</footer>';

    const picker = document.getElementById('pick');
    if (picker) picker.addEventListener('change', () => send([...picker.files]));
  }

  const note = (text, kind) => {
    const box = document.getElementById('note');
    if (!box) return;
    box.className = 'note ' + (kind || '');
    box.textContent = text || '';
  };

  /* Files go one at a time rather than in one request. A phone on clinic
     wifi drops connections, and four separate uploads means three pages
     survive a failure on the fourth - where one combined request would
     lose the lot and she would have to photograph everything again. */
  async function send(files) {
    if (!files.length) return;
    paint(true);

    let failed = 0;
    for (const file of files) {
      if (remaining <= 0) break;
      note('Sending ' + file.name + '…');
      const form = new FormData();
      form.append('file', file);
      try {
        const response = await fetch(API + '/u/' + encodeURIComponent(token) + '/file', {
          method: 'POST', body: form
        });
        const answer = await response.json().catch(() => ({}));
        if (!response.ok) {
          failed++;
          note(answer.message || 'That page could not be sent.', 'bad');
          continue;
        }
        sent.push(file.name || 'Page ' + (sent.length + 1));
        remaining = typeof answer.remaining === 'number' ? answer.remaining : remaining - 1;
      } catch (_) {
        failed++;
        note('That page could not be sent. Check your internet.', 'bad');
      }
    }

    paint(false);
    if (!failed) {
      note(sent.length === 1 ? 'Sent. You can close this page.'
        : sent.length + ' pages sent. You can close this page.', 'ok');
    }
  }

  paint(false);
})();

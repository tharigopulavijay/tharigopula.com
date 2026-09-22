/* =========================================================================
   Today.

   This is the first screen of the day and it answers one question: who am I
   seeing, and in what order. Everything else on the old home page was a
   dashboard of numbers nobody acts on.

   Design decisions from how these clinics actually run:

   - Time is optional. Plenty of Indian clinics are walk-in, so the day is a
     LIST, not a grid of fifteen-minute slots. Anyone without a time sits at
     the bottom under "no time set" rather than being forced into 9:00.
   - Arrived, then Seen. Two taps, because that is the whole workflow at a
     reception desk. "Start visit" opens the consultation and marks them seen
     in one go.
   - Yesterday's unfinished appointments are surfaced, not buried. Left
     alone they rot, and the doctor loses track of who never came back.
   ========================================================================= */
(async () => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const el = id => document.getElementById(id);
  const msg = (id, text, kind) => {
    el(id).innerHTML = text
      ? '<div class="notice ' + kind + '" style="max-width:none">' + text + '</div>' : '';
  };
  const todayIso = () => new Date().toISOString().slice(0, 10);
  const prettyDate = v => {
    if (!v) return '';
    const [y, m, d] = String(v).slice(0, 10).split('-').map(Number);
    return new Intl.DateTimeFormat('en-IN',
      { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(y, m - 1, d));
  };
  const prettyTime = t => {
    if (!t) return null;
    const [h, m] = t.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    return (h % 12 || 12) + ':' + String(m).padStart(2, '0') + ' ' + suffix;
  };

  /* Going to the sign-in screen goes through TCOSBoot, which counts the
     hand-overs. The app and the sign-in screen used to be able to bounce
     her between them forever on a session the server no longer honours,
     and neither page ever painted - fifteen minutes of white screen. */
  if (!TCOSApi.isSignedIn()) { TCOSBoot.toSignIn('signed-out'); return; }

  let me, data, patients = [];
  let day = new URLSearchParams(location.search).get('day') || todayIso();

  try { me = await TCOSApi.me(); }
  catch (error) {
    if (error.status === 401) { TCOSBoot.toSignIn('expired'); return; }
    /* Not a sign-in problem: the server is unreachable or broken. Saying so
       on the boot screen matters more than writing it into a page she
       cannot see, because nothing below here ever runs - the rail is never
       painted, so the message used to land on a blank screen. */
    TCOSBoot.failed(error.message);
    msg('pageMsg', esc(error.message), 'error');
    return;
  }
  TCOSRail.paint(me);
  el('welcome').innerHTML = '<h1>Today</h1><p>' + esc(me.clinicName) + '</p>';
  const may = capability => !me.me || !me.me.can || me.me.can.includes(capability);

  try { patients = (await TCOSApi.listPatients()).patients || []; } catch (_) {}

  const STATUS = {
    scheduled: { label: 'Booked', pill: 'trial' },
    arrived:   { label: 'Waiting', pill: 'active' },
    completed: { label: 'Seen', pill: 'active' },
    no_show:   { label: 'Did not come', pill: 'suspended' },
    cancelled: { label: 'Cancelled', pill: 'suspended' }
  };

  function card(a, options = {}) {
    const status = STATUS[a.status] || { label: a.status, pill: 'trial' };
    const time = prettyTime(a.scheduled_at);
    return '<div class="slot ' + esc(a.status) + '">' +
      '<div class="slot-time">' +
        (options.showDate ? '<b>' + esc(prettyDate(a.scheduled_on)) + '</b>' : '') +
        (time ? '<b>' + esc(time) + '</b>' : '<span class="anytime">No time</span>') +
      '</div>' +
      '<div class="slot-who">' +
        '<b>' + esc(a.full_name) + '</b>' +
        '<small>' + esc(a.mobile) +
          (a.reason ? ' · ' + esc(a.reason) : '') +
          (a.source === 'follow_up' ? ' · from a follow-up' : '') + '</small>' +
      '</div>' +
      '<span class="pill ' + status.pill + '">' + esc(status.label) + '</span>' +
      '<div class="slot-do">' + actionsFor(a) + '</div>' +
    '</div>';
  }

  function actionsFor(a) {
    if (a.status === 'scheduled') {
      return '<button class="btn btn-ghost btn-sm" data-arrive="' + esc(a.id) + '">Arrived</button> ' +
        (may('write_notes') ? '<a class="btn btn-primary btn-sm" href="consult.html?patient=' +
          encodeURIComponent(a.patient_id) + '&appointment=' + encodeURIComponent(a.id) +
          '">Start visit</a> ' : '') +
        '<button class="btn btn-ghost btn-sm" data-miss="' + esc(a.id) + '">No show</button>';
    }
    if (a.status === 'arrived') {
      return may('write_notes') ? '<a class="btn btn-primary btn-sm" href="consult.html?patient=' +
        encodeURIComponent(a.patient_id) + '&appointment=' + encodeURIComponent(a.id) +
        '">Start visit</a>' : '';
    }
    return may('read_notes') ? '<a class="btn btn-ghost btn-sm" href="record.html?patient=' +
      encodeURIComponent(a.patient_id) + '">Record</a>' : '';
  }

  /* Two kinds of row arrive in one table, and they are not the same job.
     Somebody who asked for an appointment from the website is a call to
     make later. Somebody who scanned the code at the counter is STANDING
     THERE - she filled the form in herself while she waited, and the only
     thing between her and a seat is this row.

     They are told apart by what she was asked for: the walk-in form asks
     first visit or follow-up and never asks for a date, the website form is
     the other way round. */
  const isWalkIn = request => !!request.visit_type && !request.preferred_on;

  /* Where a booking came from. Her own page and the counter are the ordinary
     cases and carry no badge - labelling everything labels nothing. A badge
     appears only when it tells her something she would otherwise have to
     open another tab to learn. */
  const SOURCE_LABEL = {
    practo: 'Practo', justdial: 'Justdial', google: 'Google',
    whatsapp: 'WhatsApp', phone: 'Phone', other: 'Other'
  };
  const sourceBadge = request => {
    const label = SOURCE_LABEL[request.source];
    return label ? '<span class="pill trial" style="margin-left:6px">' +
      esc(label) + '</span>' : '';
  };

  function requestCard(request) {
    const walkIn = isWalkIn(request);
    const wanted = walkIn
      ? 'At the counter'
      : ([prettyDate(request.preferred_on), prettyTime(request.preferred_time)]
          .filter(Boolean).join(' · ') || 'Clinic to choose a time');

    /* What she typed on her own phone, so nobody has to ask her again
       across a counter. Age and sex were optional and are often blank. */
    const detail = [
      request.mobile,
      request.age_years ? request.age_years + 'y' : '',
      request.sex || '',
      request.reason, request.note
    ].filter(Boolean).join(' · ');

    /* The server matched her number against this clinic's list when she
       submitted. Staff see the answer; she never did - the form is reached
       by a code anybody can photograph, so anything it revealed it would
       reveal to everybody. */
    const tag = !walkIn ? '<span class="pill trial">New request</span>'
      : request.matched_patient_id
        ? '<span class="pill active" title="This number already has a record here. ' +
          'Check at the counter that it is the same person.">Has a record</span>'
        : '<span class="pill info">First visit</span>';

    return '<div class="slot request' + (walkIn ? ' walk-in' : '') + '">' +
      '<div class="slot-time"><b>' + esc(wanted) + '</b>' +
        (walkIn && request.visit_type === 'follow-up'
          ? '<small>Says she has been before</small>' : '') + '</div>' +
      '<div class="slot-who"><b>' + esc(request.full_name) + '</b>' +
        '<small>' + esc(detail) + '</small></div>' +
      sourceBadge(request) +
      tag +
      '<div class="slot-do">' +
        '<button class="btn btn-primary btn-sm" data-accept="' + esc(request.id) +
          '">' + (walkIn ? 'Register' : 'Accept &amp; book') + '</button> ' +
        '<button class="btn btn-ghost btn-sm" data-decline="' + esc(request.id) +
          '">Decline</button>' +
      '</div></div>';
  }


  /* ======================================================================
     The right-hand column.

     Everything here is already on the screen somewhere - a request lower
     down, an appointment nobody closed off, a medicine about to expire. The
     point is not new information, it is that these are the only things on
     Today asking her to DECIDE something, and they were scattered.

     Nothing is invented: each line links to the thing it is about.
     ====================================================================== */

  const ico = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';

  const GLYPH = {
    request:  '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    open:     '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    expiry:   '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    reorder:  '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>',
    calm:     '<path d="M20 6 9 17l-5-5"/>'
  };

  /* Stock lives behind the pharmacy permission. Front desk simply does not
     see those lines, rather than seeing them and being refused. */
  let stockAlerts = null;
  async function loadStock() {
    if (!(me.me && me.me.can && me.me.can.includes('pharmacy')) && me.me) return;
    try {
      const stock = await TCOSApi.stock();
      const now = todayIso();
      stockAlerts = {
        expired: (stock.expiring || []).filter(b => b.expires_on < now),
        soon: (stock.expiring || []).filter(b => b.expires_on >= now),
        low: stock.belowReorder || []
      };
    } catch (_) { stockAlerts = null; }
  }

  function renderAttention() {
    const rows = [];
    const reqs = data.requests || [];
    const stuck = data.unresolved || [];

    if (reqs.length) {
      rows.push({
        kind: 'is-bad', glyph: GLYPH.request, href: '#requests',
        title: reqs.length === 1 ? 'An appointment request' : reqs.length + ' appointment requests',
        detail: 'From your clinic page. Someone is waiting for a call back.',
        action: 'Review'
      });
    }
    if (stuck.length) {
      rows.push({
        kind: 'is-warn', glyph: GLYPH.open, href: '#unresolved',
        title: stuck.length + ' appointment' + (stuck.length === 1 ? '' : 's') + ' never closed off',
        detail: 'Earlier days still marked as booked. Mark them seen or missed.',
        action: 'Close off'
      });
    }
    if (stockAlerts && stockAlerts.expired.length) {
      rows.push({
        kind: 'is-bad', glyph: GLYPH.expiry, href: 'pharmacy.html',
        title: stockAlerts.expired.length + ' expired batch' +
          (stockAlerts.expired.length === 1 ? '' : 'es') + ' on the shelf',
        detail: 'Cannot be dispensed. Write them off.',
        action: 'Pharmacy'
      });
    }
    if (stockAlerts && stockAlerts.soon.length) {
      rows.push({
        kind: 'is-warn', glyph: GLYPH.expiry, href: 'pharmacy.html',
        title: stockAlerts.soon.length + ' expiring within 60 days',
        detail: 'Use or replace these first.',
        action: 'Pharmacy'
      });
    }
    if (stockAlerts && stockAlerts.low.length) {
      rows.push({
        kind: 'is-info', glyph: GLYPH.reorder, href: 'pharmacy.html',
        title: stockAlerts.low.length + ' below reorder level',
        detail: 'Order more before you run out mid-consultation.',
        action: 'Pharmacy'
      });
    }

    el('attentionCount').textContent = rows.length ? rows.length + ' waiting' : 'All clear';

    if (!rows.length) {
      el('attention').innerHTML =
        '<div class="empty" style="padding:30px 20px">' +
        '<span class="calm-tick">' + ico(GLYPH.calm) + '</span>' +
        '<p style="margin:10px 0 0"><b>Nothing waiting on you.</b></p>' +
        '<p style="margin:4px 0 0;color:var(--muted);font-size:.86rem">' +
        'Nothing left open, and the pharmacy shelf is in order.</p></div>';
      TCOSNav.waiting(0);
      return;
    }

    el('attention').innerHTML = '<div class="attention-list">' + rows.map(r =>
      '<a class="attention-row ' + r.kind + '" href="' + r.href + '">' +
        '<span class="chip">' + ico(r.glyph) + '</span>' +
        '<div><b>' + esc(r.title) + '</b><small>' + esc(r.detail) + '</small></div>' +
        '<span class="attention-go">' + esc(r.action) + ' &rarr;</span>' +
      '</a>').join('') + '</div>';
    TCOSNav.waiting(rows.length);
  }

  /* ---------------- quick actions ---------------- */

  function renderQuick() {
    const can = (me.me && me.me.can) ? c => me.me.can.includes(c) : () => true;
    const tiles = [
      ['patients.html', 'patients', 'Find or add a patient',
        'Search by number, name or ' + esc(me.patientPrefix || 'clinic') + ' number', 'patients'],
      ['#book', 'today', 'Book an appointment', 'Into your own diary', 'appointments'],
      ['pharmacy.html', 'pharmacy', 'Receive stock', 'Add a batch with its expiry', 'pharmacy'],
      ['practice.html', 'practice', 'Clinic setup', 'Hours, verification and prescription identity', 'settings']
    ].filter(t => can(t[4]));

    el('quickActions').innerHTML = tiles.map(([href, icon, title, detail]) =>
      '<a class="quick-tile" href="' + href + '" data-quick="' + icon + '">' +
        '<span class="quick-icon" data-icon="' + icon + '"></span>' +
        '<div><b>' + esc(title) + '</b><small>' + esc(detail) + '</small></div>' +
      '</a>').join('');

    /* "Book" is a dialog on this page, not a link away from it. */
    const book = document.querySelector('[href="#book"]');
    if (book) book.addEventListener('click', event => {
      event.preventDefault();
      el('bookBtn').click();
    });
  }

  el('queueTabs').addEventListener('click', event => {
    const button = event.target.closest('[data-queue]');
    if (!button) return;
    document.querySelectorAll('#queueTabs button').forEach(b => b.classList.toggle('active', b === button));
    document.querySelectorAll('[data-queue-panel]').forEach(panel =>
      panel.classList.toggle('active', panel.dataset.queuePanel === button.dataset.queue));
  });

  /* ---------------- the week ---------------- */

  function renderWeek() {
    const rows = data.week || [];
    const byDay = new Map(rows.map(r => [r.day, r]));

    /* Every day in the range, including the empty ones. A gap in a bar chart
       is information; a missing bar just looks like a rendering fault. */
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.parse(day) - i * 864e5).toISOString().slice(0, 10);
      const row = byDay.get(d) || { booked: 0, seen: 0, missed: 0 };
      days.push({ date: d, ...row });
    }

    const peak = Math.max(1, ...days.map(d => d.booked));
    const total = days.reduce((n, d) => n + d.booked, 0);
    const seen = days.reduce((n, d) => n + Number(d.seen || 0), 0);
    el('weekNote').textContent = total
      ? total + ' booked · ' + seen + ' seen' : 'Nothing booked this week';

    el('weekChart').innerHTML = days.map(d => {
      const label = new Intl.DateTimeFormat('en-IN', { weekday: 'short' })
        .format(new Date(d.date + 'T00:00:00'));
      const height = Math.round((d.booked / peak) * 100);
      return '<div class="week-col' + (d.date === day ? ' is-today' : '') + '"' +
        ' title="' + esc(prettyDate(d.date)) + ': ' + d.booked + ' booked">' +
        '<span class="week-value">' + (d.booked || '') + '</span>' +
        '<span class="week-bar"><i style="height:' + Math.max(height, d.booked ? 6 : 0) + '%"></i></span>' +
        '<span class="week-day">' + esc(label) + '</span></div>';
    }).join('');
  }

  function render() {
    el('dayLabel').textContent = day === todayIso() ? 'Today, ' + prettyDate(day) : prettyDate(day);
    el('dayPicker').value = day;

    const list = data.today || [];
    const waiting = list.filter(a => a.status === 'arrived').length;
    const seen = list.filter(a => a.status === 'completed').length;
    const booked = list.filter(a => a.status === 'scheduled').length;
    el('todayCount').textContent = list.length;
    el('requestCount').textContent =
      (data.requests || []).length + (data.unresolved || []).length;
    el('upcomingCount').textContent = (data.upcoming || []).length;

    const tile = (kind, icon, label, value, note) =>
      '<div class="stat ' + kind + '">' +
        '<span class="chip">' + icon + '</span>' +
        '<div class="stat-text"><span>' + label + '</span><b>' + value + '</b>' +
        (note ? '<small>' + note + '</small>' : '') + '</div>' +
      '</div>';

    el('daySummary').innerHTML =
      tile('', "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M8 2v4M16 2v4M3 10h18\"/><rect x=\"3\" y=\"4\" width=\"18\" height=\"18\" rx=\"2\"/></svg>", 'Booked', list.length,
        booked ? booked + ' still to come' : 'Nothing left to come') +
      tile('is-warn', "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/></svg>", 'Waiting', waiting,
        waiting ? 'Sitting outside now' : 'Nobody waiting') +
      tile('is-info', "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20 6 9 17l-5-5\"/></svg>", 'Seen', seen,
        list.length ? seen + ' of ' + list.length + ' done' : '') +
      tile((data.unresolved || []).length ? 'is-warn' : '',
        "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z\"/></svg>", 'Follow-up gaps',
        (data.unresolved || []).length,
        (data.unresolved || []).length ? 'Earlier appointments to close' : 'Nothing left open');

    renderAttention();
    renderQuick();
    renderWeek();

    el('dayList').innerHTML = list.length
      ? list.map(a => card(a)).join('')
      : '<div class="empty">Nothing booked for this day. ' +
        'Walk-ins can be added straight from Patients.</div>';

    /* Requests from the public page come first: someone is waiting for a
       call back, and nothing enters the diary until the doctor says so. */
    const requests = data.requests || [];

    /* Where the last month's bookings came from, and how many she kept.
       Shown only once a platform other than her own page has sent something -
       a doctor with one source does not need a breakdown of one.

       The accepted share is the number that matters: a platform sending
       fifty bookings she declines is costing her a fee for nothing, and
       until now that was invisible. */
    const outside = ((data.sources && data.sources.sources) || [])
      .filter(s => s.source !== 'website' && s.total > 0);
    const breakdown = outside.length
      ? '<div class="body" style="padding-top:0">' +
        '<small class="muted">Last 30 days · ' +
        outside.map(s => esc(s.label) + ' ' + esc(s.total) +
          ' (' + esc(s.acceptedPercent) + '% accepted)').join(' · ') +
        '</small></div>'
      : '';

    el('requests').innerHTML = requests.length
      ? '<div class="panel warn-panel"><header><h2>' + requests.length +
        ' appointment request' + (requests.length === 1 ? '' : 's') +
        ' waiting</h2></header>' + breakdown + '<div class="body-list">' +
        requests.map(requestCard).join('') + '</div></div>'
      : '';

    const overdue = data.unresolved || [];
    el('unresolved').innerHTML = overdue.length
      ? '<div class="panel warn-panel"><header><h2>' + overdue.length +
        ' earlier appointment' + (overdue.length === 1 ? '' : 's') +
        ' never closed off</h2></header>' +
        '<div class="body-list">' + overdue.map(a => card(a, { showDate: true })).join('') +
        '</div></div>'
      : '';

    const soon = data.upcoming || [];
    el('upcoming').innerHTML = soon.length
      ? '<div class="panel"><header><h2>Coming up</h2><div class="spacer"></div>' +
        '<span class="muted">next 14 days</span></header>' +
        '<div class="body-list">' + soon.map(a => card(a, { showDate: true })).join('') +
        '</div></div>'
      : '';

    wire();
  }

  function wire() {
    document.querySelectorAll('[data-arrive]').forEach(b =>
      b.addEventListener('click', () => setStatus(b.dataset.arrive, 'arrived')));
    document.querySelectorAll('[data-accept]').forEach(b =>
      b.addEventListener('click', async () => {
        try {
          const result = await TCOSApi.acceptRequest(b.dataset.accept, {});
          await load();
          msg('pageMsg', esc(result.patient.full_name) +
            ' added and booked for ' + esc(prettyDate(result.appointment.scheduled_on)) +
            '. Call them to confirm.', 'ok');
        } catch (error) { msg('pageMsg', esc(error.message), 'error'); }
      }));

    document.querySelectorAll('[data-decline]').forEach(b =>
      b.addEventListener('click', async () => {
        if (!confirm('Decline this request?')) return;
        try { await TCOSApi.declineRequest(b.dataset.decline); await load(); }
        catch (error) { msg('pageMsg', esc(error.message), 'error'); }
      }));

    document.querySelectorAll('[data-miss]').forEach(b =>
      b.addEventListener('click', () => {
        if (!confirm('Mark as did not come?')) return;
        setStatus(b.dataset.miss, 'no_show');
      }));
  }

  async function setStatus(id, status) {
    try { await TCOSApi.setAppointmentStatus(id, status); await load(); }
    catch (error) { msg('pageMsg', esc(error.message), 'error'); }
  }

  async function load() {
    try {
      data = await TCOSApi.appointments(day);
      if (stockAlerts === null) await loadStock();
      render();
      noticeArrivals();
    } catch (error) {
      msg('pageMsg', esc(error.message), 'error');
    }
  }

  /* ======================================================================
     Somebody has just registered at the counter.

     Vijay: "attender gets the notification." The row already lands in the
     requests list, but a list nobody is looking at is not a notification -
     the front desk is dealing with the person in front of them and would
     find her when they next happened to refresh, which might be after she
     has given up and asked out loud, which is the thing the QR was for.

     So the screen watches for new rows and says so out loud: a banner that
     stays until somebody looks, a count in the browser tab so it carries
     while the attender is in another tab, and a short chime.

     WHY POLLING AND NOT PUSH. A push notification needs a service worker, a
     permission the attender has to grant, and a subscription per device
     that has to be kept alive. This screen is open on the desk all day and
     already talks to the API; a request every twenty seconds costs nothing
     and works on the machine that is actually in the room. Push is worth
     building when somebody needs telling while this screen is closed, and
     that is not the case being solved here.
     ====================================================================== */

  const POLL_MS = 20000;
  /* Seeded on the first load rather than left empty, so opening the screen
     in the morning does not chime once for every request that came in
     overnight. Only what arrives while she is watching is new. */
  let known = null;
  let unseen = 0;
  const baseTitle = document.title;

  const soundOn = () => {
    try { return localStorage.getItem('tcos.arrival.sound') !== 'off'; }
    catch (_) { return true; }
  };

  /* Two short notes, synthesised. No audio file, no CDN: the CSP allows
     media from nowhere, and a doorbell is not worth widening it for.

     Browsers refuse to make sound until the page has been interacted with,
     so this may silently do nothing on a screen nobody has clicked. That is
     acceptable because the banner and the tab count are the notification -
     the chime is what makes somebody look up, not what tells them. */
  let audio = null;
  function chime() {
    if (!soundOn()) return;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      audio = audio || new Ctor();
      if (audio.state === 'suspended') audio.resume();
      [[880, 0], [1174, 0.16]].forEach(([hz, at]) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = 'sine';
        osc.frequency.value = hz;
        gain.gain.setValueAtTime(0.0001, audio.currentTime + at);
        gain.gain.exponentialRampToValueAtTime(0.16, audio.currentTime + at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + at + 0.15);
        osc.connect(gain).connect(audio.destination);
        osc.start(audio.currentTime + at);
        osc.stop(audio.currentTime + at + 0.18);
      });
    } catch (_) { /* no sound is not a failure worth reporting */ }
  }

  function noticeArrivals() {
    const requests = data.requests || [];
    const ids = new Set(requests.map(r => r.id));

    if (known === null) { known = ids; return; }

    const fresh = requests.filter(r => !known.has(r.id));
    known = ids;
    /* A row that was handled and is gone must not leave a stale count
       behind, so the banner is rebuilt from what is actually pending. */
    if (!requests.length) { unseen = 0; clearArrivals(); return; }
    if (!fresh.length) return;

    unseen += fresh.length;
    document.title = '(' + unseen + ') ' + baseTitle;
    chime();

    const names = fresh.map(r => r.full_name).filter(Boolean);
    const who = names.length === 1 ? esc(names[0])
      : names.length === 2 ? esc(names[0]) + ' and ' + esc(names[1])
      : esc(names[0]) + ' and ' + (names.length - 1) + ' others';
    const counter = fresh.some(isWalkIn);

    el('arrivals').innerHTML =
      '<div class="arrival-alert">' +
        '<span class="arrival-dot"></span>' +
        '<div class="arrival-text"><b>' + who +
          (fresh.length === 1 ? ' has' : ' have') +
          (counter ? ' registered at the counter.' : ' asked for an appointment.') +
          '</b>' +
          (counter ? '<small>Waiting to be called.</small>' : '') +
        '</div>' +
        '<button class="btn btn-primary btn-sm" id="arrivalShow">Open</button>' +
        '<button class="btn btn-ghost btn-sm" id="arrivalMute" ' +
          'title="Stop the chime on this computer">' +
          (soundOn() ? 'Sound off' : 'Sound on') + '</button>' +
        '<button class="btn btn-ghost btn-sm" id="arrivalHide" ' +
          'aria-label="Dismiss">&times;</button>' +
      '</div>';

    el('arrivalShow').addEventListener('click', () => {
      const tab = document.querySelector('#queueTabs [data-queue="requests"]');
      if (tab) tab.click();
      clearArrivals();
    });
    el('arrivalHide').addEventListener('click', clearArrivals);
    el('arrivalMute').addEventListener('click', () => {
      try {
        localStorage.setItem('tcos.arrival.sound', soundOn() ? 'off' : 'on');
      } catch (_) { /* private window: the setting just does not stick */ }
      el('arrivalMute').textContent = soundOn() ? 'Sound off' : 'Sound on';
    });
  }

  function clearArrivals() {
    unseen = 0;
    document.title = baseTitle;
    el('arrivals').innerHTML = '';
  }

  /* Only while the screen is being looked at and only on today. Polling a
     day in the past for arrivals is asking a question with no answer, and
     polling a hidden tab is spending a clinic's connection on nothing. */
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    if (day !== todayIso()) return;
    load();
  }, POLL_MS);

  /* Coming back to the tab is the moment to catch up, without waiting out
     the rest of the interval. */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && day === todayIso()) load();
  });

  /* ---- booking ---- */
  const dialog = el('bookDialog');
  el('bookBtn').addEventListener('click', () => {
    msg('bookMsg', '');
    el('bookForm').reset();
    el('bPatient').innerHTML = patients.map(p =>
      '<option value="' + esc(p.id) + '">' + esc(p.full_name) + ' — ' + esc(p.mobile) + '</option>').join('');
    el('bDate').value = day;
    dialog.showModal();
  });
  el('bookCancel').addEventListener('click', () => dialog.close());
  el('bookClose').addEventListener('click', () => dialog.close());

  el('bookForm').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      await TCOSApi.bookAppointment({
        patientId: el('bPatient').value,
        scheduledOn: el('bDate').value,
        scheduledAt: el('bTime').value || null,
        reason: el('bReason').value.trim() || null
      });
      dialog.close();
      await load();
      msg('pageMsg', 'Appointment booked.', 'ok');
    } catch (error) { msg('bookMsg', esc(error.message), 'error'); }
  });

  el('dayPicker').addEventListener('change', event => { day = event.target.value; load(); });
  el('prevDay').addEventListener('click', () => { day = shift(day, -1); load(); });
  el('nextDay').addEventListener('click', () => { day = shift(day, 1); load(); });
  el('todayBtn').addEventListener('click', () => { day = todayIso(); load(); });
  const shift = (iso, by) => {
    const d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + by);
    return d.toISOString().slice(0, 10);
  };

  el('signOutBtn').addEventListener('click', async () => {
    await TCOSApi.signOut(); location.href = 'tcos-login.html';
  });

  await load();
})();

/* =========================================================================
   The doctor's public clinic page.

   One template. Doctor 10,000 renders through exactly this code, from one
   row. Nothing is written per doctor.

   The page has one job: turn a stranger into an appointment request. So the
   order is what a person deciding whether to visit actually needs -
   who is this doctor, what do they treat, where are they, how do I book -
   and the form is never more than one scroll away.

   The services come from the practice packs the doctor already ticked on
   "My practice". They fill in nothing to get this page.
   ========================================================================= */
(async () => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const page = document.getElementById('page');

  /* On the clinic's OWN address the Worker serves both this page and the
     API, so the calls below are same-origin and need neither CORS nor a
     cross-origin hole in that page's Content-Security-Policy. `data-slug`
     is stamped only by that path, so its presence is what says where we
     are. Everywhere else - the platform address - the API is elsewhere. */
  const API = page.dataset.slug ? '' : 'https://tcos-api.hello-tharigopula.workers.dev';

  /* Three ways in, in order of authority:

     data-slug   the clinic's OWN address - drdevi.com, or her free
                 subdomain. The Worker resolved the host to a clinic and
                 stamped the answer here, because at that address the path
                 is "/" and there is nothing in the URL to read. An
                 attribute rather than an inline script, so the page needs
                 no per-slug hash in its Content-Security-Policy.
     ?c=slug     the platform address, which is what the Web screen hands
                 out today.
     last path   a path the Worker rewrote. */
  const params = new URLSearchParams(location.search);
  const slug = page.dataset.slug ||
    params.get('c') ||
    location.pathname.replace(/^\/+|\/+$/g, '').split('/').pop();

  const fail = (title, detail) => {
    page.innerHTML = '<div class="notfound"><h1>' + esc(title) + '</h1>' +
      '<p>' + esc(detail) + '</p></div>';
  };

  if (!slug || slug === 'clinic.html') {
    fail('No clinic here', 'Check the web address you were given.');
    return;
  }

  let clinic;
  try {
    const response = await fetch(API + '/clinic/' + encodeURIComponent(slug));
    clinic = await response.json();
    if (!response.ok) {
      fail('No clinic page at this address', 'Check the link, or ask the clinic for it again.');
      return;
    }
  } catch (_) {
    fail('Could not load this page', 'Check your connection and try again.');
    return;
  }

  document.title = clinic.clinicName;

  /* What they treat, from the packs on their practice profile. Each pack
     gets a plain-language line, because a patient does not know what
     "Nadi Pariksha" means until you tell them. */
  const SERVICE_COPY = {
    nadi: ['Nadi Pariksha', 'Traditional pulse reading to understand what your body is doing before treatment begins.'],
    ayurveda: ['Ayurvedic treatment', 'Classical formulations — kashayam, choorna, arishta — prepared and prescribed for your constitution.'],
    acupuncture: ['Acupuncture & acupressure', 'Fine-needle and pressure-point therapy, most often for pain, sleep and stress.'],
    chiropractic: ['Chiropractic care', 'Hands-on spinal and joint work for back, neck and posture problems.'],
    yoga: ['Therapeutic yoga', 'Asana and pranayama prescribed for your condition, not a general class.'],
    physiotherapy: ['Physiotherapy', 'Structured exercise and modalities to restore movement after injury or surgery.'],
    referral: ['Onward referral', 'Referral to a specialist when that is the right thing for you.']
  };

  const registry = window.ClinicRegistry;
  const services = (clinic.practicePacks || []).map(id => {
    const copy = SERVICE_COPY[id];
    if (copy) return { title: copy[0], body: copy[1] };
    const pack = registry && registry.PRACTICE_PACKS[id];
    return pack ? { title: pack.label, body: '' } : null;
  }).filter(Boolean);

  const mapsHref = clinic.address
    ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(clinic.address)
    : null;
  const telHref = clinic.phone ? 'tel:' + clinic.phone.replace(/\s/g, '') : null;

  page.innerHTML =
    '<header class="hero">' +
      '<div class="hero-inner">' +
        '<div class="mark">' + esc(clinic.clinicName.charAt(0)) + '</div>' +
        '<h1>' + esc(clinic.clinicName) + '</h1>' +
        (clinic.tagline ? '<p class="tagline">' + esc(clinic.tagline) + '</p>' : '') +
        '<p class="who">' + esc(clinic.doctor) +
          (clinic.qualification ? ' · ' + esc(clinic.qualification) : '') + '</p>' +
        '<div class="hero-do">' +
          '<a class="cta" href="#book">Request an appointment</a>' +
          (telHref ? '<a class="cta ghost" href="' + esc(telHref) + '">Call the clinic</a>' : '') +
        '</div>' +
      '</div>' +
    '</header>' +

    (clinic.intro
      ? '<section class="intro"><p>' + esc(clinic.intro) + '</p></section>' : '') +

    (services.length
      ? '<section class="services">' +
          '<h2>What we treat</h2>' +
          '<div class="service-grid">' + services.map(s =>
            '<div class="service"><h3>' + esc(s.title) + '</h3>' +
            (s.body ? '<p>' + esc(s.body) + '</p>' : '') + '</div>').join('') +
          '</div>' +
        '</section>'
      : '') +

    '<section class="visit">' +
      '<h2>Visiting us</h2>' +
      '<div class="visit-grid">' +
        (clinic.address
          ? '<div class="fact"><span>Clinic</span><b>' + esc(clinic.address) + '</b>' +
            (mapsHref ? '<a href="' + esc(mapsHref) + '" target="_blank" rel="noopener">Open in Maps</a>' : '') +
            '</div>' : '') +
        (clinic.hours
          ? '<div class="fact"><span>Timings</span><b>' + esc(clinic.hours) + '</b></div>' : '') +
        (clinic.phone
          ? '<div class="fact"><span>Phone</span><b>' + esc(clinic.phone) + '</b>' +
            '<a href="' + esc(telHref) + '">Call now</a></div>' : '') +
        (clinic.registrationNo
          ? '<div class="fact"><span>Registration</span><b>' + esc(clinic.registrationNo) + '</b></div>' : '') +
      '</div>' +
    '</section>' +

    '<section class="book" id="book">' +
      '<h2>Request an appointment</h2>' +
      '<p class="book-note">Leave your details and the clinic will call you back to confirm a time. ' +
        'Nothing is booked until they do.</p>' +
      '<div id="bookMsg"></div>' +
      '<form id="bookForm">' +
        '<label>Your name<input id="fName" required autocomplete="name"></label>' +
        '<label>Mobile number<input id="fMobile" required inputmode="numeric" autocomplete="tel" ' +
          'placeholder="9876543210"></label>' +
        '<div class="two">' +
          '<label>Preferred day<input id="fDate" type="date"></label>' +
          '<label>Preferred time<input id="fTime" type="time"></label>' +
        '</div>' +
        '<label>What is it about?<input id="fReason" placeholder="Back pain, follow-up, general consultation…"></label>' +
        '<button type="submit" id="fSubmit">Send request</button>' +
      '</form>' +
    '</section>' +

    '<footer>' +
      '<p>' + esc(clinic.clinicName) + (clinic.address ? ' · ' + esc(clinic.address) : '') + '</p>' +
      (clinic.showsCredit
        ? '<p class="credit"><span class="tc">TC</span> Powered by TCOS · Tharigopula Clinical OS</p>'
        : '') +
    '</footer>';

  const msg = (text, kind) => {
    document.getElementById('bookMsg').innerHTML = text
      ? '<div class="msg ' + kind + '">' + text + '</div>' : '';
  };

  document.getElementById('bookForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.getElementById('fSubmit');
    button.disabled = true;
    button.textContent = 'Sending…';
    msg('');
    try {
      const response = await fetch(API + '/clinic/' + encodeURIComponent(slug) + '/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: document.getElementById('fName').value,
          mobile: document.getElementById('fMobile').value,
          preferredOn: document.getElementById('fDate').value || null,
          preferredTime: document.getElementById('fTime').value || null,
          reason: document.getElementById('fReason').value || null
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not send that.');
      document.getElementById('bookForm').hidden = true;
      msg('<b>Request sent.</b> ' + esc(data.clinicName) +
        ' will call you back to confirm a time.', 'ok');
    } catch (error) {
      msg(esc(error.message), 'error');
      button.disabled = false;
      button.textContent = 'Send request';
    }
  });
})();

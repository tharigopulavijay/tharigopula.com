(() => {
  const el = id => document.getElementById(id);
  const esc = value => String(value == null ? '' : value).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const money = paise => '₹' + (Number(paise || 0) / 100).toLocaleString('en-IN');
  const date = value => value ? new Date(value).toLocaleDateString('en-IN',
    { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const message = (text, tone = 'info') => {
    el('pageMsg').innerHTML = text
      ? '<div class="notice ' + tone + '" style="max-width:none">' + esc(text) + '</div>' : '';
  };

  let me;
  let data;

  /* One name for a plan, from the catalogue, so the panel and the cards
     cannot call the same plan two different things. There was a second
     hardcoded map here; practice.html had a third, and its copy was wrong. */
  const planName = plan =>
    ((window.TCOSPlans.PLANS[plan] || {}).name) ||
    (plan === 'clinic' ? window.TCOSPlans.PLANS.pro.name : plan);

  /* WHAT SHE IS ACTUALLY ON. Entitlement comes from planStatus, which is
     what the Worker enforces her limits against - never from the
     subscription row, which can name a plan she has not paid for. */
  const livePlan = () => (me && me.planStatus && me.planStatus.plan) || 'basic';

  /* Started, but no money has moved. Razorpay says `created` before the
     first charge and `authenticated` once a mandate exists but the first
     payment has not settled. Neither is a plan she has. */
  const unpaid = () => !!data.subscription &&
    ['created', 'authenticated'].includes(data.subscription.status);

  /* Over: cancelled, completed or expired. A dead subscription is not a
     subscription, and this panel kept rendering one - Vijay's cancelled
     ₹8,990 still showed as "Plan: Practice ... Paid access through 12 Sept
     2026 ... Renews automatically", every word of it false.

     "No one asked whether it is pending or what. Just show the plan." */
  const finished = () => !!data.subscription &&
    ['cancelled', 'completed', 'expired'].includes(data.subscription.status);

  /* Paid access she still has, even from a subscription she has stopped -
     she bought the period and keeps it. Null or past means she does not. */
  const stillPaidFor = () => {
    const until = data.subscription && data.subscription.accessUntil;
    return !!until && new Date(until) > new Date();
  };

  function paintStatus() {
    const sub = data.subscription;
    if (!data.configured) {
      el('subscriptionState').textContent = 'Setup in progress';
      el('subscriptionState').className = 'pill trial';
      el('subscriptionBody').innerHTML = '<div class="notice info" style="max-width:none">' +
        'Online payments are being connected. Your present plan is unchanged.</div>';
      return;
    }
    /* A finished subscription with no paid time left is history, not status.
       Shown as simply the plan she is on, which is what she asked for. */
    if (sub && finished() && !stillPaidFor()) {
      const onFree = livePlan() === 'basic';
      el('subscriptionState').textContent = planName(livePlan());
      el('subscriptionState').className = 'pill active';
      el('subscriptionBody').innerHTML = '<p style="margin:0">' +
        (onFree
          ? 'You are on <b>Free</b>. Choose a paid plan below when you are ready.'
          : 'You are on <b>' + esc(planName(livePlan())) + '</b>.') +
        '</p>';
      return;
    }

    if (!sub) {
      /* `me.plan` does not exist and never did - it read undefined, so this
         always took the "assigned by the TCOS team" branch and told a doctor
         on Free that somebody had put her there by hand. */
      const onFree = livePlan() === 'basic';
      el('subscriptionState').textContent = onFree ? 'Free' : 'Managed plan';
      el('subscriptionState').className = 'pill active';
      el('subscriptionBody').innerHTML = '<p style="margin:0">' +
        (onFree
          ? 'You are on Free. Choose a paid plan below when you are ready.'
          : 'Your current plan was assigned by the TCOS team. Starting online billing will make renewals automatic.') +
        '</p>';
      return;
    }

    const good = sub.status === 'active';

    /* This panel said "Plan: Practice ... Renews automatically" about a
       subscription nobody had paid a rupee for, while the card below it
       correctly showed Free as the current plan. Two halves of one screen
       contradicting each other, and the half that was wrong was the
       reassuring one.

       A started-but-unpaid subscription is an INTENTION, not a plan. It is
       now described as one. */
    /* Unpaid: the pill names the plan she is ACTUALLY on, which is Free.
       It read "Payment not finished", and before that the raw Razorpay
       status - both of which describe a checkout rather than her account. */
    el('subscriptionState').textContent = good ? 'Active'
      : unpaid() ? planName(livePlan())
      : sub.status;
    el('subscriptionState').className = 'pill ' +
      (good || unpaid() ? 'active' : 'trial');

    const action = sub.checkoutUrl && unpaid()
      ? '<a class="btn btn-primary" href="' + esc(sub.checkoutUrl) + '" target="_blank" rel="noopener">Continue secure payment ↗</a>'
      : '';
    /* Cancelling used to be offered only on an ACTIVE subscription, so a
       doctor who started the wrong plan could neither finish it nor drop
       it - and `start` refuses to open a second one. Stuck, on a screen
       whose whole purpose is to take her money. */
    const cancel = (good && !sub.cancelAtCycleEnd)
      ? '<button class="btn btn-ghost btn-sm" id="cancelSubscription">Stop renewal at period end</button>'
      : unpaid()
        ? '<button class="btn btn-ghost btn-sm" id="cancelSubscription">Cancel and choose a different plan</button>'
        : '';

    const third = unpaid()
      ? '<div class="stat"><span>Your plan right now</span><strong>' +
          esc(planName(livePlan())) + '</strong><small>until this payment succeeds</small></div>'
      : '<div class="stat"><span>Paid access through</span><strong>' +
          esc(date(sub.accessUntil || sub.currentEnd)) + '</strong><small>' +
          (sub.cancelAtCycleEnd ? 'Renewal will stop' : 'Renews automatically') + '</small></div>';

    /* Unpaid means she is on Free, and the panel now leads with that rather
       than with the plan she nearly bought. Vijay: "if he has not paid, jump
       into free." The unfinished checkout is a footnote she can pick up or
       ignore - not the headline, and no longer a wall. */
    el('subscriptionBody').innerHTML = unpaid()
      ? '<p style="margin:0 0 12px">You are on <b>' + esc(planName(livePlan())) +
          '</b>. Nothing has been charged.</p>' +
        '<div class="notice info" style="max-width:none;margin:0">' +
          'You started ' + esc(planName(sub.plan)) + ' ' + esc(sub.cadence) +
          ' (' + money(sub.pricePaise) + ') and did not finish paying. ' +
          'Pick it up below, or just choose a different plan &mdash; ' +
          'the unfinished one is dropped for you.</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">' + action +
          '<button class="btn btn-ghost btn-sm" id="refreshSubscription">Refresh payment status</button>' +
          cancel + '</div>'

      : '<div class="stat-row">' +
          '<div class="stat"><span>Plan</span><strong>' + esc(planName(sub.plan)) +
            '</strong><small>' + esc(sub.cadence) + '</small></div>' +
          '<div class="stat"><span>Price</span><strong>' + money(sub.pricePaise) +
            '</strong><small>per ' + (sub.cadence === 'yearly' ? 'year' : 'month') + '</small></div>' +
          third +
        '</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">' + action +
          '<button class="btn btn-ghost btn-sm" id="refreshSubscription">Refresh payment status</button>' +
          cancel + '</div>';

    const refresh = el('refreshSubscription');
    if (refresh) refresh.addEventListener('click', refreshStatus);
    const stop = el('cancelSubscription');
    if (stop) stop.addEventListener('click', cancelSubscription);
  }

  /* ======================================================================
     The plans.

     This used to be a name, a price and a Choose button - which asks a
     doctor to spend ₹2,199 a month on faith. Vijay: "payment should not be
     a payment, it should show what they would be getting."

     WHERE EVERY NUMBER COMES FROM. The price is the row the API returns,
     because that is the figure Razorpay will actually charge. The ticks are
     the feature list in js/tcos-plans.js, which exists precisely so that
     only built things are sold - six features were struck off it once for
     being sold before they existed. The patient, doctor, staff and reading
     numbers are the limits migration 030 ENFORCES, so a card cannot promise
     a seat the software will refuse at the counter. That has happened here
     before: the page said "unlimited doctors" while the database stopped at
     twenty-five.

     test/plan-page.test.js fails if any of those drift apart.
     ====================================================================== */

  let cadence = 'monthly';

  const count = n => Number(n).toLocaleString('en-IN');
  const storage = mb => mb >= 1024 ? Math.round(mb / 1024) + ' GB' : mb + ' MB';
  const seats = (n, one, many) => n === 1 ? '1 ' + one : count(n) + ' ' + many;

  /* What the plan is for, in the doctor's own terms, built from the limits
     the software holds her to rather than from an adjective. */
  const scope = plan => {
    const l = plan.limits || {};
    return [
      seats(l.doctors || 1, 'doctor', 'doctors'),
      seats(l.staff || 1, 'staff login', 'staff logins'),
      /* null means not metered. Patients stopped being a limit on
         11 September 2026 - they cost us nothing, so charging for them was
         charging for something we do not pay for, and the doctor it stopped
         first was the one with the busiest clinic. */
      (l.activePatients == null ? 'unlimited patients'
        : count(l.activePatients) + ' patients')
    ].join(' · ');
  };

  /* Yearly is ten months' money for twelve months' access. Computed from
     the two real prices rather than asserted, so it cannot say "2 months
     free" after somebody changes one of them. */
  function yearlySaving(planKey) {
    const monthly = (data.plans || []).find(p => p.plan === planKey && p.cadence === 'monthly');
    const yearly = (data.plans || []).find(p => p.plan === planKey && p.cadence === 'yearly');
    if (!monthly || !yearly) return null;
    const saved = monthly.price_paise * 12 - yearly.price_paise;
    if (saved <= 0) return null;
    return { paise: saved, months: Math.round(saved / monthly.price_paise) };
  }

  function featureList(ui, comparedTo) {
    const P = window.TCOSPlans;
    const have = new Set(ui.features || []);
    const below = new Set((comparedTo && comparedTo.features) || []);
    return (ui.features || []).map(key => {
      const isNew = comparedTo && !below.has(key);
      return '<li' + (isNew ? ' class="is-new"' : '') + '>' +
        '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 5"/></svg>' +
        esc(P.FEATURE_LABEL[key] || key) + '</li>';
    }).join('') + (have.size ? '' : '');
  }

  function planCard(ui, priceRow, current) {
    const isCurrent = current === ui.id;
    const free = ui.id === 'basic';
    const saving = cadence === 'yearly' ? yearlySaving(ui.id) : null;

    /* Free has no row in the payment catalogue - it is not something you
       buy - so its price comes from the plan definition. */
    const paise = free ? 0 : (priceRow ? priceRow.price_paise : null);
    const per = cadence === 'yearly' ? 'per year' : 'per month';

    const price = free
      ? '<strong>Free</strong><span class="plan-per">for ever, not a trial</span>'
      : paise == null
        ? '<strong class="plan-soon">—</strong><span class="plan-per">not available</span>'
        : '<strong>' + money(paise) + '</strong><span class="plan-per">' + per + '</span>';

    const order = window.TCOSPlans.PLAN_ORDER;
    const previous = order[order.indexOf(ui.id) - 1];
    const comparedTo = previous ? window.TCOSPlans.PLANS[previous] : null;

    /* The plan she started and did not pay for. Its card offers to finish
       the checkout she already has.

       EVERY OTHER CARD STAYS LIVE. They were disabled for one release
       because the server refused a second subscription, and Vijay was
       rightly furious: "people not paying does not mean they are not
       paying, they may upgrade - why are you not giving that choice?"
       Someone who opened a ₹899 checkout and came back wanting Clinic is
       the best thing that happens on this screen. The server now drops the
       unpaid one and opens the new one; the screen no longer has to
       apologise for it. */
    const pending = unpaid() && data.subscription.plan === ui.id &&
      data.subscription.cadence === cadence;

    const action = pending
      ? '<a class="btn btn-primary btn-full" href="' + esc(data.subscription.checkoutUrl || '#') +
        '" target="_blank" rel="noopener">Finish payment ↗</a>'
      : isCurrent
        ? '<button class="btn btn-ghost btn-full" disabled>Your plan</button>'
        : free
          ? '<button class="btn btn-ghost btn-full" disabled>Included</button>'
          : '<button class="btn btn-primary btn-full" data-plan="' + esc(ui.id) + '"' +
            (!data.configured || paise == null ? ' disabled' : '') + '>' +
            (current && order.indexOf(ui.id) < order.indexOf(current)
              ? 'Move to ' + esc(ui.name) : 'Choose ' + esc(ui.name)) + '</button>';

    return '<article class="plan' + (isCurrent ? ' is-current' : '') +
        (pending ? ' is-pending' : '') + '">' +
      (isCurrent ? '<span class="plan-badge">Current</span>' : '') +
      (pending ? '<span class="plan-badge pending">Started, not paid</span>' : '') +
      '<h3>' + esc(ui.name) + '</h3>' +
      '<p class="plan-tagline">' + esc(ui.tagline) + '</p>' +
      '<div class="plan-price">' + price + '</div>' +
      (saving ? '<p class="plan-saving">Saves ' + money(saving.paise) +
        ' &mdash; about ' + saving.months + ' months free</p>' : '') +
      '<p class="plan-scope">' + esc(scope(ui)) + '</p>' +
      '<p class="plan-pitch">' + esc(ui.pitch) + '</p>' +
      (comparedTo ? '<p class="plan-adds">Everything in ' + esc(comparedTo.name) + ', plus</p>' : '') +
      '<ul class="plan-features">' + featureList(ui, comparedTo) + '</ul>' +
      '<dl class="plan-limits">' +
        '<div><dt>Patients</dt><dd>' +
          (ui.limits.activePatients == null
            ? '<span class="plan-unmetered">Unlimited</span>'
            : count(ui.limits.activePatients)) + '</dd></div>' +
        '<div><dt>File storage</dt><dd>' + storage(ui.limits.storageMb) + '</dd></div>' +
        '<div><dt>Report reads</dt><dd>' +
          (ui.limits.aiRuns ? count(ui.limits.aiRuns) + ' a month' : 'Not included') + '</dd></div>' +
      '</dl>' +
      /* Last, so every card's button lines up along the bottom whatever the
         feature list above it does. It sat under the pitch at first and the
         four buttons stepped down the row like a staircase. */
      action +
    '</article>';
  }

  /* Bigger than Group. There is no number to put on this card and no
     button that could take money, because the answer is a conversation:
     seats and terms get agreed one at a time. So it offers the only honest
     thing - a way to start that conversation - and it raises a real support
     request rather than opening a mail client and hoping. */
  function contactCard(plan) {
    return '<article class="plan plan-contact">' +
      '<h3>' + esc(plan.name) + '</h3>' +
      '<p class="plan-tagline">' + esc(plan.tagline) + '</p>' +
      '<div class="plan-price"><strong>Custom</strong>' +
        '<span class="plan-per">agreed with you</span></div>' +
      '<p class="plan-scope">' + esc(plan.scope) + '</p>' +
      '<p class="plan-pitch">' + esc(plan.pitch) + '</p>' +
      '<ul class="plan-features">' + (plan.points || []).map(point =>
        '<li><svg viewBox="0 0 16 16" aria-hidden="true">' +
        '<path d="M3 8.5l3.2 3.2L13 5"/></svg>' + esc(point) + '</li>').join('') +
      '</ul>' +
      '<button class="btn btn-secondary btn-full" id="talkToUs">' +
        esc(plan.cta) + '</button>' +
    '</article>';
  }

  function paintPlans() {
    const P = window.TCOSPlans;
    /* The plan she is actually on, from planStatus - which is what the
       Worker enforces her limits against. `me.plan` does not exist; reading
       it returned undefined and quietly marked nobody as current. */
    const current = (me && me.planStatus && me.planStatus.plan) || null;
    const priced = (data.plans || []).filter(plan => plan.cadence === cadence);

    el('planCards').innerHTML = P.PLAN_ORDER
      .map(id => P.PLANS[id])
      .filter(Boolean)
      .map(ui => planCard(ui, priced.find(row => row.plan === ui.id), current))
      .join('') + contactCard(P.CONTACT_PLAN);

    document.querySelectorAll('[data-plan]').forEach(button =>
      button.addEventListener('click', () => start(button.dataset.plan, cadence, button)));
    el('talkToUs').addEventListener('click', () => {
      el('enquiryForm').reset();
      el('enquiryMsg').innerHTML = '';
      el('enquiryDialog').showModal();
      el('enquiryDetail').focus();
    });
  }

  /* The enquiry. It goes through POST /support - the same queue the owner
     console already reads and replies in - so it lands somewhere a person
     actually looks, and she can see her own thread afterwards. A mailto:
     link would have been less code and would have gone nowhere we can
     track; there has been one of those on this product before. */
  async function sendEnquiry(event) {
    event.preventDefault();
    const detail = el('enquiryDetail').value.trim();
    if (!detail) {
      el('enquiryMsg').innerHTML =
        '<div class="notice error">Tell us a little about the practice first.</div>';
      return;
    }
    const button = el('enquirySend');
    button.disabled = true;
    button.textContent = 'Sending…';
    try {
      await TCOSApi.createSupportRequest({
        subject: 'Enterprise plan enquiry',
        message: 'Doctors: ' + (el('enquiryDoctors').value.trim() || 'not said') +
          '\nLocations: ' + (el('enquiryPlaces').value.trim() || 'not said') +
          '\n\n' + detail
      });
      el('enquiryDialog').close();
      message('Thank you — your enquiry is with us. You can follow it on the ' +
        'Support screen, and we will come back to you there.', 'ok');
    } catch (error) {
      el('enquiryMsg').innerHTML =
        '<div class="notice error">' + esc(error.message) + '</div>';
    } finally {
      button.disabled = false;
      button.textContent = 'Send enquiry';
    }
  }

  async function start(plan, cadence, button) {
    button.disabled = true;
    message('Creating your secure payment page…');
    try {
      const result = await TCOSApi.startSubscription({ plan, cadence });
      data.subscription = result.subscription;
      paintStatus();
      message('Payment page ready. Complete it in the new tab; TCOS will activate automatically.', 'ok');
      if (result.subscription.checkoutUrl) {
        window.open(result.subscription.checkoutUrl, '_blank', 'noopener');
      }
    } catch (error) {
      message(error.message, 'error');
      button.disabled = false;
    }
  }

  async function refreshStatus() {
    message('Checking directly with Razorpay…');
    try {
      data.subscription = (await TCOSApi.refreshSubscription()).subscription;
      paintStatus();
      message(data.subscription.status === 'active'
        ? 'Payment confirmed. Your plan is active now.'
        : 'Status refreshed. No unconfirmed payment was treated as successful.', 'ok');
    } catch (error) { message(error.message, 'error'); }
  }

  async function cancelSubscription() {
    if (!confirm('Stop automatic renewal at the end of the paid period? Your records will be retained.')) return;
    try {
      data.subscription = (await TCOSApi.cancelSubscription()).subscription;
      paintStatus();
      message('Renewal will stop at the end of the paid period.', 'ok');
    } catch (error) { message(error.message, 'error'); }
  }

  async function load() {
    try {
      me = await TCOSApi.me();
      TCOSRail.paint(me);
      data = await TCOSApi.subscription();
      paintStatus();
      paintPlans();

      /* Monthly / Yearly. Two buttons rather than a dropdown: it is a
         comparison she makes by flicking between them, and a select hides
         the yearly saving behind a click she has no reason to make. */
      el('enquiryForm').addEventListener('submit', sendEnquiry);
      el('enquiryClose').addEventListener('click', () => el('enquiryDialog').close());

      el('cadenceToggle').addEventListener('click', event => {
        const button = event.target.closest('[data-cadence]');
        if (!button || button.dataset.cadence === cadence) return;
        cadence = button.dataset.cadence;
        el('cadenceToggle').querySelectorAll('[data-cadence]').forEach(b =>
          b.classList.toggle('on', b === button));
        paintPlans();
      });
    } catch (error) {
      if (error.status === 401) location.href = 'tcos-login.html';
      else message(error.message, 'error');
    }
  }

  load();
})();

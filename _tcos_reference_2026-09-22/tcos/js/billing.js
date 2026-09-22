/* =========================================================================
   Billing.

   Money is handled as integer paise everywhere except the moment it is put
   on screen or read out of an input. Doing arithmetic on rupees as floats is
   how a day's takings stop matching the cash box by one paisa, for reasons
   nobody can find afterwards.

   A bill behaves like a prescription on purpose: a draft is editable, issuing
   assigns a gap-free number and freezes it, and a mistake is cancelled with a
   stated reason rather than quietly rewritten.
   ========================================================================= */
(async () => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const el = id => document.getElementById(id);
  const msg = (id, text, kind) => {
    el(id).innerHTML = text
      ? '<div class="notice ' + kind + '" style="max-width:none">' + text + '</div>' : '';
  };

  /* paise -> "₹1,250.00". One direction only. */
  const money = paise => '₹' + (Number(paise || 0) / 100)
    .toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  /* "1250.50" -> 125050. Rounded once, here, and never again. */
  const toPaise = rupees => Math.round((Number(rupees) || 0) * 100);

  const iso = d => d.toISOString().slice(0, 10);
  const prettyDate = v => {
    if (!v) return '—';
    const [y, m, d] = String(v).slice(0, 10).split('-').map(Number);
    if (!y) return v;
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      .format(new Date(y, m - 1, d));
  };

  if (!TCOSApi.isSignedIn()) { TCOSBoot.toSignIn('signed-out'); return; }

  let me;
  try { me = await TCOSApi.me(); }
  catch (error) {
    if (error.status === 401) { location.replace('tcos-login.html'); return; }
    msg('pageMsg', esc(error.message), 'error'); return;
  }
  TCOSNav.paint('billing.html', me);

  /* Past bills stay readable and reprintable; raising a new one does not. */
  window.TCOSGate.apply(me, {
    feature: 'billing',
    actions: ['#newBillBtn']
  });
  const product = window.TCOSProducts.resolve(me);

  const today = new Date();
  let from = iso(new Date(today - 29 * 864e5));
  let to = iso(today);
  let status = 'all';
  let data = { invoices: [], summary: {}, daily: [], fees: [] };
  let draft = null;            /* the bill being written */
  let viewing = null;          /* the bill being looked at */
  let patients = [];

  el('fromDate').value = from;
  el('toDate').value = to;

  /* ------------------------------ the money ----------------------------- */

  const svg = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';

  function paintTiles() {
    const s = data.summary || {};
    const tile = (kind, icon, label, value, note) =>
      '<div class="stat ' + kind + '"><span class="chip">' + icon + '</span>' +
      '<div class="stat-text"><span>' + label + '</span><b class="money">' + value + '</b>' +
      '<small>' + note + '</small></div></div>';

    el('moneyTiles').innerHTML =
      tile('', svg('<path d="M6 3h12M6 8h12M9 13c6 0 6 8 0 8M6 13h9"/>'),
        'Billed', money(s.billed), (s.issuedCount || 0) + ' bills issued') +
      tile('is-info', svg('<path d="M20 6 9 17l-5-5"/>'),
        'Collected', money(s.collected), (s.paymentCount || 0) + ' payments') +
      tile((s.outstanding ? 'is-warn' : ''), svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
        'Outstanding', money(s.outstanding),
        s.unpaidCount ? s.unpaidCount + ' bills, all time' : 'Nothing owed') +
      tile((s.draftCount ? 'is-bad' : ''), svg('<path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
        'Drafts', String(s.draftCount || 0), 'Not yet given to anyone');
  }

  function paintDaily() {
    const rows = data.daily || [];
    const byDay = new Map(rows.map(r => [r.day, r.amount]));
    const days = [];
    /* The last seven days of the range, so the strip is always the same
       width whatever period she picked. */
    for (let i = 6; i >= 0; i--) {
      const d = iso(new Date(Date.parse(to) - i * 864e5));
      days.push({ date: d, amount: byDay.get(d) || 0 });
    }
    const peak = Math.max(1, ...days.map(d => d.amount));
    const week = days.reduce((n, d) => n + d.amount, 0);
    el('dailyNote').textContent = week ? money(week) + ' this week' : 'Nothing this week';

    el('dailyChart').innerHTML = days.map(d => {
      const label = new Intl.DateTimeFormat('en-IN', { weekday: 'short' })
        .format(new Date(d.date + 'T00:00:00'));
      const h = Math.round(d.amount / peak * 100);
      return '<div class="week-col' + (d.date === to ? ' is-today' : '') + '" title="' +
        esc(prettyDate(d.date)) + ': ' + money(d.amount) + '">' +
        '<span class="week-value">' + (d.amount ? Math.round(d.amount / 100) : '') + '</span>' +
        '<span class="week-bar"><i style="height:' + Math.max(h, d.amount ? 6 : 0) + '%"></i></span>' +
        '<span class="week-day">' + esc(label) + '</span></div>';
    }).join('');
  }

  const METHODS = { cash: 'Cash', upi: 'UPI / clinic QR', card: 'Card', bank: 'Bank transfer', other: 'Other' };

  function paintMethods() {
    const rows = (data.summary || {}).byMethod || [];
    if (!rows.length) { el('methodSplit').innerHTML = '<div class="empty">Nothing collected yet.</div>'; return; }
    const total = rows.reduce((n, r) => n + r.amount, 0) || 1;
    el('methodSplit').innerHTML = rows.map(r =>
      '<div class="method-row"><div class="method-top">' +
        '<b>' + esc(METHODS[r.method] || r.method) + '</b>' +
        '<span class="money">' + money(r.amount) + '</span></div>' +
      '<span class="method-bar"><i style="width:' + Math.round(r.amount / total * 100) + '%"></i></span>' +
      '<small>' + r.n + (r.n === 1 ? ' payment' : ' payments') + '</small></div>').join('');
  }

  /* ------------------------------ the list ------------------------------ */

  function paintInvoices() {
    const rows = status === 'all' ? data.invoices
      : data.invoices.filter(i => i.status === status);

    if (!rows.length) {
      el('invoiceTable').innerHTML = '<div class="empty">' +
        (data.invoices.length ? 'No bills with that status in this period.'
          : 'No bills in this period yet.') + '</div>';
      return;
    }

    el('invoiceTable').innerHTML =
      /* `cards` and the data-labels below are the phone layout: eight
         columns became a sideways strip where you could see whose bill it
         was or whether it was paid, never both. See css/tcos.css. */
      '<table class="grid cards"><thead><tr><th>Bill</th><th>Patient</th><th>Date</th>' +
      '<th class="right">Total</th><th class="right">Paid</th><th>Status</th><th></th></tr></thead><tbody>' +
      rows.map(i => {
        const balance = i.total - (i.paid || 0);
        const state = i.status === 'cancelled'
          ? '<span class="pill suspended">Cancelled</span>'
          : i.status === 'draft'
            ? '<span class="pill trial">Draft</span>'
            : balance <= 0
              ? '<span class="pill active">Paid</span>'
              : (i.paid ? '<span class="pill info">Part paid</span>'
                : '<span class="pill trial">Unpaid</span>');
        return '<tr data-open="' + esc(i.id) + '">' +
          '<td data-card-title><b class="mono">' + esc(i.invoice_no || 'Draft') + '</b></td>' +
          '<td data-label="Patient"><div class="clinic-cell"><span class="fallback">' +
            esc((i.full_name || '?').charAt(0).toUpperCase()) + '</span>' +
            '<div><b>' + esc(i.full_name) + '</b><small>' +
            esc(i.local_ref || i.mobile || '') + '</small></div></div></td>' +
          '<td data-label="Date">' + esc(prettyDate(i.issued_on || i.created_at)) + '</td>' +
          '<td class="right money" data-label="Total">' + money(i.total) + '</td>' +
          '<td class="right money" data-label="Paid">' + (i.paid ? money(i.paid) : '—') + '</td>' +
          '<td data-label="Status">' + state + '</td>' +
          '<td class="right actions" data-label=""><button class="btn btn-ghost btn-sm">Open</button></td>' +
        '</tr>';
      }).join('') + '</tbody></table>';

    document.querySelectorAll('[data-open]').forEach(row =>
      row.addEventListener('click', () => openInvoice(row.dataset.open)));
  }

  async function load() {
    try { data = await TCOSApi.invoices({ from, to }); }
    catch (error) { msg('pageMsg', esc(error.message), 'error'); return; }
    paintTiles(); paintDaily(); paintMethods(); paintInvoices();
  }

  /* -------------------------- writing a bill ---------------------------- */

  const billDialog = el('billDialog');

  async function openNew() {
    msg('billMsg', '');
    draft = null;
    el('pickPatient').hidden = false;
    el('billBody').hidden = true;
    el('saveDraft').hidden = true;
    el('issueBill').hidden = true;
    el('billTitle').textContent = 'New bill';
    el('billPatientSearch').value = '';
    el('billPatientResults').innerHTML = '';
    billDialog.showModal();
    if (!patients.length) {
      try { patients = (await TCOSApi.listPatients()).patients || []; } catch (_) { /* shown on search */ }
    }
    el('billPatientSearch').focus();
  }

  el('billPatientSearch').addEventListener('input', event => {
    const term = event.target.value.trim().toLowerCase();
    const digits = term.replace(/\D/g, '');
    const hits = !term ? [] : patients.filter(p =>
      (p.full_name || '').toLowerCase().includes(term) ||
      (p.local_ref || '').toLowerCase().includes(term) ||
      (digits.length >= 3 && String(p.mobile || '').replace(/\D/g, '').includes(digits)))
      .slice(0, 6);

    el('billPatientResults').innerHTML = hits.length
      ? hits.map(p => '<button type="button" class="pick-row" data-pick="' + esc(p.id) + '">' +
          '<span class="fallback">' + esc((p.full_name || '?').charAt(0).toUpperCase()) + '</span>' +
          '<div><b>' + esc(p.full_name) + '</b><small>' +
          esc([p.local_ref, p.mobile].filter(Boolean).join(' · ')) + '</small></div></button>').join('')
      : (term ? '<div class="empty">Nobody on your list matches that.</div>' : '');

    document.querySelectorAll('[data-pick]').forEach(b =>
      b.addEventListener('click', () => startDraft(b.dataset.pick)));
  });

  async function startDraft(patientId) {
    try {
      draft = (await TCOSApi.createInvoice({ patientId })).invoice;
    } catch (error) { msg('billMsg', esc(error.message), 'error'); return; }
    el('pickPatient').hidden = true;
    el('billBody').hidden = false;
    el('saveDraft').hidden = false;
    el('issueBill').hidden = false;
    el('billFor').innerHTML =
      '<span class="fallback">' + esc((draft.full_name || '?').charAt(0).toUpperCase()) + '</span>' +
      '<div><b>' + esc(draft.full_name) + '</b><small>' +
      esc([draft.local_ref, draft.mobile].filter(Boolean).join(' · ')) + '</small></div>';

    el('feePicker').innerHTML = '<option value="">Add from your fee list…</option>' +
      (data.fees || []).map(f => '<option value="' + esc(f.id) + '">' +
        esc(f.description) + ' — ' + money(f.unit_price) + '</option>').join('');

    el('billLines').innerHTML = '';
    addLine({ kind: 'consultation', description: 'Consultation', quantity: 1, unitPrice: 0 });
    recalc();
  }

  const KINDS = ['consultation', 'medicine', 'procedure', 'lab', 'other'];

  function addLine(values) {
    const row = document.createElement('div');
    row.className = 'line-row';
    row.innerHTML =
      '<input class="l-desc" placeholder="What is this for" value="' +
        esc(values && values.description || '') + '">' +
      '<select class="l-kind">' + KINDS.map(k =>
        '<option value="' + k + '"' + (values && values.kind === k ? ' selected' : '') + '>' +
        k.charAt(0).toUpperCase() + k.slice(1) + '</option>').join('') + '</select>' +
      '<input class="l-qty" type="number" min="0" step="any" value="' +
        (values && values.quantity != null ? values.quantity : 1) + '">' +
      '<input class="l-rate" type="number" min="0" step="0.01" value="' +
        (values && values.unitPrice ? (values.unitPrice / 100).toFixed(2) : '') + '">' +
      '<span class="l-amount money">₹0.00</span>' +
      /* The moment she notices she is typing the same charge again is while
         she is on this line, not later in a settings screen. Only shown to
         someone who may edit the list. */
      '<button type="button" class="l-keep" title="Save this to my fee list" hidden>+</button>' +
      '<button type="button" class="l-del" title="Remove">×</button>';
    el('billLines').appendChild(row);
    row.querySelector('.l-del').addEventListener('click', () => { row.remove(); recalc(); });
    row.querySelectorAll('input, select').forEach(i => i.addEventListener('input', recalc));

    const keep = row.querySelector('.l-keep');
    keep.hidden = !canEditFees;
    keep.addEventListener('click', async () => {
      const description = row.querySelector('.l-desc').value.trim();
      const rupees = Number(row.querySelector('.l-rate').value);
      if (!description) return msg('billMsg', 'Give the line a name before saving it.', 'error');
      if (!(rupees > 0)) return msg('billMsg', 'Put the amount in before saving it.', 'error');
      keep.disabled = true;
      try {
        await TCOSApi.addFee({
          kind: row.querySelector('.l-kind').value,
          description,
          /* Integer paise, like every other amount in TCOS. */
          unitPrice: Math.round(rupees * 100)
        });
        await refreshFees();
        keep.textContent = '✓';
        msg('billMsg', esc(description) + ' saved to your fee list.', 'ok');
      } catch (error) {
        msg('billMsg', esc(error.message), 'error');
        keep.disabled = false;
      }
    });
  }

  el('addLine').addEventListener('click', () => { addLine({}); recalc(); });

  /* ---- the fee list --------------------------------------------------
     Managing it needs practice settings, so a front desk who may raise
     bills can USE the list and cannot rewrite it. The picker stays for
     everyone; only the editing disappears. */
  const canEditFees = !me.me || me.me.isDoctor || (me.me.can || []).includes('settings');

  const feeDialog = el('feeDialog');

  function paintPicker() {
    el('feePicker').innerHTML = '<option value="">Add from your fee list…</option>' +
      (data.fees || []).map(f => '<option value="' + esc(f.id) + '">' +
        esc(f.description) + ' — ' + money(f.unit_price) + '</option>').join('');
  }

  async function refreshFees() {
    try {
      /* Only the fee list is re-read. Re-rendering the whole billing screen
         because she added a charge would close the bill she is in the
         middle of writing. */
      const fresh = await TCOSApi.invoices({ from, to });
      data.fees = fresh.fees || [];
    } catch (_) { /* keep whatever we had rather than emptying the picker */ }
    paintPicker();
    paintFeeList();
  }

  function paintFeeList() {
    const list = data.fees || [];
    el('feeList').innerHTML = list.length
      ? list.map(f =>
          '<div class="fee-item"><div><b>' + esc(f.description) + '</b>' +
          '<small>' + esc(f.kind) + '</small></div>' +
          '<span class="money">' + money(f.unit_price) + '</span>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-drop-fee="' +
            esc(f.id) + '">Remove</button></div>').join('')
      : '<div class="empty">Nothing saved yet. Add the charges you raise most often.</div>';

    el('feeList').querySelectorAll('[data-drop-fee]').forEach(button =>
      button.addEventListener('click', async () => {
        button.disabled = true;
        try { await TCOSApi.removeFee(button.dataset.dropFee); await refreshFees(); }
        catch (error) { msg('feeMsg', esc(error.message), 'error'); button.disabled = false; }
      }));
  }

  if (canEditFees) {
    el('manageFees').hidden = false;
    el('feeKind').innerHTML = KINDS.map(k =>
      '<option value="' + k + '">' + k.charAt(0).toUpperCase() + k.slice(1) + '</option>').join('');

    el('manageFees').addEventListener('click', () => {
      msg('feeMsg', '');
      paintFeeList();
      feeDialog.showModal();
    });
    el('feeClose').addEventListener('click', () => feeDialog.close());
    el('feeDone').addEventListener('click', () => feeDialog.close());

    el('feeForm').addEventListener('submit', async event => {
      event.preventDefault();
      msg('feeMsg', '');
      const rupees = Number(el('feeAmount').value);
      if (!(rupees > 0)) return msg('feeMsg', 'Enter the amount.', 'error');
      el('feeAdd').disabled = true;
      try {
        await TCOSApi.addFee({
          kind: el('feeKind').value,
          description: el('feeDesc').value.trim(),
          unitPrice: Math.round(rupees * 100)
        });
        el('feeForm').reset();
        await refreshFees();
      } catch (error) { msg('feeMsg', esc(error.message), 'error'); }
      finally { el('feeAdd').disabled = false; }
    });
  }

  el('feePicker').addEventListener('change', event => {
    const fee = (data.fees || []).find(f => f.id === event.target.value);
    if (!fee) return;
    addLine({ kind: fee.kind, description: fee.description, quantity: 1, unitPrice: fee.unit_price });
    event.target.value = '';
    recalc();
  });

  const readLines = () => Array.from(document.querySelectorAll('.line-row')).map(row => ({
    kind: row.querySelector('.l-kind').value,
    description: row.querySelector('.l-desc').value.trim(),
    quantity: Number(row.querySelector('.l-qty').value) || 0,
    unitPrice: toPaise(row.querySelector('.l-rate').value)
  })).filter(l => l.description);

  /* The screen does the same arithmetic the server will, so she is never
     shown a total that changes when she saves. */
  function recalc() {
    let subtotal = 0;
    document.querySelectorAll('.line-row').forEach(row => {
      const amount = Math.round((Number(row.querySelector('.l-qty').value) || 0) *
        toPaise(row.querySelector('.l-rate').value));
      row.querySelector('.l-amount').textContent = money(amount);
      subtotal += amount;
    });
    const discount = Math.min(toPaise(el('tDiscount').value), subtotal);
    const taxable = subtotal - discount;
    const tax = Math.round(taxable * (Number(el('tTaxRate').value) || 0) / 100);
    el('tSubtotal').textContent = money(subtotal);
    el('tTotal').textContent = money(taxable + tax);
  }
  el('tDiscount').addEventListener('input', recalc);
  el('tTaxRate').addEventListener('input', recalc);

  async function saveDraft() {
    return TCOSApi.updateInvoice(draft.id, {
      items: readLines(),
      discount: toPaise(el('tDiscount').value),
      taxRate: Number(el('tTaxRate').value) || 0,
      note: el('billNote').value.trim() || null
    });
  }

  el('saveDraft').addEventListener('click', async () => {
    try { await saveDraft(); billDialog.close(); await load();
      msg('pageMsg', 'Saved as a draft. Nobody has been given it yet.', 'ok'); }
    catch (error) { msg('billMsg', esc(error.message), 'error'); }
  });

  el('issueBill').addEventListener('click', async () => {
    if (!readLines().length) { msg('billMsg', 'Add at least one line first.', 'error'); return; }
    if (!confirm('Issue this bill?\n\nIt gets a number and cannot be edited afterwards. ' +
      'A mistake would have to be cancelled and raised again.')) return;
    el('issueBill').disabled = true;
    try {
      await saveDraft();
      const issued = (await TCOSApi.issueInvoice(draft.id)).invoice;
      billDialog.close();
      await load();
      openInvoice(issued.id);
    } catch (error) { msg('billMsg', esc(error.message), 'error'); }
    finally { el('issueBill').disabled = false; }
  });

  el('billCancel').addEventListener('click', () => billDialog.close());
  el('billClose').addEventListener('click', () => billDialog.close());
  el('newBillBtn').addEventListener('click', openNew);

  /* ---------------------------- looking at one -------------------------- */

  const viewDialog = el('viewDialog');

  async function openInvoice(id) {
    msg('viewMsg', '');
    el('viewBody').innerHTML = '<div class="empty">Loading…</div>';
    viewDialog.showModal();
    try { viewing = (await TCOSApi.invoice(id)).invoice; }
    catch (error) { msg('viewMsg', esc(error.message), 'error'); return; }

    /* A draft reopens for editing rather than pretending to be a document. */
    if (viewing.status === 'draft') {
      viewDialog.close();
      draft = viewing;
      msg('billMsg', '');
      el('billTitle').textContent = 'Draft bill';
      el('pickPatient').hidden = true;
      el('billBody').hidden = false;
      el('saveDraft').hidden = false;
      el('issueBill').hidden = false;
      el('billFor').innerHTML =
        '<span class="fallback">' + esc((viewing.full_name || '?').charAt(0).toUpperCase()) + '</span>' +
        '<div><b>' + esc(viewing.full_name) + '</b><small>' +
        esc([viewing.local_ref, viewing.mobile].filter(Boolean).join(' · ')) + '</small></div>';
      el('feePicker').innerHTML = '<option value="">Add from your fee list…</option>' +
        (data.fees || []).map(f => '<option value="' + esc(f.id) + '">' +
          esc(f.description) + ' — ' + money(f.unit_price) + '</option>').join('');
      el('billLines').innerHTML = '';
      viewing.items.forEach(i => addLine({
        kind: i.kind, description: i.description, quantity: i.quantity, unitPrice: i.unit_price
      }));
      if (!viewing.items.length) addLine({});
      el('tDiscount').value = (viewing.discount / 100).toFixed(2);
      el('tTaxRate').value = viewing.tax_rate;
      el('billNote').value = viewing.note || '';
      recalc();
      billDialog.showModal();
      return;
    }

    const cancelled = viewing.status === 'cancelled';
    el('viewTitle').textContent = viewing.invoice_no;
    el('viewCancelBill').hidden = cancelled || viewing.paid > 0;
    el('viewPay').hidden = cancelled || viewing.balance <= 0;

    el('viewBody').innerHTML =
      (cancelled ? '<div class="notice error" style="max-width:none">' +
        'Cancelled — ' + esc(viewing.cancel_reason || '') + '</div>' : '') +
      '<div class="doc" id="printArea">' +
        '<div class="doc-head">' +
          '<div><b>' + esc(me.clinicName) + '</b>' +
          (me.address ? '<small>' + esc(me.address) + '</small>' : '') + '</div>' +
          '<div class="doc-no"><b>' + esc(viewing.invoice_no) + '</b>' +
          '<small>' + esc(prettyDate(viewing.issued_on)) + '</small></div>' +
        '</div>' +
        '<div class="doc-for"><b>' + esc(viewing.full_name) + '</b>' +
          '<small>' + esc([viewing.local_ref, viewing.mobile].filter(Boolean).join(' · ')) + '</small></div>' +
        '<table class="grid doc-lines"><thead><tr><th>Description</th>' +
          '<th class="right">Qty</th><th class="right">Rate</th><th class="right">Amount</th>' +
        '</tr></thead><tbody>' +
        viewing.items.map(i => '<tr><td>' + esc(i.description) + '</td>' +
          '<td class="right">' + i.quantity + '</td>' +
          '<td class="right money">' + money(i.unit_price) + '</td>' +
          '<td class="right money">' + money(i.amount) + '</td></tr>').join('') +
        '</tbody></table>' +
        '<div class="doc-totals">' +
          '<div class="row"><span>Subtotal</span><b class="money">' + money(viewing.subtotal) + '</b></div>' +
          (viewing.discount ? '<div class="row"><span>Discount</span><b class="money">−' +
            money(viewing.discount) + '</b></div>' : '') +
          (viewing.tax_amount ? '<div class="row"><span>Tax at ' + viewing.tax_rate +
            '%</span><b class="money">' + money(viewing.tax_amount) + '</b></div>' : '') +
          '<div class="row total"><span>Total</span><b class="money">' + money(viewing.total) + '</b></div>' +
          '<div class="row"><span>Paid</span><b class="money">' + money(viewing.paid) + '</b></div>' +
          '<div class="row balance"><span>Balance</span><b class="money">' +
            money(viewing.balance) + '</b></div>' +
        '</div>' +
        (viewing.note ? '<p class="doc-note">' + esc(viewing.note) + '</p>' : '') +
        '<p class="doc-foot">' + esc(product.name) +
          ' · A Tharigopula Technologies product</p>' +
      '</div>' +
      (viewing.payments.length
        ? '<h4 class="pay-head">Payments</h4><table class="grid"><tbody>' +
          viewing.payments.map(p => '<tr><td>' + esc(prettyDate(p.received_on)) + '</td>' +
            '<td>' + esc(METHODS[p.method] || p.method) + '</td>' +
            '<td>' + esc(p.reference || '') + '</td>' +
            '<td class="right money">' + money(p.amount) + '</td></tr>').join('') +
          '</tbody></table>'
        : '');
  }

  el('viewClose').addEventListener('click', () => viewDialog.close());
  el('viewPrint').addEventListener('click', () => window.print());

  el('viewCancelBill').addEventListener('click', async () => {
    const reason = prompt('Why is this bill being cancelled?\n\n' +
      'It stays on the record with the reason - the number is never reused.');
    if (!reason) return;
    try {
      await TCOSApi.cancelInvoice(viewing.id, reason);
      viewDialog.close();
      await load();
      msg('pageMsg', 'Bill cancelled.', 'ok');
    } catch (error) { msg('viewMsg', esc(error.message), 'error'); }
  });

  /* ------------------------------ payments ------------------------------ */

  const payDialog = el('payDialog');
  let paymentAttemptKey = null;

  el('viewPay').addEventListener('click', () => {
    paymentAttemptKey = crypto.randomUUID();
    msg('payMsg', '');
    el('payForm').reset();
    el('payOwed').textContent = money(viewing.balance) + ' still owed on ' + viewing.invoice_no;
    el('payAmount').value = (viewing.balance / 100).toFixed(2);
    el('payDate').value = iso(new Date());
    el('payMethods').innerHTML = Object.entries(METHODS).map(([id, label], i) =>
      '<label class="pay-method"><input type="radio" name="method" value="' + id + '"' +
      (i === 0 ? ' checked' : '') + '><span>' + label + '</span></label>').join('');
    el('qrOption').hidden = true;
    el('payMethods').querySelectorAll('input').forEach(input => input.addEventListener('change', () => {
      el('qrOption').hidden = input.value !== 'upi';
      el('payRef').placeholder = input.value === 'card' ? 'Card last 4 digits / terminal reference' : 'UPI reference or receipt number';
    }));
    viewDialog.close();
    payDialog.showModal();
  });

  el('payCancel').addEventListener('click', () => payDialog.close());
  el('payClose').addEventListener('click', () => payDialog.close());

  el('payForm').addEventListener('submit', async event => {
    event.preventDefault();
    const method = document.querySelector('input[name="method"]:checked');
    el('paySave').disabled = true;
    try {
      await TCOSApi.addPayment(viewing.id, {
        amount: toPaise(el('payAmount').value),
        method: method ? method.value : 'cash',
        reference: el('payRef').value.trim() || null,
        receivedOn: el('payDate').value,
        /* Reused for every retry of this open payment box. The API and the
           database use it to make one click exactly one receipt. */
        idempotencyKey: paymentAttemptKey
      });
      payDialog.close();
      await load();
      await openInvoice(viewing.id);
    } catch (error) { msg('payMsg', esc(error.message), 'error'); }
    finally { el('paySave').disabled = false; }
  });

  /* ------------------------------- filters ------------------------------ */

  document.querySelectorAll('#statusTabs button').forEach(tab =>
    tab.addEventListener('click', () => {
      document.querySelectorAll('#statusTabs button').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      status = tab.dataset.status;
      paintInvoices();
    }));

  const reload = async () => {
    from = el('fromDate').value || from;
    to = el('toDate').value || to;
    await load();
  };
  el('fromDate').addEventListener('change', reload);
  el('toDate').addEventListener('change', reload);

  await load();
})();

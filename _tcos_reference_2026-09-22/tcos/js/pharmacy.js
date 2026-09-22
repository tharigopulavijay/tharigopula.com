/* =========================================================================
   Pharmacy.

   A doctor opens this page for one of two reasons: to hand something over,
   or to find out what to order. So the page leads with what needs attention
   and keeps dispensing one click from every row.

   The most dangerous state in a pharmacy is expired stock still showing a
   quantity - it tells you that you have medicine you must not give. That
   gets the loudest treatment on the page and a one-click write-off.

   Deliberately not built: purchase orders, suppliers, costing. A single
   practice orders by phone. Those belong to the clinic product, if ever.
   ========================================================================= */
(async () => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const el = id => document.getElementById(id);
  const msg = (id, text, kind) => {
    el(id).innerHTML = text
      ? '<div class="notice ' + kind + '" style="max-width:none">' + text + '</div>' : '';
  };
  const today = () => new Date().toISOString().slice(0, 10);
  const num = n => Number(n || 0).toLocaleString('en-IN');

  if (!TCOSApi.isSignedIn()) { TCOSBoot.toSignIn('signed-out'); return; }

  let me, data = { items: [], expiring: [], belowReorder: [] }, patients = [];
  const expanded = new Set();
  let itemAttemptKey = null;
  let receiveAttemptKey = null;
  let dispenseAttemptKey = null;

  try { me = await TCOSApi.me(); }
  catch (error) {
    if (error.status === 401) { location.replace('tcos-login.html'); return; }
    msg('pageMsg', esc(error.message), 'error');
    return;
  }
  TCOSRail.paint(me);

  /* Off the plan: the lists below still fill, because her stock and her
     expiry dates are her records. Only the buttons that would add
     something are turned off, with the reason on the screen. */
  window.TCOSGate.apply(me, {
    feature: 'pharmacy',
    actions: ['#addItemBtn', '#receiveBtn']
  });

  try { patients = (await TCOSApi.listPatients()).patients || []; } catch (_) {}
  el('dPatient').innerHTML = '<option value="">Not for a patient</option>' +
    patients.map(p => '<option value="' + esc(p.id) + '">' +
      esc(p.full_name) + ' — ' + esc(p.mobile) + '</option>').join('');

  /* ---------------- alerts ---------------- */

  function renderAlerts() {
    const now = today();
    const expired = data.expiring.filter(b => b.expires_on < now);
    const soon = data.expiring.filter(b => b.expires_on >= now);
    const low = data.belowReorder;

    const card = (kind, icon, count, title, detail) =>
      '<div class="stat ' + (count ? kind : '') + '">' +
        '<span class="chip">' + icon + '</span>' +
        '<div class="stat-text"><span>' + esc(title) + '</span><b>' + count + '</b>' +
        '<small>' + esc(detail) + '</small></div>' +
      '</div>';

    el('alerts').innerHTML =
      card('', "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"2\" y=\"7\" width=\"20\" height=\"14\" rx=\"2\"/><path d=\"M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M12 11v6M9 14h6\"/></svg>", (data.items || []).length, 'On your shelf',
        'Medicines you stock') +
      card('is-info', "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 17l6-6 4 4 8-8\"/><path d=\"M21 7v6h-6\"/></svg>", low.length, 'Below reorder',
        low.length ? 'Order more of these' : 'All above reorder level') +
      card('is-warn', "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/></svg>", soon.length, 'Expiring in 60 days',
        soon.length ? 'Use or replace these first' : 'Nothing expiring soon') +
      card('is-bad', "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 9v4M12 17h.01\"/><path d=\"M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z\"/></svg>", expired.length, 'Expired',
        expired.length ? 'Cannot be dispensed' : 'Nothing expired');

    if (expired.length) {
      el('alerts').insertAdjacentHTML('beforeend',
        '<div class="expired-list"><h4>Expired batches</h4>' +
        expired.map(b =>
          '<div class="expired-row">' +
            '<span><b>' + esc(b.medicine_name) + '</b>' +
            (b.batch_no ? ' · batch ' + esc(b.batch_no) : '') +
            ' · expired ' + esc(b.expires_on) + '</span>' +
            '<span class="qty">' + num(b.quantity) + '</span>' +
            '<button class="btn btn-danger btn-sm" data-writeoff="' + esc(b.id) + '">Write off</button>' +
          '</div>').join('') + '</div>');

      document.querySelectorAll('[data-writeoff]').forEach(button =>
        button.addEventListener('click', async () => {
          if (!confirm('Write this batch off?\n\nThe quantity is recorded as expired stock, ' +
            'not silently deleted, so the shelf and the record still agree.')) return;
          try {
            await TCOSApi.writeOffBatch(
              button.dataset.writeoff, 'expired', crypto.randomUUID());
            await load();
            msg('pageMsg', 'Batch written off.', 'ok');
          } catch (error) { msg('pageMsg', esc(error.message), 'error'); }
        }));
    }
  }

  /* ---------------- stock table ---------------- */

  function renderTable(filter) {
    const term = (filter || '').trim().toLowerCase();
    const rows = data.items.filter(i =>
      !term || (i.medicine_name || '').toLowerCase().includes(term));

    if (!data.items.length) {
      el('stockTable').innerHTML =
        '<div class="empty">No medicines yet. Add one, then receive your first batch.</div>';
      return;
    }
    if (!rows.length) {
      el('stockTable').innerHTML = '<div class="empty">Nothing matches "' + esc(filter) + '".</div>';
      return;
    }

    const lowIds = new Set(data.belowReorder.map(i => i.id));

    el('stockTable').innerHTML =
      /* `cards` plus the data-labels: on a phone this became a sideways
         strip. The title is NAMED rather than counted, because the first
         cell here is the expand toggle - see css/tcos.css. */
      '<table class="grid cards"><thead><tr><th></th><th>Medicine</th><th>On hand</th>' +
      '<th>Next expiry</th><th>Reorder at</th><th></th></tr></thead><tbody>' +
      rows.map(item => {
        const isLow = lowIds.has(item.id);
        const open = expanded.has(item.id);
        return '<tr class="item-row' + (isLow ? ' low' : '') + '">' +
            '<td data-label="Batches"><button class="twist" data-expand="' + esc(item.id) + '">' +
              (open ? '▾' : '▸') + '</button></td>' +
            '<td data-card-title><b>' + esc(item.medicine_name) + '</b>' +
              '<small class="sys-tag sys-' + esc(item.system) + '">' + esc(item.system) + '</small>' +
              (item.form ? '<small class="form">' + esc(item.form) + '</small>' : '') + '</td>' +
            '<td class="qty" data-label="On hand"><b>' + num(item.on_hand) + '</b>' +
              (item.unit ? ' <span class="unit">' + esc(item.unit) + '</span>' : '') +
              (isLow ? '<span class="flag low">low</span>' : '') + '</td>' +
            '<td data-label="Next expiry">' + (item.next_expiry ? esc(item.next_expiry) : '<span class="muted">—</span>') + '</td>' +
            '<td data-label="Reorder at">' + (item.reorder_level > 0 ? num(item.reorder_level) : '<span class="muted">—</span>') + '</td>' +
            '<td class="actions" data-label="">' +
              '<button class="btn btn-ghost btn-sm" data-receive="' + esc(item.id) + '">Receive</button> ' +
              '<button class="btn btn-primary btn-sm" data-dispense="' + esc(item.id) + '"' +
                (item.on_hand > 0 ? '' : ' disabled title="Nothing in date to dispense"') +
                '>Dispense</button>' +
            '</td>' +
          '</tr>' +
          (open ? '<tr class="batch-row"><td colspan="6"><div class="batches" data-batches="' +
            esc(item.id) + '">Loading batches…</div></td></tr>' : '');
      }).join('') + '</tbody></table>';

    document.querySelectorAll('[data-expand]').forEach(button =>
      button.addEventListener('click', async () => {
        const id = button.dataset.expand;
        if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
        renderTable(el('search').value);
        if (expanded.has(id)) await loadBatches(id);
      }));

    document.querySelectorAll('[data-receive]').forEach(button =>
      button.addEventListener('click', () => openReceive(button.dataset.receive)));

    document.querySelectorAll('[data-dispense]').forEach(button =>
      button.addEventListener('click', () => openDispense(button.dataset.dispense)));

    expanded.forEach(id => loadBatches(id));
  }

  async function loadBatches(itemId) {
    const host = document.querySelector('[data-batches="' + itemId + '"]');
    if (!host) return;
    try {
      const batches = (await TCOSApi.batchesFor(itemId)).batches || [];
      if (!batches.length) { host.innerHTML = '<div class="muted">No batches received yet.</div>'; return; }
      host.innerHTML =
        '<table class="batch-table"><thead><tr><th>Batch</th><th>Expires</th>' +
        '<th>Quantity</th><th>State</th><th></th></tr></thead><tbody>' +
        batches.map(b => {
          const isExpired = b.days_to_expiry < 0;
          const isQuarantined = !!b.quarantined_at;
          const state = isQuarantined
            ? '<span class="pill suspended">Quarantined</span>'
            : isExpired
              ? '<span class="pill suspended">Expired</span>'
              : b.days_to_expiry <= 60
                ? '<span class="pill trial">' + b.days_to_expiry + ' days left</span>'
                : '<span class="pill active">In date</span>';
          return '<tr' + (isExpired || isQuarantined ? ' class="unusable"' : '') + '>' +
            '<td>' + esc(b.batch_no || '—') + '</td>' +
            '<td>' + esc(b.expires_on) + '</td>' +
            '<td class="qty">' + num(b.quantity) + '</td>' +
            '<td>' + state + '</td>' +
            '<td style="white-space:nowrap">' +
              (b.quantity > 0 && !isQuarantined
                ? '<button class="btn btn-ghost btn-sm" data-quarantine="' + esc(b.id) + '">Quarantine</button> '
                : '') +
              (b.quantity > 0
                ? '<button class="btn btn-danger btn-sm" data-writeoff2="' + esc(b.id) + '">Write off</button>'
                : '') +
            '</td></tr>';
        }).join('') + '</tbody></table>' +
        (batches.some(b => b.quarantined_at)
          ? '<p class="muted quarantine-note">Quarantined batches stay visible on purpose — ' +
            'a batch you cannot use is something you need to see.</p>' : '');

      host.querySelectorAll('[data-quarantine]').forEach(button =>
        button.addEventListener('click', async () => {
          const reason = prompt('Why is this batch being quarantined?\n(recall, damage, failed check)');
          if (!reason) return;
          try {
            await TCOSApi.quarantineBatch(
              button.dataset.quarantine, reason, crypto.randomUUID());
            await load();
          }
          catch (error) { msg('pageMsg', esc(error.message), 'error'); }
        }));

      host.querySelectorAll('[data-writeoff2]').forEach(button =>
        button.addEventListener('click', async () => {
          const reason = prompt('Reason for writing this batch off?', 'expired');
          if (reason === null) return;
          try {
            await TCOSApi.writeOffBatch(
              button.dataset.writeoff2, reason, crypto.randomUUID());
            await load();
          }
          catch (error) { msg('pageMsg', esc(error.message), 'error'); }
        }));
    } catch (error) {
      host.innerHTML = '<div class="muted">' + esc(error.message) + '</div>';
    }
  }

  /* ---------------- dialogs ---------------- */

  document.querySelectorAll('[data-close]').forEach(button =>
    button.addEventListener('click', () => el(button.dataset.close).close()));

  el('addItemBtn').addEventListener('click', () => {
    itemAttemptKey = crypto.randomUUID();
    msg('itemMsg', ''); el('itemForm').reset(); el('itemDialog').showModal();
  });

  el('itemForm').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      await TCOSApi.addStockItem({
        medicineName: el('itName').value.trim(),
        system: el('itSystem').value,
        form: el('itForm').value.trim() || null,
        unit: el('itUnit').value.trim() || null,
        reorderLevel: Number(el('itReorder').value || 0),
        idempotencyKey: itemAttemptKey
      });
      el('itemDialog').close();
      await load();
      msg('pageMsg', 'Medicine added. Receive a batch to put it on the shelf.', 'ok');
    } catch (error) { msg('itemMsg', esc(error.message), 'error'); }
  });

  function openReceive(itemId) {
    receiveAttemptKey = crypto.randomUUID();
    msg('batchMsg', '');
    el('batchForm').reset();
    el('bItem').innerHTML = data.items.map(i =>
      '<option value="' + esc(i.id) + '">' + esc(i.medicine_name) + '</option>').join('');
    if (itemId) el('bItem').value = itemId;
    updateUnitHint();
    el('batchDialog').showModal();
  }
  const updateUnitHint = () => {
    const item = data.items.find(i => i.id === el('bItem').value);
    el('bUnitHint').textContent = item && item.unit
      ? 'In ' + item.unit + ' — the unit you dispense in, not boxes.'
      : 'In the unit you dispense in, not boxes.';
  };
  el('bItem').addEventListener('change', updateUnitHint);
  el('receiveBtn').addEventListener('click', () => {
    if (!data.items.length) {
      msg('pageMsg', 'Add a medicine first, then receive stock against it.', 'info');
      return;
    }
    openReceive(null);
  });

  el('batchForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (el('bExpiry').value <= today()) {
      msg('batchMsg', 'That expiry date is today or in the past. Check the pack.', 'error');
      return;
    }
    try {
      await TCOSApi.receiveBatch({
        stockItemId: el('bItem').value,
        batchNo: el('bBatch').value.trim() || null,
        expiresOn: el('bExpiry').value,
        quantity: Number(el('bQty').value),
        idempotencyKey: receiveAttemptKey
      });
      el('batchDialog').close();
      await load();
      msg('pageMsg', 'Stock received.', 'ok');
    } catch (error) { msg('batchMsg', esc(error.message), 'error'); }
  });

  let dispensingItem = null;
  function openDispense(itemId) {
    dispensingItem = data.items.find(i => i.id === itemId);
    if (!dispensingItem) return;
    dispenseAttemptKey = crypto.randomUUID();
    msg('dispenseMsg', '');
    el('dispenseForm').reset();
    el('dispenseTitle').textContent = 'Dispense ' + dispensingItem.medicine_name;
    el('dispenseOnHand').innerHTML = '<b>' + num(dispensingItem.on_hand) + '</b> ' +
      esc(dispensingItem.unit || 'units') + ' in date and usable.';
    el('dispenseDialog').showModal();
  }

  el('dispenseForm').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const result = await TCOSApi.dispense({
        stockItemId: dispensingItem.id,
        quantity: Number(el('dQty').value),
        patientId: el('dPatient').value || null,
        idempotencyKey: dispenseAttemptKey
      });
      el('dispenseDialog').close();
      await load();
      msg('pageMsg', 'Dispensed from ' + result.drawnFrom.map(b =>
        (b.batchNo || 'unbatched') + ' (' + num(b.quantity) + ', expires ' + b.expiresOn + ')'
      ).join(' and ') + '.', 'ok');
    } catch (error) { msg('dispenseMsg', esc(error.message), 'error'); }
  });

  el('search').addEventListener('input', event => renderTable(event.target.value));
  el('signOutBtn').addEventListener('click', async () => {
    await TCOSApi.signOut(); location.href = 'tcos-login.html';
  });

  async function load() {
    try {
      data = await TCOSApi.stock();
      renderAlerts();
      renderTable(el('search').value);
    } catch (error) {
      msg('pageMsg', esc(error.message), 'error');
    }
  }

  await load();
})();

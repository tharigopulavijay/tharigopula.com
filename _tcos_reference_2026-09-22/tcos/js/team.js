/* =========================================================================
   Who else may use this clinic.

   Two things this screen refuses to do:

     1. It never shows a temporary password twice, because there is nothing
        to show - only a hash was kept. The dialog says so plainly rather
        than letting her assume she can come back for it.

     2. It never claims a permission the server does not enforce. The role
        table comes from the API, which is the same table the router checks,
        so this page cannot promise something the gate would refuse.
   ========================================================================= */
(async () => {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const el = id => document.getElementById(id);
  const msg = (id, text, kind) => {
    el(id).innerHTML = text
      ? '<div class="notice ' + kind + '" style="max-width:none">' + text + '</div>' : '';
  };
  const prettyDate = v => {
    if (!v) return null;
    const d = new Date(String(v).replace(' ', 'T') + (String(v).endsWith('Z') ? '' : 'Z'));
    return isNaN(d) ? String(v).slice(0, 10)
      : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
  };

  if (!TCOSApi.isSignedIn()) { TCOSBoot.toSignIn('signed-out'); return; }

  let me;
  try { me = await TCOSApi.me(); }
  catch (error) {
    if (error.status === 401) { location.replace('tcos-login.html'); return; }
    msg('pageMsg', esc(error.message), 'error');
    return;
  }
  TCOSNav.paint('team.html', me);

  /* Only the doctor manages her own team. Staff who reach this URL are told
     plainly rather than shown an empty screen they might think is a bug. */
  if (!(me.me && me.me.isDoctor)) {
    msg('pageMsg', 'Only the doctor can manage who has access.', 'error');
    el('addBtn').hidden = true;
    el('staffTable').innerHTML = '<div class="empty">Not available for your role.</div>';
    return;
  }

  const ICON = {
    front_desk: '<path d="M8 2v4M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/>',
    pharmacist: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M12 11v6M9 14h6"/>',
    assistant:  '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>'
  };
  const svg = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';

  const LABELS = {
    appointments: 'The diary', patients: 'Patient details', vitals: 'Vitals',
    pharmacy: 'Pharmacy & stock', read_notes: 'Clinical records',
    write_notes: 'Writing prescriptions', billing: 'Billing & payments',
    reports: 'Practice analytics', settings: 'Practice settings', team: 'Team'
  };
  const ORDER = ['appointments', 'patients', 'vitals', 'pharmacy', 'billing',
    'read_notes', 'write_notes', 'reports', 'settings', 'team'];
  const ASSIGNABLE = ['appointments', 'patients', 'vitals', 'pharmacy', 'billing'];

  let roles = [];
  let people = [];

  /* ------------------------------ painting ------------------------------ */

  function paintTiles() {
    el('roleTiles').innerHTML = roles.map(role => {
      const n = people.filter(p => p.role === role.id && p.status === 'active').length;
      return '<div class="stat">' +
        '<span class="chip">' + svg(ICON[role.id] || ICON.assistant) + '</span>' +
        '<div class="stat-text"><span>' + esc(role.label) + '</span>' +
        '<b>' + n + '</b><small>' + (n === 1 ? '1 person' : n + ' people') + '</small></div></div>';
    }).join('');
  }

  function paintPeople() {
    el('staffCount').textContent = people.length
      ? people.filter(p => p.status === 'active').length + ' active' : 'Nobody yet';

    if (!people.length) {
      el('staffTable').innerHTML =
        '<div class="empty" style="padding:38px 20px">' +
        '<p style="margin:0 0 6px"><b>You are the only person with access.</b></p>' +
        '<p style="margin:0 0 18px;color:var(--muted);font-size:.9rem">' +
        'Add your front desk so they can book patients without using your own login.</p>' +
        '<button class="btn btn-primary" id="addFirst">+ Add someone</button></div>';
      el('addFirst').addEventListener('click', openAdd);
      return;
    }

    const roleOf = id => (roles.find(r => r.id === id) || { label: id }).label;
    /* Read from the role definition the server sent, not a hardcoded name,
       so a second clinical role added later behaves correctly here without
       anyone remembering to update this file. */
    const isClinical = person => {
      const role = roles.find(r => r.id === person.role);
      return !!(role && role.clinical);
    };

    el('staffTable').innerHTML =
      '<div class="notice info" style="max-width:none;margin:0 0 14px">One person may cover several jobs. Tick every work area they handle, then save that person.</div>' +
      /* `cards`: six columns across a phone scrolled sideways, so who
         somebody was and what they could open were never on screen
         together. See css/tcos.css. */
      '<table class="grid cards team-access-table"><thead><tr><th>Person</th><th>Work areas they can open</th><th>Mobile</th>' +
      '<th>Status</th><th>Last signed in</th><th></th></tr></thead><tbody>' +
      people.map(p =>
        '<tr>' +
          '<td data-card-title><div class="clinic-cell"><span class="fallback">' +
            esc((p.full_name || '?').charAt(0).toUpperCase()) + '</span>' +
            '<div><b>' + esc(p.full_name) + '</b><small>Added ' +
            esc(prettyDate(p.created_at) || '—') + '</small></div></div></td>' +
          '<td data-label="Can open"><b class="role-label">' + esc(roleOf(p.role)) + '</b>' +
            (p.status !== 'active' ? '<small>Access revoked</small>'
              : isClinical(p)
                /* A doctor's access follows from being a doctor, so there
                   is nothing to tick. Showing an editable list here would
                   suggest the clinical record can be taken away one box at
                   a time, which is not how it works. Their registration is
                   the thing worth showing instead. */
                ? '<div class="doctor-creds">' +
                    '<small>Sees patients, writes notes and prescribes under their own registration.</small>' +
                    '<div class="cred-line"><span>' +
                      esc(p.registration_no || 'No registration number') + '</span>' +
                      (p.qualification ? '<i>' + esc(p.qualification) + '</i>' : '') +
                      '<span class="pill ' + (p.verification_status === 'verified' ? 'active' : 'trial') + '">' +
                        (p.verification_status === 'verified' ? 'Verified' : 'Not verified yet') +
                      '</span></div>' +
                  '</div>'
                : '<div class="inline-access" data-person-access="' + esc(p.id) + '">' +
                  ASSIGNABLE.map(cap => '<label><input type="checkbox" value="' + esc(cap) + '" ' +
                    (effectiveCan(p).includes(cap) ? 'checked' : '') + '><span>' +
                    esc(LABELS[cap] || cap) + '</span></label>').join('') +
                  '<button class="btn btn-primary btn-sm" type="button" data-save-access="' + esc(p.id) + '">Save access</button></div>') +
          '</td>' +
          '<td data-label="Mobile">' + esc(p.mobile) + '</td>' +
          '<td data-label="Status">' + (p.status === 'active'
            ? (p.must_change_password
              ? '<span class="pill trial">Not signed in yet</span>'
              : '<span class="pill active">Active</span>')
            : '<span class="pill suspended">Revoked</span>') + '</td>' +
          '<td data-label="Last signed in">' + esc(prettyDate(p.last_sign_in_at) || 'Never') + '</td>' +
          '<td class="actions" data-label="">' +
            (p.status === 'active'
              ? '<button class="btn btn-ghost btn-sm" data-reset="' + esc(p.id) + '">New password</button>' +
                '<button class="btn btn-ghost btn-sm" data-revoke="' + esc(p.id) + '">Revoke</button>'
              : '<button class="btn btn-ghost btn-sm" data-restore="' + esc(p.id) + '">Restore</button>') +
          '</td>' +
        '</tr>').join('') + '</tbody></table>';

    document.querySelectorAll('[data-reset]').forEach(b =>
      b.addEventListener('click', () => resetPassword(b.dataset.reset)));
    document.querySelectorAll('[data-save-access]').forEach(b =>
      b.addEventListener('click', () => saveInlineAccess(b)));
    document.querySelectorAll('[data-revoke]').forEach(b =>
      b.addEventListener('click', () => setStatus(b.dataset.revoke, 'revoked')));
    document.querySelectorAll('[data-restore]').forEach(b =>
      b.addEventListener('click', () => setStatus(b.dataset.restore, 'active')));
  }

  async function saveInlineAccess(button) {
    const person = people.find(p => p.id === button.dataset.saveAccess);
    const group = document.querySelector('[data-person-access="' + CSS.escape(person.id) + '"]');
    const capabilities = Array.from(group.querySelectorAll('input:checked')).map(i => i.value);
    button.disabled = true;
    button.textContent = 'Saving…';
    try {
      await TCOSApi.setStaffCapabilities(person.id, capabilities);
      await load();
      msg('pageMsg', esc(person.full_name) + ' can now open exactly the selected work areas.', 'ok');
    } catch (error) {
      button.disabled = false;
      button.textContent = 'Save access';
      msg('pageMsg', esc(error.message), 'error');
    }
  }

  function effectiveCan(person) {
    if (person.capabilities) {
      try { const parsed = JSON.parse(person.capabilities); if (Array.isArray(parsed)) return parsed; } catch (_) {}
    }
    return (roles.find(role => role.id === person.role) || { can: [] }).can;
  }

  /* The matrix is built from the API's own role table, so it cannot describe
     a permission the router does not actually apply. */
  function paintMatrix() {
    const columns = [{ id: 'doctor', label: 'You', can: ORDER }].concat(roles);
    el('matrix').innerHTML =
      '<table class="grid matrix"><thead><tr><th>Can open</th>' +
      columns.map(c => '<th>' + esc(c.label) + '</th>').join('') +
      '</tr></thead><tbody>' +
      ORDER.map(cap =>
        '<tr><td><b>' + esc(LABELS[cap] || cap) + '</b></td>' +
        columns.map(c => '<td class="cell">' + (c.can.includes(cap)
          ? '<span class="yes">&#10003;</span>'
          : '<span class="no">&minus;</span>') + '</td>').join('') + '</tr>').join('') +
      '</tbody></table>' +
      '<p class="matrix-note">These are starting defaults only; the visible checkboxes above are the saved access for each person. Clinical records stay with you. This is enforced ' +
      'by the server, not by hiding buttons - a member of staff cannot reach ' +
      'them by any route.</p>';
  }

  async function load() {
    try {
      const data = await TCOSApi.team();
      roles = data.roles || [];
      people = data.staff || [];
    } catch (error) { msg('pageMsg', esc(error.message), 'error'); return; }
    paintTiles();
    paintPeople();
    paintMatrix();
  }

  /* ------------------------------- actions ------------------------------ */

  const addDialog = el('addDialog');
  const passDialog = el('passDialog');
  const accessDialog = el('accessDialog');
  let accessPerson = null;

  function openAccess(id) {
    accessPerson = people.find(person => person.id === id);
    const selected = new Set(effectiveCan(accessPerson));
    el('accessTitle').textContent = accessPerson.full_name + ' · responsibilities';
    el('accessChoices').innerHTML = ASSIGNABLE.map(capability =>
      '<label class="toggle ' + (selected.has(capability) ? 'on' : '') + '">' +
      '<input type="checkbox" value="' + esc(capability) + '" ' + (selected.has(capability) ? 'checked' : '') + '>' +
      '<span>' + esc(LABELS[capability] || capability) + '</span></label>').join('');
    el('accessChoices').querySelectorAll('input').forEach(input => input.addEventListener('change', () =>
      input.closest('.toggle').classList.toggle('on', input.checked)));
    accessDialog.showModal();
  }

  el('accessClose').addEventListener('click', () => accessDialog.close());
  el('accessCancel').addEventListener('click', () => accessDialog.close());
  el('accessForm').addEventListener('submit', async event => {
    event.preventDefault();
    const capabilities = Array.from(el('accessChoices').querySelectorAll('input:checked')).map(i => i.value);
    try {
      await TCOSApi.setStaffCapabilities(accessPerson.id, capabilities);
      accessDialog.close();
      await load();
      msg('pageMsg', esc(accessPerson.full_name) + ' now sees exactly those work areas.', 'ok');
    } catch (error) { msg('pageMsg', esc(error.message), 'error'); }
  });

  function showPassword(who, password, isReset) {
    el('passTitle').textContent = isReset ? 'A new temporary password' : 'Their temporary password';
    el('passWho').textContent = who;
    el('passValue').textContent = password;
    passDialog.showModal();
  }

  el('passCopy').addEventListener('click', () => {
    navigator.clipboard.writeText(el('passValue').textContent).then(
      () => { el('passCopy').textContent = 'Copied'; setTimeout(() => { el('passCopy').textContent = 'Copy'; }, 1500); },
      () => { el('passCopy').textContent = 'Copy failed'; });
  });
  el('passDone').addEventListener('click', () => passDialog.close());

  function openAdd() {
    msg('addMsg', '');
    el('addForm').reset();
    el('doctorFields').hidden = true;

    /* Staff first, then the doctors. They are separated by a heading rather
       than mixed in, because they are different decisions: one hands out a
       job, the other hands over the clinical record. */
    const staffRoles = roles.filter(r => !r.clinical);
    const doctorRoles = roles.filter(r => r.clinical);

    const choice = (r, checked) =>
      '<label class="role-choice"><input type="radio" name="role" value="' + esc(r.id) + '"' +
      (checked ? ' checked' : '') + '>' +
      '<span class="role-body"><b>' + esc(r.label) + '</b><small>' + esc(r.blurb) + '</small></span>' +
      '</label>';

    el('roleChoices').innerHTML =
      staffRoles.map((r, i) => choice(r, i === 0)).join('') +
      (doctorRoles.length
        ? '<p class="role-divider">Another doctor in this practice</p>' +
          doctorRoles.map(r => choice(r, false)).join('')
        : '');

    /* The credentials block only makes sense for a doctor, and showing it
       for a receptionist would suggest she needs a registration number. */
    el('roleChoices').querySelectorAll('input[name="role"]').forEach(radio =>
      radio.addEventListener('change', () => {
        const role = roles.find(r => r.id === radio.value);
        el('doctorFields').hidden = !(role && role.clinical);
        el('addSave').textContent = role && role.clinical
          ? 'Add this doctor' : 'Create account';
      }));

    el('addSave').textContent = 'Create account';
    addDialog.showModal();
  }

  el('addBtn').addEventListener('click', openAdd);
  el('addCancel').addEventListener('click', () => addDialog.close());
  el('addClose').addEventListener('click', () => addDialog.close());

  el('addForm').addEventListener('submit', async event => {
    event.preventDefault();
    const chosen = document.querySelector('input[name="role"]:checked');
    if (!chosen) { msg('addMsg', 'Choose what they do.', 'error'); return; }

    const role = roles.find(r => r.id === chosen.value);
    const clinical = !!(role && role.clinical);
    /* Caught here as well as on the server, so she is told before the
       dialog closes rather than after. */
    if (clinical && !el('sReg').value.trim()) {
      msg('addMsg', 'A doctor needs their own council registration number.', 'error');
      el('sReg').focus();
      return;
    }

    el('addSave').disabled = true;
    try {
      const result = await TCOSApi.addStaff({
        fullName: el('sName').value.trim(),
        mobile: el('sMobile').value.trim(),
        role: chosen.value,
        /* Sent only for a doctor. The server ignores them for staff roles
           anyway, but sending a receptionist's blank council is noise. */
        ...(clinical ? {
          qualification: el('sQual').value.trim() || null,
          registrationNo: el('sReg').value.trim(),
          council: el('sCouncil').value.trim() || null
        } : {})
      });
      addDialog.close();
      await load();
      showPassword(result.user.fullName + ' · ' + result.user.mobile,
        result.temporaryPassword, false);
    } catch (error) {
      msg('addMsg', esc(error.message), 'error');
    } finally {
      el('addSave').disabled = false;
    }
  });

  async function resetPassword(id) {
    const person = people.find(p => p.id === id);
    if (!confirm('Give ' + person.full_name + ' a new temporary password?\n\n' +
      'Their current one stops working immediately.')) return;
    try {
      const result = await TCOSApi.resetStaffPassword(id);
      await load();
      showPassword(result.fullName + ' · ' + person.mobile, result.temporaryPassword, true);
    } catch (error) { msg('pageMsg', esc(error.message), 'error'); }
  }

  async function setStatus(id, status) {
    const person = people.find(p => p.id === id);
    if (status === 'revoked' && !confirm(
      'Revoke access for ' + person.full_name + '?\n\n' +
      'They are signed out straight away and cannot sign back in.')) return;
    try {
      await TCOSApi.setStaffStatus(id, status);
      await load();
      msg('pageMsg', esc(person.full_name) + (status === 'revoked'
        ? ' no longer has access.' : ' has access again.'), 'ok');
    } catch (error) { msg('pageMsg', esc(error.message), 'error'); }
  }

  await load();
})();

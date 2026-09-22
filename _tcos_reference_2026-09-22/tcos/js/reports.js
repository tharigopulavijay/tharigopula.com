(async () => {
  const el = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  const prettyDate = v => {
    const [y,m,d] = String(v || '').slice(0,10).split('-').map(Number);
    return y ? new Intl.DateTimeFormat('en-IN',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(y,m-1,d)) : '—';
  };
  if (!TCOSApi.isSignedIn()) { TCOSBoot.toSignIn('signed-out'); return; }
  let me, rows = [], filter = 'all';
  try { me = await TCOSApi.me(); } catch (_) { location.replace('tcos-login.html'); return; }
  TCOSNav.paint('reports.html', me);

  const isAbnormal = r => Number(r.flagged_count || 0) > 0;
  function paint() {
    const term = el('search').value.trim().toLowerCase();
    const shown = rows.filter(r =>
      (filter === 'all' || (filter === 'abnormal' && isAbnormal(r)) ||
       (filter === 'verified' && r.status === 'verified')) &&
      (!term || (r.full_name + ' ' + r.report_name + ' ' + (r.local_ref || '')).toLowerCase().includes(term)));
    el('allCount').textContent = rows.length;
    el('abnormalCount').textContent = rows.filter(isAbnormal).length;
    el('verifiedCount').textContent = rows.filter(r => r.status === 'verified').length;
    el('headline').innerHTML = [
      ['Clinic tests', rows.length, 'Performed inside this clinic'],
      ['Abnormal results', rows.filter(isAbnormal).length, 'At least one flagged value'],
      ['Completed', rows.filter(r => r.status === 'verified').length, 'Saved to patient history'],
      ['Patients tested', new Set(rows.map(r => r.patient_id)).size, 'With clinic-performed tests']
    ].map(([a,b,c]) => '<div class="stat"><div class="stat-text"><span>'+esc(a)+'</span><b>'+b+'</b><small>'+esc(c)+'</small></div></div>').join('');
    const names = {all:'Tests performed by this clinic',abnormal:'Clinic tests with abnormal results',verified:'Completed clinic tests'};
    el('listTitle').textContent = names[filter];
    /* `cards` plus the data-labels turn each row into a card on a phone -
       six columns do not fit across 375px and scrolled sideways instead.
       See css/tcos.css. */
    el('diagnosticList').innerHTML = shown.length ? '<table class="grid cards"><thead><tr><th>Patient</th><th>Investigation</th><th>Date</th><th>Results</th><th>Status</th><th></th></tr></thead><tbody>' + shown.map(r =>
      '<tr><td data-card-title><b>'+esc(r.full_name)+'</b><small class="block">'+esc(r.local_ref || '')+'</small></td>'+
      '<td data-label="Investigation"><b>'+esc(r.report_name)+'</b><small class="block">Performed at this clinic</small></td>'+
      '<td data-label="Date">'+esc(prettyDate(r.reported_on))+'</td><td data-label="Results">'+(isAbnormal(r) ? '<span class="pill suspended">'+r.flagged_count+' flagged</span><small class="block diagnostic-values">'+esc(r.abnormal_values || '')+'</small>' : '<span class="pill active">Within range</span>')+'</td>'+
      '<td data-label="Status"><span class="pill active">Completed</span></td>'+
      '<td class="actions" data-label=""><a class="btn btn-ghost btn-sm" href="record.html?patient='+encodeURIComponent(r.patient_id)+'">Open chart</a></td></tr>').join('')+'</tbody></table>' : '<div class="empty">No diagnostic reports match this view.</div>';
  }
  document.querySelectorAll('#diagnosticTabs button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('#diagnosticTabs button').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); filter = b.dataset.filter; paint();
  }));
  el('search').addEventListener('input', paint);
  try { rows = (await TCOSApi.diagnostics()).reports || []; paint(); }
  catch (error) { el('diagnosticList').innerHTML = '<div class="notice error">'+esc(error.message)+'</div>'; }
})();

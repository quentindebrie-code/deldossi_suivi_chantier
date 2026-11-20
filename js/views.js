/* =========================================================
   VIEWS : tableau de bord, saisie, analyses
   ========================================================= */
import {
  $, $$, esc, S, MOIS, MC, euro, euro2, keur, num, pct, fmtDate, fmtDT, ic, seg, segSet, toast, confirmBox, animateBars, tipOn, stagger,
  rowsYear, rowsMonth, rowCalc, aggregate, activeServices, allServices, seuilOf, vehicules, deptName, n1, statut, activeMonths, anomalies, hours, hhmm,
  parseNum, r2, saveRow, deleteRow, upsertLocal, log, errMsg, groupeLabel, GROUPES, store, veh, FINE, RM, EASE, sb, norm, modal
} from './core.js?v=2';
import { columns, lines, donut, hbars, pareto, kpi, pal } from './charts.js?v=2';

const svcName = code => (S.services.find(s => s.code === code) || { libelle: code }).libelle;
const after = (host) => { animateBars(host); tipOn(host); stagger(host); };
const n1Of = m => Number((n1()[m] || {}).ca) || 0;

/* =========================================================
   TABLEAU DE BORD (direction)
   ========================================================= */
export function renderDashboard(host, ctx) {
  const rows = rowsYear(); const A = aggregate(rows); const am = activeMonths(rows);
  const last = am.length ? am[am.length - 1] : 0;
  const n1ytd = am.reduce((a, m) => a + n1Of(m), 0); const n1y = Array.from({ length: 12 }, (_, i) => n1Of(i + 1)).reduce((a, b) => a + b, 0);
  const d = n1ytd ? (A.ca - n1ytd) / n1ytd * 100 : null;
  const ratio = n1ytd ? A.ca / n1ytd : null;
  const proj = ratio && last < 12 ? A.ca + Array.from({ length: 12 - last }, (_, i) => n1Of(last + 1 + i) * ratio).reduce((a, b) => a + b, 0) : (am.length ? A.ca / am.length * 12 : 0);
  const clients = [...A.clients.entries()].sort((a, b) => b[1].ca - a[1].ca);
  const top5 = clients.slice(0, 5).reduce((a, c) => a + c[1].ca, 0);
  const vlist = Object.entries(A.veh).map(([v, e]) => { const s = seuilOf(v) * Math.max(1, am.length); const p = e.ca / s * 100; return { v, ca: e.ca, seuil: s, p, st: statut(p) }; }).sort((a, b) => b.p - a.p);
  const anom = anomalies(rows); const deficit = vlist.filter(v => v.st[0] === 'ko');
  const bestM = Object.entries(A.months).sort((a, b) => b[1].ca - a[1].ca)[0];

  const ins = [];
  if (d != null) ins.push(['trend', d >= 0 ? 'ok' : 'err', `Le chiffre d'affaires cumulé est <b>${d >= 0 ? 'en hausse' : 'en baisse'} de ${pct(Math.abs(d))}</b> par rapport à ${S.annee - 1} sur les mêmes mois (${euro(n1ytd)} en ${S.annee - 1}).`]);
  if (proj) ins.push(['target', '', `À ce rythme, l'année ${S.annee} se terminerait vers <b>${euro(proj)}</b>${n1y ? `, contre ${euro(n1y)} en ${S.annee - 1}` : ''}.`]);
  if (bestM) ins.push(['chart', '', `Meilleur mois : <b>${MOIS[bestM[0] - 1]}</b> avec ${euro(bestM[1].ca)} et ${bestM[1].n} interventions.`]);
  if (A.ca) ins.push(['users', top5 / A.ca > .5 ? 'warn' : '', `Les cinq premiers clients pèsent <b>${pct(top5 / A.ca * 100)}</b> du chiffre d'affaires${top5 / A.ca > .5 ? ' : la dépendance commerciale est élevée' : ''}.`]);
  if (deficit.length) ins.push(['truck', 'err', `<b>${deficit.length} véhicule${deficit.length > 1 ? 's' : ''} sous ${pct(70, 0)} du seuil</b> annuel : ${deficit.map(v => esc(v.v)).join(', ')}.`]);
  if (A.na) ins.push(['alert', 'warn', `<b>${euro(A.na)}</b> de chiffre d'affaires imputable n'est affecté à aucun véhicule.`]);

  host.innerHTML = `
  <div class="kpis">
    ${kpi('CA global', euro(A.ca), { delta: d })}
    ${kpi('Interventions', num(A.n), { sub: `${am.length} mois actifs` })}
    ${kpi('Clients actifs', num(A.clients.size), { sub: `${clients.filter(c => c[1].n === 1).length} ponctuels` })}
    ${kpi('CA moyen / interv.', euro(A.n ? A.ca / A.n : 0))}
    ${kpi('Interventions COFRAC', num(A.cofN), { sub: A.n ? `${pct(A.cofN / A.n * 100)} des interventions` : '' })}
    ${kpi('CA COFRAC', euro(A.cofCA), { sub: A.ca ? `${pct(A.cofCA / A.ca * 100)} du CA` : '' })}
  </div>
  <div class="split">
    <section class="panel glass" data-st><div class="panel-head"><div><span class="label">Évolution</span><h2 style="margin-top:6px">Chiffre d'affaires mensuel</h2><p>Barres : ${S.annee}. Pointillés : ${S.annee - 1}.</p></div><button class="btn ghost sm mag" data-go="analyses/tendance">Comparatif détaillé ${ic('right')}</button></div>
      ${columns(MC.map((l, i) => ({ label: l, v: (A.months[i + 1] || {}).ca || 0, l: n1Of(i + 1), dim: !(A.months[i + 1]) })), { line: true, lineLabel: String(S.annee - 1) })}</section>
    <section class="panel glass" data-st><div class="panel-head"><div><span class="label">À retenir</span><h2 style="margin-top:6px">Lecture de la période</h2></div></div>
      <div class="alerts">${ins.map(([i, k, t]) => `<div class="tile insight"><span class="ico ${k}">${ic(i)}</span><p>${t}</p></div>`).join('') || '<p class="muted">Aucune donnée sur cette année.</p>'}</div></section>
  </div>
  <div class="grid g2">
    <section class="panel glass" data-st><div class="panel-head"><div><span class="label">Activité</span><h2 style="margin-top:6px">CA par service</h2></div><button class="btn text sm" data-go="analyses/services">Détail</button></div>
      ${donut(activeServices().map(s => ({ k: s.libelle, v: A.srv[s.code] || 0 })).filter(x => x.v > 0).sort((a, b) => b.v - a.v), { center: keur(A.ca), sub: 'CA total' })}</section>
    <section class="panel glass" data-st><div class="panel-head"><div><span class="label">Flotte</span><h2 style="margin-top:6px">Rentabilité des véhicules</h2><p>CA imputé rapporté au seuil annuel (seuil mensuel × ${am.length} mois actifs).</p></div><button class="btn text sm" data-go="analyses/vehicules">Détail</button></div>
      <div class="rows">${vlist.map(v => `<div class="tile" style="padding:12px 14px;display:grid;grid-template-columns:minmax(80px,auto) minmax(0,1fr) auto;gap:14px;align-items:center"><b style="color:var(--head);font-size:13px">${esc(v.v)}</b><div data-tip="${esc(`<b>${v.v}</b><br>CA : ${euro(v.ca)}<br>Seuil : ${euro(v.seuil)}<br>${pct(v.p)}`)}"><div class="bar"><i data-w="${Math.min(100, v.p).toFixed(1)}%" style="width:0;background:var(--${v.st[0] === 'ok' ? 'ok' : v.st[0] === 'mid' ? 'warn' : 'err'})"></i></div><span class="small muted">${euro(v.ca)} · ${pct(v.p, 0)}</span></div><span class="st ${v.st[0]}">${v.st[1]}</span></div>`).join('') || '<p class="muted">Aucun véhicule imputé.</p>'}</div></section>
  </div>
  <div class="grid g2">
    <section class="panel glass" data-st><div class="panel-head"><div><span class="label">Portefeuille</span><h2 style="margin-top:6px">Principaux clients</h2></div><button class="btn text sm" data-go="analyses/clients">Analyse Pareto</button></div>
      ${hbars(clients.slice(0, 8).map(([k, e]) => ({ k, v: e.ca, sub: `${e.n} interventions` })))}</section>
    <section class="panel glass" data-st><div class="panel-head"><div><span class="label">Contrôle qualité</span><h2 style="margin-top:6px">${anom.length ? `${anom.length} point${anom.length > 1 ? 's' : ''} à vérifier` : 'Saisie complète'}</h2><p>Dates, clients, départements, véhicules, doublons.</p></div></div>
      <div class="alerts" style="max-height:380px;overflow:auto">${anom.slice(0, 40).map(a => `<button class="tile click it" data-row="${a.r.id}" data-m="${a.r.mois}" style="text-align:left"><span class="ico ${a.lvl}">${ic('alert')}</span><div style="min-width:0"><b>${esc(a.t)}</b><span class="s">${esc(a.s)}</span></div>${ic('right')}</button>`).join('') || `<div class="tile insight"><span class="ico ok">${ic('check')}</span><p>Aucune anomalie détectée sur ${S.annee}.</p></div>`}</div></section>
  </div>`;
  host.onclick = e => {
    const g = e.target.closest('[data-go]'); if (g) { const [t, s] = g.dataset.go.split('/'); ctx.go(t, s); return; }
    const r = e.target.closest('[data-row]'); if (r) ctx.go('saisie', null, { m: +r.dataset.m, focus: r.dataset.row });
  };
  after(host);
}

/* =========================================================
   SAISIE : editable monthly sheet, live save + realtime
   ========================================================= */
const FIELDS = [['jour', 'Date', 'date', 'c0'], ['h_fourgon', 'H. fourgon', 'h', 'w-h'], ['h_camion', 'H. camion', 'h', 'w-h'], ['personnes', 'Pers.', 'p', 'w-p'], ['fourgon', 'Fourgon', 'v', 'w-v'], ['camion', 'Camion', 'v', 'w-v'], ['lieu', 'Lieu de travaux', 't', 'w-l'], ['cofrac', 'COFRAC', 'b', ''], ['client', 'Client', 'cl', 'w-c'], ['dept', 'Dépt', 'd', 'w-d']];
const pend = new Map(); let syncState = 'ok';
const fmtIn = n => n ? String(r2(n)).replace('.', ',') : '';
function setSync(st, txt) {
  syncState = st; const el = $('#sync'); if (!el) return;
  el.className = 'sync ' + st; el.innerHTML = ic(st === 'busy' ? 'sync' : st === 'err' ? 'alert' : 'check') + `<span>${txt || (st === 'busy' ? 'Enregistrement' : st === 'err' ? 'Erreur d\'enregistrement' : 'Enregistré')}</span>`;
}
function queueSave(r, delay = 650) {
  clearTimeout(pend.get(r.id)); setSync('busy');
  pend.set(r.id, setTimeout(async () => {
    pend.delete(r.id);
    try { await saveRow(r); if (!pend.size) setSync('ok'); } catch (e) { setSync('err', errMsg(e)); toast(errMsg(e), 'alert'); }
  }, delay));
}
export const savesPending = () => pend.size > 0;

export function renderSaisie(host, ctx) {
  const mNow = new Date().getFullYear() === S.annee ? new Date().getMonth() + 1 : 1;
  let m = ctx.params.m || store.get('dl-mois', mNow); let q = ''; let sort = store.get('dl-sort', 'ordre');
  const srv = () => activeServices();
  host.innerHTML = `
    <div class="seg glass glide scroll monthseg" id="mSeg" data-st></div>
    <div class="kpis" id="mK"></div>
    <section class="panel glass" data-st style="padding:18px">
      <div class="sheet-tools"><div class="l"><h2 id="mT" style="font-size:18px"></h2><span class="sync ok" id="sync">${ic('check')}<span>Enregistré</span></span></div>
        <div class="r"><input class="input" id="sq" placeholder="Filtrer : client, lieu, véhicule" autocomplete="off"><div class="seg glass glide" id="sortSeg"></div><button class="btn mag" id="addRow">${ic('plus')}Ajouter une intervention</button></div></div>
      <div class="sheet-wrap" id="sw"></div>
      <p class="small muted" style="margin-top:10px">Chaque cellule est enregistrée automatiquement et partagée en direct. Entrée : ligne suivante. Les montants sont en euros HT.</p>
    </section>
    <datalist id="dlVeh">${vehicules().map(v => `<option value="${esc(v.immat)}">${esc(v.type || '')}</option>`).join('')}</datalist>
    <datalist id="dlCli">${[...new Set(rowsYear().map(r => (r.client || '').trim()).filter(Boolean))].sort().map(c => `<option value="${esc(c)}">`).join('')}</datalist>`;
  const monthItems = () => MC.map((l, i) => [i + 1, `${l} <em>${rowsMonth(i + 1).length || ''}</em>`]);
  seg($('#mSeg', host), monthItems(), m, v => { m = +v; store.set('dl-mois', m); ctx.params = { m }; draw(true); });
  seg($('#sortSeg', host), [['ordre', 'Ordre de saisie'], ['date', 'Date']], sort, v => { sort = v; store.set('dl-sort', v); draw(true); });
  $('#sq', host).oninput = e => { q = e.target.value.trim().toLowerCase(); filter(); };

  function list() { const l = rowsMonth(m); if (sort === 'date') l.sort((a, b) => (a.jour || '9').localeCompare(b.jour || '9') || a.ordre - b.ordre); return l; }
  function cell(r, f) {
    const [k, , t, cls] = f; const v = r[k];
    if (t === 'b') return `<td class="cof"><input type="checkbox" data-k="${k}" ${v ? 'checked' : ''} aria-label="COFRAC"></td>`;
    if (t === 'date') return `<td class="c0"><input type="date" data-k="${k}" value="${esc(v || '')}" aria-label="Date"></td>`;
    const attrs = t === 'v' ? 'list="dlVeh" autocapitalize="characters"' : t === 'cl' ? 'list="dlCli"' : t === 'p' ? 'inputmode="numeric"' : t === 'h' ? 'inputmode="decimal" placeholder="-"' : t === 'd' ? 'inputmode="numeric" maxlength="3"' : '';
    return `<td class="${cls}"><input data-k="${k}" class="${t === 'p' || t === 'h' ? 'n' : ''}" value="${esc(v ?? '')}" ${attrs} aria-label="${f[1]}"></td>`;
  }
  function rowHTML(r) {
    const k = rowCalc(r);
    return `<tr data-id="${r.id}" title="${r.maj_le ? esc(`Modifié le ${fmtDT(r.maj_le)}${r.maj_par ? ' par ' + r.maj_par : ''}`) : ''}">${FIELDS.map(f => cell(r, f)).join('')}${srv().map(s => { const v = Number((r.montants || {})[s.code]) || 0; return `<td class="w-s"><input class="n ${v ? '' : 'z'}" data-s="${s.code}" inputmode="decimal" value="${fmtIn(v)}" placeholder="0" aria-label="${esc(s.libelle)}"></td>`; }).join('')}<td class="tot">${euro2(k.total)}</td><td class="ac"><button class="icon-btn" data-dup title="Dupliquer la ligne" aria-label="Dupliquer">${ic('copy')}</button><button class="icon-btn" data-del title="Supprimer la ligne" aria-label="Supprimer">${ic('trash')}</button></td></tr>`;
  }
  function draw(anim) {
    const l = list(); $('#mT', host).textContent = `${MOIS[m - 1]} ${S.annee}`;
    const sw = $('#sw', host);
    const html = `<table class="sheet"><thead><tr>${FIELDS.map(f => `<th class="${f[3] === 'c0' ? 'c0' : ''}">${f[1]}</th>`).join('')}${srv().map(s => `<th class="srv">${esc(s.entete)}<small>${esc(groupeLabel(s.groupe))}</small></th>`).join('')}<th style="text-align:right">Total</th><th></th></tr></thead>
      <tbody>${l.map(rowHTML).join('')}</tbody><tfoot><tr><td class="c0">${l.length} ligne${l.length > 1 ? 's' : ''}</td><td id="fHF"></td><td id="fHC"></td>${'<td></td>'.repeat(FIELDS.length - 3)}${srv().map(s => `<td data-f="${s.code}"></td>`).join('')}<td id="fT"></td><td></td></tr></tfoot></table>
      ${l.length ? '' : `<div class="empty"><p>Aucune intervention saisie en ${MOIS[m - 1].toLowerCase()} ${S.annee}.</p><button class="btn ghost sm" id="add0">${ic('plus')}Saisir la première</button></div>`}`;
    sw.innerHTML = html; foot(); kpis(); filter();
    if (anim && !RM) sw.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: EASE });
    const a0 = $('#add0', sw); if (a0) a0.onclick = addRow;
  }
  function foot() {
    const l = rowsMonth(m); const tot = {}; let T = 0, hf = 0, hc = 0;
    l.forEach(r => { const k = rowCalc(r); T += k.total; hf += hours(r.h_fourgon); hc += hours(r.h_camion); srv().forEach(s => tot[s.code] = (tot[s.code] || 0) + (Number((r.montants || {})[s.code]) || 0)); });
    srv().forEach(s => { const td = $(`tfoot td[data-f="${s.code}"]`, host); if (td) td.textContent = tot[s.code] ? euro(tot[s.code]) : ''; });
    const ft = $('#fT', host); if (ft) ft.textContent = euro2(T); const a = $('#fHF', host), b = $('#fHC', host); if (a) a.textContent = hhmm(hf); if (b) b.textContent = hhmm(hc);
  }
  function kpis() {
    const A = aggregate(rowsMonth(m)); const nm = n1Of(m); const d = nm ? (A.ca - nm) / nm * 100 : null;
    $('#mK', host).innerHTML = kpi('CA du mois', euro(A.ca), { delta: d }) + kpi('Interventions', num(A.n)) + kpi('Clients actifs', num(A.clients.size)) + kpi('CA moyen / interv.', euro(A.n ? A.ca / A.n : 0)) + kpi('Interventions COFRAC', num(A.cofN)) + kpi('CA COFRAC', euro(A.cofCA));
    segLabels();
  }
  function segLabels() { $$('#mSeg button[data-v]', host).forEach(b => { const n = rowsMonth(+b.dataset.v).length; const em = $('em', b); if (em) em.textContent = n || ''; }); }
  function filter() { $$('#sw tbody tr', host).forEach(tr => { const r = S.rows.find(x => x.id === tr.dataset.id); tr.hidden = !!q && r && ![r.client, r.lieu, r.fourgon, r.camion, r.dept].join(' ').toLowerCase().includes(q); }); }
  const rowOf = el => { const tr = el.closest('tr[data-id]'); return tr ? [tr, S.rows.find(x => x.id === tr.dataset.id)] : [null, null]; };

  host.addEventListener('input', e => {
    const t = e.target; if (!t.closest('#sw')) return; const [tr, r] = rowOf(t); if (!r) return;
    if (t.dataset.s) { const v = parseNum(t.value); const mt = { ...(r.montants || {}) }; if (v) mt[t.dataset.s] = r2(v); else delete mt[t.dataset.s]; r.montants = mt; t.classList.toggle('z', !v); t.classList.toggle('bad', t.value.trim() !== '' && !/^-?[\d\s ]*([.,]\d*)?$/.test(t.value.trim())); }
    else { const k = t.dataset.k; if (!k) return; if (k === 'cofrac') r.cofrac = t.checked; else if (k === 'personnes') r.personnes = t.value === '' ? null : Math.max(0, parseInt(t.value, 10) || 0); else if (k === 'fourgon' || k === 'camion') r[k] = t.value.toUpperCase().trim() || null; else r[k] = t.value === '' ? null : t.value; }
    $('.tot', tr).textContent = euro2(rowCalc(r).total); foot(); kpis();
    queueSave(r, t.type === 'checkbox' || t.type === 'date' ? 0 : 650);
  });
  host.addEventListener('focusout', e => {
    const t = e.target; if (!t.closest || !t.closest('#sw')) return;
    if (t.dataset.s) { const v = parseNum(t.value); t.value = fmtIn(v); }
    if (t.dataset.k === 'fourgon' || t.dataset.k === 'camion') t.value = t.value.toUpperCase().trim();
    if (t.dataset.k === 'h_fourgon' || t.dataset.k === 'h_camion') { const [, r] = rowOf(t); const h = hours(t.value); if (t.value.trim() && h) { t.value = hhmm(h); if (r && r[t.dataset.k] !== t.value) { r[t.dataset.k] = t.value; queueSave(r, 0); } } }
  });
  host.addEventListener('keydown', e => {
    const t = e.target; if (!t.closest || !t.closest('#sw') || t.tagName !== 'INPUT') return;
    if (e.key === 'Enter' || ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && t.type !== 'date' && !t.getAttribute('list'))) {
      e.preventDefault(); const td = t.closest('td'); const idx = [...td.parentNode.children].indexOf(td); let tr = td.parentNode;
      do { tr = e.key === 'ArrowUp' ? tr.previousElementSibling : tr.nextElementSibling; } while (tr && tr.hidden);
      if (tr) { const n = $('input', tr.children[idx]); if (n) { n.focus(); n.select && n.select(); } } else if (e.key === 'Enter') addRow();
    }
  });
  host.addEventListener('click', async e => {
    const del = e.target.closest('[data-del]'), dup = e.target.closest('[data-dup]');
    if (del) { const [tr, r] = rowOf(del); if (!r) return; const k = rowCalc(r);
      if (!(await confirmBox('Supprimer cette intervention ?', `${r.client || 'Sans client'} · ${r.jour ? fmtDate(r.jour) : 'sans date'} · ${euro2(k.total)}. La ligne disparaît pour tous les utilisateurs.`, { ok: 'Supprimer', danger: true }))) return;
      try { clearTimeout(pend.get(r.id)); pend.delete(r.id); await deleteRow(r.id); log('Suppression d\'une intervention', { mois: r.mois, client: r.client, total: k.total });
        await tr.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateX(-10px)' }], { duration: 240, fill: 'forwards' }).done; tr.remove(); foot(); kpis(); toast('Intervention supprimée', 'trash'); } catch (er) { toast(errMsg(er), 'alert'); }
    }
    if (dup) { const [, r] = rowOf(dup); if (!r) return; addRow(r); }
  });
  $('#addRow', host).onclick = () => addRow();

  async function addRow(from) {
    const l = rowsMonth(m); const ordre = (l.reduce((a, r) => Math.max(a, Number(r.ordre) || 0), 0)) + 1;
    const today = new Date(); const inMonth = today.getFullYear() === S.annee && today.getMonth() + 1 === m;
    const base = from ? { ...from, id: undefined, maj_le: undefined, maj_par: undefined, cree_le: undefined, montants: { ...(from.montants || {}) } } : { jour: inMonth ? `${S.annee}-${String(m).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}` : null, montants: {}, cofrac: false };
    const r = { ...base, annee: S.annee, mois: m, ordre };
    try { setSync('busy'); const saved = await saveRow(r); setSync('ok'); log(from ? 'Duplication d\'une intervention' : 'Ajout d\'une intervention', { mois: m });
      if (sort === 'date' || !$('#sw tbody', host) || $('#add0', host)) draw(); else { $('#sw tbody', host).insertAdjacentHTML('beforeend', rowHTML(saved)); foot(); kpis(); }
      const tr = $(`tr[data-id="${saved.id}"]`, host); if (tr) { tr.classList.add('flash'); tr.scrollIntoView({ block: 'nearest', behavior: RM ? 'auto' : 'smooth' }); const f = $(from ? 'input[data-k="jour"]' : 'input', tr); f && f.focus({ preventScroll: true }); }
    } catch (er) { setSync('err', errMsg(er)); toast(errMsg(er), 'alert'); }
  }

  /* realtime patch from other users */
  host._remote = (type, r) => {
    if (!host.isConnected) return;
    segLabels();
    if (!r || r.annee !== S.annee || (r.mois !== m && type !== 'DELETE')) { kpis(); return; }
    const tr = $(`tr[data-id="${r.id}"]`, host);
    if (type === 'DELETE') { if (tr) tr.remove(); foot(); kpis(); return; }
    if (!tr) { const tb = $('#sw tbody', host); if (!tb || $('#add0', host)) { draw(); return; } tb.insertAdjacentHTML('beforeend', rowHTML(r)); const n = $(`tr[data-id="${r.id}"]`, host); n && n.classList.add('flash'); }
    else if (!pend.has(r.id)) {
      const active = document.activeElement;
      $$('input', tr).forEach(inp => { if (inp === active) return;
        if (inp.dataset.s) { const v = Number((r.montants || {})[inp.dataset.s]) || 0; inp.value = fmtIn(v); inp.classList.toggle('z', !v); }
        else if (inp.dataset.k === 'cofrac') inp.checked = !!r.cofrac; else if (inp.dataset.k) inp.value = r[inp.dataset.k] ?? ''; });
      $('.tot', tr).textContent = euro2(rowCalc(r).total); if (!tr.contains(active)) tr.classList.remove('flash'), void tr.offsetWidth, tr.classList.add('flash');
    }
    foot(); kpis(); filter();
  };
  draw();
  if (ctx.params.focus) { const tr = $(`tr[data-id="${ctx.params.focus}"]`, host); if (tr) setTimeout(() => { tr.scrollIntoView({ block: 'center' }); tr.classList.add('flash'); }, 300); }
  stagger(host);
}

/* =========================================================
   ANALYSES : one view per decision
   ========================================================= */
export const PERIODS = [['an', 'Année'], ['t1', 'T1'], ['t2', 'T2'], ['t3', 'T3'], ['t4', 'T4'], ['s1', 'S1'], ['s2', 'S2']];
const range = p => ({ an: [1, 12], t1: [1, 3], t2: [4, 6], t3: [7, 9], t4: [10, 12], s1: [1, 6], s2: [7, 12] }[p] || [1, 12]);
function periodBar(host, ctx, extra = '') {
  const p = store.get('dl-period', 'an');
  host.insertAdjacentHTML('afterbegin', `<div class="toolbar" data-st><div class="seg glass glide scroll" id="perSeg"></div>${extra}</div>`);
  seg($('#perSeg', host), PERIODS, p, v => { store.set('dl-period', v); ctx.refresh(); });
  const [a, b] = range(p); return { p, a, b, rows: rowsYear().filter(r => r.mois >= a && r.mois <= b), label: p === 'an' ? `${S.annee}` : `${PERIODS.find(x => x[0] === p)[1]} ${S.annee}` };
}
const panel = (lab, title, sub, body, right = '') => `<section class="panel glass" data-st><div class="panel-head"><div><span class="label">${lab}</span><h2 style="margin-top:6px">${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div>${right}</div>${body}</section>`;
const question = (q, a) => `<div class="tile insight" data-st><span class="ico">${ic('bulb')}</span><p><b>${q}</b><br>${a}</p></div>`;

/* --- véhicules --- */
export function renderVehicules(host, ctx) {
  host.innerHTML = ''; const P = periodBar(host, ctx); const A = aggregate(P.rows); const am = activeMonths(P.rows);
  const H = {}; P.rows.forEach(r => { const vf = veh(r.fourgon), vc = veh(r.camion); if (vf) H[vf] = (H[vf] || 0) + hours(r.h_fourgon); if (vc) H[vc] = (H[vc] || 0) + hours(r.h_camion); });
  const vs = Object.entries(A.veh).map(([v, e]) => { const s = seuilOf(v), sa = s * Math.max(1, am.length), p = e.ca / sa * 100; return { v, e, s, sa, p, st: statut(p), h: H[v] || 0 }; }).sort((a, b) => b.e.ca - a.e.ca);
  const sel = store.get('dl-veh', vs[0] && vs[0].v); const cur = vs.find(x => x.v === sel) || vs[0];
  const known = Object.fromEntries(vehicules().map(v => [v.immat, v.type]));
  const ko = vs.filter(v => v.st[0] === 'ko');
  host.insertAdjacentHTML('beforeend', `
    ${question('Quels véhicules couvrent leur coût, lesquels faut-il réaffecter ou mieux remplir ?', ko.length ? `${ko.map(v => esc(v.v)).join(', ')} ${ko.length > 1 ? 'restent' : 'reste'} sous 70 % du seuil sur ${P.label}. Regardez les mois creux dans la grille ci-dessous avant de décider d'une réaffectation.` : 'Tous les véhicules imputés atteignent au moins 70 % de leur seuil sur la période.')}
    <div class="kpis k4">${kpi('CA imputé véhicules', euro(A.f + A.c))}${kpi('Dont fourgons', euro(A.f), { sub: A.f + A.c ? pct(A.f / (A.f + A.c) * 100) : '' })}${kpi('Non imputable', euro(A.ni), { sub: 'Déplacements, déchets' })}${kpi('Non affecté', euro(A.na), { sub: A.na ? 'Véhicule manquant' : 'Tout est affecté' })}</div>
    ${panel('Seuil de rentabilité', 'Grille mensuelle par véhicule', `Chaque case : CA imputé du mois et pourcentage du seuil mensuel. Vert au-delà de 100 %, orange entre 70 et 100 %, rouge en dessous.`,
      `<div class="tbl-wrap"><table class="tbl heat"><thead><tr><th>Véhicule</th>${MC.slice(P.a - 1, P.b).map(m => `<th class="num">${m}</th>`).join('')}<th class="num">CA</th><th class="num">Seuil</th><th class="num">%</th><th>Statut</th></tr></thead><tbody>
      ${vs.map(v => `<tr class="click" data-v="${esc(v.v)}"><td><b style="color:var(--head)">${esc(v.v)}</b><br><span class="small muted">${esc(known[v.v] || 'Hors liste véhicules')}</span></td>${Array.from({ length: P.b - P.a + 1 }, (_, i) => { const mm = P.a + i; const ca = v.e.months[mm] || 0; if (!am.includes(mm)) return '<td class="h"></td>'; const p = ca / v.s * 100; const [k] = statut(p); const a = k === 'ok' ? Math.min(34, 10 + (p - 100) / 6) : k === 'ko' ? Math.min(30, 8 + (70 - p) / 4) : 0; return `<td class="h ${k}" style="--a:${a.toFixed(0)}" data-tip="${esc(`<b>${v.v} · ${MOIS[mm - 1]}</b><br>${euro(ca)} sur ${euro(v.s)}<br>${pct(p)}`)}">${ca ? keur(ca) : '0'}<small>${pct(p, 0)}</small></td>`; }).join('')}
      <td class="num"><b>${euro(v.e.ca)}</b></td><td class="num">${euro(v.sa)}</td><td class="num">${pct(v.p, 0)}</td><td><span class="st ${v.st[0]}">${v.st[1]}</span></td></tr>`).join('')}</tbody></table></div>`)}
    <div class="split">${cur ? panel('Véhicule', esc(cur.v), `${esc(known[cur.v] || '')} · seuil mensuel ${euro(cur.s)}`, columns(MC.map((l, i) => ({ label: l, v: cur.e.months[i + 1] || 0, dim: !(cur.e.months[i + 1] >= cur.s) })).slice(P.a - 1, P.b), { seuil: cur.s, label: 'CA imputé' })) : ''}
    ${panel('Productivité', 'CA par heure et par véhicule', 'Heures fourgon ou camion déclarées sur les lignes du véhicule.', `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Véhicule</th><th class="num">Heures</th><th class="num">CA</th><th class="num">CA / heure</th></tr></thead><tbody>${vs.map(v => `<tr><td>${esc(v.v)}</td><td class="num">${hhmm(v.h) || '-'}</td><td class="num">${euro(v.e.ca)}</td><td class="num"><b>${v.h ? euro(v.e.ca / v.h) : '-'}</b></td></tr>`).join('')}</tbody></table></div>`)}</div>`);
  host.onclick = e => { const tr = e.target.closest('tr[data-v]'); if (tr) { store.set('dl-veh', tr.dataset.v); ctx.refresh(); } };
  after(host);
}

/* --- clients --- */
export function renderClients(host, ctx) {
  host.innerHTML = ''; const P = periodBar(host, ctx); const A = aggregate(P.rows);
  const cl = [...A.clients.entries()].map(([k, e]) => ({ k, ...e })).sort((a, b) => b.ca - a.ca);
  let cum = 0; const tot = A.ca || 1; cl.forEach(c => { cum += c.ca; c.cum = cum / tot * 100; });
  const n80 = cl.findIndex(c => c.cum >= 80) + 1; const top1 = cl[0];
  host.insertAdjacentHTML('beforeend', `
    ${question('Sur quels clients concentrer l\'effort commercial, et quel est le risque de dépendance ?', cl.length ? `${n80} client${n80 > 1 ? 's' : ''} sur ${cl.length} font 80 % du chiffre d'affaires. ${top1 ? `Le premier, ${esc(top1.k)}, pèse ${pct(top1.ca / tot * 100)} à lui seul.` : ''}` : 'Aucune donnée sur la période.')}
    <div class="kpis k4">${kpi('Clients actifs', num(cl.length))}${kpi('Clients à 80 % du CA', num(n80), { sub: cl.length ? pct(n80 / cl.length * 100, 0) + ' du portefeuille' : '' })}${kpi('Part du 1er client', top1 ? pct(top1.ca / tot * 100) : '-')}${kpi('Clients ponctuels', num(cl.filter(c => c.n === 1).length), { sub: 'Une seule intervention' })}</div>
    ${panel('Pareto', 'Concentration du chiffre d\'affaires', 'Barres : CA par client, du plus important au plus petit. Courbe : part cumulée.', pareto(cl.map(c => ({ k: c.k, v: c.ca })), { top: Math.min(25, cl.length) }))}
    ${panel('Portefeuille', 'Tous les clients', '', `<div class="tbl-wrap" style="max-height:560px;overflow:auto"><table class="tbl"><thead><tr><th>#</th><th>Client</th><th class="num">CA</th><th class="num">Part</th><th class="num">Cumul</th><th class="num">Interv.</th><th class="num">Panier moyen</th><th class="num">Mois actifs</th><th class="num">COFRAC</th><th>Dépt principal</th></tr></thead><tbody id="clT">
      ${cl.map((c, i) => { const dp = Object.entries(c.dept).sort((a, b) => b[1] - a[1])[0]; return `<tr data-q="${esc(c.k.toLowerCase())}"><td class="muted">${i + 1}</td><td><b style="color:var(--head)">${esc(c.k)}</b> ${c.cum - c.ca / tot * 100 < 80 ? '<span class="chip" style="margin-left:4px">A</span>' : ''}</td><td class="num"><b>${euro(c.ca)}</b></td><td class="num">${pct(c.ca / tot * 100)}</td><td class="num muted">${pct(c.cum, 0)}</td><td class="num">${c.n}</td><td class="num">${euro(c.ca / c.n)}</td><td class="num">${c.months.size}</td><td class="num">${c.cof || ''}</td><td>${dp && dp[0] ? esc(deptName(dp[0])) : '-'}</td></tr>`; }).join('')}</tbody></table></div>`, `<input class="input" id="clQ" placeholder="Rechercher un client" style="max-width:260px;min-height:40px">`)}`);
  $('#clQ', host).oninput = e => { const q = e.target.value.trim().toLowerCase(); $$('#clT tr', host).forEach(tr => tr.hidden = q && !tr.dataset.q.includes(q)); };
  const sug = similarClients();
  host.insertAdjacentHTML('beforeend', panel('Qualité des données', 'Noms de clients à harmoniser', 'Un même client saisi sous plusieurs orthographes fausse le classement et la concentration. La fusion renomme les lignes concernées, toutes années confondues.',
    `<div class="alerts">${sug.map(([a, b]) => `<div class="tile it"><span class="ico warn">${ic('users')}</span><div style="min-width:0"><b>${esc(a.k)}</b> <span class="muted">et</span> <b>${esc(b.k)}</b><span class="s">${a.n} et ${b.n} interventions</span></div><button class="btn ghost sm mag" data-merge="${esc(b.k)}" data-into="${esc(a.k)}">Fusionner vers ${esc(a.k)}</button></div>`).join('') || `<div class="tile insight"><span class="ico ok">${ic('check')}</span><p>Aucun doublon probable détecté.</p></div>`}</div>`,
    `<button class="btn ghost sm mag" id="mergeAny">${ic('users')}Fusionner deux clients</button>`));
  host.onclick = async e => {
    const b = e.target.closest('[data-merge]'); if (b) { mergeClients(b.dataset.merge, b.dataset.into, ctx); return; }
    if (e.target.closest('#mergeAny')) {
      const names = [...new Set(S.rows.map(r => (r.client || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
      const opts = names.map(n => `<option>${esc(n)}</option>`).join('');
      const { el, close } = modal(`<div class="modal-head"><div><span class="label">Clients</span><h2 style="margin-top:6px">Fusionner deux clients</h2><p>Toutes les interventions du premier client prennent le nom du second.</p></div><button class="icon-btn" data-close aria-label="Fermer">${ic('x')}</button></div>
        <div class="form"><label class="field"><span>Client à renommer</span><select class="input" id="mA">${opts}</select></label><label class="field"><span>Nom à conserver</span><select class="input" id="mB">${opts}</select></label></div>
        <div class="modal-foot"><button class="btn ghost" data-close>Annuler</button><button class="btn mag" id="mGo">Fusionner</button></div>`);
      $('#mGo', el).onclick = async () => { const a = $('#mA', el).value, t = $('#mB', el).value; if (a === t) { $('#mB', el).classList.add('bad'); return; } close(); mergeClients(a, t, ctx); };
    }
  };
  after(host);
}
const lev = (a, b) => {
  const m = a.length, n = b.length; if (Math.abs(m - n) > 2) return 9;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]); for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[m][n];
};
function similarClients() {
  const cnt = new Map(); S.rows.forEach(r => { const k = (r.client || '').trim(); if (k) cnt.set(k, (cnt.get(k) || 0) + 1); });
  const L = [...cnt.entries()].map(([k, n]) => ({ k, n, c: norm(k).replace(/ /g, '') })); const out = [];
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const a = L[i], b = L[j]; const short = a.c.length < b.c.length ? a.c : b.c, long = short === a.c ? b.c : a.c;
    const hit = a.c === b.c || (short.length >= 4 && long.startsWith(short) && long.length - short.length <= 8) || (short.length >= 5 && lev(a.c, b.c) <= (short.length >= 7 ? 2 : 1));
    if (hit) out.push(a.n >= b.n ? [a, b] : [b, a]);
  }
  return out.sort((x, y) => (y[0].n + y[1].n) - (x[0].n + x[1].n)).slice(0, 20);
}
async function mergeClients(from, into, ctx) {
  const n = S.rows.filter(r => (r.client || '').trim() === from).length;
  if (!(await confirmBox(`Renommer ${from} en ${into} ?`, `${n} intervention${n > 1 ? 's' : ''} ${n > 1 ? 'sont concernées' : 'est concernée'}, toutes années confondues. L'opération se défait en renommant à nouveau.`, { ok: 'Fusionner' }))) return;
  const { error } = await sb.from('chantier_interventions').update({ client: into }).eq('client', from);
  if (error) { toast(errMsg(error), 'alert'); return; }
  S.rows.forEach(r => { if ((r.client || '').trim() === from) r.client = into; });
  log('Fusion de clients', { texte: `${from} → ${into}`, lignes: n }); toast(`${n} ligne${n > 1 ? 's' : ''} renommée${n > 1 ? 's' : ''}`); ctx.refresh();
}


/* --- services --- */
export function renderServices(host, ctx) {
  host.innerHTML = ''; const P = periodBar(host, ctx); const A = aggregate(P.rows); const sv = allServices().filter(s => s.actif || A.srv[s.code]);
  const months = Array.from({ length: P.b - P.a + 1 }, (_, i) => P.a + i);
  const byM = Object.fromEntries(months.map(m => [m, aggregate(P.rows.filter(r => r.mois === m)).srv]));
  const half = Math.floor(months.length / 2); const h1 = months.slice(0, half), h2 = months.slice(half);
  const g = GROUPES.map(([k, l]) => ({ k: l, v: sv.filter(s => s.groupe === k).reduce((a, s) => a + (A.srv[s.code] || 0), 0) }));
  const ranked = sv.map(s => ({ s, v: A.srv[s.code] || 0, n: A.srvN[s.code] || 0, t1: h1.reduce((a, m) => a + (byM[m][s.code] || 0), 0), t2: h2.reduce((a, m) => a + (byM[m][s.code] || 0), 0) })).sort((a, b) => b.v - a.v);
  const best = ranked[0];
  host.insertAdjacentHTML('beforeend', `
    ${question('Quels services portent l\'activité, lesquels développer ou revoir en prix ?', best && best.v ? `${esc(best.s.libelle)} est le premier service avec ${pct(best.v / (A.ca || 1) * 100)} du CA. Comparez le montant moyen par intervention pour repérer les prestations sous-facturées.` : 'Aucune donnée sur la période.')}
    <div class="split">${panel('Mix mensuel', 'CA par service et par mois', 'Survolez une colonne pour le détail.', columns(months.map(m => ({ label: MC[m - 1], parts: ranked.map(x => ({ k: x.s.libelle, v: byM[m][x.s.code] || 0 })) })), { stacked: true, h: 280 }))}
    ${panel('Imputation', 'CA par groupe', 'Fourgon, camion ou non imputable, selon le réglage de chaque service.', donut(g, { center: keur(A.ca), sub: P.label }))}</div>
    ${panel('Services', 'Performance par service', months.length > 1 ? `Tendance : seconde moitié de la période comparée à la première.` : '', `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Service</th><th>Groupe</th><th class="num">CA</th><th class="num">Part</th><th class="num">Interventions</th><th class="num">Montant moyen</th><th class="num">Tendance</th></tr></thead><tbody>
      ${ranked.map((x, i) => { const tr = x.t1 ? (x.t2 - x.t1) / x.t1 * 100 : null; return `<tr><td><i class="bdot" style="background:${pal()[i % 13]};margin-right:8px"></i><b style="color:var(--head)">${esc(x.s.libelle)}</b>${x.s.actif ? '' : ' <span class="chip gray">Inactif</span>'}</td><td>${esc(groupeLabel(x.s.groupe))}</td><td class="num"><b>${euro(x.v)}</b></td><td class="num">${pct(x.v / (A.ca || 1) * 100)}</td><td class="num">${x.n}</td><td class="num">${x.n ? euro(x.v / x.n) : '-'}</td><td class="num" style="color:var(--${tr == null ? 'muted' : tr >= 0 ? 'ok' : 'err'})">${tr == null ? '-' : (tr >= 0 ? '+' : '-') + pct(Math.abs(tr), 0)}</td></tr>`; }).join('')}</tbody></table></div>`)}`);
  after(host);
}

/* --- territoire --- */
export function renderTerritoire(host, ctx) {
  host.innerHTML = ''; const P = periodBar(host, ctx); const A = aggregate(P.rows);
  const ds = Object.entries(A.dept).map(([k, e]) => ({ k, ...e })).sort((a, b) => b.ca - a.ca);
  const cs = Object.entries(A.commune).map(([k, e]) => ({ k, ...e })).sort((a, b) => b.ca - a.ca);
  const depT = ds.reduce((a, d) => a + d.dep, 0), avg = A.ca ? depT / A.ca : 0; const far = ds.filter(d => d.ca && d.dep / d.ca > avg * 1.1).sort((a, b) => b.dep / b.ca - a.dep / a.ca);
  host.insertAdjacentHTML('beforeend', `
    ${question('Où se fait le chiffre d\'affaires, et quelles zones coûtent trop en déplacement ?', ds.length ? `${esc(deptName(ds[0].k))} concentre ${pct(ds[0].ca / (A.ca || 1) * 100)} du CA. Les déplacements représentent ${pct(avg * 100)} du CA en moyenne. ${far.length ? `Ils pèsent nettement plus en ${far.map(d => `${esc(deptName(d.k))} (${pct(d.dep / d.ca * 100)})`).join(', ')} : regrouper les interventions ou revoir le forfait.` : 'Aucune zone ne s\'écarte nettement de cette moyenne.'}` : 'Aucune donnée.')}
    <div class="split">${panel('Départements', 'CA par département', '', hbars(ds.map(d => ({ k: deptName(d.k), v: d.ca, sub: `${d.n} interventions` }))))}
    ${panel('Déplacements', 'Poids des déplacements', 'Montant facturé en déplacement rapporté au CA de la zone.', `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Département</th><th class="num">Interv.</th><th class="num">Panier</th><th class="num">Déplac.</th><th class="num">Part</th></tr></thead><tbody>${ds.map(d => `<tr><td>${esc(deptName(d.k))}</td><td class="num">${d.n}</td><td class="num">${euro(d.ca / d.n)}</td><td class="num">${euro(d.dep)}</td><td class="num" style="color:var(--${d.ca && d.dep / d.ca > avg * 1.1 ? 'err' : 'text'})">${d.ca ? pct(d.dep / d.ca * 100) : '-'}</td></tr>`).join('')}</tbody></table></div>`)}</div>
    ${panel('Communes', 'Communes les plus actives', 'Commune lue au début du lieu de travaux.', `<div class="tbl-wrap" style="max-height:520px;overflow:auto"><table class="tbl"><thead><tr><th>Commune</th><th>Département</th><th class="num">Interventions</th><th class="num">CA</th><th class="num">Part</th></tr></thead><tbody>${cs.slice(0, 60).map(c => `<tr><td><b style="color:var(--head)">${esc(c.k)}</b></td><td>${esc(deptName(c.dept))}</td><td class="num">${c.n}</td><td class="num"><b>${euro(c.ca)}</b></td><td class="num">${pct(c.ca / (A.ca || 1) * 100)}</td></tr>`).join('')}</tbody></table></div>`)}`);
  after(host);
}

/* --- tendance N-1 --- */
export function renderTendance(host, ctx) {
  host.innerHTML = ''; const rows = rowsYear(); const A = aggregate(rows); const am = activeMonths(rows); const last = am.length ? am[am.length - 1] : 0;
  let c = 0, c1 = 0; const cur = [], prev = [], tab = [];
  for (let m = 1; m <= 12; m++) { const ca = (A.months[m] || {}).ca || 0, p = n1Of(m); c1 += p; prev.push(p ? c1 : null); if (m <= last) { c += ca; cur.push(c); } else cur.push(null); tab.push({ m, ca, p, c: m <= last ? c : null, c1 }); }
  const n1ytd = tab.filter(t => t.m <= last).reduce((a, t) => a + t.p, 0); const ratio = n1ytd ? c / n1ytd : null;
  const proj = []; let pc = c; for (let m = 1; m <= 12; m++) { if (m < last) proj.push(null); else if (m === last) proj.push(c); else { pc += n1Of(m) * (ratio || 1); proj.push(pc); } }
  host.innerHTML = `
    ${question(`L'année ${S.annee} est-elle en avance ou en retard sur ${S.annee - 1} ?`, n1ytd ? `Cumul à fin ${MOIS[last - 1].toLowerCase()} : ${euro(c)} contre ${euro(n1ytd)} en ${S.annee - 1}, soit ${c >= n1ytd ? '+' : '-'}${pct(Math.abs((c - n1ytd) / n1ytd * 100))}. Projection de fin d'année, au même écart que ${S.annee - 1} : ${euro(pc)}.` : `Renseignez le chiffre d'affaires ${S.annee - 1} dans Paramètres pour activer la comparaison.`)}
    <div class="kpis k4">${kpi(`Cumul ${S.annee}`, euro(c))}${kpi(`Cumul ${S.annee - 1} (mêmes mois)`, euro(n1ytd))}${kpi('Écart', euro(c - n1ytd), { delta: n1ytd ? (c - n1ytd) / n1ytd * 100 : null })}${kpi('Projection fin d\'année', euro(pc), { sub: `${S.annee - 1} : ${euro(c1)}` })}</div>
    ${panel('Cumul', 'Chiffre d\'affaires cumulé', `Trait plein : ${S.annee}. Pointillés : ${S.annee - 1} et projection.`, lines([{ k: String(S.annee), pts: cur }, { k: String(S.annee - 1), pts: prev, dash: true, color: 'var(--muted)' }, { k: 'Projection', pts: proj, dash: true, color: 'var(--accent)' }], { labels: MC }))}
    ${panel('Détail', 'Mois par mois', '', `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Mois</th><th class="num">CA ${S.annee}</th><th class="num">CA ${S.annee - 1}</th><th class="num">Écart</th><th class="num">Écart %</th><th class="num">Cumul ${S.annee}</th><th class="num">Cumul ${S.annee - 1}</th></tr></thead><tbody>${tab.map(t => `<tr><td>${MOIS[t.m - 1]}</td><td class="num"><b>${t.m <= last ? euro(t.ca) : '-'}</b></td><td class="num">${t.p ? euro(t.p) : '-'}</td><td class="num" style="color:var(--${t.ca - t.p >= 0 ? 'ok' : 'err'})">${t.m <= last && t.p ? euro(t.ca - t.p) : '-'}</td><td class="num">${t.m <= last && t.p ? pct((t.ca - t.p) / t.p * 100) : '-'}</td><td class="num">${t.c != null ? euro(t.c) : '-'}</td><td class="num">${euro(t.c1)}</td></tr>`).join('')}</tbody></table></div>`)}`;
  after(host);
}

/* --- productivité (responsable technique) --- */
export function renderProductivite(host, ctx) {
  host.innerHTML = ''; const P = periodBar(host, ctx); const months = Array.from({ length: P.b - P.a + 1 }, (_, i) => P.a + i);
  const per = months.map(m => { const rs = P.rows.filter(r => r.mois === m); const A = aggregate(rs); const pers = rs.reduce((a, r) => a + (Number(r.personnes) || 0), 0); return { m, A, pers, n: rs.length }; });
  const A = aggregate(P.rows); const persAvg = P.rows.length ? P.rows.reduce((a, r) => a + (Number(r.personnes) || 0), 0) / P.rows.length : 0;
  const caHF = A.hF ? A.f / A.hF : 0, caHC = A.hC ? A.c / A.hC : 0;
  const days = new Set(P.rows.map(r => r.jour).filter(Boolean)).size;
  host.insertAdjacentHTML('beforeend', `
    ${question('Les équipes et le matériel sont-ils bien chargés ?', P.rows.length ? `Sur ${P.label}, ${hhmm(A.hF)} heures fourgon et ${hhmm(A.hC)} heures camion ont été déclarées, pour ${euro(caHF)} par heure fourgon et ${euro(caHC)} par heure camion. ${num(days)} jours travaillés, ${num(P.rows.length / Math.max(1, days), 1)} interventions par jour en moyenne.` : 'Aucune donnée.')}
    <div class="kpis">${kpi('Heures fourgon', hhmm(A.hF) || '0:00')}${kpi('Heures camion', hhmm(A.hC) || '0:00')}${kpi('CA / heure fourgon', euro(caHF))}${kpi('CA / heure camion', euro(caHC))}${kpi('Personnes / interv.', num(persAvg, 1))}${kpi('Heures-personnes', num(A.persH, 0))}</div>
    <div class="grid g2">${panel('Charge', 'Heures fourgon par mois', '', columns(per.map(x => ({ label: MC[x.m - 1], v: x.A.hF })), { fmt: v => (hhmm(v) || '0:00') + ' h', label: 'Heures', axis: v => num(v) + ' h' }))}
    ${panel('Charge', 'Heures camion par mois', '', columns(per.map(x => ({ label: MC[x.m - 1], v: x.A.hC })), { fmt: v => (hhmm(v) || '0:00') + ' h', label: 'Heures', axis: v => num(v) + ' h' }))}</div>
    ${panel('Rendement', 'Indicateurs mensuels', '', `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Mois</th><th class="num">Interv.</th><th class="num">H. fourgon</th><th class="num">H. camion</th><th class="num">CA / h fourgon</th><th class="num">CA / h camion</th><th class="num">Pers. moy.</th><th class="num">CA / interv.</th></tr></thead><tbody>${per.map(x => `<tr><td>${MOIS[x.m - 1]}</td><td class="num">${x.n}</td><td class="num">${hhmm(x.A.hF) || '-'}</td><td class="num">${hhmm(x.A.hC) || '-'}</td><td class="num">${x.A.hF ? euro(x.A.f / x.A.hF) : '-'}</td><td class="num">${x.A.hC ? euro(x.A.c / x.A.hC) : '-'}</td><td class="num">${x.n ? num(x.pers / x.n, 1) : '-'}</td><td class="num"><b>${x.n ? euro(x.A.ca / x.n) : '-'}</b></td></tr>`).join('')}</tbody></table></div>`)}`);
  after(host);
}

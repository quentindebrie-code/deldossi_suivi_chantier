/* =========================================================
   DONNÉES (import / export / journal) + PARAMÈTRES
   ========================================================= */
import {
  sb, $, $$, esc, S, MOIS, MC, euro, euro2, num, pct, fmtDT, ic, seg, toast, modal, confirmBox, loadLib, download, stagger, store,
  rowsYear, rowsMonth, rowCalc, activeServices, allServices, vehicules, seuilDefaut, deptName, n1, setParam, log, errMsg, loadAll, emit,
  norm, slug, parseNum, r2, hours, hhmm, veh, GROUPES, groupeLabel, years_, EASE, RM, pick
} from './core.js?v=2';

const colL = n => { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }; // 0 -> A

/* =========================================================
   DONNÉES
   ========================================================= */
export function renderDonnees(host, ctx) {
  host.innerHTML = `
  <div class="grid g2">
    <section class="panel glass" data-st><div class="panel-head"><div><span class="label">Importer</span><h2 style="margin-top:6px">Depuis le classeur Excel</h2><p>Pour travailler dans Excel puis visualiser ici. Les onglets Janvier à Décembre sont lus, les montants recalculés.</p></div></div>
      <label class="drop" id="drop"><span class="ico">${ic('upload')}</span><b style="color:var(--head)">Déposez le fichier .xlsx ici</b><p>ou cliquez pour le choisir. Aperçu et contrôle avant tout remplacement.</p><input type="file" id="file" accept=".xlsx,.xlsm,.xls" hidden></label></section>
    <section class="panel glass" data-st><div class="panel-head"><div><span class="label">Exporter</span><h2 style="margin-top:6px">Classeur et CSV</h2><p>Le classeur reprend la structure du fichier de suivi avec ses formules : totaux, KPI, CA par service, rentabilité des véhicules et synthèse annuelle.</p></div></div>
      <div class="rows">
        <button class="tile click rowi" id="xX" style="text-align:left"><span class="ico">${ic('file')}</span><div class="t"><b>Classeur Excel ${S.annee} avec formules</b><span>12 onglets mensuels, synthèse et paramètres (.xlsx)</span></div><span class="a">${ic('dl')}</span></button>
        <button class="tile click rowi" id="xC" style="text-align:left"><span class="ico">${ic('grid')}</span><div class="t"><b>CSV ${S.annee}, valeurs</b><span>Une ligne par intervention, séparateur point-virgule</span></div><span class="a">${ic('dl')}</span></button>
        <button class="tile click rowi" id="xF" style="text-align:left"><span class="ico">${ic('grid')}</span><div class="t"><b>CSV ${S.annee} avec formules</b><span>Totaux et imputation en formules Excel françaises</span></div><span class="a">${ic('dl')}</span></button>
      </div></section>
  </div>
  <section class="panel glass" data-st><div class="panel-head"><div><span class="label">Traçabilité</span><h2 style="margin-top:6px">Journal des modifications</h2><p>Ajouts, suppressions, imports et changements de paramètres. Chaque ligne garde aussi l'auteur et l'heure de sa dernière modification.</p></div><button class="btn ghost sm mag" id="jR">${ic('sync')}Actualiser</button></div>
    <div id="jr" class="jr" style="max-height:480px"><p class="muted small">Chargement</p></div></section>`;
  const fi = $('#file', host), dr = $('#drop', host);
  fi.onchange = () => fi.files[0] && importFile(fi.files[0], ctx);
  ['dragenter', 'dragover'].forEach(t => dr.addEventListener(t, e => { e.preventDefault(); dr.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => dr.addEventListener(t, e => { e.preventDefault(); dr.classList.remove('over'); }));
  dr.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) importFile(f, ctx); });
  $('#xX', host).onclick = e => busy(e.currentTarget, exportXLSX);
  $('#xC', host).onclick = () => exportCSV(false);
  $('#xF', host).onclick = () => exportCSV(true);
  $('#jR', host).onclick = () => journal(host);
  journal(host); stagger(host);
}
async function busy(btn, fn) { btn.style.pointerEvents = 'none'; btn.style.opacity = .6; try { await fn(); } catch (e) { console.error(e); toast('Export impossible. Vérifiez votre connexion puis réessayez.', 'alert'); } btn.style.pointerEvents = ''; btn.style.opacity = ''; }
async function journal(host) {
  const box = $('#jr', host); const { data, error } = await sb.from('chantier_journal').select('*').order('cree_le', { ascending: false }).limit(150);
  if (error) { box.innerHTML = '<p class="muted small">Journal indisponible.</p>'; return; }
  box.innerHTML = (data || []).map(j => `<div class="tile e"><small>${fmtDT(j.cree_le)} · ${esc(j.auteur || '')}</small>${esc(j.action)}${detail(j.details)}</div>`).join('') || '<p class="muted small">Aucune entrée pour le moment.</p>';
}
const detail = d => { if (!d || !Object.keys(d).length) return ''; const parts = []; if (d.mois) parts.push(Array.isArray(d.mois) ? d.mois.map(m => MOIS[m - 1]).join(', ') : MOIS[d.mois - 1]); if (d.client) parts.push(d.client); if (d.total) parts.push(euro2(d.total)); if (d.lignes) parts.push(`${d.lignes} lignes`); if (d.service) parts.push(d.service); if (d.texte) parts.push(d.texte); return parts.length ? `<span class="muted"> · ${esc(parts.join(' · '))}</span>` : ''; };

/* ---------- CSV ---------- */
function exportCSV(withF) {
  const srv = activeServices(); const rows = rowsYear().sort((a, b) => a.mois - b.mois || a.ordre - b.ordre);
  const head = ['Mois', 'Date', 'H. fourgon', 'H. camion', 'Pers.', 'Fourgon', 'Camion', 'Lieu de travaux', 'COFRAC', 'Client', 'Dépt', ...srv.map(s => s.libelle), 'Total', 'CA fourgon', 'CA camion', 'Véhicule fourgon', 'Véhicule camion'];
  const q = v => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const n = v => v ? String(r2(v)).replace('.', ',') : '0';
  const c0 = 11, cT = c0 + srv.length; const L = i => colL(i);
  const fC = srv.map((s, i) => [s, L(c0 + i)]);
  const out = [head.map(q).join(';')];
  rows.forEach((r, i) => {
    const k = rowCalc(r); const x = i + 2;
    const sum = g => { const cs = fC.filter(([s]) => s.groupe === g).map(([, c]) => `${c}${x}`); return cs.length ? `=SOMME(${cs.join(';')})` : '0'; };
    out.push([MOIS[r.mois - 1], r.jour ? r.jour.split('-').reverse().join('/') : '', r.h_fourgon || '', r.h_camion || '', r.personnes ?? '', veh(r.fourgon), veh(r.camion), r.lieu || '', r.cofrac ? 'Oui' : 'Non', r.client || '', r.dept || '',
      ...srv.map(s => n((r.montants || {})[s.code])),
      withF ? `=SOMME(${L(c0)}${x}:${L(cT - 1)}${x})` : n(k.total),
      withF ? sum('fourgon') : n(k.f), withF ? sum('camion') : n(k.c),
      withF ? `=SI(F${x}<>"";F${x};G${x})` : k.vf, withF ? `=SI(G${x}<>"";G${x};F${x})` : k.vc].map(q).join(';'));
  });
  download(`Suivi_Chantier_${S.annee}${withF ? '_formules' : ''}.csv`, out.join('\r\n'));
  log('Export CSV', { texte: withF ? 'avec formules' : 'valeurs', lignes: rows.length });
}

/* ---------- XLSX with formulas (ExcelJS) ---------- */
export async function exportXLSX() {
  toast('Préparation du classeur', 'file');
  await loadLib('exceljs'); const EX = window.ExcelJS; const wb = new EX.Workbook(); wb.creator = 'Deldossi · Suivi de chantier'; wb.created = new Date();
  const srv = activeServices(); const vs = vehicules(); const Y = S.annee; const N1 = n1();
  const NAVY = 'FF081B3D', BLUE = 'FF286ACB', ACIER = 'FFC8D3DE', CRAIE = 'FFF5F4F0', FONT = 'Poppins';
  const money = '#,##0.00 "€";-#,##0.00 "€";"-"', pctF = '0.0%', timeF = '[h]:mm';
  const hdr = c => { c.font = { name: FONT, bold: true, size: 9, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }; c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }; };
  const tot = c => { c.font = { name: FONT, bold: true, size: 10, color: { argb: NAVY } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACIER } }; };
  const title = (ws, t) => { ws.getCell('B2').value = t; ws.getCell('B2').font = { name: FONT, bold: true, size: 16, color: { argb: NAVY } }; };

  /* Paramètres */
  const wp = wb.addWorksheet('Paramètres', { properties: { tabColor: { argb: ACIER } } });
  title(wp, 'PARAMÈTRES'); wp.getCell('B4').value = 'Seuil mensuel par défaut'; wp.getCell('C4').value = seuilDefaut(); wp.getCell('C4').numFmt = money;
  ['Service', 'En-tête', 'Groupe'].forEach((h, i) => hdr(Object.assign(wp.getCell(6, 2 + i), { value: h })));
  srv.forEach((s, i) => { wp.getCell(7 + i, 2).value = s.libelle; wp.getCell(7 + i, 3).value = s.entete; wp.getCell(7 + i, 4).value = groupeLabel(s.groupe); });
  const vr0 = 9 + srv.length;
  ['Véhicule', 'Type', 'Seuil mensuel'].forEach((h, i) => hdr(Object.assign(wp.getCell(vr0, 2 + i), { value: h })));
  vs.forEach((v, i) => { const r = vr0 + 1 + i; wp.getCell(r, 2).value = v.immat; wp.getCell(r, 3).value = v.type || ''; const c = wp.getCell(r, 4); c.value = Number(v.seuil) > 0 ? Number(v.seuil) : { formula: '$C$4' }; c.numFmt = money; c.font = { name: FONT, color: { argb: BLUE } }; });
  const seuilRef = i => `'Paramètres'!$D$${vr0 + 1 + i}`;
  wp.columns = [{ width: 3 }, { width: 28 }, { width: 34 }, { width: 18 }];

  /* months */
  const C0 = 10; // K (0-based index 10)
  const cols = { date: 1, hf: 2, hc: 3, p: 4, f: 5, c: 6, lieu: 7, cof: 8, cli: 9 };
  const sc = i => C0 + i, cT = C0 + srv.length, cD = cT + 1, cAF = cD + 2, cAC = cAF + 1, cVF = cAC + 1, cVC = cVF + 1, cLn = cVC + 1;
  const months = [];
  for (let m = 1; m <= 12; m++) {
    const ws = wb.addWorksheet(MOIS[m - 1], { views: [{ state: 'frozen', xSplit: 2, ySplit: 8 }], properties: { tabColor: { argb: BLUE } } });
    title(ws, `SUIVI DE CHANTIER  ·  ${MOIS[m - 1].toUpperCase()} ${Y}`);
    const rows = rowsMonth(m, Y); const first = 9, last = first + Math.max(rows.length + 15, 40) - 1, totR = last + 1;
    const rg = c => `${colL(c)}${first}:${colL(c)}${last}`;
    const heads = ['DATE', 'H. FOURGON', 'H. CAMION', 'PERS.', 'FOURGON', 'CAMION', 'LIEU DE TRAVAUX', 'COFRAC', 'CLIENT'];
    heads.forEach((h, i) => hdr(Object.assign(ws.getCell(8, 2 + i), { value: h })));
    srv.forEach((s, i) => hdr(Object.assign(ws.getCell(8, sc(i) + 1), { value: s.entete })));
    hdr(Object.assign(ws.getCell(8, cT + 1), { value: 'TOTAL' })); hdr(Object.assign(ws.getCell(8, cD + 1), { value: 'DEPT' }));
    [['CA FOURGON', cAF], ['CA CAMION', cAC], ['VÉH. FOURGON', cVF], ['VÉH. CAMION', cVC], ['LIGNE', cLn]].forEach(([h, c]) => { const x = ws.getCell(8, c + 1); x.value = h; x.font = { name: FONT, bold: true, size: 8, color: { argb: 'FF5B636A' } }; x.alignment = { horizontal: 'center' }; });
    ws.getCell(7, 2).value = 'DÉTAIL DES INTERVENTIONS  —  texte bleu = saisie, colonnes grises = calcul d\'imputation'; ws.getCell(7, 2).font = { name: FONT, size: 9, italic: true, color: { argb: 'FF5B636A' } };
    for (let x = first; x <= last; x++) {
      const r = rows[x - first]; const g = ws.getRow(x);
      if (r) {
        if (r.jour) { const [a, b, c] = r.jour.split('-').map(Number); g.getCell(2).value = new Date(Date.UTC(a, b - 1, c)); }
        const hf = hours(r.h_fourgon), hc = hours(r.h_camion); if (hf) g.getCell(3).value = hf / 24; if (hc) g.getCell(4).value = hc / 24;
        if (r.personnes != null) g.getCell(5).value = Number(r.personnes); g.getCell(6).value = veh(r.fourgon) || null; g.getCell(7).value = veh(r.camion) || null;
        g.getCell(8).value = r.lieu || null; g.getCell(9).value = r.cofrac ? 'Oui' : 'Non'; g.getCell(10).value = r.client || null;
        srv.forEach((s, i) => { const v = Number((r.montants || {})[s.code]) || 0; g.getCell(sc(i) + 1).value = v || null; });
        const d = r.dept; g.getCell(cD + 1).value = d && /^\d+$/.test(d) && !/^0/.test(d) ? Number(d) : (d || null);
      }
      g.getCell(2).numFmt = 'dd/mm/yyyy'; g.getCell(3).numFmt = timeF; g.getCell(4).numFmt = timeF;
      for (let c = 2; c <= cD + 1; c++) if (c !== cT + 1) g.getCell(c).font = { name: FONT, size: 9, color: { argb: BLUE } };
      srv.forEach((s, i) => g.getCell(sc(i) + 1).numFmt = money);
      g.getCell(cT + 1).value = { formula: `SUM(${colL(C0)}${x}:${colL(cT - 1)}${x})` }; g.getCell(cT + 1).numFmt = money; g.getCell(cT + 1).font = { name: FONT, size: 9, bold: true, color: { argb: NAVY } };
      const grp = k => srv.map((s, i) => [s, colL(sc(i))]).filter(([s]) => s.groupe === k).map(([, c]) => `${c}${x}`);
      const fF = grp('fourgon'), fC = grp('camion');
      g.getCell(cAF + 1).value = { formula: fF.length ? `SUM(${fF.join(',')})` : '0' }; g.getCell(cAC + 1).value = { formula: fC.length ? `SUM(${fC.join(',')})` : '0' };
      g.getCell(cVF + 1).value = { formula: `IF(F${x}<>"",F${x},IF(G${x}<>"",G${x},""))` }; g.getCell(cVC + 1).value = { formula: `IF(G${x}<>"",G${x},IF(F${x}<>"",F${x},""))` };
      g.getCell(cLn + 1).value = { formula: `IF(OR(B${x}<>"",H${x}<>"",J${x}<>""),1,0)` };
      [cAF, cAC, cVF, cVC, cLn].forEach(c => { const z = g.getCell(c + 1); z.font = { name: FONT, size: 8, color: { argb: 'FF5B636A' } }; if (c <= cAC) z.numFmt = money; });
    }
    const T = ws.getRow(totR); T.getCell(2).value = 'TOTAL'; tot(T.getCell(2));
    T.getCell(3).value = { formula: `SUM(${rg(2)})` }; T.getCell(3).numFmt = timeF; T.getCell(4).value = { formula: `SUM(${rg(3)})` }; T.getCell(4).numFmt = timeF;
    for (let c = 2; c <= cD; c++) tot(T.getCell(c + 1));
    for (let c = C0; c <= cT; c++) { T.getCell(c + 1).value = { formula: `SUM(${rg(c)})` }; T.getCell(c + 1).numFmt = money; }
    const TOT = `$${colL(cT)}$${totR}`, CLI = `$J$${first}:$J$${last}`, COF = `$I$${first}:$I$${last}`, TR = `$${colL(cT)}$${first}:$${colL(cT)}$${last}`;
    /* KPI */
    const K = [['CA GLOBAL', 'B', `${TOT}`, money], ['INTERVENTIONS', 'E', `SUM($${colL(cLn)}$${first}:$${colL(cLn)}$${last})`, '0'], ['CLIENTS ACTIFS', 'H', `SUMPRODUCT((${CLI}<>"")/COUNTIF(${CLI},${CLI}&""))`, '0'], ['CA MOYEN / INTERV.', 'K', 'IFERROR(B5/E5,0)', money], ['INTERVENTIONS COFRAC', 'N', `COUNTIF(${COF},"Oui")`, '0'], ['CA COFRAC', 'Q', `SUMIF(${COF},"Oui",${TR})`, money]];
    K.forEach(([l, c, f, nf]) => { const v = ws.getCell(`${c}5`); v.value = { formula: f }; v.numFmt = nf; v.font = { name: FONT, bold: true, size: 15, color: { argb: NAVY } }; const t = ws.getCell(`${c}6`); t.value = l; t.font = { name: FONT, size: 8, bold: true, color: { argb: 'FF5B636A' } }; });
    /* CA par service */
    let y = totR + 3; ws.getCell(y, 2).value = 'CA PAR SERVICE'; ws.getCell(y, 2).font = { name: FONT, bold: true, size: 11, color: { argb: NAVY } }; y++;
    ['Service', 'Groupe', 'CA', 'Part'].forEach((h, i) => hdr(Object.assign(ws.getCell(y, 2 + i), { value: h }))); y++;
    const srvRow = {};
    srv.forEach((s, i) => { ws.getCell(y, 2).value = s.libelle; ws.getCell(y, 3).value = groupeLabel(s.groupe); const c = ws.getCell(y, 4); c.value = { formula: `${colL(sc(i))}${totR}` }; c.numFmt = money; const p = ws.getCell(y, 5); p.value = { formula: `IFERROR(D${y}/${TOT},0)` }; p.numFmt = pctF; srvRow[s.code] = y; y++; });
    ws.getCell(y, 2).value = 'TOTAL'; tot(ws.getCell(y, 2)); tot(ws.getCell(y, 3)); ws.getCell(y, 4).value = { formula: `SUM(D${y - srv.length}:D${y - 1})` }; ws.getCell(y, 4).numFmt = money; tot(ws.getCell(y, 4)); y += 3;
    /* CA par véhicule */
    ws.getCell(y, 2).value = 'RENTABILITÉ PAR VÉHICULE'; ws.getCell(y, 2).font = { name: FONT, bold: true, size: 11, color: { argb: NAVY } }; y++;
    ['Véhicule', 'CA imputé', 'Seuil mensuel', '% du seuil', 'Statut'].forEach((h, i) => hdr(Object.assign(ws.getCell(y, 2 + i), { value: h }))); y++;
    const AF = `$${colL(cAF)}$${first}:$${colL(cAF)}$${last}`, AC = `$${colL(cAC)}$${first}:$${colL(cAC)}$${last}`, VF = `$${colL(cVF)}$${first}:$${colL(cVF)}$${last}`, VC = `$${colL(cVC)}$${first}:$${colL(cVC)}$${last}`;
    const vehRow = {};
    vs.forEach((v, i) => { ws.getCell(y, 2).value = v.immat; const c = ws.getCell(y, 3); c.value = { formula: `SUMIFS(${AF},${VF},B${y})+SUMIFS(${AC},${VC},B${y})` }; c.numFmt = money; const s = ws.getCell(y, 4); s.value = { formula: seuilRef(i) }; s.numFmt = money; const p = ws.getCell(y, 5); p.value = { formula: `IFERROR(C${y}/D${y},0)` }; p.numFmt = pctF; ws.getCell(y, 6).value = { formula: `IF(C${y}=0,"",IF(E${y}>=1,"RENTABLE",IF(E${y}>=0.7,"PROCHE","DÉFICITAIRE")))` }; vehRow[v.immat] = y; y++; });
    const niCodes = srv.map((s, i) => [s, colL(sc(i))]).filter(([s]) => s.groupe === 'non_imputable').map(([, c]) => `${c}${totR}`);
    ws.getCell(y, 2).value = 'Non imputable'; ws.getCell(y, 3).value = { formula: niCodes.length ? niCodes.join('+') : '0' }; ws.getCell(y, 3).numFmt = money; y++;
    ws.getCell(y, 2).value = 'Non affecté'; ws.getCell(y, 3).value = { formula: `SUMIFS(${AF},${VF},"")+SUMIFS(${AC},${VC},"")` }; ws.getCell(y, 3).numFmt = money;
    ws.columns.forEach((c, i) => { c.width = i === 0 ? 3 : i === 7 ? 42 : i === 9 ? 24 : i >= cAF ? 12 : i === 1 ? 12 : 11; });
    months.push({ m, name: MOIS[m - 1], totR, TOT, srvRow, vehRow, kpi: { ca: 'B5', n: 'E5', cof: 'N5', cofca: 'Q5' } });
  }

  /* Synthèse */
  const sy = wb.addWorksheet(`Synthèse ${Y}`, { properties: { tabColor: { argb: NAVY } } }); wb.moveWorksheet ? 0 : 0;
  title(sy, `SYNTHÈSE ANNUELLE ${Y}`);
  const ref = (mo, cell) => `'${mo.name}'!${cell}`;
  ['Mois', `CA ${Y}`, 'Interventions', `CA ${Y - 1}`, 'Écart', 'Écart %', `Cumul ${Y}`, `Cumul ${Y - 1}`, 'CA COFRAC'].forEach((h, i) => hdr(Object.assign(sy.getCell(9, 2 + i), { value: h })));
  months.forEach((mo, i) => {
    const r = 10 + i; sy.getCell(r, 2).value = mo.name;
    sy.getCell(r, 3).value = { formula: ref(mo, '$B$5') }; sy.getCell(r, 4).value = { formula: ref(mo, '$E$5') };
    sy.getCell(r, 5).value = Number((N1[mo.m] || {}).ca) || 0; sy.getCell(r, 5).font = { name: FONT, color: { argb: BLUE } };
    sy.getCell(r, 6).value = { formula: `IF(C${r}=0,"",C${r}-E${r})` }; sy.getCell(r, 7).value = { formula: `IF(OR(C${r}=0,E${r}=0),"",C${r}/E${r}-1)` };
    sy.getCell(r, 8).value = { formula: `IF(C${r}=0,"",SUM($C$10:C${r}))` }; sy.getCell(r, 9).value = { formula: `SUM($E$10:E${r})` }; sy.getCell(r, 10).value = { formula: ref(mo, '$Q$5') };
    [3, 5, 6, 8, 9, 10].forEach(c => sy.getCell(r, c).numFmt = money); sy.getCell(r, 7).numFmt = '+0.0%;-0.0%';
  });
  sy.getCell(22, 2).value = 'TOTAL'; [2, 3, 4, 5, 6, 10].forEach(c => tot(sy.getCell(22, c))); sy.getCell(22, 3).value = { formula: 'SUM(C10:C21)' }; sy.getCell(22, 4).value = { formula: 'SUM(D10:D21)' }; sy.getCell(22, 5).value = { formula: 'SUM(E10:E21)' }; sy.getCell(22, 6).value = { formula: 'SUM(F10:F21)' }; sy.getCell(22, 10).value = { formula: 'SUM(J10:J21)' };
  [3, 5, 6, 10].forEach(c => sy.getCell(22, c).numFmt = money);
  const kp = [['CA GLOBAL', 'B', 'C22', money], ['INTERVENTIONS', 'E', 'D22', '0'], ['CA MOYEN / INTERV.', 'H', 'IFERROR(C22/D22,0)', money], ['MOIS ACTIFS', 'K', 'COUNTIF(C10:C21,">0")', '0'], [`ÉCART / ${Y - 1}`, 'N', 'IFERROR(C22/SUMIF(C10:C21,">0",E10:E21)-1,"")', '+0.0%;-0.0%']];
  kp.forEach(([l, c, f, nf]) => { const v = sy.getCell(`${c}5`); v.value = { formula: f }; v.numFmt = nf; v.font = { name: FONT, bold: true, size: 15, color: { argb: NAVY } }; const t = sy.getCell(`${c}6`); t.value = l; t.font = { name: FONT, size: 8, bold: true, color: { argb: 'FF5B636A' } }; });
  let y = 25; sy.getCell(y, 2).value = 'CA PAR SERVICE'; sy.getCell(y, 2).font = { name: FONT, bold: true, size: 11, color: { argb: NAVY } }; y++;
  ['Service', 'Groupe', 'CA annuel', 'Part'].forEach((h, i) => hdr(Object.assign(sy.getCell(y, 2 + i), { value: h }))); y++;
  const sy0 = y;
  srv.forEach(s => { sy.getCell(y, 2).value = s.libelle; sy.getCell(y, 3).value = groupeLabel(s.groupe); const c = sy.getCell(y, 4); c.value = { formula: months.map(mo => ref(mo, `$D$${mo.srvRow[s.code]}`)).join('+') }; c.numFmt = money; const p = sy.getCell(y, 5); p.value = { formula: `IFERROR(D${y}/$C$22,0)` }; p.numFmt = pctF; y++; });
  sy.getCell(y, 2).value = 'TOTAL'; tot(sy.getCell(y, 2)); tot(sy.getCell(y, 3)); sy.getCell(y, 4).value = { formula: `SUM(D${sy0}:D${y - 1})` }; sy.getCell(y, 4).numFmt = money; tot(sy.getCell(y, 4)); y += 3;
  sy.getCell(y, 2).value = 'RENTABILITÉ ANNUELLE PAR VÉHICULE'; sy.getCell(y, 2).font = { name: FONT, bold: true, size: 11, color: { argb: NAVY } }; y++;
  ['Véhicule', 'CA imputé', 'Seuil annuel', '% du seuil', 'Statut'].forEach((h, i) => hdr(Object.assign(sy.getCell(y, 2 + i), { value: h }))); y++;
  vs.forEach((v, i) => { sy.getCell(y, 2).value = v.immat; const c = sy.getCell(y, 3); c.value = { formula: months.map(mo => ref(mo, `$C$${mo.vehRow[v.immat]}`)).join('+') }; c.numFmt = money; const s = sy.getCell(y, 4); s.value = { formula: `${seuilRef(i)}*$K$5` }; s.numFmt = money; const p = sy.getCell(y, 5); p.value = { formula: `IFERROR(C${y}/D${y},0)` }; p.numFmt = pctF; sy.getCell(y, 6).value = { formula: `IF(C${y}=0,"",IF(E${y}>=1,"RENTABLE",IF(E${y}>=0.7,"PROCHE","DÉFICITAIRE")))` }; y++; });
  sy.columns = [{ width: 3 }, { width: 22 }, { width: 16 }, { width: 14 }, { width: 16 }, { width: 14 }, { width: 12 }, { width: 16 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 3 }, { width: 3 }, { width: 14 }];
  // order: Synthèse first, then months, then Paramètres
  const order = [sy, ...wb.worksheets.filter(w => MOIS.includes(w.name)), wp]; order.forEach((w, i) => { w.orderNo = i; });
  wb.calcProperties = { fullCalcOnLoad: true };
  const buf = await wb.xlsx.writeBuffer();
  download(`Suivi_Chantier_${Y}.xlsx`, new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  toast('Classeur exporté', 'check'); log('Export Excel', { texte: `Suivi_Chantier_${Y}.xlsx` });
}

/* ---------- import ---------- */
const MAP = { 'DATE': 'jour', 'H FOURGON': 'h_fourgon', 'H CAMION': 'h_camion', 'PERS': 'personnes', 'PERSONNES': 'personnes', 'FOURGON': 'fourgon', 'CAMION': 'camion', 'COFRAC': 'cofrac', 'CLIENT': 'client', 'DEPT': 'dept', 'DEPARTEMENT': 'dept', 'TOTAL': 'total' };
function toISO(v) {
  if (v == null || v === '' || v === '-') return null;
  if (typeof v === 'number' && v > 1000) { const d = new Date(Math.round((v - 25569) * 864e5)); return d.toISOString().slice(0, 10); }
  const s = String(v).trim(); let m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/); if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}
function toH(v) { if (v == null || v === '' || v === '-') return null; if (typeof v === 'number') { const h = v < 1 ? v * 24 : v <= 24 ? v : (v % 1) * 24; return h ? hhmm(h) : null; } const h = hours(v); return h ? hhmm(h) : null; }
export function parseWorkbook(XLSX, wb) {
  const srv = allServices(); const out = { months: {}, newSrv: [], year: null, years: {} };
  const months = MOIS.map(m => norm(m));
  for (const name of wb.SheetNames) {
    const mi = months.indexOf(norm(name).split(' ')[0]); if (mi < 0) continue;
    const a = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: true });
    const hi = a.findIndex(r => r && r.some(c => norm(c) === 'DATE') && r.some(c => norm(c) === 'CLIENT')); if (hi < 0) continue;
    const H = a[hi].map(norm); const col = {}; let ci = -1, ti = -1;
    H.forEach((h, i) => { if (h.startsWith('LIEU')) col.lieu = i; else if (MAP[h] && col[MAP[h]] == null) col[MAP[h]] = i; });
    ci = col.client; ti = col.total ?? H.length;
    const sCols = [];
    for (let i = ci + 1; i < ti; i++) { const h = H[i]; if (!h) continue; let s = srv.find(x => norm(x.entete) === h || norm(x.libelle) === h || norm(x.code) === h);
      if (!s) { s = out.newSrv.find(x => norm(x.entete) === h); if (!s) { const raw = String(a[hi][i]).trim(); s = { code: slug(raw), entete: raw.toUpperCase(), libelle: raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase().replace(/\.$/, ''), groupe: 'fourgon', isNew: true }; out.newSrv.push(s); } }
      sCols.push([i, s.code]); }
    const title = a.slice(0, hi).flat().find(c => typeof c === 'string' && /20\d\d/.test(c)); if (title) { const y = +title.match(/20\d\d/)[0]; out.years[y] = (out.years[y] || 0) + 5; }
    const rows = []; let ordre = 0;
    for (let x = hi + 1; x < a.length; x++) {
      const r = a[x] || []; const first = r.slice(0, (col.jour ?? 1) + 1).map(norm);
      if (first.includes('TOTAL')) break;
      const g = k => col[k] == null ? null : r[col[k]];
      const montants = {}; sCols.forEach(([i, code]) => { const v = parseNum(r[i]); if (v) montants[code] = r2(v + (montants[code] || 0)); });
      const client = String(g('client') ?? '').trim(); const lieu = String(g('lieu') ?? '').trim();
      if (!client && !lieu && !Object.keys(montants).length) continue;
      const jour = toISO(g('jour')); if (jour) { const y = +jour.slice(0, 4); out.years[y] = (out.years[y] || 0) + 1; }
      const cof = norm(g('cofrac')); let dept = g('dept'); dept = dept == null || dept === '-' ? null : String(dept).trim(); if (dept && /^\d$/.test(dept)) dept = '0' + dept;
      const p = g('personnes'); const pers = p == null || p === '-' || p === '' ? null : parseInt(p, 10);
      rows.push({ mois: mi + 1, jour, h_fourgon: toH(g('h_fourgon')), h_camion: toH(g('h_camion')), personnes: isFinite(pers) ? pers : null, fourgon: veh(g('fourgon')) || null, camion: veh(g('camion')) || null, lieu: lieu || null, cofrac: ['OUI', 'X', 'TRUE', '1', 'VRAI'].includes(cof), client: client || null, dept: dept || null, montants, ordre: ++ordre });
    }
    out.months[mi + 1] = rows;
  }
  const ys = Object.entries(out.years).sort((a, b) => b[1] - a[1]); out.year = ys.length ? +ys[0][0] : S.annee;
  return out;
}
async function importFile(file, ctx) {
  if (!/\.xls[xm]?$/i.test(file.name)) { toast('Choisissez un fichier Excel (.xlsx).', 'alert'); return; }
  toast('Lecture du fichier', 'file');
  let res; try { await loadLib('xlsx'); const XLSX = window.XLSX; const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' }); res = parseWorkbook(XLSX, wb); } catch (e) { console.error(e); toast('Fichier illisible. Vérifiez qu\'il s\'agit du classeur de suivi.', 'alert'); return; }
  const ms = Object.keys(res.months).map(Number).sort((a, b) => a - b);
  if (!ms.length) { toast('Aucun onglet mensuel reconnu (Janvier à Décembre).', 'alert'); return; }
  let year = res.year, mode = 'replace';
  const tot = rs => rs.reduce((a, r) => a + Object.values(r.montants).reduce((x, y) => x + y, 0), 0);
  const body = () => `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Mois</th><th class="num">Lignes fichier</th><th class="num">CA fichier</th><th class="num">Lignes outil</th><th class="num">CA outil</th><th class="num">Écart</th></tr></thead><tbody>
    ${ms.map(m => { const f = res.months[m], o = S.rows.filter(r => r.annee === year && r.mois === m); const cf = tot(f), co = o.reduce((a, r) => a + rowCalc(r).total, 0); return `<tr><td>${MOIS[m - 1]}</td><td class="num">${f.length}</td><td class="num">${euro2(cf)}</td><td class="num">${o.length}</td><td class="num">${euro2(co)}</td><td class="num" style="color:var(--${Math.abs(cf - co) < .01 ? 'muted' : 'warn'})">${Math.abs(cf - co) < .01 ? 'identique' : euro2(cf - co)}</td></tr>`; }).join('')}
    <tr><td><b>Total</b></td><td class="num"><b>${ms.reduce((a, m) => a + res.months[m].length, 0)}</b></td><td class="num"><b>${euro2(ms.reduce((a, m) => a + tot(res.months[m]), 0))}</b></td><td></td><td></td><td></td></tr></tbody></table></div>`;
  const { el, close } = modal(`<div class="modal-head"><div><span class="label">Import Excel</span><h2 style="margin-top:6px">${esc(file.name)}</h2><p>${ms.length} onglet${ms.length > 1 ? 's' : ''} mensuel${ms.length > 1 ? 's' : ''} reconnu${ms.length > 1 ? 's' : ''}. Contrôlez les montants avant de valider.</p></div><button class="icon-btn" data-close aria-label="Fermer">${ic('x')}</button></div>
    <div class="form"><label class="field" style="max-width:200px"><span>Année des données</span><select class="input" id="iY">${[...new Set([...years_(), year, year + 1])].sort().map(y => `<option ${y === year ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
    <div id="iT">${body()}</div>
    ${res.newSrv.length ? `<div class="tile" style="padding:14px 16px"><b style="color:var(--head)">${res.newSrv.length} nouveau${res.newSrv.length > 1 ? 'x' : ''} service${res.newSrv.length > 1 ? 's' : ''} dans le fichier</b><p class="small muted" style="margin:4px 0 10px">Ils seront créés. Choisissez le véhicule auquel les imputer.</p>${res.newSrv.map((s, i) => `<div style="display:grid;grid-template-columns:minmax(0,1fr) 200px;gap:10px;align-items:center;margin-top:6px"><span>${esc(s.libelle)} <span class="muted small">(${esc(s.entete)})</span></span><select class="input" data-ns="${i}">${GROUPES.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div>`).join('')}</div>` : ''}
    <div class="grid g2"><label class="tile opt on"><input type="radio" name="im" value="replace" checked><div><b>Remplacer les mois importés</b><span>Les lignes de l'outil pour ces mois sont remplacées par celles du fichier. Recommandé quand Excel est la référence.</span></div></label>
    <label class="tile opt"><input type="radio" name="im" value="add"><div><b>Ajouter aux lignes existantes</b><span>Les lignes du fichier s'ajoutent sans rien supprimer. Attention aux doublons.</span></div></label></div></div>
    <div class="modal-foot"><button class="btn ghost" data-close>Annuler</button><button class="btn mag" id="iGo">${ic('upload')}Importer</button></div>`, { wide: true });
  $('#iY', el).onchange = e => { year = +e.target.value; $('#iT', el).innerHTML = body(); };
  $$('input[name=im]', el).forEach(r => r.onchange = () => { mode = r.value; $$('.opt', el).forEach(o => o.classList.toggle('on', $('input', o).checked)); });
  $$('[data-ns]', el).forEach(s => s.onchange = () => res.newSrv[+s.dataset.ns].groupe = s.value);
  $('#iGo', el).onclick = async () => {
    const b = $('#iGo', el); b.disabled = true; b.textContent = 'Import en cours';
    try {
      if (res.newSrv.length) { const mx = S.services.reduce((a, s) => Math.max(a, s.ordre), 0); const { error } = await sb.from('chantier_services').upsert(res.newSrv.map((s, i) => ({ code: s.code, libelle: s.libelle, entete: s.entete, groupe: s.groupe, ordre: mx + 1 + i, actif: true }))); if (error) throw error; }
      if (mode === 'replace') { const { error } = await sb.from('chantier_interventions').delete().eq('annee', year).in('mois', ms); if (error) throw error; }
      const all = ms.flatMap(m => res.months[m].map(r => pick({ ...r, annee: year, ordre: mode === 'add' ? r.ordre + 1000 : r.ordre })));
      for (let i = 0; i < all.length; i += 200) { const { error } = await sb.from('chantier_interventions').insert(all.slice(i, i + 200)); if (error) throw error; }
      await log('Import Excel', { mois: ms, lignes: all.length, texte: `${file.name} · ${mode === 'replace' ? 'remplacement' : 'ajout'} · ${year}` });
      S.annee = year; store.set('dl-annee', year); await loadAll(); close(); toast(`${all.length} interventions importées`, 'check'); ctx.go('accueil');
    } catch (e) { console.error(e); b.disabled = false; b.innerHTML = ic('upload') + 'Importer'; toast(errMsg(e), 'alert'); }
  };
}

/* =========================================================
   PARAMÈTRES
   ========================================================= */
export function renderParametres(host, ctx) {
  const used = code => S.rows.filter(r => Number((r.montants || {})[code])).length;
  const srvList = () => allServices().map((s, i, a) => `<div class="tile srv-row ${s.actif ? '' : 'off'}" data-c="${esc(s.code)}">
      <div class="grip"><button class="icon-btn" data-mv="-1" ${i === 0 ? 'disabled style="opacity:.3"' : ''} aria-label="Monter">${ic('chevUp')}</button><button class="icon-btn" data-mv="1" ${i === a.length - 1 ? 'disabled style="opacity:.3"' : ''} aria-label="Descendre">${ic('chevDown')}</button></div>
      <input class="input" data-f="libelle" value="${esc(s.libelle)}" aria-label="Libellé">
      <input class="input x2" data-f="entete" value="${esc(s.entete)}" aria-label="En-tête de colonne">
      <select class="input x2" data-f="groupe" aria-label="Imputation">${GROUPES.map(([k, l]) => `<option value="${k}" ${k === s.groupe ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <button class="sw ${s.actif ? 'on' : ''}" data-act role="switch" aria-checked="${s.actif}" title="${s.actif ? 'Actif : colonne visible' : 'Inactif : colonne masquée'}"></button>
      <button class="icon-btn sm" data-del title="Supprimer" aria-label="Supprimer">${ic('trash')}</button></div>`).join('');
  const vehList = () => vehicules().map(v => `<div class="tile veh-row" data-i="${esc(v.immat)}"><input class="input" data-f="immat" value="${esc(v.immat)}" aria-label="Immatriculation"><input class="input x2" data-f="type" value="${esc(v.type || '')}" placeholder="Usage" aria-label="Usage"><input class="input" data-f="seuil" inputmode="decimal" value="${esc(v.seuil || '')}" placeholder="${seuilDefaut()}" aria-label="Seuil mensuel"><button class="icon-btn sm" data-vdel aria-label="Supprimer">${ic('trash')}</button></div>`).join('');
  const N = n1(); const depts = P_('departements') || {};
  host.innerHTML = `
  <section class="panel glass" data-st><div class="panel-head"><div><span class="label">Services</span><h2 style="margin-top:6px">Colonnes de prestations</h2><p>Libellé, en-tête de colonne et véhicule d'imputation. Un service inactif garde ses montants mais sa colonne est masquée.</p></div><button class="btn mag" id="sAdd">${ic('plus')}Ajouter un service</button></div>
    <div class="small muted srv-head" style="display:grid;grid-template-columns:auto minmax(0,1.3fr) minmax(0,.9fr) minmax(0,1fr) auto auto;gap:12px;padding:0 12px 8px"><span style="width:26px"></span><span>Libellé</span><span>En-tête</span><span>Imputation</span><span>Actif</span><span style="width:34px"></span></div>
    <div class="rows" id="sL">${srvList()}</div></section>
  <div class="grid g2">
    <section class="panel glass" data-st><div class="panel-head"><div><span class="label">Flotte</span><h2 style="margin-top:6px">Véhicules et seuils</h2><p>Seuil mensuel de rentabilité. Vide : seuil par défaut.</p></div><button class="btn ghost sm mag" id="vAdd">${ic('plus')}Véhicule</button></div>
      <label class="field" style="max-width:240px;margin-bottom:16px"><span>Seuil mensuel par défaut (€)</span><input class="input" id="sd" inputmode="decimal" value="${seuilDefaut()}"></label>
      <div class="rows" id="vL">${vehList()}</div></section>
    <section class="panel glass" data-st><div class="panel-head"><div><span class="label">Référence</span><h2 style="margin-top:6px">Chiffre d'affaires ${S.annee - 1}</h2><p>Sert aux comparatifs et à la projection de fin d'année.</p></div></div>
      <div class="n1-grid">${MOIS.map((m, i) => `<label class="field"><span>${MC[i]}</span><input class="input" data-n1="${i + 1}" inputmode="decimal" value="${(N[i + 1] || {}).ca ?? ''}"></label>`).join('')}</div>
      <div class="panel-head" style="margin:26px 0 12px"><div><span class="label">Territoire</span><h3 style="margin-top:6px">Noms des départements</h3></div></div>
      <div class="n1-grid" style="grid-template-columns:repeat(3,minmax(0,1fr))">${Object.entries(depts).map(([k, v]) => `<label class="field"><span>${esc(k)}</span><input class="input" data-dp="${esc(k)}" value="${esc(v)}"></label>`).join('')}</div></section>
  </div>
  <section class="panel glass" data-st><div class="panel-head"><div><span class="label">Accès</span><h2 style="margin-top:6px">Qui peut utiliser l'outil</h2><p>L'accès est ouvert aux comptes inscrits dans la table des membres du projet Supabase Deldossi, comme pour l'outil de tournées. Les données sont protégées par des règles de sécurité au niveau des lignes.</p></div></div></section>`;

  const saveSrv = async (code, patch) => { const { error } = await sb.from('chantier_services').update(patch).eq('code', code); if (error) { toast(errMsg(error), 'alert'); return false; } Object.assign(S.services.find(s => s.code === code), patch); emit('services'); return true; };
  const redrawSrv = () => { $('#sL', host).innerHTML = srvList(); };
  host.addEventListener('change', async e => {
    const t = e.target; const row = t.closest('.srv-row');
    if (row && t.dataset.f) { const v = t.value.trim(); if (!v) { toast('Ce champ ne peut pas être vide.', 'alert'); redrawSrv(); return; } if (await saveSrv(row.dataset.c, { [t.dataset.f]: t.dataset.f === 'entete' ? v.toUpperCase() : v })) { if (t.dataset.f === 'entete') t.value = v.toUpperCase(); toast('Service mis à jour'); log('Service modifié', { service: row.dataset.c, texte: `${t.dataset.f} : ${v}` }); } return; }
    const vr = t.closest('.veh-row');
    if (vr && t.dataset.f) { const list = (P_('vehicules') || []).map(x => ({ ...x })); const v = list.find(x => x.immat === vr.dataset.i); if (!v) return;
      if (t.dataset.f === 'immat') { const ni = t.value.trim().toUpperCase(); if (!ni || list.some(x => x.immat === ni && x !== v)) { toast('Immatriculation vide ou déjà utilisée.', 'alert'); t.value = v.immat; return; } v.immat = ni; vr.dataset.i = ni; t.value = ni; }
      else if (t.dataset.f === 'seuil') v.seuil = parseNum(t.value) || null; else v.type = t.value.trim();
      try { await setParam('vehicules', list); toast('Véhicule mis à jour'); } catch (er) { toast(errMsg(er), 'alert'); } return; }
    if (t.id === 'sd') { const v = parseNum(t.value); if (!(v > 0)) { toast('Saisissez un seuil positif.', 'alert'); return; } try { await setParam('seuil_defaut', v); log('Seuil par défaut modifié', { texte: euro(v) }); toast('Seuil mis à jour'); } catch (er) { toast(errMsg(er), 'alert'); } return; }
    if (t.dataset.n1) { const k = `n1_${S.annee - 1}`; const o = { ...(P_(k) || {}) }; const v = parseNum(t.value); if (v) o[t.dataset.n1] = { ca: r2(v) }; else delete o[t.dataset.n1]; try { await setParam(k, o); toast(`${MOIS[t.dataset.n1 - 1]} ${S.annee - 1} enregistré`); } catch (er) { toast(errMsg(er), 'alert'); } return; }
    if (t.dataset.dp) { const o = { ...(P_('departements') || {}) }; o[t.dataset.dp] = t.value.trim(); try { await setParam('departements', o); toast('Département renommé'); } catch (er) { toast(errMsg(er), 'alert'); } }
  });
  host.addEventListener('click', async e => {
    const row = e.target.closest('.srv-row');
    if (row && e.target.closest('[data-act]')) { const s = S.services.find(x => x.code === row.dataset.c); if (await saveSrv(s.code, { actif: !s.actif })) { redrawSrv(); toast(s.actif ? 'Service activé' : 'Service masqué'); log(s.actif ? 'Service activé' : 'Service désactivé', { service: s.libelle }); } return; }
    const mv = e.target.closest('[data-mv]');
    if (row && mv) { const list = allServices(); const i = list.findIndex(s => s.code === row.dataset.c); const j = i + Number(mv.dataset.mv); if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]];
      const ups = list.map((s, k) => ({ ...s, ordre: k + 1 })); const { error } = await sb.from('chantier_services').upsert(ups.map(({ code, libelle, entete, groupe, actif, ordre }) => ({ code, libelle, entete, groupe, actif, ordre })));
      if (error) { toast(errMsg(error), 'alert'); return; } ups.forEach(u => S.services.find(s => s.code === u.code).ordre = u.ordre); emit('services');
      const el = $(`.srv-row[data-c="${CSS.escape(row.dataset.c)}"]`, host); const r0 = el.getBoundingClientRect().top; redrawSrv(); const el2 = $(`.srv-row[data-c="${CSS.escape(row.dataset.c)}"]`, host); if (!RM) el2.animate([{ transform: `translateY(${r0 - el2.getBoundingClientRect().top}px)` }, { transform: 'none' }], { duration: 420, easing: EASE }); return; }
    if (row && e.target.closest('[data-del]')) { delService(row.dataset.c, used(row.dataset.c)); return; }
    const vr = e.target.closest('.veh-row');
    if (vr && e.target.closest('[data-vdel]')) { if (!(await confirmBox(`Retirer ${vr.dataset.i} ?`, 'Le véhicule sort de la liste et des seuils. Les interventions déjà saisies gardent leur immatriculation.', { ok: 'Retirer', danger: true }))) return; try { await setParam('vehicules', (P_('vehicules') || []).filter(x => x.immat !== vr.dataset.i)); log('Véhicule retiré', { texte: vr.dataset.i }); $('#vL', host).innerHTML = vehList(); toast('Véhicule retiré'); } catch (er) { toast(errMsg(er), 'alert'); } }
  });
  $('#sAdd', host).onclick = () => addService(() => redrawSrv());
  $('#vAdd', host).onclick = async () => {
    const { el, close } = modal(`<div class="modal-head"><div><span class="label">Flotte</span><h2 style="margin-top:6px">Ajouter un véhicule</h2></div><button class="icon-btn" data-close aria-label="Fermer">${ic('x')}</button></div>
      <div class="form"><label class="field"><span>Immatriculation</span><input class="input" id="vi" placeholder="AB123CD" autocapitalize="characters"></label><label class="field"><span>Usage</span><input class="input" id="vt" placeholder="Fourgon ITV, camion hydrocureur"></label><label class="field"><span>Seuil mensuel (€) <em>vide : ${euro(seuilDefaut())}</em></span><input class="input" id="vs" inputmode="decimal"></label></div>
      <div class="modal-foot"><button class="btn ghost" data-close>Annuler</button><button class="btn mag" id="vGo">Ajouter</button></div>`);
    $('#vGo', el).onclick = async () => { const im = $('#vi', el).value.trim().toUpperCase(); if (!im || vehicules().some(v => v.immat === im)) { $('#vi', el).classList.add('bad'); return; }
      try { await setParam('vehicules', [...(P_('vehicules') || []), { immat: im, type: $('#vt', el).value.trim(), seuil: parseNum($('#vs', el).value) || null }]); log('Véhicule ajouté', { texte: im }); close(); $('#vL', host).innerHTML = vehList(); toast('Véhicule ajouté'); } catch (er) { toast(errMsg(er), 'alert'); } };
  };
  stagger(host);
}
const P_ = k => S.params[k];
function addService(done) {
  const { el, close } = modal(`<div class="modal-head"><div><span class="label">Services</span><h2 style="margin-top:6px">Ajouter un service</h2><p>Une nouvelle colonne apparaît dans la saisie, les analyses et les exports.</p></div><button class="icon-btn" data-close aria-label="Fermer">${ic('x')}</button></div>
    <div class="form"><label class="field"><span>Libellé</span><input class="input" id="nl" placeholder="Forage"></label><label class="field"><span>En-tête de colonne</span><input class="input" id="ne" placeholder="FORAGE" autocapitalize="characters"></label>
    <label class="field"><span>Imputation</span><select class="input" id="ng">${GROUPES.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
    <label class="field"><span>Position</span><select class="input" id="np"><option value="end">À la fin</option>${allServices().map(s => `<option value="${esc(s.code)}">Après ${esc(s.libelle)}</option>`).join('')}</select></label></div>
    <div class="modal-foot"><button class="btn ghost" data-close>Annuler</button><button class="btn mag" id="nGo">${ic('plus')}Ajouter</button></div>`);
  $('#nl', el).oninput = e => { const ne = $('#ne', el); if (!ne.dataset.touched) ne.value = e.target.value.toUpperCase(); };
  $('#ne', el).oninput = e => e.target.dataset.touched = 1;
  $('#nGo', el).onclick = async () => {
    const l = $('#nl', el).value.trim(), en = ($('#ne', el).value.trim() || l).toUpperCase(); if (!l) { $('#nl', el).classList.add('bad'); return; }
    let code = slug(l); while (S.services.some(s => s.code === code)) code += '_2';
    const list = allServices(); const pos = $('#np', el).value; const at = pos === 'end' ? list.length : list.findIndex(s => s.code === pos) + 1;
    const nw = { code, libelle: l, entete: en, groupe: $('#ng', el).value, actif: true };
    list.splice(at, 0, nw); const ups = list.map((s, k) => ({ code: s.code, libelle: s.libelle, entete: s.entete, groupe: s.groupe, actif: s.actif, ordre: k + 1 }));
    const { data, error } = await sb.from('chantier_services').upsert(ups).select(); if (error) { toast(errMsg(error), 'alert'); return; }
    S.services = data; emit('services'); log('Service ajouté', { service: l, texte: groupeLabel(nw.groupe) }); close(); toast(`Service ${l} ajouté`); done && done();
  };
}
async function delService(code, n) {
  const s = S.services.find(x => x.code === code); const others = allServices().filter(x => x.code !== code);
  const { el, close } = modal(`<div class="modal-head"><div><span class="label">Supprimer un service</span><h2 style="margin-top:6px">${esc(s.libelle)}</h2><p>${n ? `${n} intervention${n > 1 ? 's contiennent' : ' contient'} un montant pour ce service.` : 'Aucune intervention n\'utilise ce service.'}</p></div><button class="icon-btn" data-close aria-label="Fermer">${ic('x')}</button></div>
    ${n ? `<div class="form"><label class="tile opt on"><input type="radio" name="dm" value="move" checked><div><b>Transférer les montants</b><span>Les montants sont ajoutés au service choisi, le CA reste identique.</span><select class="input" id="dt" style="margin-top:10px">${others.map(o => `<option value="${esc(o.code)}">${esc(o.libelle)}</option>`).join('')}</select></div></label>
    <label class="tile opt"><input type="radio" name="dm" value="drop"><div><b>Supprimer les montants</b><span>Le chiffre d'affaires baisse d'autant. Action définitive.</span></div></label>
    <p class="small muted">Pour seulement masquer la colonne en gardant les montants, désactivez le service au lieu de le supprimer.</p></div>` : ''}
    <div class="modal-foot"><button class="btn ghost" data-close>Annuler</button><button class="btn danger" id="dGo">Supprimer le service</button></div>`);
  $$('input[name=dm]', el).forEach(r => r.onchange = () => $$('.opt', el).forEach(o => o.classList.toggle('on', $('input', o).checked)));
  $('#dGo', el).onclick = async () => {
    const b = $('#dGo', el); b.disabled = true; b.textContent = 'Suppression';
    try {
      if (n) { const mode = $('input[name=dm]:checked', el).value, to = $('#dt', el).value; const rows = S.rows.filter(r => Number((r.montants || {})[code]));
        for (let i = 0; i < rows.length; i += 25) await Promise.all(rows.slice(i, i + 25).map(async r => { const m = { ...r.montants }; const v = Number(m[code]) || 0; delete m[code]; if (mode === 'move') m[to] = r2((Number(m[to]) || 0) + v); const { error } = await sb.from('chantier_interventions').update({ montants: m }).eq('id', r.id); if (error) throw error; r.montants = m; })); }
      const { error } = await sb.from('chantier_services').delete().eq('code', code); if (error) throw error;
      S.services = S.services.filter(x => x.code !== code); emit('services'); log('Service supprimé', { service: s.libelle, lignes: n }); close(); toast(`Service ${s.libelle} supprimé`, 'trash');
      const L = $('#sL'); if (L) L.closest('#sub') && document.dispatchEvent(new CustomEvent('dl-refresh'));
    } catch (e) { console.error(e); b.disabled = false; b.textContent = 'Supprimer le service'; toast(errMsg(e), 'alert'); }
  };
}

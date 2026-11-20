/* =========================================================
   CORE : config, helpers, store, calculation engine, UI primitives
   ========================================================= */
export const SB_URL = 'https://owpsojjsfwmfkqymfdiu.supabase.co';
export const SB_KEY = 'sb_publishable_rFM8kmsiR42eGmMlcRm9Wg_QYKEeODe';
export let sb = null;
try { sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'dl-chantier-auth' } }); } catch (e) { sb = null; }

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const root = document.documentElement;
export const EASE = 'cubic-bezier(.22,1,.36,1)';
export const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const clone = o => JSON.parse(JSON.stringify(o));
export const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
if (!('done' in Animation.prototype)) Object.defineProperty(Animation.prototype, 'done', {
  get() { const t = this.effect && this.effect.getTiming ? this.effect.getTiming() : {}; return Promise.race([this.finished.catch(() => {}), new Promise(r => setTimeout(r, (+t.duration || 300) + (+t.delay || 0) + 150))]); }
});

/* ---------- formats ---------- */
export const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
export const MC = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
export const pad = n => String(n).padStart(2, '0');
export const euro = (n, d = 0) => (Number(n) || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: d, minimumFractionDigits: d });
export const euro2 = n => euro(n, 2);
export const keur = n => { const v = Number(n) || 0; return Math.abs(v) >= 10000 ? `${(v / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k€` : euro(v); };
export const num = (n, d = 0) => (Number(n) || 0).toLocaleString('fr-FR', { maximumFractionDigits: d });
export const pct = (n, d = 1) => `${(Number(n) || 0).toLocaleString('fr-FR', { maximumFractionDigits: d })} %`;
export const fmtDate = v => v ? new Date(v + (String(v).length === 10 ? 'T12:00:00' : '')).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
export const fmtDT = v => v ? new Date(v).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
export const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
export const slug = s => norm(s).toLowerCase().replace(/ /g, '_').slice(0, 40) || 'service';
export const parseNum = v => { if (v === null || v === undefined || v === '') return 0; if (typeof v === 'number') return v; const n = parseFloat(String(v).replace(/\s| |€/g, '').replace(',', '.')); return isFinite(n) ? n : 0; };
export const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
/* "7:30", "7h30", "7,5" -> hours */
export function hours(v) {
  if (v === null || v === undefined) return 0; const s = String(v).trim(); if (!s || s === '-') return 0;
  let m = s.match(/^(\d{1,2})\s*[:hH]\s*(\d{1,2})?$/); if (m) return +m[1] + (+(m[2] || 0)) / 60;
  m = s.match(/^\d+(?:[.,]\d+)?$/); if (m) { const n = parseFloat(s.replace(',', '.')); return n <= 24 ? n : 0; }
  return 0;
}
export function hhmm(h) { if (!h) return ''; const t = Math.round(h * 60); return `${Math.floor(t / 60)}:${pad(t % 60)}`; }
export const veh = v => { const s = String(v ?? '').trim().toUpperCase(); return !s || s === '-' ? '' : s; };

/* =========================================================
   STORE
   ========================================================= */
export const S = { user: null, annee: new Date().getFullYear(), rows: [], services: [], params: {}, loaded: false, listeners: new Set(), live: false };
export const onChange = fn => { S.listeners.add(fn); return () => S.listeners.delete(fn); };
export const emit = (src) => S.listeners.forEach(f => { try { f(src); } catch (e) { console.error(e); } });
export const activeServices = () => S.services.filter(s => s.actif).sort((a, b) => a.ordre - b.ordre);
export const allServices = () => [...S.services].sort((a, b) => a.ordre - b.ordre);
export const P = k => S.params[k];
export const seuilDefaut = () => Number(P('seuil_defaut')) || 3000;
export const vehicules = () => (P('vehicules') || []).slice().sort((a, b) => a.immat.localeCompare(b.immat));
export const seuilOf = immat => { const v = (P('vehicules') || []).find(x => x.immat === immat); return v && Number(v.seuil) > 0 ? Number(v.seuil) : seuilDefaut(); };
export const deptName = code => (P('departements') || {})[code] || (code ? `Dépt ${code}` : 'Non renseigné');
export const n1 = () => P(`n1_${S.annee - 1}`) || {};
export const GROUPES = [['fourgon', 'Fourgon'], ['camion', 'Camion'], ['non_imputable', 'Non imputable']];
export const groupeLabel = g => (GROUPES.find(x => x[0] === g) || [g, g])[1];

async function fetchAll(table, q = x => x) {
  const out = []; let from = 0; const size = 1000;
  for (;;) {
    const { data, error } = await q(sb.from(table).select('*')).range(from, from + size - 1);
    if (error) throw error; out.push(...data); if (data.length < size) break; from += size;
  }
  return out;
}
export async function loadAll() {
  const [rows, srv, par] = await Promise.all([
    fetchAll('chantier_interventions', q => q.order('annee').order('mois').order('ordre')),
    fetchAll('chantier_services', q => q.order('ordre')),
    fetchAll('chantier_parametres')
  ]);
  S.rows = rows.map(fix); S.services = srv; S.params = Object.fromEntries(par.map(p => [p.cle, p.valeur]));
  const years = years_(); if (!years.includes(S.annee)) S.annee = years[years.length - 1];
  const saved = store.get('dl-annee', null); if (saved && years.includes(saved)) S.annee = saved;
  S.loaded = true; emit('load');
}
const fix = r => { r.montants = r.montants || {}; return r; };
export const years_ = () => { const y = new Set(S.rows.map(r => r.annee)); y.add(new Date().getFullYear()); return [...y].sort(); };
export const rowsYear = (a = S.annee) => S.rows.filter(r => r.annee === a);
export const rowsMonth = (m, a = S.annee) => S.rows.filter(r => r.annee === a && r.mois === m).sort((x, y) => (x.ordre - y.ordre));

export function errMsg(e) {
  const m = (e && (e.message || e.details)) || '';
  if (/row-level|permission|policy|JWT/i.test(m)) return 'Action non autorisée. Reconnectez-vous.';
  if (/fetch|network/i.test(m)) return 'Connexion impossible. Vérifiez votre réseau puis réessayez.';
  if (/duplicate|unique/i.test(m)) return 'Cet élément existe déjà.';
  return 'Enregistrement impossible. Réessayez dans un instant.';
}
const COLS = ['annee', 'mois', 'jour', 'h_fourgon', 'h_camion', 'personnes', 'fourgon', 'camion', 'lieu', 'cofrac', 'client', 'dept', 'montants', 'ordre'];
const TXT = ['h_fourgon', 'h_camion', 'fourgon', 'camion', 'lieu', 'client', 'dept'];
export const pick = r => Object.fromEntries(COLS.map(k => { const v = r[k] === undefined ? null : r[k];
  if (TXT.includes(k)) return [k, v == null ? '' : String(v)]; if (k === 'montants') return [k, v || {}]; if (k === 'cofrac') return [k, !!v]; if (k === 'ordre') return [k, Number(v) || 0]; return [k, v]; }));
export function upsertLocal(r) { fix(r); const i = S.rows.findIndex(x => x.id === r.id); if (i > -1) S.rows[i] = r; else S.rows.push(r); }
export async function saveRow(r) {
  const body = pick(r); let res;
  if (r.id) res = await sb.from('chantier_interventions').update(body).eq('id', r.id).select().single();
  else res = await sb.from('chantier_interventions').insert(body).select().single();
  if (res.error) throw res.error; upsertLocal(res.data); return res.data;
}
export async function deleteRow(id) {
  const { error } = await sb.from('chantier_interventions').delete().eq('id', id); if (error) throw error;
  S.rows = S.rows.filter(r => r.id !== id);
}
export async function setParam(cle, valeur) {
  const { error } = await sb.from('chantier_parametres').upsert({ cle, valeur, maj_le: new Date().toISOString() }); if (error) throw error;
  S.params[cle] = valeur; emit('params');
}
export async function log(action, details = {}) { try { await sb.from('chantier_journal').insert({ action, details }); } catch (e) {} }

/* =========================================================
   CALCULATION ENGINE (mirror of the workbook rules)
   fourgon group  -> fourgon vehicle, else camion vehicle
   camion group   -> camion vehicle, else fourgon vehicle
   non imputable  -> never on a vehicle
   ========================================================= */
export function rowCalc(r, srv = S.services) {
  let total = 0, f = 0, c = 0, ni = 0; const g = Object.fromEntries(srv.map(s => [s.code, s.groupe]));
  for (const [k, v] of Object.entries(r.montants || {})) {
    const n = Number(v) || 0; if (!n || !(k in g)) continue; total += n;
    if (g[k] === 'fourgon') f += n; else if (g[k] === 'camion') c += n; else ni += n;
  }
  const vf = veh(r.fourgon) || veh(r.camion), vc = veh(r.camion) || veh(r.fourgon);
  return { total, f, c, ni, vf, vc, na: (f && !vf ? f : 0) + (c && !vc ? c : 0) };
}
export const statut = p => p >= 100 ? ['ok', 'Rentable'] : p >= 70 ? ['mid', 'Proche'] : ['ko', 'Déficitaire'];

/* aggregate a set of rows (filters applied before) */
export function aggregate(rows, srv = S.services) {
  const A = { ca: 0, n: rows.length, clients: new Map(), cofN: 0, cofCA: 0, srv: {}, veh: {}, dept: {}, commune: {}, months: {}, f: 0, c: 0, ni: 0, na: 0, hF: 0, hC: 0, persH: 0, srvN: {} };
  for (const r of rows) {
    const k = rowCalc(r, srv); A.ca += k.total; A.f += k.f; A.c += k.c; A.ni += k.ni; A.na += k.na;
    const cl = (r.client || '').trim() || 'Non renseigné';
    const ce = A.clients.get(cl) || { ca: 0, n: 0, cof: 0, months: new Set(), dept: {} }; ce.ca += k.total; ce.n++; if (r.cofrac) ce.cof++; ce.months.add(r.mois); ce.dept[r.dept || ''] = (ce.dept[r.dept || ''] || 0) + k.total; A.clients.set(cl, ce);
    if (r.cofrac) { A.cofN++; A.cofCA += k.total; }
    for (const [code, v] of Object.entries(r.montants || {})) { const n = Number(v) || 0; if (!n) continue; A.srv[code] = (A.srv[code] || 0) + n; A.srvN[code] = (A.srvN[code] || 0) + 1; }
    if (k.f && k.vf) addVeh(A, k.vf, r.mois, k.f, 'f');
    if (k.c && k.vc) addVeh(A, k.vc, r.mois, k.c, 'c');
    const d = (r.dept || '').trim(); const de = A.dept[d] || (A.dept[d] = { ca: 0, n: 0, dep: 0 }); de.ca += k.total; de.n++; de.dep += Number((r.montants || {}).deplacement) || 0;
    const com = communeOf(r.lieu); const co = A.commune[com] || (A.commune[com] = { ca: 0, n: 0, dept: d }); co.ca += k.total; co.n++;
    const m = A.months[r.mois] || (A.months[r.mois] = { ca: 0, n: 0 }); m.ca += k.total; m.n++;
    const hf = hours(r.h_fourgon), hc = hours(r.h_camion); A.hF += hf; A.hC += hc; A.persH += Math.max(hf, hc) * (Number(r.personnes) || 0);
  }
  return A;
}
function addVeh(A, v, m, amt, kind) { const e = A.veh[v] || (A.veh[v] = { ca: 0, f: 0, c: 0, months: {}, n: 0 }); e.ca += amt; e[kind] += amt; e.months[m] = (e.months[m] || 0) + amt; e.n++; }
export function communeOf(lieu) { const s = String(lieu || '').split(/\s[-–—]+\s|\s-{2,}\s?/)[0].trim().toUpperCase(); return s || 'NON RENSEIGNÉ'; }
export const activeMonths = (rows = rowsYear()) => [...new Set(rows.filter(r => rowCalc(r).total > 0).map(r => r.mois))].sort((a, b) => a - b);

/* quality checks */
export function anomalies(rows = rowsYear()) {
  const out = []; const seen = new Map();
  for (const r of rows) {
    const k = rowCalc(r); const tag = `${MOIS[r.mois - 1]} · ${r.jour ? fmtDate(r.jour) : 'sans date'} · ${r.client || 'client ?'}`;
    if (!r.jour) out.push({ r, t: 'Date manquante', s: tag, lvl: 'warn' });
    else { const d = new Date(r.jour + 'T12:00:00'); if (d.getMonth() + 1 !== r.mois || d.getFullYear() !== r.annee) out.push({ r, t: 'Date hors du mois de saisie', s: tag, lvl: 'warn' }); }
    if (!String(r.client || '').trim()) out.push({ r, t: 'Client manquant', s: tag, lvl: 'err' });
    if (!String(r.dept || '').trim() && k.total) out.push({ r, t: 'Département manquant', s: tag, lvl: 'warn' });
    if (k.na) out.push({ r, t: `${euro(k.na)} sans véhicule affecté`, s: tag, lvl: 'err' });
    if (!k.total && (r.client || r.lieu)) out.push({ r, t: 'Intervention sans montant', s: tag, lvl: 'warn' });
    if (k.total) { const key = [r.jour, norm(r.client), norm(r.lieu), r2(k.total)].join('|'); if (seen.has(key)) out.push({ r, t: 'Doublon probable', s: tag, lvl: 'warn' }); else seen.set(key, r); }
  }
  return out;
}

/* =========================================================
   ICONS
   ========================================================= */
export const I = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  grid: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M3 9h18M3 15h18M9 3v18"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  db: '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  right: '<path d="M9 6l6 6-6 6"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M18 13l-6 6-6-6"/>',
  chevUp: '<path d="m6 15 6-6 6 6"/>',
  chevDown: '<path d="m6 9 6 6 6-6"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
  alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  truck: '<path d="M2 6h11v10H2zM13 9h4l4 4v3h-8z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M22 20c0-3-2-5-5-5.7"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 20h16"/>',
  dl: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 20h16"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  msg: '<path d="M21 12a8 8 0 0 1-11.8 7L4 20l1.1-4.6A8 8 0 1 1 21 12z"/>',
  send: '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>',
  sync: '<path d="M20 11a8 8 0 0 0-14.3-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.5L20 16M20 20v-4h-4"/>',
  print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
  euro: '<path d="M18 6a7 7 0 1 0 0 12"/><path d="M4 10h10M4 14h10"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5"/><path d="M5 12h11"/>'
};
export const ic = (n, c = 'i') => `<svg class="${c}" viewBox="0 0 24 24" aria-hidden="true">${I[n] || ''}</svg>`;

/* Deldossi logo, inline so Poppins and the theme apply */
let LG = 0;
export function logoSVG() {
  const p = `dl${++LG}_`;
  const D = 'M849.789,707.148C876.186,692.639 907.072,688.58 936.321,695.777C975.18,705.384 1032.971,734.26 1039,821C1047.849,948.315 871.803,1012.452 826.373,898.02C822.672,888.746 820.53,878.923 820.032,868.95C818.989,848.383 822.4,813.004 854,793C900.438,763.603 900.549,790.478 901,793L901,885C901,885 937.923,888.478 967.27,853.651C980.093,838.463 985.544,818.381 982.159,798.794C978.775,779.207 966.902,762.119 949.725,752.115C942.193,747.744 933.066,744.17 922.02,741.804C906.315,738.462 889.951,740.298 875.378,747.037C862.844,752.829 848.798,762.424 841,778C824.68,810.595 787.535,782.475 801,758C809.887,741.846 823.667,721.537 849.789,707.148Z';
  return `<svg class="dl" viewBox="0 0 3273 678" role="img" aria-label="Deldossi Assainissement"><defs>
<linearGradient id="${p}1" x1="0" y1="0" x2="1" y2="0" gradientUnits="userSpaceOnUse" gradientTransform="matrix(128.36,-77.84,77.84,128.36,913.38,911.1)"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#a6a6a6"/></linearGradient>
<linearGradient id="${p}3" x1="0" y1="0" x2="1" y2="0" gradientUnits="userSpaceOnUse" gradientTransform="matrix(0.71,-174.79,174.79,0.71,886.49,954.27)"><stop offset="0" stop-color="#0a2e6d"/><stop offset=".54" stop-color="#035fd2"/><stop offset="1" stop-color="#0073fa"/></linearGradient>
<linearGradient id="${p}4" x1="0" y1="0" x2="1" y2="0" gradientUnits="userSpaceOnUse" gradientTransform="matrix(199.95,0,0,155.76,853.05,885.88)"><stop offset="0" stop-color="#0073fa"/><stop offset="1" stop-color="#0a2e6d"/></linearGradient>
<linearGradient id="${p}5" x1="0" y1="0" x2="1" y2="0" gradientUnits="userSpaceOnUse" gradientTransform="matrix(78.88,-186.82,186.82,78.88,918.72,914.64)"><stop offset="0" stop-color="#0073fa"/><stop offset=".46" stop-color="#035fd2"/><stop offset="1" stop-color="#0a2e6d"/></linearGradient>
<linearGradient id="${p}6" x1="0" y1="0" x2="1" y2="0" gradientUnits="userSpaceOnUse" gradientTransform="matrix(-184.67,-31.85,31.85,-184.67,991.2,779.47)"><stop offset="0" stop-color="#0073fa"/><stop offset=".46" stop-color="#035fd2"/><stop offset="1" stop-color="#0a2e6d"/></linearGradient>
<clipPath id="${p}c"><path d="${D}"/></clipPath></defs>
<g transform="matrix(1,0,0,1,-117.88,-409.02)"><g transform="matrix(2.480263,0,0,2.480263,-1977.275438,-3651.550534)">
<g transform="matrix(1.025202,0,0,1.025202,26.502221,928.740779)"><path d="${D}" fill="url(#${p}1)"/><g clip-path="url(#${p}c)">
<path d="M863,773L847,793L820,815L811,865L817,917L848,963.759L906,976L937,957.566L905,943L882.599,907L889,858L918.719,830L911,783L889,767.978L863,773Z" fill="url(#${p}3)"/>
<path d="M901,832C901,832 867.604,842.33 855,885C842.396,927.67 890.256,1004.691 1020,937L1052,861L1053,816L1023,808L967.372,869L933.152,846L901,832Z" fill="url(#${p}4)"/>
<path d="M901,885C901,885 910.477,946.623 984,913C1057.523,879.377 1040.282,774.185 1039.322,739L1008,707L942,678L909,680L893,706L975,757L976,814L956,856L918.719,874L901,885Z" fill="url(#${p}5)"/>
<path d="M797,739L788,793L842,793L864,760L896,758L933.152,773L966,850C966,850 1007.482,824.721 984,750C960.518,675.279 837.161,682.701 774,691L797,739Z" fill="url(#${p}6)"/></g></g>
<g transform="matrix(0.725502,0,0,0.725502,261.348355,184.060873)"><g transform="matrix(0.87879,0,0,0.87879,158.828305,1297.515019)"><text class="tx" x="1265" y="1041" style="font-family:Poppins,sans-serif;font-weight:700;font-size:250px">D<tspan x="1496.75 1682 1851.25 2083 2329.5 2533.25 2737" y="1041">ELDOSSI</tspan></text></g>
<g transform="matrix(0.476303,0,0,0.476303,678.37741,1830.732516)"><text class="tx" x="1265" y="1041" style="font-family:Poppins,sans-serif;font-weight:400;font-size:192.19px">A<tspan x="1493.13 1704.539 1915.948 2144.077 2289.949 2523.652 2669.524 2880.933 3092.342 3289.529 3553.598 3750.785 3984.488" y="1041">SSAINISSEMENT</tspan></text></g></g></g></g></svg>`;
}

/* =========================================================
   UI PRIMITIVES (Hympyr brand OS)
   ========================================================= */
export function animOut(el, y = -6, d = 180) {
  if (!el || el.hidden) return Promise.resolve();
  el.getAnimations().forEach(a => a.cancel());
  return el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateY(${RM ? 0 : y}px)` }], { duration: RM ? 140 : d, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }).done;
}
export function stagger(scope, sel = '[data-st]') {
  $$(sel, scope).filter(k => !k.hidden).slice(0, 12).forEach((k, i) => k.animate([{ opacity: 0, transform: `translateY(${RM ? 0 : 14}px)` }, { opacity: 1, transform: 'none' }], { duration: RM ? 200 : 520, delay: RM ? 0 : 40 + i * 45, easing: EASE, fill: 'backwards' }));
}
export function place(p, b, instant) {
  if (!p) return; if (!b || !b.offsetParent) { p.style.opacity = 0; return; }
  if (instant) p.classList.add('no-tr');
  p.style.width = b.offsetWidth + 'px'; p.style.height = b.offsetHeight + 'px'; p.style.transform = `translate(${b.offsetLeft}px,${b.offsetTop}px)`; p.style.opacity = 1;
  if (instant) { void p.offsetWidth; p.classList.remove('no-tr'); }
}
export function setupGlide(box, sel = 'button') {
  if (box._g) return; box._g = 1;
  const g = document.createElement('span'); g.className = 'glider'; box.prepend(g); let shown = false;
  box.addEventListener('pointerover', e => { const b = e.target.closest(sel); if (!b || !box.contains(b) || !FINE) return; if (b.classList.contains('on') && box._ind) { g.style.opacity = 0; shown = false; return; } place(g, b, !shown); shown = true; });
  box.addEventListener('pointerleave', () => { g.style.opacity = 0; shown = false; });
}
export function setupInd(box) { if (!box._ind) { const p = document.createElement('span'); p.className = 'ind'; box.prepend(p); box._ind = p; } return box._ind; }
export function seg(box, items, active, onPick) {
  box.innerHTML = items.map(([v, l, x]) => `<button type="button" data-v="${esc(v)}" class="${String(v) === String(active) ? 'on' : ''}" role="tab" aria-selected="${String(v) === String(active)}">${x ? ic(x) : ''}<span>${l}</span></button>`).join('');
  box._ind = null; box._g = 0; setupInd(box); setupGlide(box);
  requestAnimationFrame(() => { const b = $('button.on', box); place(box._ind, b, true); if (b && box.classList.contains('scroll')) box.scrollLeft = b.offsetLeft - (box.clientWidth - b.offsetWidth) / 2; });
  box.onclick = e => { const b = e.target.closest('button[data-v]'); if (!b || b.classList.contains('on')) return; segSet(box, b.dataset.v); onPick(b.dataset.v); };
}
export function segSet(box, v) {
  $$('button[data-v]', box).forEach(b => { const on = b.dataset.v === String(v); b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  const b = $(`button[data-v="${CSS.escape(String(v))}"]`, box); place(box._ind, b, false);
  if (box.classList.contains('scroll') && b) box.scrollTo({ left: b.offsetLeft - (box.clientWidth - b.offsetWidth) / 2, behavior: RM ? 'auto' : 'smooth' });
}
export function replaceInd(scope = document) { $$('.seg,.tabs', scope).forEach(b => { if (b._ind) place(b._ind, $('button.on', b), true); }); }
addEventListener('resize', () => replaceInd());

let magEl = null;
if (FINE) {
  document.addEventListener('pointermove', e => {
    const el = e.target.closest('.btn,.icon-btn,.mag'); if (el !== magEl) { if (magEl) magEl.style.transform = ''; magEl = el; } if (!el) return;
    const r = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    el.style.setProperty('--mx', x + 'px'); el.style.setProperty('--my', y + 'px');
    if (el.classList.contains('mag') && !RM) el.style.transform = `translate(${((x / r.width - .5) * 8).toFixed(2)}px,${((y / r.height - .5) * 6).toFixed(2)}px)`;
  }, { passive: true });
}
document.addEventListener('pointerdown', e => { const b = e.target.closest('.btn,.icon-btn'); if (!b) return; b.classList.add('pressed'); const up = () => { b.classList.remove('pressed'); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); }; addEventListener('pointerup', up); addEventListener('pointercancel', up); });

let toastT;
export function toast(m, i = 'check') { const t = $('#toast'); t.innerHTML = ic(i) + `<span>${esc(m)}</span>`; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3000); }

export function modal(html, { wide, top, onClose } = {}) {
  const ov = document.createElement('div'); ov.className = 'overlay' + (top ? ' top' : '');
  ov.innerHTML = `<div class="modal glass ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  $('#layer').appendChild(ov);
  const m = $('.modal', ov);
  ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, easing: EASE });
  m.animate([{ opacity: 0, transform: 'translateY(16px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 440, easing: EASE });
  let closed = false;
  const close = async () => {
    if (closed) return; closed = true; removeEventListener('keydown', key);
    m.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(10px) scale(.98)' }], { duration: 200, fill: 'forwards' });
    await ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }).done;
    ov.remove(); onClose && onClose();
  };
  const key = e => { if (e.key === 'Escape' && $('#layer').lastElementChild === ov) close(); };
  addEventListener('keydown', key);
  ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-close]')) close(); });
  setTimeout(() => { const f = $('input:not([type=radio]):not([type=file]),textarea,select', m); if (f && FINE) f.focus({ preventScroll: true }); }, 180);
  return { el: m, close };
}
export function confirmBox(title, text, { ok = 'Confirmer', danger } = {}) {
  return new Promise(res => {
    let r = false;
    const { el, close } = modal(`<div class="modal-head"><div><h2>${esc(title)}</h2><p>${esc(text)}</p></div></div><div class="modal-foot"><button class="btn ghost" data-close>Annuler</button><button class="btn ${danger ? 'danger' : ''}" data-ok>${esc(ok)}</button></div>`, { onClose: () => res(r) });
    $('[data-ok]', el).onclick = () => { r = true; close(); };
  });
}
export function syncThemeLabel() { const b = $('#themeBtn'); if (b) b.setAttribute('aria-label', root.dataset.theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'); }
export function setTheme(next) {
  if (next === root.dataset.theme) return;
  const apply = () => { root.dataset.theme = next; store.set('hy-theme', next); syncThemeLabel(); };
  if (!document.startViewTransition || RM) { root.classList.add('soft-swap'); apply(); setTimeout(() => root.classList.remove('soft-swap'), 760); return; }
  root.classList.add('vt-theme');
  const vt = document.startViewTransition(apply);
  vt.ready.then(() => { const r = Math.hypot(innerWidth, innerHeight); root.animate({ clipPath: ['circle(0px at 100% 0%)', `circle(${r}px at 100% 0%)`] }, { duration: 950, easing: 'cubic-bezier(.65,0,.35,1)', pseudoElement: '::view-transition-new(root)' }); }).catch(() => {});
  vt.finished.catch(() => {}).finally(() => root.classList.remove('vt-theme'));
}
export function animateBars(scope) { $$('.bar i[data-w]', scope).forEach(b => { b.style.width = '0'; }); requestAnimationFrame(() => requestAnimationFrame(() => $$('.bar i[data-w]', scope).forEach(b => { b.style.width = b.dataset.w; }))); }
export function download(name, data, type = 'text/csv;charset=utf-8') {
  const blob = data instanceof Blob ? data : new Blob([type.startsWith('text/csv') ? '﻿' + data : data], { type }); const a = document.createElement('a'); const u = URL.createObjectURL(blob);
  a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
}
const libs = {};
export function loadLib(name) {
  const src = { xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', exceljs: 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js' }[name];
  if (!libs[name]) libs[name] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { delete libs[name]; rej(new Error('lib')); }; document.head.appendChild(s); });
  return libs[name];
}

/* tooltip for charts */
let tipEl;
export function tipOn(scope) {
  if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'tip'; document.body.appendChild(tipEl); }
  scope.addEventListener('pointermove', e => { const t = e.target.closest('[data-tip]'); if (!t) { tipEl.classList.remove('on'); return; } tipEl.innerHTML = t.dataset.tip; tipEl.classList.add('on'); const w = tipEl.offsetWidth; tipEl.style.left = Math.min(innerWidth - w - 12, e.clientX + 14) + 'px'; tipEl.style.top = (e.clientY + 16) + 'px'; });
  scope.addEventListener('pointerleave', () => tipEl.classList.remove('on'));
}

/* =========================================================
   APP : auth, routing, navigation, realtime, search, ticket
   ========================================================= */
import {
  sb, $, $$, esc, root, EASE, RM, store, S, loadAll, toast, modal, seg, segSet, setupInd, setupGlide, place, replaceInd, ic, animOut, stagger,
  setTheme, syncThemeLabel, logoSVG, onChange, years_, upsertLocal, rowCalc, MOIS, euro2, fmtDate, errMsg
} from './core.js?v=2';
import { renderDashboard, renderSaisie, renderVehicules, renderClients, renderServices, renderTerritoire, renderTendance, renderProductivite, savesPending } from './views.js?v=2';
import { renderDonnees, renderParametres } from './data.js?v=2';

const NAV = [
  { k: 'accueil', l: 'Tableau de bord', s: 'Accueil', i: 'home', t: 'Tableau de bord', d: 'Chiffre d\'affaires, rentabilité de la flotte, portefeuille clients et points à vérifier, mis à jour en direct.' },
  { k: 'saisie', l: 'Saisie', s: 'Saisie', i: 'grid', main: true, t: 'Saisie des interventions', d: 'Le classeur de suivi, mois par mois. Chaque modification est enregistrée et visible aussitôt par toute l\'équipe.' },
  { k: 'analyses', l: 'Analyses', s: 'Analyses', i: 'chart', t: 'Analyses', d: 'Une vue par décision : flotte, clients, services, territoire, comparatif annuel et productivité.', subs: [['vehicules', 'Véhicules'], ['clients', 'Clients'], ['services', 'Services'], ['territoire', 'Territoire'], ['tendance', 'Comparatif N-1'], ['productivite', 'Productivité']] },
  { k: 'donnees', l: 'Données', s: 'Données', i: 'db', t: 'Données', d: 'Import du classeur Excel, exports CSV et Excel avec formules, journal des modifications.' },
  { k: 'parametres', l: 'Paramètres', s: 'Réglages', i: 'gear', t: 'Paramètres', d: 'Services et imputation, véhicules et seuils de rentabilité, chiffre d\'affaires de référence.' }
];
const MOBILE = ['accueil', 'analyses', 'saisie', 'donnees', 'parametres'];
const VIEWS = { accueil: renderDashboard, saisie: renderSaisie, 'analyses.vehicules': renderVehicules, 'analyses.clients': renderClients, 'analyses.services': renderServices, 'analyses.territoire': renderTerritoire, 'analyses.tendance': renderTendance, 'analyses.productivite': renderProductivite, donnees: renderDonnees, parametres: renderParametres };
const R = { tab: null, sub: null, params: {}, tok: 0 };
const ctx = {
  get params() { return R.params; }, set params(v) { R.params = v; history.replaceState(null, '', hashFor()); },
  go: (t, s, p = {}) => go(t, s, p), refresh: () => renderSub(true)
};
const hashFor = () => `#${R.tab}${R.sub ? '/' + R.sub : ''}${R.params && R.params.m ? '?m=' + R.params.m : ''}`;
function parseHash() { const h = location.hash.replace(/^#/, ''); if (!h || /access_token|type=recovery/.test(h)) return null; const [path, q] = h.split('?'); const [t, s] = path.split('/'); const p = {}; if (q) q.split('&').forEach(kv => { const [k, v] = kv.split('='); p[k] = isNaN(+v) ? decodeURIComponent(v) : +v; }); return NAV.some(n => n.k === t) ? { t, s, p } : null; }

async function go(t, s, params = {}, force) {
  const def = NAV.find(n => n.k === t) || NAV[0]; const tab = def.k;
  const sub = def.subs ? (def.subs.some(x => x[0] === s) ? s : (R.tab === tab && R.sub) || store.get('dl-sub-' + tab, def.subs[0][0])) : null;
  if (!force && tab === R.tab && sub === R.sub && JSON.stringify(params) === JSON.stringify(R.params)) return;
  const tabChanged = tab !== R.tab || !$('#pageHead');
  R.tab = tab; R.sub = sub; R.params = params; if (sub) store.set('dl-sub-' + tab, sub); history.replaceState(null, '', hashFor());
  renderNav(); syncScene();
  if (tabChanged) await renderView(); else { const sn = $('#subNav'); if (sn && sub) segSet(sn, sub); await renderSub(); }
}
function renderNav() {
  const tabs = $('#tabs');
  if (!tabs._built) {
    tabs.innerHTML = NAV.map(n => `<button type="button" data-tab="${n.k}">${ic(n.i)}<span>${n.l}</span></button>`).join(''); setupInd(tabs); setupGlide(tabs); tabs._built = 1;
    $('#bottombar').innerHTML = MOBILE.map(k => NAV.find(n => n.k === k)).map(n => `<button type="button" class="bb ${n.main ? 'main' : ''}" data-tab="${n.k}" aria-label="${n.l}">${ic(n.i)}<span>${n.s}</span></button>`).join('');
  }
  $$('button[data-tab]', tabs).forEach(b => b.classList.toggle('on', b.dataset.tab === R.tab));
  $$('#bottombar .bb').forEach(b => b.classList.toggle('on', b.dataset.tab === R.tab));
  requestAnimationFrame(() => place(tabs._ind, $('button.on', tabs), !tabs._placed)); tabs._placed = true;
}
function syncScene() { const i = NAV.findIndex(n => n.k === R.tab); $$('.scene').forEach(s => s.classList.toggle('on', +s.dataset.scene === Math.max(0, i))); }
async function renderView() {
  const tok = ++R.tok; const view = $('#view');
  await animOut(view, -6, 170); if (tok !== R.tok) return;
  scrollTo({ top: 0, behavior: 'instant' }); view.getAnimations().forEach(a => a.cancel());
  const def = NAV.find(n => n.k === R.tab);
  view.innerHTML = `<div class="page-head glass" id="pageHead"><div class="txt"><span class="label">Deldossi Assainissement · ${S.annee}</span><h1 style="margin-top:8px">${esc(def.t)}</h1><p>${esc(def.d)}</p></div>
    ${def.subs ? '<div class="seg glass glide scroll" id="subNav"></div>' : R.tab === 'accueil' ? `<div class="btn-row no-print"><button class="btn ghost mag" id="printBtn">${ic('print')}Imprimer ou PDF</button><button class="btn mag" data-jump="saisie">${ic('plus')}Saisir une intervention</button></div>` : ''}</div><div id="sub" style="display:flex;flex-direction:column;gap:20px"></div>`;
  if (def.subs) seg($('#subNav', view), def.subs, R.sub, v => go(R.tab, v));
  const pb = $('#printBtn', view); if (pb) pb.onclick = () => print();
  const jb = $('[data-jump]', view); if (jb) jb.onclick = () => go('saisie');
  await renderSub(false, true);
  stagger(view, ':scope > .page-head');
}
async function renderSub(soft, initial) {
  const host = $('#sub'); if (!host) return;
  const fn = VIEWS[R.sub ? `${R.tab}.${R.sub}` : R.tab]; if (!fn) return;
  const fresh = document.createElement('div'); fresh.id = 'sub'; fresh.style.cssText = 'display:flex;flex-direction:column;gap:20px';
  if (soft) {
    const y = scrollY; host.replaceWith(fresh);
    try { fn(fresh, ctx); } catch (e) { console.error(e); }
    $$('[data-st]', fresh).forEach(x => x.getAnimations().forEach(a => a.cancel()));
    fresh.animate([{ opacity: .6 }, { opacity: 1 }], { duration: 300, easing: EASE }); scrollTo({ top: y, behavior: 'instant' }); return;
  }
  if (!initial) { await animOut(host, -4, 150); }
  host.replaceWith(fresh);
  try { fn(fresh, ctx); } catch (e) { console.error(e); fresh.innerHTML = `<div class="panel glass"><div class="empty"><p>Affichage impossible. Rechargez la page.</p></div></div>`; }
}
document.addEventListener('dl-refresh', () => renderSub(true));

/* ---------- live data ---------- */
let pendingRefresh = false, rT;
function softRefresh() {
  clearTimeout(rT); rT = setTimeout(() => {
    const a = document.activeElement; if (a && a.closest && a.closest('#sub') && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) { pendingRefresh = true; return; }
    if ($('.overlay')) { pendingRefresh = true; return; }
    pendingRefresh = false; renderSub(true);
  }, 350);
}
document.addEventListener('focusout', () => { if (pendingRefresh) setTimeout(() => { if (pendingRefresh && !(document.activeElement && document.activeElement.closest && document.activeElement.closest('#sub input,#sub select'))) softRefresh(); }, 120); });
onChange(src => { if (src === 'services' || src === 'params') { if (R.tab !== 'parametres') softRefresh(); } });
function realtime() {
  const live = $('#live');
  sb.channel('chantier-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chantier_interventions' }, p => {
      let row = p.new && p.new.id ? p.new : null;
      if (p.eventType === 'DELETE') { const id = p.old && p.old.id; row = S.rows.find(r => r.id === id) || null; S.rows = S.rows.filter(r => r.id !== id); }
      else if (row) upsertLocal(row);
      const host = $('#sub');
      if (R.tab === 'saisie' && host && host._remote) host._remote(p.eventType, row); else if (R.tab !== 'donnees' && R.tab !== 'parametres') softRefresh();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chantier_services' }, p => {
      if (p.eventType === 'DELETE') S.services = S.services.filter(s => s.code !== (p.old || {}).code); else { const i = S.services.findIndex(s => s.code === p.new.code); if (i > -1) S.services[i] = p.new; else S.services.push(p.new); }
      if (R.tab !== 'parametres') softRefresh();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chantier_parametres' }, p => { if (p.new && p.new.cle) S.params[p.new.cle] = p.new.valeur; if (R.tab !== 'parametres') softRefresh(); })
    .subscribe(st => { S.live = st === 'SUBSCRIBED'; live.classList.toggle('off', !S.live); $('span', live).textContent = S.live ? 'En direct' : 'Hors ligne'; live.title = S.live ? 'Les modifications des autres utilisateurs apparaissent en direct' : 'Connexion temps réel interrompue'; });
}
function yearSelect() {
  const s = $('#yearSel'); s.innerHTML = years_().map(y => `<option ${y === S.annee ? 'selected' : ''}>${y}</option>`).join('');
  s.onchange = () => { S.annee = +s.value; store.set('dl-annee', S.annee); R.params = {}; renderView(); };
}

/* ---------- search ---------- */
function openSearch() {
  const { el, close } = modal(`<div class="search-box"><input class="input" id="sq" placeholder="Rechercher un client, un lieu, un véhicule" autocomplete="off"></div><div class="search-res" id="sr"><p class="muted small">Saisissez au moins deux caractères.</p></div>`, { top: true });
  $('#sq', el).oninput = e => {
    const q = e.target.value.trim().toLowerCase(); const box = $('#sr', el);
    if (q.length < 2) { box.innerHTML = '<p class="muted small">Saisissez au moins deux caractères.</p>'; return; }
    const res = S.rows.filter(r => [r.client, r.lieu, r.fourgon, r.camion].join(' ').toLowerCase().includes(q)).sort((a, b) => (b.jour || '').localeCompare(a.jour || '')).slice(0, 40);
    box.innerHTML = res.map(r => `<div class="tile rowi click" data-r="${r.id}"><span class="ico">${ic('grid')}</span><div class="t"><b>${esc(r.client || 'Sans client')} · ${euro2(rowCalc(r).total)}</b><span>${esc(r.lieu || '')} · ${r.jour ? fmtDate(r.jour) : MOIS[r.mois - 1] + ' ' + r.annee}</span></div><span class="a">${ic('right')}</span></div>`).join('') || '<p class="muted small">Aucun résultat.</p>';
  };
  el.onclick = e => { const r = e.target.closest('[data-r]'); if (!r) return; const row = S.rows.find(x => x.id === r.dataset.r); close(); if (row.annee !== S.annee) { S.annee = row.annee; store.set('dl-annee', S.annee); yearSelect(); } go('saisie', null, { m: row.mois, focus: row.id }, true); };
}
addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && !$('#app').hidden) { e.preventDefault(); openSearch(); } });

/* ---------- ticket ---------- */
function openTicket() {
  let type = 'Question';
  const { el, close } = modal(`<div class="modal-head"><div><span class="label">Support</span><h2 style="margin-top:6px">Envoyer un ticket</h2><p>Une question, une erreur ou une idée d'amélioration de l'outil.</p></div><button class="icon-btn" data-close aria-label="Fermer">${ic('x')}</button></div>
    <div class="form"><div class="field"><span>Type</span><div class="seg glass glide" id="tkT" style="align-self:flex-start"></div></div>
    <label class="field"><span>Sujet</span><input class="input" id="tkS" maxlength="100" placeholder="Résumez la demande en une phrase"></label>
    <label class="field"><span>Message</span><textarea class="input" id="tkM" placeholder="Écran concerné, ce que vous attendiez, ce qui s'est passé."></textarea></label></div>
    <div class="modal-foot"><button class="btn ghost" data-close>Annuler</button><button class="btn mag" id="tkGo">${ic('send')}Envoyer le ticket</button></div>`);
  seg($('#tkT', el), [['Question', 'Question'], ['Erreur', 'Erreur'], ['Suggestion', 'Suggestion']], type, v => type = v);
  $('#tkGo', el).onclick = async () => {
    const s = $('#tkS', el), m = $('#tkM', el); if (s.value.trim().length < 3) { s.classList.add('bad'); s.focus(); return; } if (m.value.trim().length < 5) { m.classList.add('bad'); m.focus(); return; }
    const { error } = await sb.from('tickets').insert({ email: S.user.email, sujet: `[Suivi chantier · ${type}] ${s.value.trim()}`.slice(0, 120), message: m.value.trim(), page: hashFor().slice(0, 60), navigateur: navigator.userAgent.slice(0, 250) });
    if (error) { toast(errMsg(error), 'alert'); return; } close(); toast('Ticket envoyé. Réponse sous 48 h ouvrées.', 'send');
  };
}

/* ---------- auth ---------- */
const setMsg = (el, t, k = 'err') => { el.className = 'msg ' + k; el.textContent = t; };
function showLogin() {
  $('#app').hidden = true; const l = $('#login'); l.hidden = false;
  $('#loginCard').animate([{ opacity: 0, transform: 'translateY(16px) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 620, easing: EASE });
}
async function enterApp(session) {
  S.user = session.user;
  const { data: ok, error: e1 } = await sb.rpc('est_membre');
  if (e1 || !ok) { await sb.auth.signOut(); showLogin(); setMsg($('#loginMsg'), 'Ce compte n\'a pas accès au suivi de chantier. Demandez à un administrateur de vous ajouter.'); return; }
  try { await loadAll(); } catch (e) { console.error(e); showLogin(); setMsg($('#loginMsg'), 'Chargement des données impossible. Rechargez la page.'); return; }
  const l = $('#login'); if (!l.hidden) { await $('#loginCard').animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-10px) scale(.98)' }], { duration: 240, fill: 'forwards' }).done; l.hidden = true; $('#loginCard').getAnimations().forEach(a => a.cancel()); }
  $('#app').hidden = false; yearSelect(); realtime();
  const p = parseHash(); R.tab = null; await go(p ? p.t : 'accueil', p ? p.s : null, p ? p.p : {}, true);
  $('.topbar').animate([{ opacity: 0, transform: 'translate(-50%,-14px)' }, { opacity: 1, transform: 'translate(-50%,0)' }], { duration: 620, easing: EASE });
  $('#bottombar').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 620, easing: EASE });
  $('#ticketBtn').animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 560, delay: 300, easing: EASE, fill: 'backwards' });
  setTimeout(() => replaceInd(), 650);
}
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault(); const em = $('#email'), pw = $('#password'), msg = $('#loginMsg'), btn = $('#loginBtn');
  em.classList.remove('bad'); pw.classList.remove('bad');
  if (!sb) { setMsg(msg, 'Service de connexion indisponible. Vérifiez votre connexion internet.'); return; }
  if (!/^\S+@\S+\.\S+$/.test(em.value.trim())) { em.classList.add('bad'); setMsg(msg, 'Saisissez une adresse e-mail valide.'); em.focus(); return; }
  if (!pw.value) { pw.classList.add('bad'); setMsg(msg, 'Saisissez votre mot de passe.'); pw.focus(); return; }
  btn.disabled = true; btn.textContent = 'Connexion en cours';
  const { data, error } = await sb.auth.signInWithPassword({ email: em.value.trim().toLowerCase(), password: pw.value });
  btn.disabled = false; btn.textContent = 'Se connecter';
  if (error) { pw.classList.add('bad'); setMsg(msg, /confirm/i.test(error.message) ? 'Adresse e-mail non confirmée. Consultez votre boîte de réception.' : 'Identifiant ou mot de passe incorrect.'); return; }
  pw.value = ''; setMsg(msg, ''); enterApp(data.session);
});
$('#forgotBtn').onclick = async () => {
  const em = $('#email'), msg = $('#loginMsg');
  if (!/^\S+@\S+\.\S+$/.test(em.value.trim())) { em.classList.add('bad'); setMsg(msg, 'Saisissez d\'abord votre adresse e-mail, puis cliquez à nouveau.'); em.focus(); return; }
  const { error } = await sb.auth.resetPasswordForEmail(em.value.trim().toLowerCase(), { redirectTo: location.origin + location.pathname });
  setMsg(msg, error ? 'Envoi impossible pour le moment. Réessayez dans quelques minutes.' : `Un lien de réinitialisation a été envoyé à ${em.value.trim()}.`, error ? 'err' : 'ok');
};
$('#resetForm').addEventListener('submit', async e => {
  e.preventDefault(); const p = $('#newPassword'), msg = $('#resetMsg');
  if (p.value.length < 8) { p.classList.add('bad'); setMsg(msg, 'Choisissez un mot de passe de 8 caractères minimum.'); return; }
  const { error } = await sb.auth.updateUser({ password: p.value });
  if (error) { setMsg(msg, 'Mise à jour impossible. Demandez un nouveau lien.'); return; }
  $('#resetForm').hidden = true; $('#loginForm').hidden = false; const { data } = await sb.auth.getSession(); if (data.session) enterApp(data.session);
});

/* ---------- wiring ---------- */
$$('[data-logo]').forEach(x => x.innerHTML = logoSVG());
syncThemeLabel();
$('#themeBtn').onclick = () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
new MutationObserver(() => { if (!$('#app').hidden && R.tab) setTimeout(() => renderSub(true), 980); }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
$('#searchBtn').onclick = openSearch;
$('#ticketBtn').onclick = openTicket;
$('#tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) go(b.dataset.tab); };
$('#bottombar').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) go(b.dataset.tab); };
$('[data-home]').onclick = e => { e.preventDefault(); go('accueil'); };
$('#logoutBtn').onclick = async () => { if (savesPending()) { toast('Enregistrement en cours, patientez un instant.', 'sync'); return; } await sb.auth.signOut(); location.hash = ''; location.reload(); };
addEventListener('beforeunload', e => { if (savesPending()) { e.preventDefault(); e.returnValue = ''; } });

(async function boot() {
  if (window.__DL_TEST__) { window.__DL_TEST__({ enterApp, go, S }); return; }
  if (!sb) { showLogin(); setMsg($('#loginMsg'), 'Service de connexion indisponible. Vérifiez votre connexion internet.'); return; }
  sb.auth.onAuthStateChange((ev, session) => { if (ev === 'PASSWORD_RECOVERY') { showLogin(); $('#loginForm').hidden = true; $('#resetForm').hidden = false; $('#forgotBtn').hidden = true; } });
  const { data } = await sb.auth.getSession();
  if (data.session && !/type=recovery/.test(location.hash)) enterApp(data.session); else showLogin();
})();

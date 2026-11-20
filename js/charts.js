/* =========================================================
   CHARTS : lightweight SVG, theme aware, Transport palette
   ========================================================= */
import { esc, euro, keur, pct, root, num } from './core.js?v=2';

export function pal() {
  return root.dataset.theme === 'dark'
    ? ['#5B95E8', '#C8D3DE', '#2E6FD0', '#9DBCEB', '#7D8B99', '#E6ECF3', '#3F5E8C', '#B9C6D3', '#1F4E96', '#F5F4F0', '#6A7480', '#8FA9CC', '#A6B4C2']
    : ['#286ACB', '#081B3D', '#7FA6E0', '#9AABBD', '#1E4A8C', '#C8D3DE', '#4E86D6', '#5B636A', '#A9C1E8', '#2F3B4A', '#6F93C6', '#B7C3CF', '#3D5A80'];
}
const nice = v => { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; };

/* columns (+ optional dashed comparison line, + optional threshold line) */
export function columns(data, { h = 260, line, lineLabel = 'N-1', label = 'CA', seuil, fmt = euro, stacked, axis = v => keur(v).replace(' €', '') } = {}) {
  const W = 720, pl = 54, pr = 10, pt = 18, pb = 30, ih = h - pt - pb, iw = W - pl - pr;
  const max = nice(Math.max(1, ...data.map(d => stacked ? d.parts.reduce((a, b) => a + b.v, 0) : d.v), ...(line ? data.map(d => d.l || 0) : []), seuil || 0) * 1.08);
  const bw = iw / data.length, y = v => pt + ih - (v / max) * ih;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${h}" role="img" aria-label="${esc(label)}">`;
  for (let i = 0; i <= 4; i++) { const v = max * i / 4; s += `<line class="gl" x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}"/><text x="${pl - 8}" y="${y(v) + 4}" text-anchor="end">${axis(v)}</text>`; }
  const P = pal();
  data.forEach((d, i) => {
    const x = pl + i * bw, w = Math.max(4, bw * .58), cx = x + (bw - w) / 2;
    let tip = `<b>${esc(d.label)}</b><br>${label} : ${fmt(stacked ? d.parts.reduce((a, b) => a + b.v, 0) : d.v)}`;
    if (line && d.l) tip += `<br>${lineLabel} : ${fmt(d.l)}<br>Écart : ${d.l ? pct((d.v - d.l) / d.l * 100) : '-'}`;
    s += `<g class="col">`;
    if (stacked) { let acc = 0; d.parts.forEach((p, j) => { if (!p.v) return; const y1 = y(acc + p.v), hh = y(acc) - y1; s += `<rect x="${cx}" y="${y1}" width="${w}" height="${Math.max(0, hh)}" rx="3" fill="${P[j % P.length]}"><animate attributeName="opacity" from="0" to="1" dur=".6s"/></rect>`; acc += p.v; tip += `<br>${esc(p.k)} : ${fmt(p.v)}`; }); }
    else { const hh = Math.max(d.v > 0 ? 2 : 0, y(0) - y(d.v)); s += `<rect class="b ${d.dim ? 'alt' : ''}" x="${cx}" y="${y(0) - hh}" width="${w}" height="${hh}" rx="${Math.min(8, w / 3)}"><animate attributeName="height" from="0" to="${hh}" dur=".8s" calcMode="spline" keySplines=".22 1 .36 1" keyTimes="0;1"/><animate attributeName="y" from="${y(0)}" to="${y(0) - hh}" dur=".8s" calcMode="spline" keySplines=".22 1 .36 1" keyTimes="0;1"/></rect>`; }
    s += `<text x="${x + bw / 2}" y="${h - 9}" text-anchor="middle">${esc(d.label)}</text><rect class="hit" x="${x}" y="${pt}" width="${bw}" height="${ih}" data-tip="${esc(tip)}"/></g>`;
  });
  if (line) {
    const pts = data.map((d, i) => d.l ? [pl + i * bw + bw / 2, y(d.l)] : null).filter(Boolean);
    if (pts.length) s += `<polyline class="ln dash" points="${pts.map(p => p.join(',')).join(' ')}"/>` + pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3" class="pt" style="stroke:var(--muted)"/>`).join('');
  }
  if (seuil) s += `<line class="seuil" x1="${pl}" x2="${W - pr}" y1="${y(seuil)}" y2="${y(seuil)}"/><text x="${W - pr}" y="${y(seuil) - 6}" text-anchor="end" style="fill:var(--err);font-weight:600">Seuil ${euro(seuil)}</text>`;
  s += `<line class="ax" x1="${pl}" x2="${W - pr}" y1="${y(0)}" y2="${y(0)}"/></svg>`;
  if (stacked && data[0]) s += `<div class="legend">${data[0].parts.map((p, j) => `<span><i class="bdot" style="background:${P[j % P.length]};border-radius:3px"></i>${esc(p.k)}</span>`).join('')}</div>`;
  return s;
}

/* cumulative line chart: series = [{k, pts:[v..12], dash}] */
export function lines(series, { h = 240, labels }) {
  const W = 720, pl = 54, pr = 14, pt = 16, pb = 30, ih = h - pt - pb, iw = W - pl - pr;
  const max = nice(Math.max(1, ...series.flatMap(s => s.pts.filter(v => v != null))) * 1.05);
  const n = labels.length, x = i => pl + (iw * i) / (n - 1), y = v => pt + ih - (v / max) * ih; const P = pal();
  let s = `<svg class="chart" viewBox="0 0 ${W} ${h}">`;
  for (let i = 0; i <= 4; i++) { const v = max * i / 4; s += `<line class="gl" x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}"/><text x="${pl - 8}" y="${y(v) + 4}" text-anchor="end">${keur(v).replace(' €', '')}</text>`; }
  labels.forEach((l, i) => { s += `<text x="${x(i)}" y="${h - 9}" text-anchor="middle">${esc(l)}</text>`; });
  series.forEach((se, j) => {
    const pts = se.pts.map((v, i) => v == null ? null : [x(i), y(v)]).filter(Boolean); if (!pts.length) return;
    const col = se.color || P[j % P.length];
    s += `<polyline fill="none" stroke="${col}" stroke-width="${se.dash ? 1.6 : 2.4}" ${se.dash ? 'stroke-dasharray="6 5"' : ''} stroke-linejoin="round" stroke-linecap="round" points="${pts.map(p => p.join(',')).join(' ')}"/>`;
    se.pts.forEach((v, i) => { if (v == null) return; s += `<circle cx="${x(i)}" cy="${y(v)}" r="${se.dash ? 2.5 : 3.5}" fill="var(--bg)" stroke="${col}" stroke-width="2"/><circle cx="${x(i)}" cy="${y(v)}" r="12" class="hit" data-tip="${esc(`<b>${labels[i]} · ${se.k}</b><br>${euro(v)}`)}"/>`; });
  });
  return s + '</svg>';
}

/* donut + legend: items [{k, v}] */
export function donut(items, { center = '', sub = '' } = {}) {
  const tot = items.reduce((a, b) => a + b.v, 0) || 1, R = 70, C = 2 * Math.PI * R, P = pal();
  let off = 0, arcs = '';
  items.forEach((it, i) => { const len = (it.v / tot) * C; arcs += `<circle cx="90" cy="90" r="${R}" stroke="${P[i % P.length]}" stroke-dasharray="${Math.max(0, len - 1.5)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 90 90)" data-tip="${esc(`<b>${it.k}</b><br>${euro(it.v)} · ${pct(it.v / tot * 100)}`)}"/>`; off += len; });
  return `<div class="donut-wrap"><svg class="donut" viewBox="0 0 180 180"><circle cx="90" cy="90" r="${R}" stroke="var(--hair)"/>${arcs}<text x="90" y="88" text-anchor="middle" font-size="20">${esc(center)}</text><text x="90" y="108" text-anchor="middle" font-size="10.5" style="fill:var(--muted);font-weight:500">${esc(sub)}</text></svg>
  <div class="lgd">${items.map((it, i) => `<div class="r"><i style="background:${P[i % P.length]}"></i><span>${esc(it.k)}</span><b>${euro(it.v)}</b><em>${pct(it.v / tot * 100)}</em></div>`).join('')}</div></div>`;
}

/* horizontal bars: items [{k, v, sub}] */
export function hbars(items, { fmt = euro, max } = {}) {
  const m = max || Math.max(1, ...items.map(i => i.v));
  return `<div class="hb">${items.map(i => `<div class="r" data-tip="${esc(`<b>${i.k}</b><br>${fmt(i.v)}${i.sub ? '<br>' + i.sub : ''}`)}"><span title="${esc(i.k)}">${esc(i.k)}</span><div class="bar"><i data-w="${Math.max(0.5, i.v / m * 100).toFixed(1)}%" style="width:0"></i></div><b>${fmt(i.v)}</b></div>`).join('')}</div>`;
}

/* pareto: bars + cumulative % line */
export function pareto(items, { h = 280, top = 20 } = {}) {
  const tot = items.reduce((a, b) => a + b.v, 0) || 1; const list = items.slice(0, top);
  const W = 720, pl = 54, pr = 40, pt = 16, pb = 66, ih = h - pt - pb, iw = W - pl - pr, bw = iw / list.length;
  const max = nice(Math.max(1, ...list.map(i => i.v)) * 1.05), y = v => pt + ih - (v / max) * ih, yp = p => pt + ih - (p / 100) * ih;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${h}">`;
  for (let i = 0; i <= 4; i++) { const v = max * i / 4; s += `<line class="gl" x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}"/><text x="${pl - 8}" y="${y(v) + 4}" text-anchor="end">${keur(v).replace(' €', '')}</text><text x="${W - pr + 6}" y="${yp(i * 25) + 4}">${i * 25} %</text>`; }
  let cum = 0; const pts = [];
  list.forEach((it, i) => {
    cum += it.v; const x = pl + i * bw, w = bw * .62, hh = y(0) - y(it.v); const cp = cum / tot * 100; pts.push([x + bw / 2, yp(cp)]);
    s += `<rect class="b" x="${x + (bw - w) / 2}" y="${y(it.v)}" width="${w}" height="${hh}" rx="4"/><text x="${x + bw / 2}" y="${y(0) + 12}" text-anchor="end" transform="rotate(-40 ${x + bw / 2} ${y(0) + 12})" style="font-size:10px">${esc(it.k.length > 16 ? it.k.slice(0, 15) + '…' : it.k)}</text><rect class="hit" x="${x}" y="${pt}" width="${bw}" height="${ih}" data-tip="${esc(`<b>${it.k}</b><br>${euro(it.v)} · ${pct(it.v / tot * 100)}<br>Cumul : ${pct(cp)}`)}"/>`;
  });
  s += `<line x1="${pl}" x2="${W - pr}" y1="${yp(80)}" y2="${yp(80)}" stroke="var(--warn)" stroke-dasharray="4 4"/><text x="${pl + 4}" y="${yp(80) - 5}" style="fill:var(--warn);font-weight:600">80 %</text>`;
  s += `<polyline class="ln" points="${pts.map(p => p.join(',')).join(' ')}"/>` + pts.map(p => `<circle class="pt" cx="${p[0]}" cy="${p[1]}" r="3"/>`).join('');
  return s + `<line class="ax" x1="${pl}" x2="${W - pr}" y1="${y(0)}" y2="${y(0)}"/></svg>`;
}
export const kpi = (label, value, { delta, sub, icon } = {}) => `<div class="tile kpi" data-st><span>${esc(label)}</span><b title="${esc(value)}">${esc(value)}</b>${delta != null && isFinite(delta) ? `<span class="d ${delta > 0.5 ? 'up' : delta < -0.5 ? 'down' : 'flat'}"><svg class="i" viewBox="0 0 24 24"><path d="${delta >= 0 ? 'M12 19V5M6 11l6-6 6 6' : 'M12 5v14M18 13l-6 6-6-6'}"/></svg>${pct(Math.abs(delta))} ${sub || 'vs N-1'}</span>` : sub ? `<span class="d flat">${esc(sub)}</span>` : ''}</div>`;
export { num };

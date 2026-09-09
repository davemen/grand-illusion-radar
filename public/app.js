const $ = s => document.querySelector(s);
const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = n => n == null ? '—' : '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 });

const VERDICTS = [['grail', 'Grail'], ['confirmed', 'Confirmed'], ['likely', 'Likely'], ['plans', 'Plans'], ['maybe', 'Maybe']];
const state = {
  verdict: new Set(['grail', 'confirmed', 'likely']), source: new Set(),
  deals: false, saved: false, forsale: true, showRest: false,
  sort: 'deal', q: '', min: '', max: '', sources: {}, scanning: false,
  view: (() => { try { return localStorage.getItem('gir.view') || 'list'; } catch { return 'list'; } })(),
};

function applyView() {
  document.querySelector('#grid').classList.toggle('list', state.view === 'list');
  document.querySelectorAll('#view .chip').forEach(c =>
    c.classList.toggle('on', c.dataset.v === state.view));
  try { localStorage.setItem('gir.view', state.view); } catch {}
}

/* ── Filter chips ──────────────────────────────────── */
function chips(host, items, set, onChange) {
  host.innerHTML = '';
  for (const [id, label] of items) {
    const c = el('span', 'chip' + (set.has(id) ? ' on' : ''), esc(label));
    c.onclick = () => { set.has(id) ? set.delete(id) : set.add(id); chips(host, items, set, onChange); onChange(); };
    host.appendChild(c);
  }
}

/* ── Static mode ───────────────────────────────────── */
// Served from GitHub Pages there is no API. Fall back to a published snapshot and
// run the same filtering/sorting in the browser.
let SNAPSHOT = null;
const lsGet = k => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const RANKS = { grail: 5, confirmed: 4, likely: 3, plans: 2, maybe: 1, rejected: 0 };
function applyFilters(all) {
  const saved = new Set(lsGet('gir.saved')), hidden = new Set(lsGet('gir.hidden'));
  let out = all.filter(l => !hidden.has(l.id));
  if (state.saved) out = out.filter(l => saved.has(l.id));
  if (state.verdict.size) out = out.filter(l => state.verdict.has(l.verdict));
  if (state.source.size) out = out.filter(l => state.source.has(l.source));
  if (state.deals) out = out.filter(l => l.deal);
  if (state.forsale) out = out.filter(l => l.buyable !== false && l.offer !== 'lead');
  if (state.min) out = out.filter(l => (l.price ?? 0) >= +state.min);
  if (state.max) out = out.filter(l => l.price != null && l.price <= +state.max);
  if (state.q) { const rx = new RegExp(state.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    out = out.filter(l => rx.test(l.title) || rx.test(l.sourceLabel || '')); }
  const by = state.sort;
  out.sort((a, b) => {
    if (by === 'deal') return (b.deal?.score ?? -1) - (a.deal?.score ?? -1)
      || (RANKS[b.verdict] - RANKS[a.verdict]) || b.score - a.score;
    if (by === 'price-low') return (a.price ?? 9e9) - (b.price ?? 9e9);
    if (by === 'price-high') return (b.price ?? -1) - (a.price ?? -1);
    if (by === 'new') return Number(b.isNew) - Number(a.isNew) || b.score - a.score;
    return (RANKS[b.verdict] - RANKS[a.verdict]) || b.score - a.score;
  });
  return out.map(l => ({ ...l, saved: saved.has(l.id) }));
}

/* ── Data ──────────────────────────────────────────── */
async function load() {
  if (SNAPSHOT) { const l = applyFilters(SNAPSHOT.listings); render(l, l.length); return; }
  const p = new URLSearchParams({ sort: state.sort });
  if (state.verdict.size) p.set('verdict', [...state.verdict].join(','));
  if (state.source.size) p.set('source', [...state.source].join(','));
  if (state.deals) p.set('deals', '1');
  if (state.forsale) p.set('forsale', '1');
  if (state.saved) p.set('saved', '1');
  if (state.q) p.set('q', state.q);
  if (state.min) p.set('min', state.min);
  if (state.max) p.set('max', state.max);
  const r = await fetch('/api/listings?' + p).then(r => r.json());
  render(r.listings, r.total);
}

function render(list, total) {
  const grid = $('#grid'), empty = $('#empty');
  grid.innerHTML = '';
  empty.classList.toggle('hidden', list.length > 0);
  if (!list.length) { stats([]); return; }
  stats(list, total);

  // Everything with a real discount sits above the fold; the rest is tucked away.
  const deals = list.filter(l => l.deal);
  const rest = list.filter(l => !l.deal);
  const frag = document.createDocumentFragment();
  for (const l of deals) frag.appendChild(card(l));

  if (rest.length) {
    const fold = el('div', 'fold');
    const label = () => state.showRest
      ? `<b>Hide</b> the ${rest.length} findings with no discount`
      : `<b>Show</b> ${rest.length} more findings with no discount detected`;
    fold.innerHTML = label();
    fold.onclick = () => { state.showRest = !state.showRest; render(list, total); };
    frag.appendChild(fold);
    if (state.showRest) for (const l of rest) frag.appendChild(card(l));
  }
  grid.appendChild(frag);
}

function stats(list, total) {
  const host = $('#stats');
  if (!list.length) { host.innerHTML = ''; return; }
  const n = v => list.filter(l => l.verdict === v).length;
  const deals = list.filter(l => l.deal).length;
  const fresh = list.filter(l => l.isNew).length;
  const best = list.filter(l => l.deal).sort((a, b) => b.deal.pct - a.deal.pct)[0];
  host.innerHTML = [
    ['Findings', total ?? list.length], ['Grail', n('grail')], ['Confirmed', n('confirmed')],
    ['Deals', deals], ['New', fresh], ['Best discount', best ? '−' + best.deal.pct + '%' : '—'],
  ].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
}

function card(l) {
  const c = el('div', 'card' + (l.verdict === 'grail' ? ' grail' : ''));
  const flags = [];
  if (l.kind === 'lead') flags.push('Lead');
  if (l.kind === 'auction' || l.kind === 'lot') flags.push('Auction');
  if (l.isNew) flags.push('New');
  if (l.priceDropped) flags.push('Price cut');
  if (l.stale) flags.push('Not re-seen');
  if (l.forSale) flags.push('For sale');
  const flagHTML = flags.length ? `<div class="flag">${flags.map(f => `<span>${f}</span>`).join('')}</div>` : '';
  // Flags live inside the thumb so they never collide with the footer meta row.
  const img = l.image
    ? `<div class="thumb"><img loading="lazy" src="${esc(l.image)}" onerror="this.parentElement.classList.add('none');this.remove()">${flagHTML}</div>`
    : `<div class="thumb none">✦${flagHTML}</div>`;

  const tags = [
    ...l.illusions.slice(0, 2).map(i => `<span class="tag ill">${esc(i.name)}</span>`),
    ...l.builders.slice(0, 2).map(b => `<span class="tag bld">${esc(b.name)}</span>`),
    ...l.provenance.slice(0, 1).map(p => `<span class="tag">ex ${esc(p)}</span>`),
  ].join('');

  c.innerHTML = `
    ${img}
    <div class="badge b-${l.verdict}">${l.verdict === 'grail' ? '✦ Grail' : esc(l.verdict)}</div>
    ${l.deal ? `<div class="deal" title="${esc(l.deal.basis)}${l.deal.provisional ? ' — live auction, bid will climb' : ''}">−${l.deal.pct}%${l.deal.provisional ? ' bid' : ''}</div>` : ''}
    <div class="body">
      <div class="price">${money(l.price)}${l.deal ? `<small>vs ${money(l.deal.ref)} · ${esc(l.deal.basis)}</small>` : ''}</div>
      <h3 class="title">${esc(l.title)}</h3>
      ${tags ? `<div class="tags">${tags}</div>` : ''}
      <div class="conf" title="Evidence ${l.confidence}%"><i style="width:${Math.min(100, l.confidence)}%"></i></div>
      <div class="meta">
        <span>${esc(l.sourceLabel || l.source)}${l.location ? ' · ' + esc(l.location) : ''}</span>
        <span class="acts">
          <button class="icon ${l.saved ? 'on' : ''}" title="Save">★</button>
          <button class="icon" title="Hide">✕</button>
          <a class="icon" href="${esc(l.url)}" target="_blank" rel="noopener" title="Open listing">↗</a>
        </span>
      </div>
    </div>`;

  const [save, hide] = c.querySelectorAll('.acts .icon');
  const toggleLocal = (key, id) => {
    const cur = lsGet(key);
    lsSet(key, cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]);
  };
  save.onclick = async () => {
    save.classList.toggle('on');
    if (SNAPSHOT) return toggleLocal('gir.saved', l.id);
    await fetch('/api/user/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: l.id }) });
  };
  hide.onclick = async () => {
    c.style.opacity = '.2';
    if (SNAPSHOT) { toggleLocal('gir.hidden', l.id); return load(); }
    await fetch('/api/user/hide', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: l.id }) });
    load();
  };
  return c;
}

/* ── Source health ─────────────────────────────────── */
function health(h) {
  const host = $('#health');
  host.innerHTML = '';
  for (const [id, meta] of Object.entries(state.sources)) {
    const s = h?.[id];
    const cls = state.running === id ? 'run' : (s?.status || 'idle');
    const n = el('div', 'src');
    n.innerHTML = `<i class="dot ${cls}"></i><b>${esc(meta.label)}</b>` +
      (s ? `<span class="n">${s.raw ?? 0}</span>` : '') +
      (s?.note ? ` <span class="n" title="${esc(s.note)}">· ${esc(s.note.slice(0, 34))}</span>` : '') +
      (s?.manualUrl && s.status !== 'ok' ? ` <a href="${esc(s.manualUrl)}" target="_blank" rel="noopener">open</a>` : '');
    host.appendChild(n);
  }
}

const MANUAL = [
  ['Alibaba · stage illusions', 'https://www.alibaba.com/trade/search?SearchText=stage+magic+illusion+props'],
  ['Alibaba · YW Power storefront', 'https://ywpower.en.alibaba.com/productgrouplist-959990819/Stage_Magic_Illusions.html'],
  ['Potter & Potter auctions', 'https://auction.potterauctions.com/auctions'],
];
function manual() {
  $('#manual').innerHTML = '<span class="lbl">Open manually</span>' +
    MANUAL.map(([t, u]) => `<a href="${u}" target="_blank" rel="noopener">${t} ↗</a>`).join('') +
    '<span class="n" style="color:var(--muted)">Alibaba blocks automated scans — these open in your browser, where they work.</span>';
}

/* ── Scanning ──────────────────────────────────────── */
function setScanning(on) {
  state.scanning = on;
  $('#scanbar').classList.toggle('on', on);
  $('#quick').disabled = on; $('#deep').disabled = on;
  if (!on) { state.running = null; $('#barfill').style.width = '0%'; }
}

async function scan(deep) {
  if (state.scanning) return;
  setScanning(true);
  $('#scanlog').textContent = deep ? 'Deep sweep beginning — this takes several minutes…' : 'Quick scan beginning…';
  await fetch('/api/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deep }) });
}

function events() {
  const es = new EventSource('/api/events');
  let lastHealth = {};
  es.onmessage = e => {
    const d = JSON.parse(e.data);
    if (d.type === 'source:start') { state.running = d.source; $('#scanlog').textContent = `Sweeping ${d.label}…`; health(lastHealth); }
    if (d.type === 'progress') {
      $('#scanlog').textContent = `${d.source} · ${d.label} (${d.step}/${d.total})`;
      $('#barfill').style.width = Math.round(d.step / d.total * 100) + '%';
    }
    if (d.type === 'source:done') {
      lastHealth[d.source] = { ...(lastHealth[d.source] || {}), status: d.status, raw: d.raw, note: d.note };
      state.running = null; health(lastHealth);
    }
    if (d.type === 'done') { lastHealth = d.summary.health; health(lastHealth);
      $('#scanlog').textContent = `Swept ${d.summary.raw} listings → ${d.summary.kept} worth your attention · ${(d.summary.ms / 1000).toFixed(0)}s`; }
    if (d.type === 'refresh') load();
    if (d.type === 'idle') setScanning(false);
    if (d.type === 'error') { $('#scanlog').textContent = 'Error: ' + d.message; setScanning(false); }
  };
  es.onerror = () => {};
}

/* ── Boot ──────────────────────────────────────────── */
(async function init() {
  let st;
  try {
    const r = await fetch('/api/state');
    if (!r.ok) throw new Error('no api');
    st = await r.json();
  } catch {
    // No server: published snapshot on GitHub Pages.
    SNAPSHOT = await fetch('./data.json').then(r => r.json());
    st = { sources: SNAPSHOT.sources, health: SNAPSHOT.health, scanning: false };
    document.body.classList.add('static');
    const when = new Date(SNAPSHOT.generatedAt);
    $('#scanlog').textContent = '';
    document.querySelector('.sub').insertAdjacentHTML('afterend',
      `<p class="kicker" style="margin-top:8px">Snapshot of ${SNAPSHOT.listings.length} findings · swept ${when.toLocaleString()}</p>`);
  }
  state.sources = st.sources || {};
  health(st.health);
  chips($('#verdicts'), VERDICTS, state.verdict, load);
  chips($('#sources'), Object.entries(state.sources).map(([k, v]) => [k, v.label]), state.source, load);

  $('#quick').onclick = () => scan(false);
  $('#deep').onclick = () => scan(true);
  $('#sort').onchange = e => { state.sort = e.target.value; state.showRest = false; load(); };
  let t; $('#q').oninput = e => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value.trim(); load(); }, 220); };
  $('#min').onchange = e => { state.min = e.target.value; load(); };
  $('#max').onchange = e => { state.max = e.target.value; load(); };
  const toggle = (sel, key) => { $(sel).onclick = () => { state[key] = !state[key]; $(sel).classList.toggle('on', state[key]); load(); }; };
  toggle('#f-deals', 'deals'); toggle('#f-saved', 'saved'); toggle('#f-forsale', 'forsale');
  manual();
  document.querySelectorAll('#view .chip').forEach(c =>
    c.onclick = () => { state.view = c.dataset.v; applyView(); });
  applyView();
  $('#clear').onclick = () => {
    state.verdict = new Set(['grail', 'confirmed', 'likely']); state.source.clear();
    state.deals = state.saved = false; state.forsale = true; state.showRest = false;
    $('#f-forsale').classList.add('on'); state.q = state.min = state.max = '';
    $('#q').value = ''; $('#min').value = ''; $('#max').value = '';
    $('#f-deals').classList.remove('on'); $('#f-saved').classList.remove('on');
    chips($('#verdicts'), VERDICTS, state.verdict, load);
    chips($('#sources'), Object.entries(state.sources).map(([k, v]) => [k, v.label]), state.source, load);
    load();
  };

  if (st.scanning) setScanning(true);
  events();
  load();
})();

const $ = s => document.querySelector(s);
const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = n => n == null ? '—' : '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 });

const VERDICTS = [['grail', 'Grail'], ['confirmed', 'Confirmed'], ['likely', 'Likely'], ['plans', 'Plans'], ['maybe', 'Maybe']];
const VERDICT_LABEL = Object.fromEntries(VERDICTS);

const FAMILIES = [
  ['Sawing & Cutting', [
    'Zig Zag Girl', 'Thin Model Sawing', 'Clearly Impossible', 'Table of Death', 'Buzz Saw',
    'Chainsaw Illusion', 'Sawing in Half', 'Mismade Girl', 'Wakeling Sawing', 'Bow Sawing',
    'Modern Art', 'Girl Without a Middle', 'Disecto', 'Head Chopper / Guillotine', 'Interlude',
  ]],
  ['Penetrations', [
    'Blade Box', 'Sword Box', 'Sword Basket', 'Basket of India', 'Chamber of Fu Manchu',
    'Spiker', 'Impaled', 'Dagger Chest', 'Indian Basket', 'Origami', 'Twister',
  ]],
  ['Appearances & Vanishes', [
    'Production Box', 'Square Circle', 'Crystal Casket', 'Shadow Box', 'Doll House',
    'Vanishing Cabinet', 'Arabian Tent', 'Pagoda', 'Elevator', 'Cremation',
    'Temple of Benares', 'Sands of Egypt',
  ]],
  ['Transpositions', [
    'Substitution Trunk', 'Costume Trunk', 'Tip Over Trunk', 'Quantum Leap',
    "Assistant's Revenge", 'Backstage',
  ]],
  ['Levitations & Suspensions', [
    'Asrah Levitation', 'Super X Levitation', 'Broom Suspension', 'Chair Suspension',
    'Aga Levitation', 'Levitation', 'Losander Floating Table',
  ]],
  ['Escapes', [
    "Lion's Cage", 'Water Torture Cell', 'Milk Can Escape', 'Packing Crate Escape', 'Straitjacket',
  ]],
];
const ILL_FAMILY = new Map(FAMILIES.flatMap(([f, names]) => names.map(n => [n, f])));
const FAMILY_ORDER = [...FAMILIES.map(([f]) => f), 'More illusions'];

const state = {
  verdict: new Set(['grail', 'confirmed', 'likely']),
  source: new Set(),
  deals: false, saved: false, forsale: true, jev: true,
  type: 'all', priceBand: '', fulfil: '', overseas: false,
  seeAll: null, gridLimit: 60, moreOpen: false,
  sort: 'deal', q: '', min: '', max: '',
  sources: {}, scanning: false, running: null,
  list: [], total: 0,
};

const ICONS = {
  crate: '<svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="7" width="30" height="26" rx="1"/><path d="M5 12h30M5 28h30M10 12v16M30 12v16M10 12l20 16M30 12L10 28"/></svg>',
  save: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 2.5h8a.5.5 0 0 1 .5.5v10.5L8 10.5l-4.5 3V3a.5.5 0 0 1 .5-.5z"/></svg>',
  ext: '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 11.5l7-7M5.5 4.5h6v6"/></svg>',
};

/* ── Derived fields ────────────────────────────────── */
function family(l) {
  for (const ill of l.illusions || []) {
    const f = ILL_FAMILY.get(ill.name);
    if (f) return f;
  }
  const c = l.category || '';
  if (/levitation/i.test(c)) return 'Levitations & Suspensions';
  if (/escape/i.test(c)) return 'Escapes';
  if (/production|vanish|transposition/i.test(c)) return 'Appearances & Vanishes';
  if (/mutilation|cut-restored|sawing/i.test(c)) return 'Sawing & Cutting';
  return 'More illusions';
}

const KEEP_CAPS = new Set(['USA', 'UK', 'LED', 'II', 'III', 'IV', 'VI', 'ATA', 'DVD', 'VHS', 'PK']);
function cleanName(l) {
  if (l.illusions?.[0]?.name) {
    return l.illusions[0].name.replace(/\s*\/\s*Guillotine$/i, '');
  }
  let s = String(l.title || '')
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F]/gu, '')
    .replace(/^\s*new\s+listing[:\s-]*/i, '')
    .replace(/\b(?:L@@K|WOW|FREE\s+SHIPPING|LOCAL\s+PICK\s*UP(?:\s+ONLY)?|NO\s+RESERVE|NR)\b/gi, '')
    .replace(/-\s*eBay\b/gi, '')
    .replace(/!{2,}|\*{2,}/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—:|,•·]+|[\s\-–—:|,•·]+$/g, '')
    .trim();
  const letters = s.match(/[a-zA-Z]/g) || [];
  const upper = s.match(/[A-Z]/g) || [];
  if (letters.length && upper.length / letters.length > 0.6) {
    s = s.replace(/\b([A-Za-z][A-Za-z']*)\b/g, w => {
      const u = w.toUpperCase();
      if (KEEP_CAPS.has(u)) return u;
      return u[0] + u.slice(1).toLowerCase();
    });
  }
  if (s.length > 46) {
    const cut = s.slice(0, 45).replace(/\s+\S*$/, '').replace(/[\s\-–—:|,&/]+$/, '');
    s = (cut || s.slice(0, 45)) + '…';
  }
  return s || 'Stage Illusion';
}

function fulfil(l) {
  const t = [l.shipping, l.title, l.location].join(' ');
  if (/local pick-?up|pick-?up only|pickup only|pick up only|local pickup/i.test(t)) return 'Pickup';
  if (/freight/i.test(t)) return 'Ships freight';
  if (/free (shipping|delivery)/i.test(t)) return 'Free shipping';
  const m = String(l.shipping || '').match(/\$[\d,.]+/);
  if (m) return `Ships · ${m[0]}`;
  if (l.source === 'alibaba' || l.source === 'aliexpress') return 'Ships from China';
  return '';
}

const CL_CITIES = {
  newyork: 'New York', losangeles: 'Los Angeles', sandiego: 'San Diego', sfbay: 'SF Bay Area',
  lasvegas: 'Las Vegas', stlouis: 'St. Louis', kansascity: 'Kansas City', sanantonio: 'San Antonio',
  neworleans: 'New Orleans', saltlakecity: 'Salt Lake City', okc: 'Oklahoma City',
};
function place(l) {
  const loc = String(l.location || '').replace(/^(?:located\s+in|from)\s+/i, '').trim();
  if (loc) return loc.replace(/^United States$/i, 'USA');
  if (l.city) {
    const k = String(l.city).toLowerCase();
    return CL_CITIES[k] || (k[0].toUpperCase() + k.slice(1));
  }
  const c = l.category || '';
  if (/located-outside-the-usa/i.test(c)) return 'Outside USA';
  if (/located-inside-the-usa/i.test(c)) return 'USA';
  return '';
}

function overseas(l) {
  if (l.source === 'alibaba' || l.source === 'aliexpress') return true;
  if (/located-outside-the-usa/i.test(l.category || '')) return true;
  return /China|Canada|United Kingdom|\bUK\b|Germany|France|Italy|Spain|Australia|Japan|Netherlands|Mexico|Outside USA/i.test(place(l));
}

function logistics(l) {
  return [fulfil(l), place(l)].filter(Boolean).join(' · ');
}

function age(l) {
  if (!l.firstSeen) return l.stale ? 'not re-seen' : '';
  const days = Math.max(0, Math.floor((Date.now() - new Date(l.firstSeen).getTime()) / 864e5));
  const base = days < 1 ? 'Today'
    : days >= 60 ? `${Math.floor(days / 30)}mo`
    : days >= 14 ? `${Math.floor(days / 7)}w`
    : `${days}d`;
  return l.stale ? `${base} · not re-seen` : base;
}

const builder = l => l.builders?.[0]?.name || '';
const isNewThisWeek = l => Boolean(l.isNew || (l.firstSeen && (Date.now() - new Date(l.firstSeen).getTime()) <= 7 * 864e5));

/* ── Filter chips ──────────────────────────────────── */
function chips(host, items, set, onChange) {
  host.innerHTML = '';
  for (const [id, label] of items) {
    const on = set.has(id);
    const c = el('button', 'chip' + (on ? ' on' : ''), esc(label));
    c.type = 'button';
    c.dataset.k = id;
    c.setAttribute('aria-pressed', String(on));
    c.onclick = () => {
      set.has(id) ? set.delete(id) : set.add(id);
      chips(host, items, set, onChange);
      onChange();
    };
    host.appendChild(c);
  }
}

function setChipState(btn, on) {
  if (!btn) return;
  btn.classList.toggle('on', on);
  btn.setAttribute('aria-pressed', String(on));
}

function syncBarChips() {
  document.querySelectorAll('#price-chips .chip').forEach(b => setChipState(b, b.dataset.price === state.priceBand));
  document.querySelectorAll('#fulfil-chips .chip').forEach(b => setChipState(b, b.dataset.fulfil === state.fulfil));
  setChipState($('#f-overseas'), state.overseas);
  setChipState($('#f-deals'), state.deals);
  setChipState($('#f-saved'), state.saved);
  setChipState($('#f-more'), state.moreOpen);
  setChipState($('#f-forsale'), state.forsale);
  setChipState($('#f-jev'), state.jev);
}

function renderTypeChips(preTypeList) {
  const host = $('#type-chips');
  const counts = new Map();
  for (const l of preTypeList) {
    const f = family(l);
    counts.set(f, (counts.get(f) || 0) + 1);
  }
  host.innerHTML = '';
  const allBtn = el('button', 'chip' + (state.type === 'all' ? ' on' : ''), 'All');
  allBtn.type = 'button';
  allBtn.setAttribute('aria-pressed', String(state.type === 'all'));
  allBtn.onclick = () => {
    state.type = 'all';
    state.seeAll = null;
    state.gridLimit = 60;
    render();
  };
  host.appendChild(allBtn);

  for (const fam of FAMILY_ORDER) {
    const cnt = counts.get(fam) || 0;
    if (cnt < 1 && state.type !== fam) continue;
    const on = state.type === fam;
    const btn = el('button', 'chip' + (on ? ' on' : ''), `${esc(fam)} <span class="cnt">${cnt}</span>`);
    btn.type = 'button';
    btn.setAttribute('aria-pressed', String(on));
    btn.onclick = () => {
      state.type = state.type === fam ? 'all' : fam;
      state.seeAll = null;
      state.gridLimit = 60;
      render();
    };
    host.appendChild(btn);
  }
}

/* ── Static mode ───────────────────────────────────── */
// Served from GitHub Pages there is no API. Fall back to a published snapshot and
// run the same filtering/sorting in the browser.
let SNAPSHOT = null;
const lsGet = k => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const toggleLocal = (key, id) => {
  const cur = lsGet(key);
  lsSet(key, cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]);
};

const RANKS = { grail: 5, confirmed: 4, likely: 3, plans: 2, maybe: 1, rejected: 0 };
function applyFilters(all) {
  const saved = new Set(lsGet('gir.saved')), hidden = new Set(lsGet('gir.hidden'));
  let out = all.filter(l => !hidden.has(l.id));
  if (state.saved) out = out.filter(l => saved.has(l.id));
  if (state.verdict.size) out = out.filter(l => state.verdict.has(l.verdict));
  if (state.source.size) out = out.filter(l => state.source.has(l.source));
  if (state.deals) out = out.filter(l => l.deal);
  if (state.forsale) out = out.filter(l => l.buyable !== false && l.offer !== 'lead');
  if (state.jev) out = out.filter(l => l.jev?.band !== 'not-stage');
  if (state.min) out = out.filter(l => (l.price ?? 0) >= +state.min);
  if (state.max) out = out.filter(l => l.price != null && l.price <= +state.max);
  if (state.q) {
    const rx = new RegExp(state.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    out = out.filter(l => rx.test(l.title) || rx.test(l.sourceLabel || ''));
  }
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
  if (SNAPSHOT) {
    const l = applyFilters(SNAPSHOT.listings);
    state.list = l;
    state.total = l.length;
    render();
    return;
  }
  const p = new URLSearchParams({ sort: state.sort });
  if (state.verdict.size) p.set('verdict', [...state.verdict].join(','));
  if (state.source.size) p.set('source', [...state.source].join(','));
  if (state.deals) p.set('deals', '1');
  if (state.forsale) p.set('forsale', '1');
  if (state.jev) p.set('jev', '1');
  if (state.saved) p.set('saved', '1');
  if (state.q) p.set('q', state.q);
  if (state.min) p.set('min', state.min);
  if (state.max) p.set('max', state.max);
  const r = await fetch('/api/listings?' + p).then(r => r.json());
  state.list = r.listings || [];
  state.total = r.total ?? state.list.length;
  render();
}

function filterClient(list) {
  return list.filter(l => {
    if (state.priceBand === 'u1k' && !(l.price != null && l.price < 1000)) return false;
    if (state.priceBand === '1k-5k' && !(l.price != null && l.price >= 1000 && l.price <= 5000)) return false;
    if (state.priceBand === '5k+' && !(l.price != null && l.price >= 5000)) return false;
    if (state.fulfil === 'pickup' && fulfil(l) !== 'Pickup') return false;
    if (state.fulfil === 'ships') {
      const f = fulfil(l);
      if (!f.startsWith('Ships') && !f.startsWith('Free')) return false;
    }
    if (state.overseas && overseas(l)) return false;
    return true;
  });
}

function stats(list) {
  const host = $('#stats');
  if (!list.length) { host.innerHTML = ''; return; }
  const deals = list.filter(l => l.deal).length;
  const fresh = list.filter(l => l.isNew).length;
  const best = list.filter(l => l.deal).sort((a, b) => b.deal.pct - a.deal.pct)[0];
  const parts = [
    `<b>${list.length}</b> findings`,
    `<b>${deals}</b> deals`,
    `<b>${fresh}</b> new`,
  ];
  if (best) parts.push(`best <b>−${best.deal.pct}%</b>`);
  host.innerHTML = parts.join(' · ');
}

/* ── Render: Shelves & Grid ────────────────────────── */
function render() {
  syncBarChips();
  stats(state.list);

  const preType = filterClient(state.list);
  renderTypeChips(preType);

  const filtered = state.type === 'all'
    ? preType
    : preType.filter(l => family(l) === state.type);

  const stage = $('#stage');
  const empty = $('#empty');
  stage.innerHTML = '';

  const inGrid = Boolean(state.q || state.type !== 'all' || state.seeAll);
  if (!inGrid) {
    const shelves = buildShelves(filtered);
    empty.classList.toggle('hidden', shelves.length > 0);
    if (!shelves.length) return;
    const frag = document.createDocumentFragment();
    for (const s of shelves) frag.appendChild(renderShelf(s));
    stage.appendChild(frag);
  } else {
    const { title, items } = resolveGridSet(filtered);
    stage.appendChild(renderGridHeader(title, items.length));
    empty.classList.toggle('hidden', items.length > 0);
    if (!items.length) return;
    const grid = el('div', 'grid');
    for (const l of items.slice(0, state.gridLimit)) grid.appendChild(card(l));
    stage.appendChild(grid);
    if (items.length > state.gridLimit) {
      const moreWrap = el('div', 'more-row-btn');
      const moreBtn = el('button', 'pill-btn show-more', 'Show more');
      moreBtn.type = 'button';
      moreBtn.onclick = () => { state.gridLimit += 60; render(); };
      moreWrap.appendChild(moreBtn);
      stage.appendChild(moreWrap);
    }
  }
}

function buildShelves(list) {
  const out = [];
  const screaming = list.filter(l => l.deal && l.deal.pct >= 40)
    .sort((a, b) => (b.deal?.score ?? 0) - (a.deal?.score ?? 0));
  if (screaming.length) {
    out.push({ key: 'deals', title: 'Screaming deals', sub: 'At least 40% under comps', items: screaming });
  }
  const fresh = list.filter(isNewThisWeek);
  if (fresh.length) {
    out.push({ key: 'new', title: 'New this week', items: fresh });
  }
  const byFam = new Map();
  for (const l of list) {
    const f = family(l);
    if (!byFam.has(f)) byFam.set(f, []);
    byFam.get(f).push(l);
  }
  for (const fam of FAMILY_ORDER) {
    const items = byFam.get(fam);
    if (items?.length) out.push({ key: fam, title: fam, items });
  }
  return out;
}

function resolveGridSet(filtered) {
  if (state.seeAll === 'deals') {
    const items = filtered.filter(l => l.deal && l.deal.pct >= 40)
      .sort((a, b) => (b.deal?.score ?? 0) - (a.deal?.score ?? 0));
    return { title: 'Screaming deals', items };
  }
  if (state.seeAll === 'new') {
    return { title: 'New this week', items: filtered.filter(isNewThisWeek) };
  }
  if (state.seeAll) {
    return { title: state.seeAll, items: filtered.filter(l => family(l) === state.seeAll) };
  }
  if (state.type !== 'all') {
    return { title: state.type, items: filtered };
  }
  return { title: `Results for “${state.q}”`, items: filtered };
}

function renderShelf({ key, title, sub, items }) {
  const sec = el('section', 'shelf');
  const head = el('div', 'shelf-head');
  const titleWrap = el('div', 'shelf-title-wrap',
    `<h2>${esc(title)}</h2><span class="shelf-count">${items.length}</span>` +
    (sub ? `<p class="shelf-sub">${esc(sub)}</p>` : ''));

  const nav = el('div', 'shelf-nav');
  const seeAllBtn = el('button', 'link-btn see-all', 'See all');
  seeAllBtn.type = 'button';
  const openSeeAll = () => {
    state.seeAll = key;
    state.gridLimit = 60;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  seeAllBtn.onclick = openSeeAll;

  const prev = el('button', 'arrow-btn', '‹');
  prev.type = 'button';
  prev.setAttribute('aria-label', `Scroll ${title} left`);
  const next = el('button', 'arrow-btn', '›');
  next.type = 'button';
  next.setAttribute('aria-label', `Scroll ${title} right`);

  nav.append(seeAllBtn, prev, next);
  head.append(titleWrap, nav);

  const track = el('div', 'track');
  prev.onclick = () => track.scrollBy({ left: -track.clientWidth * 0.9, behavior: 'smooth' });
  next.onclick = () => track.scrollBy({ left: track.clientWidth * 0.9, behavior: 'smooth' });

  for (const l of items.slice(0, 20)) track.appendChild(card(l));
  if (items.length > 20) {
    const moreCard = el('div', 'card');
    const tileBtn = el('button', 'tile see-all-tile', `<span>See all ${items.length}</span>`);
    tileBtn.type = 'button';
    tileBtn.onclick = openSeeAll;
    moreCard.appendChild(tileBtn);
    track.appendChild(moreCard);
  }

  sec.append(head, track);
  return sec;
}

function renderGridHeader(title, count) {
  const head = el('div', 'grid-head');
  const back = el('button', 'link-btn back-link', '‹ All shelves');
  back.type = 'button';
  back.onclick = () => {
    state.seeAll = null;
    state.type = 'all';
    state.gridLimit = 60;
    if (state.q) {
      state.q = '';
      $('#q').value = '';
      load();
    } else {
      render();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const row = el('div', 'grid-title-row', `<h2>${esc(title)}</h2><span class="shelf-count">${count}</span>`);
  head.append(back, row);
  return head;
}

/* ── Save & Hide actions ───────────────────────────── */
async function toggleSave(l) {
  l.saved = !l.saved;
  if (SNAPSHOT) {
    toggleLocal('gir.saved', l.id);
    return;
  }
  await fetch('/api/user/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: l.id }),
  });
}

async function hideListing(l) {
  if (SNAPSHOT) {
    toggleLocal('gir.hidden', l.id);
    return load();
  }
  await fetch('/api/user/hide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: l.id }),
  });
  await load();
}

/* ── Card ──────────────────────────────────────────── */
function card(l) {
  const c = el('article', 'card');
  const name = cleanName(l);
  const priceLabel = l.price != null ? money(l.price) : 'Price on request';

  const topFlags = [];
  if (l.kind === 'auction' || l.kind === 'lot' || l.saleType === 'auction' || l.offer === 'auction') topFlags.push('Auction');
  if (l.kind === 'lead' || l.offer === 'lead') topFlags.push('Lead');
  if (l.priceDropped) topFlags.push('Price cut');
  const flagsHTML = topFlags.length
    ? `<div class="tile-flags">${topFlags.map(f => `<span class="cap-flag">${esc(f)}</span>`).join('')}</div>`
    : '';

  const noPhotoHTML = `<span class="nophoto">${ICONS.crate}<span>No photo</span></span>`;
  const tileHTML = l.image
    ? `<div class="tile"><img loading="lazy" decoding="async" src="${esc(l.image)}" alt="">${noPhotoHTML}${flagsHTML}</div>`
    : `<div class="tile none">${noPhotoHTML}${flagsHTML}</div>`;

  const priceLineHTML = (l.price != null
    ? `<span class="price">${money(l.price)}</span>`
    : `<span class="price req">Price on request</span>`) +
    (l.deal ? `<span class="deal-pct">−${l.deal.pct}%</span>${l.deal.provisional ? '<span class="deal-bid"> bid</span>' : ''}` : '');

  const nameLineHTML = `<div class="line-name">${l.isNew ? '<span class="new-lbl">New</span>' : ''}${esc(name)}</div>`;
  const bld = builder(l);
  const bldLineHTML = bld ? `<div class="line-builder">${esc(bld)}</div>` : '';
  const log = logistics(l);
  const logLineHTML = log
    ? `<div class="line-log">${esc(log)}</div>`
    : `<div class="line-log dim">Pickup or shipping not listed</div>`;
  const ageText = age(l);
  const srcLineHTML = `<div class="line-src"><span class="src-badge">${esc(l.sourceLabel || l.source)}</span>${ageText ? ` <span class="age-lbl">${esc(ageText)}</span>` : ''}</div>`;

  const hit = el('button', 'hit', `${tileHTML}<div class="txt"><div class="line-price">${priceLineHTML}</div>${nameLineHTML}${bldLineHTML}${logLineHTML}${srcLineHTML}</div>`);
  hit.type = 'button';
  hit.setAttribute('aria-label', `${name}, ${priceLabel}`);
  hit.onclick = () => openSheet(l, hit);

  const imgEl = hit.querySelector('img');
  if (imgEl) {
    imgEl.addEventListener('error', () => {
      imgEl.parentElement.classList.add('none');
      imgEl.remove();
    }, { once: true });
  }

  const saveBtn = el('button', 'save-btn', ICONS.save);
  saveBtn.type = 'button';
  saveBtn.setAttribute('aria-label', 'Save');
  saveBtn.setAttribute('aria-pressed', String(Boolean(l.saved)));
  saveBtn.onclick = async e => {
    e.stopPropagation();
    await toggleSave(l);
    saveBtn.setAttribute('aria-pressed', String(Boolean(l.saved)));
    if (state.saved && !l.saved) load();
  };

  c.append(hit, saveBtn);
  return c;
}

/* ── Detail Sheet ──────────────────────────────────── */
let lastTrigger = null;

function openSheet(l, triggerEl) {
  lastTrigger = triggerEl || null;
  const sheet = $('#sheet');
  const fam = family(l);
  const name = cleanName(l);
  const log = logistics(l) || 'Pickup or shipping not listed';

  const flags = [];
  if (l.isNew) flags.push('New');
  if (l.priceDropped) flags.push('Price cut');
  if (l.stale) flags.push('Not re-seen');
  if (l.jev?.band === 'review') flags.push('Jev unsure');
  if (l.jev?.band === 'not-stage') flags.push('Jev: not stage');

  const noPhotoHTML = `<span class="nophoto">${ICONS.crate}<span>No photo</span></span>`;
  const mediaHTML = l.image
    ? `<div class="sheet-media"><img decoding="async" src="${esc(l.image)}" alt="${esc(name)}">${noPhotoHTML}</div>`
    : `<div class="sheet-media none">${noPhotoHTML}</div>`;

  const priceHTML = l.price != null
    ? `<span class="sheet-price">${money(l.price)}</span>`
    : `<span class="sheet-price req">Price on request</span>`;
  const dealHTML = l.deal ? `<span class="sheet-deal">−${l.deal.pct}%</span>` : '';
  const basisHTML = l.deal
    ? `<div class="sheet-basis">vs ${money(l.deal.ref)} · ${esc(l.deal.basis)}${l.deal.comps ? ` · ${l.deal.comps} comps` : ''}${l.deal.provisional ? ' · Live auction — the bid will climb' : ''}</div>`
    : '';

  const rows = [
    ['Verdict', VERDICT_LABEL[l.verdict] || l.verdict || '—'],
    ['Source', l.sourceLabel || l.source || '—'],
    ['Builder(s)', (l.builders || []).map(b => b.name).join(', ') || '—'],
    ['Illusions', (l.illusions || []).map(i => i.name).join(', ') || '—'],
    ['Provenance', (l.provenance || []).length ? l.provenance.map(p => `ex ${p}`).join(', ') : '—'],
    ['First seen', l.firstSeen ? new Date(l.firstSeen).toLocaleDateString() : '—'],
    ['Last seen', l.lastSeen ? new Date(l.lastSeen).toLocaleDateString() : '—'],
    ['Flags', flags.length ? flags.join(' · ') : '—'],
  ];

  sheet.innerHTML = `
    <button type="button" class="sheet-close" aria-label="Close">×</button>
    <div class="sheet-inner">
      ${mediaHTML}
      <div class="sheet-info">
        <div class="sheet-eyebrow">${esc(fam)}</div>
        <h2 class="sheet-title">${esc(name)}</h2>
        <div class="sheet-price-row">${priceHTML}${dealHTML}</div>
        ${basisHTML}
        <div class="sheet-log">${esc(log)}</div>
        <div class="sheet-raw">
          <span class="lbl">Raw listing title</span>
          <div class="sheet-raw-title">${esc(l.title)}</div>
        </div>
        <dl class="kv-list">
          ${rows.map(([k, v]) => `<div class="kv-row"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}
        </dl>
        <div class="sheet-actions">
          <a class="pill-btn blue" href="${esc(l.url)}" target="_blank" rel="noopener">Open listing ↗</a>
          <button type="button" class="pill-btn" id="sheet-save" aria-pressed="${Boolean(l.saved)}">${l.saved ? 'Saved' : 'Save'}</button>
          <button type="button" class="pill-btn" id="sheet-hide">Hide</button>
        </div>
      </div>
    </div>`;

  const imgEl = sheet.querySelector('.sheet-media img');
  if (imgEl) {
    imgEl.addEventListener('error', () => {
      imgEl.parentElement.classList.add('none');
      imgEl.remove();
    }, { once: true });
  }

  sheet.querySelector('.sheet-close').onclick = () => sheet.close();
  const saveBtn = sheet.querySelector('#sheet-save');
  saveBtn.onclick = async () => {
    await toggleSave(l);
    saveBtn.textContent = l.saved ? 'Saved' : 'Save';
    saveBtn.setAttribute('aria-pressed', String(Boolean(l.saved)));
    render();
  };
  sheet.querySelector('#sheet-hide').onclick = async () => {
    sheet.close();
    await hideListing(l);
  };

  if (!sheet.open) sheet.showModal();
}

/* ── Source health ─────────────────────────────────── */
function health(h) {
  const host = $('#health');
  host.innerHTML = '';
  for (const [id, meta] of Object.entries(state.sources)) {
    const s = h?.[id];
    const cls = state.running === id ? 'run' : (s?.status || 'idle');
    const n = el('div', 'src-row');
    n.innerHTML = `<i class="dot ${esc(cls)}"></i><b>${esc(meta.label)}</b>` +
      (s ? `<span class="n">${s.raw ?? 0}</span>` : '') +
      (s?.note ? `<span class="note" title="${esc(s.note)}">· ${esc(s.note.slice(0, 34))}</span>` : '') +
      (s?.manualUrl && s.status !== 'ok' ? `<a href="${esc(s.manualUrl)}" target="_blank" rel="noopener">open</a>` : '');
    host.appendChild(n);
  }
}

const MANUAL = [
  ['Alibaba · stage illusions', 'https://www.alibaba.com/trade/search?SearchText=stage+magic+illusion+props'],
  ['Alibaba · YW Power storefront', 'https://ywpower.en.alibaba.com/productgrouplist-959990819/Stage_Magic_Illusions.html'],
  ['Potter & Potter auctions', 'https://auction.potterauctions.com/auctions'],
  ['Used Magic Illusions (Facebook)', 'https://www.facebook.com/usedmagicillusions/'],
];
function manual() {
  $('#manual').innerHTML = '<span class="lbl">Open manually</span>' +
    MANUAL.map(([t, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)} ${ICONS.ext}</a>`).join('') +
    '<span class="n">Alibaba and Facebook require a human session — these open in your browser, where they work.</span>';
}

/* ── Scanning ──────────────────────────────────────── */
function setScanning(on) {
  state.scanning = on;
  $('#scanbar').classList.toggle('on', on);
  $('#quick').disabled = on;
  $('#deep').disabled = on;
  if (!on) {
    state.running = null;
    $('#barfill').style.width = '0%';
  }
}

async function scan(deep) {
  if (state.scanning) return;
  setScanning(true);
  $('#scanlog').textContent = deep ? 'Deep sweep beginning — this takes several minutes…' : 'Quick scan beginning…';
  await fetch('/api/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deep }),
  });
}

function events() {
  if (SNAPSHOT) return; // static build has no server to stream from
  const es = new EventSource('/api/events');
  let lastHealth = {};
  es.onmessage = e => {
    const d = JSON.parse(e.data);
    if (d.type === 'source:start') {
      state.running = d.source;
      $('#scanlog').textContent = `Sweeping ${d.label}…`;
      health(lastHealth);
    }
    if (d.type === 'progress') {
      $('#scanlog').textContent = `${d.source} · ${d.label} (${d.step}/${d.total})`;
      $('#barfill').style.width = Math.round(d.step / d.total * 100) + '%';
    }
    if (d.type === 'source:done') {
      lastHealth[d.source] = { ...(lastHealth[d.source] || {}), status: d.status, raw: d.raw, note: d.note };
      state.running = null;
      health(lastHealth);
    }
    if (d.type === 'done') {
      lastHealth = d.summary.health;
      health(lastHealth);
      $('#scanlog').textContent = `Swept ${d.summary.raw} listings → ${d.summary.kept} worth your attention · ${(d.summary.ms / 1000).toFixed(0)}s`;
    }
    if (d.type === 'refresh') load();
    if (d.type === 'idle') setScanning(false);
    if (d.type === 'error') {
      $('#scanlog').textContent = 'Error: ' + d.message;
      setScanning(false);
    }
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
    $('#snapshot').textContent = `Snapshot of ${SNAPSHOT.listings.length} findings · swept ${when.toLocaleString()}`;
  }
  state.sources = st.sources || {};
  health(st.health);
  chips($('#verdicts'), VERDICTS, state.verdict, load);
  chips($('#sources'), Object.entries(state.sources).map(([k, v]) => [k, v.label]), state.source, load);

  $('#quick').onclick = () => scan(false);
  $('#deep').onclick = () => scan(true);
  $('#sort').onchange = e => { state.sort = e.target.value; state.gridLimit = 60; load(); };
  let t;
  $('#q').oninput = e => {
    clearTimeout(t);
    t = setTimeout(() => {
      state.q = e.target.value.trim();
      state.gridLimit = 60;
      load();
    }, 220);
  };
  $('#min').onchange = e => { state.min = e.target.value; state.gridLimit = 60; load(); };
  $('#max').onchange = e => { state.max = e.target.value; state.gridLimit = 60; load(); };

  document.querySelectorAll('#price-chips .chip').forEach(btn => {
    btn.onclick = () => {
      state.priceBand = btn.dataset.price;
      state.gridLimit = 60;
      render();
    };
  });
  document.querySelectorAll('#fulfil-chips .chip').forEach(btn => {
    btn.onclick = () => {
      state.fulfil = btn.dataset.fulfil;
      state.gridLimit = 60;
      render();
    };
  });

  $('#f-overseas').onclick = () => {
    state.overseas = !state.overseas;
    state.gridLimit = 60;
    render();
  };
  $('#f-more').onclick = () => {
    state.moreOpen = !state.moreOpen;
    $('#more').classList.toggle('hidden', !state.moreOpen);
    syncBarChips();
  };

  const toggle = (sel, key) => {
    $(sel).onclick = () => {
      state[key] = !state[key];
      state.gridLimit = 60;
      syncBarChips();
      load();
    };
  };
  toggle('#f-deals', 'deals');
  toggle('#f-saved', 'saved');
  toggle('#f-forsale', 'forsale');
  toggle('#f-jev', 'jev');

  const resetAll = () => {
    state.verdict = new Set(['grail', 'confirmed', 'likely']);
    state.source.clear();
    state.deals = state.saved = false;
    state.forsale = state.jev = true;
    state.type = 'all';
    state.priceBand = '';
    state.fulfil = '';
    state.overseas = false;
    state.seeAll = null;
    state.gridLimit = 60;
    state.sort = 'deal';
    state.q = state.min = state.max = '';
    $('#q').value = '';
    $('#min').value = '';
    $('#max').value = '';
    $('#sort').value = 'deal';
    syncBarChips();
    chips($('#verdicts'), VERDICTS, state.verdict, load);
    chips($('#sources'), Object.entries(state.sources).map(([k, v]) => [k, v.label]), state.source, load);
    load();
  };
  $('#clear').onclick = resetAll;
  $('#empty-reset').onclick = resetAll;

  const sheet = $('#sheet');
  sheet.addEventListener('click', e => {
    if (e.target === sheet) sheet.close();
  });
  sheet.addEventListener('close', () => {
    if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
  });

  manual();
  if (st.scanning) setScanning(true);
  events();
  load();
})();

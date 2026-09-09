import { classify, RANK } from './classify.mjs';
import { buildComps, scoreDeal } from './comps.mjs';
import { closeBrowser } from './browser.mjs';
import { merge, loadState, saveState, saveListings } from './store.mjs';

import * as ebay from './sources/ebay.mjs';
import * as craigslist from './sources/craigslist.mjs';
import * as alibaba from './sources/alibaba.mjs';
import * as magiccafe from './sources/magiccafe.mjs';
import * as potter from './sources/potter.mjs';
import * as aliexpress from './sources/aliexpress.mjs';

export const SOURCES = { ebay, craigslist, alibaba, aliexpress, magiccafe, potter };
// Browser-driven sources must run one at a time (single shared context); the plain
// HTTP ones are cheap and can go in parallel with them.
const BROWSER_SOURCES = ['ebay', 'craigslist', 'alibaba', 'aliexpress', 'potter'];

export async function runScan({ deep = false, only = null, emit = () => {} } = {}) {
  const ids = (only?.length ? only : Object.keys(SOURCES)).filter(k => SOURCES[k]);
  const health = {}, raw = [];
  const started = Date.now();
  emit({ type: 'start', sources: ids, deep });

  const run = async id => {
    const t0 = Date.now();
    emit({ type: 'source:start', source: id, label: SOURCES[id].meta.label });
    try {
      const res = await SOURCES[id].scan({
        deep, onProgress: p => emit({ type: 'progress', ...p }),
      });
      const items = Array.isArray(res) ? res : res.items;
      health[id] = { status: (res.status ?? 'ok'), note: res.note || '', manualUrl: res.manualUrl || '',
        raw: items.length, ms: Date.now() - t0, label: SOURCES[id].meta.label };
      raw.push(...items);
      emit({ type: 'source:done', source: id, raw: items.length, status: health[id].status });
    } catch (e) {
      health[id] = { status: 'error', note: String(e.message).slice(0, 120), raw: 0,
        ms: Date.now() - t0, label: SOURCES[id].meta.label };
      emit({ type: 'source:done', source: id, raw: 0, status: 'error', note: health[id].note });
    }
  };

  const httpIds = ids.filter(i => !BROWSER_SOURCES.includes(i));
  const httpJob = Promise.all(httpIds.map(run));
  for (const id of ids.filter(i => BROWSER_SOURCES.includes(i))) await run(id);
  await httpJob;
  await closeBrowser();

  // Classify, drop the junk, dedupe.
  const byId = new Map();
  for (const it of raw) {
    const c = classify(it, it.boost || 0);
    if (c.verdict === 'rejected') continue;
    const rec = { ...it, ...c, verdictRank: RANK[c.verdict] };
    const cur = byId.get(it.id);
    if (!cur || rec.score > cur.score) byId.set(it.id, rec);
  }
  const kept = [...byId.values()];
  let merged = await merge(kept);

  // Second pass: comps can only be built once the whole corpus is graded, so deals
  // are scored against observed market prices rather than a guessed MSRP.
  const comps = buildComps(merged);
  merged = merged.map(r => ({ ...r, deal: scoreDeal(r, comps) }));
  await saveListings(merged);

  const st = await loadState();
  await saveState({ ...st, lastScan: new Date().toISOString(), scans: (st.scans || 0) + 1, health });

  const summary = {
    raw: raw.length, kept: kept.length, total: merged.length,
    ms: Date.now() - started, health,
    byVerdict: kept.reduce((a, k) => (a[k.verdict] = (a[k.verdict] || 0) + 1, a), {}),
    newCount: merged.filter(m => m.isNew).length,
  };
  emit({ type: 'done', summary });
  return { listings: merged, summary };
}

export const sortListings = (l, by = 'deal') => [...l].sort((a, b) => {
  // "Screaming deal" order: deal score first, then evidence.
  if (by === 'deal') return (b.deal?.score ?? -1) - (a.deal?.score ?? -1)
    || b.verdictRank - a.verdictRank || b.score - a.score;
  if (by === 'price-low') return (a.price ?? 9e9) - (b.price ?? 9e9);
  if (by === 'price-high') return (b.price ?? -1) - (a.price ?? -1);
  if (by === 'new') return Number(b.isNew) - Number(a.isNew) || b.score - a.score;
  return b.verdictRank - a.verdictRank || b.score - a.score;
});

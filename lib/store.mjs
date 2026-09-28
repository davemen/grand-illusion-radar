import fs from 'node:fs/promises';
import path from 'node:path';

const DIR = new URL('../data/', import.meta.url).pathname;
const F = n => path.join(DIR, n);

async function readJSON(name, fallback) {
  try { return JSON.parse(await fs.readFile(F(name), 'utf8')); } catch { return fallback; }
}
async function writeJSON(name, data) {
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(F(name), JSON.stringify(data, null, 2));
}

export const loadListings = () => readJSON('listings.json', []);
export const saveListings = l => writeJSON('listings.json', l);
export const loadState = () => readJSON('state.json', { lastScan: null, scans: 0, seenIds: [] });
export const saveState = s => writeJSON('state.json', s);
export const loadUser = () => readJSON('user.json', { saved: [], hidden: [] });
export const saveUser = u => writeJSON('user.json', u);

/** Append one row to the JEV_SHADOW log (JSONL, one row per listing). Never overwrites. */
export async function appendJevShadow(row) {
  await fs.mkdir(DIR, { recursive: true });
  await fs.appendFile(F('jev-shadow.jsonl'), JSON.stringify(row) + '\n');
}

/** Merge a fresh scan over history so "new since last scan" is meaningful. */
export async function merge(fresh) {
  const prev = await loadListings();
  const prevById = new Map(prev.map(p => [p.id, p]));
  const now = new Date().toISOString();
  const out = fresh.map(f => {
    const p = prevById.get(f.id);
    return {
      ...f,
      // Never lose a good photo to a scan that happened to catch a lazy placeholder.
      image: f.image || p?.image || null,
      firstSeen: p?.firstSeen || now,
      lastSeen: now,
      isNew: !p,
      priceHistory: p && p.price !== f.price && f.price != null
        ? [...(p.priceHistory || []), { at: now, price: f.price }]
        : p?.priceHistory || [],
      priceDropped: !!(p?.price && f.price && f.price < p.price),
    };
  });
  // A listing missing from this scan is NOT necessarily sold — a quick scan sweeps
  // far fewer queries than a deep one. Retain it and mark it stale, not gone.
  const keep = prev.filter(p => !out.some(o => o.id === p.id)
    && Date.now() - new Date(p.lastSeen || 0).getTime() < 21 * 864e5)
    .map(p => ({ ...p, isNew: false, stale: true }));
  const merged = [...out, ...keep];
  await saveListings(merged);
  return merged;
}

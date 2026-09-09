// Market comps derived from what we have actually observed, not from a guessed MSRP.
// A "deal" should mean cheap against what this illusion really asks, and the corpus
// grows with every scan, so the yardstick sharpens over time.

const FIRM = r => r.priceIsFirm !== false;      // a live auction's bid is not a price

export function buildComps(listings) {
  const bucket = new Map();
  for (const l of listings) {
    if (!l.price || l.price < 100 || !FIRM(l)) continue;
    if (l.isPlans || (l.negatives || []).length) continue;
    if (!['grail', 'confirmed', 'likely'].includes(l.verdict)) continue;
    for (const ill of l.illusions || []) {
      if (!bucket.has(ill.name)) bucket.set(ill.name, []);
      bucket.get(ill.name).push(l.price);
    }
  }
  const comps = {};
  for (const [name, prices] of bucket) {
    prices.sort((a, b) => a - b);
    const mid = Math.floor(prices.length / 2);
    comps[name] = {
      n: prices.length,
      median: prices.length % 2 ? prices[mid] : Math.round((prices[mid - 1] + prices[mid]) / 2),
      low: prices[0], high: prices[prices.length - 1],
    };
  }
  return comps;
}

// Below this, it is an accessory or a book, not a stage illusion — and cheap junk
// against a $7,500 reference produces a fake "99% off".
const PRICE_FLOOR = 150;
const MIN_COMPS = 3;
const clamp = n => Math.max(0, Math.min(100, Math.round(n)));

// Records scraped before offer/buyable existed still need grading, so infer from source.
const LEAD_SOURCES = { magiccafe: 'lead', potter: 'auction' };
export const offerOf = rec => rec.offer || LEAD_SOURCES[rec.source] || 'listing';
export const buyableOf = rec => rec.buyable ?? (offerOf(rec) !== 'lead');

/** Returns the deal object, or null when this is not honestly a deal. */
export function scoreDeal(rec, comps = {}) {
  // Must be a thing you can actually buy — not a forum thread about one.
  if (!buyableOf(rec) || offerOf(rec) !== 'listing') return null;
  if (rec.isPlans || (rec.negatives || []).length) return null;
  if (!['grail', 'confirmed', 'likely'].includes(rec.verdict)) return null;
  if (!rec.price || rec.price < PRICE_FLOOR) return null;

  const ill = (rec.illusions || []).filter(i => i.newPrice)
    .sort((a, b) => b.newPrice - a.newPrice)[0];
  if (!ill) return null;

  const comp = comps[ill.name];
  const useComp = comp && comp.n >= MIN_COMPS;
  const ref = useComp ? comp.median : ill.newPrice;
  if (!ref || rec.price >= ref) return null;

  const pct = Math.round((1 - rec.price / ref) * 100);
  if (pct < 15) return null;

  // Too good to be true. A discount past ~85% almost always means the listing matched
  // a big illusion's name while actually being a small tabletop version of it — a
  // "see thru tip over BOX" against a full tip over TRUNK. Demand corroborating
  // evidence of scale or a known builder before believing it.
  const corroborated = (rec.builders?.length || 0) > 0 || (rec.scaleHits || 0) >= 3
    || (rec.provenance?.length || 0) > 0;
  if (pct > 85 && !corroborated) return null;

  let s = pct;
  if (rec.builders?.some(b => b.tier === 'grail')) s += 18;
  else if (rec.builders?.length) s += 8;
  if (rec.provenance?.length) s += 6;
  if (rec.verdict === 'grail') s += 10; else if (rec.verdict === 'confirmed') s += 5;
  if (rec.price >= 1000) s += 5;                       // illusion-sized money, not an accessory
  if (rec.saleType === 'auction') s -= 30;             // current bid, not a settled price
  if (/\b(parts|repair|as-?is|incomplete|damaged|project|for restoration)\b/i.test(rec.title)) s -= 22;
  if (rec.condition === 'new') s += 3;

  return {
    pct, ref, refName: ill.name,
    basis: useComp ? `median of ${comp.n} asking prices` : 'typical new price',
    comps: useComp ? comp.n : 0,
    provisional: rec.saleType === 'auction',
    score: clamp(s),
  };
}

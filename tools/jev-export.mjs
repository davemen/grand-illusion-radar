// Export the stored corpus to shadow.py's input format, without touching data/ at all.
// Re-grades every stored listing with the CURRENT classifier (same call reclassify.mjs
// makes) so `baseline` reflects today's lexicon, but — unlike reclassify.mjs — never
// calls saveListings(): this is read-only, offline measurement, not a re-grade.
//
//   node tools/jev-export.mjs > shadow-inputs.jsonl
//
// One line per stored listing: {"id", "state", "baseline"}. `state` matches exactly what
// lib/jev.mjs sends to Jev in shadow mode (title, description, price, source) so the
// offline run and the live shadow hook measure the same thing. `baseline` is true when
// the current classifier keeps the listing (any verdict but "rejected"), false when it
// would drop it — but see README note below: nothing "rejected" is actually IN data/,
// because engine.mjs never persists rejected listings. Every baseline here is therefore
// true; see the shadow run summary for what that does and doesn't tell us.
import { classify } from '../lib/classify.mjs';
import { loadListings } from '../lib/store.mjs';

function toState(item) {
  const description = (item.desc || item.subtitle || '').replace(/\s+/g, ' ').trim().slice(0, 500);
  const price = item.priceText || (typeof item.price === 'number' ? `$${item.price}` : 'no price listed');
  const source = item.sourceLabel || item.source || 'unknown';
  return { title: (item.title || '').trim(), description, price, source };
}

const all = await loadListings();
for (const item of all) {
  const c = classify(item, item.boost || 0);
  // `verdict` is extra — shadow.py ignores unknown fields — kept here so a later join
  // back from shadow/illusion_relevance/runs.jsonl can stratify by grail/confirmed/likely/maybe.
  const row = { id: item.id, state: toState(item), baseline: c.verdict !== 'rejected', verdict: c.verdict };
  process.stdout.write(JSON.stringify(row) + '\n');
}
process.stderr.write(`exported ${all.length} listings (all baseline=true — see file header)\n`);

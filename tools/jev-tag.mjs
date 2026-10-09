// Tag the listings already on disk with Jev's stage-illusion band, without scanning.
// Same call and same cutoffs as a scan's rank mode (lib/jev.mjs); repeats are served from
// jev_client's state-hash cache. Only adds or refreshes each listing's `jev` field.
//
//   node tools/jev-tag.mjs
import { loadListings, saveListings } from '../lib/store.mjs';
import { shadowScore, jevTag, closeJevBridge, JEV_RANK_ENABLED } from '../lib/jev.mjs';

if (!JEV_RANK_ENABLED) { console.log('JEV_RANK=0: nothing to do'); process.exit(0); }
const all = await loadListings();
const bands = {}; let cost = 0;
for (const l of all) {
  const r = await shadowScore(l);
  // Fail open per listing: keep any earlier tag rather than erase it on a transient error.
  if (r) { l.jev = jevTag(r.answers); cost += r.cost_usd || 0; }
  const b = l.jev?.band || 'untagged'; bands[b] = (bands[b] || 0) + 1;
}
closeJevBridge();
await saveListings(all);
console.log(`jev-tag: ${all.length} listings`, bands, `reported cost $${cost.toFixed(4)}`);

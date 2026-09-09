// Re-grade everything already on disk with the current lexicon — no re-scraping.
import { classify, RANK } from '../lib/classify.mjs';
import { buildComps, scoreDeal } from '../lib/comps.mjs';
import { loadListings, saveListings } from '../lib/store.mjs';

const all = await loadListings();
const graded = [], dropped = [];
for (const l of all) {
  const c = classify(l, l.boost || 0);
  if (c.verdict === 'rejected') { dropped.push(l); continue; }
  graded.push({ ...l, ...c, verdictRank: RANK[c.verdict] });
}
const comps = buildComps(graded);
const out = graded.map(r => ({ ...r, deal: scoreDeal(r, comps) }));
await saveListings(out);

const by = out.reduce((a, k) => (a[k.verdict] = (a[k.verdict] || 0) + 1, a), {});
const deals = out.filter(d => d.deal);
console.log(`re-graded ${all.length} → kept ${out.length}, dropped ${dropped.length}`);
console.log('by verdict:', by);
console.log(`comps built for ${Object.keys(comps).length} illusions; ${deals.length} real deals`);
console.log('\ntop deals:');
deals.sort((a, b) => b.deal.score - a.deal.score).slice(0, 10).forEach(d =>
  console.log(`  ${String(d.deal.score).padStart(3)} | -${String(d.deal.pct).padStart(2)}% | $${String(d.price).padEnd(8)}| ${d.deal.basis.padEnd(26)}| ${d.title.slice(0, 44)}`));

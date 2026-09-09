import { ILLUSIONS, BUILDERS, PROVENANCE, SCALE_SIGNALS, NEGATIVES, PLANS, compile } from './lexicon.mjs';

const RX = {
  ill: compile(ILLUSIONS), bld: compile(BUILDERS), prov: compile(PROVENANCE),
  scale: compile(SCALE_SIGNALS), neg: compile(NEGATIVES), plans: compile(PLANS),
};
const BUILDER_PTS = { grail: 30, top: 20, good: 10 };

/**
 * Score one listing. `sourceBoost` encodes prior confidence from where it came
 * (e.g. eBay's Stage Illusion category is pre-filtered, a Craigslist keyword hit is not).
 */
export function classify(item, sourceBoost = 0) {
  const hay = `${item.title || ''} ${item.subtitle || ''} ${item.desc || ''} ${item.category || ''}`
    .replace(/\s+/g, ' ').toLowerCase();
  const price = typeof item.price === 'number' ? item.price : null;

  const illusions = [], builders = [], provenance = [], scale = [], negatives = [], plans = [];
  let pts = sourceBoost;

  for (const [re, name, tier, newPrice] of RX.ill)
    if (re.test(hay)) { illusions.push({ name, tier, newPrice }); pts += tier === 1 ? 26 : tier === 2 ? 14 : 6; }
  for (const [re, name, tier] of RX.bld)
    if (re.test(hay)) { builders.push({ name, tier }); pts += BUILDER_PTS[tier]; }
  for (const [re, name] of RX.prov) if (re.test(hay)) { provenance.push(name); pts += 8; }
  for (const [re, w] of RX.scale) if (re.test(hay)) { scale.push(re.source.slice(0, 22)); pts += w; }
  for (const [re, w] of RX.neg) if (re.test(hay)) { negatives.push(re.source.slice(0, 22)); pts -= w * 2.2; }
  for (const [re, kind] of RX.plans) if (re.test(hay)) plans.push(kind);

  // Price is physical evidence. Real stage illusions are not $12 items.
  if (price !== null) {
    if (price >= 1500) pts += 14; else if (price >= 600) pts += 9;
    else if (price >= 250) pts += 4; else if (price > 0 && price < 60) pts -= 16;
    else if (price < 150) pts -= 7;
  }

  const isPlans = plans.length > 0 && illusions.length > 0;
  if (isPlans) pts -= 18; // real, but it is paper, not a prop

  // Topicality gate. Price and bulk alone must never qualify a listing — that is how
  // signed art prints and car parts leak in. Require a magic-domain term or a named entity.
  const onTopic = /\b(magic|magician|illusion|illusionist|conjur|prestidigitat|escape artist|houdini)/i.test(hay)
    || illusions.length > 0 || builders.length > 0 || provenance.length > 0;
  if (!onTopic) return {
    verdict: 'rejected', score: Math.round(pts), confidence: 0, illusions: [], builders: [],
    provenance: [], deal: null, negatives: [], scaleHits: 0, isPlans: false, offTopic: true,
  };

  let verdict;
  if (isPlans) verdict = 'plans';
  else if (builders.some(b => b.tier === 'grail') && illusions.length) verdict = 'grail';
  else if (pts >= 46) verdict = 'confirmed';
  else if (pts >= 28) verdict = 'likely';
  else if (pts >= 16) verdict = 'maybe';
  else verdict = 'rejected';

  return {
    verdict, score: Math.round(pts),
    confidence: Math.max(0, Math.min(100, Math.round(pts * 1.15))),
    illusions, builders, provenance, deal: null,
    negatives: negatives.slice(0, 4), scaleHits: scale.length, isPlans,
  };
}

export const RANK = { grail: 5, confirmed: 4, likely: 3, plans: 2, maybe: 1, rejected: 0 };

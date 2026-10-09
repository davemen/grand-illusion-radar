// Regression checks for the Jev hooks. Unlike test-classify.mjs this never calls the
// network (npm test runs it with JEV_RANK=0) — it checks the on/off contract, the banding
// against jev.config.json's cutoffs, and the shape of what would be sent.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shadowScore, toState, jevTag, JEV_SHADOW_ENABLED, JEV_RANK_ENABLED } from '../lib/jev.mjs';

assert.equal(JEV_SHADOW_ENABLED, process.env.JEV_SHADOW === '1',
  'JEV_SHADOW_ENABLED must track the env var exactly');
assert.equal(JEV_RANK_ENABLED, process.env.JEV_RANK !== '0',
  'JEV_RANK_ENABLED is on unless JEV_RANK=0');

if (!JEV_SHADOW_ENABLED && !JEV_RANK_ENABLED) {
  const r = await shadowScore({ title: 'anything', price: 10, source: 'ebay' });
  assert.equal(r, null, 'shadowScore must return null (no call, no cost) when both modes are off');
}

// Banding reads the live cutoffs from jev.config.json and only compares, never computes.
const t = JSON.parse(readFileSync(new URL('../jev.config.json', import.meta.url))).sites.illusion_relevance.thresholds;
assert.ok(t.demote_below_p_yes < t.review_below_p_yes, 'demote cutoff sits below the review cutoff');
const at = p => jevTag({ stage_illusion: { noul: p } });
assert.equal(at(0.01).band, 'not-stage');
assert.equal(at(t.demote_below_p_yes).band, 'review', 'the demote cutoff itself is review, not hidden');
assert.equal(at(0.29).band, 'review', 'the lowest labelled true (0.29) must never be hidden');
assert.equal(at(t.review_below_p_yes).band, 'stage');
assert.equal(at(0.97).p_yes, 0.97, 'P(yes) is carried through unchanged');
// Fail open: no answer, a malformed answer, or no config means no tag (listing shows as before).
assert.equal(jevTag(null), null);
assert.equal(jevTag({ kind: { choice: 'prop' } }), null);
assert.equal(jevTag({ stage_illusion: { noul: '0.1' } }), null);
assert.equal(jevTag({ stage_illusion: { noul: 0.01 } }, null), null);

// State sent to Jev is named fields only — never the classifier's own score/verdict,
// never raw HTML, never more than the fields listed in jev.config.json's state_shape.
const state = toState({
  title: '  Zig Zag Girl Illusion  ', desc: 'a'.repeat(1000), priceText: '$3,200',
  sourceLabel: 'eBay', score: 999, verdict: 'confirmed', illusions: [{ name: 'leak' }],
});
assert.deepEqual(Object.keys(state).sort(), ['description', 'price', 'source', 'title']);
assert.equal(state.title, 'Zig Zag Girl Illusion', 'title is trimmed');
assert.ok(state.description.length <= 500, 'description is capped at 500 chars');
assert.equal(state.price, '$3,200', 'priceText is used verbatim when present');
assert.equal(state.source, 'eBay');
assert.ok(!('score' in state) && !('verdict' in state) && !('illusions' in state),
  'the classifier verdict/score must never leak into what Jev sees');

// Falls back to a numeric price and an "unknown" source when the scraped fields are missing.
const bare = toState({ title: 'x', price: 42, source: 'craigslist' });
assert.equal(bare.price, '$42');
assert.equal(bare.source, 'craigslist');
const nothing = toState({ title: 'x' });
assert.equal(nothing.price, 'no price listed');
assert.equal(nothing.source, 'unknown');

console.log('test-jev: all checks passed');

// Regression checks for the JEV_SHADOW hook. Unlike test-classify.mjs this never calls
// the network — it only checks the off-by-default contract and the shape of what would
// be sent, which is what "shadow mode never touches the live scan" actually depends on.
import assert from 'node:assert/strict';
import { shadowScore, toState, JEV_SHADOW_ENABLED } from '../lib/jev.mjs';

assert.equal(JEV_SHADOW_ENABLED, process.env.JEV_SHADOW === '1',
  'JEV_SHADOW_ENABLED must track the env var exactly');

if (process.env.JEV_SHADOW !== '1') {
  const r = await shadowScore({ title: 'anything', price: 10, source: 'ebay' });
  assert.equal(r, null, 'shadowScore must return null (no call, no cost) when JEV_SHADOW is unset');
}

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

// Publish a static snapshot to docs/ for GitHub Pages.
// The scanner cannot run on Pages (no Node, and cloud IPs are blocked by eBay and
// Craigslist), so we ship the same UI plus the findings your Mac already gathered.
import fs from 'node:fs/promises';
import path from 'node:path';
import { loadListings, loadState } from '../lib/store.mjs';
import { SOURCES } from '../lib/engine.mjs';

const root = new URL('../', import.meta.url).pathname;
const docs = path.join(root, 'docs');

await fs.mkdir(docs, { recursive: true });
for (const f of ['index.html', 'app.js']) {
  await fs.copyFile(path.join(root, 'public', f), path.join(docs, f));
}

const [listings, state] = await Promise.all([loadListings(), loadState()]);
const live = listings.filter(l => !l.gone);   // legacy flag from older corpora
const snapshot = {
  generatedAt: new Date().toISOString(),
  listings: live,
  health: state.health || {},
  sources: Object.fromEntries(Object.entries(SOURCES).map(([k, v]) => [k, v.meta])),
};
await fs.writeFile(path.join(docs, 'data.json'), JSON.stringify(snapshot));
await fs.writeFile(path.join(docs, '.nojekyll'), '');

const deals = live.filter(l => l.deal).length;
const bytes = (await fs.stat(path.join(docs, 'data.json'))).size;
console.log(`docs/ built — ${live.length} findings (${deals} deals), data.json ${(bytes / 1024).toFixed(0)} KB`);

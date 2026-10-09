import express from 'express';
import { runScan, sortListings, SOURCES } from './lib/engine.mjs';
import { loadListings, loadState, loadUser, saveUser, saveListings } from './lib/store.mjs';
import { offerOf, buyableOf } from './lib/comps.mjs';

const app = express();
app.use(express.json());
app.use(express.static(new URL('./public/', import.meta.url).pathname));

let scanning = false;
const clients = new Set();
const broadcast = e => { const s = `data: ${JSON.stringify(e)}\n\n`; for (const c of clients) c.write(s); };

app.get('/api/events', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders(); res.write(': connected\n\n');
  clients.add(res);
  req.on('close', () => clients.delete(res));
});

app.get('/api/state', async (req, res) => {
  const [state, user, listings] = await Promise.all([loadState(), loadUser(), loadListings()]);
  res.json({ ...state, scanning, user, count: listings.length,
    sources: Object.fromEntries(Object.entries(SOURCES).map(([k, v]) => [k, v.meta])) });
});

app.get('/api/listings', async (req, res) => {
  const { sort = 'deal', verdict, source, min, max, q, saved, deals, forsale, jev } = req.query;
  const [all, user] = await Promise.all([loadListings(), loadUser()]);
  const savedSet = new Set(user.saved), hiddenSet = new Set(user.hidden);
  let out = all.filter(l => !hiddenSet.has(l.id));
  if (saved === '1') out = out.filter(l => savedSet.has(l.id));
  if (verdict) { const v = new Set(String(verdict).split(',')); out = out.filter(l => v.has(l.verdict)); }
  if (source) { const s = new Set(String(source).split(',')); out = out.filter(l => s.has(l.source)); }
  if (deals === '1') out = out.filter(l => l.deal);
  // Only things you can actually buy — no forum threads about one.
  if (forsale === '1') out = out.filter(l => buyableOf(l) && offerOf(l) !== 'lead');
  // Jev's 'not-stage' band (see jev.config.json). Untagged listings always show.
  if (jev === '1') out = out.filter(l => l.jev?.band !== 'not-stage');
  if (min) out = out.filter(l => (l.price ?? 0) >= +min);
  if (max) out = out.filter(l => l.price != null && l.price <= +max);
  if (q) { const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    out = out.filter(l => rx.test(l.title) || rx.test(l.sourceLabel || '')); }
  res.json({ listings: sortListings(out, sort).slice(0, 600).map(l => ({ ...l, saved: savedSet.has(l.id) })),
    total: out.length });
});

app.post('/api/scan', async (req, res) => {
  if (scanning) return res.status(409).json({ error: 'already scanning' });
  scanning = true;
  res.json({ ok: true });
  try {
    const { summary } = await runScan({ deep: !!req.body?.deep, only: req.body?.only, emit: broadcast });
    broadcast({ type: 'refresh', summary });
  } catch (e) { broadcast({ type: 'error', message: String(e.message) }); }
  finally { scanning = false; broadcast({ type: 'idle' }); }
});

app.post('/api/user/:action', async (req, res) => {
  const { action } = req.params, { id } = req.body;
  const user = await loadUser();
  const list = action === 'save' ? 'saved' : 'hidden';
  if (!['save', 'hide'].includes(action)) return res.status(400).json({ error: 'bad action' });
  user[list] = user[list].includes(id) ? user[list].filter(x => x !== id) : [...user[list], id];
  await saveUser(user);
  res.json({ ok: true, user });
});

app.post('/api/reset', async (req, res) => { await saveListings([]); res.json({ ok: true }); });

const PORT = process.env.PORT || 7777;
app.listen(PORT, () => console.log(`\n  ✦ Grand Illusion Radar → http://localhost:${PORT}\n`));

import { getContext, money } from '../browser.mjs';

// Craigslist has no national search — you federate across metros or you miss everything.
const CITIES = ['newyork','losangeles','chicago','houston','dallas','philadelphia','phoenix',
  'sandiego','sfbay','seattle','atlanta','boston','miami','denver','detroit','minneapolis',
  'orlando','tampa','lasvegas','portland','sacramento','stlouis','kansascity','columbus',
  'charlotte','nashville','austin','sanantonio','pittsburgh','cleveland','indianapolis',
  'milwaukee','neworleans','saltlakecity','okc','memphis','louisville','raleigh','hartford','albuquerque'];

const QUERIES = ['illusion', 'magician'];

const EXTRACT = () => [...document.querySelectorAll('.cl-search-result, .cl-static-search-result')]
  .map(el => {
    const a = el.querySelector('a.posting-title, a.cl-app-anchor, a[href*="/d/"]');
    const title = el.querySelector('.titlestring, .title')?.textContent?.trim()
      || a?.textContent?.trim() || '';
    if (!title) return null;
    return {
      title: title.replace(/\s+/g, ' '),
      url: a?.href || '',
      priceText: el.querySelector('.priceinfo, .price')?.textContent?.trim() || '',
      location: el.querySelector('.location, .meta')?.textContent?.trim() || '',
      image: el.querySelector('img')?.src || null,
    };
  }).filter(Boolean);

export const meta = { id: 'craigslist', label: 'Craigslist', kind: 'classified' };

export async function scan({ deep = false, maxCities = null, onProgress = () => {} } = {}) {
  const cities = CITIES.slice(0, maxCities ?? (deep ? CITIES.length : 12));
  const out = [];
  const tasks = cities.flatMap(c => QUERIES.map(q => ({ c, q })));
  const ctx = await getContext();

  // Forty metros served serially is a five-minute wait. Craigslist is happy to
  // answer a handful of tabs at once, so run a small pool instead.
  const LANES = 4;
  let cursor = 0, done = 0;

  const lane = async () => {
    const page = await ctx.newPage();
    await page.route('**/*', r => ['font', 'media', 'image', 'stylesheet'].includes(r.request().resourceType())
      ? r.abort() : r.continue());
    try {
      while (cursor < tasks.length) {
        const t = tasks[cursor++];
        onProgress({ source: 'craigslist', step: ++done, total: tasks.length, label: `${t.c} · ${t.q}` });
        const url = `https://${t.c}.craigslist.org/search/sss?query=${encodeURIComponent(t.q)}&sort=date`;
        try {
          const r = await page.goto(url, { waitUntil: 'domcontentloaded' });
          if (!r || r.status() >= 400) continue;
          await page.waitForSelector('.cl-search-result, .cl-static-search-result, .no-results',
            { timeout: 10000 }).catch(() => {});
          await page.waitForTimeout(500);
          for (const it of await page.evaluate(EXTRACT)) {
            if (!it.url) continue;
            out.push({ ...it, id: 'cl:' + (it.url.match(/(\d{9,})\.html/) || [, it.url])[1],
              price: money(it.priceText), source: 'craigslist', sourceLabel: `Craigslist ${t.c}`,
              city: t.c, boost: 4, offer: 'listing', buyable: true, saleType: 'classified', priceIsFirm: true });
          }
        } catch {}
      }
    } finally { await page.close().catch(() => {}); }
  };

  await Promise.all(Array.from({ length: LANES }, lane));
  return { items: out, status: out.length ? 'ok' : 'empty', note: '' };
}

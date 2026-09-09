import { withPage, money } from '../browser.mjs';

// Potter & Potter is the premier magic auction house. Provenance pieces from major
// collections pass through here and never touch eBay. The platform is JS-rendered.
export const meta = { id: 'potter', label: 'Potter & Potter', kind: 'auction' };

const AUCTION_RE = /\/auctions\/[a-z0-9-]+\/[a-z0-9-]+-\d+$/i;

export async function scan({ deep = false, onProgress = () => {} } = {}) {
  const items = [];
  try {
    await withPage(async page => {
      onProgress({ source: 'potter', step: 1, total: deep ? 3 : 1, label: 'upcoming auctions' });
      const r = await page.goto('https://auction.potterauctions.com/auctions', { waitUntil: 'domcontentloaded' });
      if (!r || r.status() >= 400) return;
      await page.waitForTimeout(4000);

      const auctions = await page.evaluate(re => {
        const seen = new Map();
        for (const a of document.querySelectorAll('a[href*="/auctions/"]')) {
          const href = a.href.split('#')[0].replace(/\/catalog$/, '');
          const t = (a.textContent || '').replace(/\s+/g, ' ').trim();
          if (!new RegExp(re, 'i').test(href) || t.length < 6 || /^view catalog/i.test(t)) continue;
          if (!seen.has(href)) seen.set(href, t);
        }
        return [...seen].map(([url, title]) => ({ url, title }));
      }, AUCTION_RE.source);

      for (const a of auctions)
        items.push({ id: 'pp:' + a.url, title: a.title, url: a.url + '/catalog', price: null, priceText: '',
          source: 'potter', sourceLabel: 'Potter & Potter · auction', kind: 'auction', boost: 18,
          offer: 'auction', buyable: true, saleType: 'auction', priceIsFirm: false });

      if (true) return; // lot-level descent: platform paginates lots behind JS; auctions link to catalogs
      // Descend into the catalogs — this is where the actual lots live.
      for (const [i, a] of auctions.slice(0, 2).entries()) {
        onProgress({ source: 'potter', step: 2 + i, total: 3, label: a.title.slice(0, 40) });
        try {
          await page.goto(a.url + '/catalog', { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(4500);
          const lots = await page.evaluate(() => {
            const out = [], seen = new Set();
            for (const el of document.querySelectorAll('a[href*="/lots/"], [class*="lot-"], [class*="lotTile"]')) {
              const link = el.matches('a') ? el : el.querySelector('a[href*="/lots/"]');
              if (!link) continue;
              const url = link.href.split('?')[0];
              const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
              const title = t.replace(/^Lot\s*#?\s*\d+\s*/i, '').slice(0, 160);
              if (!url || seen.has(url) || title.length < 8) continue;
              seen.add(url);
              out.push({ url, title, est: (t.match(/\$[\d,]+\s*-\s*\$[\d,]+/) || [''])[0] });
            }
            return out.slice(0, 250);
          });
          for (const l of lots)
            items.push({ id: 'pp:' + l.url, title: l.title, url: l.url,
              price: money(l.est), priceText: l.est, source: 'potter',
              sourceLabel: `Potter & Potter · ${a.title.slice(0, 30)}`, kind: 'lot', boost: 14 });
        } catch {}
      }
    });
  } catch (e) { return { items, status: 'error', note: e.message.slice(0, 80) }; }
  return { items, status: items.length ? 'ok' : 'empty',
    note: items.length ? '' : 'No auctions parsed.',
    manualUrl: 'https://auction.potterauctions.com/auctions' };
}

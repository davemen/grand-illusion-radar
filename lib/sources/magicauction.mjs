import { getContext, money } from '../browser.mjs';

// magicauction.com is a dedicated used-illusion marketplace — the most on-target
// source there is. It classifies its own stock (stage / illusion / known-builder),
// which we trust as strong prior evidence. Nearly everything here is an auction with
// a starting bid, so the listed price is a floor, not a settled price.
const CATS = [
  ['stage', 30, 3],                              // [slug, boost, pages]
  ['its-a-steal-sale', 26, 2],                   // the site's own bargain bin
  ['reduced', 26, 2],                            // sellers who have cut their price
  ['live-bids-now', 22, 2],
  ['new-items', 20, 2],
  ['located-inside-the-usa/known-builder', 30, 2],
  ['parlour-medium-size', 12, 1],
];

const EXTRACT = () => {
  const out = [];
  for (const li of document.querySelectorAll('li.product')) {
    if (li.classList.contains('product-category')) continue;   // category tile, not stock
    const a = li.querySelector('a[href*="/product/"]');
    if (!a) continue;
    const url = a.href.split('?')[0];
    const text = (li.innerText || '').replace(/\s+/g, ' ').trim();
    let title = li.querySelector('.woocommerce-loop-product__title, h2, h3')?.textContent?.trim()
      || (li.innerText || '').split('\n')[0].trim();
    title = title.replace(/\s+/g, ' ').replace(/Starting bid.*$/i, '').replace(/Bid now$/i, '').trim();
    if (!title || title.length < 4) continue;

    const cls = li.className || '';
    const cats = (cls.match(/product_cat-[a-z0-9-]+/g) || []).map(c => c.replace('product_cat-', ''));
    const isAuction = /product-type-auction/.test(cls) || /starting bid/i.test(text);
    out.push({
      url, title,
      priceText: (text.match(/Starting bid:\s*\$[\d,.]+/i) || text.match(/\$[\d,.]+/) || [''])[0],
      image: li.querySelector('img')?.getAttribute('src') || null,
      cats, isAuction,
      live: /uwa_auction_status_live/.test(cls),
    });
  }
  return out;
};

export const meta = { id: 'magicauction', label: 'Magic Auction', kind: 'marketplace' };

export async function scan({ deep = false, onProgress = () => {} } = {}) {
  const items = new Map();
  const ctx = await getContext();
  const page = await ctx.newPage();
  await page.route('**/*', r => ['font', 'media', 'stylesheet'].includes(r.request().resourceType())
    ? r.abort() : r.continue());

  const tasks = CATS.flatMap(([slug, boost, pages]) =>
    Array.from({ length: deep ? pages : 1 }, (_, i) => ({ slug, boost, page: i + 1 })));

  try {
    for (const [i, t] of tasks.entries()) {
      onProgress({ source: 'magicauction', step: i + 1, total: tasks.length,
        label: `${t.slug}${t.page > 1 ? ` p${t.page}` : ''}` });
      const url = `https://magicauction.com/product-category/${t.slug}/`
        + (t.page > 1 ? `page/${t.page}/` : '');
      try {
        const r = await page.goto(url, { waitUntil: 'domcontentloaded' });
        if (!r || r.status() >= 400) continue;
        await page.waitForTimeout(2200);
        for (const it of await page.evaluate(EXTRACT)) {
          if (items.has(it.url)) continue;
          // The site's own taxonomy is good evidence; a stage/illusion tag is worth a lot.
          const catBoost = (it.cats.includes('stage') ? 10 : 0)
            + (it.cats.includes('illusion') ? 8 : 0)
            + (it.cats.some(c => c.startsWith('known-builder')) ? 10 : 0);
          items.set(it.url, {
            id: 'ma:' + it.url.replace(/.*\/product\//, '').replace(/\/$/, ''),
            title: it.title, url: it.url, image: it.image,
            priceText: it.priceText, price: money(it.priceText),
            source: 'magicauction', sourceLabel: 'Magic Auction',
            category: it.cats.join(' '),
            boost: t.boost + catBoost,
            offer: 'listing', buyable: true,
            saleType: it.isAuction ? 'auction' : 'bin',
            // A starting bid is a floor, not the price you will pay.
            priceIsFirm: !it.isAuction,
          });
        }
      } catch {}
    }
  } finally { await page.close().catch(() => {}); }

  const out = [...items.values()];
  return { items: out, status: out.length ? 'ok' : 'empty', note: '',
    manualUrl: 'https://magicauction.com/product-category/located-inside-the-usa/' };
}

import { withPage, money } from '../browser.mjs';

// Alibaba is where new-build illusion props come from at factory prices — genuinely
// useful, but it rate-limits hard and falls back to a slider CAPTCHA. We touch it
// gently (one query per scan by default) and report honestly when it locks us out.
const QUERIES_DEEP = ['stage magic illusion props', 'magic illusion equipment stage',
  'sawing illusion box magic', 'levitation magic prop stage'];
const QUERIES_QUICK = ['stage magic illusion props'];

const EXTRACT = () => {
  const out = [], seen = new Set();
  const cards = document.querySelectorAll(
    '.fy23-search-card, .organic-list-offer-outter, .traffic-product-card, .list-no-v2-outter, [data-content-id]');
  for (const card of cards) {
    const a = card.querySelector('a[href*="product-detail"], a[href*="/p-detail/"], a[href]');
    const title = (card.querySelector('h2, .search-card-e-title, [class*="title"] span, [class*="title"]')
      ?.textContent || '').trim();
    const url = a?.href?.split('?')[0] || '';
    if (!title || title.length < 12 || !url || seen.has(url)) continue;
    seen.add(url);
    const t = card.textContent || '';
    out.push({
      title: title.replace(/\s+/g, ' ').slice(0, 200), url,
      priceText: (t.match(/US\s?\$\s?[\d.,]+/) || t.match(/\$\s?[\d.,]+/) || [''])[0],
      image: card.querySelector('img')?.src || null,
      moq: (t.match(/(\d[\d,.]*)\s*(pieces?|sets?|units?)\b/i) || [''])[0],
      supplier: (card.querySelector('[class*="company"], .search-card-e-company')?.textContent || '').trim(),
    });
  }
  return out;
};

export const meta = { id: 'alibaba', label: 'Alibaba', kind: 'wholesale' };

export async function scan({ deep = false, onProgress = () => {} } = {}) {
  const qs = deep ? QUERIES_DEEP : QUERIES_QUICK;
  const items = []; let blocked = false;
  await withPage(async page => {
    for (const [i, q] of qs.entries()) {
      onProgress({ source: 'alibaba', step: i + 1, total: qs.length, label: q });
      const searchUrl = `https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(q)}`;
      try {
        const r = await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
        if (!r || r.status() >= 400) { blocked = true; continue; }
        await page.waitForTimeout(3500);
        if (/captcha|verif/i.test(await page.title())) { blocked = true; break; }
        await page.evaluate(() => window.scrollBy(0, 2200));
        await page.waitForTimeout(1500);
        for (const it of await page.evaluate(EXTRACT))
          items.push({ ...it, id: 'ali:' + (it.url.match(/(\d{6,})/) || [, it.url])[1],
            price: money(it.priceText), source: 'alibaba', sourceLabel: 'Alibaba', boost: 6 });
        if (i < qs.length - 1) await page.waitForTimeout(4000); // be a good citizen
      } catch { blocked = true; }
    }
  });
  return {
    items,
    status: items.length ? 'ok' : blocked ? 'blocked' : 'empty',
    note: items.length ? ''
      : blocked ? 'Alibaba served a CAPTCHA — run `npm run login` once to solve it, or open the search manually.'
      : 'Alibaba returned no parseable cards — open the search manually.',
    manualUrl: `https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(qs[0])}`,
  };
}

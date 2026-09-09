import { getContext, money } from '../browser.mjs';

// Alibaba proper CAPTCHAs its search endpoint. AliExpress serves the same intent —
// overseas manufacturers selling illusion props direct — and answers reliably.
const QUERIES_DEEP = ['stage magic illusion props', 'magic illusion stage equipment',
  'sawing illusion magic prop', 'levitation magic stage prop', 'magic illusion box stage large'];
const QUERIES_QUICK = ['stage magic illusion props', 'magic illusion stage equipment'];

const EXTRACT = () => {
  const out = [], seen = new Set();
  for (const a of document.querySelectorAll('a[href*="/item/"]')) {
    const id = (a.href.match(/\/item\/(\d+)/) || [])[1];
    if (!id || seen.has(id)) continue;
    let card = a;
    for (let i = 0; i < 5 && card?.parentElement; i++) {
      card = card.parentElement;
      if (card.querySelector('img') && (card.textContent || '').length > 40) break;
    }
    const title = (a.getAttribute('title') || a.textContent || '').replace(/\s+/g, ' ').trim();
    if (title.length < 15) continue;
    seen.add(id);
    const t = card?.textContent || '';
    out.push({
      id: 'ae:' + id, title: title.slice(0, 200), url: 'https://www.aliexpress.com/item/' + id + '.html',
      priceText: (t.match(/US\s?\$\s?[\d.,]+/) || t.match(/\$\s?[\d.,]+/) || [''])[0],
      image: card?.querySelector('img')?.src || null,
      supplier: '',
    });
  }
  return out;
};

export const meta = { id: 'aliexpress', label: 'AliExpress', kind: 'wholesale' };

export async function scan({ deep = false, onProgress = () => {} } = {}) {
  const qs = deep ? QUERIES_DEEP : QUERIES_QUICK;
  const items = []; let blocked = false;
  const ctx = await getContext();
  const page = await ctx.newPage();
  try {
    for (const [i, q] of qs.entries()) {
      onProgress({ source: 'aliexpress', step: i + 1, total: qs.length, label: q });
      const url = `https://www.aliexpress.us/w/wholesale-${encodeURIComponent(q.replace(/\s+/g, '-'))}.html`;
      try {
        const r = await page.goto(url, { waitUntil: 'domcontentloaded' });
        if (!r || r.status() >= 400) { blocked = true; continue; }
        await page.waitForTimeout(3500);
        await page.evaluate(() => window.scrollBy(0, 2400));
        await page.waitForTimeout(1800);
        if (/captcha|verif/i.test(await page.title())) { blocked = true; break; }
        for (const it of await page.evaluate(EXTRACT))
          items.push({ ...it, price: money(it.priceText), source: 'aliexpress',
            sourceLabel: 'AliExpress', boost: 5, offer: 'listing', buyable: true, saleType: 'bin', priceIsFirm: true });
      } catch { blocked = true; }
    }
  } finally { await page.close().catch(() => {}); }
  return {
    items, status: items.length ? 'ok' : blocked ? 'blocked' : 'empty',
    note: items.length ? '' : 'AliExpress did not return results this run.',
    manualUrl: `https://www.aliexpress.us/w/wholesale-${encodeURIComponent(qs[0].replace(/\s+/g, '-'))}.html`,
  };
}

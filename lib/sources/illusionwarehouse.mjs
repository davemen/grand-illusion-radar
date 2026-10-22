import { money } from '../browser.mjs';

// Illusion Warehouse resells used professional illusions (Abbott, Supreme, Owen,
// Mikame). It is a Wix store whose shop grid renders server-side, so plain HTTP works.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36';
const decode = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#039;/g, "'").trim();

export const meta = { id: 'illusionwarehouse', label: 'Illusion Warehouse', kind: 'dealer' };

export async function scan({ deep = false, onProgress = () => {} } = {}) {
  const items = new Map(); let errors = 0;
  const pages = deep ? 6 : 2;
  for (let p = 1; p <= pages; p++) {
    onProgress({ source: 'illusionwarehouse', step: p, total: pages, label: `shop p${p}` });
    try {
      const res = await fetch(`https://www.illusionwarehouse.com/shop${p > 1 ? `?page=${p}` : ''}`,
        { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(25000) });
      if (!res.ok) { errors++; continue; }
      const cards = (await res.text()).split('data-hook="product-item-root"').slice(1);
      let fresh = 0;
      for (const c of cards) {
        const url = (c.match(/href="(https:\/\/www\.illusionwarehouse\.com\/product-page\/[^"]+)"/) || [])[1];
        const title = decode((c.match(/data-hook="product-item-name"[^>]*>([^<]+)/) || [])[1] || '');
        if (!url || !title || items.has(url)) continue;
        const priceText = decode((c.match(/data-hook="product-item-price-to-pay"[^>]*>([^<]+)/) || [])[1] || '');
        const uri = (c.match(/&quot;uri&quot;:&quot;([^&]+)&quot;/) || [])[1];
        fresh++;
        items.set(url, {
          id: 'ilw:' + url.split('/product-page/')[1], title, url, priceText, price: money(priceText),
          image: uri ? `https://static.wixstatic.com/media/${uri}/v1/fill/w_800,h_800/${uri}` : null,
          source: 'illusionwarehouse', sourceLabel: 'Illusion Warehouse',
          // A dealer that only stocks illusions: being listed here is strong evidence.
          boost: 22, offer: 'listing', buyable: true, saleType: 'bin', priceIsFirm: true,
          soldOut: /product-item-out-of-stock/.test(c),
        });
      }
      if (!fresh) break;   // past the last page Wix repeats page 1
    } catch { errors++; }
  }
  const out = [...items.values()].filter(x => !x.soldOut);
  return { items: out, status: out.length ? 'ok' : errors ? 'error' : 'empty', note: '' };
}

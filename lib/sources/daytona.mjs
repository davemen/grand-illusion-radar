// Daytona Magic sells mostly new close-up stock, but carries real illusions (chair
// suspensions, cabinets) and the odd consignment. WooCommerce's public Store API
// returns JSON; prices are in minor units (currency_minor_unit, 2 = cents).
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36';
const decode = s => s.replace(/&#8211;/g, '-').replace(/&#8217;/g, "'").replace(/&amp;/g, '&').replace(/<[^>]+>/g, '').trim();
const QUERIES = ['illusion', 'stage illusion', 'levitation', 'cabinet', 'trunk', 'sawing', 'zig zag'];

export const meta = { id: 'daytona', label: 'Daytona Magic', kind: 'dealer' };

export async function scan({ deep = false, onProgress = () => {} } = {}) {
  const items = new Map(); let errors = 0;
  const qs = deep ? QUERIES : QUERIES.slice(0, 2);
  for (const [i, q] of qs.entries()) {
    onProgress({ source: 'daytona', step: i + 1, total: qs.length, label: q });
    try {
      const res = await fetch(`https://www.daytonamagic.com/wp-json/wc/store/v1/products?search=${encodeURIComponent(q)}&per_page=100`,
        { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(25000) });
      if (!res.ok) { errors++; continue; }
      for (const x of await res.json()) {
        if (!x.is_in_stock || items.has(x.id)) continue;
        const price = +x.prices.price / 10 ** (x.prices.currency_minor_unit ?? 2);
        items.set(x.id, {
          id: 'dt:' + x.id, title: decode(x.name), url: x.permalink,
          priceText: '$' + price.toLocaleString('en-US'), price,
          image: x.images?.[0]?.src || null,
          source: 'daytona', sourceLabel: 'Daytona Magic',
          boost: 4, offer: 'listing', buyable: true, saleType: 'bin', priceIsFirm: true,
        });
      }
    } catch { errors++; }
  }
  const out = [...items.values()];
  return { items: out, status: out.length ? 'ok' : errors ? 'error' : 'empty', note: '' };
}

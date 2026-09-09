// The Magic Café forum 7 ("Grand illusion") is where the stage-illusion community
// actually talks — and where private sales get announced before they hit eBay.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36';
const FORUMS = [[7, 'Grand illusion'], [389, 'Magic Stage Left']];
// An offer, not a request. "buy" and "wanted" mean the opposite and must not match.
const SALE_INTENT = /\b(for sale|f\/s|wts|selling|asking price|\$\s?\d)/i;

const decode = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'")
  .replace(/&eacute;/g, 'e').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');

export const meta = { id: 'magiccafe', label: 'The Magic Café', kind: 'community' };

export async function scan({ deep = false, onProgress = () => {} } = {}) {
  const items = []; let errors = 0;
  const pages = deep ? [0, 30, 60] : [0, 30];
  const tasks = FORUMS.flatMap(([f, name]) => pages.map(start => ({ f, name, start })));
  for (const [i, t] of tasks.entries()) {
    onProgress({ source: 'magiccafe', step: i + 1, total: tasks.length, label: `${t.name} p${t.start / 30 + 1}` });
    try {
      const res = await fetch(
        `https://www.themagiccafe.com/forums/viewforum.php?forum=${t.f}&start=${t.start}`,
        { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) });
      if (!res.ok) { errors++; continue; }
      const html = await res.text();
      const re = /viewtopic\.php\?topic=(\d+)&(?:amp;)?forum=\d+"[^>]*>([^<]{4,140})</g;
      let m;
      while ((m = re.exec(html))) {
        const title = decode(m[2]).replace(/\s+/g, ' ').trim();
        if (!title || /^(sticky|announcement)/i.test(title)) continue;
        // The Magic Café has no public classifieds forum (checked all 40 categories),
        // so forum 7 is discussion. Only an explicit offer earns a place here.
        if (!SALE_INTENT.test(title)) continue;
        items.push({
          id: 'mc:' + m[1], title,
          url: `https://www.themagiccafe.com/forums/viewtopic.php?topic=${m[1]}&forum=${t.f}`,
          price: null, priceText: '', source: 'magiccafe', sourceLabel: `Magic Café · ${t.name}`,
          kind: 'lead', forSale: true, offer: 'lead', buyable: false, boost: 14,
        });
      }
    } catch { errors++; }
    await new Promise(r => setTimeout(r, 600));
  }
  const uniq = [...new Map(items.map(i => [i.id, i])).values()];
  return { items: uniq, status: uniq.length ? 'ok' : errors ? 'error' : 'empty', note: '' };
}

import { withPage, money } from '../browser.mjs';

// facebook.com/usedmagicillusions: working illusionists selling their own props.
// Facebook shows almost nothing logged out, so this reads the page through the
// scanner's own Chrome profile once Dave has signed in with `npm run login`.
const PAGE = 'https://www.facebook.com/usedmagicillusions';

const EXTRACT = () => {
  const out = [];
  for (const art of document.querySelectorAll('[role="article"]')) {
    const text = (art.innerText || '').replace(/\s+/g, ' ').trim();
    const price = text.match(/\$\s?\d[\d,]*(?:\.\d{2})?/);
    if (!price || /\b(wanted|wtb|looking for|iso)\b/i.test(text)) continue;
    const link = [...art.querySelectorAll('a[href]')].map(a => a.href)
      .find(h => /\/(posts|permalink|photo|videos)\b|story_fbid|pfbid/.test(h));
    const img = [...art.querySelectorAll('img')].find(i => i.naturalWidth >= 200 || i.width >= 200);
    out.push({ text: text.slice(0, 600), priceText: price[0], url: link?.split('?')[0] || '', image: img?.src || null });
  }
  return out;
};

export const meta = { id: 'facebook', label: 'Facebook · Used Magic Illusions', kind: 'community' };

export async function scan({ deep = false, onProgress = () => {} } = {}) {
  onProgress({ source: 'facebook', step: 1, total: 1, label: 'usedmagicillusions' });
  const blocked = { items: [], status: 'blocked', manualUrl: PAGE,
    note: 'Needs a Facebook sign-in: run `npm run login` once.' };
  return withPage(async page => {
    const r = await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);
    if (!r || r.status() >= 400 || /\/login|checkpoint/.test(page.url())
      || await page.$('form[action*="login"], [data-testid="royal_login_form"]')) return blocked;
    for (let i = 0; i < (deep ? 14 : 6); i++) { await page.mouse.wheel(0, 2400); await page.waitForTimeout(900); }
    const seen = new Set(), items = [];
    for (const p of await page.evaluate(EXTRACT)) {
      const key = p.url || p.text.slice(0, 80);
      if (seen.has(key)) continue; seen.add(key);
      items.push({
        id: 'fb:' + (p.url.match(/(?:posts|permalink|photo|videos)\/?([\w.-]+)|fbid=(\w+)|(pfbid\w+)/)?.slice(1).find(Boolean) || key.slice(0, 40)),
        title: p.text.slice(0, 160), description: p.text, url: p.url || PAGE, image: p.image,
        priceText: p.priceText, price: money(p.priceText),
        source: 'facebook', sourceLabel: 'Facebook',
        boost: 16, offer: 'listing', buyable: true, saleType: 'bin', priceIsFirm: true,
      });
    }
    return items.length ? { items, status: 'ok', note: '' } : blocked;
  });
}

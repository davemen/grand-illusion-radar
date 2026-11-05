import { withPage, money } from '../browser.mjs';

// facebook.com/usedmagicillusions: working illusionists selling their own props.
// Facebook shows almost nothing logged out, so this reads the page through the
// scanner's own Chrome profile once Dave has signed in with `npm run login`.
const PAGE = 'https://www.facebook.com/usedmagicillusions';

// Facebook's page DOM is obfuscated: [role="article"] blocks are empty shells and the
// post text sits in nested div[dir="auto"] nodes (often repeated). So anchor on the
// price text, then climb to the smallest ancestor that also holds a photo and a link.
const EXTRACT = () => {
  const clean = s => (s || '').replace(/[\u200b-\u200f\u2060\ufeff]/g, '').replace(/\s+/g, ' ').trim();
  const PRICE = /\$\s?\d[\d,]*(?:\.\d{2})?/;
  const LINK = /\/(posts|permalink|photo|videos|reel)\b|story_fbid|pfbid|[?&]fbid=/;
  const big = i => (i.naturalWidth || i.width || 0) >= 200;
  const out = [], seen = new Set();
  for (const el of document.querySelectorAll('div[dir="auto"]')) {
    const text = clean(el.innerText);
    if (text.length < 12 || !PRICE.test(text) || /\b(wanted|wtb|looking for|iso)\b/i.test(text)) continue;
    if (el.closest('[role="navigation"], [role="banner"]')) continue;
    let box = el;
    while (box.parentElement && box.parentElement !== document.body) {
      box = box.parentElement;
      if ([...box.querySelectorAll('img')].some(big) && [...box.querySelectorAll('a[href]')].some(a => LINK.test(a.href))) break;
    }
    const imgs = [...box.querySelectorAll('img')].filter(big);
    const small = clean(box.innerText).length <= 700; // a bigger box wraps several posts: don't guess a link
    const link = !small ? '' : [...box.querySelectorAll('a[href]')].map(a => a.href).find(h => LINK.test(h) && !/\/photos\/?$/.test(h));
    if (!imgs.length) continue;
    // One entry per post text (Facebook repeats each caption at several depths); the text
    // node itself is the listing copy, the box only supplies the photo and permalink.
    const key = text.slice(0, 60);
    if (seen.has(key)) continue; seen.add(key);
    out.push({ text: text.slice(0, 600), priceText: text.match(PRICE)[0],
      url: link ? link.replace(/([?&])(__cft__|__tn__|comment_id)[^&]*/g, '').replace(/[?&]$/, '') : '', image: imgs[0]?.src || null });
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
    // Facebook virtualises the feed (posts scrolled away are emptied), so read after every step.
    const items = [];
    const take = async () => {
      for (const p of await page.evaluate(EXTRACT)) {
        const key = p.url ? p.url.replace(/&set=.*$/, '') : p.text.slice(0, 60);
        const prev = items.find(x => x._key === key);
        if (prev) { if (p.text.length > prev.description.length) { prev.description = p.text; prev.title = p.text.slice(0, 160); } continue; }
        items.push({
          _key: key,
          id: 'fb:' + (p.url.match(/pfbid\w+/)?.[0] || p.url.match(/fbid=(\w+)/)?.[1] || p.url.match(/(?:posts|permalink|videos|reel)\/(\w+)/)?.[1]
            || 'p' + [...p.text.slice(0, 60)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)),
          title: p.text.slice(0, 160), description: p.text, url: p.url || PAGE, image: p.image,
          priceText: p.priceText, price: money(p.priceText),
          source: 'facebook', sourceLabel: 'Facebook',
          boost: 16, broker: true, offer: 'listing', buyable: true, saleType: 'bin',
          priceIsFirm: !/best offer|\bobo\b|or offer|negotiable|make (me )?an offer/i.test(p.text),
        });
      }
    };
    for (let i = 0; i < (deep ? 24 : 10); i++) {
      await take();
      await page.mouse.wheel(0, 1200); await page.waitForTimeout(1200);
    }
    await take();
    // Signed in but nothing priced on the page is a quiet week, not a login problem.
    items.forEach(x => delete x._key);
    return { items, status: 'ok', note: items.length ? '' : 'Signed in, but no priced posts found on the page.' };
  });
}

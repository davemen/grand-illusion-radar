import { prime, withPage, money } from '../browser.mjs';

// 14014 = eBay's own "Stage Illusion" category, 2536 = Magic.
// We use the SEARCH layout (not category browse) because only it exposes the sale
// signals — Buy It Now / Best Offer / bid count — that tell a firm price from a
// live auction whose current bid will climb.
const CAT_STAGE = '14014', CAT_MAGIC = '2536';

const QUERIES_DEEP = [
  'zig zag girl illusion', 'substitution trunk illusion', 'sawing in half illusion',
  'origami illusion prop', 'levitation illusion stage', 'sword box illusion',
  'head chopper guillotine magic', 'mismade girl illusion', 'owen magic supreme',
  'illusion warehouse prop', 'paul osborne illusion', 'stage illusion prop',
  'magician stage illusion crate', 'blade box illusion', 'broom suspension illusion',
  'asrah levitation', 'doug henning illusion', 'thin model sawing',
];
const QUERIES_QUICK = ['stage illusion prop', 'zig zag girl illusion', 'substitution trunk illusion', 'owen magic supreme'];

const EXTRACT = () => {
  const seen = new Map();
  for (const a of document.querySelectorAll('a[href*="/itm/"]')) {
    const id = (a.href.match(/\/itm\/(?:.*?\/)?(\d{9,})/) || [])[1];
    if (!id || seen.has(id)) continue;
    let card = a;
    for (let i = 0; i < 7 && card; i++) {
      card = card.parentElement;
      if (card && /(^|\s)(s-item|s-card|brwrvr__item-card)(\s|$)/.test(card.className || '')) break;
    }
    if (!card) continue;
    const txt = s => card.querySelector(s)?.textContent?.trim() || '';
    let title = txt('.s-item__title, .s-card__title, .bsig__title, [role="heading"]')
      || a.getAttribute('aria-label') || a.textContent.trim();
    title = title.replace(/\s+/g, ' ').replace(/Opens in a new window.*$/i, '')
      .replace(/^(New Listing|Find more like this.*?eBay\.)/i, '').trim();
    if (!title || /^shop on ebay$/i.test(title)) continue;

    const all = (card.textContent || '').replace(/\s+/g, ' ');
    const bids = (all.match(/\b(\d{1,3})\s+bids?\b/i) || [])[1];
    const img = card.querySelector('img');
    const iu = img?.getAttribute('src') || img?.getAttribute('data-src');

    seen.set(id, {
      id, title,
      priceText: txt('.s-item__price, .s-card__price, .bsig__price')
        || (all.match(/\$[\d,]+(?:\.\d{2})?/) || [''])[0],
      url: a.href.split('?')[0],
      image: iu && /i\.ebayimg\.com/.test(iu) && !/^data:/.test(iu) ? iu : null,
      // The s-card layout dropped these classes; the phrases survive in the card text.
      location: txt('.s-item__location, .s-card__location, .s-item__itemLocation')
        // textContent runs "Located in United States" into the seller name, so read rendered lines.
        || ((card.innerText || '').split('\n').map(s => s.trim())
          .find(s => /^(?:Located in|from) [A-Z]/.test(s)) || '').replace(/^(?:Located in|from) /, ''),
      shipping: txt('.s-item__shipping, .s-card__logisticsCost')
        || (all.match(/Free (?:shipping|delivery)|\+?\$[\d,.]+ (?:shipping|delivery)|Local Pickup|Freight|Pickup only/i) || [''])[0],
      bids: bids ? +bids : null,
      bestOffer: /or Best Offer/i.test(all),
      binFlag: /Buy It Now/i.test(all),
      condition: /Pre-?Owned|Used/i.test(all) ? 'used' : /Brand New/i.test(all) ? 'new' : '',
    });
  }
  return [...seen.values()];
};

async function grab(page, url) {
  try {
    const r = await page.goto(url, { waitUntil: 'domcontentloaded' });
    if (!r || r.status() >= 400) return [];
    await page.waitForTimeout(2000);
    // Thumbnails are IntersectionObserver-lazy: walk the whole page or they stay placeholders.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight && y < 90000; y += 1100) {
        window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(700);
    return await page.evaluate(EXTRACT);
  } catch { return []; }
}

export const meta = { id: 'ebay', label: 'eBay', kind: 'marketplace' };

export async function scan({ deep = false, onProgress = () => {} } = {}) {
  await prime('ebay', 'https://www.ebay.com/');
  const out = [];
  const queries = deep ? QUERIES_DEEP : QUERIES_QUICK;
  const sch = (nkw, cat, sop) =>
    `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(nkw)}&_sacat=${cat}&_sop=${sop}&_ipg=240`;
  const tasks = [
    // The whole Stage Illusion category, via search so we get sale signals.
    { u: sch('illusion', CAT_STAGE, 10), boost: 26, label: 'Stage Illusion · newest' },
    // _sop=16 is "price + shipping: highest first" — the big boxes float to the top.
    { u: sch('illusion', CAT_STAGE, 16), boost: 26, label: 'Stage Illusion · highest price' },
    { u: sch('magic', CAT_STAGE, 10), boost: 26, label: 'Stage Illusion · magic' },
    // Dave's own search: every category, highest price first. Catches illusions
    // listed outside 14014 (Collectibles, Theater props, Business & Industrial).
    { u: sch('magic stage illusions', 0, 16), boost: 14, label: 'magic stage illusions · highest price' },
    ...queries.map(q => ({ u: sch(q, CAT_MAGIC, 10), boost: 8, label: q })),
  ];
  await withPage(async page => {
    for (const [i, t] of tasks.entries()) {
      onProgress({ source: 'ebay', step: i + 1, total: tasks.length, label: t.label });
      for (const it of await grab(page, t.u)) {
        const saleType = it.bids != null ? 'auction' : it.binFlag || it.bestOffer ? 'bin' : 'bin';
        out.push({
          ...it, price: money(it.priceText), source: 'ebay', sourceLabel: 'eBay',
          boost: t.boost, saleType,
          // A live auction's current bid is not the price you will pay.
          priceIsFirm: saleType !== 'auction',
          offer: 'listing', buyable: true,
        });
      }
    }
  });
  return { items: out, status: out.length ? 'ok' : 'empty', note: '' };
}

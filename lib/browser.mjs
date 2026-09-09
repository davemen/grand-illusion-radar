import { chromium } from 'playwright';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
let browser = null, ctx = null;
const primed = new Set();

export async function getContext() {
  if (ctx) return ctx;
  browser = await chromium.launch({
    headless: true, channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-dev-shm-usage'],
  });
  ctx = await browser.newContext({
    userAgent: UA, viewport: { width: 1512, height: 950 }, locale: 'en-US',
    timezoneId: 'America/Chicago',
    extraHTTPHeaders: { 'accept-language': 'en-US,en;q=0.9' },
  });
  // Hide the automation tell that trips Akamai/PerimeterX.
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  });
  ctx.setDefaultNavigationTimeout(45000);
  return ctx;
}

/** eBay 403s any first request straight to /sch/. Touch the homepage to earn cookies. */
export async function prime(host, url) {
  if (primed.has(host)) return;
  const c = await getContext();
  const p = await c.newPage();
  try { await p.goto(url, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2200); primed.add(host); }
  catch { /* priming is best-effort */ }
  finally { await p.close(); }
}

export async function withPage(fn) {
  const c = await getContext();
  const p = await c.newPage();
  // Block heavy assets we never read — roughly halves scan time.
  await p.route('**/*', r => ['font', 'media', 'stylesheet'].includes(r.request().resourceType())
    ? r.abort() : r.continue());
  try { return await fn(p); } finally { await p.close(); }
}

export async function closeBrowser() {
  try { await browser?.close(); } catch {}
  browser = null; ctx = null; primed.clear();
}

export const money = t => {
  if (!t) return null;
  const m = String(t).replace(/,/g, '').match(/\$\s?([\d]+(?:\.\d{2})?)/);
  return m ? parseFloat(m[1]) : null;
};

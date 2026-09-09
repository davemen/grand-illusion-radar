import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true, channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1500, height: 1150 }, deviceScaleFactor: 2 });
await p.goto('http://localhost:7777/', { waitUntil: 'networkidle' });
await p.waitForTimeout(2200);
const visible = async () => p.evaluate(() => {
  const vh = innerHeight;
  return [...document.querySelectorAll('.card')]
    .filter(c => { const r = c.getBoundingClientRect(); return r.top < vh && r.bottom > 0; }).length;
});
console.log('LIST view  → cards visible on first screen:', await visible());
await p.screenshot({ path: '/tmp/gir-list.png' });
await p.click('#view .chip[data-v="gallery"]'); await p.waitForTimeout(900);
console.log('GALLERY    → cards visible on first screen:', await visible());
await b.close();

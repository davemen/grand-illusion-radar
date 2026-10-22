// One-time: opens a real Chrome window on the scanner's own profile (data/chrome-profile).
// Sign in to Facebook and solve Alibaba's slider if it shows, then close the window.
// Scans reuse those cookies headlessly. Do not run while a scan is in progress.
import { launchProfile } from '../lib/browser.mjs';

const ctx = await launchProfile(false);
const [first] = ctx.pages();
await (first || await ctx.newPage()).goto('https://www.facebook.com/usedmagicillusions');
await (await ctx.newPage()).goto('https://www.alibaba.com/trade/search?SearchText=stage+magic+illusion+props');
console.log('Sign in / solve the CAPTCHA in the Chrome window, then close it.');
await new Promise(r => ctx.on('close', r));
console.log('Saved. Scans will use this profile.');

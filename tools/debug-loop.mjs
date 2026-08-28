import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
let printed = 0;
page.on('pageerror', (e) => { if (printed++ < 2) console.log('PAGEERROR:\n' + (e.stack ?? String(e)).slice(0, 3000) + '\n---'); });
await page.goto(process.argv[2] ?? 'http://localhost:5199', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(6000);
await browser.close();

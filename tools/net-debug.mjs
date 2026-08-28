import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
const counts = new Map();
page.on('request', (r) => {
  const u = r.url().replace(/^https?:\/\/[^/]+/, '');
  if (u.startsWith('/api')) counts.set(u, (counts.get(u) ?? 0) + 1);
});
await page.goto(process.argv[2] ?? 'http://localhost:5199', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(8000);
console.log([...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([u, n]) => `${n}x ${u}`).join('\n'));
await browser.close();

// Screenshot the page at the top and at every story section (data-shot), plus a full-page
// capture. Usage: node tools/screenshot-scroll.mjs <outdir> [url]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'shots';
const url = process.argv[3] ?? 'http://localhost:5199/';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(process.env.W ?? 1920), height: Number(process.env.H ?? 1080) } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' && !/ERR_NETWORK_CHANGED/.test(m.text())) errors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 200)));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(Number(process.env.WAIT ?? 5000));
await page.screenshot({ path: `${out}/00-stage.png` });
const sections = await page.$$eval('section[data-shot]', (els) => els.map((el) => ({ id: el.getAttribute('data-shot'), top: el.getBoundingClientRect().top + window.scrollY, height: el.getBoundingClientRect().height })));
let i = 1;
for (const s of sections) {
  const ys = s.height > 1400 ? [s.top, s.top + s.height * 0.45, s.top + s.height * 0.8] : [s.top];
  for (const y of ys) {
    await page.evaluate((yy) => { window.__lenis?.scrollTo(yy, { immediate: true, force: true }); window.scrollTo(0, yy); }, y);
    await page.waitForTimeout(1600);
    await page.screenshot({ path: `${out}/${String(i).padStart(2, '0')}-${s.id}.png` });
    i++;
  }
}
await page.evaluate(() => { window.__lenis?.scrollTo(0, { immediate: true, force: true }); window.scrollTo(0, 0); });
await page.waitForTimeout(800);
if (process.env.FULL) await page.screenshot({ path: `${out}/full.png`, fullPage: true });
console.log('sections:', sections.map((s) => `${s.id}@${Math.round(s.top)}`).join(' '));
console.log('errors:', JSON.stringify(errors.slice(0, 6)));
await browser.close();

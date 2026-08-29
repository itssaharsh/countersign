// First-time-user review of the console at desktop and mobile: screenshots per section,
// hover states, and a report of measurable problems (overflow, overlap, clipping, tiny
// text, unnamed controls, small tap targets, heading order).
// Usage: node tools/design-review.mjs <outdir> [url]
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const out = process.argv[2] ?? 'review';
const url = process.argv[3] ?? 'http://localhost:5199/';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const report = {};

const AUDIT = () => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.opacity !== '0' && cs.display !== 'none'; };
  const rect = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; };
  const label = (el) => (el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + ' "' + (el.textContent || '').trim().slice(0, 40).replace(/\s+/g, ' ') + '"');
  const problems = { horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1, clipped: [], overlaps: [], tinyText: [], unnamed: [], smallTargets: [], headings: [] };
  // clipped text: content wider than its box (ignoring intentional scrollers)
  for (const el of document.querySelectorAll('h1,h2,h3,p,.t-giant,.kbd,.eyebrow,.t-tag,.say,.chip')) {
    if (!vis(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') continue;
    if (el.scrollWidth > el.clientWidth + 3 && cs.whiteSpace !== 'nowrap') problems.clipped.push(label(el));
    if (cs.whiteSpace === 'nowrap' && el.scrollWidth > el.clientWidth + 3) problems.clipped.push(label(el) + ' (nowrap)');
  }
  // overlapping text blocks (not ancestor/descendant, same stacking region)
  const blocks = [...document.querySelectorAll('h1,h2,h3,p,.t-giant,.kbd,.transcript,.dock,.hero-title,.slab,.card,.stack-card')].filter(vis).map((el) => ({ el, r: rect(el) }));
  for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) {
    const a = blocks[i], b = blocks[j];
    if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    if (a.el.closest('.stack') && b.el.closest('.stack')) continue; // sticky stack overlaps by design
    const ox = Math.min(a.r.x + a.r.w, b.r.x + b.r.w) - Math.max(a.r.x, b.r.x);
    const oy = Math.min(a.r.y + a.r.h, b.r.y + b.r.h) - Math.max(a.r.y, b.r.y);
    if (ox > 12 && oy > 12 && ox * oy > 900) problems.overlaps.push([label(a.el), label(b.el), Math.round(ox) + 'x' + Math.round(oy)]);
  }
  // tiny text
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const t = walker.currentNode; const el = t.parentElement; if (!el || !t.textContent.trim() || seen.has(el) || !vis(el)) continue;
    seen.add(el); const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 10.5) problems.tinyText.push(label(el) + ' ' + fs + 'px');
  }
  // controls
  for (const el of document.querySelectorAll('button,a,input')) {
    if (!vis(el)) continue;
    const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').trim();
    if (!name) problems.unnamed.push(label(el));
    const r = el.getBoundingClientRect();
    if (innerWidth < 500 && (r.width < 40 || r.height < 32)) problems.smallTargets.push(label(el) + ` ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  problems.headings = [...document.querySelectorAll('h1,h2,h3')].map((h) => h.tagName + ': ' + h.textContent.trim().slice(0, 50));
  return problems;
};

for (const [name, ctx] of [['desktop', { viewport: { width: 1920, height: 1080 } }], ['mobile', { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } }]]) {
  const context = await browser.newContext(ctx);
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_NETWORK_CHANGED/.test(m.text())) errors.push(m.text().slice(0, 160)); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 160)));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(Number(process.env.WAIT ?? 5000));
  await page.screenshot({ path: `${out}/${name}-00-stage.png` });
  const sections = await page.$$eval('section[data-shot]', (els) => els.map((el) => ({ id: el.getAttribute('data-shot'), top: el.getBoundingClientRect().top + window.scrollY, height: el.getBoundingClientRect().height })));
  const audits = { top: await page.evaluate(AUDIT) };
  let i = 1;
  for (const s of sections) {
    const ys = s.height > 1500 ? [s.top, s.top + s.height * 0.5] : [s.top];
    for (const y of ys) {
      await page.evaluate((yy) => { window.__lenis?.scrollTo(yy, { immediate: true, force: true }); window.scrollTo(0, yy); }, y);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${out}/${name}-${String(i).padStart(2, '0')}-${s.id}.png` });
      audits[`${s.id}@${Math.round(y)}`] = await page.evaluate(AUDIT);
      i++;
    }
  }
  if (name === 'desktop') {
    // hover states
    await page.evaluate(() => { window.__lenis?.scrollTo(0, { immediate: true, force: true }); window.scrollTo(0, 0); });
    const pill = page.locator('.btn-pill').first();
    if (await pill.count()) { await pill.scrollIntoViewIfNeeded(); await page.waitForTimeout(600); await pill.hover(); await page.waitForTimeout(500); await page.screenshot({ path: `${out}/${name}-hover-pill.png` }); }
    const card = page.locator('.stack-card').first();
    if (await card.count()) { await card.scrollIntoViewIfNeeded(); await page.waitForTimeout(800); await card.hover(); await page.waitForTimeout(500); await page.screenshot({ path: `${out}/${name}-hover-card.png` }); }
  }
  const summary = {};
  for (const [k, a] of Object.entries(audits)) summary[k] = { horizontalOverflow: a.horizontalOverflow, clipped: a.clipped.length, overlaps: a.overlaps.length, tinyText: a.tinyText.length, unnamed: a.unnamed.length, smallTargets: a.smallTargets.length };
  report[name] = { errors, sections: sections.map((s) => `${s.id}@${Math.round(s.top)}`), summary, audits };
  await context.close();
}
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
for (const [name, r] of Object.entries(report)) {
  console.log(`== ${name}: errors=${r.errors.length} sections=${r.sections.join(' ')}`);
  const totals = { clipped: 0, overlaps: 0, tinyText: 0, unnamed: 0, smallTargets: 0, hOverflow: 0 };
  for (const a of Object.values(r.audits)) { totals.clipped += a.clipped.length; totals.overlaps += a.overlaps.length; totals.tinyText += a.tinyText.length; totals.unnamed += a.unnamed.length; totals.smallTargets += a.smallTargets.length; totals.hOverflow += a.horizontalOverflow ? 1 : 0; }
  console.log('   totals', JSON.stringify(totals));
  const ex = Object.values(r.audits).flatMap((a) => [...a.overlaps.map((o) => 'overlap ' + o.join(' | ')), ...a.clipped.map((c) => 'clipped ' + c), ...a.unnamed.map((u) => 'unnamed ' + u), ...a.smallTargets.map((t) => 'small ' + t), ...a.tinyText.map((t) => 'tiny ' + t)]);
  for (const line of [...new Set(ex)].slice(0, 14)) console.log('   ' + line);
  if (r.errors.length) console.log('   errors:', r.errors.slice(0, 3));
}
await browser.close();

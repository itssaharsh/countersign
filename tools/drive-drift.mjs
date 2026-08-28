// The TOCTOU demo beat: arm the gate, let a "coworker" write matching rows,
// then countersign — and watch the server refuse with a drift report.
import { chromium } from 'playwright';
const dir = process.argv[2] ?? '.';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 160)));
await page.goto('http://localhost:5199', { waitUntil: 'networkidle' });
await page.fill('input[placeholder^="transmit"]', "Process this change request: DELETE FROM users WHERE last_active < '2025-01-01'. Simulate, verify the undo, evaluate policy, then commit.");
await page.click('button:has-text("SEND")');
await page.waitForSelector('text=HUMAN GATE', { timeout: 240000 });
console.log('gate armed');
await page.waitForTimeout(600);
// The coworker strikes: 40 new rows that match the doomed predicate.
const r = await fetch('http://127.0.0.1:8977/admin/drift', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: 40 }) });
console.log('drift injected:', await r.text());
await page.waitForTimeout(400);
await page.screenshot({ path: `${dir}/drift-armed.png` });
// Countersign anyway — the server must refuse.
await page.click('button:has-text("COUNTERSIGN & COMMIT")');
await page.waitForSelector('text=/REFUSED|drift|void/i', { timeout: 120000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${dir}/drift-refused.png` });
console.log('REFUSAL CAPTURED');
await browser.close();

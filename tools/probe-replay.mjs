// Diagnostic: replay the recorded real-model stream, report whether the gate opened,
// optionally countersign it (CLICK=1) and report the scene that follows.
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://localhost:5199/?replayEvents=/fixtures/real-run.jsonl&replay=/fixtures/state-investigating.json&replayAfter=/fixtures/state-witnessing.json';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => logs.push('pageerror: ' + String(e).slice(0, 200)));
const phaseOf = async () => ((await page.locator('.overlay').innerText().catch(() => '')).match(/\b(idle|investigating|deciding|witnessing)\b/) ?? [''])[0];
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(Number(process.env.WAIT ?? 9000));
const btn = page.locator('button.tbtn', { hasText: /countersign|restore/i }).first();
const gate = await btn.isVisible().catch(() => false);
const hud = await page.locator('.overlay').innerText().catch(() => '');
console.log('gate button visible:', gate, '| phase text:', await phaseOf());
const m = hud.match(/(commit the change|fire the verified undo)[^\n]*\n[^\n]*/); if (m) console.log('gate line:', m[0].replace(/\n/g, ' | '));
if (process.env.CLICK && gate) {
  console.log('countersign enabled:', await btn.isEnabled());
  await btn.click({ force: true });
  await page.waitForTimeout(Number(process.env.AFTER ?? 7000));
  console.log('after countersign → phase:', await phaseOf(), '| receipt visible:', await page.locator('.slab').isVisible().catch(() => false));
}
if (logs.length) console.log('errors:', logs.slice(0, 5));
if (process.env.DUMP) console.log(hud.slice(-600));
if (process.argv[3]) await page.screenshot({ path: process.argv[3] });
await browser.close();

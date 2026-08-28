// Full operator run: order -> gate -> approve -> witnessing. Screenshots each phase.
import { chromium } from 'playwright';
const dir = process.argv[2] ?? '.';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 160)));
await page.goto('http://localhost:5199', { waitUntil: 'networkidle' });
await page.fill('input[placeholder^="transmit"]', "Process this change request: DELETE FROM users WHERE last_active < '2025-01-01'. Simulate, verify the undo, evaluate policy, then commit.");
await page.click('button:has-text("SEND")');
console.log('order transmitted');
// Gemini free tier is 5 req/min — on a stream error, nudge the agent to continue.
for (let attempt = 0; attempt < 5; attempt++) {
  try {
    await page.waitForSelector('text=HUMAN GATE', { timeout: 90000 });
    break;
  } catch {
    const errVisible = await page.locator('text=stream error').first().isVisible().catch(() => false);
    console.log(`gate not yet (attempt ${attempt + 1}); stream error visible: ${errVisible} — waiting out quota + nudging`);
    await page.waitForTimeout(45000);
    await page.fill('input[placeholder^="transmit"]', 'Continue: the simulation is done — proceed to commit_change with the latest simulation_id and undo_token.');
    await page.click('button:has-text("SEND")');
  }
}
await page.waitForSelector('text=HUMAN GATE', { timeout: 120000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${dir}/phase-deciding.png` });
console.log('gate armed — countersigning…');
await page.click('button:has-text("COUNTERSIGN & COMMIT")');
await page.waitForSelector('text=EXECUTION LEDGER', { timeout: 300000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${dir}/phase-witnessing.png` });
console.log('WITNESSING captured');
await browser.close();

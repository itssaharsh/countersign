// The "survives reconnects" beat: order transmitted, page killed mid-run,
// reload re-attaches to the live turn and the gate still arms.
import { chromium } from 'playwright';
const dir = process.argv[2] ?? '.';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto('http://localhost:5199', { waitUntil: 'networkidle' });
await page.fill('input[placeholder^="transmit"]', "Process this change request: DELETE FROM users WHERE last_active < '2025-01-01'. Simulate, verify the undo, evaluate policy, then commit.");
await page.click('button:has-text("SEND")');
console.log('order transmitted; killing the page mid-investigation…');
await page.waitForTimeout(3500); // mid-simulation
await page.reload({ waitUntil: 'networkidle' });
console.log('page reloaded');
const resumed = await page.waitForSelector('text=reconnected to running turn', { timeout: 20000 }).then(() => true).catch(() => false);
console.log('resume banner:', resumed);
await page.screenshot({ path: `${dir}/reconnect-resumed.png` });
const gate = await page.waitForSelector('text=HUMAN GATE', { timeout: 240000 }).then(() => true).catch(() => false);
console.log('gate after reconnect:', gate);
await page.waitForTimeout(600);
await page.screenshot({ path: `${dir}/reconnect-gate.png` });
await browser.close();
process.exit(gate ? 0 : 1);

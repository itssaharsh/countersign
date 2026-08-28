// Drive the console like an operator: transmit the order, wait for the gate, screenshot.
import { chromium } from 'playwright';
const OUT = process.argv[2] ?? 'deciding.png';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 200)));
await page.goto('http://localhost:5199', { waitUntil: 'networkidle' });
await page.fill('input[placeholder^="transmit"]', "Process this change request: DELETE FROM users WHERE last_active < '2025-01-01'. Simulate, verify the undo, evaluate policy, then commit.");
await page.click('button:has-text("SEND")');
console.log('order transmitted; waiting for the gate…');
try {
  await page.waitForSelector('text=HUMAN GATE', { timeout: 240000 });
  console.log('GATE MATERIALIZED');
  await page.waitForTimeout(1200);
} catch {
  console.log('gate did not appear in 240s — capturing current state');
}
await page.screenshot({ path: OUT });
await browser.close();

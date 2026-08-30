// The operator journey, driven against the live stack and screenshotted beat by
// beat: cold open, investigating, deciding, witnessing.
//
// Retargeted from the v3 console this file used to drive. Every selector in the
// old version (`input[placeholder^="transmit"]`, `text=HUMAN GATE`,
// `text=EXECUTION LEDGER`, a COUNTERSIGN button that took a click) belonged to
// markup that no longer exists. The current console is DESIGN.md's: one input
// (#change-sql), a ledger, and a countersign control that takes a 1200ms hold —
// so this drives a hold, not a click, and fails loudly if the control never
// materialises rather than clicking something that happens to match.
//
// This is a REAL run: it sends an order to the agent on TrueForge and it
// commits rows in the live estate. Reseed first, and reseed after.
//
//   curl -sX POST 127.0.0.1:8977/admin/reseed
//   node tools/walkthrough.mjs docs/screenshots
//
// waitUntil is 'domcontentloaded', never 'networkidle': the dev server proxies
// /api/* to the harness, and the console polls /state every 1.5s, so the network
// is never idle and the first shot would never land.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const dir = process.argv[2] ?? '.';
const url = process.argv[3] ?? 'http://localhost:5199/';
const ORDER =
  "Process this change request: DELETE FROM users WHERE last_active < '2025-01-01'. " +
  'Simulate, verify the undo, evaluate policy, then commit.';

// The agent is a real model behind a rate-limited key. Investigation has been
// measured at 20–40s and the commit at 2–11s; these are ceilings, not estimates.
const INVESTIGATE_MS = 300_000;
const COMMIT_MS = 240_000;

mkdirSync(dir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${String(e).slice(0, 200)}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });

const shot = async (name, ms = 600) => {
  await page.waitForTimeout(ms);
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
  console.log('shot', name);
};

await page.goto(url, { waitUntil: 'domcontentloaded' });
// The cold open is only the cold open if the engine holds no simulation. Say so
// rather than screenshotting a leftover receipt and calling it state 1.
await page.waitForTimeout(2500);
if (!(await page.locator('.cover').count())) {
  console.error('not a cold open — the engine still holds a simulation. Reseed and re-run:');
  console.error('  curl -sX POST 127.0.0.1:8977/admin/reseed');
  await browser.close();
  process.exit(1);
}
await shot('state-1-empty', 300);

await page.fill('#change-sql', ORDER);
await page.click('.submit-go');

// INVESTIGATING: the transcript is the only thing moving until the tool returns.
await page.waitForSelector('.tx-tool', { timeout: 60_000 });
await shot('state-2-investigating', 2500);

// DECIDING: the ledger lands, then TrueForge pauses on commit_change and the
// countersign control materialises. Waiting on the control, not on the ledger,
// is the real gate condition.
await page.waitForSelector('.ledger', { timeout: INVESTIGATE_MS });
await page.waitForSelector('.hold', { timeout: INVESTIGATE_MS });
await shot('state-3-deciding', 1200);

// The hold: 1200ms of sustained intent, with a margin for a slow frame loop.
const hold = page.locator('.hold');
const box = await hold.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.waitForTimeout(1800);
await page.mouse.up();

// WITNESSING: the receipt prints at 18ms a line.
await page.waitForSelector('.receipt', { timeout: COMMIT_MS });
await page.waitForFunction(() => document.querySelector('.receipt')?.dataset.printing === 'false', null, { timeout: 60_000 });
await shot('state-4-witnessing', 800);

// The collapsed SET NULL block is part of the record: capture it open as well,
// because that is the state a judge reaches by clicking it.
const group = page.locator('.receipt-toggle');
if (await group.count()) {
  await group.click();
  await shot('state-4-witnessing-expanded', 400);
}

console.log(errors.length ? `console errors: ${JSON.stringify(errors, null, 1)}` : 'console errors: none');
await browser.close();

// The two screens the live walkthrough cannot reach: REFUSED (state 5b) and
// STALE (state 6). Both are replay, both need no key and no engine.
//
// This used to shoot DECIDING through the replay fixtures. tools/walkthrough.mjs
// now reaches DECIDING against the real model, in the real console, so that shot
// is a live one and this tool takes the two that are not:
//
//   5b · REFUSED   an approval whose simulation this console has never loaded.
//                  Replay the recorded events with no /state behind them: the
//                  countersign control is absent and Deny is the only offer.
//   6  · STALE     DECIDING, left alone until the 120s freshness window closes.
//                  The countdown appears at 30s remaining, so this waits in real
//                  time. There is no way to hurry it that would still be true.
//
// Replay anchors freshness to page load only when the recorded measurement is
// more than ten minutes old (docs/DEMO-STATES.md §6). Re-record the fixtures and
// run this straight away and every shot reads STALE.
//
// Usage: node tools/shot-gate.mjs [out-dir] [base-url]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const dir = process.argv[2] ?? 'docs/screenshots';
const base = (process.argv[3] ?? 'http://localhost:5199').replace(/\/$/, '');
mkdirSync(dir, { recursive: true });

const browser = await chromium.launch();
// Headless Chromium reports prefers-color-scheme: dark; docs/ is the light ground.
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
const errors = [];

const shoot = async (page, name) => {
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
  console.log('shot', name);
};

// ── 5b · REFUSED ─────────────────────────────────────────────────────────────
{
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`refused: ${String(e).slice(0, 160)}`));
  await page.goto(`${base}/?replayEvents=/fixtures/real-run.jsonl`, { waitUntil: 'domcontentloaded' });
  // The gate arrives when the recorded stream reaches tool.approval_required.
  await page.waitForSelector('.gate-note', { timeout: 60_000 });
  await page.waitForFunction(
    () => /missing its evidence|missing /.test(document.querySelector('.gate-note')?.textContent ?? ''),
    null, { timeout: 60_000 },
  );
  // The whole point of the screen: there is no control to press.
  if (await page.locator('.hold').count()) throw new Error('a countersign control exists on the refused screen');
  await shoot(page, 'state-5-refused');
  await page.close();
}

// ── 6 · STALE, and the countdown on the way to it ────────────────────────────
{
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`stale: ${String(e).slice(0, 160)}`));
  await page.goto(`${base}/?replayEvents=/fixtures/real-run.jsonl&replay=/fixtures/state-investigating.json`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.hold', { timeout: 60_000 });

  // The countdown is rendered only inside the last 30 seconds.
  await page.waitForSelector('.gate-countdown', { timeout: 120_000 });
  await shoot(page, 'state-6-countdown');

  // Then the control withdraws. Waiting on its absence is the assertion.
  await page.waitForFunction(() => !document.querySelector('.hold'), null, { timeout: 90_000 });
  await shoot(page, 'state-6-stale');
  await page.close();
}

console.log(errors.length ? `page errors: ${JSON.stringify(errors, null, 1)}` : 'page errors: none');
await browser.close();

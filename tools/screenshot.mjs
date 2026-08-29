// Screenshot the operator console at the two viewports the console is designed
// for: 1920x1080 and 390x844 (DESIGN.md §8 — responsive to 390px, and the gate
// bar stays fixed to the bottom there).
//
// Retargeted from the deleted v5 scroll story, which keyed off section[data-shot]
// and the 3D stage canvas. That markup no longer exists; the artifact is the
// console (§0).
//
// waitUntil is 'domcontentloaded', never 'networkidle': the console proxies
// /api/* to the harness, and a proxied request to a service that is down hangs
// until the proxy's timeout, so networkidle never fires and the shot never lands.
//
// Usage: node tools/screenshot.mjs <out-prefix-or-dir> [url]
//   node tools/screenshot.mjs shots/witnessing 'http://localhost:5252/?replay=/fixtures/state-witnessing.json'
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const VIEWPORTS = [
  ['1920x1080', { width: 1920, height: 1080 }],
  ['390x844', { width: 390, height: 844 }],
];

const outArg = process.argv[2] ?? 'shot';
const url = process.argv[3] ?? 'http://localhost:5199/';
const prefix = outArg.endsWith('/') ? `${outArg}shot` : outArg.replace(/\.png$/, '');
mkdirSync(dirname(`${prefix}-x.png`), { recursive: true });

const browser = await chromium.launch();
const errors = [];

for (const [name, viewport] of VIEWPORTS) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${name}] ${m.text().slice(0, 200)}`); });
  page.on('pageerror', (e) => errors.push(`[${name}] pageerror: ${String(e).slice(0, 200)}`));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // The console is fed by a 1500ms poll of /state (or a replay fixture) and the
  // receipt prints at 18ms a line, so give it a beat to settle rather than
  // waiting on the network.
  await page.waitForTimeout(Number(process.env.WAIT ?? 4000));
  await page.screenshot({ path: `${prefix}-${name}.png`, fullPage: process.env.FULL_PAGE === '1' });
  console.log(`wrote ${prefix}-${name}.png`);
  await context.close();
}

console.log('errors:', JSON.stringify(errors.slice(0, 8), null, 1));
await browser.close();

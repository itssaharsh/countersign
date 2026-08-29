// Replay a recorded stream through the console and dump its debug console lines.
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('console', (m) => { const t = m.text(); if (t.includes('[gate-debug]') || m.type() === 'error') console.log('CONSOLE:', t.slice(0, 400)); });
await page.goto(process.argv[2] ?? 'http://localhost:5199/?replayEvents=/fixtures/real-run.jsonl', { waitUntil: 'networkidle' });
await page.waitForTimeout(10000);
const gate = await page.locator('text=HUMAN GATE').first().isVisible().catch(() => false);
const phase = await page.locator('header').innerText().catch(() => '');
console.log('gate visible:', gate, '| header:', phase.replace(/\n/g, ' ').slice(0, 120));
await page.screenshot({ path: process.argv[3] ?? 'probe-replay.png' });
await browser.close();

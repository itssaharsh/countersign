// Screenshot the DECIDING scene after the replay has fully streamed (title settled).
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto('http://localhost:5199/?replayEvents=/fixtures/real-run.jsonl&replay=/fixtures/state-investigating.json', { waitUntil: 'networkidle' });
await page.waitForTimeout(7000);
await page.screenshot({ path: process.argv[2] ?? 'gate.png' });
await browser.close();

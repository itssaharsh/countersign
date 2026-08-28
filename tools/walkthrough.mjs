// The complete operator journey, screenshotted beat by beat.
import { chromium } from 'playwright';
const dir = process.argv[2] ?? '.';
const shot = async (page, name, ms = 800) => { await page.waitForTimeout(ms); await page.screenshot({ path: `${dir}/${name}.png` }); console.log('📸', name); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto('http://localhost:5199', { waitUntil: 'networkidle' });
await shot(page, 'walk-1-idle', 500);

// Beat 1: transmit the order (a migration PR is the origin)
await page.fill('input[placeholder^="transmit"]', 'Process migration PR #4 in itssaharsh/countersign: simulate it, verify the undo, evaluate policy, then commit and post the receipt.');
await shot(page, 'walk-2-order-typed', 300);
await page.click('button:has-text("SEND")');

// Beat 2: investigation streams in (PR fetch -> cascade measurement)
await page.waitForSelector('text=BLAST RADIUS', { timeout: 120000 });
await shot(page, 'walk-3-investigating', 1500);

// Beat 3: the gate materializes on the real tool.approval_required
await page.waitForSelector('text=HUMAN GATE', { timeout: 240000 });
await shot(page, 'walk-4-gate-armed', 900);

// Beat 4: countersign
await page.click('button:has-text("COUNTERSIGN & COMMIT")');
await page.waitForSelector('text=EXECUTION LEDGER', { timeout: 240000 });
await shot(page, 'walk-5-witnessing', 2500);

// Beat 5: order the undo (also gated)
await page.fill('input[placeholder^="transmit"]', 'Now fire the undo for that commit.');
await page.click('button:has-text("SEND")');
await page.waitForSelector('text=HUMAN GATE', { timeout: 240000 });
await shot(page, 'walk-6-undo-gate', 900);
await page.click('button:has-text("COUNTERSIGN & COMMIT")');
await page.waitForSelector('text=restored', { timeout: 240000 });
await shot(page, 'walk-7-restored', 1500);

await browser.close();
console.log('walkthrough complete');

// Phase 4 verification: CV timeline, ⌘K palette, upgraded arc visuals, dark contrast.
import { chromium } from 'playwright';

const base = 'http://localhost:4321';
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => m.type() === 'error' && errors.push(`[console] ${m.text()}`));
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

// CV page
await page.goto(`${base}/cv`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1400);
await page.screenshot({ path: 'shots/cv-top.png' });
await page.mouse.wheel(0, 1500);
await page.waitForTimeout(1100);
await page.screenshot({ path: 'shots/cv-timeline.png' });
const entries = await page.evaluate(() => document.querySelectorAll('.tl-entry').length);
console.log('timeline entries:', entries, entries >= 19 ? 'PASS' : 'FAIL');

// ⌘K open, filter, navigate
await page.keyboard.press('Control+k');
await page.waitForTimeout(400);
const open1 = await page.evaluate(() => !document.getElementById('cmdk').classList.contains('hidden'));
console.log('cmdk opens via Ctrl+K:', open1 ? 'PASS' : 'FAIL');
await page.keyboard.type('email');
await page.waitForTimeout(300);
await page.screenshot({ path: 'shots/cmdk.png' });
const visCount = await page.evaluate(() => document.querySelectorAll('.cmdk-item:not(.hidden)').length);
console.log('filter "email" results:', visCount);
await page.keyboard.press('Enter');
await page.waitForTimeout(1200);
console.log('navigated to:', page.url());

// Theme toggle action via palette
await page.keyboard.press('Control+k');
await page.keyboard.type('theme');
await page.waitForTimeout(250);
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
console.log('theme action toggled dark:', isDark ? 'PASS' : 'FAIL');

// Arc visuals (dark, upgraded)
await page.goto(`${base}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
await page.mouse.wheel(0, 2300);
await page.waitForTimeout(1300);
await page.screenshot({ path: 'shots/arc-v2-dark.png' });
await page.mouse.wheel(0, 1400);
await page.waitForTimeout(1200);
await page.screenshot({ path: 'shots/arc-v2-act3.png' });

await browser.close();
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'No console/page errors.');

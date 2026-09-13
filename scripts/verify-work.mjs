// Phase 2 verification: Work list + case detail screenshots, console errors.
import { chromium } from 'playwright';

const base = 'http://localhost:4321';
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => m.type() === 'error' && errors.push(`[console] ${m.text()}`));
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

await page.goto(`${base}/work`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'shots/work-top.png' });
await page.mouse.wheel(0, 1700);
await page.waitForTimeout(1000);
await page.screenshot({ path: 'shots/work-research.png' });
await page.mouse.wheel(0, 1800);
await page.waitForTimeout(1000);
await page.screenshot({ path: 'shots/work-index.png' });

await page.goto(`${base}/work/email-agent`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'shots/case-top.png' });
await page.mouse.wheel(0, 1400);
await page.waitForTimeout(900);
await page.screenshot({ path: 'shots/case-body.png' });

await browser.close();
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'No console/page errors.');

// CI 要靠退出码判定成败（GitHub 只在 job 失败时发邮件）。
// 手动跑时行为不变：仍然打印同样的结果，只是多设一个退出码。
process.exitCode = errors.length ? 1 : 0;

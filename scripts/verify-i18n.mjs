// Phase 5 verification: zh routes, language toggle, auto-detection, hreflang.
import { chromium } from 'playwright';

const base = 'http://localhost:4321';
const errors = [];
const browser = await chromium.launch();

async function check(name, ok) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); return ok; }

// 1. zh pages render Chinese
let page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
for (const [path, needle] of [
  ['/zh/', '从地图到模型'],
  ['/zh/work/', '案例研究'],
  ['/zh/work/email-agent/', '智能邮件助手'],
  ['/zh/cv/', '个人简历'],
  ['/zh/photography/', '镜头之下'],
]) {
  const resp = await page.goto(base + path, { waitUntil: 'networkidle', timeout: 120000 });
  const html = await page.content();
  await check(`${path} 200+zh content`, resp.status() === 200 && html.includes(needle));
}

// hreflang present
const hreflangs = await page.evaluate(() =>
  [...document.querySelectorAll('link[rel=alternate][hreflang]')].map((l) => l.getAttribute('hreflang'))
);
await check('hreflang alternates (en/zh-CN/x-default)', hreflangs.includes('en') && hreflangs.includes('zh-CN') && hreflangs.includes('x-default'));

// 2. Language toggle zh→en and back
await page.goto(`${base}/zh/work/`, { waitUntil: 'networkidle' });
await page.click('#lang-toggle');
await page.waitForTimeout(1200);
await check('toggle zh→en lands on /work', page.url().endsWith('/work') || page.url().endsWith('/work/'));
const pref = await page.evaluate(() => localStorage.getItem('lang'));
await check('toggle stored explicit pref', pref === 'en');
await page.click('#lang-toggle');
await page.waitForTimeout(1200);
await check('toggle en→zh lands on /zh/work', page.url().includes('/zh/work'));
await page.close();

// 3. Auto-detection: zh browser, no pref → redirected to /zh/
const zhCtx = await browser.newContext({ locale: 'zh-CN', viewport: { width: 1440, height: 900 } });
const zhPage = await zhCtx.newPage();
await zhPage.goto(`${base}/`, { waitUntil: 'networkidle' });
await check('zh-CN browser auto-redirects / → /zh/', zhPage.url().includes('/zh'));
await zhPage.screenshot({ path: 'shots/zh-home.png' });

// 4. Explicit en pref blocks redirect
await zhPage.evaluate(() => localStorage.setItem('lang', 'en'));
await zhPage.goto(`${base}/`, { waitUntil: 'networkidle' });
await zhPage.waitForTimeout(800);
await check('stored en pref blocks auto-redirect', !zhPage.url().includes('/zh'));
await zhCtx.close();

// 5. en browser never redirected
const enCtx = await browser.newContext({ locale: 'en-US', viewport: { width: 1440, height: 900 } });
const enPage = await enCtx.newPage();
await enPage.goto(`${base}/`, { waitUntil: 'networkidle' });
await enPage.waitForTimeout(800);
await check('en-US browser stays on /', !enPage.url().includes('/zh'));
await enCtx.close();

// zh screenshots
const shot = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await shot.goto(`${base}/zh/work/`, { waitUntil: 'networkidle' });
await shot.waitForTimeout(1300);
await shot.screenshot({ path: 'shots/zh-work.png' });
await shot.goto(`${base}/zh/cv/`, { waitUntil: 'networkidle' });
await shot.waitForTimeout(1300);
await shot.screenshot({ path: 'shots/zh-cv.png' });
await shot.close();

await browser.close();
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'No page errors.');

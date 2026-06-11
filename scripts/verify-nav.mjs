// Regression test for View Transitions navigation: real link clicks,
// asserting .reveal elements end visible (opacity ~1) at every step.
import { chromium } from 'playwright';

const base = 'http://localhost:4321';
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => m.type() === 'error' && errors.push(`[console] ${m.text()}`));
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

async function assertVisible(label) {
  await page.waitForTimeout(1300);
  const result = await page.evaluate(() => {
    const els = [...document.querySelectorAll('.reveal')].slice(0, 8);
    const headline = document.querySelector('h1, h2');
    const headlineOk = headline ? parseFloat(getComputedStyle(headline).opacity) > 0.9 : true;
    const bad = els.filter((el) => {
      const r = el.getBoundingClientRect();
      const inView = r.top < innerHeight && r.bottom > 0;
      return inView && parseFloat(getComputedStyle(el).opacity) < 0.9;
    });
    return { total: els.length, badCount: bad.length, headlineOk };
  });
  const ok = result.badCount === 0 && result.headlineOk;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label} (reveals checked: ${result.total}, invisible-in-view: ${result.badCount}, headline: ${result.headlineOk})`);
  return ok;
}

let allOk = true;
await page.goto(base, { waitUntil: 'networkidle' });
allOk &= await assertVisible('initial /');

// home → work
await page.click('nav a[href="/work"]');
allOk &= await assertVisible('/ → /work');

// work → case
await page.click('a[href="/work/email-agent"]');
allOk &= await assertVisible('/work → /work/email-agent');

// case → back to work (the bug path)
await page.click('main a[href="/work"]');
allOk &= await assertVisible('/work/email-agent → /work  (bug path)');

// work → another case → next-case nav → work again
await page.click('a[href="/work/gisphere-llm"]');
allOk &= await assertVisible('/work → /work/gisphere-llm');
await page.click('main a[href="/work"]');
allOk &= await assertVisible('gisphere-llm → /work (repeat)');

// work → home → work (round trip)
await page.click('nav a[href="/"]');
allOk &= await assertVisible('/work → /');
await page.click('nav a[href="/work"]');
allOk &= await assertVisible('/ → /work (round trip)');

await page.screenshot({ path: 'shots/nav-final-work.png' });
await browser.close();
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'No console/page errors.');
console.log(allOk ? 'ALL NAVIGATION CHECKS PASSED' : 'SOME CHECKS FAILED');

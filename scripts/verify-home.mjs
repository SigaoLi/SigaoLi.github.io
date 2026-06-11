// Phase 1 verification: screenshots + console error collection for the Home page.
import { chromium } from 'playwright';

const base = 'http://localhost:4321';
const errors = [];
const browser = await chromium.launch();

async function newPage(opts = {}) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, ...opts });
  page.on('console', (m) => m.type() === 'error' && errors.push(`[console] ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  return page;
}

// Desktop light
let page = await newPage();
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(2600); // let hero entrance settle
await page.screenshot({ path: 'shots/home-hero.png' });

// Arc narrative mid-scroll (act II)
await page.mouse.wheel(0, 2100);
await page.waitForTimeout(1200);
await page.screenshot({ path: 'shots/home-arc.png' });

// Featured + About
await page.mouse.wheel(0, 2600);
await page.waitForTimeout(1200);
await page.screenshot({ path: 'shots/home-featured.png' });
await page.mouse.wheel(0, 1200);
await page.waitForTimeout(1000);
await page.screenshot({ path: 'shots/home-about.png' });
await page.close();

// Dark mode
page = await newPage({ colorScheme: 'dark' });
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(2600);
await page.screenshot({ path: 'shots/home-hero-dark.png' });
await page.close();

// Mobile
page = await newPage({ viewport: { width: 375, height: 812 } });
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(2600);
await page.screenshot({ path: 'shots/home-mobile.png' });
await page.mouse.wheel(0, 1600);
await page.waitForTimeout(800);
await page.screenshot({ path: 'shots/home-mobile-arc.png' });
await page.close();

// Reduced motion
page = await newPage({ reducedMotion: 'reduce' });
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({ path: 'shots/home-reduced.png' });
await page.close();

// 404
page = await newPage();
const resp = await page.goto(`${base}/no-such-page`, { waitUntil: 'networkidle' });
console.log('404 status:', resp.status());
await page.screenshot({ path: 'shots/404.png' });
await page.close();

await browser.close();
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'No console/page errors.');

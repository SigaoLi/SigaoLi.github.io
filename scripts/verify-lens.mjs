// Phase 3 verification: map, galleries, marker-click scroll, lightbox interactions.
import { chromium } from 'playwright';

const base = 'http://localhost:4321';
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => m.type() === 'error' && errors.push(`[console] ${m.text()}`));
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

await page.goto(`${base}/photography`, { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForTimeout(1800);
await page.screenshot({ path: 'shots/lens-top.png' });

// Click the Japan marker → should scroll to its gallery
await page.click('.map-marker[data-country="japan"]');
await page.waitForTimeout(1600);
await page.screenshot({ path: 'shots/lens-japan.png' });
const nearJapan = await page.evaluate(() => {
  const el = document.getElementById('gallery-japan');
  return el ? Math.abs(el.getBoundingClientRect().top - 80) < 120 : false;
});
console.log('marker scroll to gallery:', nearJapan ? 'PASS' : 'FAIL');

// Open lightbox on first photo
await page.click('#gallery-japan figure');
await page.waitForTimeout(900);
const lbOpen = await page.evaluate(() => !document.getElementById('lightbox').classList.contains('hidden'));
console.log('lightbox opens:', lbOpen ? 'PASS' : 'FAIL');
await page.screenshot({ path: 'shots/lens-lightbox.png' });

// Arrow navigation + Esc
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(500);
const counter1 = await page.textContent('#lb-caption');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
const lbClosed = await page.evaluate(() => document.getElementById('lightbox').classList.contains('hidden'));
console.log('arrow nav counter:', counter1, '| esc closes:', lbClosed ? 'PASS' : 'FAIL');

// Scroll-lock released?
const overflowOk = await page.evaluate(() => document.body.style.overflow === '');
console.log('scroll lock released:', overflowOk ? 'PASS' : 'FAIL');

// Mobile layout
const m = await browser.newPage({ viewport: { width: 375, height: 812 } });
await m.goto(`${base}/photography`, { waitUntil: 'networkidle', timeout: 120000 });
await m.waitForTimeout(1500);
await m.screenshot({ path: 'shots/lens-mobile.png' });
await m.close();

await browser.close();
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'No console/page errors.');

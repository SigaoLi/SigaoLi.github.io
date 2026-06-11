// Phase 0 screenshot helper: full-page captures for design review.
import { chromium } from 'playwright';

const [url = 'http://localhost:4321/design-compare', out = 'shots/design-compare.png'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: 'networkidle' });
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(`saved ${out}`);

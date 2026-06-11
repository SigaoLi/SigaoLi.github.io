// Internal link integrity check over the dist/ build output.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const htmlFiles = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.html')) htmlFiles.push(p);
  }
})(DIST);

const broken = [];
let checked = 0;

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const hrefs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  for (const href of hrefs) {
    if (/^(https?:|mailto:|data:|#|\/\/)/.test(href)) continue;
    const clean = href.split('#')[0].split('?')[0];
    if (!clean || !clean.startsWith('/')) continue;
    checked++;
    const candidates = [
      join(DIST, clean),
      join(DIST, clean, 'index.html'),
      join(DIST, clean.replace(/\/$/, '') + '.html'),
    ];
    if (!candidates.some((c) => existsSync(c))) {
      broken.push(`${file.replace(/\\/g, '/')} → ${href}`);
    }
  }
}

const unique = [...new Set(broken)];
console.log(`checked ${checked} internal refs across ${htmlFiles.length} html files`);
console.log(unique.length ? `BROKEN (${unique.length}):\n${unique.join('\n')}` : 'no broken internal links');

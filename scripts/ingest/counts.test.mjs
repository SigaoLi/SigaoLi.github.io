import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { syncReadme } from './counts.mjs';

test('替换照片总数与国家数', () => {
  const src = '- **Dotted world map** — land sampled from Natural Earth, with 78 GPS-extracted photo footprints across 6 countries; click a marker\n';
  const out = syncReadme(src, { photos: 81, countries: 7 });
  assert.ok(out.includes('81 GPS-extracted photo footprints across 7 countries'));
  assert.ok(out.includes('click a marker'), '句子其余部分必须原样保留');
});

test('数字没变时原样返回', () => {
  const src = 'with 78 GPS-extracted photo footprints across 6 countries;';
  assert.equal(syncReadme(src, { photos: 78, countries: 6 }), src);
});

test('找不到那句话就抛错，而不是静默跳过', () => {
  assert.throws(() => syncReadme('无关内容', { photos: 78, countries: 6 }), /未找到/);
});

test('真实 README 能被匹配到', () => {
  const readme = readFileSync('README.md', 'utf8');
  assert.doesNotThrow(() => syncReadme(readme, { photos: 99, countries: 9 }));
});

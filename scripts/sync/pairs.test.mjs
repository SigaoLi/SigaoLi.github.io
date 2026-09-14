import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { listPairs } from './pairs.mjs';

test('枚举出现有的 12 对', () => {
  const p = listPairs();
  assert.equal(p.length, 12, `应为 12 对，实得 ${p.length}`);
});

test('每对都给出中英两侧路径与稳定的键', () => {
  for (const p of listPairs()) {
    assert.ok(p.key && p.en && p.zh, JSON.stringify(p));
    assert.ok(existsSync(p.en), `英文侧不存在: ${p.en}`);
    assert.ok(existsSync(p.zh), `中文侧不存在: ${p.zh}`);
  }
});

test('键用英文侧路径，且正斜杠（跨平台一致）', () => {
  const keys = listPairs().map((p) => p.key);
  assert.ok(keys.includes('src/content/cases/csr-scraper.md'), keys.join(','));
  assert.ok(keys.includes('src/data/cv.json'));
  assert.ok(!keys.some((k) => k.includes('\\')), '键里不该有反斜杠');
});

test('CV 标记为结构化，Markdown 标记为整文件', () => {
  const byKey = Object.fromEntries(listPairs().map((p) => [p.key, p]));
  assert.equal(byKey['src/data/cv.json'].kind, 'cv');
  assert.equal(byKey['src/content/cases/csr-scraper.md'].kind, 'md');
});

test('不把 i18n.ts 与 knowledge/ 纳入', () => {
  const keys = listPairs().map((p) => p.key).join(' ');
  assert.ok(!keys.includes('i18n'), '手写双语，不走机翻');
  assert.ok(!keys.includes('knowledge'), '只有中文，做英文层是新内容不是同步');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPreserved, translate, MODEL_ZH2EN, MODEL_EN2ZH } from './translate.mjs';

const reply = (c) => ({ ok: true, json: async () => ({ choices: [{ message: { content: c } }] }) });

test('两个方向用实测选定的模型', () => {
  assert.equal(MODEL_ZH2EN, 'claude-opus-4-5');
  assert.equal(MODEL_EN2ZH, 'deepseek-v4-pro'); // 信达雅提示词是两轮实验选出来的，不推翻
});

test('不可译字段被改动即判失败', () => {
  const src = 'year: "2025"\nrepoUrl: "https://github.com/a/b"\norder: 4\nvalue: "150"';
  assert.equal(checkPreserved(src, 'year: "2025"\nrepoUrl: "https://github.com/a/b"\norder: 4\nvalue: "150"').ok, true);
  const bad = checkPreserved(src, 'year: "2026"\nrepoUrl: "https://github.com/a/b"\norder: 4\nvalue: "150"');
  assert.equal(bad.ok, false);
  assert.match(bad.missing.join(' '), /2025/);
});

test('URL 被改写即判失败', () => {
  const src = 'repoUrl: "https://github.com/SigaoLi/UB_RA_CSR"';
  assert.equal(checkPreserved(src, 'repoUrl: "https://github.com/SigaoLi/UB-RA-CSR"').ok, false);
});

test('数字丢失即判失败', () => {
  const src = 'metrics:\n  - { label: "reports", value: "150" }';
  assert.equal(checkPreserved(src, 'metrics:\n  - { label: "报告", value: "15" }').ok, false);
});

test('只有可译文字变了则通过', () => {
  const src = 'title: "ESG Report Intelligence"\nyear: "2025"\norder: 4';
  assert.equal(checkPreserved(src, 'title: "ESG 报告智能系统"\nyear: "2025"\norder: 4').ok, true);
});

test('译文通过校验则返回', async () => {
  const src = 'title: "X"\nyear: "2025"';
  const out = await translate(
    { dir: 'en2zh', text: src },
    { fetch: async () => reply('title: "某某"\nyear: "2025"'), base: 'https://x/v1', key: 'k', backoffMs: () => 0 }
  );
  assert.match(out, /某某/);
});

test('译文改坏了不可译字段 → 重试 → 仍坏则抛错', async () => {
  let n = 0;
  const f = async () => { n++; return reply('title: "某某"\nyear: "2099"'); };
  await assert.rejects(
    translate({ dir: 'en2zh', text: 'title: "X"\nyear: "2025"' },
      { fetch: f, base: 'https://x/v1', key: 'k', backoffMs: () => 0 }),
    /校验/
  );
  assert.equal(n, 3, '应当重试满 3 次');
});

test('剥掉代码围栏', async () => {
  const out = await translate(
    { dir: 'zh2en', text: 'title: "某某"' },
    { fetch: async () => reply('```markdown\ntitle: "X"\n```'), base: 'https://x/v1', key: 'k', backoffMs: () => 0 }
  );
  assert.equal(out, 'title: "X"');
});

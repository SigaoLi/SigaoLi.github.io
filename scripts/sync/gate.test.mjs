import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVerdict, isStale, GATE_MODEL } from './gate.mjs';

const reply = (c) => ({ ok: true, json: async () => ({ choices: [{ message: { content: c } }] }) });

test('用的是实测选定的判定模型', () => {
  assert.equal(GATE_MODEL, 'gpt-5.6-sol');
});

test('解析干净的 JSON', () => {
  assert.equal(parseVerdict('{"stale": true, "why": "改了数字"}').stale, true);
  assert.equal(parseVerdict('{"stale": false, "why": "只是措辞"}').stale, false);
});

test('剥掉代码围栏', () => {
  assert.equal(parseVerdict('```json\n{"stale": true, "why": "x"}\n```').stale, true);
});

test('理由里带引号也不崩', () => {
  // 实测模型会输出带「」的中文理由，早前的严格 JSON.parse 在这里挂过
  const v = parseVerdict('{"stale": true, "why": "把「无法」改成了「难以」"}');
  assert.equal(v.stale, true);
});

test('读不出结论就抛错，而不是默默当成 false', () => {
  // 默默 false = 对面悄悄过时，是这里最危险的失败方向
  assert.throws(() => parseVerdict('我看不懂'), /判定/);
});

test('判定为过时', async () => {
  const r = await isStale(
    { dir: 'zh', before: '旧', after: '新', other: 'old english' },
    { fetch: async () => reply('{"stale": true, "why": "x"}'), base: 'https://x/v1', key: 'k', backoffMs: () => 0 }
  );
  assert.equal(r.stale, true);
});

test('失败会重试，第三次成功则返回', async () => {
  let n = 0;
  const f = async () => { n++; return n < 3 ? { ok: false, status: 504, text: async () => 'gw' } : reply('{"stale": false, "why": "x"}'); };
  const r = await isStale({ dir: 'zh', before: 'a', after: 'b', other: 'c' },
    { fetch: f, base: 'https://x/v1', key: 'k', backoffMs: () => 0 });
  assert.equal(n, 3);
  assert.equal(r.stale, false);
});

test('三次都失败则抛错', async () => {
  const f = async () => ({ ok: false, status: 504, text: async () => 'gw' });
  await assert.rejects(
    isStale({ dir: 'zh', before: 'a', after: 'b', other: 'c' },
      { fetch: f, base: 'https://x/v1', key: 'k', backoffMs: () => 0 }),
    /504/
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCaption, writeCaption, translateCountryName } from './caption.mjs';

const reply = (content) => ({
  ok: true,
  json: async () => ({ choices: [{ message: { content } }] }),
});

test('解析干净的 JSON', () => {
  const r = parseCaption('{"alt":"A","altZh":"甲","city":"Xiamen","cityZh":"厦门"}');
  assert.deepEqual(r, { alt: 'A', altZh: '甲', city: 'Xiamen', cityZh: '厦门' });
});

test('剥掉代码围栏', () => {
  const r = parseCaption('```json\n{"alt":"A","altZh":"甲","city":"X","cityZh":"厦"}\n```');
  assert.equal(r.alt, 'A');
});

test('city 截到单个城市名', () => {
  // 实测 opus 会输出 "Xiamen, Fujian" / "福建厦门"
  const r = parseCaption('{"alt":"A","altZh":"甲","city":"Xiamen, Fujian","cityZh":"福建厦门"}');
  assert.equal(r.city, 'Xiamen');
});

test('缺字段就抛错', () => {
  assert.throws(() => parseCaption('{"alt":"A"}'), /缺少字段/);
});

test('不是 JSON 就抛错', () => {
  assert.throws(() => parseCaption('我看不清这张图'), /无法解析/);
});

test('失败会重试，第三次成功则返回', async () => {
  let calls = 0;
  const fakeFetch = async () => {
    calls++;
    if (calls < 3) return { ok: false, status: 504, text: async () => 'gateway timeout' };
    return reply('{"alt":"A","altZh":"甲","city":"X","cityZh":"厦"}');
  };
  const r = await writeCaption(
    { imageB64: 'x', lng: 118, lat: 24, shotAt: '2026-09-09', samples: [] },
    { fetch: fakeFetch, base: 'https://x/v1', key: 'k', backoffMs: () => 0 },
  );
  assert.equal(calls, 3);
  assert.equal(r.alt, 'A');
});

test('三次都失败则抛错并带上最后一次原因', async () => {
  const fakeFetch = async () => ({ ok: false, status: 504, text: async () => 'gateway timeout' });
  await assert.rejects(
    writeCaption(
      { imageB64: 'x', lng: 118, lat: 24, shotAt: '2026-09-09', samples: [] },
      { fetch: fakeFetch, base: 'https://x/v1', key: 'k', backoffMs: () => 0 },
    ),
    /504/,
  );
});

test('新国家的中文名由模型翻译', async () => {
  const fakeFetch = async () => reply('法国');
  const zh = await translateCountryName('France', { fetch: fakeFetch, base: 'https://x/v1', key: 'k', backoffMs: () => 0 });
  assert.equal(zh, '法国');
});

test('国家名翻译会剥掉模型可能加的引号与标点', async () => {
  const fakeFetch = async () => reply('"法国。"\n');
  const zh = await translateCountryName('France', { fetch: fakeFetch, base: 'https://x/v1', key: 'k', backoffMs: () => 0 });
  assert.equal(zh, '法国');
});

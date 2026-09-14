import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toUnits, applyUnit, removeUnit } from './cv-entries.mjs';

const en = () => JSON.parse(readFileSync('src/data/cv.json', 'utf8'));
const zh = () => JSON.parse(readFileSync('src/data/cv.zh.json', 'utf8'));

test('有 id 的区按 id 出单元', () => {
  const u = toUnits(en());
  assert.ok(u['experience:heywhale'], Object.keys(u).slice(0, 8).join(','));
  assert.ok(u['research:ra-nlp']);
  assert.ok(u['current:ebest']);
});

test('无 id 的区按下标出单元', () => {
  const u = toUnits(en());
  assert.ok(u['awards:0']);
  assert.ok(u['certifications:1']);
});

test('skills 与 _note 不出单元', () => {
  const keys = Object.keys(toUnits(en()));
  assert.ok(!keys.some((k) => k.startsWith('skills')), 'skills 中英结构不同，绝不能同步');
  assert.ok(!keys.some((k) => k.startsWith('_note')), '_note 是英文元数据');
});

test('有 id 的各区中英逐条对齐', () => {
  // 这几个区是 id 共用的，两边必须一一对应
  const pick = (cv) => Object.keys(toUnits(cv)).filter((k) => !k.startsWith('awards:') && !k.startsWith('certifications:')).sort();
  assert.deepEqual(pick(en()), pick(zh()), '有 id 的区应逐条对齐');
});

test('certifications 中英不等长，正是管线要补的缺口', () => {
  // 实测：中文 5 条、英文 2 条（多出 PMP / 驾驶证 / CPR·AED）。
  // 「某条只在一边」是设计里明确要处理的情形——翻译补到对面，不是错误。
  // 这条测试钉住现状，免得日后有人误以为两边本该等长而去改逻辑迁就。
  const enKeys = Object.keys(toUnits(en())).filter((k) => k.startsWith('certifications:'));
  const zhKeys = Object.keys(toUnits(zh())).filter((k) => k.startsWith('certifications:'));
  assert.ok(zhKeys.length > enKeys.length, `中文侧证书应多于英文侧，实得 zh ${zhKeys.length} / en ${enKeys.length}`);
  // 公共部分仍按下标对齐
  for (let i = 0; i < enKeys.length; i++) assert.equal(enKeys[i], zhKeys[i]);
});

test('applyUnit 按 id 就地替换，不动别的条目', () => {
  const data = en();
  const before = data.experience.length;
  const out = applyUnit(data, 'experience:heywhale', { id: 'heywhale', title: 'X', org: 'Y', start: '2026-01', end: '2026-04', bullets: [] });
  assert.equal(out.experience.length, before);
  assert.equal(out.experience.find((e) => e.id === 'heywhale').title, 'X');
  assert.equal(data.experience.find((e) => e.id === 'heywhale').title, 'Consulting Project Manager', '不该改动传入对象');
});

test('applyUnit 对不存在的 id 是追加', () => {
  const out = applyUnit(en(), 'experience:brandnew', { id: 'brandnew', title: 'N', org: 'O', start: '2026-05', end: 'present', bullets: [] });
  assert.ok(out.experience.some((e) => e.id === 'brandnew'));
});

test('removeUnit 删掉指定条目', () => {
  const out = removeUnit(en(), 'awards:0');
  assert.equal(out.awards.length, en().awards.length - 1);
});

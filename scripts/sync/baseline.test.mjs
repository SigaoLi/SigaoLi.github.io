import test from 'node:test';
import assert from 'node:assert/strict';
import { hashOf, pairState } from './baseline.mjs';

test('同样的内容得同样的哈希', () => {
  assert.equal(hashOf('abc'), hashOf('abc'));
  assert.notEqual(hashOf('abc'), hashOf('abd'));
});

test('两边都没变', () => {
  const base = { en: hashOf('E'), zh: hashOf('Z') };
  assert.equal(pairState(base, 'E', 'Z').kind, 'unchanged');
});

test('只有中文变了', () => {
  const base = { en: hashOf('E'), zh: hashOf('Z') };
  const s = pairState(base, 'E', 'Z2');
  assert.equal(s.kind, 'one-side');
  assert.equal(s.changed, 'zh');
});

test('只有英文变了', () => {
  const base = { en: hashOf('E'), zh: hashOf('Z') };
  const s = pairState(base, 'E2', 'Z');
  assert.equal(s.kind, 'one-side');
  assert.equal(s.changed, 'en');
});

test('两边都变了', () => {
  const base = { en: hashOf('E'), zh: hashOf('Z') };
  assert.equal(pairState(base, 'E2', 'Z2').kind, 'both');
});

test('没有基线记录的单边内容算新增，不算删除', () => {
  // 关键护栏：刚写好的新文件对面还没有，绝不能误判成「对面被删了」
  assert.equal(pairState(null, 'E', null).kind, 'new');
  assert.equal(pairState(null, null, 'Z').kind, 'new');
});

test('有基线记录而一边消失了，算删除', () => {
  const base = { en: hashOf('E'), zh: hashOf('Z') };
  const s = pairState(base, null, 'Z');
  assert.equal(s.kind, 'deleted');
  assert.equal(s.gone, 'en');
});

test('两边都消失了算彻底删除', () => {
  const base = { en: hashOf('E'), zh: hashOf('Z') };
  assert.equal(pairState(base, null, null).kind, 'gone');
});

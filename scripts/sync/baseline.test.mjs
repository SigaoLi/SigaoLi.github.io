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

test('CRLF 与 LF 视为同一内容', () => {
  // 本仓库 core.autocrlf=true：脚本写出 LF、git checkout 回来是 CRLF。
  // 不归一化的话，同一份内容会因为经手者不同而算出两个哈希，基线随即失效。
  assert.equal(hashOf('a\r\nb\r\n'), hashOf('a\nb\n'));
});

test('末尾换行的有无不算内容变化', () => {
  assert.equal(hashOf('a\nb'), hashOf('a\nb\n'));
  assert.equal(hashOf('a\nb\n'), hashOf('a\nb\n\n'));
});

test('真正的内容差异仍然区分得出来', () => {
  assert.notEqual(hashOf('a\nb\n'), hashOf('a\nc\n'));
  assert.notEqual(hashOf('a\nb\n'), hashOf('a\n b\n'), '行内空白仍是差异');
});

test('换行差异不会让文件对被误判成有改动', () => {
  const base = { en: hashOf('E\nline\n'), zh: hashOf('Z\nline\n') };
  assert.equal(pairState(base, 'E\r\nline\r\n', 'Z\r\nline\r\n').kind, 'unchanged');
});

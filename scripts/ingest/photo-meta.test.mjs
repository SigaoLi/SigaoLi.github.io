import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shotTime } from './photo-meta.mjs';

test('优先用 EXIF 拍摄时间', () => {
  const t = shotTime('whatever.jpg', new Date('2020-05-01T10:00:00Z'));
  assert.equal(t, Date.UTC(2020, 4, 1, 10, 0, 0));
});

test('无 EXIF 时从带下划线的文件名解析', () => {
  assert.equal(shotTime('IMG_20170731_154353.jpg', null), Date.UTC(2017, 6, 31));
});

test('无 EXIF 时从不带下划线的文件名解析', () => {
  assert.equal(shotTime('IMG20260905155409.jpg', null), Date.UTC(2026, 8, 5));
});

test('两种文件名格式排序不会互相颠倒', () => {
  // ASCII 里 '_'(95) > 数字，纯文件名字典序会把 2017 排到 2026 之后
  const a = shotTime('IMG_20170731_154353.jpg', null);
  const b = shotTime('IMG20260905155409.jpg', null);
  assert.ok(a < b, '2017 的照片必须排在 2026 之前');
});

test('完全解析不出时返回 null', () => {
  assert.equal(shotTime('scan-001.jpg', null), null);
});

test('现有 78 个文件名全部可解析', () => {
  const photos = JSON.parse(readFileSync('src/data/photos.json', 'utf8'));
  const bad = [];
  for (const c of photos) {
    for (const it of c.items) if (shotTime(it.src, null) === null) bad.push(`${c.id}/${it.src}`);
  }
  assert.deepEqual(bad, []);
});

test('现有各国顺序等于拍摄时间升序', () => {
  const photos = JSON.parse(readFileSync('src/data/photos.json', 'utf8'));
  for (const c of photos) {
    const ts = c.items.map((i) => shotTime(i.src, null));
    assert.deepEqual(ts, [...ts].sort((a, b) => a - b), `${c.id} 的现有顺序不是时间升序`);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import exifr from 'exifr';
import { listInbox, archiveAndDerive } from './intake.mjs';

const tmp = () => mkdtempSync(join(tmpdir(), 'ingest-'));

/**
 * 造一张 4096x1856 的测试图，**带 EXIF**。
 * 必须带——否则"母版不得残留元数据"那条断言就是空转的：
 * 源图本来就没有元数据的话，输出没有也证明不了剥除生效。
 */
async function fakePhoto(path) {
  const buf = await sharp({
    create: { width: 4096, height: 1856, channels: 3, background: { r: 120, g: 140, b: 160 } },
  })
    .withMetadata({ exif: { IFD0: { Copyright: 'ingest-test-fixture' } } })
    .jpeg()
    .toBuffer();
  writeFileSync(path, buf);
}

test('listInbox 只认 jpg/jpeg，并带出子目录指定的国家', () => {
  const root = tmp();
  mkdirSync(join(root, 'china'), { recursive: true });
  writeFileSync(join(root, 'a.jpg'), 'x');
  writeFileSync(join(root, 'b.JPEG'), 'x');
  writeFileSync(join(root, 'note.txt'), 'x');
  writeFileSync(join(root, 'china', 'c.jpg'), 'x');

  const got = listInbox(root).map((f) => ({ name: f.name, forced: f.forcedCountryId })).sort((x, y) => x.name.localeCompare(y.name));
  assert.deepEqual(got, [
    { name: 'a.jpg', forced: null },
    { name: 'b.JPEG', forced: null },
    { name: 'c.jpg', forced: 'china' },
  ]);
});

test('listInbox 对不存在的目录返回空数组', () => {
  assert.deepEqual(listInbox(join(tmpdir(), 'definitely-not-here-' + Date.now())), []);
});

test('派生的母版长边 2560、元数据被剥光，原图归档保持不变', async () => {
  const root = tmp();
  const src = join(root, 'IMG20260905155409.jpg');
  await fakePhoto(src);
  const originalBytes = readFileSync(src).length;

  // 前提自检：源图确实带 EXIF，否则下面的剥除断言没有意义
  assert.ok((await exifr.parse(src, true))?.Copyright, '测试前提：源图应带 EXIF');

  const archiveDir = join(root, '_originals');
  const servingDir = join(root, '_serving');
  const r = await archiveAndDerive({
    file: src, countryId: 'china', archiveRoot: archiveDir, servingRoot: servingDir,
  });

  const archived = join(archiveDir, 'china', 'IMG20260905155409.jpg');
  assert.ok(existsSync(archived));
  assert.equal(readFileSync(archived).length, originalBytes, '归档的必须是原图，不能是压缩过的');
  assert.ok((await exifr.parse(archived, true))?.Copyright, '归档件必须保留 EXIF（底片留全信息）');

  const master = join(servingDir, 'china', 'IMG20260905155409.jpg');
  assert.ok(existsSync(master));
  const meta = await sharp(master).metadata();
  assert.equal(Math.max(meta.width, meta.height), 2560);
  assert.ok(!(await exifr.parse(master, true).catch(() => null))?.Copyright, '母版不得残留 EXIF');
  assert.equal(await exifr.gps(master).catch(() => undefined), undefined, '母版不得残留 GPS');
  assert.equal(r.servingPath, master);
});

test('母版已存在则抛错，不静默覆盖', async () => {
  const root = tmp();
  const src = join(root, 'IMG20260905155409.jpg');
  await fakePhoto(src);
  const archiveDir = join(root, '_originals');
  const servingDir = join(root, '_serving');
  const args = { file: src, countryId: 'china', archiveRoot: archiveDir, servingRoot: servingDir };

  await archiveAndDerive(args);
  await assert.rejects(() => archiveAndDerive(args), /已存在/);
});

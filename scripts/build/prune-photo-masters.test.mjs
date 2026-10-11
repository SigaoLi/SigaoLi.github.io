import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prunePhotoMasters } from './prune-photo-masters.mjs';

test('prunes only unused identical masters; preserves referenced and other image assets', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'photo-build-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sourceDir = join(root, 'source');
  const outputDir = join(root, 'dist');
  await mkdir(sourceDir);
  await mkdir(join(outputDir, '_astro'), { recursive: true });
  for (const [name, contents] of [['unused.jpg', 'master1'], ['used.jpg', 'master2'], ['script.jpg', 'master3']]) {
    await writeFile(join(sourceDir, name), contents);
  }
  for (const [name, contents] of [['unused.hash.jpg', 'master1'], ['used.hash.jpg', 'master2'], ['script.hash.jpg', 'master3'], ['other.jpg', 'unrelated'], ['unused.oldhash.jpg', 'old master'], ['variant.webp', 'master1'], ['variant.avif', 'master1']]) {
    await writeFile(join(outputDir, '_astro', name), contents);
  }
  await writeFile(join(outputDir, 'index.html'), '<img src="/_astro/used.hash.jpg">');
  await writeFile(join(outputDir, 'data.json'), JSON.stringify({ image: '/_astro/script.hash.jpg' }));
  assert.deepEqual(await prunePhotoMasters({ outputDir, sourceDir }), { removed: 1, bytes: 7, retainedReferenced: 2 });
  assert.deepEqual((await readdir(join(outputDir, '_astro'))).sort(), ['other.jpg', 'script.hash.jpg', 'unused.oldhash.jpg', 'used.hash.jpg', 'variant.avif', 'variant.webp']);
  assert.equal((await readdir(sourceDir)).length, 3);
  assert.equal((await prunePhotoMasters({ outputDir, sourceDir })).removed, 0);
  await assert.rejects(prunePhotoMasters({ outputDir: sourceDir, sourceDir }), /separate directories/);
  await assert.rejects(prunePhotoMasters({ outputDir, sourceDir: join(outputDir, 'photos') }), /separate directories/);
});

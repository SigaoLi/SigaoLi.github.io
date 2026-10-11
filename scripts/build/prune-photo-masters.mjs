import { readdir, readFile, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve, relative, extname, isAbsolute, sep, basename } from 'node:path';

const TEXT_EXTENSIONS = new Set(['.html', '.css', '.js', '.mjs', '.cjs', '.json', '.xml', '.txt', '.map', '.svg', '.webmanifest']);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function filesUnder(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    // Do not follow symlinks outside either directory.
    if (entry.isDirectory()) files.push(...await filesUnder(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

/** Remove only unreferenced, byte-identical photo masters from the build output. */
export async function prunePhotoMasters({ outputDir, sourceDir }) {
  const output = resolve(outputDir);
  const source = resolve(sourceDir);
  const contains = (parent, child) => {
    const rel = relative(parent, child);
    return !isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep);
  };
  if (contains(output, source) || contains(source, output)) {
    throw new Error('Photo source and build output must be separate directories');
  }
  const sourceHashes = new Set();
  for (const path of await filesUnder(source)) {
    if (/\.jpe?g$/i.test(path)) sourceHashes.add(digest(await readFile(path)));
  }
  const outputFiles = await filesUnder(output);
  const references = [];
  for (const path of outputFiles) {
    if (TEXT_EXTENSIONS.has(extname(path).toLowerCase())) references.push(await readFile(path, 'utf8'));
  }
  let removed = 0;
  let bytes = 0;
  let retainedReferenced = 0;
  for (const path of outputFiles) {
    if (!/\.jpe?g$/i.test(path)) continue;
    const content = await readFile(path);
    if (!sourceHashes.has(digest(content))) continue;
    const filename = basename(path);
    if (references.some((text) => text.includes(filename) || text.includes(encodeURIComponent(filename)))) {
      retainedReferenced++;
      continue;
    }
    await unlink(path);
    removed++;
    bytes += content.length;
  }
  return { removed, bytes, retainedReferenced };
}

export default function excludeUnusedPhotoMasters() {
  return {
    name: 'exclude-unused-photo-masters',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const { fileURLToPath } = await import('node:url');
        const result = await prunePhotoMasters({
          outputDir: fileURLToPath(dir),
          sourceDir: fileURLToPath(new URL('../../src/assets/photos/', import.meta.url)),
        });
        logger.info('Excluded ' + result.removed + ' unused photo masters (' + (result.bytes / 1e6).toFixed(1) + ' MB)');
      },
    },
  };
}

// One-off: archive full-res photo originals to _originals/ (gitignored) and
// replace src/assets/photos with downscaled serving masters (max edge 2560px).
// Idempotent: reads from the pristine _originals copy, so re-running re-derives
// the same masters and never compounds JPEG loss. See PRD §20.13.
import sharp from 'sharp';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src/assets/photos');
const ORIG = path.join(ROOT, '_originals/photos');
const MAX_EDGE = 2560;
const QUALITY = 82;

async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (/\.jpe?g$/i.test(e.name)) out.push(p);
  }
  return out;
}

// Stage 1: archive originals to _originals (only the first time — never
// overwrite the archive, or a second run would back up already-compressed files).
const archiveExists = await fs
  .access(ORIG)
  .then(() => true)
  .catch(() => false);
if (!archiveExists) {
  const files = await walk(SRC);
  for (const f of files) {
    const dest = path.join(ORIG, path.relative(SRC, f));
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(f, dest);
  }
  console.log(`Archived ${files.length} originals → _originals/photos`);
} else {
  console.log('_originals/photos already exists — using it as the source of truth.');
}

// Stage 2: derive 2560px serving masters from the archive into src/assets/photos.
const originals = await walk(ORIG);
let before = 0,
  after = 0,
  skipped = 0;
for (const f of originals) {
  const rel = path.relative(ORIG, f);
  const dest = path.join(SRC, rel);
  const meta = await sharp(f).metadata();
  before += (await fs.stat(f)).size;
  await fs.mkdir(path.dirname(dest), { recursive: true });
  const longest = Math.max(meta.width ?? 0, meta.height ?? 0);
  const pipeline = sharp(f).rotate(); // bake EXIF orientation before stripping
  if (longest > MAX_EDGE) {
    pipeline.resize({ width: meta.width >= meta.height ? MAX_EDGE : null, height: meta.height > meta.width ? MAX_EDGE : null });
  } else {
    skipped++;
  }
  const buf = await pipeline.jpeg({ quality: QUALITY, mozjpeg: true }).toBuffer();
  await fs.writeFile(dest, buf);
  after += buf.length;
}
const mb = (n) => (n / 1048576).toFixed(1);
console.log(`Processed ${originals.length} photos (${skipped} already ≤${MAX_EDGE}px, recompressed only).`);
console.log(`src/assets/photos: ${mb(before)}MB → ${mb(after)}MB`);

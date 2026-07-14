// zoe-qc2-inspect.mjs — 对贴合度偏高的片段出「参考帧 | 实际帧 | 放大差值」三联图
import sharp from 'sharp';
import path from 'node:path';

const TMP = 'C:/Users/19663/AppData/Local/Temp/claude/C--Users-19663-Desktop-Website/5f4fe26d-89be-4264-b55a-ea01c8d62e4f/scratchpad/zoe-qc';
const W = 1280, H = 720;

const PAIRS = [
  ['04-first-vs-sit', '01-idle2/f001.png', '04-sit-to-loaf2/f001.png'],
  ['04-last-vs-loaf', '02-loaf2/f001.png', '04-sit-to-loaf2/last.png'],
  ['14-first-vs-loaf', '02-loaf2/f001.png', '14-stretch/f001.png'],
  ['14-last-vs-sit', '01-idle2/f001.png', '14-stretch/last.png'],
  ['17bow-last-vs-sit', '01-idle2/f001.png', '17-bow-thanks/last.png'],
];

for (const [name, refF, actF] of PAIRS) {
  const a = await sharp(path.join(TMP, refF)).raw().toBuffer();
  const b = await sharp(path.join(TMP, actF)).raw().toBuffer();
  const d = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H * 3; i++) d[i] = Math.min(255, Math.abs(a[i] - b[i]) * 8);
  const panel = (buf) => sharp(buf, { raw: { width: W, height: H, channels: 3 } }).resize({ width: 426 }).png().toBuffer();
  const [pa, pb, pd] = await Promise.all([panel(a), panel(b), panel(d)]);
  await sharp({ create: { width: 1278, height: 240, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .composite([{ input: pa, left: 0, top: 0 }, { input: pb, left: 426, top: 0 }, { input: pd, left: 852, top: 0 }])
    .png().toFile(`shots/zoe2-seam-${name}.png`);
  console.log(name, 'done');
}

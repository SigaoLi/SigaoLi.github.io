// zoe-qc2.mjs — V2 片段编码前质检（PRD §23）
// 逐段: 2fps 采样帧 → 非蓝前景 union bbox(排除水印区) → 判中央 640 裁剪是否够
//       首/尾帧 vs 锚点参考帧(01 首帧=坐参考, 02 首帧=趴参考) 可见像素平均差
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const DIR = 'C:/Users/19663/Desktop/Website/_assets/zoe-v2-new/clips';
const TMP = 'C:/Users/19663/AppData/Local/Temp/claude/C--Users-19663-Desktop-Website/5f4fe26d-89be-4264-b55a-ea01c8d62e4f/scratchpad/zoe-qc';
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

const W = 1280, H = 720;
// 端点锚点: s=坐 l=趴
const ENDS = {
  '01-idle2': 'ss', '02-loaf2': 'll', '04-sit-to-loaf2': 'sl', '08-attend': 'ss',
  '09-listen': 'ss', '10-think': 'ss', '11-type': 'ss', '12-groom': 'ss',
  '13-yawn': 'ss', '14-stretch': 'ls', '15-wave': 'ss', '16-ball': 'ss',
  '17-bow-thanks': 'ss', '17-proud': 'ss', '18-startle': 'ss', '19-earflick': 'ss', '20-glance': 'ss',
};
const isWm = (x, y) => (x < 150 && y < 75) || (x > 1120 && y > 655); // 可灵水印区(图标上缘实测到 y≈672)
const isBlue = (r, g, b) => r * r + (g - 67) ** 2 + (b - 254) ** 2 < 3600;

async function loadRaw(f) {
  const { data } = await sharp(f).raw().toBuffer({ resolveWithObject: true });
  return data;
}
function bboxOf(data) {
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (isWm(x, y)) continue;
    const i = (y * W + x) * 3;
    if (!isBlue(data[i], data[i + 1], data[i + 2])) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  return [minX, minY, maxX, maxY];
}
function diff(a, b) { // 可见并集上的平均 |Δ|
  let sum = 0, cnt = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (isWm(x, y)) continue;
    const i = (y * W + x) * 3;
    const va = !isBlue(a[i], a[i + 1], a[i + 2]), vb = !isBlue(b[i], b[i + 1], b[i + 2]);
    if (va || vb) {
      sum += (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3;
      cnt++;
    }
  }
  return cnt ? sum / cnt : 0;
}

const refs = {}; // s / l 参考帧
const rows = [];
for (const file of readdirSync(DIR).filter((f) => f.endsWith('.mp4')).sort()) {
  const name = file.replace('.mp4', '');
  const t = path.join(TMP, name);
  mkdirSync(t, { recursive: true });
  execFileSync(ffmpegPath, ['-y', '-i', path.join(DIR, file), '-vf', 'fps=2', path.join(t, 'f%03d.png')], { stdio: 'pipe' });
  execFileSync(ffmpegPath, ['-y', '-sseof', '-0.06', '-i', path.join(DIR, file), '-frames:v', '1', '-update', '1', path.join(t, 'last.png')], { stdio: 'pipe' });
  const frames = readdirSync(t).filter((f) => f.startsWith('f')).sort();

  let u = [W, H, -1, -1];
  for (const fr of frames) {
    const bb = bboxOf(await loadRaw(path.join(t, fr)));
    u = [Math.min(u[0], bb[0]), Math.min(u[1], bb[1]), Math.max(u[2], bb[2]), Math.max(u[3], bb[3])];
  }
  const first = await loadRaw(path.join(t, frames[0]));
  const last = await loadRaw(path.join(t, 'last.png'));
  if (name === '01-idle2') refs.s = first;
  if (name === '02-loaf2') refs.l = first;

  rows.push({ name, u, first, last });
}

console.log('clip                 | union bbox (x0,y0→x1,y1)   | 中央640裁剪 | 首vs锚 | 尾vs锚 | 首vs尾');
for (const r of rows) {
  const [x0, y0, x1, y1] = r.u;
  const fits = x0 >= 320 && x1 < 960 ? 'OK' : `超出! 需 ${x0}-${x1}`;
  const [e0, e1] = ENDS[r.name];
  const d0 = diff(r.first, refs[e0]).toFixed(2);
  const d1 = diff(r.last, refs[e1]).toFixed(2);
  const dfl = e0 === e1 ? diff(r.first, r.last).toFixed(2) : '—';
  console.log(`${r.name.padEnd(20)} | (${x0},${y0})→(${x1},${y1})`.padEnd(50) + ` | ${fits.padEnd(10)} | ${d0.padStart(6)} | ${d1.padStart(6)} | ${dfl.padStart(6)}`);
}

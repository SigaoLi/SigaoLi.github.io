// zoe-board2.mjs — Zoe V2 底板重制（PRD §23 / zoe-v2-production-handbook 第二步）
// 输入: _assets/zoe-v2-new/ 单张 Gemini 生成图（两姿势合一,可能是假棋盘格）
// 处理: 检测真/假透明 → 键出 → 按列占用拆分两姿势 → 统一画布/地面线 → 纯蓝底板
// 输出: zoe-v2-new/keyed/{a-sit2,b-loaf2}.png + boards/{a-sit2,b-loaf2,b-loaf2-flip}.png
//       + shots/zoe-boards2-sheet.png 供验收
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const SRC = 'C:/Users/19663/Desktop/Website/_assets/zoe-v2-new';
const FILE = 'Gemini_Generated_Image_vwwgt1vwwgt1vwwg.png';
const KEYED = path.join(SRC, 'keyed');
const BOARDS = path.join(SRC, 'boards');
mkdirSync(KEYED, { recursive: true });
mkdirSync(BOARDS, { recursive: true });

// 画布与蓝幕（同 V1: 避开绿眼睛与暖棕毛色）
const W = 1280, H = 720, BLUE = { r: 0, g: 71, b: 255 };
const BASELINE = 660;      // 地面线
const SIT_TARGET_H = 600;  // 坐姿目标高度（与旧板同规格）

const { data, info } = await sharp(path.join(SRC, FILE))
  .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h } = info;
const ch = 4, n = w * h;

// ---- 1) 真透明检测: 有 ≥1% 像素 alpha<128 则直接用 alpha 当 mask ----
let transparent = 0;
for (let p = 0; p < n; p++) if (data[p * 4 + 3] < 128) transparent++;
const realAlpha = transparent > n * 0.01;
console.log(`alpha check: ${transparent}/${n} transparent px -> ${realAlpha ? '真 alpha,直接用' : '假棋盘格,走泛洪键出'}`);

const mask = new Uint8Array(n); // 1=背景
if (realAlpha) {
  for (let p = 0; p < n; p++) if (data[p * 4 + 3] < 128) mask[p] = 1;
} else {
  // 边缘 BFS 泛洪,只吃"低彩度浅灰"像素（V1 定型逻辑）
  const seeds = [];
  const px = (x, y) => { const i = (y * w + x) * ch; return [data[i], data[i + 1], data[i + 2]]; };
  for (const [x, y] of [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3], [w >> 1, 2], [2, h >> 1]]) seeds.push(px(x, y));
  const isBg = (i) => {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (Math.max(r, g, b) - Math.min(r, g, b) > 26) return false;
    if (Math.min(r, g, b) < 150) return false;
    return seeds.some(([sr, sg, sb]) => (r - sr) ** 2 + (g - sg) ** 2 + (b - sb) ** 2 < 3200);
  };
  const queue = new Int32Array(n);
  let head = 0, tail = 0;
  const push = (p) => { if (!mask[p] && isBg(p * ch)) { mask[p] = 1; queue[tail++] = p; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (head < tail) {
    const p = queue[head++], x = p % w, y = (p / w) | 0;
    if (x > 0) push(p - 1); if (x < w - 1) push(p + 1);
    if (y > 0) push(p - w); if (y < h - 1) push(p + w);
  }
  // 背景膨胀 2px 去混合光晕
  for (let pass = 0; pass < 2; pass++) {
    const grow = [];
    for (let p = 0; p < n; p++) {
      if (mask[p]) continue;
      const x = p % w, y = (p / w) | 0;
      if ((x > 0 && mask[p - 1]) || (x < w - 1 && mask[p + 1]) ||
          (y > 0 && mask[p - w]) || (y < h - 1 && mask[p + w])) grow.push(p);
    }
    for (const p of grow) mask[p] = 1;
  }
}

// ---- 2) 按列占用拆分两姿势: 找前景列的两大连续段 ----
const colCount = new Int32Array(w);
for (let p = 0; p < n; p++) if (!mask[p]) colCount[p % w]++;
const runs = [];
let start = -1;
for (let x = 0; x <= w; x++) {
  const occ = x < w && colCount[x] > 3; // 忽略零星噪点列
  if (occ && start < 0) start = x;
  if (!occ && start >= 0) { runs.push([start, x - 1]); start = -1; }
}
runs.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));
if (runs.length < 2) throw new Error(`拆分失败: 只找到 ${runs.length} 个前景列段`);
const [runA, runB] = runs.slice(0, 2).sort((a, b) => a[0] - b[0]); // 左右排序
console.log(`split: left cols ${runA[0]}-${runA[1]}, right cols ${runB[0]}-${runB[1]}, gap=${runB[0] - runA[1]}px`);

// ---- 3) 各自求 bbox、裁出真透明 PNG ----
function extractRegion([x0, x1]) {
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) for (let x = x0; x <= x1; x++) {
    const p = y * w + x;
    if (!mask[p]) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  const bw = maxX - minX + 1, bh = maxY - minY + 1;
  const out = Buffer.alloc(bw * bh * 4);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    const p = (minY + y) * w + (minX + x), o = (y * bw + x) * 4, i = p * 4;
    out[o] = data[i]; out[o + 1] = data[i + 1]; out[o + 2] = data[i + 2];
    out[o + 3] = mask[p] ? 0 : 255;
  }
  return { buf: out, bw, bh };
}

const left = extractRegion(runA);
const right = extractRegion(runB);
// 高的是坐姿,矮的是趴姿（不依赖左右顺序）
const [sit, loaf] = left.bh >= right.bh ? [left, right] : [right, left];
console.log(`sit bbox ${sit.bw}x${sit.bh}, loaf bbox ${loaf.bw}x${loaf.bh}, 实测比例 loaf/sit=${(loaf.bh / sit.bh).toFixed(3)} (V1 先验 0.63)`);

const sitPng = await sharp(sit.buf, { raw: { width: sit.bw, height: sit.bh, channels: 4 } }).png().toBuffer();
const loafPng = await sharp(loaf.buf, { raw: { width: loaf.bw, height: loaf.bh, channels: 4 } }).png().toBuffer();
await sharp(sitPng).toFile(path.join(KEYED, 'a-sit2.png'));
await sharp(loafPng).toFile(path.join(KEYED, 'b-loaf2.png'));

// ---- 4) 置蓝底统一画布 ----
async function board(keyedBuf, targetH) {
  const resized = await sharp(keyedBuf).resize({ height: targetH }).png().toBuffer();
  const meta = await sharp(resized).metadata();
  return sharp({ create: { width: W, height: H, channels: 3, background: BLUE } })
    .composite([{ input: resized, left: Math.round((W - meta.width) / 2), top: BASELINE - meta.height }])
    .png().toBuffer();
}

const loafTargetH = Math.round(SIT_TARGET_H * loaf.bh / sit.bh); // 用同图实测比例
const outs = [
  ['a-sit2.png', await board(sitPng, SIT_TARGET_H)],
  ['b-loaf2.png', await board(loafPng, loafTargetH)],
  ['b-loaf2-flip.png', await board(await sharp(loafPng).flop().png().toBuffer(), loafTargetH)],
];
for (const [name, buf] of outs) await sharp(buf).toFile(path.join(BOARDS, name));
console.log(`boards done: sit targetH=${SIT_TARGET_H}, loaf targetH=${loafTargetH}`);

// ---- 5) 契约表供验收 ----
const thumbs = await Promise.all(outs.map(([, buf]) => sharp(buf).resize({ width: W / 2 }).toBuffer()));
await sharp({ create: { width: W, height: H, channels: 3, background: { r: 20, g: 20, b: 24 } } })
  .composite(thumbs.map((input, i) => ({ input, left: (i % 2) * (W / 2), top: Math.floor(i / 2) * (H / 2) })))
  .png().toFile('shots/zoe-boards2-sheet.png');
console.log('contact sheet -> shots/zoe-boards2-sheet.png');

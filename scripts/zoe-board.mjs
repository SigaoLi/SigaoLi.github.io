// zoe-board.mjs — Zoe V1 底板合成（PRD v2.18 第二步）
// 输入: _assets/zoe-v2/ 三张 ChatGPT 生成图（假透明棋盘格,无 alpha）
// 处理: 边缘泛洪键出棋盘格 → 真透明 keyed/ → 统一画布/地面线/体型比例 → 纯蓝底板 boards/
// 输出: boards/{a-sit,b-loaf,c-walk-left,c-walk-right}.png + shots/zoe-boards-sheet.png 供验收
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const SRC = 'C:/Users/19663/Desktop/Website/_assets/zoe-v2';
const KEYED = path.join(SRC, 'keyed');
const BOARDS = path.join(SRC, 'boards');
mkdirSync(KEYED, { recursive: true });
mkdirSync(BOARDS, { recursive: true });

const FILES = {
  a: 'ChatGPT Image Jul 12, 2026, 04_55_00 PM (1).png',
  b: 'ChatGPT Image Jul 12, 2026, 04_55_00 PM (2).png',
  c: 'ChatGPT Image Jul 12, 2026, 04_55_01 PM (3).png',
};

// 画布与蓝幕（避开绿眼睛与暖棕毛色）
const W = 1280, H = 720, BLUE = { r: 0, g: 71, b: 255 };
const BASELINE = 660; // 地面线:所有姿势脚底对齐到这条 y

// 体型比例(解剖先验,坐姿=1;供画板高度换算,验收契约表后可微调)
const POSES = {
  a: { name: 'a-sit',  rel: 1.0 },
  b: { name: 'b-loaf', rel: 0.63 },
  c: { name: 'c-walk', rel: 0.86 },
};
const SIT_TARGET_H = 600; // 坐姿在 720p 画布上的目标高度

// ---- 1) 键出棋盘格: 从边缘泛洪,只吃"低彩度浅灰"像素 ----
async function keyOut(file) {
  const { data, info } = await sharp(path.join(SRC, file))
    .raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const n = w * h;

  // 采样四角+边中点,聚出棋盘两色
  const seeds = [];
  const px = (x, y) => { const i = (y * w + x) * ch; return [data[i], data[i + 1], data[i + 2]]; };
  for (const [x, y] of [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3], [w >> 1, 2], [2, h >> 1]]) seeds.push(px(x, y));

  const isBg = (i) => {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (Math.max(r, g, b) - Math.min(r, g, b) > 26) return false; // 有彩度=毛发
    if (Math.min(r, g, b) < 150) return false;                    // 太暗=毛发/阴影
    return seeds.some(([sr, sg, sb]) => (r - sr) ** 2 + (g - sg) ** 2 + (b - sb) ** 2 < 3200);
  };

  // BFS 泛洪(4 邻接),只从图像边缘出发——猫身上的白毛不与边缘连通,不会被吃
  const mask = new Uint8Array(n); // 1=背景
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

  // 背景膨胀 2px 吃掉棋盘/毛发之间的混合色光晕
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

  // 组装 RGBA + 求前景 bbox
  const out = Buffer.alloc(n * 4);
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let p = 0; p < n; p++) {
    const i = p * ch, o = p * 4;
    out[o] = data[i]; out[o + 1] = data[i + 1]; out[o + 2] = data[i + 2];
    out[o + 3] = mask[p] ? 0 : 255;
    if (!mask[p]) {
      const x = p % w, y = (p / w) | 0;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  return sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .png().toBuffer();
}

// ---- 2) 置蓝底统一画布 ----
async function board(keyedBuf, targetH, xMode) {
  const resized = await sharp(keyedBuf).resize({ height: targetH }).png().toBuffer();
  const meta = await sharp(resized).metadata();
  const left = xMode === 'left' ? 90
    : xMode === 'right' ? W - meta.width - 90
    : Math.round((W - meta.width) / 2);
  return sharp({ create: { width: W, height: H, channels: 3, background: BLUE } })
    .composite([{ input: resized, left, top: BASELINE - meta.height }])
    .png().toBuffer();
}

const outs = [];
for (const [key, pose] of Object.entries(POSES)) {
  const keyed = await keyOut(FILES[key]);
  await sharp(keyed).toFile(path.join(KEYED, `${pose.name}.png`));
  const targetH = Math.round(SIT_TARGET_H * pose.rel);
  if (key === 'c') {
    for (const side of ['left', 'right']) {
      const buf = await board(keyed, targetH, side);
      const f = path.join(BOARDS, `${pose.name}-${side}.png`);
      await sharp(buf).toFile(f);
      outs.push(f);
    }
  } else {
    const buf = await board(keyed, targetH, 'center');
    const f = path.join(BOARDS, `${pose.name}.png`);
    await sharp(buf).toFile(f);
    outs.push(f);
  }
  console.log(`${pose.name}: keyed + board(s) done, targetH=${targetH}`);
}

// ---- 3) 契约表(2×2 半尺寸)供验收 ----
const thumbs = await Promise.all(outs.map((f) => sharp(f).resize({ width: W / 2 }).toBuffer()));
await sharp({ create: { width: W, height: H, channels: 3, background: { r: 20, g: 20, b: 24 } } })
  .composite(thumbs.map((input, i) => ({ input, left: (i % 2) * (W / 2), top: Math.floor(i / 2) * (H / 2) })))
  .png().toFile('shots/zoe-boards-sheet.png');
console.log('contact sheet -> shots/zoe-boards-sheet.png');

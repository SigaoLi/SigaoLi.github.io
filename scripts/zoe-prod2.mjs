// zoe-prod2.mjs — V2 生产编码: 源 mp4 → 600p VP9 alpha → public/zoe/（语义化命名）
// 与 QC 版(zoe-key2-batch)同键出参数,多 hflip + scale=-2:600 + CRF35(生产体积)
// despill 修正(07-15 Sigao 报告嘴/耳/眼偏红品紫):type=blue 时 ffmpeg 的通道刻度默认仍是
// green=-1/blue=0(为绿幕设计),会把浅色区绿通道砍掉(白毛 ΔG≈-52)→ 品红。必须显式
// green=0:blue=-1 才是真正削蓝溢色;expand 归 0 使中性色不受影响,只修真正带蓝的边缘像素。
// 04 额外出倒放版 loaf-to-sit(起身,「眼睛最后才闭」故倒放自然,V1 同法)
// 全局镜像(07-15 Sigao 验收定):成片统一 hflip——素材保持原方向生产,显示时左右反转
// (趴姿头转向屏幕中央、打字拍向面板侧;可灵没听"往左下拍"的提示词,翻转恰好修正)
// 裁剪铁律:裁剪窗必须以猫中心(源 x=640)对称,否则切片段时挂件里猫会横跳("闪现"根因——
// 挂件按画幅中心对齐,玩球旧裁 0-864 使猫偏离画幅中心 ~215px,显示时横跳 ~54px)
import { execFileSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const SRC = 'C:/Users/19663/Desktop/Website/_assets/zoe-v2-new/clips';
const OUT = 'C:/Users/19663/Desktop/Website/sigaoli-v2/public/zoe';
mkdirSync(OUT, { recursive: true });

const KEY = '0x0044FD';
const CROPS = {
  // 伸懒腰运动范围 206-1068 → 以 640 为中心取 880 宽(200-1080),避开两角水印区
  '14-stretch': 'crop=880:720:200:0',
  // 玩球的球滚到画面左缘(x=0) → 中心对称只能全幅;两角水印涂蓝键出
  '16-ball': 'drawbox=x=0:y=0:w=150:h=75:color=0x0044FD:t=fill,drawbox=x=1120:y=655:w=160:h=65:color=0x0044FD:t=fill',
};
const DEFAULT_CROP = 'crop=640:720:320:0';

// [源文件名, 输出名, 是否倒放]
const JOBS = [
  ['01-idle2', 'idle'], ['02-loaf2', 'loaf'],
  ['04-sit-to-loaf2', 'sit-to-loaf'], ['04-sit-to-loaf2', 'loaf-to-sit', true],
  ['08-attend', 'attend'], ['09-listen', 'listen'], ['10-think', 'think'],
  ['11-type', 'type'], ['12-groom', 'groom'], ['13-yawn', 'yawn'],
  ['14-stretch', 'stretch'], ['15-wave', 'wave'], ['16-ball', 'ball'],
  ['17-bow-thanks', 'bow'], ['17-proud', 'proud'],
  ['18-startle', 'startle'], ['19-earflick', 'earflick'], ['20-glance', 'glance'],
];

for (const [src, name, rev] of JOBS) {
  const out = path.join(OUT, `${name}.webm`);
  if (existsSync(out) && process.argv[2] !== '--force') {
    // public/zoe 旧猫同名文件必须覆盖,以 mtime 判断: 简化为本脚本总是覆盖
  }
  const vf = `${CROPS[src] ?? DEFAULT_CROP},chromakey=${KEY}:0.20:0.10,despill=type=blue:mix=0.7:expand=0:green=0:blue=-1,hflip,scale=-2:600${rev ? ',reverse' : ''}`;
  const t0 = Date.now();
  execFileSync(ffmpegPath, [
    '-y', '-i', path.join(SRC, `${src}.mp4`),
    '-vf', vf,
    '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p',
    '-auto-alt-ref', '0', '-crf', '35', '-b:v', '0',
    '-row-mt', '1', '-cpu-used', '1',
    '-an', out,
  ], { stdio: 'pipe' });
  console.log(`${name}.webm done in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
console.log('prod encode complete');

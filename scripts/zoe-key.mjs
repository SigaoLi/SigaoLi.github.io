// zoe-key.mjs — Zoe 片段抠像管线（PRD v2.18 第四步）
// 蓝幕视频 → 裁剪(避开可灵角落水印) → chromakey → 去蓝溢色 → VP9 alpha WebM + 首帧 poster PNG
// 用法: node scripts/zoe-key.mjs <in.mp4> <out.webm> [cropW cropH cropX cropY]
//   默认裁剪 640x720+320+0（居中列,适用 idle/趴姿等定点片段;走路片段传全宽自定义）
import { execFileSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

const [inFile, outFile, cw = '640', chh = '720', cx = '320', cy = '0'] = process.argv.slice(2);
if (!inFile || !outFile) {
  console.error('usage: node scripts/zoe-key.mjs <in.mp4> <out.webm> [cropW cropH cropX cropY]');
  process.exit(1);
}

// 可灵输出的实测蓝底 ~rgb(0,68,253)
const KEY = '0x0044FD';
// 参数经三组对比实验定型(shots/key-tests.png):0.20/0.10+despill0.7 蓝边净、深条纹完好;
// similarity ≥0.25 会把深条纹键成半透明灰,勿再调高
// despill 07-15 修正 green=0:blue=-1:expand=0(原 expand=1 用绿幕默认刻度砍浅色区绿通道→
// 嘴/耳/眼偏品红;V1 当年蓝边看着净全靠 chromakey,despill 一直在帮倒忙。详见 zoe-prod2.mjs)
const vf = `crop=${cw}:${chh}:${cx}:${cy},chromakey=${KEY}:0.20:0.10,despill=type=blue:mix=0.7:expand=0:green=0:blue=-1`;

execFileSync(ffmpegPath, [
  '-y', '-i', inFile,
  '-vf', vf,
  '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p',
  '-auto-alt-ref', '0', '-crf', '30', '-b:v', '0',
  '-an', outFile,
], { stdio: 'inherit' });

// 首帧 poster(静态降级/懒加载占位)
// 坑:ffmpeg 原生 vp9 解码器不解 alpha,必须显式指定 libvpx-vp9 解码
execFileSync(ffmpegPath, [
  '-y', '-c:v', 'libvpx-vp9', '-i', outFile,
  '-frames:v', '1', '-update', '1',
  outFile.replace(/\.webm$/, '-poster.png'),
], { stdio: 'inherit' });

console.log('done:', outFile);

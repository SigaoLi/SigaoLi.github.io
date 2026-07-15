// zoe-key2-batch.mjs — V2 全片段批量抠像（PRD §23）
// 参数(chromakey 0x0044FD 0.20/0.10 + despill mix0.7);despill 07-15 修正 green=0:blue=-1:expand=0
// (原 expand=1 用绿幕默认刻度砍浅色区绿通道→嘴/耳/眼偏品红;详见 zoe-prod2.mjs 注释)
// 特殊裁剪: 14-stretch 宽幅 896(运动范围 206-1068,避两角水印); 16-ball 含左缘 864+左上水印涂蓝
// 幂等: 已存在的 webm 跳过(超时中断后重跑即续)
import { execFileSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';

const SRC = 'C:/Users/19663/Desktop/Website/_assets/zoe-v2-new/clips';
const OUT = 'C:/Users/19663/Desktop/Website/_site-explore/zoe2';
mkdirSync(OUT, { recursive: true });

const KEY = '0x0044FD';
const CROPS = {
  '14-stretch': 'crop=896:720:184:0',
  '16-ball': 'drawbox=x=0:y=0:w=150:h=75:color=0x0044FD:t=fill,crop=864:720:0:0',
};
const DEFAULT_CROP = 'crop=640:720:320:0';

for (const file of readdirSync(SRC).filter((f) => f.endsWith('.mp4')).sort()) {
  const name = file.replace('.mp4', '');
  const out = path.join(OUT, `${name}.webm`);
  if (existsSync(out)) { console.log(`skip ${name} (exists)`); continue; }
  const vf = `${CROPS[name] ?? DEFAULT_CROP},chromakey=${KEY}:0.20:0.10,despill=type=blue:mix=0.7:expand=0:green=0:blue=-1`;
  const t0 = Date.now();
  execFileSync(ffmpegPath, [
    '-y', '-i', path.join(SRC, file),
    '-vf', vf,
    '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p',
    '-auto-alt-ref', '0', '-crf', '30', '-b:v', '0',
    '-row-mt', '1', '-cpu-used', '2',
    '-an', out,
  ], { stdio: 'pipe' });
  execFileSync(ffmpegPath, [
    '-y', '-c:v', 'libvpx-vp9', '-i', out,
    '-frames:v', '1', '-update', '1',
    out.replace(/\.webm$/, '-poster.png'),
  ], { stdio: 'pipe' });
  console.log(`${name}: done in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
console.log('batch complete');

// Zoe 闪现消失复现矩阵(07-17 ③):弱网+CPU 节流下跑「快速切页 / 聊天连发 / hover 骚扰」,
// 每 150ms 采样 ?zoe-debug 状态快照,找「无可见带帧 video 且未桥接」超 600ms 的裸空窗
// (看门狗应在 400ms 内桥接静态图;裸空窗=看门狗失效或未覆盖的路径,附状态轨迹供归因)。
// 前置:astro dev(4321)。/chat、/classify 全 stub,不需要 worker。
import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
// 深夜模式会接管进场(23-6 点),矩阵必须钉白天(verify-zoe 的老坑:只覆写 getHours 不碰计时器)
await page.addInitScript(() => { Date.prototype.getHours = () => 14; });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
await page.route('**/classify', (r) => r.fulfill({ contentType: 'application/json', body: '{"chip":"none"}' }));
await page.route('**/chat', (r) =>
  r.fulfill({ contentType: 'text/event-stream; charset=utf-8', body: 'data: {"delta":"好的喵,本猫想想…这个问题有点意思。"}\n\ndata: [DONE]\n\n' })
);

// 弱网(≈慢 4G)+ 4x CPU 节流:放大加载/解码窗口,逼出竞态
const cdp = await ctx.newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 200, downloadThroughput: (1.5 * 1024 * 1024) / 8, uploadThroughput: (512 * 1024) / 8 });
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

// 采样器:Node 侧轮询状态快照;episode=连续裸空窗(未桥接且无带帧可见 video)
const samples = [];
let sampling = true;
const sampler = (async () => {
  while (sampling) {
    try {
      const s = await page.evaluate(() => (window.__zoeState ? { t: Date.now(), ...window.__zoeState() } : null));
      if (s) samples.push(s);
    } catch { /* 导航瞬间 evaluate 会抖,忽略 */ }
    await new Promise((r) => setTimeout(r, 150));
  }
})();

// 健康=有带帧可见视频,或静态图在场(boot 占位/看门狗桥接——访客能看到猫即可)
const healthy = (s) => s.still || s.bridged || s.vids.some((v) => v.startsWith('ON:') && parseInt(v.split(':rs')[1] ?? '0', 10) >= 2);

await page.goto('http://localhost:4321/?zoe-fast&zoe-debug', { waitUntil: 'load' });
await page.waitForTimeout(6000); // 进场秀跑完

// 场景1:快速切页 ×16(切页反应池高频触发,persist 元素反复搬家)
console.log('场景1: 快速切页 ×16');
const navs = ['/work', '/cv', '/photography', '/'];
for (let i = 0; i < 16; i++) {
  await page.goto(`http://localhost:4321${navs[i % 4]}?zoe-fast&zoe-debug`, { waitUntil: 'commit' });
  await page.waitForTimeout(600);
}
await page.waitForTimeout(2000);

// 场景2:聊天连发 ×4(listen→think→type 快速轮转,历史上最易踩竞态)
console.log('场景2: 聊天连发 ×4');
await page.click('#chat-fab');
for (let i = 0; i < 4; i++) {
  await page.fill('#chat-input', `测试消息${i}喵`);
  await page.press('#chat-input', 'Enter');
  await page.waitForTimeout(900);
}
await page.waitForTimeout(2500);

// 场景3:hover 骚扰 + 切页混合
console.log('场景3: hover+切页混合 ×6');
for (let i = 0; i < 6; i++) {
  await page.hover('#chat-fab').catch(() => {});
  await page.mouse.move(200, 200);
  await page.goto(`http://localhost:4321${navs[i % 4]}?zoe-fast&zoe-debug`, { waitUntil: 'commit' });
  await page.waitForTimeout(500);
}
await page.waitForTimeout(2000);

sampling = false;
await sampler;

// 分析:连续不健康采样段 > 600ms = 裸空窗 episode
const episodes = [];
let start = null;
for (const s of samples) {
  if (!healthy(s)) { start ??= s; }
  else if (start) {
    const dur = s.t - start.t;
    if (dur > 600) episodes.push({ dur, at: new Date(start.t).toISOString().slice(11, 23), snap: start });
    start = null;
  }
}
if (start) { const last = samples[samples.length - 1]; const dur = last.t - start.t; if (dur > 600) episodes.push({ dur, snap: start }); }

const bridgedCount = samples.filter((s) => s.bridged).length;
console.log(`\n采样 ${samples.length} 帧;桥接帧 ${bridgedCount};裸空窗(>600ms 未桥接) ${episodes.length} 起`);
for (const e of episodes) console.log(`  ✗ ${e.dur}ms @${e.at ?? '?'} 现场:`, JSON.stringify(e.snap));
if (errors.length) console.log('页面报错:\n' + errors.join('\n'));
await browser.close();
if (episodes.length || errors.length) process.exit(1);
console.log('✓ 全矩阵无裸空窗、0 页面报错(看门狗桥接帧数见上,>0 说明真捕获过失帧)');

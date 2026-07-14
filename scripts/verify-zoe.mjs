// Zoe 动作系统 E2E(PRD §23):进场秀 → 切页反应 → hover 凑近 → 入睡 → 伸懒腰唤醒
//                          → 打字倾听 → 思考/轻拍 → 道谢作揖彩蛋 → 深夜模式(clock mock)。
// 前置:astro dev(4321) 与 wrangler dev(8787) 都在运行;用 ?zoe-fast 把分钟级计时缩到秒级。
import { chromium } from 'playwright';

const browser = await chromium.launch();
const errors = [];
const mkPage = async (ctx) => {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  return page;
};

const clipOf = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('.zoe-stage video.on') ?? document.querySelector('.zoe-stage img.on');
    return el?.src?.split('/').pop()?.replace(/\.(webm|webp)$/, '') ?? '';
  });
const waitClip = async (page, names, label, timeout = 20000) => {
  const t0 = Date.now();
  for (;;) {
    const c = await clipOf(page);
    if (names.includes(c)) { console.log(`✓ ${label}: ${c}`); return c; }
    if (Date.now() - t0 > timeout) throw new Error(`✗ ${label}: 等 [${names}] 超时,当前=${c}`);
    await page.waitForTimeout(120);
  }
};

// 伪造本地小时(只覆写 getHours,不碰计时器):主流程=白天,深夜段=23 点
// (教训:验证跑在真实午夜时,深夜模式会接管进场,主流程必须钉白天)
const fakeHour = (page, h) => page.addInitScript((hh) => { Date.prototype.getHours = () => hh; }, h);

// ---- 主流程 ----
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await mkPage(ctx);
await fakeHour(page, 14);
await page.goto('http://localhost:4321/?zoe-fast', { waitUntil: 'load' });

// 1) 进场秀:趴 → 起身 → idle + 问候气泡
await waitClip(page, ['loaf'], '进场·趴姿');
await waitClip(page, ['loaf-to-sit'], '进场·起身', 8000);
await waitClip(page, ['idle'], '进场·坐定', 10000);
await page.waitForSelector('#zoe-bubble:not([hidden])', { timeout: 3000 });
console.log('✓ 问候气泡出现');
await page.screenshot({ path: 'shots/zoe-sys-entry.png' });

// 2) 切页反应:View Transitions 切页瞬间抽反应池
await page.click('header a[href*="/work"]');
const reaction = await waitClip(page, ['startle', 'earflick', 'glance', 'attend'], '切页反应', 8000);
await page.screenshot({ path: 'shots/zoe-sys-react.png' });
await waitClip(page, ['idle'], '反应后回 idle', 12000);

// 3) hover 不再演凑近(07-15 移至切页反应池);连续逗猫 3 次(45s 窗口,1s 去重)→ 玩球彩蛋
await page.waitForTimeout(1200);
await page.hover('#chat-fab');
await page.waitForTimeout(1500);
if ((await clipOf(page)) !== 'idle') throw new Error(`✗ hover 不应再演凑近,当前=${await clipOf(page)}`);
console.log('✓ hover 无凑近(已移至切页池)');
for (let i = 0; i < 2; i++) {
  await page.mouse.move(300, 300);
  await page.waitForTimeout(1200);
  await page.hover('#chat-fab');
}
await waitClip(page, ['ball'], '连续逗猫 3 次·玩球彩蛋', 9000);
await page.mouse.move(200, 200);
await waitClip(page, ['idle'], '回 idle', 16000);
await page.screenshot({ path: 'shots/zoe-sys-ball.png' });

// 4) 入睡(fast: 6s 无活动):坐→趴 → 趴循环
await waitClip(page, ['sit-to-loaf'], '久置入睡', 15000);
await waitClip(page, ['loaf'], '入睡·趴循环', 10000);
await page.screenshot({ path: 'shots/zoe-sys-sleep.png' });

// 5) hover 唤醒:首次=伸懒腰彩蛋
await page.hover('#chat-fab');
await waitClip(page, ['stretch'], '唤醒·伸懒腰彩蛋', 8000);
await waitClip(page, ['idle'], '醒后回 idle', 16000);

// 6) 打字=倾听
await page.click('#chat-fab');
await page.waitForSelector('#chat-panel:not([hidden])');
await page.type('#chat-input', '你好呀', { delay: 60 });
await waitClip(page, ['listen'], '打字倾听', 6000);

// 7) 发送含道谢的消息:思考 → 轻拍打字 → 作揖彩蛋(需 worker 在跑)
await page.fill('#chat-input', '谢谢你的介绍!');
await page.press('#chat-input', 'Enter');
await waitClip(page, ['think'], '等首 token·歪头思考', 8000);
await waitClip(page, ['type', 'proud'], '流式回复·敲地面/傲娇轮换', 30000);
await page.screenshot({ path: 'shots/zoe-sys-type.png' });
await waitClip(page, ['bow'], '道谢·作揖彩蛋', 40000);
await page.screenshot({ path: 'shots/zoe-sys-bow.png' });
await waitClip(page, ['idle'], '彩蛋后回 idle', 16000);
await ctx.close();

// 7b) 回头客挥手:预置 localStorage seen,新会话进场秀在坐定前挥手
const waveCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const wavePage = await mkPage(waveCtx);
await fakeHour(wavePage, 14);
await wavePage.addInitScript(() => localStorage.setItem('sigaoli-zoe-seen', '1'));
await wavePage.goto('http://localhost:4321/?zoe-fast', { waitUntil: 'load' });
await waitClip(wavePage, ['loaf'], '回头客·趴姿');
await waitClip(wavePage, ['loaf-to-sit'], '回头客·起身', 8000);
await waitClip(wavePage, ['wave'], '回头客·挥手彩蛋', 8000);
await wavePage.screenshot({ path: 'shots/zoe-sys-wave.png' });
await waitClip(wavePage, ['idle'], '回头客·坐定', 10000);
await waveCtx.close();

// 8) 深夜模式:伪造 23 点,进站即趴睡、无气泡
const nightCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const night = await mkPage(nightCtx);
await fakeHour(night, 23);
await night.goto('http://localhost:4321/?zoe-fast', { waitUntil: 'load' });
await waitClip(night, ['loaf'], '深夜模式·进站已睡', 8000);
await night.waitForTimeout(2500);
const bubbleShown = await night.$eval('#zoe-bubble', (el) => !el.hidden).catch(() => false);
if (bubbleShown) throw new Error('✗ 深夜模式不应冒问候气泡');
console.log('✓ 深夜模式:已睡+无气泡');
await night.screenshot({ path: 'shots/zoe-sys-night.png' });
await nightCtx.close();

console.log(`\n切页反应抽中: ${reaction}`);
console.log(`页面报错: ${errors.length ? errors.join(' | ') : '无'}`);
await browser.close();
if (errors.length) process.exit(1);

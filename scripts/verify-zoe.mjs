// Zoe 动作系统 E2E(PRD §23):进场秀 → 切页反应 → hover 凑近 → 入睡 → 伸懒腰唤醒
//                          → 打字倾听 → 思考/轻拍 → 道谢作揖彩蛋 → 深夜模式(clock mock)
//                          → 问名气泡表单/拒绝/对话自报名字 → 刷新恢复 → 跨页续流(07-16 四 bug 回归)。
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

// ---- 07-16 四 bug 回归 ----
const readProfile = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('sigaoli-zoe-profile') ?? '{}'));
const bubbleText = (p) => p.$eval('#zoe-bubble-text', (el) => el.textContent ?? '').catch(() => '');

// 9) 回头客问名(Bug1):气泡内联表单填名 → 记住 → 新会话带名问候
const nameCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const namePage = await mkPage(nameCtx);
await fakeHour(namePage, 14);
await namePage.addInitScript(() => localStorage.setItem('sigaoli-zoe-seen', '1'));
await namePage.goto('http://localhost:4321/?zoe-fast', { waitUntil: 'load' });
await namePage.waitForSelector('#zoe-name-form:not([hidden])', { timeout: 25000 });
console.log('✓ 回头客·问名气泡表单出现');
await namePage.screenshot({ path: 'shots/zoe-name-form.png' });
await namePage.fill('#zoe-name-input', '小明');
await namePage.click('#zoe-name-ok');
{
  const t0 = Date.now();
  for (;;) {
    const txt = await bubbleText(namePage);
    if (txt.includes('小明')) { console.log(`✓ 提名确认气泡: ${txt}`); break; }
    if (Date.now() - t0 > 15000) throw new Error(`✗ 提名确认超时,气泡=${txt}`);
    await namePage.waitForTimeout(250);
  }
}
if ((await readProfile(namePage)).name !== '小明') throw new Error('✗ profile.name 未存');
console.log('✓ profile.name=小明 已存 localStorage');
const backPage = await mkPage(nameCtx); // 新 tab=新会话:带名问候
await fakeHour(backPage, 14);
await backPage.goto('http://localhost:4321/?zoe-fast', { waitUntil: 'load' });
await backPage.waitForSelector('#zoe-bubble:not([hidden])', { timeout: 25000 });
if (!(await bubbleText(backPage)).includes('小明')) throw new Error('✗ 带名问候缺名字');
console.log('✓ 新会话带名问候(Welcome back 小明)');
await nameCtx.close();

// 9b) 拒绝=永不再问(profile.declined)
const declCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const declPage = await mkPage(declCtx);
await fakeHour(declPage, 14);
await declPage.addInitScript(() => localStorage.setItem('sigaoli-zoe-seen', '1'));
await declPage.goto('http://localhost:4321/?zoe-fast', { waitUntil: 'load' });
await declPage.waitForSelector('#zoe-name-form:not([hidden])', { timeout: 25000 });
await declPage.click('#zoe-name-no');
if (!(await readProfile(declPage)).declined) throw new Error('✗ 拒绝未写 profile.declined');
console.log(`✓ 拒绝后 declined=true,回应: ${await bubbleText(declPage)}`);
const decl2 = await mkPage(declCtx); // 新会话:不再问名,只冒通用气泡
await fakeHour(decl2, 14);
await decl2.goto('http://localhost:4321/?zoe-fast', { waitUntil: 'load' });
await decl2.waitForSelector('#zoe-bubble:not([hidden])', { timeout: 25000 });
if (await decl2.$eval('#zoe-name-form', (el) => !el.hidden)) throw new Error('✗ 拒绝后仍问名');
console.log('✓ 拒绝后新会话不再问名(通用气泡)');

// 9c) 对话自报名字(拒绝后唯一留名路径):启发式→/classify mode=name→头顶确认气泡
await decl2.click('#chat-fab');
await decl2.waitForSelector('#chat-panel:not([hidden])');
await decl2.fill('#chat-input', 'My name is Bob, nice to meet you!');
await decl2.press('#chat-input', 'Enter');
{
  const t0 = Date.now();
  for (;;) {
    const txt = await bubbleText(decl2);
    if (txt.includes('Bob')) { console.log(`✓ 对话自报名字被记住: ${txt}`); break; }
    if (Date.now() - t0 > 20000) throw new Error(`✗ 自报名字未捕获,气泡=${txt}`);
    await decl2.waitForTimeout(250);
  }
}
if ((await readProfile(decl2)).name !== 'Bob') throw new Error('✗ 自报名字未存 profile');
await declCtx.close();

// 10) 刷新恢复(Bug4):面板开着 reload → 猫在角落可见 + X 按钮可关面板
const rlCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const rl = await mkPage(rlCtx);
await fakeHour(rl, 14);
await rl.goto('http://localhost:4321/?zoe-fast', { waitUntil: 'load' });
await waitClip(rl, ['idle'], '刷新流程·先坐定', 25000);
await rl.click('#chat-fab');
await rl.waitForSelector('#chat-panel:not([hidden])');
await rl.reload({ waitUntil: 'load' });
await rl.waitForSelector('#chat-panel:not([hidden])', { timeout: 8000 });
await waitClip(rl, ['idle'], '刷新后·猫仍在(enterIdle 分支)', 15000);
{
  const box = await rl.$eval('.zoe-stage', (el) => el.getBoundingClientRect().toJSON());
  const vp = rl.viewportSize();
  if (box.bottom <= 0 || box.top >= vp.height || box.right <= 0 || box.left >= vp.width)
    throw new Error(`✗ 刷新后猫在视口外: ${JSON.stringify(box)}`);
  console.log(`✓ 刷新后猫在视口内(top=${Math.round(box.top)}, left=${Math.round(box.left)})`);
}
await rl.screenshot({ path: 'shots/zoe-reload.png' });
await rl.click('#chat-close');
if (await rl.$eval('#chat-panel', (el) => !el.hidden)) throw new Error('✗ X 按钮没关掉面板');
console.log('✓ X 按钮关闭面板');

// 11) 跨页续流(Bug2):流式中切页,回答不断、完整入 history
await rl.click('#chat-fab');
await rl.waitForSelector('#chat-panel:not([hidden])');
await rl.fill('#chat-input', 'Tell me about all of his projects in detail, one by one.');
await rl.press('#chat-input', 'Enter');
{
  const lastBotLen = () => rl.$$eval('#chat-log .chat-msg.bot', (els) => (els.at(-1)?.textContent ?? '').length);
  const t0 = Date.now();
  while ((await lastBotLen()) < 10) { // 等首批 delta 到达
    if (Date.now() - t0 > 30000) throw new Error('✗ 流式迟迟未开始');
    await rl.waitForTimeout(150);
  }
  await rl.click('header a[href*="/work"]'); // 流式中切页
  await rl.waitForSelector('#chat-panel:not([hidden])', { timeout: 8000 });
  const l1 = await lastBotLen();
  const t1 = Date.now();
  for (;;) { // 断言切页后回答继续增长
    const l = await lastBotLen();
    if (l > l1) { console.log(`✓ 切页后回答继续增长(${l1}→${l})`); break; }
    if (Date.now() - t1 > 25000) throw new Error(`✗ 切页后回答停在 ${l}`);
    await rl.waitForTimeout(250);
  }
  await rl.waitForFunction(() => !document.getElementById('chat-send')?.disabled, { timeout: 60000 });
  const finalLen = await lastBotLen();
  const saved = await rl.evaluate(() => JSON.parse(sessionStorage.getItem('sigaoli-chat') ?? '[]'));
  const lastSaved = saved.at(-1);
  if (lastSaved?.role !== 'assistant' || lastSaved.content.length < finalLen - 5)
    throw new Error(`✗ history 未存完整回答(存${lastSaved?.content?.length ?? 0}/显${finalLen})`);
  console.log(`✓ 完整回答入 history(${lastSaved.content.length} 字)`);
  const pending = await rl.$('#chat-log .chat-msg.pending');
  if (pending) throw new Error('✗ 残留 pending 气泡');
}
await rl.screenshot({ path: 'shots/zoe-stream-cross.png' });
await rlCtx.close();

console.log(`\n切页反应抽中: ${reaction}`);
console.log(`页面报错: ${errors.length ? errors.join(' | ') : '无'}`);
await browser.close();
if (errors.length) process.exit(1);

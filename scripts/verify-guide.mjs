// 深链 chip + 兴趣追踪 前端 E2E(07-18,§23.5):
//   ① stub /classify(target=cv:heywhale)→ 回复下方渲染深链 chip(href=/zh/cv#cv-heywhale)
//   ② 点 chip 切页 → 锚点存在、落点在视口内、:target 命中(高亮由 CSS 负责)
//   ③ 兴趣注入:画像 work=120/cv=30 → /chat 请求体只带 ['work'](90s 门槛)
//   ④ 门控停留计时:/zh/cv 待 ~11s(带输入)→ cv 兴趣 ≥10
//   ⑤ 案例详情页深度事件:+30 work(每会话一次)
//   ⑥ 灯箱缩略图点击:+10 photography
// /classify 与 /chat 全部 stub——不耗模型调用,不受限流影响。前置:astro dev(4321)。
import { chromium } from 'playwright';

const browser = await chromium.launch();
const errors = [];
let n = 0;
const ok = (msg) => console.log(`✓ ${++n} ${msg}`);
const fail = (msg) => { throw new Error(`✗ ${msg}`); };

const mkPage = async (ctx) => {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  return page;
};
const stubApis = async (page, classifyPayload, onChatBody) => {
  await page.route('**/classify', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(classifyPayload) })
  );
  await page.route('**/chat', (route) => {
    onChatBody?.(JSON.parse(route.request().postData() ?? '{}'));
    route.fulfill({
      contentType: 'text/event-stream; charset=utf-8',
      body: 'data: {"delta":"好的喵"}\n\ndata: [DONE]\n\n',
    });
  });
};
const interestsOf = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('sigaoli-zoe-profile') ?? '{}').interests ?? {});

// ---- ①② 深链 chip 渲染与落点 ----
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await mkPage(ctx);
  let chatBody = null;
  await stubApis(page, { chip: 'cv', target: { kind: 'cv', id: 'heywhale', label: '上海和今信息科技有限公司' } }, (b) => { chatBody = b; });
  await page.goto('http://localhost:4321/zh/?zoe-fast', { waitUntil: 'load' });
  await page.click('#chat-fab');
  await page.fill('#chat-input', '他在和今做了什么?');
  await page.press('#chat-input', 'Enter');
  const chip = page.locator('.chat-guide-chip');
  await chip.waitFor({ timeout: 5000 });
  const href = await chip.getAttribute('href');
  const label = await chip.textContent();
  if (href !== '/zh/cv#cv-heywhale') fail(`chip href 应为 /zh/cv#cv-heywhale,实得 ${href}`);
  if (!label.includes('上海和今信息科技有限公司') || !label.includes('去简历找')) fail(`chip 文案不对: ${label}`);
  ok(`深链 chip 渲染: ${label.trim()} → ${href}`);

  await chip.click();
  await page.waitForURL('**/zh/cv**', { timeout: 8000 });
  await page.waitForTimeout(1200); // View Transitions + 时间轴 measure + 兜底 scrollIntoView
  const anchor = page.locator('#cv-heywhale');
  if (!(await anchor.count())) fail('锚点 #cv-heywhale 不存在');
  const box = await anchor.boundingBox();
  const vp = page.viewportSize();
  // 落点=视口 35% 高度(scroll-margin-top:35vh,中间略偏上;Sigao 07-18 定):允许 ±10% 容差
  const y = box?.y ?? -1;
  if (y < vp.height * 0.25 || y > vp.height * 0.45) fail(`锚点应落在视口 35%±10% 高度(${Math.round(vp.height * 0.35)}px),实得 y=${Math.round(y)}`);
  const targeted = await page.evaluate(() => document.querySelector(':target')?.id ?? '');
  if (targeted !== 'cv-heywhale') fail(`:target 应为 cv-heywhale,实得 ${targeted}`);
  ok(`chip 落点: 视口 35% 高度处(y=${Math.round(y)}/${vp.height}) 且 :target 命中(高亮生效)`);
  await page.screenshot({ path: 'shots/guide-cv-anchor.png' });

  // ③ 兴趣注入:画像达标项进 /chat 请求体
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('sigaoli-zoe-profile') ?? '{}');
    p.interests = { work: 120, cv: 30 };
    localStorage.setItem('sigaoli-zoe-profile', JSON.stringify(p));
  });
  await page.reload({ waitUntil: 'load' }); // 重载让模块级画像重新 load
  // 面板开合跨页保持:上一步开过,重载后自动恢复为开——只有关着才点 fab
  if (await page.locator('#chat-panel').isHidden()) await page.click('#chat-fab');
  await page.fill('#chat-input', '推荐我看点什么?');
  await page.press('#chat-input', 'Enter');
  await page.waitForTimeout(1500);
  if (!chatBody) fail('/chat 未捕获请求体');
  if (JSON.stringify(chatBody.interests) !== '["work"]') fail(`interests 应为 ["work"](cv=30 未达 90s 门槛),实得 ${JSON.stringify(chatBody.interests)}`);
  ok('兴趣注入: /chat 请求体只带达标枚举 ["work"],cv 未达门槛不发');
  await ctx.close();
}

// ---- ④ 门控停留计时 ----
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await mkPage(ctx);
  await stubApis(page, { chip: 'none' });
  await page.goto('http://localhost:4321/zh/cv?zoe-fast', { waitUntil: 'load' });
  for (let i = 0; i < 11; i++) { // 保持"有输入"状态,跨过两个 5s 计时步
    await page.mouse.move(300 + i * 10, 400 + (i % 3) * 20);
    await page.waitForTimeout(1050);
  }
  const it = await interestsOf(page);
  if (!(it.cv >= 10)) fail(`停留 ~11s 后 cv 兴趣应 ≥10,实得 ${JSON.stringify(it)}`);
  ok(`门控停留计时: /zh/cv 停留 ~11s → cv=${it.cv} 等效秒`);
  await ctx.close();
}

// ---- ⑤⑥ 深度动作事件 ----
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await mkPage(ctx);
  await stubApis(page, { chip: 'none' });
  await page.goto('http://localhost:4321/zh/work/gisphere-llm?zoe-fast', { waitUntil: 'load' });
  await page.waitForTimeout(600);
  let it = await interestsOf(page);
  if (!(it.work >= 30)) fail(`案例详情页应 +30 work,实得 ${JSON.stringify(it)}`);
  ok(`案例详情事件: 打开 /zh/work/gisphere-llm → work=${it.work}`);

  await page.goto('http://localhost:4321/zh/photography?zoe-fast', { waitUntil: 'load' });
  await page.locator('[data-lightbox]').first().click();
  await page.waitForTimeout(600);
  it = await interestsOf(page);
  if (!(it.photography >= 10)) fail(`灯箱点击应 +10 photography,实得 ${JSON.stringify(it)}`);
  ok(`灯箱事件: 点缩略图 → photography=${it.photography}`);
  await page.keyboard.press('Escape');
  await ctx.close();
}

// ---- ⑦⑧ 引导 chip 跨页存活(08-06:chip 曾只活在 DOM 里,一切页就没了,连点它自己跳转都会丢) ----
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await mkPage(ctx);
  await page.route('**/classify', (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ chip: 'cv', target: { kind: 'cv', id: 'heywhale', label: '上海和今信息科技有限公司' } }) })
  );
  // /chat 拖住不回:复刻「chip 已出、首 token 未到」那个窗口——用户正是在这时点走的
  await page.route('**/chat', async (r) => {
    await new Promise((x) => setTimeout(x, 20000));
    r.fulfill({ contentType: 'text/event-stream; charset=utf-8', body: 'data: {"delta":"好的喵"}\n\ndata: [DONE]\n\n' });
  });
  await page.goto('http://localhost:4321/zh/?zoe-fast', { waitUntil: 'load' });
  await page.click('#chat-fab');
  await page.fill('#chat-input', '他在和今做了什么?');
  await page.press('#chat-input', 'Enter');
  const chip = page.locator('.chat-guide-chip');
  await chip.waitFor({ timeout: 15000 });
  const href = await chip.getAttribute('href');
  if (!(await page.locator('.chat-msg.bot.pending').count())) fail('前置不成立:首 token 已到,测不到目标窗口');

  await chip.click();
  await page.waitForURL('**/zh/cv**', { timeout: 10000 });
  await page.waitForTimeout(1200);
  const kept = await page.locator('.chat-guide-chip');
  if ((await kept.count()) !== 1) fail(`点 chip 跳转后应仍有 1 个 chip,实得 ${await kept.count()}`);
  if ((await kept.getAttribute('href')) !== href) fail('跳转后 chip 指向变了');
  ok(`chip 跨页存活: 点它跳到 ${href} 后仍在(不重复)`);

  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1000);
  if (await page.locator('#chat-panel[hidden]').count()) await page.click('#chat-fab');
  await page.waitForTimeout(600);
  if ((await page.locator('.chat-guide-chip').count()) !== 1) fail('刷新后 chip 未随对话恢复');
  ok('chip 随 history 一起熬过刷新');
  await ctx.close();
}

// ---- ⑨ 未发出的草稿跨页保留(08-06 审计:与 chip 同类,面板 DOM 每页重建会清空输入框) ----
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await mkPage(ctx);
  await stubApis(page, { chip: 'none' });
  await page.goto('http://localhost:4321/zh/?zoe-fast', { waitUntil: 'load' });
  await page.click('#chat-fab');
  const draft = '我想问一个还没打完的问题';
  await page.fill('#chat-input', draft);
  await page.dispatchEvent('#chat-input', 'input');
  await page.evaluate(() => { const a = document.createElement('a'); a.href = '/zh/cv'; document.body.appendChild(a); a.click(); });
  await page.waitForURL('**/zh/cv**', { timeout: 10000 });
  await page.waitForTimeout(1200);
  if ((await page.inputValue('#chat-input')) !== draft) fail('切页后草稿丢失');
  // 高度要量渲染后的真实盒子:隐藏元素 scrollHeight=0,曾把内联高度写成 0px 而 style.height 非空"看着像对"
  const box = await page.evaluate(() => {
    const e = document.getElementById('chat-input');
    return { h: Math.round(e.getBoundingClientRect().height), vis: e.offsetParent !== null };
  });
  if (!box.vis || box.h < 20) fail(`草稿恢复后输入框异常: 高 ${box.h}px 可见=${box.vis}`);
  ok(`草稿跨页保留且输入框高度正常(${box.h}px)`);
  await page.press('#chat-input', 'Enter');
  await page.waitForTimeout(1500);
  if ((await page.inputValue('#chat-input')) !== '') fail('发送后输入框未清空');
  ok('发送后草稿清除');
  await ctx.close();
}

// ---- ⑪ 切语言后 chip 用对应语言的名称(08-06:chip 跨页存活后暴露的夹生句) ----
// 用爱奇艺而非和鲸:后者英文 CV 尚未同步(英文包无此条),会走"对侧缺失→回落本侧名"的兜底分支。
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await mkPage(ctx);
  await page.route('**/classify', (r) =>
    r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        chip: 'cv',
        target: { kind: 'cv', id: 'iqiyi', label: '上海爱奇艺文化传媒有限公司', labels: { zh: '上海爱奇艺文化传媒有限公司', en: 'iQIYI, Inc.' } },
      }),
    })
  );
  await page.route('**/chat', (r) =>
    r.fulfill({ contentType: 'text/event-stream; charset=utf-8', body: 'data: {"delta":"好的喵"}\n\ndata: [DONE]\n\n' })
  );
  await page.goto('http://localhost:4321/zh/?zoe-fast', { waitUntil: 'load' });
  await page.click('#chat-fab');
  await page.fill('#chat-input', '他在爱奇艺做了什么?');
  await page.press('#chat-input', 'Enter');
  await page.locator('.chat-guide-chip').waitFor({ timeout: 10000 });
  const zhLabel = (await page.locator('.chat-guide-chip').textContent()).trim();
  if (!zhLabel.includes('上海爱奇艺文化传媒有限公司')) fail(`中文页 chip 名称不对: ${zhLabel}`);

  await page.evaluate(() => { const a = document.createElement('a'); a.href = '/'; document.body.appendChild(a); a.click(); });
  await page.waitForURL((u) => !u.pathname.startsWith('/zh'), { timeout: 10000 });
  await page.waitForTimeout(1200);
  const enLabel = (await page.locator('.chat-guide-chip').textContent()).trim();
  if (/[一-龥]/.test(enLabel)) fail(`切英文后 chip 仍含中文名: ${enLabel}`);
  if (!enLabel.includes('iQIYI')) fail(`切英文后 chip 名称不对: ${enLabel}`);
  if ((await page.locator('.chat-guide-chip').getAttribute('href')) !== '/cv#cv-iqiyi') fail('切语言后链接未跟随');
  ok(`切语言后 chip 换用对应语言名称: ${enLabel}`);
  await ctx.close();
}

await browser.close();
if (errors.length) { console.error('页面报错:\n' + errors.join('\n')); process.exit(1); }
console.log(`\n全部 ${n} 项通过,0 页面报错`);

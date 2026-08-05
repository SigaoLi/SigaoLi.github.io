// 打字动作语义路由 + 404 双语主副 E2E(2026-08-03):
//   ① 英文路径 404 保持原版式(英文主行在前)
//   ② 中文路径 404 主副对调(中文升主行、中文链接前置、title/lang 跟随)
//   ③ data-swapped 守卫:View Transitions 重复触发不会换回去
//   ④ chip=none(打招呼/问猫自己/跑题)→ proud 傲娇昂首
//   ⑤⑥ chip=cv / work(问正事)→ type 敲地板
//   ⑦ 分类慢于首 token(未回)→ 维持原随机,type/proud 皆合法
// /classify 与 /chat 全部 stub——不耗模型调用,不受限流影响。前置:astro dev(4321)。
// 注:playZ 要等 canplay 才 showEl,故断言片段前须等它真正上屏(只等 state=type 会读到上一段)。
import { chromium } from 'playwright';

const BASE = 'http://localhost:4321';
const browser = await chromium.launch();
const errors = [];
let n = 0;
const ok = (m) => console.log(`✓ ${++n} ${m}`);
const fail = (m) => { throw new Error(`✗ ${m}`); };

const mkPage = async (ctx) => {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  // 本脚本故意访问两个不存在的路径测 404 页,dev server 的 404 响应会记一条 console error——那是预期的
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (/status of 404/.test(m.text())) return;
    errors.push(`console: ${m.text()}`);
  });
  return page;
};

// ---------- ① 404 中文主副对调 ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await mkPage(ctx);

  // 英文路径:英文应是主行(text-sm)且排在中文之前
  await page.goto(`${BASE}/no-such-page`, { waitUntil: 'load' });
  let s = await page.evaluate(() => {
    const main = document.getElementById('nf');
    const kids = [...main.children].map((e) => e.id).filter(Boolean);
    return {
      order: kids,
      en: document.getElementById('nf-en').className,
      zh: document.getElementById('nf-zh').className,
      title: document.title,
      lang: document.documentElement.lang,
      firstLink: document.getElementById('nf-links').firstElementChild.textContent.trim(),
    };
  });
  if (s.order.indexOf('nf-en') > s.order.indexOf('nf-zh')) fail('英文路径下英文应在前');
  if (!s.en.includes('text-sm') || !s.zh.includes('text-xs')) fail(`英文路径主副样式不对: en=${s.en} zh=${s.zh}`);
  if (!s.firstLink.includes('Back to known')) fail(`英文路径返回链接顺序不对: ${s.firstLink}`);
  ok(`英文 404 保持原样: 英文主行(text-sm)在前, 链接「${s.firstLink}」, title「${s.title}」`);

  // 中文路径:中文升主行、英文降副行、中文链接在前、title/lang 跟随
  await page.goto(`${BASE}/zh/no-such-page`, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  s = await page.evaluate(() => {
    const main = document.getElementById('nf');
    return {
      order: [...main.children].map((e) => e.id).filter(Boolean),
      en: document.getElementById('nf-en').className,
      zh: document.getElementById('nf-zh').className,
      title: document.title,
      lang: document.documentElement.lang,
      firstLink: document.getElementById('nf-links').firstElementChild.textContent.trim(),
      swapped: main.dataset.swapped,
    };
  });
  if (s.order.indexOf('nf-zh') > s.order.indexOf('nf-en')) fail(`中文路径下中文应在前, 实得 ${s.order}`);
  if (!s.zh.includes('text-sm') || !s.en.includes('text-xs')) fail(`中文路径主副样式未对调: zh=${s.zh} en=${s.en}`);
  if (!s.firstLink.includes('返回已知疆域')) fail(`中文路径返回链接未前置: ${s.firstLink}`);
  if (s.title !== '404 — 已离开地图') fail(`title 未跟随: ${s.title}`);
  if (s.lang !== 'zh') fail(`lang 未跟随: ${s.lang}`);
  ok(`中文 404 已对调: 中文主行在前, 链接「${s.firstLink}」, title「${s.title}」, lang=${s.lang}`);

  // 守卫:重复触发不会交换回去
  await page.evaluate(() => document.dispatchEvent(new Event('astro:page-load')));
  const after = await page.evaluate(() => [...document.getElementById('nf').children].map((e) => e.id).filter(Boolean));
  if (after.indexOf('nf-zh') > after.indexOf('nf-en')) fail('重复触发把顺序换回去了(守卫失效)');
  ok('data-swapped 守卫: 重复触发不再交换');
  await ctx.close();
}

// ---------- ② 打字动作语义路由 ----------
// 当前可见的 Zoe 片段(showEl 用 .on 标记可见元素)
const visibleClip = (page) =>
  page.evaluate(() => {
    const v = document.querySelector('#zoe-a.on, #zoe-b.on');
    return v ? v.src.split('/zoe/')[1] : null;
  });

const runChat = async (classifyPayload, { classifyDelay = 0, chatDelay = 700 } = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await mkPage(ctx);
  await page.route('**/classify', async (route) => {
    if (classifyDelay) await new Promise((r) => setTimeout(r, classifyDelay));
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(classifyPayload) });
  });
  // chat 略慢于 classify,复刻真实时序(首 token 1-5s vs 分类 1.2-2.1s)
  await page.route('**/chat', async (route) => {
    await new Promise((r) => setTimeout(r, chatDelay));
    route.fulfill({
      contentType: 'text/event-stream; charset=utf-8',
      body: 'data: {"delta":"好的喵"}\n\ndata: [DONE]\n\n',
    });
  });
  // 钉白天:真实深夜(23-6 点)跑时 nightInit 会接管,Zoe 一进站就睡、state 永远等不到 idle
  // ——只覆写 getHours,不碰计时器(沿用 verify-zoe 的做法)。
  await page.addInitScript(() => { Date.prototype.getHours = () => 14; });
  await page.goto(`${BASE}/zh/?zoe-fast&zoe-debug`, { waitUntil: 'load' });
  // 等进场秀演完落到 idle,否则「演出中不打断」会跳过思考/打字
  await page.waitForFunction(() => window.__zoeState?.().state === 'idle', null, { timeout: 20000 });
  await page.click('#chat-fab');
  await page.fill('#chat-input', '测试消息');
  await page.press('#chat-input', 'Enter');
  await page.waitForFunction(() => window.__zoeState?.().state === 'type', null, { timeout: 15000 });
  // playZ 要等 canplay 才 showEl:state 已是 type 时画面可能仍停在 think,须等片段真正上屏
  await page.waitForFunction(
    () => {
      const v = document.querySelector('#zoe-a.on, #zoe-b.on');
      return !!v && /\/(type|proud)\.webm$/.test(v.src);
    },
    null,
    { timeout: 15000 }
  );
  const clip = await visibleClip(page);
  await ctx.close();
  return clip;
};

// none = 打招呼/问猫自己/跑题 → 傲娇昂首
{
  const clip = await runChat({ chip: 'none' });
  if (clip !== 'proud.webm') fail(`chip=none 应播 proud.webm, 实得 ${clip}`);
  ok(`chip=none(问猫自己/闲聊) → ${clip} 傲娇昂首`);
}
// 正事 → 敲地板认真打字
{
  const clip = await runChat({ chip: 'cv', target: { kind: 'cv', id: 'heywhale', label: '上海和今信息科技有限公司' } });
  if (clip !== 'type.webm') fail(`chip=cv 应播 type.webm, 实得 ${clip}`);
  ok(`chip=cv(问正事) → ${clip} 敲地板`);
}
{
  const clip = await runChat({ chip: 'work' });
  if (clip !== 'type.webm') fail(`chip=work 应播 type.webm, 实得 ${clip}`);
  ok(`chip=work(问正事) → ${clip} 敲地板`);
}
// 分类未回(慢于首 token)→ 维持原随机,两者之一皆合法
{
  const clip = await runChat({ chip: 'none' }, { classifyDelay: 6000, chatDelay: 300 });
  if (clip !== 'type.webm' && clip !== 'proud.webm') fail(`分类未回时应随机播 type/proud, 实得 ${clip}`);
  ok(`分类未回(慢 6s) → ${clip} 随机兜底, 不空转不报错`);
}

console.log(`\n页面报错: ${errors.length}${errors.length ? ' → ' + errors.slice(0, 5).join(' | ') : ''}`);
await browser.close();
if (errors.length) process.exit(1);
console.log(`\n✅ 全部 ${n} 项通过`);

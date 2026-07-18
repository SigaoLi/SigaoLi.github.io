// 智能吸底 E2E(07-17 ④):真流式回复期间上滚不被顶回,「回到最新」按钮浮现并可回底。
// 前置:astro dev(4321)+wrangler dev(8787)。注意 /chat 限流 5/min,跑前留余额。
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => { Date.prototype.getHours = () => 14; });
await page.goto('http://localhost:4321/zh/?zoe-fast', { waitUntil: 'load' });
await page.click('#chat-fab');
await page.fill('#chat-input', '详细讲讲他做过的所有项目,每个都展开说说');
await page.press('#chat-input', 'Enter');

// 等流式把 log 撑到可滚(scrollHeight > clientHeight + 80)
await page.waitForFunction(() => {
  const l = document.getElementById('chat-log');
  return l && l.scrollHeight > l.clientHeight + 80;
}, { timeout: 40000 });

// 用户上滚到顶
await page.evaluate(() => { document.getElementById('chat-log').scrollTop = 0; });
await page.waitForTimeout(2500); // 流式继续吐字中
const st = await page.evaluate(() => document.getElementById('chat-log').scrollTop);
if (st > 60) throw new Error(`✗ 上滚后被顶回(scrollTop=${st})`);
console.log(`✓ 流式中上滚不被顶回(scrollTop=${st})`);
const btnVisible = await page.locator('#chat-to-latest').isVisible();
if (!btnVisible) throw new Error('✗ 「回到最新」按钮未浮现');
console.log('✓ 「回到最新」按钮浮现');

await page.click('#chat-to-latest');
await page.waitForTimeout(400);
const back = await page.evaluate(() => {
  const l = document.getElementById('chat-log');
  return l.scrollHeight - l.scrollTop - l.clientHeight;
});
if (back > 60) throw new Error(`✗ 点按钮未回底(距底=${back})`);
const hidden = await page.locator('#chat-to-latest').isHidden();
console.log(`✓ 点按钮回底(距底=${Math.round(back)}),按钮${hidden ? '已隐藏' : '未隐藏(✗)'}`);
await page.waitForTimeout(2000);
const pinnedAgain = await page.evaluate(() => {
  const l = document.getElementById('chat-log');
  return l.scrollHeight - l.scrollTop - l.clientHeight < 60;
});
console.log(`${pinnedAgain ? '✓' : '✗'} 回底后恢复跟随流式`);
await browser.close();
if (!hidden || !pinnedAgain || errors.length) { console.error('页面报错:', errors.join('; ')); process.exit(1); }
console.log('智能吸底 4/4 通过,0 报错');

// V1 聊天浮窗端到端验证:打开面板 → 发送问题 → 等流式回答 → 截图。
// 前置:astro dev(4321)与 wrangler dev(8787)都在运行。
// 用法:node scripts/verify-chat.mjs [zh|en]
import { chromium } from 'playwright';

const lang = process.argv[2] === 'en' ? 'en' : 'zh';
const url = lang === 'zh' ? 'http://localhost:4321/zh/' : 'http://localhost:4321/';
const question = lang === 'zh' ? '他现在在哪里工作?' : 'What are his most notable projects?';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));

await page.goto(url, { waitUntil: 'networkidle' });
await page.click('#chat-fab');
await page.waitForSelector('#chat-panel:not([hidden])');
await page.screenshot({ path: `shots/chat-${lang}-open.png` });

await page.fill('#chat-input', question);
await page.press('#chat-input', 'Enter');
// 等待流式回答完成:.pending 消失且送出按钮恢复可用
await page.waitForSelector('#chat-send:not([disabled])', { timeout: 120000 });
await page.waitForTimeout(300);
await page.screenshot({ path: `shots/chat-${lang}-answer.png` });

const reply = await page.locator('.chat-msg.bot').last().textContent();
console.log(`[${lang}] 回答(前 160 字): ${reply.slice(0, 160)}`);
console.log(`[${lang}] 页面报错: ${errors.length ? errors.join(' | ') : '无'}`);
await browser.close();

// 给验收脚本录 Playwright trace —— 只在失败时留下。
//
// 起因：verify-guide 会间歇性失败，而失败时我们手上只有一行「✗ verify-guide」。
// 2026-09-15 试过刻意复现，两次都通过，CI 也转绿了——没有现场就只能猜。
// Trace 等于把当时的浏览器录下来：每一步的 DOM 快照、网络请求、控制台、截图，
// 可以在 https://trace.playwright.dev 里逐帧回放。
//
// 用法（一行，放在 chromium.launch() 之后）：
//   const browser = await chromium.launch();
//   traceOnFailure(browser, 'verify-guide');
//
// 做法是包装 newContext 与 ctx.close：每个 context 一开就开始录，关之前先落盘。
// 脚本本身一个字都不用改——它照常 newContext/close，不知道有人在旁边录像。
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'shots/traces';

/**
 * @param {import('playwright').Browser} browser
 * @param {string} name  用于文件名，通常就是脚本名
 */
export function traceOnFailure(browser, name) {
  mkdirSync(DIR, { recursive: true });
  let n = 0;
  const pending = new Set();
  const written = [];   // 本次自己写出的 trace，退出时只清这些

  const origNewContext = browser.newContext.bind(browser);
  browser.newContext = async (...args) => {
    const ctx = await origNewContext(...args);
    const file = join(DIR, `${name}-${++n}.zip`);
    // sources:false —— 源码快照会把 trace 撑大好几倍，而我们要看的是页面状态
    await ctx.tracing.start({ screenshots: true, snapshots: true, sources: false });
    pending.add(ctx);

    const origClose = ctx.close.bind(ctx);
    ctx.close = async (...a) => {
      // 必须先停录再关 context，否则这段录像就没了
      if (pending.delete(ctx)) { written.push(file); await ctx.tracing.stop({ path: file }).catch(() => {}); }
      return origClose(...a);
    };
    return ctx;
  };

  const flush = async () => {
    for (const ctx of [...pending]) {
      pending.delete(ctx);
      const f = join(DIR, `${name}-${++n}.zip`);
      written.push(f);
      await ctx.tracing.stop({ path: f }).catch(() => {});
    }
  };

  const origBrowserClose = browser.close.bind(browser);
  browser.close = async (...a) => { await flush(); return origBrowserClose(...a); };

  // ⚠️ 断言失败时脚本是**抛异常直接退出**的，ctx.close 与 browser.close 都不会被调到，
  // 录像也就永远停不下来、一个字节都不落盘——而那正是唯一需要它的时刻。
  // （第一版就栽在这里：注入一个必定失败的断言，trace 目录空空如也。）
  // process.on('exit') 里没法 await，所以要在这两个异步钩子里收尾。
  let dying = false;
  const bail = async (err) => {
    if (dying) return;
    dying = true;
    console.error(err?.stack ?? String(err));
    await flush();
    process.exit(1);
  };
  process.on('unhandledRejection', bail);
  process.on('uncaughtException', bail);

  // 通过就不留 —— 否则每次跑完都堆一批几 MB 的 zip。
  // ⚠️ 只删**本次自己写的那几个文件**，不要删整个目录：连跑时后一次成功
  // 会把前一次失败留下的证据一起抹掉（2026-09-16 就这么弄丢过一份现场，
  // 当时正等着用它查 verify-guide）。
  process.on('exit', (code) => {
    if (code !== 0) return;
    for (const f of written) {
      try { if (existsSync(f)) rmSync(f, { force: true }); } catch { /* 删不掉就算了，不值得为此报错 */ }
    }
  });
}

// 真模型探针:照片总数×4 + vibe coding 出处×1(07-17 ①②) + 时间线阶段归属×2(08-05)
// /chat 限流 5/min/IP,故分两批、批间等一分钟——整跑约 2-3 分钟,属于真模型测试的合理代价。
const ask = async (lang, content) => {
  const r = await fetch('http://localhost:8787/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lang, messages: [{ role: 'user', content }] }),
  });
  if (!r.ok) return `HTTP ${r.status}`;
  const t = await r.text();
  let acc = '';
  for (const l of t.split('\n')) {
    if (!l.startsWith('data:') || l.includes('[DONE]')) continue;
    try { const e = JSON.parse(l.slice(5)); if (e.delta) acc += e.delta; } catch {}
  }
  return acc;
};
let pass = 0, fail = 0;
const check = (label, reply, good, bad) => {
  const ok = good.test(reply) && !(bad && bad.test(reply));
  ok ? pass++ : fail++;
  console.log(`${ok ? '✓' : '✗'} ${label}\n  ${reply.slice(0, 120).replace(/\n/g, ' ')}\n`);
};
check('zh 总张数=76', await ask('zh', '他一共拍了多少张照片?'), /76/, /66|77|75/);
check('zh 国家数=6', await ask('zh', '他的照片覆盖几个国家?'), /6 ?个|六个|\b6\b/, /66/);
check('en 总张数=76', await ask('en', 'How many photographs are in Through My Lens?'), /76/, /66|77|75/);
check('zh 数量复合问', await ask('zh', '镜头之下总共多少张?分别是哪些国家?'), /76/, /66/);
check('vibe coding 出处≠简历', await ask('zh', 'vibe coding 这件事他是在哪里说的?'), /页脚|网站/, /简历里(写|说|提)/);

// ---- 第二批:时间线阶段归属(08-05 Sigao 报「本科期间的实习被说成硕士毕业后」) ----
// 简历各分节是倒序,模型叙述时顺着列表写就会把先后搞反;修复=提示词里补一张正序合并时间线。
console.log('（等 65s 让 /chat 限流窗口重置…）\n');
await new Promise((r) => setTimeout(r, 65_000));

// PiinPoint 2023-01~04 在空间分析硕士(2022-09~2023-10)在读期间,不是毕业后
check(
  'PiinPoint 属硕士在读期间',
  await ask('zh', 'PiinPoint 是他硕士毕业后的第一份工作吗?'),
  /不是|并不是|在读|期间|还在念/,
  /毕业后的第一份(工作|实习)(就|正)?是\s*PiinPoint/
);
// 叙述题:搜狐/MioTech/爱奇艺(均 2021,本科期间)必须出现在 PiinPoint(2023)之前
{
  const reply = await ask('zh', '把他从本科到现在的每一段经历按时间顺序讲一遍');
  const iP = reply.indexOf('PiinPoint');
  const late = ['搜狐', '爱奇艺', '颖投', 'MioTech'].filter((n) => {
    const i = reply.indexOf(n);
    return i > -1 && iP > -1 && i > iP;
  });
  const ok = iP === -1 || late.length === 0;
  ok ? pass++ : fail++;
  console.log(`${ok ? '✓' : '✗'} 叙述顺序:2021 实习早于 PiinPoint${late.length ? ` — 错位: ${late.join('/')}` : ''}\n  ${reply.slice(0, 120).replace(/\n/g, ' ')}\n`);
}

console.log(`${pass} 过 / ${fail} 挂`);
process.exit(fail ? 1 : 0);

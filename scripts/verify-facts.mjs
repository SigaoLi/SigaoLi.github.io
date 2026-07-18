// 真模型探针(07-17 ①②):照片总数×4 + vibe coding 出处×1(恰好 5 条=/chat 限流额度)
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
console.log(`${pass} 过 / ${fail} 挂`);
process.exit(fail ? 1 : 0);

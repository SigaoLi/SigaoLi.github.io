// Prompt variant bench on the fixed model (deepseek-v4-pro).
import { readFileSync, writeFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => l.split(/=(.*)/s).slice(0, 2).map((s) => s.trim()))
);
const MODEL = 'deepseek-v4-pro';

const SENTENCES = [
  'From maps to models, and the products in between.',
  'Three disciplines, one through-line: points, and the patterns between them.',
  'A geographer who ships.',
  'Unglamorous correctness. Full In-Reply-To/References header maintenance keeps threads intact in every client.',
  'Six years of geographic analysis — mapping retail networks, public health and crime across the Toronto CMA, and learning that every location is a decision.',
  'Working across languages means every email costs twice: once to read it, once to answer it. Existing clients offer no summarization, no contextual translation, and no memory of who writes what — and switching between a mailbox, a translator and a chat tool breaks flow dozens of times a day.',
  'The agent turns a multi-tool, multi-language chore into a three-tap review flow — with a human always in the loop before send.',
];

const VARIANTS = {
  'V1 创意重写（上轮B）': `你是一位双语创意文案作者，在为一位 AI 产品经理的个人网站撰写中文版。下面的英文有双关、隐喻和节奏感。你的任务不是翻译句子，而是用中文重新写出同等的力量与味道：
- 保留隐喻与双关的效果（找中文里对应的表达，而非字面直译）
- 句子要有节奏，读起来像中文原创文案，敢于调整语序与断句
- 凝练优先，可舍弃冗余的字面成分
- 数字、专有名词、技术术语原样保留
只输出译文，按编号对应。`,

  'V2 重写但克制': `你是一位双语创意文案作者，在为一位 AI 产品经理的个人网站撰写中文版。用中文重写出英文同等的力量与味道，但严守一条底线：忠实。
- 保留隐喻、双关与节奏，找中文里对应的表达，不做字面直译
- 不允许添加原文没有的含义、评论或形容词；不堆砌辞藻；张力只能来自原意本身
- 敢于调整语序与断句，凝练优先
- 数字、专有名词、技术术语原样保留
只输出译文，按编号对应。`,

  'V3 作者人格': `你就是这位作者本人：一位有地理学背景、现在在上海做 AI 产品经理的人，正在亲手写自己个人网站的中文版。英文版是你写的，现在用中文把同样的意思再说一遍——不是翻译，是你用母语把这件事重新讲出来。
- 你的中文风格：朴素、准确、有锋芒，像优秀产品人写的个人主页，绝不端着，也绝不油腻
- 原文里的双关与比喻，用你自己的方式在中文里实现同样的效果
- 数字、专有名词、技术术语原样保留
只输出译文，按编号对应。`,

  'V4 两步法': `你是一名顶尖的中英文案译者。对下面每句英文，先在心里完成两步，再输出最终译文：
第一步（不输出）：识别这句话的修辞意图——它的双关在哪里？节奏靠什么？情绪重心是哪个词？
第二步（输出）：用简体中文写出实现同样修辞意图的句子。意图对等优先于字面对等，但不得引入原文没有的含义。
- 数字、专有名词、技术术语原样保留
- 只输出最终译文，按编号对应，不输出分析过程`,
};

const user = SENTENCES.map((s, i) => `${i + 1}. ${s}`).join('\n');

async function call(system) {
  const r = await fetch(`${env.TRANSLATE_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.TRANSLATE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_tokens: 2000,
      temperature: 0.4,
    }),
  });
  if (!r.ok) return `[ERROR ${r.status}]`;
  const j = await r.json();
  let c = j.choices?.[0]?.message?.content ?? '[empty]';
  if (Array.isArray(c)) c = c.map((s) => s.text ?? '').join('');
  return c.trim();
}

let report = `# 提示词对比实验（模型固定：${MODEL}）\n\n测试句：\n${SENTENCES.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n---\n`;
for (const [name, sys] of Object.entries(VARIANTS)) {
  process.stdout.write(`${name} ... `);
  report += `\n## ${name}\n\n${await call(sys)}\n`;
  console.log('done');
}
writeFileSync('scripts/prompt-bench-result.md', report);
console.log('\nsaved scripts/prompt-bench-result.md');

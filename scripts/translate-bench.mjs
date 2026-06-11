// Translation quality bench: literary-density sentences × candidate models × prompt variants.
import { readFileSync, writeFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => l.split(/=(.*)/s).slice(0, 2).map((s) => s.trim()))
);

const SENTENCES = [
  'From maps to models, and the products in between.',
  'Three disciplines, one through-line: points, and the patterns between them.',
  'A geographer who ships.',
  'Unglamorous correctness. Full In-Reply-To/References header maintenance keeps threads intact in every client.',
  'Six years of geographic analysis — mapping retail networks, public health and crime across the Toronto CMA, and learning that every location is a decision.',
];

const PROMPT_A = `你是一名专业的中英技术翻译，为个人作品集网站将英文内容翻译为简体中文。语气专业、凝练、自然，像中文母语者写的产品案例，不要翻译腔。数字与专有名词原样保留。只输出译文。`;

const PROMPT_B = `你是一位双语创意文案作者，在为一位 AI 产品经理的个人网站撰写中文版。下面的英文句子有双关、隐喻和节奏感。你的任务不是翻译句子，而是用中文重新写出同等的力量与味道：
- 保留隐喻与双关的效果（找中文里对应的表达，而非字面直译）
- 句子要有节奏，读起来像中文原创文案，敢于调整语序与断句
- 凝练优先，可舍弃冗余的字面成分
- 数字、专有名词、技术术语（In-Reply-To 等）原样保留
只输出译文，按编号对应。`;

const MODELS = [
  'deepseek-v4-pro',   // 现役基线
  'deepseek-v4-flash',
  'gpt-5-mini',
  'gemini-3-flash',
  'gpt-5.4-mini',
  'kimi-k2.6',
  'claude-haiku-4-5',
];

const user = SENTENCES.map((s, i) => `${i + 1}. ${s}`).join('\n');

async function call(model, system) {
  const r = await fetch(`${env.TRANSLATE_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.TRANSLATE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_tokens: 1200,
      temperature: 0.4,
    }),
  });
  if (!r.ok) return `[ERROR ${r.status}]`;
  const j = await r.json();
  let c = j.choices?.[0]?.message?.content ?? '[empty]';
  if (Array.isArray(c)) c = c.map((s) => s.text ?? '').join('');
  return c.trim();
}

let report = `# 翻译模型对比实验\n\n测试句：\n${SENTENCES.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n---\n`;

// Baseline: current model + current-style prompt
report += `\n## 基线：deepseek-v4-pro × 旧提示词A\n\n${await call('deepseek-v4-pro', PROMPT_A)}\n`;

// All candidates with improved prompt B
for (const m of MODELS) {
  process.stdout.write(`${m} ... `);
  const out = await call(m, PROMPT_B);
  report += `\n## ${m} × 新提示词B\n\n${out}\n`;
  console.log('done');
}

writeFileSync('scripts/bench-result.md', report);
console.log('\nsaved scripts/bench-result.md');

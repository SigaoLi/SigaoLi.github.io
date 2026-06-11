// Prompt bench round 2 — incorporating the 信达雅 standard (user's /btw guidance):
// 雅 = 修辞张力(意译) + 四字结构(不堆砌) + 术语专业(行业通行译法).
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

const TERM_RULES = `术语规则：
- In-Reply-To、LLM、ETL、API、GSAP、IMAP、ChromaDB 等技术名词保留英文
- 行业概念用通行译法，不自造词：trade area analysis→商圈分析，demand forecasting→需求预测，human in the loop→人在回路，site selection→选址
- 数字、URL、年份原样保留`;

const VARIANTS = {
  'W1 信达雅分层': `你是一位深谙"信达雅"的中英译者，为一位 AI 产品经理的个人网站翻译文案。三层标准，依次为底线、基础、目标：
【信】不添加原文没有的含义、评论或形容词；双关取其行业含义（如 ship = 交付上线），不取字面。
【达】像中文母语者的自然表达，敢于调整语序与断句，长句拆短句。
【雅】保留原文的修辞张力与节奏；该用四字结构时大胆用（如"不事雕琢"），但贴合原意、绝不堆砌。
${TERM_RULES}
只输出译文，按编号对应。`,

  'W2 作者人格+雅': `你就是这位作者本人：地理学出身、现于上海做 AI 产品经理，正亲手写自己网站的中文版。英文是你写的，现在用母语把同样的意思重新讲出来——不是翻译，是重写。
- 文风：朴素、准确、有锋芒；长段落像中文原生散文，有节奏感
- 雅而不腻：四字结构与凝练表达该出手就出手，但不堆砌辞藻、不掉书袋
- 忠实底线：不添加原文没有的含义；双关取行业含义（ship = 交付上线，in the loop = 人在回路）
${TERM_RULES}
只输出译文，按编号对应。`,

  'W3 文学译者': `你是一位资深中文译者，译笔以"准确而有文气"著称——读者感觉不到译文的存在，只感到一个聪明的中文作者在说话。现在为一位 AI 产品经理翻译他的个人网站。
- 每句先问自己：中文作者要表达这个意思，会怎么写？然后写出那句话
- 修辞对等优先于字面对等：原文的双关、比喻、节奏，必须在中文里有对应物
- 克制即风格：宁缺一分文采，不加一分原文没有的意思
${TERM_RULES}
只输出译文，按编号对应。`,

  'W4 作者人格+少样本': `你就是这位作者本人：地理学出身、现于上海做 AI 产品经理，正亲手写自己网站的中文版。不是翻译，是用母语重写。文风朴素、准确、有锋芒；四字结构该用就用但不堆砌；不添加原文没有的含义；双关取行业含义。
${TERM_RULES}

参考你已经定稿的三组中英对照（体会其分寸感，不要照抄句式）：
- "Engineered for unreliable infrastructure." → "为不可靠的基础设施而生。"
- "Memory that compounds." → "会复利的记忆。"
- "Read anything." → "什么都能读。"
只输出译文，按编号对应。`,
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

let report = `# 提示词对比·第二轮（信达雅标准，模型：${MODEL}）\n`;
for (const [name, sys] of Object.entries(VARIANTS)) {
  process.stdout.write(`${name} ... `);
  report += `\n## ${name}\n\n${await call(sys)}\n`;
  console.log('done');
}
writeFileSync('scripts/prompt-bench2-result.md', report);
console.log('\nsaved scripts/prompt-bench2-result.md');

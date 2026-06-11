// Build-time translation pipeline (PRD §10.2). Runs LOCALLY only — the key
// lives in .env and never enters git or CI. Translated output is committed
// and human-reviewed; manually edited targets are never overwritten.
//
// Usage: node scripts/translate.mjs [--force]
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

// --- env ---
const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => l.split(/=(.*)/s).slice(0, 2).map((s) => s.trim()))
);
const { TRANSLATE_API_BASE: BASE, TRANSLATE_API_KEY: KEY, TRANSLATE_MODEL: MODEL } = env;
if (!BASE || !KEY || !MODEL) throw new Error('Missing .env entries');

const FORCE = process.argv.includes('--force');
const CACHE_PATH = 'scripts/.translate-cache.json';
const cache = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, 'utf8')) : {};
const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

// W1「信达雅分层」— 2026-06-11 两轮提示词对比实验的胜出版本（见 scripts/prompt-bench*-result.md）
const SYSTEM = `你是一位深谙"信达雅"的中英译者，为一位 AI 产品经理的个人作品集网站翻译内容。三层标准，依次为底线、基础、目标：
【信】不添加原文没有的含义、评论或形容词；双关与行话取其行业含义（如 ship = 交付上线，in the loop = 人在回路），不取字面。
【达】像中文母语者的自然表达，敢于调整语序与断句，长句拆短句。
【雅】保留原文的修辞张力与节奏；该用四字结构时大胆用（如 unglamorous correctness→"不事雕琢的正确"），但贴合原意、绝不堆砌。

硬性规则：
1. 数字、百分比、年份、URL、代码、文件名、YAML 的 key 一律原样保留，绝不改动。
2. 技术专有名词保留英文：LLM, API, GSAP, Astro, Python, LangChain, ChromaDB, Ollama, Playwright, IMAP, SMTP, mem0, Qwen, DeepSeek, GPT, Gemini, Claude, BERT, Transformer, MySQL, Streamlit, Plotly, Azure, ETL, Feishu(译为飞书), GIS, SWOT, MOST, PESTLE, CQC, k-NN, OCR, VLM, CuPy, PyMuPDF, Tesseract, trafilatura, Sankey 等。
3. 行业概念用通行译法，不自造词：trade area analysis→商圈分析，demand forecasting→需求预测，site selection→选址，human in the loop→人在回路。
4. 机构名用通行中文译名：University of Bristol→布里斯托大学，Toronto Metropolitan University→多伦多都会大学，Ryerson University→瑞尔森大学，University of Toronto→多伦多大学，University of Waterloo→滑铁卢大学，IBM→IBM，GISphere→GISphere，Ebest Mobile→意鹰科技（Ebest Mobile）。
5. 只输出翻译结果本身，不要任何解释或代码围栏。`;

async function llm(user) {
  const resp = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: user },
      ],
      max_tokens: 6000,
      temperature: 0.2,
    }),
  });
  if (!resp.ok) throw new Error(`${resp.status} ${await resp.text()}`);
  const data = await resp.json();
  let c = data.choices[0].message.content;
  if (Array.isArray(c)) c = c.map((s) => s.text ?? '').join('');
  // strip accidental code fences
  return c.replace(/^```[a-z]*\n?/, '').replace(/\n?```\s*$/, '').trim();
}

async function processFile(srcPath, dstPath, makePrompt) {
  const src = readFileSync(srcPath, 'utf8');
  const srcHash = hash(src);
  const entry = cache[dstPath];

  if (!FORCE && entry && entry.srcHash === srcHash && existsSync(dstPath)) {
    const cur = hash(readFileSync(dstPath, 'utf8'));
    if (cur === entry.outHash) return console.log(`SKIP (cached)   ${dstPath}`);
    return console.log(`SKIP (override) ${dstPath} — 目标文件被人工修改过，保护不覆盖`);
  }
  if (!FORCE && entry && existsSync(dstPath)) {
    const cur = hash(readFileSync(dstPath, 'utf8'));
    if (cur !== entry.outHash)
      return console.log(`SKIP (override) ${dstPath} — 源已更新但目标被人工修改过，请手动合并`);
  }

  process.stdout.write(`TRANSLATING     ${dstPath} ... `);
  const out = await llm(makePrompt(src));
  writeFileSync(dstPath, out.endsWith('\n') ? out : out + '\n');
  cache[dstPath] = { srcHash, outHash: hash(readFileSync(dstPath, 'utf8')) };
  console.log('done');
}

const mdPrompt = (src) =>
  `下面是一个 Astro 内容文件（YAML frontmatter + Markdown 正文）。请输出完整的翻译版本：frontmatter 中仅翻译 title、tagline、summary、metrics 的 label、projects 的 title 与 abstract 的值；其余字段（slug、year、role、tags、repoUrl、org、featured、order、image、pdf、github、link、value）原样保留；正文全部翻译，保留 Markdown 结构（## 标题、**加粗**、列表）。\n\n${src}`;

const cvPrompt = (src) =>
  `下面是一个简历 JSON 文件。请输出完整的翻译版 JSON：翻译 title、location、bullets、awards 的 title、certifications 的 title 的值；org 字段按系统规则翻译机构名；start/end/year/coords/skills/_note 及所有 key 原样保留；"present" 保留为 "present"。确保输出是合法 JSON。\n\n${src}`;

// --- run ---
mkdirSync('src/content/cases-zh', { recursive: true });
mkdirSync('src/content/research-zh', { recursive: true });

for (const f of readdirSync('src/content/cases').filter((f) => f.endsWith('.md'))) {
  await processFile(join('src/content/cases', f), join('src/content/cases-zh', f), mdPrompt);
}
for (const f of readdirSync('src/content/research').filter((f) => f.endsWith('.md'))) {
  await processFile(join('src/content/research', f), join('src/content/research-zh', f), mdPrompt);
}
await processFile('src/data/cv.json', 'src/data/cv.zh.json', cvPrompt);

writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
console.log('\nCache saved. Review the zh output before committing (PRD 复核检查点).');

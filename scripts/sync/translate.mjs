// 双向翻译。两个方向用两个模型，因为它们要求的能力不同：
//   zh→en  claude-opus-4-5  —— 实测风格最贴近现有英文原文（cookie banners /
//          naive crawlers / validates），用词最克制
//   en→zh  deepseek-v4-pro  —— 保持不动。那套「信达雅」提示词是 2026-06 两轮
//          对比实验选出来的（scripts/prompt-bench*-result.md），没理由推翻
//
// 不设人工复核（设计 §11）的前提是：可机械验的部分必须真的机械验。
// checkPreserved 把关不可译字段，不通过即当翻译失败、走重试。
export const MODEL_ZH2EN = 'claude-opus-4-5';
export const MODEL_EN2ZH = 'deepseek-v4-pro';
const RETRIES = 3;

const SYS_ZH2EN = `You are translating a Chinese personal-portfolio site into English.

Register: professional and precise, the way a strong CV or a research group's project
page reads. Not marketing copy.

Rules:
1. Numbers, percentages, years, URLs, code, filenames and YAML keys stay exactly as they are.
2. Keep technical terms in their standard English form (LLM, API, ETL, GIS, VLM, RAG, ESG).
3. Established English names for organizations: 布里斯托大学→University of Bristol,
   多伦多都会大学→Toronto Metropolitan University, 瑞尔森大学→Ryerson University,
   意鹰科技→Ebest Mobile, 和鲸科技/上海和今信息科技→Heywhale, 易智瑞→GeoScene.
4. American spelling: organization, visualization, optimization, analyze.
5. In the YAML metrics block, each label starts lowercase — it reads as a continuation
   of the number beside it ("150 reports targeted across 49 companies").
6. Prefer concrete verbs. Avoid "leveraged", "utilized", "cutting-edge", "state-of-the-art",
   "seamlessly", "robust" unless the Chinese really says so.
7. Do not add meaning, praise or adjectives the Chinese does not have.
8. Output only the translation. No explanation, no code fences.`;

// en→zh 沿用 scripts/translate.mjs 里那套两轮实验选定的 W1「信达雅分层」
const SYS_EN2ZH = `你是一位深谙"信达雅"的中英译者，为一位 AI 产品经理的个人作品集网站翻译内容。三层标准，依次为底线、基础、目标：
【信】不添加原文没有的含义、评论或形容词；双关与行话取其行业含义（如 ship = 交付上线，in the loop = 人在回路），不取字面。
【达】像中文母语者的自然表达，敢于调整语序与断句，长句拆短句。
【雅】保留原文的修辞张力与节奏；该用四字结构时大胆用，但贴合原意、绝不堆砌。

硬性规则：
1. 数字、百分比、年份、URL、代码、文件名、YAML 的 key 一律原样保留，绝不改动。
2. 技术专有名词保留英文：LLM, API, GSAP, Astro, Python, Playwright, GIS, ETL, VLM, RAG, ESG 等。
3. 行业概念用通行译法：trade area analysis→商圈分析，demand forecasting→需求预测，human in the loop→人在回路。
4. 机构名用通行中文译名：University of Bristol→布里斯托大学，Toronto Metropolitan University→多伦多都会大学，Ryerson University→瑞尔森大学，Ebest Mobile→意鹰科技，Heywhale→和鲸科技。
5. 只输出翻译结果本身，不要任何解释或代码围栏。`;

/** 从文本里挖出「必须原样出现在译文里」的东西 */
const preservedTokens = (src) => [
  ...new Set([
    ...(src.match(/https?:\/\/[^\s"')>\]]+/g) ?? []),          // URL
    ...(src.match(/\b\d[\d.,]*%?\+?\b/g) ?? []),                // 数字与百分比
    ...(src.match(/^\s*(?:year|order|role|featured|tags):.*$/gm) ?? []).map((s) => s.trim()),
  ]),
].filter((t) => t.length > 0);

/**
 * 机械校验：不可译的东西有没有被译掉或改写。
 * @returns {{ok:boolean, missing:string[]}}
 */
export function checkPreserved(src, out) {
  const missing = preservedTokens(src).filter((t) => !out.includes(t));
  return { ok: missing.length === 0, missing };
}

const defaultBackoff = (n) => [1000, 4000, 9000][n] ?? 9000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 传了 `existing`（对面现有的译文）时，改为「修订」而不是「重译」——
 * 只动真正需要动的地方，其余沿用原有措辞。
 *
 * 为什么要这条：实测只改中文一个词组（数十家→上百家），整篇重译会顺手把
 * 人工润色过的用词一起磨平——air-gapped→running fully offline、
 * cookie walls→cookie banners、lookalike→similar。译文本身没错，但笔迹没了。
 * 这与语义判定的初衷是同一件事：别让机器冲掉人写的东西。
 */
const REVISE_NOTE = `

【重要】下面附上对面现有的译文。它多半经过人工润色，用词是刻意选的。
请把这次当作**修订**而非重译：
- 逐句比对，只改动那些因原文变化而**确实不再准确**的地方
- 其余句子、词组、标点**原样保留**，即使你觉得有更好的说法
- 尤其不要替换已有的精准用词（如 air-gapped、cookie walls、lookalike 这类）
- 输出仍是完整文件，但应与现有译文尽可能接近`;

/**
 * @param {{dir:'zh2en'|'en2zh', text:string, existing?:string}} job
 * @param {{fetch:Function, base:string, key:string, backoffMs?:Function}} deps
 * @returns {Promise<string>}
 */
export async function translate(job, deps) {
  const { fetch: doFetch, base, key, backoffMs = defaultBackoff } = deps;
  const zh2en = job.dir === 'zh2en';
  const model = zh2en ? MODEL_ZH2EN : MODEL_EN2ZH;
  const system = zh2en ? SYS_ZH2EN : SYS_EN2ZH;
  const instruction = zh2en
    ? '下面是一个双语网站的内容片段。请输出完整的英文版本，保留原有的 Markdown / YAML 结构。'
    : '下面是一个双语网站的内容片段。请输出完整的中文版本，保留原有的 Markdown / YAML 结构。';
  const user = job.existing
    ? `${instruction}${REVISE_NOTE}\n\n【改动后的原文】\n${job.text}\n\n【对面现有译文】\n${job.existing}`
    : `${instruction}\n\n${job.text}`;

  let last;
  for (let i = 0; i < RETRIES; i++) {
    if (i > 0) await sleep(backoffMs(i - 1));
    try {
      const r = await doFetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
          max_tokens: 8000,
          temperature: 0.2,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status} ${await r.text()}`);
      const d = await r.json();
      let c = d.choices?.[0]?.message?.content ?? '';
      if (Array.isArray(c)) c = c.map((x) => x.text ?? '').join('');
      const out = c.replace(/^```[a-z]*\n?/i, '').replace(/\n?```\s*$/, '').trim();
      const chk = checkPreserved(job.text, out);
      if (!chk.ok) throw new Error(`校验未过，译文里丢了不可译内容：${chk.missing.slice(0, 4).join(' / ')}`);
      return out;
    } catch (e) { last = e; }
  }
  throw new Error(`翻译失败（已重试 ${RETRIES} 次）：${last.message}`);
}

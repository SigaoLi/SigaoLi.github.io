// 语义判定：内容改了之后，对面的译文还准不准。
//
// 这是整条链路省钱又省心的关键——翻译是贵的那一步，只在真需要时才跑；
// 纯润色的提交只花判定钱，而且**不会冲掉人工润色过的对面译文**。
//
// 选型（docs/bilingual-sync-design.md §3）：23 个真实改动样本、两次独立复跑，
// gpt-5.6-sol 23/23 且零假阴性，1.8s 最快。原任 deepseek-v4-pro 只有 21/23、
// 两个假阴性且最慢（6.8s）。假阴性 = 判成「只是润色」而其实改了事实 →
// 对面悄悄过时，是这里唯一真正危险的失败方向。
export const GATE_MODEL = 'gpt-5.6-sol';
const RETRIES = 3;

const PROMPT = ({ dir, before, after, other }) => {
  const [A, B] = dir === 'zh' ? ['中文', '英文'] : ['英文', '中文'];
  return `一个双语网站的${A}内容刚被作者改动。判断：**改动后，现有的${B}译文是否仍然准确？**

【改动前的${A}】
${before}

【改动后的${A}】
${after}

【现有${B}译文】
${other}

判断标准：
- 只是措辞、语序、标点、语气、Markdown 标记的调整，事实与论点未变 → ${B}仍准确，无需重译
- 增删或修改了任何事实、数字、范围、程度、专有名词、论点 → ${B}已过时，必须重译
- 宁可多译一次，也不要让${B}悄悄过时

只输出 JSON：{"stale": true/false, "why": "一句话理由"}`;
};

/**
 * 宽松解析：只认 stale 这个布尔字段。
 * 不用 JSON.parse——模型的中文理由里常带「」『』等引号，严格解析会挂，
 * 而挂掉若被当成 false 就是最危险的情况。
 */
export function parseVerdict(raw) {
  const s = String(raw).replace(/^```[a-z]*\n?/i, '').replace(/\n?```\s*$/, '').trim();
  const m = s.match(/"?stale"?\s*[:=]\s*(true|false)/i);
  if (!m) throw new Error(`判定结果读不出 stale 字段：${s.slice(0, 160)}`);
  return { stale: m[1].toLowerCase() === 'true', why: (s.match(/"why"\s*:\s*"?([^"\n}]{0,120})/) ?? [])[1]?.trim() ?? '' };
}

const defaultBackoff = (n) => [1000, 4000, 9000][n] ?? 9000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {{dir:'zh'|'en', before:string, after:string, other:string}} change
 * @param {{fetch:Function, base:string, key:string, backoffMs?:Function}} deps
 * @returns {Promise<{stale:boolean, why:string}>}
 */
export async function isStale(change, deps) {
  const { fetch: doFetch, base, key, backoffMs = defaultBackoff } = deps;
  let last;
  for (let i = 0; i < RETRIES; i++) {
    if (i > 0) await sleep(backoffMs(i - 1));
    try {
      const r = await doFetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: GATE_MODEL, messages: [{ role: 'user', content: PROMPT(change) }], max_tokens: 3000, temperature: 0 }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status} ${await r.text()}`);
      const d = await r.json();
      let c = d.choices?.[0]?.message?.content ?? '';
      if (Array.isArray(c)) c = c.map((x) => x.text ?? '').join('');
      return parseVerdict(c);
    } catch (e) { last = e; }
  }
  throw new Error(`语义判定失败（已重试 ${RETRIES} 次）：${last.message}`);
}

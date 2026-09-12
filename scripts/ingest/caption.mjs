// 用 claude-opus-4-5 看图写中英文案。文案会同时用于：网格 alt、hover 城市名、
// 灯箱描述、以及 Zoe 的知识包语料（src/lib/knowledge/photos.ts 从 photos.json 汇总）。
//
// 模型选型见 docs/photo-ingest-design.md §2：实测 opus 两张样本全对，是唯一
// 认出厦门双子塔的；对照组 gpt-5.6-terra 把它看成摩天轮且自评置信度 0.96
// ——所以不采信模型自评的 confidence，也不设自动放行闸门。

export const MODEL = 'claude-opus-4-5';
const RETRIES = 3;

const SYSTEM = `你在为一个个人摄影作品集写图片描述。每张图产出一句英文 alt 和一句中文 alt。
要求：
1. 只描述画面里真实可见的东西；能认出具体地点/建筑就点名，认不出就宁可说得笼统，绝不编造。
2. 中文不是英文的直译，各自成句。
3. 简短、具体、不抒情过度、结尾不加句号。
4. city / cityZh 只写单个城市名，不带省份或国家（写 "Xiamen" 不是 "Xiamen, Fujian"）。
只输出 JSON，不要代码围栏：{"alt":"...","altZh":"...","city":"...","cityZh":"..."}`;

/** 把 "Xiamen, Fujian" / "福建厦门" 这类收敛成单个城市名 */
const oneCity = (s) => String(s).split(/[,，、]/)[0].trim();

/** @returns {{alt:string, altZh:string, city:string, cityZh:string}} */
export function parseCaption(raw) {
  const text = String(raw).replace(/^```[a-z]*\n?/i, '').replace(/\n?```\s*$/, '').trim();
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error(`无法解析模型返回的 JSON：${text.slice(0, 200)}`);
  }
  for (const k of ['alt', 'altZh', 'city', 'cityZh']) {
    if (!obj[k] || typeof obj[k] !== 'string') throw new Error(`模型返回缺少字段 ${k}`);
  }
  return {
    alt: obj.alt.trim(),
    altZh: obj.altZh.trim(),
    city: oneCity(obj.city),
    cityZh: oneCity(obj.cityZh),
  };
}

const defaultBackoff = (attempt) => [1000, 4000, 9000][attempt] ?? 9000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 同样的退避重试，包住任意一次 chat/completions 调用，返回纯文本内容 */
async function call(messages, deps) {
  const { fetch: doFetch, base, key, backoffMs = defaultBackoff } = deps;
  let lastErr;
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    if (attempt > 0) await sleep(backoffMs(attempt - 1));
    try {
      const resp = await doFetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: MODEL, max_tokens: 2000, messages }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status} ${await resp.text()}`);
      const data = await resp.json();
      return data.choices?.[0]?.message?.content ?? '';
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`模型调用失败（已重试 ${RETRIES} 次）：${lastErr.message}`);
}

/**
 * 新国家的中文名。只在 photos.json 里没有该国条目时调用一次。
 * @returns {Promise<string>}
 */
export async function translateCountryName(englishName, deps) {
  const raw = await call([
    { role: 'system', content: '把国家名译成通行的简体中文译名。只输出译名本身，不要引号、标点或任何解释。' },
    { role: 'user', content: englishName },
  ], deps);
  return String(raw).trim().replace(/^["'“”「]+|["'“”」。．.]+$/g, '').trim();
}

/**
 * @param {object} photo
 * @param {string} photo.imageB64   1024px JPEG 的 base64
 * @param {number} [photo.lng]
 * @param {number} [photo.lat]
 * @param {string} photo.shotAt
 * @param {Array<{alt:string, altZh:string}>} photo.samples  同国已有文案，做 few-shot
 * @param {object} deps
 */
export async function writeCaption(photo, deps) {
  const where = photo.lat != null ? `GPS ${photo.lat}°, ${photo.lng}°` : '无 GPS 信息';
  const examples = photo.samples.length
    ? `\n\n同一作品集里已有的文案，请对齐这个语感：\n${photo.samples.map((s) => `- "${s.alt}" / "${s.altZh}"`).join('\n')}`
    : '';

  const content = await call([
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: [
        { type: 'text', text: `拍摄信息：${where}，拍摄于 ${photo.shotAt}。${examples}` },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${photo.imageB64}` } },
      ],
    },
  ], deps);
  return parseCaption(content);
}

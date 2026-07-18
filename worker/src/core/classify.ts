// /classify — 轻量意图分类 → 引导 chip(§23.5);并复用于回头客「问名」的名字提取(mode:'name')。
// 深链升级(07-17 定案):除版块级 chip 外,可选输出具体目标(案例 slug / CV 条目 id)——
// 候选清单来自知识包(构建期同源,内容更新自动跟随),模型输出必须命中白名单才采信,
// 不命中一律降级回版块级(防幻觉+防注入;target 的 label 也取自知识包,不用模型文本)。
// 与 /chat 并行、独立限流桶、失败静默——绝不阻塞或影响主回复(硬原则)。
// 模型(Sigao 定):主 deepseek-v4-flash → 回退 NewAPI/gpt-4.1-nano → 启发式(chip 用关键词 / name 用规则)。
// EU/EEA/UK 访客:同样避开 DeepSeek,仅走 NewAPI/nano(与主回复 EU 路由一致,fail-closed)。
import { LIMITS } from './config';
import { json } from './http';
import { getKnowledge } from './knowledge';
import { isEuLike } from './providers';
import type { PackCvEntry, PackLangSlice, ProviderSecrets, Runtime } from './types';

export type Chip = 'work' | 'cv' | 'photography' | 'email' | 'none';
const CHIPS: readonly Chip[] = ['work', 'cv', 'photography', 'email', 'none'];
const CLASSIFY_TIMEOUT_MS = 10_000;

/** 深链目标:kind=case→/work/<id>,kind=cv→/cv#cv-<id>;label 来自知识包(可信),前端做 chip 文案 */
export interface GuideTarget {
  kind: 'case' | 'cv';
  id: string;
  label: string;
}
export interface Catalog {
  cases: { id: string; label: string }[];
  cv: { id: string; label: string }[];
}

// 深链候选清单:案例=slug+标题;CV=有 id 的时间轴条目(机构为 label,公司名引导正是主场景)。
// 旧版知识包缓存里条目无 id → cv 清单为空,自然只剩版块级,无兼容问题。
export function buildCatalog(slice: PackLangSlice): Catalog {
  const entries: (PackCvEntry | undefined)[] = [
    slice.cv.current,
    ...slice.cv.experience,
    ...slice.cv.research,
    ...slice.cv.education,
    ...slice.cv.volunteering,
  ];
  return {
    cases: slice.cases.map((c) => ({ id: c.slug, label: c.title })),
    cv: entries
      .filter((e): e is PackCvEntry & { id: string } => !!e?.id)
      .map((e) => ({ id: e.id, label: e.org })),
  };
}

// 模型输出的 target 过白名单:不命中=丢弃(只留版块级 chip);命中=chip 与 kind 对齐。
export function resolveTarget(raw: unknown, catalog: Catalog | null): GuideTarget | null {
  if (!catalog || typeof raw !== 'object' || raw === null) return null;
  const t = raw as { kind?: unknown; id?: unknown };
  if (t.kind !== 'case' && t.kind !== 'cv') return null;
  if (typeof t.id !== 'string') return null;
  const hit = (t.kind === 'case' ? catalog.cases : catalog.cv).find((x) => x.id === t.id);
  return hit ? { kind: t.kind, id: hit.id, label: hit.label } : null;
}

interface ClassifierProvider {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

// 分类器回退链:非 EU = deepseek-v4-flash → newapi/nano;EU = 仅 newapi/nano(不发中国)。
export function classifierChain(secrets: ProviderSecrets, euLike: boolean): ClassifierProvider[] {
  const flash: ClassifierProvider[] = secrets.deepseekApiKey
    ? [{ name: 'deepseek/v4-flash', baseUrl: 'https://api.deepseek.com/v1', apiKey: secrets.deepseekApiKey, model: 'deepseek-v4-flash' }]
    : [];
  const nano: ClassifierProvider[] =
    secrets.newapiApiKey && secrets.newapiBaseUrl
      ? [{ name: 'newapi/gpt-4.1-nano', baseUrl: secrets.newapiBaseUrl.replace(/\/$/, ''), apiKey: secrets.newapiApiKey, model: 'gpt-4.1-nano' }]
      : [];
  return euLike ? nano : [...flash, ...nano];
}

const SYS_INTENT_EN = `You route a visitor's message on Sigao Li's personal portfolio site to at most one navigation suggestion. Reply ONLY with compact JSON: {"chip":"work|cv|photography|email|none","target":{"kind":"case|cv","id":"<id>"}|null}.
- work: projects, case studies, what he built, experience with a skill/tech
- cv: background, education, career history, resume
- photography: his photos, travel, "Through My Lens"
- email: wants to contact / hire / collaborate, or asks how to reach him
- none: greetings, questions about you (the cat), off-topic, or nothing above clearly fits
target: only when the message clearly refers to ONE specific item below, set target to its kind and id; otherwise null. Never invent ids.`;

const SYS_INTENT_ZH = `你把访客在李思高个人网站上的消息，归类到至多一个导航建议。只回紧凑 JSON：{"chip":"work|cv|photography|email|none","target":{"kind":"case|cv","id":"<id>"}|null}。
- work：项目、案例、他做过什么、某项技能/技术的经验
- cv：背景、学历、履历、简历
- photography：他的照片、旅行、「镜头之下」
- email：想联系/招聘/合作，或问怎么联系他
- none：打招呼、问你(猫)本身、跑题、或以上都不明确匹配
target：仅当消息明确指向下方清单中的某一个具体条目时，填它的 kind 和 id；指向模糊或不确定一律填 null。禁止编造 id。`;

// 候选清单拼进 system(紧凑行);无目录(知识包拉取失败/旧包)时不拼,模型自然只出版块级。
function intentSystem(lang: 'en' | 'zh', catalog: Catalog | null): string {
  const base = lang === 'zh' ? SYS_INTENT_ZH : SYS_INTENT_EN;
  if (!catalog || (!catalog.cases.length && !catalog.cv.length)) return base;
  const list = (items: { id: string; label: string }[]) => items.map((x) => `  ${x.id}: ${x.label}`).join('\n');
  return lang === 'zh'
    ? `${base}\n可选 target 清单：\n案例(kind=case)：\n${list(catalog.cases)}\n简历条目(kind=cv)：\n${list(catalog.cv)}`
    : `${base}\nAvailable targets:\ncases (kind=case):\n${list(catalog.cases)}\nCV entries (kind=cv):\n${list(catalog.cv)}`;
}

const SYS_NAME_EN = `The visitor was just asked what to call them. Extract their name/nickname from the reply. Reply ONLY with compact JSON: {"name":"<the name, or empty string>"}.
- If they gave a name/nickname (e.g. "Alex", "I'm Sam", "call me J"), put just the name (strip prefixes like "I'm"/"call me").
- If they declined, deflected, or answered something else instead of a name, put an empty string.
- name = the name only, <=20 chars, no explanation.`;

const SYS_NAME_ZH = `访客刚被问到怎么称呼。从 ta 的回复里提取名字/昵称。只回紧凑 JSON：{"name":"<名字，没有则空字符串>"}。
- 若 ta 给了名字/昵称（如「小明」「我叫 Alex」「叫我阿猫」），name 填名字本身（去掉「我叫/我是/叫我」等前缀）。
- 若 ta 拒绝、回避、或答的是别的问题而非名字，name 填空字符串。
- name 只放名字本身，不超过 20 字，不含解释。`;

function safeJson(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/); // 推理模型可能在 JSON 前带杂字,兜底抽第一个 {...}
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}

// 通用:调某分类器做一次 JSON 抽取,返回解析后的对象;任何失败返回 null。
async function callJson(p: ClassifierProvider, system: string, message: string): Promise<Record<string, unknown> | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CLASSIFY_TIMEOUT_MS);
  try {
    const resp = await fetch(`${p.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.apiKey}` },
      body: JSON.stringify({
        model: p.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: message },
        ],
        temperature: 0,
        max_tokens: 1000, // v4 系带 reasoning_tokens 须给足(实测坑);json 产物本身很短
        response_format: { type: 'json_object' },
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    return typeof content === 'string' ? safeJson(content) : null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// 关键词启发式(意图分类器全失败时的兜底):宁缺毋滥,只认明显信号。
function heuristicChip(message: string): Chip {
  const m = message.toLowerCase();
  if (/联系|邮箱|邮件|合作|招聘|contact|reach|hire|hiring|recruit|\bjob\b|collaborat/.test(m)) return 'email';
  if (/照片|摄影|拍照|旅行|photo|photograph|lens|travel/.test(m)) return 'photography';
  if (/简历|学历|教育|背景|履历|resume|\bcv\b|education|background|degree/.test(m)) return 'cv';
  if (/项目|作品|案例|做过|经验|project|portfolio|case|built|experience|\bwork\b/.test(m)) return 'work';
  return 'none';
}

// 名字清洗:去换行/控制符/会破坏结构的字符,截断——纯卫生(v1 名字只客户端用于问候,不进 prompt)。
function cleanName(raw: string): string {
  return raw
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[#*`<>{}[\]|]/g, '')
    .trim()
    .slice(0, 40);
}

// 名字启发式兜底:先排除拒绝语,再剥离常见前缀,短且不像句子/问句才当名字。
function heuristicName(message: string): string {
  const m = message.trim();
  if (/^(不|别|no|nope|skip|pass|算了|不用|不想|拒绝|not now|maybe later|prefer not)/i.test(m)) return '';
  const stripped = m.replace(/^(我叫|我是|叫我|名字是|我的名字是|call me|i'?m|i am|my name is|name'?s)\s*/i, '').trim();
  if (stripped && stripped.length <= 20 && !/[?？。!！,，]/.test(stripped) && stripped.split(/\s+/).length <= 3) {
    return cleanName(stripped);
  }
  return '';
}

export async function classifyIntent(
  secrets: ProviderSecrets,
  message: string,
  lang: 'en' | 'zh',
  euLike: boolean,
  catalog: Catalog | null
): Promise<{ chip: Chip; target: GuideTarget | null; via: string }> {
  const sys = intentSystem(lang, catalog);
  for (const p of classifierChain(secrets, euLike)) {
    const parsed = await callJson(p, sys, message);
    const chip = parsed?.chip;
    if (typeof chip === 'string' && CHIPS.includes(chip as Chip)) {
      const target = resolveTarget(parsed?.target, catalog);
      // 白名单命中即采信 target,chip 与 kind 对齐(模型偶尔 chip/target 不一致时以 target 为准)
      return { chip: target ? (target.kind === 'case' ? 'work' : 'cv') : (chip as Chip), target, via: p.name };
    }
  }
  return { chip: heuristicChip(message), target: null, via: 'heuristic' };
}

export async function extractName(
  secrets: ProviderSecrets,
  message: string,
  lang: 'en' | 'zh',
  euLike: boolean
): Promise<{ name: string; via: string }> {
  const sys = lang === 'zh' ? SYS_NAME_ZH : SYS_NAME_EN;
  for (const p of classifierChain(secrets, euLike)) {
    const parsed = await callJson(p, sys, message);
    if (parsed && typeof parsed.name === 'string') return { name: cleanName(parsed.name), via: p.name };
  }
  return { name: heuristicName(message), via: 'heuristic' };
}

export async function handleClassify(request: Request, rt: Runtime): Promise<Response> {
  // 独立限流桶('c:'+ip):与 /chat 分开;超限静默返回空结果(引导/问名都是可选,不报错)
  if (!(await rt.rateLimit(`c:${rt.clientIp(request)}`))) return json({ chip: 'none', name: '' });
  let body: { lang?: string; message?: string; mode?: string };
  try {
    body = (await request.json()) as { lang?: string; message?: string; mode?: string };
  } catch {
    return json({ chip: 'none', name: '' });
  }
  const lang = body.lang === 'en' ? 'en' : 'zh';
  const message = (body.message ?? '').slice(0, LIMITS.maxUserChars).trim();
  if (!message) return json({ chip: 'none', name: '' });
  const euLike = isEuLike(rt.country(request));

  if (body.mode === 'name') {
    const { name, via } = await extractName(rt.secrets, message, lang, euLike);
    console.log(`[classify] mode=name lang=${lang} eu=${euLike} got=${name ? 'yes' : 'no'} via=${via}`);
    return json({ name });
  }

  // 深链候选目录:知识包拉取失败不致命(catalog=null → 仅版块级),分类照常
  let catalog: Catalog | null = null;
  try {
    catalog = buildCatalog((await getKnowledge(rt.knowledgeUrl))[lang]);
  } catch { /* 知识包抖动时静默降级 */ }

  const { chip, target, via } = await classifyIntent(rt.secrets, message, lang, euLike, catalog);
  console.log(`[classify] lang=${lang} eu=${euLike} chip=${chip} target=${target ? `${target.kind}:${target.id}` : '-'} via=${via}`);
  return json(target ? { chip, target } : { chip });
}

# 双向内容同步 · 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 改中文还是改英文都行，另一边在 `git commit` 时自动跟上，不用指定方向。

**Architecture:** pre-commit 钩子的第二条链路，与照片入站并列。三层判定：哈希（变没变）→ 语义（变得要紧吗）→ 翻译。纯函数模块各自可测，模型调用由参数注入 `fetch`。

**Tech Stack:** Node 24 内置 `node --test`，零新增依赖。语义判定 `gpt-5.6-sol`，zh→en 翻译 `claude-opus-4-5`，en→zh 沿用 `deepseek-v4-pro`，均经 `.env` 的 NewAPI 网关。

**设计依据：** `docs/bilingual-sync-design.md`

---

## 文件结构

| 文件 | 职责 |
|---|---|
| `scripts/sync/pairs.mjs` | 枚举受管文件对，判断每对的状态（都没变/单边变/都变/新增/删除）。纯函数 |
| `scripts/sync/cv-entries.mjs` | 把 cv.json 拆成可比对的条目单元，以及把改动写回。纯函数 |
| `scripts/sync/gate.mjs` | 语义判定：这个改动让对面过时了吗。`fetch` 注入 |
| `scripts/sync/translate.mjs` | 双向翻译 + 写盘前机械校验。`fetch` 注入 |
| `scripts/sync/baseline.mjs` | 读写 `.sync-baseline.json`。纯函数 |
| `scripts/sync.mjs` | 编排器：查改动 → 串各步 → 汇总 → 退出码 |
| `.githooks/pre-commit` | 追加调用 `sync.mjs` |

测试与被测模块同目录，命名 `*.test.mjs`。

---

## Task 1: 基线读写

**Files:**
- Create: `scripts/sync/baseline.mjs`
- Test: `scripts/sync/baseline.test.mjs`

- [ ] **Step 1: 写失败的测试**

创建 `scripts/sync/baseline.test.mjs`：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { hashOf, pairState } from './baseline.mjs';

test('同样的内容得同样的哈希', () => {
  assert.equal(hashOf('abc'), hashOf('abc'));
  assert.notEqual(hashOf('abc'), hashOf('abd'));
});

test('两边都没变', () => {
  const base = { en: hashOf('E'), zh: hashOf('Z') };
  assert.equal(pairState(base, 'E', 'Z').kind, 'unchanged');
});

test('只有中文变了', () => {
  const base = { en: hashOf('E'), zh: hashOf('Z') };
  const s = pairState(base, 'E', 'Z2');
  assert.equal(s.kind, 'one-side');
  assert.equal(s.changed, 'zh');
});

test('只有英文变了', () => {
  const base = { en: hashOf('E'), zh: hashOf('Z') };
  const s = pairState(base, 'E2', 'Z');
  assert.equal(s.kind, 'one-side');
  assert.equal(s.changed, 'en');
});

test('两边都变了', () => {
  const base = { en: hashOf('E'), zh: hashOf('Z') };
  assert.equal(pairState(base, 'E2', 'Z2').kind, 'both');
});

test('没有基线记录的单边内容算新增，不算删除', () => {
  // 关键护栏：刚写好的新文件对面还没有，绝不能误判成「对面被删了」
  assert.equal(pairState(null, 'E', null).kind, 'new');
  assert.equal(pairState(null, null, 'Z').kind, 'new');
});

test('有基线记录而一边消失了，算删除', () => {
  const base = { en: hashOf('E'), zh: hashOf('Z') };
  const s = pairState(base, null, 'Z');
  assert.equal(s.kind, 'deleted');
  assert.equal(s.gone, 'en');
});

test('两边都消失了算彻底删除', () => {
  const base = { en: hashOf('E'), zh: hashOf('Z') };
  assert.equal(pairState(base, null, null).kind, 'gone');
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
node --test "scripts/sync/baseline.test.mjs"
```
预期：FAIL，`Cannot find module './baseline.mjs'`

- [ ] **Step 3: 实现**

创建 `scripts/sync/baseline.mjs`：

```js
// 基线 = 「对面译文当初是照着哪一版内容生成的」，不是「上次看到的版本」。
// 这个区别很要紧：判为「只是润色、不用翻」时**不推进基线**，否则十次各自
// 无害的微调叠起来可能已经变了意思，却因为每次只跟上一次比而永远触发不了。
import { createHash } from 'node:crypto';

export const hashOf = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

/**
 * @param {{en:string, zh:string}|null} base  该文件对的基线；null = 管线从没见过它
 * @param {string|null} en  当前英文内容；null = 文件不存在
 * @param {string|null} zh  当前中文内容
 * @returns {{kind:'unchanged'|'one-side'|'both'|'new'|'deleted'|'gone', changed?:'en'|'zh', gone?:'en'|'zh'}}
 */
export function pairState(base, en, zh) {
  // 没有基线 = 管线没见过这对。此时单边存在只可能是「新增」，
  // 绝不能当成「对面被删了」——那会把刚写好的文件删掉。
  if (!base) return { kind: 'new' };

  if (en === null && zh === null) return { kind: 'gone' };
  if (en === null) return { kind: 'deleted', gone: 'en' };
  if (zh === null) return { kind: 'deleted', gone: 'zh' };

  const enChanged = hashOf(en) !== base.en;
  const zhChanged = hashOf(zh) !== base.zh;

  if (!enChanged && !zhChanged) return { kind: 'unchanged' };
  if (enChanged && zhChanged) return { kind: 'both' };
  return { kind: 'one-side', changed: enChanged ? 'en' : 'zh' };
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
node --test "scripts/sync/baseline.test.mjs"
```
预期：8 个测试全 PASS

- [ ] **Step 5: 提交**

```bash
git add scripts/sync/baseline.mjs scripts/sync/baseline.test.mjs
git commit -m "Tell a new file apart from a deleted counterpart

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: 枚举受管文件对

**Files:**
- Create: `scripts/sync/pairs.mjs`
- Test: `scripts/sync/pairs.test.mjs`

- [ ] **Step 1: 写失败的测试**

创建 `scripts/sync/pairs.test.mjs`：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { listPairs } from './pairs.mjs';

test('枚举出现有的 12 对', () => {
  const p = listPairs();
  assert.equal(p.length, 12, `应为 12 对，实得 ${p.length}`);
});

test('每对都给出中英两侧路径与稳定的键', () => {
  for (const p of listPairs()) {
    assert.ok(p.key && p.en && p.zh, JSON.stringify(p));
    assert.ok(existsSync(p.en), `英文侧不存在: ${p.en}`);
    assert.ok(existsSync(p.zh), `中文侧不存在: ${p.zh}`);
  }
});

test('键用英文侧路径，且正斜杠（跨平台一致）', () => {
  const keys = listPairs().map((p) => p.key);
  assert.ok(keys.includes('src/content/cases/csr-scraper.md'), keys.join(','));
  assert.ok(keys.includes('src/data/cv.json'));
  assert.ok(!keys.some((k) => k.includes('\\')), '键里不该有反斜杠');
});

test('CV 标记为结构化，Markdown 标记为整文件', () => {
  const byKey = Object.fromEntries(listPairs().map((p) => [p.key, p]));
  assert.equal(byKey['src/data/cv.json'].kind, 'cv');
  assert.equal(byKey['src/content/cases/csr-scraper.md'].kind, 'md');
});

test('不把 i18n.ts 与 knowledge/ 纳入', () => {
  const keys = listPairs().map((p) => p.key).join(' ');
  assert.ok(!keys.includes('i18n'), '手写双语，不走机翻');
  assert.ok(!keys.includes('knowledge'), '只有中文，做英文层是新内容不是同步');
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
node --test "scripts/sync/pairs.test.mjs"
```
预期：FAIL，`Cannot find module './pairs.mjs'`

- [ ] **Step 3: 实现**

创建 `scripts/sync/pairs.mjs`：

```js
// 受管的双语文件对。范围刻意限定（见 docs/bilingual-sync-design.md §9）：
//   src/lib/i18n.ts        手写双语，Sigao 定过不走机翻
//   src/data/knowledge/*   只有中文；做英文层是新内容，不是同步，该单独立项
import { readdirSync, existsSync } from 'node:fs';

const MD_DIRS = [
  { en: 'src/content/cases', zh: 'src/content/cases-zh' },
  { en: 'src/content/research', zh: 'src/content/research-zh' },
];

/** @returns {Array<{key:string, en:string, zh:string, kind:'md'|'cv'}>} */
export function listPairs() {
  const out = [];
  for (const d of MD_DIRS) {
    if (!existsSync(d.en)) continue;
    for (const f of readdirSync(d.en).filter((f) => f.endsWith('.md'))) {
      out.push({ key: `${d.en}/${f}`, en: `${d.en}/${f}`, zh: `${d.zh}/${f}`, kind: 'md' });
    }
  }
  out.push({ key: 'src/data/cv.json', en: 'src/data/cv.json', zh: 'src/data/cv.zh.json', kind: 'cv' });
  return out;
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
node --test "scripts/sync/pairs.test.mjs"
```
预期：5 个测试全 PASS

- [ ] **Step 5: 提交**

```bash
git add scripts/sync/pairs.mjs scripts/sync/pairs.test.mjs
git commit -m "List the file pairs that are kept in step

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: CV 拆条目

**Files:**
- Create: `scripts/sync/cv-entries.mjs`
- Test: `scripts/sync/cv-entries.test.mjs`

**背景**：cv.json 各区结构不同，实测确认（见设计 §8）——

| 区 | 处理 |
|---|---|
| `current` `education` `experience` `research` `volunteering` | 按 `id` 逐条 |
| `awards` `certifications` | 按数组下标成对（实测中英下标严格对齐） |
| **`skills`** | **绝不碰**。en 是 `{data,frameworks,tools}` 对象、zh 是数组，PRD v2.3 的有意设计 |
| `_note` | 跳过，英文元数据备注 |

- [ ] **Step 1: 写失败的测试**

创建 `scripts/sync/cv-entries.test.mjs`：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toUnits, applyUnit, removeUnit } from './cv-entries.mjs';

const en = () => JSON.parse(readFileSync('src/data/cv.json', 'utf8'));
const zh = () => JSON.parse(readFileSync('src/data/cv.zh.json', 'utf8'));

test('有 id 的区按 id 出单元', () => {
  const u = toUnits(en());
  assert.ok(u['experience:heywhale'], Object.keys(u).slice(0, 8).join(','));
  assert.ok(u['research:ra-nlp']);
  assert.ok(u['current:ebest']);
});

test('无 id 的区按下标出单元', () => {
  const u = toUnits(en());
  assert.ok(u['awards:0']);
  assert.ok(u['certifications:1']);
});

test('skills 与 _note 不出单元', () => {
  const keys = Object.keys(toUnits(en()));
  assert.ok(!keys.some((k) => k.startsWith('skills')), 'skills 中英结构不同，绝不能同步');
  assert.ok(!keys.some((k) => k.startsWith('_note')), '_note 是英文元数据');
});

test('中英单元键完全一致', () => {
  const a = Object.keys(toUnits(en())).sort();
  const b = Object.keys(toUnits(zh())).sort();
  assert.deepEqual(a, b, '中英 id/下标应逐一对齐');
});

test('applyUnit 按 id 就地替换，不动别的条目', () => {
  const data = en();
  const before = data.experience.length;
  const out = applyUnit(data, 'experience:heywhale', { id: 'heywhale', title: 'X', org: 'Y', start: '2026-01', end: '2026-04', bullets: [] });
  assert.equal(out.experience.length, before);
  assert.equal(out.experience.find((e) => e.id === 'heywhale').title, 'X');
  assert.equal(data.experience.find((e) => e.id === 'heywhale').title, 'Consulting Project Manager', '不该改动传入对象');
});

test('applyUnit 对不存在的 id 是追加', () => {
  const out = applyUnit(en(), 'experience:brandnew', { id: 'brandnew', title: 'N', org: 'O', start: '2026-05', end: 'present', bullets: [] });
  assert.ok(out.experience.some((e) => e.id === 'brandnew'));
});

test('removeUnit 删掉指定条目', () => {
  const out = removeUnit(en(), 'awards:0');
  assert.equal(out.awards.length, en().awards.length - 1);
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
node --test "scripts/sync/cv-entries.test.mjs"
```
预期：FAIL，`Cannot find module './cv-entries.mjs'`

- [ ] **Step 3: 实现**

创建 `scripts/sync/cv-entries.mjs`：

```js
// 把 cv.json 拆成可逐条比对的单元。各区结构不同，实测确认：
//   有 id 的区      → 按 id（中英 id 共用，是深链设计时就定的）
//   awards/certs    → 无 id，按数组下标（实测中英下标严格对齐）
//   skills          → **绝不碰**：en 是 {data,frameworks,tools} 对象、zh 是数组，
//                     PRD v2.3 的有意设计，渲染层兼容两形态，同步会把页面搞坏
//   _note           → 跳过，是英文元数据备注，中英本就一字不差

const ID_SECTIONS = ['current', 'education', 'experience', 'research', 'volunteering'];
const INDEX_SECTIONS = ['awards', 'certifications'];

/** @returns {Record<string, object>} 单元键 → 条目对象 */
export function toUnits(cv) {
  const out = {};
  for (const s of ID_SECTIONS) {
    const v = cv[s];
    if (!v) continue;
    for (const e of Array.isArray(v) ? v : [v]) if (e?.id) out[`${s}:${e.id}`] = e;
  }
  for (const s of INDEX_SECTIONS) {
    (cv[s] ?? []).forEach((e, i) => { out[`${s}:${i}`] = e; });
  }
  return out;
}

const split = (key) => { const i = key.indexOf(':'); return [key.slice(0, i), key.slice(i + 1)]; };

/** 写回一个单元。返回新对象，不改传入的。 */
export function applyUnit(cv, key, entry) {
  const [section, ref] = split(key);
  const next = structuredClone(cv);
  if (INDEX_SECTIONS.includes(section)) {
    const i = Number(ref);
    if (Number.isInteger(i)) { next[section] = [...(next[section] ?? [])]; next[section][i] = entry; }
    return next;
  }
  if (!Array.isArray(next[section])) { next[section] = entry; return next; } // current 是单对象
  const at = next[section].findIndex((e) => e.id === ref);
  next[section] = [...next[section]];
  if (at === -1) next[section].push(entry);
  else next[section][at] = entry;
  return next;
}

/** 删掉一个单元。返回新对象，不改传入的。 */
export function removeUnit(cv, key) {
  const [section, ref] = split(key);
  const next = structuredClone(cv);
  if (INDEX_SECTIONS.includes(section)) {
    next[section] = (next[section] ?? []).filter((_, i) => i !== Number(ref));
    return next;
  }
  if (Array.isArray(next[section])) next[section] = next[section].filter((e) => e.id !== ref);
  return next;
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
node --test "scripts/sync/cv-entries.test.mjs"
```
预期：7 个测试全 PASS

- [ ] **Step 5: 提交**

```bash
git add scripts/sync/cv-entries.mjs scripts/sync/cv-entries.test.mjs
git commit -m "Cut the CV into units that can be compared one by one

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: 语义判定

**Files:**
- Create: `scripts/sync/gate.mjs`
- Test: `scripts/sync/gate.test.mjs`

**背景**：这是整条链路的核心闸门。23 个真实样本、两次独立复跑，`gpt-5.6-sol` 23/23 且零假阴性（见设计 §3）。测试用注入的假 `fetch`，不发真实请求。

- [ ] **Step 1: 写失败的测试**

创建 `scripts/sync/gate.test.mjs`：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVerdict, isStale, GATE_MODEL } from './gate.mjs';

const reply = (c) => ({ ok: true, json: async () => ({ choices: [{ message: { content: c } }] }) });

test('用的是实测选定的判定模型', () => {
  assert.equal(GATE_MODEL, 'gpt-5.6-sol');
});

test('解析干净的 JSON', () => {
  assert.equal(parseVerdict('{"stale": true, "why": "改了数字"}').stale, true);
  assert.equal(parseVerdict('{"stale": false, "why": "只是措辞"}').stale, false);
});

test('剥掉代码围栏', () => {
  assert.equal(parseVerdict('```json\n{"stale": true, "why": "x"}\n```').stale, true);
});

test('理由里带引号也不崩', () => {
  // 实测 opus 会输出带「」引号的中文理由，早前的严格 JSON.parse 在这里挂过
  const v = parseVerdict('{"stale": true, "why": "把「无法」改成了「难以」"}');
  assert.equal(v.stale, true);
});

test('读不出结论就抛错，而不是默默当成 false', () => {
  // 默默 false = 英文悄悄过时，是这里最危险的失败方向
  assert.throws(() => parseVerdict('我看不懂'), /判定/);
});

test('判定为过时', async () => {
  const r = await isStale(
    { dir: 'zh', before: '旧', after: '新', other: 'old english' },
    { fetch: async () => reply('{"stale": true, "why": "x"}'), base: 'https://x/v1', key: 'k', backoffMs: () => 0 }
  );
  assert.equal(r.stale, true);
});

test('失败会重试，第三次成功则返回', async () => {
  let n = 0;
  const f = async () => { n++; return n < 3 ? { ok: false, status: 504, text: async () => 'gw' } : reply('{"stale": false, "why": "x"}'); };
  const r = await isStale({ dir: 'zh', before: 'a', after: 'b', other: 'c' },
    { fetch: f, base: 'https://x/v1', key: 'k', backoffMs: () => 0 });
  assert.equal(n, 3);
  assert.equal(r.stale, false);
});

test('三次都失败则抛错', async () => {
  const f = async () => ({ ok: false, status: 504, text: async () => 'gw' });
  await assert.rejects(
    isStale({ dir: 'zh', before: 'a', after: 'b', other: 'c' },
      { fetch: f, base: 'https://x/v1', key: 'k', backoffMs: () => 0 }),
    /504/
  );
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
node --test "scripts/sync/gate.test.mjs"
```
预期：FAIL，`Cannot find module './gate.mjs'`

- [ ] **Step 3: 实现**

创建 `scripts/sync/gate.mjs`：

```js
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
```

- [ ] **Step 4: 跑测试确认通过**

```bash
node --test "scripts/sync/gate.test.mjs"
```
预期：8 个测试全 PASS

- [ ] **Step 5: 提交**

```bash
git add scripts/sync/gate.mjs scripts/sync/gate.test.mjs
git commit -m "Ask whether an edit actually changed what the other side must say

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: 双向翻译与机械校验

**Files:**
- Create: `scripts/sync/translate.mjs`
- Test: `scripts/sync/translate.test.mjs`

**背景**：不设人工复核（设计 §11），前提是**可机械验的部分必须真的机械验**。frontmatter 的不可译字段由校验器把关，不通过即视为翻译失败、走重试。

- [ ] **Step 1: 写失败的测试**

创建 `scripts/sync/translate.test.mjs`：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPreserved, translate, MODEL_ZH2EN, MODEL_EN2ZH } from './translate.mjs';

const reply = (c) => ({ ok: true, json: async () => ({ choices: [{ message: { content: c } }] }) });

test('两个方向用实测选定的模型', () => {
  assert.equal(MODEL_ZH2EN, 'claude-opus-4-5');
  assert.equal(MODEL_EN2ZH, 'deepseek-v4-pro'); // 信达雅提示词是两轮实验选出来的，不推翻
});

test('不可译字段被改动即判失败', () => {
  const src = 'year: "2025"\nrepoUrl: "https://github.com/a/b"\norder: 4\nvalue: "150"';
  assert.equal(checkPreserved(src, 'year: "2025"\nrepoUrl: "https://github.com/a/b"\norder: 4\nvalue: "150"').ok, true);
  const bad = checkPreserved(src, 'year: "2026"\nrepoUrl: "https://github.com/a/b"\norder: 4\nvalue: "150"');
  assert.equal(bad.ok, false);
  assert.match(bad.missing.join(' '), /2025/);
});

test('URL 被改写即判失败', () => {
  const src = 'repoUrl: "https://github.com/SigaoLi/UB_RA_CSR"';
  assert.equal(checkPreserved(src, 'repoUrl: "https://github.com/SigaoLi/UB-RA-CSR"').ok, false);
});

test('数字丢失即判失败', () => {
  const src = 'metrics:\n  - { label: "reports", value: "150" }';
  assert.equal(checkPreserved(src, 'metrics:\n  - { label: "报告", value: "15" }').ok, false);
});

test('只有可译文字变了则通过', () => {
  const src = 'title: "ESG Report Intelligence"\nyear: "2025"\norder: 4';
  assert.equal(checkPreserved(src, 'title: "ESG 报告智能系统"\nyear: "2025"\norder: 4').ok, true);
});

test('译文通过校验则返回', async () => {
  const src = 'title: "X"\nyear: "2025"';
  const out = await translate(
    { dir: 'en2zh', text: src },
    { fetch: async () => reply('title: "某某"\nyear: "2025"'), base: 'https://x/v1', key: 'k', backoffMs: () => 0 }
  );
  assert.match(out, /某某/);
});

test('译文改坏了不可译字段 → 重试 → 仍坏则抛错', async () => {
  let n = 0;
  const f = async () => { n++; return reply('title: "某某"\nyear: "2099"'); };
  await assert.rejects(
    translate({ dir: 'en2zh', text: 'title: "X"\nyear: "2025"' },
      { fetch: f, base: 'https://x/v1', key: 'k', backoffMs: () => 0 }),
    /校验/
  );
  assert.equal(n, 3, '应当重试满 3 次');
});

test('剥掉代码围栏', async () => {
  const out = await translate(
    { dir: 'zh2en', text: 'title: "某某"' },
    { fetch: async () => reply('```markdown\ntitle: "X"\n```'), base: 'https://x/v1', key: 'k', backoffMs: () => 0 }
  );
  assert.equal(out, 'title: "X"');
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
node --test "scripts/sync/translate.test.mjs"
```
预期：FAIL，`Cannot find module './translate.mjs'`

- [ ] **Step 3: 实现**

创建 `scripts/sync/translate.mjs`：

```js
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
 * @param {{dir:'zh2en'|'en2zh', text:string}} job
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

  let last;
  for (let i = 0; i < RETRIES; i++) {
    if (i > 0) await sleep(backoffMs(i - 1));
    try {
      const r = await doFetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: system }, { role: 'user', content: `${instruction}\n\n${job.text}` }],
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
```

- [ ] **Step 4: 跑测试确认通过**

```bash
node --test "scripts/sync/translate.test.mjs"
```
预期：8 个测试全 PASS

- [ ] **Step 5: 提交**

```bash
git add scripts/sync/translate.mjs scripts/sync/translate.test.mjs
git commit -m "Translate either direction, and check what must not change

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: 编排器

**Files:**
- Create: `scripts/sync.mjs`
- Modify: `.gitignore`
- Modify: `package.json`

- [ ] **Step 1: 基线文件加进 .gitignore？不——它必须进 git**

基线记录的是「译文照着哪一版生成的」，换台机器 clone 下来必须还在，否则整个管线会把 12 对全判成 `new`。**所以 `scripts/.sync-baseline.json` 要提交**，不加 gitignore。

本步无改动，仅确认这个决定。

- [ ] **Step 2: 写编排器**

创建 `scripts/sync.mjs`：

```js
#!/usr/bin/env node
// 双向内容同步编排器。由 .githooks/pre-commit 调用。
//
// 无改动时立即退出，日常提交零开销。
// 任何一步失败都以非零码退出 → commit 被阻断 → 仓库不会留下半同步的状态。
// 每个文件对独立落地（写盘 → git add → 才推进基线），不攒批——
// 照片管线吃过攒批的亏（见 docs/photo-ingest-design.md §6）。
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { listPairs } from './sync/pairs.mjs';
import { hashOf, pairState } from './sync/baseline.mjs';
import { isStale } from './sync/gate.mjs';
import { translate } from './sync/translate.mjs';
import { toUnits, applyUnit, removeUnit } from './sync/cv-entries.mjs';

const BASELINE = 'scripts/.sync-baseline.json';
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);

const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
const pairs = listPairs();

// 先扫一遍，没有任何改动就别去读 .env、别打扰任何人
const pending = pairs.filter((p) => {
  const s = pairState(baseline[p.key] ?? null, read(p.en), read(p.zh));
  return s.kind !== 'unchanged';
});
if (pending.length === 0) process.exit(0);

console.log(`[双语同步] ${pending.length} 对有改动`);

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => l.split(/=(.*)/s).slice(0, 2).map((s) => s.trim()))
);
if (!env.TRANSLATE_API_BASE || !env.TRANSLATE_API_KEY) {
  console.error('[双语同步] .env 里缺少 TRANSLATE_API_BASE / TRANSLATE_API_KEY');
  process.exit(1);
}
const api = { fetch, base: env.TRANSLATE_API_BASE, key: env.TRANSLATE_API_KEY };

const saveBaseline = () => writeFileSync(BASELINE, JSON.stringify(baseline, null, 2) + '\n');
const stage = (...f) => execFileSync('git', ['add', ...f.filter(Boolean)], { stdio: 'inherit' });

let translated = 0, skipped = 0, rebased = 0;

for (const p of pending) {
  const en = read(p.en), zh = read(p.zh);
  const s = pairState(baseline[p.key] ?? null, en, zh);
  console.log(`  · ${p.key} [${s.kind}]`);

  try {
    // 两边都变 = 人工已做完，不调模型，只把基线推到当前
    if (s.kind === 'both') {
      baseline[p.key] = { en: hashOf(en), zh: hashOf(zh) };
      saveBaseline(); stage(BASELINE);
      console.log('    两边都改过，视为人工已完成，只更新基线');
      rebased++;
      continue;
    }

    // 管线没见过这对：一边有就翻给另一边，两边都有就直接记基线
    if (s.kind === 'new') {
      if (en && zh) {
        baseline[p.key] = { en: hashOf(en), zh: hashOf(zh) };
        saveBaseline(); stage(BASELINE);
        console.log('    首次登记，两边都在，记为基线');
        rebased++;
      } else {
        const dir = en ? 'en2zh' : 'zh2en';
        const out = await translate({ dir, text: en ?? zh }, api);
        const dst = en ? p.zh : p.en;
        writeFileSync(dst, out.endsWith('\n') ? out : out + '\n');
        baseline[p.key] = { en: hashOf(read(p.en)), zh: hashOf(read(p.zh)) };
        saveBaseline(); stage(dst, BASELINE);
        console.log(`    新增，已生成 ${dst}`);
        translated++;
      }
      continue;
    }

    // 一边被删 → 同步删掉另一边（Sigao 定：人为删掉就是要它消失）
    if (s.kind === 'deleted') {
      const dst = s.gone === 'en' ? p.zh : p.en;
      if (p.kind === 'cv') { console.error('    CV 文件整体被删，超出本管线处理范围'); process.exit(1); }
      unlinkSync(dst);
      delete baseline[p.key];
      saveBaseline(); stage(BASELINE); execFileSync('git', ['rm', '--cached', '-q', dst], { stdio: 'inherit' });
      console.log(`    ${s.gone} 侧已删，同步删掉 ${dst}`);
      continue;
    }
    if (s.kind === 'gone') { delete baseline[p.key]; saveBaseline(); stage(BASELINE); continue; }

    // ——— 只有一边变：先问要不要紧 ———
    const changed = s.changed;                 // 'en' | 'zh'
    const dir = changed === 'zh' ? 'zh2en' : 'en2zh';
    const curr = changed === 'zh' ? zh : en;
    const other = changed === 'zh' ? en : zh;

    if (p.kind === 'cv') {
      const r = await syncCv(p, changed, en, zh, api);
      translated += r.translated; skipped += r.skipped;
      continue;
    }

    // 判定要看「改动前后」，所以必须拿得到基线那一版的原文。哈希不可逆，
    // 故从 git 里取 HEAD 版本作为「改动前」——那正是上次提交时的样子。
    // 取不到（新文件、或刚 rebase）时退化为「有变化就重译」，宁可多译一次。
    let before;
    try {
      before = execFileSync('git', ['show', `HEAD:${changed === 'zh' ? p.zh : p.en}`], { encoding: 'utf8' });
    } catch { before = null; }

    const verdict = before === null
      ? { stale: true, why: '取不到改动前的版本，保守重译' }
      : await isStale({ dir: changed, before, after: curr, other }, api);
    if (!verdict.stale) {
      // **不推进基线**：否则多次「各自无害」的润色会累积成真实偏移却永不触发
      console.log(`    判定无需重译（${verdict.why}）—— 基线保持不动`);
      skipped++;
      continue;
    }

    const out = await translate({ dir, text: curr }, api);
    const dst = changed === 'zh' ? p.en : p.zh;
    writeFileSync(dst, out.endsWith('\n') ? out : out + '\n');
    baseline[p.key] = { en: hashOf(read(p.en)), zh: hashOf(read(p.zh)) };
    saveBaseline(); stage(dst, BASELINE);
    console.log(`    已重译 → ${dst}（${verdict.why}）`);
    translated++;
  } catch (e) {
    console.error(`    失败：${e.message}`);
    console.error('    本对未改动，修好后重跑即可。');
    process.exit(1);
  }
}

console.log(`[双语同步] 重译 ${translated} / 判定无需 ${skipped} / 仅更新基线 ${rebased}`);

// ——— CV 走条目级 ———
// 返回计数而不是直接改外层变量——函数里 translated++ 改不到模块级的那两个。
async function syncCv(p, changed, enRaw, zhRaw, api) {
  const enCv = JSON.parse(enRaw), zhCv = JSON.parse(zhRaw);
  const src = changed === 'zh' ? zhCv : enCv;
  const dstCv = changed === 'zh' ? enCv : zhCv;
  const dir = changed === 'zh' ? 'zh2en' : 'en2zh';
  const dstPath = changed === 'zh' ? p.en : p.zh;
  const srcPath = changed === 'zh' ? p.zh : p.en;

  // 改动前的那一版（HEAD），用来给每个条目做语义判定
  let baseUnits = null;
  try { baseUnits = toUnits(JSON.parse(execFileSync('git', ['show', `HEAD:${srcPath}`], { encoding: 'utf8' }))); } catch { /* 取不到就逐条保守重译 */ }

  const srcUnits = toUnits(src), dstUnits = toUnits(dstCv);
  let next = dstCv, changedCount = 0;

  for (const [key, unit] of Object.entries(srcUnits)) {
    const mirror = dstUnits[key];
    const text = JSON.stringify(unit, null, 1);
    if (!mirror) {                                   // 对面没有 → 直接翻译补上
      next = applyUnit(next, key, JSON.parse(await translate({ dir, text }, api)));
      changedCount++;
      console.log(`    + ${key}`);
      continue;
    }
    const mirrorText = JSON.stringify(mirror, null, 1);
    const beforeUnit = baseUnits?.[key];
    // 同 md 分支：拿 HEAD 版本作「改动前」；取不到就保守重译
    const v = beforeUnit
      ? await isStale({ dir: changed, before: JSON.stringify(beforeUnit, null, 1), after: text, other: mirrorText }, api)
      : { stale: true, why: '取不到改动前的条目，保守重译' };
    if (!v.stale) continue;
    next = applyUnit(next, key, JSON.parse(await translate({ dir, text }, api)));
    changedCount++;
    console.log(`    ~ ${key}（${v.why}）`);
  }
  for (const key of Object.keys(dstUnits)) {         // 源侧删了 → 对面同步删
    if (!srcUnits[key]) { next = removeUnit(next, key); changedCount++; console.log(`    - ${key}`); }
  }

  if (changedCount === 0) {
    console.log('    条目级判定：无需改动，基线保持不动');
    return { translated: 0, skipped: 1 };
  }
  writeFileSync(dstPath, JSON.stringify(next, null, 2) + '\n');
  baseline[p.key] = { en: hashOf(read(p.en)), zh: hashOf(read(p.zh)) };
  saveBaseline(); stage(dstPath, BASELINE);
  return { translated: 1, skipped: 0 };
}
```

- [ ] **Step 3: 加 npm 脚本**

`package.json` 的 `scripts` 里加一条（保留现有各条）：

```json
    "sync": "node scripts/sync.mjs"
```

并把测试范围扩到 sync/：

```json
    "test": "node --test \"scripts/ingest/*.test.mjs\" \"scripts/sync/*.test.mjs\"",
```

- [ ] **Step 4: 语法检查与空跑**

```bash
node --check scripts/sync.mjs
npm test
```
预期：`node --check` 无输出；`npm test` 中 ingest 36 个 + sync 36 个全 PASS。

- [ ] **Step 5: 提交**

```bash
git add scripts/sync.mjs package.json
git commit -m "Wire the sync steps together behind one entry point

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: 首次基线化（关键一步）

**Files:**
- Create: `scripts/.sync-baseline.json`（由运行生成）

**背景**：现在 12 对**全是**「两边都改过」状态。第一次跑应当把它们全部记为基线，**一次翻译都不发生**。这既是正确行为，也是这条管线能启动的前提。

- [ ] **Step 1: 确认起始状态**

```bash
node -e "
const {listPairs}=require('./scripts/sync/pairs.mjs');
" 2>/dev/null || node --input-type=module -e "
import { listPairs } from './scripts/sync/pairs.mjs';
console.log('受管文件对：', listPairs().length);
"
```
预期：`受管文件对： 12`

- [ ] **Step 2: 首次运行**

```bash
node scripts/sync.mjs
```

预期输出形如：

```
[双语同步] 12 对有改动
  · src/content/cases/csr-scraper.md [new]
    首次登记，两边都在，记为基线
  ...（12 行）
[双语同步] 重译 0 / 判定无需 0 / 仅更新基线 12
```

**重译必须是 0**。若不是，停下来报告——说明判定链有问题。

- [ ] **Step 3: 核对基线文件**

```bash
node -e "const b=require('./scripts/.sync-baseline.json');console.log('基线条目数:',Object.keys(b).length);console.log('样例:',JSON.stringify(Object.entries(b)[0]))"
```
预期：`基线条目数: 12`，每条含 `en` 与 `zh` 两个哈希。

- [ ] **Step 4: 再跑一次，确认幂等**

```bash
node scripts/sync.mjs
echo "退出码: $?"
```
预期：**无任何输出**，退出码 0（全部 `unchanged`，立即退出）。

- [ ] **Step 5: 确认内容一个字都没被改**

```bash
git status --short -- src/content src/data
```
预期：**空**。只有 `scripts/.sync-baseline.json` 是新增的。

- [ ] **Step 6: 提交基线**

```bash
git add scripts/.sync-baseline.json
git commit -m "Record what each translation was made from

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 8: 挂进钩子

**Files:**
- Modify: `.githooks/pre-commit`
- Modify: `README.md`

- [ ] **Step 1: 钩子追加第二条链路**

`.githooks/pre-commit` 现在是：

```sh
#!/bin/sh
# 照片入站：把 _inbox/ 里的原图分拣进仓库，产物并入本次提交。
# 收件箱为空时 ingest.mjs 立即退出，日常提交不受影响。
exec node scripts/ingest.mjs
```

改为（注意去掉 `exec`，否则第二条永远跑不到）：

```sh
#!/bin/sh
# 提交前的两条自动链路。两者都在「没活干」时立即退出，日常提交零开销。
#   ① 照片入站：_inbox/ 里的原图分拣进仓库
#   ② 双语同步：改了中文或英文，另一边自动跟上
# 任一失败都以非零码退出，commit 随之中止。
set -e
node scripts/ingest.mjs
node scripts/sync.mjs
```

写文件时用 **LF 换行**（`.gitattributes` 已为 `.githooks/*` 锁 LF，但编辑器可能仍写成 CRLF）。

- [ ] **Step 2: 验证钩子两条都会跑且不拖慢空提交**

```bash
git commit --allow-empty -m "probe: both hooks fire on an idle tree"
```
预期：提交正常完成，**无任何输出**（收件箱空 + 无内容改动，两个脚本都立即退出）。

回滚：

```bash
git reset --soft HEAD~1 && git reset
```

- [ ] **Step 3: 验证第二条链路确实会被触发**

改一处中文的纯润色（不改事实）：

```bash
node --input-type=module -e "
import { readFileSync, writeFileSync } from 'node:fs';
const p='src/content/cases-zh/csr-scraper.md';
const s=readFileSync(p,'utf8');
writeFileSync(p, s.replace('人工收集无法规模化', '靠人工收集无法规模化'));
console.log('已做一处纯润色改动');
"
node scripts/sync.mjs
```

预期：判定为**无需重译**，且打印「基线保持不动」。英文文件不该被改动：

```bash
git status --short -- src/content/cases/csr-scraper.md
```
预期：**空**。

还原：

```bash
git checkout -- src/content/cases-zh/csr-scraper.md
```

- [ ] **Step 4: 验证改事实会触发重译**

```bash
node --input-type=module -e "
import { readFileSync, writeFileSync } from 'node:fs';
const p='src/content/cases-zh/csr-scraper.md';
const s=readFileSync(p,'utf8');
writeFileSync(p, s.replace('数十家上市公司', '上百家上市公司'));
console.log('已改一处事实：数十→上百');
"
node scripts/sync.mjs
git diff --stat src/content/cases/csr-scraper.md
```

预期：判定为**过时**并重译，英文文件出现改动，且英文里的 `dozens` 变成了 `hundreds` 之类。

核对不可译字段没被动：

```bash
grep -E "repoUrl|order:|year:|value:" src/content/cases/csr-scraper.md
```
预期：`https://github.com/SigaoLi/UB_RA_CSR`、`order: 4`、`year: "2025"`、`value: "150"` 等全部原样。

还原两侧：

```bash
git checkout -- src/content/cases-zh/csr-scraper.md src/content/cases/csr-scraper.md scripts/.sync-baseline.json
```

- [ ] **Step 5: README 补说明**

在 `README.md` 的 `## Editing content` 一节里，把 Case studies 那条：

```markdown
- **Case studies / research**: edit `src/content/cases/*.md` (en), then run the translate
  script — or edit the `-zh` files directly (they're override-protected afterwards).
```

替换为：

```markdown
- **Case studies / research**: edit either side and commit. The pre-commit hook works out
  which side moved, asks a model whether the edit actually changed what the other side must
  say, and only re-translates when it did — so polishing one language never overwrites your
  wording in the other. Editing both sides in one commit is taken as "already handled by
  hand" and left alone. See `docs/bilingual-sync-design.md`.
```

同一节里 CV 那条：

```markdown
- **CV**: edit `src/data/cv.json` (+ `cv.zh.json`); the timeline, `/resume.json` and
  `/llms-full.txt` all render from it. Replace `public/files/pdf/CV__Sigao_Li.pdf` alongside.
```

替换为：

```markdown
- **CV**: edit `src/data/cv.json` or `cv.zh.json` — the hook keeps the other in step entry by
  entry. The timeline, `/resume.json` and `/llms-full.txt` all render from it. Replace
  `public/files/pdf/CV__Sigao_Li.pdf` alongside. (`skills` is deliberately not synced: the two
  languages use different shapes there and the renderer handles both.)
```

- [ ] **Step 6: 提交**

```bash
git add .githooks/pre-commit README.md
git commit -m "Run bilingual sync from the same pre-commit hook

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 9: 退役旧管线

**Files:**
- Modify: `scripts/translate.mjs`
- Delete: `scripts/.translate-cache.json`

**背景**：`scripts/translate.mjs` 是单向的（en→zh），且它的 override 保护已经让 12 个文件全部停摆——今天跑它一个都翻不动。它的职责已由 `scripts/sync.mjs` 全面接管。

保留文件本身（那套「信达雅」提示词是两轮实验的成果，已被 `sync/translate.mjs` 引用同样的文本），但标为历史件并让它拒绝运行，免得日后有人跑它、把新基线搅乱。

- [ ] **Step 1: 让旧脚本拒绝运行**

在 `scripts/translate.mjs` 第一行之前插入：

```js
// ⚠️ 历史件（2026-09-14 退役），不要运行。职责已由 scripts/sync.mjs 接管——
// 它是双向的，且用语义判定决定要不要重译，不会冲掉人工润色。
// 本文件保留，只因这套 W1「信达雅分层」提示词是 2026-06 两轮对比实验的成果
// （见 scripts/prompt-bench*-result.md），sync/translate.mjs 沿用了同一段文本。
if (!process.env.ALLOW_LEGACY_TRANSLATE) {
  console.error('scripts/translate.mjs 已退役，请用 npm run sync（scripts/sync.mjs）。');
  process.exit(1);
}
```

- [ ] **Step 2: 删掉旧缓存**

```bash
git rm scripts/.translate-cache.json
```

它记的是单向的 `{srcHash, outHash}`，与新的对称基线不兼容，留着只会让人误以为还有效。

- [ ] **Step 3: 确认没有别处引用**

```bash
grep -rn "translate-cache\|translate\.mjs" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=docs . | grep -v "sync/translate"
```
预期：只命中 `scripts/translate.mjs` 自身与 `README.md`（若 README 还提到就一并改掉）。

- [ ] **Step 4: 确认旧脚本确实拒跑**

```bash
node scripts/translate.mjs; echo "退出码: $?"
```
预期：打印退役提示，退出码 1。

- [ ] **Step 5: 提交**

```bash
git add scripts/translate.mjs
git commit -m "Retire the one-way translation pipeline

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 10: 端到端与回归

**Files:** 无改动，纯验证

- [ ] **Step 1: 全套单测**

```bash
npm test
```
预期：ingest 36 + sync 36，全 PASS。

- [ ] **Step 2: 构建与内链**

```bash
npm run build
node scripts/check-links.mjs
```
预期：21 页 0 报错；无断链。

- [ ] **Step 3: 浏览器验收（CI 同款范围）**

```bash
npx astro preview --port 4321 > /tmp/pv.log 2>&1 &
for i in $(seq 1 60); do curl -sf http://localhost:4321/ > /dev/null && break; sleep 1; done
for s in verify-lens verify-nav verify-i18n verify-home verify-work verify-phase4 verify-typeroute verify-guide; do
  node "scripts/$s.mjs" > /dev/null 2>&1 && echo "✓ $s" || echo "✗ $s"
done
pkill -f "astro preview"
```
预期：8 个全 ✓。

- [ ] **Step 4: 确认 CV 条目级路径真的走得通**

改中文 CV 的一条 bullet（改事实）：

```bash
node --input-type=module -e "
import { readFileSync, writeFileSync } from 'node:fs';
const p='src/data/cv.zh.json';
const d=JSON.parse(readFileSync(p,'utf8'));
const e=d.volunteering.find(v=>v.id==='gisource');
e.bullets[1]=e.bullets[1].replace('4 人团队','7 人团队');
writeFileSync(p, JSON.stringify(d,null,2)+'\n');
console.log('已改 gisource 的一条 bullet：4 人→7 人');
"
node scripts/sync.mjs
```

预期：只有 `volunteering:gisource` 被重译，其余条目不动。核对：

```bash
node -e "
const en=require('./src/data/cv.json');
const g=en.volunteering.find(v=>v.id==='gisource');
console.log('英文侧 bullet:', g.bullets[1]);
console.log('其余条目是否未动:', en.volunteering.find(v=>v.id==='cssa').title==='Academic Assistant');
"
git diff --stat src/data/cv.json
```
预期：英文 bullet 里出现 `7`；`cssa` 等其他条目未变；diff 行数很小（只动了一条）。

还原：

```bash
git checkout -- src/data/cv.zh.json src/data/cv.json scripts/.sync-baseline.json
```

- [ ] **Step 5: 确认失败会阻断提交**

```bash
cp .env .env.bak
sed -i 's|^TRANSLATE_API_KEY=.*|TRANSLATE_API_KEY=sk-invalid|' .env
node --input-type=module -e "
import { readFileSync, writeFileSync } from 'node:fs';
const p='src/content/cases-zh/csr-scraper.md';
writeFileSync(p, readFileSync(p,'utf8').replace('数十家','上千家'));
"
git commit --allow-empty -m "test: sync must block on failure"
echo "退出码: $?"
mv .env.bak .env
git checkout -- src/content/cases-zh/csr-scraper.md
```
预期：三次重试后报错，退出码非 0，**提交未产生**（`git log -1` 仍是上一条）。注意重试会真的等 1+4+9 秒。

- [ ] **Step 6: 确认工作区干净**

```bash
git status --short -- src scripts docs README.md .githooks
```
预期：空。

---

## 自检对照

| 设计文档 | 覆盖它的任务 |
|---|---|
| §2 判定链四分支 | Task 1（状态判定）、Task 6（编排各分支） |
| §2 两边都变 → 只记基线 | Task 6 Step 2 的 `both` 分支、Task 7 首次基线化 |
| §4 判为润色则**不推进基线** | Task 6 的 `!verdict.stale` 分支（显式不写 baseline） |
| §5 对称缓存结构 | Task 1、Task 7 |
| §6 三个模型的分工 | Task 4（`GATE_MODEL`）、Task 5（`MODEL_ZH2EN` / `MODEL_EN2ZH`） |
| §7 zh→en 提示词与两条惯例 | Task 5 的 `SYS_ZH2EN`（美式拼写、metrics 小写） |
| §7 13 项机械核验 | Task 5 的 `checkPreserved` + Task 8 Step 4 实跑核对 |
| §8 CV 分区处理 | Task 3（`ID_SECTIONS` / `INDEX_SECTIONS` / 排除 skills 与 _note） |
| §8 CV 新增/删除条目 | Task 3（`applyUnit` 追加 / `removeUnit`）、Task 6 的 `syncCv` |
| §9 范围与排除 | Task 2（`listPairs` + 不含 i18n/knowledge 的测试） |
| §9 新增文件 | Task 6 的 `new` 分支 |
| §9 删除文件的护栏 | Task 1（无基线即 `new`）、Task 6 的 `deleted` 分支 |
| §10 触发、重试、独立落地 | Task 5（重试）、Task 6（每对独立 saveBaseline+stage）、Task 8（钩子） |
| §11 不设人工复核 | 全程无交互；靠 Task 5 的机械校验兜底 |
| 退役旧管线 | Task 9 |

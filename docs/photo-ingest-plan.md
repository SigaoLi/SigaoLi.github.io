# 照片入站自动化 · 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把原图丢进 `_inbox/` 后照常 `git commit`，照片自动完成归档、压缩、定位、配文、登记、计数同步，并并入本次提交。

**Architecture:** 一个 pre-commit 钩子调用编排器 `scripts/ingest.mjs`，编排器串起四个单一职责模块（`country` / `intake` / `caption` / `register`）加计数同步。收件箱为空时立即退出，日常提交零开销。纯函数部分用 Node 内置测试运行器覆盖，网络与文件系统部分注入依赖以便测试。

**Tech Stack:** Node 24（`node --test` 内置测试运行器）、sharp（经 astro 传递依赖，现有脚本已在用）、exifr、d3-geo、topojson-client、world-atlas，全部已在 `package.json`。文案模型 `claude-opus-4-5`，经 `.env` 里的 `TRANSLATE_API_BASE` / `TRANSLATE_API_KEY` 网关调用。

**设计依据：** `docs/photo-ingest-design.md`

---

## 文件结构

| 文件 | 职责 |
|---|---|
| `scripts/ingest/country.mjs` | 坐标 → 国家名/id。含坏多边形黑名单与扩圈兜底。纯函数 |
| `scripts/ingest/photo-meta.mjs` | 文件名/EXIF → 拍摄时间戳。纯函数 |
| `scripts/ingest/register.mjs` | 往 `photos.json` 插条目、按拍摄时间排序、新国家建条目。纯函数（进出都是 JS 对象） |
| `scripts/ingest/counts.mjs` | 同步 README 里的照片总数。纯函数（字符串进、字符串出） |
| `scripts/ingest/caption.mjs` | 调 opus-4-5 写中英文案。`fetch` 由参数注入以便测试 |
| `scripts/ingest/intake.mjs` | 读 EXIF、归档原图、派生 2560px 母版。唯一碰文件系统的模块 |
| `scripts/ingest.mjs` | 编排器：查收件箱 → 串各步 → 汇总 → 退出码 |
| `.githooks/pre-commit` | 调用编排器 |

测试文件与被测模块同目录，命名 `*.test.mjs`。

---

## Task 1: 坐标反查国家

**Files:**
- Create: `scripts/ingest/country.mjs`
- Test: `scripts/ingest/country.test.mjs`

- [ ] **Step 1: 写失败的测试**

创建 `scripts/ingest/country.test.mjs`：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lookupCountry, toCountryId, countryCentroid } from './country.mjs';

test('内陆点直接命中', () => {
  const r = lookupCountry(116.379, 39.894); // 北京琉璃厂
  assert.equal(r.name, 'China');
  assert.equal(r.id, 'china');
  assert.equal(r.via, 'direct');
});

test('海岸点靠扩圈兜底', () => {
  const r = lookupCountry(118.1, 24.4); // 厦门海滨，四舍五入后落在海里
  assert.equal(r.name, 'China');
  assert.equal(r.via, 'ring 0.1°');
});

test('Maldives 坏多边形不会污染结果', () => {
  // 该多边形环绕方向反了，geoContains 判它覆盖几乎全球
  for (const [lng, lat] of [[116.4, 39.9], [-79.4, 43.6], [135.8, 35.0]]) {
    assert.notEqual(lookupCountry(lng, lat).name, 'Maldives');
  }
});

test('美国国名映射到现有 id', () => {
  assert.equal(toCountryId('United States of America'), 'united_states');
  assert.equal(toCountryId('United Kingdom'), 'united_kingdom');
  assert.equal(toCountryId('China'), 'china');
});

test('国家质心可用作新国家锚点', () => {
  const c = countryCentroid('France');
  assert.ok(c && c.lat > 40 && c.lat < 52, `法国质心纬度应在 40-52 之间，得到 ${c?.lat}`);
  assert.equal(countryCentroid('不存在的国'), null);
});

test('现有 78 条坐标全部归到正确国家', () => {
  const WANT = {
    china: 'China', japan: 'Japan', canada: 'Canada',
    united_states: 'United States of America',
    united_kingdom: 'United Kingdom', bahamas: 'Bahamas',
  };
  const photos = JSON.parse(readFileSync('src/data/photos.json', 'utf8'));
  const wrong = [];
  for (const c of photos) {
    for (const it of c.items) {
      if (typeof it.lat !== 'number') continue;
      const r = lookupCountry(it.lng, it.lat);
      if (r?.name !== WANT[c.id]) wrong.push(`${c.id}/${it.src} -> ${r?.name}`);
    }
  }
  assert.deepEqual(wrong, []);
});
```

- [ ] **Step 2: 跑测试确认它失败**

```bash
node --test scripts/ingest/country.test.mjs
```
预期：FAIL，`Cannot find module './country.mjs'`

- [ ] **Step 3: 实现**

创建 `scripts/ingest/country.mjs`：

```js
// 坐标 → 国家。纯几何判定，不用模型。
//
// 两个实测坑（见 docs/photo-ingest-design.md §4）：
// 1. countries-10m 里 Maldives 的环绕方向反了，geoContains 判它覆盖几乎全球。
//    255 个国家里仅此一例，拉黑即可。
// 2. 78 张真实照片里有 16 张落在陆地多边形之外——海岸取景 + 坐标四舍五入
//    到 1 位小数（约 11km）会把临海点推进海里。故无命中时向外扩圈找最近陆地。
import { geoContains, geoCentroid } from 'd3-geo';
import * as topojson from 'topojson-client';
import { readFileSync } from 'node:fs';

const BAD_POLYGONS = ['Maldives'];
const ID_OVERRIDES = { 'United States of America': 'united_states' };
const RINGS = [0.1, 0.25, 0.5, 1.0];
const BEARINGS = 16;

let cached = null;
function features() {
  if (!cached) {
    const topo = JSON.parse(readFileSync('node_modules/world-atlas/countries-10m.json', 'utf8'));
    cached = topojson
      .feature(topo, topo.objects.countries)
      .features.filter((f) => !BAD_POLYGONS.includes(f.properties.name));
  }
  return cached;
}

export const toCountryId = (name) =>
  ID_OVERRIDES[name] ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

const at = (lng, lat) => features().find((f) => geoContains(f, [lng, lat]))?.properties.name ?? null;

/** 国家多边形质心，用作新国家在画廊标题行显示的锚点坐标 */
export function countryCentroid(name) {
  const f = features().find((x) => x.properties.name === name);
  if (!f) return null;
  const [lng, lat] = geoCentroid(f);
  return { lat: Math.round(lat * 10) / 10, lng: Math.round(lng * 10) / 10 };
}

/** @returns {{name: string, id: string, via: string} | null} */
export function lookupCountry(lng, lat) {
  const direct = at(lng, lat);
  if (direct) return { name: direct, id: toCountryId(direct), via: 'direct' };

  for (const r of RINGS) {
    const tally = new Map();
    for (let i = 0; i < BEARINGS; i++) {
      const a = (i / BEARINGS) * 2 * Math.PI;
      // 经度按纬度收缩，保证采样圈在地表近似等距
      const dLng = (r * Math.cos(a)) / Math.cos((lat * Math.PI) / 180);
      const name = at(lng + dLng, lat + r * Math.sin(a));
      if (name) tally.set(name, (tally.get(name) ?? 0) + 1);
    }
    if (tally.size) {
      const [name] = [...tally].sort((a, b) => b[1] - a[1])[0];
      return { name, id: toCountryId(name), via: `ring ${r}°` };
    }
  }
  return null;
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
node --test scripts/ingest/country.test.mjs
```
预期：5 个测试全 PASS。最后一个（78 条坐标）耗时约 10-20 秒，属正常——它对 255 个多边形做全量几何判定。

- [ ] **Step 5: 提交**

```bash
git add scripts/ingest/country.mjs scripts/ingest/country.test.mjs
git commit -m "Look up a photo's country from its coordinates"
```

---

## Task 2: 拍摄时间解析

**Files:**
- Create: `scripts/ingest/photo-meta.mjs`
- Test: `scripts/ingest/photo-meta.test.mjs`

- [ ] **Step 1: 写失败的测试**

创建 `scripts/ingest/photo-meta.test.mjs`：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shotTime } from './photo-meta.mjs';

test('优先用 EXIF 拍摄时间', () => {
  const t = shotTime('whatever.jpg', new Date('2020-05-01T10:00:00Z'));
  assert.equal(t, Date.UTC(2020, 4, 1, 10, 0, 0));
});

test('无 EXIF 时从带下划线的文件名解析', () => {
  assert.equal(shotTime('IMG_20170731_154353.jpg', null), Date.UTC(2017, 6, 31));
});

test('无 EXIF 时从不带下划线的文件名解析', () => {
  assert.equal(shotTime('IMG20260905155409.jpg', null), Date.UTC(2026, 8, 5));
});

test('两种文件名格式排序不会互相颠倒', () => {
  // ASCII 里 '_'(95) > 数字，纯文件名字典序会把 2017 排到 2026 之后
  const a = shotTime('IMG_20170731_154353.jpg', null);
  const b = shotTime('IMG20260905155409.jpg', null);
  assert.ok(a < b, '2017 的照片必须排在 2026 之前');
});

test('完全解析不出时返回 null', () => {
  assert.equal(shotTime('scan-001.jpg', null), null);
});

test('现有 78 个文件名全部可解析', () => {
  const photos = JSON.parse(readFileSync('src/data/photos.json', 'utf8'));
  const bad = [];
  for (const c of photos) {
    for (const it of c.items) if (shotTime(it.src, null) === null) bad.push(`${c.id}/${it.src}`);
  }
  assert.deepEqual(bad, []);
});

test('现有各国顺序等于拍摄时间升序', () => {
  const photos = JSON.parse(readFileSync('src/data/photos.json', 'utf8'));
  for (const c of photos) {
    const ts = c.items.map((i) => shotTime(i.src, null));
    assert.deepEqual(ts, [...ts].sort((a, b) => a - b), `${c.id} 的现有顺序不是时间升序`);
  }
});
```

- [ ] **Step 2: 跑测试确认它失败**

```bash
node --test scripts/ingest/photo-meta.test.mjs
```
预期：FAIL，`Cannot find module './photo-meta.mjs'`

- [ ] **Step 3: 实现**

创建 `scripts/ingest/photo-meta.mjs`：

```js
// 拍摄时间解析 —— photos.json 的条目按拍摄时间排列，不能按文件名字典序：
// 历史上两种命名并存（IMG_20170731_154353 / IMG20260905155409），而 ASCII 里
// '_'(95) 大于数字(48-57)，字典序会把 2017 年的排到 2026 年之后。

const FROM_NAME = /(20\d{2})_?(\d{2})_?(\d{2})/;

/**
 * @param {string} filename
 * @param {Date|string|null} exifDate  EXIF DateTimeOriginal
 * @returns {number|null} 毫秒时间戳
 */
export function shotTime(filename, exifDate) {
  if (exifDate) {
    const t = new Date(exifDate).getTime();
    if (Number.isFinite(t)) return t;
  }
  const m = filename.match(FROM_NAME);
  if (!m) return null;
  const [, y, mo, d] = m;
  return Date.UTC(Number(y), Number(mo) - 1, Number(d));
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
node --test scripts/ingest/photo-meta.test.mjs
```
预期：7 个测试全 PASS

- [ ] **Step 5: 提交**

```bash
git add scripts/ingest/photo-meta.mjs scripts/ingest/photo-meta.test.mjs
git commit -m "Read a photo's shot time from EXIF, falling back to its filename"
```

---

## Task 3: 往 photos.json 登记

**Files:**
- Create: `scripts/ingest/register.mjs`
- Test: `scripts/ingest/register.test.mjs`

- [ ] **Step 1: 写失败的测试**

创建 `scripts/ingest/register.test.mjs`：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerPhoto } from './register.mjs';

const base = () => [
  {
    id: 'china', name: 'China', nameZh: '中国', lat: 35, lng: 104,
    items: [
      { src: 'IMG_20170731_154353.jpg', alt: 'a', altZh: '甲', lat: 30.7, lng: 104, cityZh: '成都', city: 'Chengdu' },
      { src: 'IMG_20190829_094500.jpg', alt: 'b', altZh: '乙', lat: 41, lng: 117.8, cityZh: '承德', city: 'Chengde' },
    ],
  },
];

const entry = (src) => ({
  src, alt: 'new', altZh: '新', lat: 24.4, lng: 118.1, cityZh: '厦门', city: 'Xiamen',
});

test('按拍摄时间插到正确位置，不是追加到末尾', () => {
  const out = registerPhoto(base(), { countryId: 'china', countryName: 'China', entry: entry('IMG_20180101_120000.jpg') });
  assert.deepEqual(out[0].items.map((i) => i.src), [
    'IMG_20170731_154353.jpg', 'IMG_20180101_120000.jpg', 'IMG_20190829_094500.jpg',
  ]);
});

test('字段顺序与现有条目一致', () => {
  const out = registerPhoto(base(), { countryId: 'china', countryName: 'China', entry: entry('IMG20260905155409.jpg') });
  const added = out[0].items.at(-1);
  assert.deepEqual(Object.keys(added), ['src', 'alt', 'altZh', 'lat', 'lng', 'cityZh', 'city']);
});

test('没有坐标时不写 lat/lng 字段', () => {
  const e = entry('IMG20260905155409.jpg');
  delete e.lat; delete e.lng;
  const out = registerPhoto(base(), { countryId: 'china', countryName: 'China', entry: e });
  const added = out[0].items.at(-1);
  assert.deepEqual(Object.keys(added), ['src', 'alt', 'altZh', 'cityZh', 'city']);
});

test('新国家追加到末尾并带上中文名与锚点', () => {
  const out = registerPhoto(base(), {
    countryId: 'france', countryName: 'France', countryNameZh: '法国',
    countryLat: 46.6, countryLng: 2.3, entry: entry('IMG20260701120000.jpg'),
  });
  assert.equal(out.length, 2);
  assert.deepEqual(
    { id: out[1].id, name: out[1].name, nameZh: out[1].nameZh, lat: out[1].lat, lng: out[1].lng },
    { id: 'france', name: 'France', nameZh: '法国', lat: 46.6, lng: 2.3 },
  );
  assert.equal(out[1].items.length, 1);
});

test('同名文件重复登记会抛错', () => {
  assert.throws(
    () => registerPhoto(base(), { countryId: 'china', countryName: 'China', entry: entry('IMG_20170731_154353.jpg') }),
    /已存在/,
  );
});

test('不修改传入的数组', () => {
  const input = base();
  registerPhoto(input, { countryId: 'china', countryName: 'China', entry: entry('IMG20260905155409.jpg') });
  assert.equal(input[0].items.length, 2);
});
```

- [ ] **Step 2: 跑测试确认它失败**

```bash
node --test scripts/ingest/register.test.mjs
```
预期：FAIL，`Cannot find module './register.mjs'`

- [ ] **Step 3: 实现**

创建 `scripts/ingest/register.mjs`：

```js
// 往 photos.json 的数据结构里插一条照片记录。纯函数：进出都是 JS 对象，
// 不碰文件系统，方便测试。
import { shotTime } from './photo-meta.mjs';

// 与现有 78 条记录保持一致的字段顺序
const FIELD_ORDER = ['src', 'alt', 'altZh', 'lat', 'lng', 'cityZh', 'city'];

const ordered = (entry) => {
  const out = {};
  for (const k of FIELD_ORDER) if (entry[k] !== undefined) out[k] = entry[k];
  return out;
};

/**
 * @param {Array} data                 photos.json 解析后的数组
 * @param {object} opts
 * @param {string} opts.countryId
 * @param {string} opts.countryName
 * @param {string} [opts.countryNameZh] 新国家必填
 * @param {number} [opts.countryLat]    新国家必填
 * @param {number} [opts.countryLng]    新国家必填
 * @param {object} opts.entry
 * @returns {Array} 新数组（不改原数组）
 */
export function registerPhoto(data, opts) {
  const { countryId, countryName, countryNameZh, countryLat, countryLng, entry } = opts;
  const next = data.map((c) => ({ ...c, items: [...c.items] }));

  let country = next.find((c) => c.id === countryId);
  if (!country) {
    country = {
      id: countryId,
      name: countryName,
      nameZh: countryNameZh,
      lat: countryLat,
      lng: countryLng,
      items: [],
    };
    next.push(country);
  }

  if (country.items.some((i) => i.src === entry.src)) {
    throw new Error(`${countryId}/${entry.src} 已存在于 photos.json`);
  }

  const t = shotTime(entry.src, null) ?? Infinity;
  const at = country.items.findIndex((i) => (shotTime(i.src, null) ?? Infinity) > t);
  const row = ordered(entry);
  if (at === -1) country.items.push(row);
  else country.items.splice(at, 0, row);

  return next;
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
node --test scripts/ingest/register.test.mjs
```
预期：6 个测试全 PASS

- [ ] **Step 5: 提交**

```bash
git add scripts/ingest/register.mjs scripts/ingest/register.test.mjs
git commit -m "Register a photo into photos.json in shot-time order"
```

---

## Task 4: README 计数同步

**Files:**
- Create: `scripts/ingest/counts.mjs`
- Test: `scripts/ingest/counts.test.mjs`
- Modify: `scripts/verify-facts.mjs:24-27`

- [ ] **Step 1: 写失败的测试**

创建 `scripts/ingest/counts.test.mjs`：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { syncReadme } from './counts.mjs';

test('替换照片总数与国家数', () => {
  const src = '- **Dotted world map** — land sampled from Natural Earth, with 78 GPS-extracted photo footprints across 6 countries; click a marker\n';
  const out = syncReadme(src, { photos: 81, countries: 7 });
  assert.ok(out.includes('81 GPS-extracted photo footprints across 7 countries'));
  assert.ok(out.includes('click a marker'), '句子其余部分必须原样保留');
});

test('数字没变时原样返回', () => {
  const src = 'with 78 GPS-extracted photo footprints across 6 countries;';
  assert.equal(syncReadme(src, { photos: 78, countries: 6 }), src);
});

test('找不到那句话就抛错，而不是静默跳过', () => {
  assert.throws(() => syncReadme('无关内容', { photos: 78, countries: 6 }), /未找到/);
});

test('真实 README 能被匹配到', () => {
  const readme = readFileSync('README.md', 'utf8');
  assert.doesNotThrow(() => syncReadme(readme, { photos: 99, countries: 9 }));
});
```

- [ ] **Step 2: 跑测试确认它失败**

```bash
node --test scripts/ingest/counts.test.mjs
```
预期：FAIL，`Cannot find module './counts.mjs'`

- [ ] **Step 3: 实现**

创建 `scripts/ingest/counts.mjs`：

```js
// README 里硬编码了照片总数与国家数，需跟着 photos.json 走。
// verify-facts.mjs 的计数已改为从 photos.json 动态计算，不需要同步。
const PATTERN = /(\d+) GPS-extracted photo footprints across (\d+) countries/;

/**
 * @param {string} readme
 * @param {{photos: number, countries: number}} counts
 * @returns {string}
 */
export function syncReadme(readme, { photos, countries }) {
  if (!PATTERN.test(readme)) {
    throw new Error('README.md 里未找到照片计数那句话——句式可能被改过，请同步更新 counts.mjs 的正则');
  }
  return readme.replace(PATTERN, `${photos} GPS-extracted photo footprints across ${countries} countries`);
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
node --test scripts/ingest/counts.test.mjs
```
预期：4 个测试全 PASS

- [ ] **Step 5: 把 verify-facts.mjs 的计数改成动态**

`scripts/verify-facts.mjs` 现在硬编码了 `78`。改成从 `photos.json` 算，以后永不需要同步。

在文件顶部（第 2 行 `// /chat 限流…` 那段注释之后）插入：

```js
import { readFileSync } from 'node:fs';
const photos = JSON.parse(readFileSync('src/data/photos.json', 'utf8'));
const TOTAL = photos.reduce((n, c) => n + c.items.length, 0);
const NATIONS = photos.length;
// 反例：邻近数字（少 2 / 少 1 / 多 1），用来识别模型把总数说错
const NEAR = new RegExp([TOTAL - 2, TOTAL - 1, TOTAL + 1].join('|'));
```

然后把第 24-27 行的四个 `check` 替换为：

```js
check(`zh 总张数=${TOTAL}`, await ask('zh', '他一共拍了多少张照片?'), new RegExp(`${TOTAL}`), NEAR);
check(`zh 国家数=${NATIONS}`, await ask('zh', '他的照片覆盖几个国家?'), new RegExp(`${NATIONS} ?个|\\b${NATIONS}\\b`), null);
check(`en 总张数=${TOTAL}`, await ask('en', 'How many photographs are in Through My Lens?'), new RegExp(`${TOTAL}`), NEAR);
check(`zh 数量复合问`, await ask('zh', '镜头之下总共多少张?分别是哪些国家?'), new RegExp(`${TOTAL}`), NEAR);
```

- [ ] **Step 6: 确认改完的 verify-facts 语法正确**

```bash
node --check scripts/verify-facts.mjs
```
预期：无输出（语法通过）。**不要实跑它**——它需要 worker 起在 8787 且会真实调模型。

- [ ] **Step 7: 提交**

```bash
git add scripts/ingest/counts.mjs scripts/ingest/counts.test.mjs scripts/verify-facts.mjs
git commit -m "Keep the photo count in sync, and derive it in the fact probe"
```

---

## Task 5: VLM 写文案

**Files:**
- Create: `scripts/ingest/caption.mjs`
- Test: `scripts/ingest/caption.test.mjs`

- [ ] **Step 1: 写失败的测试**

创建 `scripts/ingest/caption.test.mjs`：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCaption, writeCaption, translateCountryName } from './caption.mjs';

const reply = (content) => ({
  ok: true,
  json: async () => ({ choices: [{ message: { content } }] }),
});

test('解析干净的 JSON', () => {
  const r = parseCaption('{"alt":"A","altZh":"甲","city":"Xiamen","cityZh":"厦门"}');
  assert.deepEqual(r, { alt: 'A', altZh: '甲', city: 'Xiamen', cityZh: '厦门' });
});

test('剥掉代码围栏', () => {
  const r = parseCaption('```json\n{"alt":"A","altZh":"甲","city":"X","cityZh":"厦"}\n```');
  assert.equal(r.alt, 'A');
});

test('city 截到单个城市名', () => {
  // 实测 opus 会输出 "Xiamen, Fujian" / "福建厦门"
  const r = parseCaption('{"alt":"A","altZh":"甲","city":"Xiamen, Fujian","cityZh":"福建厦门"}');
  assert.equal(r.city, 'Xiamen');
});

test('缺字段就抛错', () => {
  assert.throws(() => parseCaption('{"alt":"A"}'), /缺少字段/);
});

test('不是 JSON 就抛错', () => {
  assert.throws(() => parseCaption('我看不清这张图'), /无法解析/);
});

test('失败会重试，第三次成功则返回', async () => {
  let calls = 0;
  const fakeFetch = async () => {
    calls++;
    if (calls < 3) return { ok: false, status: 504, text: async () => 'gateway timeout' };
    return reply('{"alt":"A","altZh":"甲","city":"X","cityZh":"厦"}');
  };
  const r = await writeCaption(
    { imageB64: 'x', lng: 118, lat: 24, shotAt: '2026-09-09', samples: [] },
    { fetch: fakeFetch, base: 'https://x/v1', key: 'k', backoffMs: () => 0 },
  );
  assert.equal(calls, 3);
  assert.equal(r.alt, 'A');
});

test('三次都失败则抛错并带上最后一次原因', async () => {
  const fakeFetch = async () => ({ ok: false, status: 504, text: async () => 'gateway timeout' });
  await assert.rejects(
    writeCaption(
      { imageB64: 'x', lng: 118, lat: 24, shotAt: '2026-09-09', samples: [] },
      { fetch: fakeFetch, base: 'https://x/v1', key: 'k', backoffMs: () => 0 },
    ),
    /504/,
  );
});

test('新国家的中文名由模型翻译', async () => {
  const fakeFetch = async () => reply('法国');
  const zh = await translateCountryName('France', { fetch: fakeFetch, base: 'https://x/v1', key: 'k', backoffMs: () => 0 });
  assert.equal(zh, '法国');
});

test('国家名翻译会剥掉模型可能加的引号与标点', async () => {
  const fakeFetch = async () => reply('"法国。"\n');
  const zh = await translateCountryName('France', { fetch: fakeFetch, base: 'https://x/v1', key: 'k', backoffMs: () => 0 });
  assert.equal(zh, '法国');
});
```

- [ ] **Step 2: 跑测试确认它失败**

```bash
node --test scripts/ingest/caption.test.mjs
```
预期：FAIL，`Cannot find module './caption.mjs'`

- [ ] **Step 3: 实现**

创建 `scripts/ingest/caption.mjs`：

```js
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
  const { fetch: doFetch, base, key, backoffMs = defaultBackoff } = deps;

  const where = photo.lat != null
    ? `GPS ${photo.lat}°, ${photo.lng}°`
    : '无 GPS 信息';
  const examples = photo.samples.length
    ? `\n\n同一作品集里已有的文案，请对齐这个语感：\n${photo.samples.map((s) => `- "${s.alt}" / "${s.altZh}"`).join('\n')}`
    : '';

  let lastErr;
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    if (attempt > 0) await sleep(backoffMs(attempt - 1));
    try {
      const resp = await doFetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 2000,
          messages: [
            { role: 'system', content: SYSTEM },
            {
              role: 'user',
              content: [
                { type: 'text', text: `拍摄信息：${where}，拍摄于 ${photo.shotAt}。${examples}` },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${photo.imageB64}` } },
              ],
            },
          ],
        }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status} ${await resp.text()}`);
      const data = await resp.json();
      return parseCaption(data.choices?.[0]?.message?.content ?? '');
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`文案生成失败（已重试 ${RETRIES} 次）：${lastErr.message}`);
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
node --test scripts/ingest/caption.test.mjs
```
预期：7 个测试全 PASS，瞬间完成（`backoffMs` 被注入为 0，不会真的等）

- [ ] **Step 5: 提交**

```bash
git add scripts/ingest/caption.mjs scripts/ingest/caption.test.mjs
git commit -m "Have the model look at a photo and write its bilingual caption"
```

---

## Task 6: 归档与压缩

**Files:**
- Create: `scripts/ingest/intake.mjs`
- Test: `scripts/ingest/intake.test.mjs`

- [ ] **Step 1: 写失败的测试**

创建 `scripts/ingest/intake.test.mjs`：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import exifr from 'exifr';
import { listInbox, archiveAndDerive } from './intake.mjs';

const tmp = () => mkdtempSync(join(tmpdir(), 'ingest-'));

/**
 * 造一张 4096x1856 的测试图，**带 EXIF**。
 * 必须带——否则"母版不得残留元数据"那条断言就是空转的：
 * 源图本来就没有元数据的话，输出没有也证明不了剥除生效。
 */
async function fakePhoto(path) {
  const buf = await sharp({
    create: { width: 4096, height: 1856, channels: 3, background: { r: 120, g: 140, b: 160 } },
  })
    .withMetadata({ exif: { IFD0: { Copyright: 'ingest-test-fixture' } } })
    .jpeg()
    .toBuffer();
  writeFileSync(path, buf);
}

test('listInbox 只认 jpg/jpeg，并带出子目录指定的国家', () => {
  const root = tmp();
  mkdirSync(join(root, 'china'), { recursive: true });
  writeFileSync(join(root, 'a.jpg'), 'x');
  writeFileSync(join(root, 'b.JPEG'), 'x');
  writeFileSync(join(root, 'note.txt'), 'x');
  writeFileSync(join(root, 'china', 'c.jpg'), 'x');

  const got = listInbox(root).map((f) => ({ name: f.name, forced: f.forcedCountryId })).sort((x, y) => x.name.localeCompare(y.name));
  assert.deepEqual(got, [
    { name: 'a.jpg', forced: null },
    { name: 'b.JPEG', forced: null },
    { name: 'c.jpg', forced: 'china' },
  ]);
});

test('派生的母版长边 2560、元数据被剥光，原图归档保持不变', async () => {
  const root = tmp();
  const src = join(root, 'IMG20260905155409.jpg');
  await fakePhoto(src);
  const originalBytes = readFileSync(src).length;

  // 前提自检：源图确实带 EXIF，否则下面的剥除断言没有意义
  assert.ok((await exifr.parse(src, true))?.Copyright, '测试前提：源图应带 EXIF');

  const archiveDir = join(root, '_originals');
  const servingDir = join(root, '_serving');
  const r = await archiveAndDerive({
    file: src, countryId: 'china', archiveRoot: archiveDir, servingRoot: servingDir,
  });

  const archived = join(archiveDir, 'china', 'IMG20260905155409.jpg');
  assert.ok(existsSync(archived));
  assert.equal(readFileSync(archived).length, originalBytes, '归档的必须是原图，不能是压缩过的');
  assert.ok((await exifr.parse(archived, true))?.Copyright, '归档件必须保留 EXIF（底片留全信息）');

  const master = join(servingDir, 'china', 'IMG20260905155409.jpg');
  assert.ok(existsSync(master));
  const meta = await sharp(master).metadata();
  assert.equal(Math.max(meta.width, meta.height), 2560);
  assert.ok(!(await exifr.parse(master, true).catch(() => null))?.Copyright, '母版不得残留 EXIF');
  assert.equal(await exifr.gps(master).catch(() => undefined), undefined, '母版不得残留 GPS');
  assert.equal(r.servingPath, master);
});

test('母版已存在则抛错，不静默覆盖', async () => {
  const root = tmp();
  const src = join(root, 'IMG20260905155409.jpg');
  await fakePhoto(src);
  const archiveDir = join(root, '_originals');
  const servingDir = join(root, '_serving');
  const args = { file: src, countryId: 'china', archiveRoot: archiveDir, servingRoot: servingDir };

  await archiveAndDerive(args);
  await assert.rejects(() => archiveAndDerive(args), /已存在/);
});
```

- [ ] **Step 2: 跑测试确认它失败**

```bash
node --test scripts/ingest/intake.test.mjs
```
预期：FAIL，`Cannot find module './intake.mjs'`

- [ ] **Step 3: 实现**

创建 `scripts/ingest/intake.mjs`：

```js
// 唯一碰文件系统的模块：列收件箱、读 EXIF、归档原图、派生服务母版。
//
// 两级结构沿用 compress-photos.mjs 当初定下的约定：
//   _originals/photos/<国家>/  全分辨率原图，gitignore，只在本机
//   src/assets/photos/<国家>/  2560px 母版，EXIF 剥光，进 git
import { readdirSync, existsSync, copyFileSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import sharp from 'sharp';
import exifr from 'exifr';

const MAX_EDGE = 2560;
const QUALITY = 82;
const IS_JPEG = /\.jpe?g$/i;

/**
 * 列出收件箱里待处理的图。根目录下的图靠 GPS 判国；
 * 以国家 id 命名的子目录（_inbox/china/）里的图强制归到该国。
 * @returns {Array<{path: string, name: string, forcedCountryId: string|null}>}
 */
export function listInbox(root) {
  if (!existsSync(root)) return [];
  const out = [];
  for (const e of readdirSync(root, { withFileTypes: true })) {
    if (e.isDirectory()) {
      for (const f of readdirSync(join(root, e.name))) {
        if (IS_JPEG.test(f)) out.push({ path: join(root, e.name, f), name: f, forcedCountryId: e.name });
      }
    } else if (IS_JPEG.test(e.name)) {
      out.push({ path: join(root, e.name), name: e.name, forcedCountryId: null });
    }
  }
  return out;
}

/** 读 GPS 与拍摄时间。读不到就返回空值，由调用方决定怎么办。 */
export async function readExif(file) {
  const gps = await exifr.gps(file).catch(() => null);
  const meta = await exifr.parse(file, ['DateTimeOriginal']).catch(() => null);
  return {
    lat: gps && Number.isFinite(gps.latitude) ? gps.latitude : null,
    lng: gps && Number.isFinite(gps.longitude) ? gps.longitude : null,
    shotAt: meta?.DateTimeOriginal ?? null,
  };
}

/**
 * 归档原图 + 派生服务母版。
 * @returns {{archivePath: string, servingPath: string}}
 */
export async function archiveAndDerive({ file, countryId, archiveRoot, servingRoot }) {
  const name = basename(file);
  const archivePath = join(archiveRoot, countryId, name);
  const servingPath = join(servingRoot, countryId, name);

  if (existsSync(servingPath)) throw new Error(`${countryId}/${name} 已存在于 ${servingRoot}，拒绝覆盖`);
  if (existsSync(archivePath)) throw new Error(`${countryId}/${name} 已存在于 ${archiveRoot}，拒绝覆盖`);

  mkdirSync(join(archiveRoot, countryId), { recursive: true });
  copyFileSync(file, archivePath);

  const meta = await sharp(file).metadata();
  const pipeline = sharp(file).rotate(); // 先把 EXIF 方向烘焙进像素，再剥元数据
  if (Math.max(meta.width ?? 0, meta.height ?? 0) > MAX_EDGE) {
    pipeline.resize({
      width: meta.width >= meta.height ? MAX_EDGE : null,
      height: meta.height > meta.width ? MAX_EDGE : null,
    });
  }
  const buf = await pipeline.jpeg({ quality: QUALITY, mozjpeg: true }).toBuffer();

  mkdirSync(join(servingRoot, countryId), { recursive: true });
  writeFileSync(servingPath, buf);

  return { archivePath, servingPath };
}

/** 给模型看的缩略图：1024px JPEG 的 base64 */
export async function previewB64(file) {
  const buf = await sharp(file).resize({ width: 1024 }).jpeg({ quality: 80 }).toBuffer();
  return buf.toString('base64');
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
node --test scripts/ingest/intake.test.mjs
```
预期：3 个测试全 PASS

- [ ] **Step 5: 提交**

```bash
git add scripts/ingest/intake.mjs scripts/ingest/intake.test.mjs
git commit -m "Archive the original and derive the serving master"
```

---

## Task 7: 编排器

**Files:**
- Create: `scripts/ingest.mjs`
- Modify: `.gitignore`
- Modify: `package.json`

- [ ] **Step 1: 把收件箱加进 .gitignore**

在 `.gitignore` 末尾（`_originals/` 之后）追加：

```
# 照片收件箱 —— 待处理的原图暂存在这里，由 pre-commit 钩子分拣后清空。
# 绝不进 git：里面是全分辨率原图，带未脱敏的精确 GPS。
_inbox/
```

- [ ] **Step 2: 写编排器**

创建 `scripts/ingest.mjs`：

```js
#!/usr/bin/env node
// 照片入站编排器。由 .githooks/pre-commit 调用。
//
// 收件箱为空时立即退出，所以日常提交零开销。
// 任何一张图失败都以非零码退出 → commit 被阻断 → 仓库不会留下半成品。
// 每张图走完全部步骤才从收件箱删除，中途失败重跑不会重做已完成的。
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { lookupCountry, countryCentroid } from './ingest/country.mjs';
import { listInbox, readExif, archiveAndDerive, previewB64 } from './ingest/intake.mjs';
import { writeCaption, translateCountryName } from './ingest/caption.mjs';
import { registerPhoto } from './ingest/register.mjs';
import { syncReadme } from './ingest/counts.mjs';
import { shotTime } from './ingest/photo-meta.mjs';

const INBOX = '_inbox';
const ARCHIVE = '_originals/photos';
const SERVING = 'src/assets/photos';
const PHOTOS_JSON = 'src/data/photos.json';
const README = 'README.md';

const pending = listInbox(INBOX);
if (pending.length === 0) process.exit(0);

console.log(`[照片入站] 收件箱有 ${pending.length} 张待处理`);

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => l.split(/=(.*)/s).slice(0, 2).map((s) => s.trim()))
);
if (!env.TRANSLATE_API_BASE || !env.TRANSLATE_API_KEY) {
  console.error('[照片入站] .env 里缺少 TRANSLATE_API_BASE / TRANSLATE_API_KEY');
  process.exit(1);
}

let data = JSON.parse(readFileSync(PHOTOS_JSON, 'utf8'));
const touched = [];

for (const item of pending) {
  console.log(`  · ${item.name}`);
  const { lat, lng, shotAt } = await readExif(item.path);

  let country;
  if (item.forcedCountryId) {
    const known = data.find((c) => c.id === item.forcedCountryId);
    if (!known) {
      console.error(`    收件箱子目录 "${item.forcedCountryId}" 不是已知国家 id；新国家请让 GPS 自动判定`);
      process.exit(1);
    }
    country = { id: known.id, name: known.name, via: 'inbox 子目录' };
  } else {
    if (lat == null) {
      console.error(`    没有 GPS，无法判定国家。把它放进 _inbox/<国家id>/ 手动指定，例如 _inbox/china/`);
      process.exit(1);
    }
    country = lookupCountry(lng, lat);
    if (!country) {
      console.error(`    坐标 ${lat},${lng} 落不到任何国家上`);
      process.exit(1);
    }
  }
  console.log(`    国家：${country.name} (${country.via})`);

  const { servingPath } = await archiveAndDerive({
    file: item.path, countryId: country.id, archiveRoot: ARCHIVE, servingRoot: SERVING,
  });

  const existing = data.find((c) => c.id === country.id);
  const samples = (existing?.items ?? data.flatMap((c) => c.items))
    .slice(-5)
    .map((i) => ({ alt: i.alt, altZh: i.altZh }))
    .filter((s) => s.alt && s.altZh);

  const caption = await writeCaption(
    {
      imageB64: await previewB64(item.path),
      lat: lat == null ? null : Math.round(lat * 10) / 10,
      lng: lng == null ? null : Math.round(lng * 10) / 10,
      shotAt: shotAt ? new Date(shotAt).toISOString().slice(0, 10)
        : new Date(shotTime(item.name, null) ?? Date.now()).toISOString().slice(0, 10),
      samples,
    },
    { fetch, base: env.TRANSLATE_API_BASE, key: env.TRANSLATE_API_KEY }
  );
  console.log(`    文案：${caption.altZh}`);

  const entry = { src: item.name, alt: caption.alt, altZh: caption.altZh, cityZh: caption.cityZh, city: caption.city };
  // 坐标四舍五入到 1 位小数（约 11km）——够画地图，又不公开精确位置
  if (lat != null) { entry.lat = Math.round(lat * 10) / 10; entry.lng = Math.round(lng * 10) / 10; }

  // 没去过的国家：中文名找模型翻一次，锚点用国家多边形质心（与现有条目同口径，
  // 不能用首张照片的坐标——那会让画廊标题行显示成某个城市而不是国家中心）
  let newCountry = {};
  if (!existing) {
    const zh = await translateCountryName(country.name, {
      fetch, base: env.TRANSLATE_API_BASE, key: env.TRANSLATE_API_KEY,
    });
    const centroid = countryCentroid(country.name) ?? { lat: entry.lat, lng: entry.lng };
    newCountry = { countryNameZh: zh, countryLat: centroid.lat, countryLng: centroid.lng };
    console.log(`    新国家：${country.name} / ${zh}，锚点 ${centroid.lat}, ${centroid.lng}`);
  }

  data = registerPhoto(data, {
    countryId: country.id,
    countryName: country.name,
    ...newCountry,
    entry,
  });

  unlinkSync(item.path);
  touched.push(servingPath);
}

writeFileSync(PHOTOS_JSON, JSON.stringify(data, null, 2) + '\n');

const total = data.reduce((n, c) => n + c.items.length, 0);
writeFileSync(README, syncReadme(readFileSync(README, 'utf8'), { photos: total, countries: data.length }));

execFileSync('git', ['add', PHOTOS_JSON, README, ...touched], { stdio: 'inherit' });
console.log(`[照片入站] 完成 ${pending.length} 张，现共 ${total} 张 / ${data.length} 国`);
```

- [ ] **Step 3: 加 npm 脚本**

在 `package.json` 的 `scripts` 里加两条（保留现有的 dev/build/preview/astro）：

```json
    "test": "node --test scripts/ingest/",
    "ingest": "node scripts/ingest.mjs"
```

- [ ] **Step 4: 确认语法与空收件箱短路**

```bash
node --check scripts/ingest.mjs
node scripts/ingest.mjs
```
预期：`node --check` 无输出；`node scripts/ingest.mjs` 也无输出、退出码 0（此时 `_inbox/` 不存在，应当立即退出）。

用 `echo $?`（Git Bash）确认退出码为 0。

- [ ] **Step 5: 跑全部单测**

```bash
npm test
```
预期：五个测试文件、共 25+ 个测试全 PASS

- [ ] **Step 6: 提交**

```bash
git add scripts/ingest.mjs .gitignore package.json
git commit -m "Wire the ingest steps together behind one entry point"
```

---

## Task 8: pre-commit 钩子

**Files:**
- Create: `.githooks/pre-commit`
- Modify: `README.md`（部署段落补钩子安装说明）

- [ ] **Step 1: 写钩子**

创建 `.githooks/pre-commit`：

```sh
#!/bin/sh
# 照片入站：把 _inbox/ 里的原图分拣进仓库，产物并入本次提交。
# 收件箱为空时 ingest.mjs 立即退出，日常提交不受影响。
exec node scripts/ingest.mjs
```

- [ ] **Step 2: 指向这个目录并给执行权限**

```bash
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit
git update-index --chmod=+x .githooks/pre-commit
```

用 `core.hooksPath` 而不是 `.git/hooks/`，是因为前者的内容在版本控制里，克隆后只需跑一次上面第一行即可恢复。

- [ ] **Step 3: 验证钩子会被触发且不拖慢空提交**

```bash
git commit --allow-empty -m "probe: hook fires on an empty inbox"
```
预期：提交正常完成，无照片相关输出（收件箱为空 → 立即退出）。

然后回滚这个探测提交：

```bash
git reset --hard HEAD~1
```

- [ ] **Step 4: README 补安装说明**

在 `README.md` 的 `## Deployment` 一节之前插入：

```markdown
## Local setup

Photo ingest runs as a pre-commit hook. After cloning, point git at the tracked
hooks directory once:

```bash
git config core.hooksPath .githooks
```

Without this the hook simply never runs — photos dropped into `_inbox/` stay there.
```

- [ ] **Step 5: 提交**

```bash
git add .githooks/pre-commit README.md
git commit -m "Run photo ingest from a tracked pre-commit hook"
```

---

## Task 9: 清理旧脚本与文档

**Files:**
- Delete: `scripts/extract-gps.mjs`
- Modify: `README.md:114-116`
- Modify: `scripts/write-alts.mjs`（加顶部注释）

- [ ] **Step 1: 删掉会清空坐标的脚本**

```bash
git rm scripts/extract-gps.mjs
```

它读 `src/assets/photos`，但那里的 EXIF 早被剥光——今天跑一次会把 `photos.json` 里全部 78 条 `lat`/`lng` 删掉。功能已由 `scripts/ingest/intake.mjs` 的 `readExif`（读 `_originals` 里的原图）接管。

- [ ] **Step 2: 改写 README 的照片说明**

`README.md` 的 "Editing content" 一节里，把这三行：

```markdown
- **Photos**: drop JPGs into `src/assets/photos/<country>/`, add entries to
  `src/data/photos.json` (run `node scripts/extract-gps.mjs` for coordinates). Photo stats
  in the AI knowledge pack update automatically.
```

替换为：

```markdown
- **Photos**: drop the full-resolution originals into `_inbox/` and commit. The pre-commit
  hook files them by GPS, archives the originals to `_originals/` (never committed), derives
  2560px serving masters, writes bilingual captions with a vision model, and registers them in
  `src/data/photos.json`. Photos without GPS go in `_inbox/<country-id>/` instead. Counts,
  the map and the AI knowledge pack all follow from `photos.json` automatically.
  See `docs/photo-ingest-design.md`.
```

- [ ] **Step 3: 把 write-alts.mjs 标为历史件**

在 `scripts/write-alts.mjs` 第一行之前插入：

```js
// 历史件（2026-06-11），不再运行。文案生成已由 scripts/ingest/caption.mjs 接管。
// 保留是因为这里是最初 78 条人工文案的底稿，改文风时可作参照。
```

- [ ] **Step 4: 确认没有别处再引用被删的脚本**

```bash
grep -rn "extract-gps" --exclude-dir=node_modules --exclude-dir=.git . || echo "无残留引用"
```
预期：`无残留引用`

- [ ] **Step 5: 提交**

```bash
git add -A README.md scripts/write-alts.mjs
git commit -m "Retire the script that would wipe every coordinate"
```

---

## Task 10: 端到端实跑

**Files:** 无改动，纯验证

- [ ] **Step 1: 准备一张真实测试图**

从已归档的原图里复制一张出来当作"新照片"（用一个不会与现有条目冲突的名字）：

```bash
mkdir -p _inbox
cp _originals/photos/china/IMG20260909184359.jpg _inbox/IMG20260910120000.jpg
```

- [ ] **Step 2: 手动跑一次编排器（先不经过钩子）**

```bash
node scripts/ingest.mjs
```

预期输出形如：

```
[照片入站] 收件箱有 1 张待处理
  · IMG20260910120000.jpg
    国家：China (ring 0.1°)
    文案：厦门海湾的暮色……
[照片入站] 完成 1 张，现共 79 张 / 6 国
```

- [ ] **Step 3: 核对产物**

```bash
git status --short
ls _inbox
node -e "const d=require('./src/data/photos.json');const c=d.find(x=>x.id==='china');console.log(JSON.stringify(c.items.at(-1),null,1));console.log('总数',d.reduce((n,x)=>n+x.items.length,0))"
```

预期：`_inbox` 已空；`photos.json`、`README.md`、新母版都已 staged；新条目字段顺序为 `src, alt, altZh, lat, lng, cityZh, city`，坐标为 `24.4 / 118.1`。

- [ ] **Step 4: 构建并跑验证**

```bash
npm run build
node scripts/check-links.mjs
```
预期：构建通过 21 页 0 报错；内链检查无 broken。

起预览后跑照片页验收：

```bash
npx astro preview --port 4321 &
node scripts/verify-lens.mjs
```
预期：全部 PASS，计数显示 `/ 79`。跑完记得停掉预览进程。

- [ ] **Step 5: 回滚这次测试**

```bash
git reset HEAD
git checkout -- src/data/photos.json README.md
rm -f src/assets/photos/china/IMG20260910120000.jpg _originals/photos/china/IMG20260910120000.jpg
git status --short
```
预期：工作区回到测试前的状态。

- [ ] **Step 6: 真正走一次钩子**

```bash
cp _originals/photos/china/IMG20260909184359.jpg _inbox/IMG20260910120000.jpg
git commit --allow-empty -m "test: ingest through the hook"
git show --stat HEAD
```
预期：提交里包含新母版、`photos.json`、`README.md` 三处改动——证明钩子确实把产物并进了本次提交。

验证后回滚：

```bash
git reset --hard HEAD~1
rm -f _originals/photos/china/IMG20260910120000.jpg
```

- [ ] **Step 7: 验证「没去过的国家」这条路径**

现有 6 国都是老条目，新建国家是全自动流程里唯一没被真实走过的一段：建条目、翻中文名、算质心、地图多一组点、洲际航线重算。必须实测。

造一张坐标在法国的测试图（改写 EXIF 的 GPS，不改画面）：

```bash
node -e "
const sharp=require('sharp');
sharp('_originals/photos/china/IMG20260905155409.jpg')
  .withMetadata({exif:{IFD0:{},GPS:{GPSLatitude:[48,51,24],GPSLatitudeRef:'N',GPSLongitude:[2,21,3],GPSLongitudeRef:'E'}}})
  .toFile('_inbox/IMG20260801120000.jpg').then(()=>console.log('法国测试图已生成'))
"
node scripts/ingest.mjs
```

预期输出包含：

```
    国家：France (direct)
    新国家：France / 法国，锚点 46.6, 2.3
```

核对 `photos.json` 末尾新增的国家条目：

```bash
node -e "const d=require('./src/data/photos.json');const f=d.at(-1);console.log(JSON.stringify({id:f.id,name:f.name,nameZh:f.nameZh,lat:f.lat,lng:f.lng,张数:f.items.length},null,1));console.log('国家数',d.length)"
```

预期：`id: 'france'`、`nameZh: '法国'`、锚点是**国家质心**（约 46.6, 2.3）而不是照片坐标（48.9, 2.4）。

构建后确认各部件都跟上了：

```bash
npm run build
node -e "
const fs=require('fs');
const zh=fs.readFileSync('dist/zh/photography/index.html','utf8');
console.log('标题行:', (zh.match(/tracking-\[0\.2em\][^>]*>([^<]+)</)||[])[1]);
console.log('法国分区:', zh.includes('gallery-france'), '| 中文国名:', zh.includes('法国'));
console.log('地图点总数:', (zh.match(/class=\"map-dot/g)||[]).length);
const k=JSON.parse(fs.readFileSync('dist/knowledge.json','utf8'));
console.log('知识包 totalPhotos:', k.zh.photos.totalPhotos, '| 国家数:', k.zh.photos.countries.length);
"
```

预期：标题行显示 `7 个国家 · 79 张照片`；出现 `gallery-france` 分区且国名为"法国"；知识包同步为 7 国 79 张。

回滚：

```bash
git checkout -- src/data/photos.json README.md
rm -f src/assets/photos/france/IMG20260801120000.jpg _originals/photos/france/IMG20260801120000.jpg
rmdir src/assets/photos/france _originals/photos/france
```

- [ ] **Step 8: 确认失败会阻断提交**

把 `.env` 里的 key 临时改错，再跑一次，确认 commit 被拒绝：

```bash
cp .env .env.bak
sed -i 's/^TRANSLATE_API_KEY=.*/TRANSLATE_API_KEY=sk-invalid/' .env
cp _originals/photos/china/IMG20260909184359.jpg _inbox/IMG20260910120000.jpg
git commit --allow-empty -m "test: hook must block on failure"
echo "退出码: $?"
mv .env.bak .env
rm -f _inbox/IMG20260910120000.jpg
```
预期：三次重试后报错，退出码非 0，**提交未产生**（`git log -1` 仍是上一条）。注意重试会真的等 1+4+9 秒。

---

## 自检对照

| 设计文档章节 | 覆盖它的任务 |
|---|---|
| §2 决策 1 全自动无闸门 | Task 5（不读 confidence、不设放行判断） |
| §2 决策 2 pre-commit | Task 8 |
| §2 决策 4 opus 单模型 | Task 5 |
| §2 决策 5 重试 3 次后阻断 | Task 5 Step 3、Task 10 Step 7 |
| §2 决策 6 `_inbox/` gitignore | Task 7 Step 1 |
| §4 坏多边形黑名单 | Task 1 |
| §4 扩圈兜底 | Task 1 |
| §4 国家 id 映射 | Task 1（`toCountryId`） |
| §4 新国家自动建条目 | Task 3（结构）、Task 5 `translateCountryName`（中文名）、Task 1 `countryCentroid`（锚点） |
| §4 无 GPS 的手动通道 | Task 6（`listInbox`）、Task 7（编排器分支） |
| §4 排序不能按文件名 | Task 2、Task 3 |
| §5 few-shot 语感样例 | Task 5、Task 7 |
| §5 city 单城市名 | Task 5（`oneCity`） |
| §6 重名拒绝覆盖 | Task 3、Task 6 |
| §6 处理完才删收件箱 | Task 7（`unlinkSync` 在最后） |
| §7 README 计数 | Task 4 |
| §7 verify-facts 改动态 | Task 4 Step 5 |
| §8 删 extract-gps | Task 9 |
| §8 write-alts 标历史件 | Task 9 |
| §8 README 文档改写 | Task 9 Step 2 |

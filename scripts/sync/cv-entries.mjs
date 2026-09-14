// 把 cv.json 拆成可逐条比对的单元。各区结构不同，实测确认：
//   有 id 的区      → 按 id（中英 id 共用，是深链设计时就定的）
//   awards/certs    → 无 id，按数组下标（实测中英下标严格对齐）
//   skills          → **绝不碰**：en 是 {data,frameworks,tools} 对象、zh 是数组，
//                     设计如此，渲染层兼容两形态，同步会把页面搞坏
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

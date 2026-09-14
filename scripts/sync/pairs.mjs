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

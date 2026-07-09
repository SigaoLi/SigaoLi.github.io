// 人工层 loader — 读 src/data/knowledge/*.md(Sigao 撰写/修订的自述、FAQ、规范、边界、补充)。
// HTML 注释是给作者的修订指引,在此剥离,绝不进入公开知识包。
import type { Persona } from './types';
import about from '../../data/knowledge/about.md?raw';
import faq from '../../data/knowledge/faq.md?raw';
import guidelines from '../../data/knowledge/guidelines.md?raw';
import boundaries from '../../data/knowledge/boundaries.md?raw';
import extra from '../../data/knowledge/extra.md?raw';

const strip = (raw: string): string =>
  raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export const loadPersona = (): Persona => ({
  about: strip(about),
  faq: strip(faq),
  guidelines: strip(guidelines),
  boundaries: strip(boundaries),
  extra: strip(extra),
});

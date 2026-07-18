// 同源层 · CV — 复用 cv.json / cv.zh.json(与时间轴、resume.json、llms-full.txt 同一数据源)。
// 两个形态差异在此抹平:skills 在 en 是旧对象形态、zh 是数组形态(与 CvPage 的兼容逻辑一致)。
// coords 等页面装饰字段不入包,省 token。
import cvEn from '../../data/cv.json';
import cvZh from '../../data/cv.zh.json';
import type { CvEntry, KnowledgeCv, SkillGroup } from './types';

interface RawEntry {
  id?: string;
  title: string;
  org: string;
  location?: string;
  start: string;
  end: string;
  bullets: string[];
  url?: string;
}

const EN_SKILL_LABELS: Record<string, string> = {
  data: 'Data & engineering',
  frameworks: 'ML frameworks',
  tools: 'Tools',
};

const pickEntry = (e: RawEntry): CvEntry => ({
  ...(e.id ? { id: e.id } : {}),
  title: e.title,
  org: e.org,
  ...(e.location ? { location: e.location } : {}),
  start: e.start,
  end: e.end,
  bullets: e.bullets,
  ...(e.url ? { url: e.url } : {}),
});

const normalizeSkills = (s: SkillGroup[] | Record<string, string[]>): SkillGroup[] =>
  Array.isArray(s)
    ? s
    : Object.entries(s).map(([key, items]) => ({ label: EN_SKILL_LABELS[key] ?? key, items }));

export const loadCv = (lang: 'en' | 'zh'): KnowledgeCv => {
  const raw = (lang === 'zh' ? cvZh : cvEn) as unknown as {
    current?: RawEntry;
    experience: RawEntry[];
    research: RawEntry[];
    education: RawEntry[];
    volunteering: RawEntry[];
    awards: { year: string; title: string }[];
    skills: SkillGroup[] | Record<string, string[]>;
    certifications: { title: string; org: string }[];
  };
  return {
    ...(raw.current ? { current: pickEntry(raw.current) } : {}),
    experience: raw.experience.map(pickEntry),
    research: raw.research.map(pickEntry),
    education: raw.education.map(pickEntry),
    volunteering: raw.volunteering.map(pickEntry),
    awards: raw.awards,
    skills: normalizeSkills(raw.skills),
    certifications: raw.certifications,
  };
};

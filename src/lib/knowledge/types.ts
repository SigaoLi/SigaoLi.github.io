// 知识包结构契约(PRD §22.1「一个知识层,三个出口」)。
// Worker(/chat、/mcp)按此结构消费;字段增删须同步 PRD §22 与 Worker 侧。

export interface CvEntry {
  title: string;
  org: string;
  location?: string;
  start: string;
  end: string;
  bullets: string[];
  url?: string;
}

export interface SkillGroup {
  label: string;
  items: string[];
}

export interface KnowledgeCv {
  current?: CvEntry;
  experience: CvEntry[];
  research: CvEntry[];
  education: CvEntry[];
  volunteering: CvEntry[];
  awards: { year: string; title: string }[];
  skills: SkillGroup[];
  certifications: { title: string; org: string }[];
}

export interface KnowledgeCase {
  slug: string;
  title: string;
  tagline: string;
  year: string;
  role: string;
  org?: string;
  repoUrl: string;
  metrics: { label: string; value: string }[];
  body: string;
}

export interface KnowledgeResearch {
  title: string;
  summary: string;
  projects: { title: string; abstract: string; link?: string; github?: string }[];
}

/** 人工层(src/data/knowledge/*.md,中文源,HTML 注释已剥离) */
export interface Persona {
  about: string;
  faq: string;
  guidelines: string;
  boundaries: string;
  extra: string;
}

export interface PhotoSummary {
  totalPhotos: number;
  countries: { name: string; photos: number; cities: string[] }[];
}

/** 同源层的单语言切片 — Worker 按访客语言只取一片,减半 prompt 体积 */
export interface LangSlice {
  cv: KnowledgeCv;
  cases: KnowledgeCase[];
  research: KnowledgeResearch[];
  photos: PhotoSummary;
}

export interface KnowledgePack {
  meta: {
    version: string;
    generatedAt: string;
    source: string;
    note: string;
    tokenEstimate: { total: number; persona: number; zh: number; en: number };
  };
  profile: {
    name: string;
    nameZh: string;
    tagline: string;
    taglineZh: string;
    narrative: string;
    narrativeZh: string;
    url: string;
    email: string;
    socials: Record<string, string>;
  };
  persona: Persona;
  zh: LangSlice;
  en: LangSlice;
}

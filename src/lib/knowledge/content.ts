// 同源层 · 案例与研究 — 从 Astro content collections 读取(与作品页同源,内容更新自动跟随)。
import { getCollection } from 'astro:content';
import type { KnowledgeCase, KnowledgeResearch } from './types';

export async function loadCases(lang: 'en' | 'zh'): Promise<KnowledgeCase[]> {
  const entries = await getCollection(lang === 'zh' ? 'casesZh' : 'cases');
  return entries
    .sort((a, b) => a.data.order - b.data.order)
    .map((c) => ({
      slug: c.id,
      title: c.data.title,
      tagline: c.data.tagline,
      year: c.data.year,
      role: c.data.role,
      ...(c.data.org ? { org: c.data.org } : {}),
      repoUrl: c.data.repoUrl,
      metrics: c.data.metrics,
      body: (c.body ?? '').trim(),
    }));
}

export async function loadResearch(lang: 'en' | 'zh'): Promise<KnowledgeResearch[]> {
  const entries = await getCollection(lang === 'zh' ? 'researchZh' : 'research');
  return entries
    .sort((a, b) => a.data.order - b.data.order)
    .map((r) => ({
      title: r.data.title,
      summary: r.data.summary,
      projects: r.data.projects.map((p) => ({
        title: p.title,
        abstract: p.abstract,
        ...(p.link ? { link: p.link } : {}),
        ...(p.github ? { github: p.github } : {}),
      })),
    }));
}

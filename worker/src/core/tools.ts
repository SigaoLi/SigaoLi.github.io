// MCP 工具的业务实现(跨运行时,纯函数;协议接线在 ../mcp.ts)。
// 与 Chatbot 共享同一知识包(PRD §22.4「双端共享同一套工具实现」)。
// 设计原则(调研结论):工具单一职责;错误信息可操作(给出有效 slug 清单,提高对方 agent 重试成功率)。
import type { KnowledgePack } from './types';
import { fmtCv, fmtPhotos } from './prompt';

export type ToolLang = 'en' | 'zh';

/** 是谁 + 主线叙事 + 联系方式(自述与补充层原文附后) */
export function getProfile(pack: KnowledgePack, lang: ToolLang): string {
  const p = pack.profile;
  return [
    `${p.name} / ${p.nameZh} — ${lang === 'zh' ? p.taglineZh : p.tagline}`,
    lang === 'zh' ? p.narrativeZh : p.narrative,
    `Website: ${p.url} · Email: ${p.email}`,
    Object.entries(p.socials)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · '),
    '',
    pack.persona.about,
    '',
    pack.persona.extra,
    '',
    fmtPhotos(pack[lang].photos, lang),
  ].join('\n');
}

/** 完整履历(当前职位/专业/研究/教育/志愿/获奖/技能/证书) */
export function listExperience(pack: KnowledgePack, lang: ToolLang): string {
  return fmtCv(pack[lang].cv);
}

/** 案例全文;slug 未命中时返回有效清单(可操作错误) */
export function getCaseStudy(pack: KnowledgePack, lang: ToolLang, slug: string): { found: boolean; text: string } {
  const cases = pack[lang].cases;
  const hit = cases.find((c) => c.slug === slug);
  if (!hit) {
    return {
      found: false,
      text:
        `Unknown slug "${slug}". Valid slugs:\n` +
        cases.map((c) => `- ${c.slug}: ${c.title} — ${c.tagline}`).join('\n'),
    };
  }
  return {
    found: true,
    text: [
      `# ${hit.title} (${hit.year}${hit.org ? `, ${hit.org}` : ''})`,
      hit.tagline,
      `Metrics: ${hit.metrics.map((m) => `${m.value} ${m.label}`).join(' · ')}`,
      `Source: ${hit.repoUrl}`,
      '',
      hit.body,
    ].join('\n'),
  };
}

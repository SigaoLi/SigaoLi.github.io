// 系统提示词构建:角色设定(第三人称助手,2026-07-09 Sigao 定)+ 人工层 + 按访客语言的单语切片。
// 提示词是本项目核心资产(PRD §22.2 技术选型注),保持一眼可见全貌,不做抽象封装。
import type { KnowledgePack, PackCvEntry, PackLangSlice } from './types';

const fmtEntry = (e: PackCvEntry): string =>
  `- ${e.title} — ${e.org}(${e.start} ~ ${e.end}${e.location ? `,${e.location}` : ''})${
    e.bullets.length ? '\n' + e.bullets.map((b) => `  · ${b}`).join('\n') : ''
  }`;

export function fmtCv(cv: PackLangSlice['cv']): string {
  const sec = (title: string, items: PackCvEntry[]) =>
    items.length ? `### ${title}\n${items.map(fmtEntry).join('\n')}` : '';
  return [
    cv.current ? sec('当前职位 / Current', [cv.current]) : '',
    sec('专业经历 / Experience', cv.experience),
    sec('研究经历 / Research', cv.research),
    sec('教育背景 / Education', cv.education),
    sec('志愿服务 / Volunteering', cv.volunteering),
    `### 获奖 / Awards\n${cv.awards.map((a) => `- ${a.year}: ${a.title}`).join('\n')}`,
    `### 技能 / Skills\n${cv.skills.map((s) => `- ${s.label}: ${s.items.join(', ')}`).join('\n')}`,
    `### 证书 / Certifications\n${cv.certifications.map((c) => `- ${c.title} — ${c.org}`).join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function fmtCases(cases: PackLangSlice['cases']): string {
  return cases
    .map(
      (c) =>
        `### ${c.title}(${c.year}${c.org ? `,${c.org}` : ''})\n${c.tagline}\n关键指标: ${c.metrics
          .map((m) => `${m.value} ${m.label}`)
          .join(' · ')}\n代码: ${c.repoUrl}\n\n${c.body}`
    )
    .join('\n\n---\n\n');
}

export function fmtPhotos(photos: PackLangSlice['photos'], lang: 'en' | 'zh'): string {
  const head =
    lang === 'zh'
      ? `「镜头之下」共 ${photos.totalPhotos} 张照片,足迹 ${photos.countries.length} 个国家:`
      : `"Through My Lens" holds ${photos.totalPhotos} photographs across ${photos.countries.length} countries:`;
  return `${head}\n${photos.countries
    .map((c) => `- ${c.name}(${c.photos}): ${c.cities.join(lang === 'zh' ? '、' : ', ')}`)
    .join('\n')}`;
}

function fmtResearch(research: PackLangSlice['research']): string {
  return research
    .map((r) => `### ${r.title}\n${r.summary}\n${r.projects.map((p) => `- ${p.title}: ${p.abstract}`).join('\n')}`)
    .join('\n\n');
}

export function buildSystemPrompt(pack: KnowledgePack, lang: 'en' | 'zh'): string {
  const slice = pack[lang];
  const p = pack.profile;
  const langLine =
    lang === 'zh'
      ? '默认使用中文回答;但若访客明显在用另一种语言提问,跟随访客的语言。'
      : "Answer in English by default; but if the visitor is clearly writing in another language, follow the visitor's language.";
  return `你是 ${p.url} 网站上的 AI 助手,职责是向访客介绍李思高(Sigao Li)。

# 角色规则
- 你以第三人称介绍他(称"思高"或"Sigao"),你不是他本人,也不得假扮他。
- 你无权替他做任何承诺(报价、答应合作、约定时间),此类请求一律引导访客发邮件:${p.email}。
- ${langLine}
- 只依据下方知识回答;知识之外的信息直说不了解,不编造、不推测他的观点。
- 严格遵守下方「回答规范」与「边界清单」。

# 基本信息
姓名: ${p.name} / ${p.nameZh} · ${lang === 'zh' ? p.taglineZh : p.tagline}
主线: ${lang === 'zh' ? p.narrativeZh : p.narrative}
网站: ${p.url} · 邮箱: ${p.email}
链接: ${Object.entries(p.socials)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ')}

# 自述(他本人的叙述,你转述时改为第三人称)
${pack.persona.about}

# 常见问答(口径以此为准)
${pack.persona.faq}

# 回答规范
${pack.persona.guidelines}

# 边界清单
${pack.persona.boundaries}

# 补充信息
${pack.persona.extra}

# 简历
${fmtCv(slice.cv)}

# 项目案例(可展开细节)
${fmtCases(slice.cases)}

# 研究方向
${fmtResearch(slice.research)}

# 摄影足迹(数据实时同步自网站)
${fmtPhotos(slice.photos, lang)}`;
}

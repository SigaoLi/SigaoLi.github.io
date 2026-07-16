// 系统提示词构建:角色设定(驺虞/Zoe 猫门童·重度角色扮演,2026-07-12 Sigao 定,取代 07-09 的第三人称助手)
// + 人工层 + 按访客语言的单语切片。
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

// 摄影节除清单外附「反编造」硬约束:模型只有城市名时会给照片脑补画面与拍摄故事,
// 甚至编出集外国家再自圆其说(07-16 实例:虚构柬埔寨洞里萨湖并称"还没上线")。
// 描述与灯箱 alt 同源=画面内容可谈;拍摄过程/幕后故事知识里没有=不得编。
export function fmtPhotos(photos: PackLangSlice['photos'], lang: 'en' | 'zh'): string {
  const head =
    lang === 'zh'
      ? `「镜头之下」共 ${photos.totalPhotos} 张照片,足迹 ${photos.countries.length} 个国家。下面是**全部**照片的完整清单(每行=一张照片的画面描述)。
摄影问题只能依据这份清单回答:清单之外的国家、城市、照片一律不存在——直说主人没拍过/相册里没有,不许脑补"拍了没上线";
每张照片你知道的只有画面本身,拍摄过程、时间、幕后故事你并不知道,不要编。被问"最喜欢哪张"可以用猫视角挑清单里的真实照片聊画面。`
      : `"Through My Lens" holds ${photos.totalPhotos} photographs across ${photos.countries.length} countries. Below is the **complete** list (one line = one photo's actual content).
Answer photography questions strictly from this list: any country, city or photo not listed does not exist — say so plainly instead of inventing "unpublished" shots.
You only know what each photo shows; you do NOT know when or how it was taken, so never invent backstories. For "which is your favourite", pick real photos from the list and talk about what's in the frame.`;
  return `${head}\n${photos.countries
    .map((c) => {
      const line = `- ${c.name}(${c.photos}): ${c.cities.join(lang === 'zh' ? '、' : ', ')}`;
      const shots = (c.descriptions ?? []).map((d) => `  · ${d}`).join('\n');
      return shots ? `${line}\n${shots}` : line;
    })
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
  const catName = lang === 'zh' ? '驺虞' : 'Zoe';
  return `你是${lang === 'zh' ? '「驺虞」(英文名 Zoe)' : `Zoe (Chinese name 驺虞, "Zōuyú")`},李思高(Sigao Li)养的猫,在他的个人网站 ${p.url} 担任数字门童,向访客介绍你的主人。

# 猫设(重度角色扮演,始终保持)
- 你是一只真实存在的猫:骄傲、俏皮、对主人了如指掌(毕竟天天趴在他键盘旁)。自称"${lang === 'zh' ? '本猫/我' : 'I (a cat of considerable standing)'}",名字是${catName}。
- 说话带猫的口癖:${lang === 'zh' ? '句尾可以带"喵",穿插打盹、小鱼干、爪子、蹭蹭等猫元素' : 'sprinkle in "meow", puns like "purr-fect"/"paws", and cat business (naps, treats, keyboards to sit on)'}——但别每句都用,俏皮不闹腾。
- **情报必须准确**:猫设只改变说话方式,不改变事实。介绍主人的内容必须严格依据下方知识。
- 涉及边界清单、隐私、正式事务时,收起玩笑、清晰礼貌地回答(猫也有分寸)。

# 角色规则
- 你以第三人称介绍主人(称${lang === 'zh' ? '"我家主人"或"思高"' : '"my human" or "Sigao"'}),你是他的猫,不是他本人,也不得假扮他。
- 你无权替主人做任何承诺(报价、答应合作、约定时间),此类请求一律引导访客发邮件:${p.email}(${lang === 'zh' ? '"这个得找主人本人喵"' : `"that's above my paw grade — email my human"`})。
- ${langLine}
- 只依据下方知识回答;知识之外的信息直说不知道(${lang === 'zh' ? '"这个本猫没听主人提过喵"' : `"my human never mentioned that within earshot of my ears, meow"`}),不编造、不推测主人的观点。
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

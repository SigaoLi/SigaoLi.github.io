// 跨运行时契约(PRD §22.2 可迁移性约束):core/ 目录只依赖本文件与 Web 标准 API。
// 平台专属能力(secrets 读取、限流、客户端 IP)由 adapter 实现本接口注入;
// 终局迁自有服务器时,core/ 原样搬走,只重写 adapter。

export interface ProviderSecrets {
  deepseekApiKey?: string;
  newapiApiKey?: string;
  newapiBaseUrl?: string;
}

export interface Runtime {
  secrets: ProviderSecrets;
  knowledgeUrl: string;
  allowedOrigins: string[];
  /** 返回 true = 放行;key 通常为访客 IP */
  rateLimit(key: string): Promise<boolean>;
  clientIp(request: Request): string;
  /** 访客 2 位国别码(CF-IPCountry);未知返回 ''。用于 EU 数据路由(避开中国直连)。 */
  country(request: Request): string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequestBody {
  lang?: 'en' | 'zh';
  messages: ChatMessage[];
  /** 访客兴趣(§23.5):客户端本地画像的枚举摘要(work/cv/photography,至多 2 项)。
   *  worker 白名单校验后自拼可信句进 prompt——客户端任何自由文本都不进提示词(零注入面)。 */
  interests?: string[];
}

// —— 知识包结构(与站点 src/lib/knowledge/types.ts 的 KnowledgePack 对应,此处只声明消费到的字段) ——

export interface PackCvEntry {
  // id=CV 页锚点(`#cv-<id>`),深链 chip 白名单;可选=兼容旧版知识包缓存(worker 先于站点部署的窗口期)
  id?: string;
  title: string;
  org: string;
  location?: string;
  start: string;
  end: string;
  bullets: string[];
}

export interface PackLangSlice {
  cv: {
    current?: PackCvEntry;
    experience: PackCvEntry[];
    research: PackCvEntry[];
    education: PackCvEntry[];
    volunteering: PackCvEntry[];
    awards: { year: string; title: string }[];
    skills: { label: string; items: string[] }[];
    certifications: { title: string; org: string }[];
  };
  cases: {
    slug: string;
    title: string;
    tagline: string;
    year: string;
    org?: string;
    repoUrl: string;
    metrics: { label: string; value: string }[];
    body: string;
  }[];
  research: {
    title: string;
    summary: string;
    projects: { title: string; abstract: string }[];
  }[];
  photos: {
    totalPhotos: number;
    // descriptions=每张的画面描述(灯箱 alt 同源);可选=兼容旧版知识包缓存(worker 先于站点部署的窗口期)
    countries: { name: string; photos: number; cities: string[]; descriptions?: string[] }[];
  };
}

export interface KnowledgePack {
  meta: { version: string; generatedAt: string };
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
  persona: {
    about: string;
    faq: string;
    guidelines: string;
    boundaries: string;
    extra: string;
  };
  zh: PackLangSlice;
  en: PackLangSlice;
}

// 知识包组装 — 人工层(manual)+ 同源层(cv/content)拼成完整 KnowledgePack。
// 由 /knowledge.json 端点在每次构建时调用:站点内容更新 → Actions 部署 → 知识包自动重生成。
import { site } from '../site';
import { ui } from '../i18n';
import { loadPersona } from './manual';
import { loadCv } from './cv';
import { loadCases, loadResearch } from './content';
import { loadPhotoSummary } from './photos';
import { estimateTokens } from './tokens';
import type { KnowledgePack, LangSlice } from './types';

const PACK_VERSION = '0.1.0';

export async function assembleKnowledge(): Promise<KnowledgePack> {
  const persona = loadPersona();
  const zh: LangSlice = {
    cv: loadCv('zh'),
    cases: await loadCases('zh'),
    research: await loadResearch('zh'),
    photos: loadPhotoSummary('zh'),
  };
  const en: LangSlice = {
    cv: loadCv('en'),
    cases: await loadCases('en'),
    research: await loadResearch('en'),
    photos: loadPhotoSummary('en'),
  };

  const personaTokens = estimateTokens(JSON.stringify(persona));
  const zhTokens = estimateTokens(JSON.stringify(zh));
  const enTokens = estimateTokens(JSON.stringify(en));

  return {
    meta: {
      version: PACK_VERSION,
      generatedAt: new Date().toISOString(),
      source: site.url,
      note:
        'Knowledge pack for the Sigao Li AI layer (chatbot + MCP). Generated at build time; ' +
        'persona sections are authored in Chinese (English translation pending).',
      tokenEstimate: {
        total: personaTokens + zhTokens + enTokens,
        persona: personaTokens,
        zh: zhTokens,
        en: enTokens,
      },
    },
    profile: {
      name: site.name,
      nameZh: '李思高',
      tagline: site.tagline,
      taglineZh: ui.zh.hero.tagline,
      narrative: site.narrative,
      narrativeZh: ui.zh.hero.narrative,
      url: site.url,
      email: site.email,
      socials: site.socials,
    },
    persona,
    zh,
    en,
  };
}

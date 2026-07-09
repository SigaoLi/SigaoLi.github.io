// /mcp 端点接线(PRD §22.3 第三出口:对 AI 的结构化按需查询)。
// 协议层外包:官方 @modelcontextprotocol/sdk + agents 的无状态 createMcpHandler
// (McpAgent 需 Durable Objects 付费档,已否决;无状态版保 $0,调研定案)。
// 业务实现全部在 core/tools.ts(跨运行时);本文件只是协议 glue,终局迁移时仅换传输接线。
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createMcpHandler } from 'agents/mcp';
import { z } from 'zod';
import { getKnowledge } from './core/knowledge';
import { getCaseStudy, getProfile, listExperience } from './core/tools';
import type { Runtime } from './core/types';

const text = (t: string) => ({ content: [{ type: 'text' as const, text: t }] });
const lang = z.enum(['en', 'zh']).default('en').describe("Language of the returned content ('en' or 'zh').");

export function makeMcpHandler(rt: Runtime) {
  const server = new McpServer(
    { name: 'sigaoli', title: 'Sigao Li — personal MCP server', version: '0.1.0' },
    {
      instructions:
        "Read-only structured access to Sigao Li's professional profile (sigaoli.com): " +
        'who he is, full CV, and project case studies. Content is bilingual (en/zh). ' +
        `To reach Sigao for anything beyond this data, email him (see get_profile).`,
    }
  );

  server.registerTool(
    'get_profile',
    {
      title: 'Get profile',
      description: 'Who Sigao Li is: identity, career narrative, contact links, and self-introduction.',
      inputSchema: { lang },
    },
    async ({ lang: l }) => text(getProfile(await getKnowledge(rt.knowledgeUrl), l))
  );

  server.registerTool(
    'list_experience',
    {
      title: 'List experience',
      description: 'Full CV: current role, professional experience, research, education, volunteering, awards, skills, certifications.',
      inputSchema: { lang },
    },
    async ({ lang: l }) => text(listExperience(await getKnowledge(rt.knowledgeUrl), l))
  );

  server.registerTool(
    'get_case_study',
    {
      title: 'Get case study',
      description:
        'Full text of one project case study by slug (challenge / approach / impact). ' +
        'Call with an unknown slug to get the list of valid slugs.',
      inputSchema: { lang, slug: z.string().describe('Case study slug, e.g. "gisphere-llm".') },
    },
    async ({ lang: l, slug }) => {
      const result = getCaseStudy(await getKnowledge(rt.knowledgeUrl), l, slug);
      return { ...text(result.text), isError: !result.found };
    }
  );

  return createMcpHandler(server, { route: '/mcp' });
}

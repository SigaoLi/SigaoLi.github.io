// /knowledge.json — AI 分身层的知识包(PRD §22.1)。
// 构建期生成、发布为 Pages 静态文件;Worker(/chat、/mcp)运行时拉取+缓存。
// 出包前经隐私门卫终检,命中敏感模式则构建失败。
import type { APIRoute } from 'astro';
import { assembleKnowledge } from '../lib/knowledge/assemble';
import { assertNoPrivateData } from '../lib/knowledge/guard';

export const GET: APIRoute = async () => {
  const pack = await assembleKnowledge();
  const json = JSON.stringify(pack, null, 2);
  assertNoPrivateData(json);
  return new Response(json, {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};

// sigaoli-api Worker 入口 — 只做路由与 CORS;业务逻辑全在 core/(跨运行时,见 PRD §22.2)。
// 出口:/chat(对人,SSE)· /mcp(对 AI,Streamable HTTP)· /healthz。
import { makeRuntime, type Env } from './adapter/cloudflare';
import { handleChat } from './core/chat';
import { handleClassify } from './core/classify';
import { corsHeaders, json } from './core/http';
import { checkQuota, dayKey, recentUsage } from './core/quota';
import { handleSession } from './core/turnstile';
import { makeMcpHandler } from './mcp';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const rt = makeRuntime(env);
    const cors = corsHeaders(request.headers.get('Origin') ?? '', rt.allowedOrigins);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const { pathname } = new URL(request.url);
    let res: Response;
    if (pathname === '/chat' && request.method === 'POST') {
      res = await handleChat(request, rt);
    } else if (pathname === '/classify' && request.method === 'POST') {
      res = await handleClassify(request, rt); // 意图引导 chip;失败静默返回 none,不影响 /chat
    } else if (pathname === '/mcp') {
      // MCP 与 chat 共用同一 IP 限流(调用方是脚本,不放宽)。
      // ⚠️ **这里永远不要加人机验证**:MCP 就是给机器用的(已登记官方 registry),
      //    而 Turnstile 的职责是拦机器;且工具只读知识包、零模型调用,刷它不花钱。
      if (!(await rt.rateLimit(rt.clientIp(request)))) {
        res = json({ error: 'rate_limited' }, 429);
      } else {
        console.log(`[mcp] ${request.method} request`); // 使用量日志,不含内容
        // 无状态模式要求每请求新建 McpServer 实例(实测踩坑:复用实例会 "already connected")
        res = await makeMcpHandler(rt)(request, env, ctx);
      }
    } else if (pathname === '/session' && request.method === 'POST') {
      res = await handleSession(request, rt); // Turnstile token → 30 分钟会话凭证(见 turnstile.ts)
    } else if (pathname === '/usage' && request.method === 'GET') {
      // 用量自查(§22.7):最近 7 天每天答了多少 + 今天是否封顶。
      // 只是聚合计数,不含任何对话内容,故公开可读——Sigao 判断"要不要调高上限"的依据。
      const [today, recent] = await Promise.all([checkQuota(rt), recentUsage(rt, 7)]);
      res = json({ today: { day: dayKey(), used: today.used, cap: today.cap, capped: !today.ok }, recent });
    } else if (pathname === '/healthz') {
      res = json({ ok: true, service: 'sigaoli-api' });
    } else {
      res = json({ error: 'not_found' }, 404);
    }

    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
    return res;
  },
} satisfies ExportedHandler<Env>;

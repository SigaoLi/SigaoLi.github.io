// sigaoli-api Worker 入口 — 只做路由与 CORS;业务逻辑全在 core/(跨运行时,见 PRD §22.2)。
// 出口:/chat(对人,SSE)· /mcp(对 AI,Streamable HTTP)· /healthz。
import { makeRuntime, type Env } from './adapter/cloudflare';
import { handleChat } from './core/chat';
import { handleClassify } from './core/classify';
import { corsHeaders, json } from './core/http';
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
      // MCP 与 chat 共用同一 IP 限流(调用方是脚本,不放宽)
      if (!(await rt.rateLimit(rt.clientIp(request)))) {
        res = json({ error: 'rate_limited' }, 429);
      } else {
        console.log(`[mcp] ${request.method} request`); // 使用量日志,不含内容
        // 无状态模式要求每请求新建 McpServer 实例(实测踩坑:复用实例会 "already connected")
        res = await makeMcpHandler(rt)(request, env, ctx);
      }
    } else if (pathname === '/healthz') {
      res = json({ ok: true, service: 'sigaoli-api' });
    } else {
      res = json({ error: 'not_found' }, 404);
    }

    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
    return res;
  },
} satisfies ExportedHandler<Env>;

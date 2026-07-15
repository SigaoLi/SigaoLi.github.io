// Cloudflare 专属能力的唯一收口(PRD §22.2 可迁移性约束):
// secrets/vars 读取、Rate Limiting binding、CF 的客户端 IP 头。
// 终局迁自有服务器时:core/ 原样搬走,只需为新运行时重写一个等价的 makeRuntime。
import type { Runtime } from '../core/types';

export interface Env {
  DEEPSEEK_API_KEY?: string;
  NEWAPI_API_KEY?: string;
  NEWAPI_BASE_URL?: string;
  KNOWLEDGE_URL: string;
  ALLOWED_ORIGINS?: string;
  CHAT_RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
}

export function makeRuntime(env: Env): Runtime {
  return {
    secrets: {
      deepseekApiKey: env.DEEPSEEK_API_KEY,
      newapiApiKey: env.NEWAPI_API_KEY,
      newapiBaseUrl: env.NEWAPI_BASE_URL,
    },
    knowledgeUrl: env.KNOWLEDGE_URL,
    allowedOrigins: (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    // binding 缺失(本地极简启动)时放行 —— 生产必须配置 ratelimit binding
    rateLimit: async (key) => (env.CHAT_RATE_LIMITER ? (await env.CHAT_RATE_LIMITER.limit({ key })).success : true),
    clientIp: (request) => request.headers.get('CF-Connecting-IP') ?? 'unknown',
    // CF 在边缘注入 CF-IPCountry(2 位码;'XX'/'T1' 等=未知)。终局迁服务器时换等价 GeoIP 头。
    country: (request) => request.headers.get('CF-IPCountry') ?? '',
  };
}

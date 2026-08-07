// Cloudflare 专属能力的唯一收口(PRD §22.2 可迁移性约束):
// secrets/vars 读取、Rate Limiting binding、CF 的客户端 IP 头。
// 终局迁自有服务器时:core/ 原样搬走,只需为新运行时重写一个等价的 makeRuntime。
import type { Runtime } from '../core/types';

export interface Env {
  DEEPSEEK_API_KEY?: string;
  NEWAPI_API_KEY?: string;
  NEWAPI_BASE_URL?: string;
  TURNSTILE_SECRET?: string;
  KNOWLEDGE_URL: string;
  ALLOWED_ORIGINS?: string;
  ALERT_TO?: string;
  ALERT_FROM?: string;
  CHAT_RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
  /** 日额度计数器(KV namespace binding) */
  CHAT_QUOTA?: KVNamespace;
  /** Cloudflare Email:发往已验证地址免费、不占配额;未绑定则不发提醒 */
  ALERT_EMAIL?: { send(message: EmailMessage): Promise<void> };
}

/** 极简 RFC 5322 邮件体:Cloudflare 的 send binding 收的是原始邮件流 */
function rawEmail(from: string, to: string, subject: string, body: string): string {
  const b64Subject = `=?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(subject)))}?=`;
  return [
    `From: <${from}>`,
    `To: <${to}>`,
    `Subject: ${b64Subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    btoa(String.fromCharCode(...new TextEncoder().encode(body))).replace(/(.{76})/g, '$1\r\n'),
  ].join('\r\n');
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
    turnstileSecret: env.TURNSTILE_SECRET,
    kv: env.CHAT_QUOTA
      ? {
          get: (k) => env.CHAT_QUOTA!.get(k),
          put: (k, v, o) => env.CHAT_QUOTA!.put(k, v, o),
        }
      : undefined,
    // 三者齐备才装配发信能力;缺任一则 sendAlert 为 undefined,quota 那边静默跳过
    sendAlert:
      env.ALERT_EMAIL && env.ALERT_TO && env.ALERT_FROM
        ? async (subject, body) => {
            // EmailMessage 由 cloudflare:email 提供,仅在绑定存在时才需要
            const { EmailMessage } = (await import('cloudflare:email')) as {
              EmailMessage: new (from: string, to: string, raw: string) => EmailMessage;
            };
            await env.ALERT_EMAIL!.send(
              new EmailMessage(env.ALERT_FROM!, env.ALERT_TO!, rawEmail(env.ALERT_FROM!, env.ALERT_TO!, subject, body))
            );
          }
        : undefined,
  };
}

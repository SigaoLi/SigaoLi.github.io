// 人机验证(PRD §22.7)。只保护花钱的端点:/chat 与 /classify。
//
// ⚠️ **/mcp 永不加验证** —— 它存在的意义就是给机器用(已登记官方 MCP Registry),
//    而 Turnstile 的职责恰恰是拦机器,两者天然对立;且 MCP 工具只读知识包、零模型调用,
//    刷它不花钱,现有的 IP 限流足够。静态出口(llms.txt / knowledge.json / .well-known)
//    根本不经过 Worker,更不受影响 —— agent 读站点、用 MCP 问经历一律畅通。
//
// 流程:首条消息带 Turnstile token → 核验一次 → 签发我们自己的会话凭证(HMAC,30 分钟)
//      后续消息只带凭证,本地验签,不再往 Cloudflare 跑。
//      凭证绑 IP:被人拿走换个网络也用不了;真实访客换网络时前端会静默重验一次,无感。
//
// 未配置 secret 时**整体跳过**:本地开发与 E2E 不受影响(生产必须配)。
import { json } from './http';
import type { Runtime } from './types';

const SESSION_TTL_MS = 30 * 60 * 1000;
const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const VERIFY_TIMEOUT_MS = 5_000;

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function sign(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}

/** 常数时间比较:签名校验不能用 === 提前返回(时序侧信道) */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** 会话凭证 = `v1.<过期毫秒>.<签名>`;签名覆盖版本、过期时间与访客 IP */
export async function issueSession(secret: string, ip: string): Promise<string> {
  const exp = Date.now() + SESSION_TTL_MS;
  const body = `v1.${exp}.${ip}`;
  return `v1.${exp}.${await sign(secret, body)}`;
}

export async function checkSession(secret: string, token: string, ip: string): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  return safeEqual(parts[2], await sign(secret, `v1.${exp}.${ip}`));
}

/** 向 Cloudflare 核验一次性 token。网络故障返回 null(调用方决定放行与否),明确失败返回 false。 */
export async function verifyTurnstile(secret: string, token: string, ip: string): Promise<boolean | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), VERIFY_TIMEOUT_MS);
  try {
    const res = await fetch(SITEVERIFY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
    if (!data.success) console.log(`[turnstile] rejected: ${(data['error-codes'] ?? []).join(',') || 'unknown'}`);
    return !!data.success;
  } catch {
    clearTimeout(timer);
    return null; // siteverify 打不通:基础设施故障,不该由访客承担
  }
}

/**
 * `POST /session` —— 拿一次性 Turnstile token 换 30 分钟会话凭证。
 *
 * 为什么单独一个端点:一枚 token 只能核验一次,而前端要同时打 /chat 与 /classify。
 * 若让 /chat 顺带签发,/classify 就得等它的响应头,**首条消息的引导 chip 会被拖到首 token 之后**
 * ——而 chip 早出正是它的价值所在。拆出来后两个请求恢复并行,代价只是每 30 分钟多一次小请求。
 */
export async function handleSession(request: Request, rt: Runtime): Promise<Response> {
  const ip = rt.clientIp(request);
  if (!(await rt.rateLimit(`s:${ip}`))) return json({ error: 'rate_limited' }, 429);
  if (!rt.turnstileSecret) return json({ session: '' }); // 未配置=验证关闭,前端拿空串照常走
  let token = '';
  try {
    token = ((await request.json()) as { turnstileToken?: string }).turnstileToken ?? '';
  } catch { /* 空 body 按无 token 处理 */ }
  if (!token) return json({ error: 'human_check_required' }, 403);
  const verdict = await verifyTurnstile(rt.turnstileSecret, token, ip);
  if (verdict === false) return json({ error: 'human_check_failed' }, 403);
  // verdict===null(siteverify 故障)也放行:宁可漏过机器人,不可因 Cloudflare 抖动挡住真人;日额度仍兜底
  return json({ session: await issueSession(rt.turnstileSecret, ip) });
}

export interface GateResult {
  ok: boolean;
  /** 新签发的会话凭证(仅本次刚验过 Turnstile 时返回),前端存下来给后续消息用 */
  session?: string;
  /** 拒绝原因;前端据此决定是否重取 token 再试一次 */
  error?: 'human_check_required' | 'human_check_failed';
}

/**
 * 放行判定。顺序:未配置→放行 / 会话凭证有效→放行 / 带 Turnstile token→核验 / 都没有→拒。
 * siteverify 自身故障(返回 null)按放行处理——**宁可漏过机器人,不可因 Cloudflare 抖动把真人挡在门外**;
 * 真出事时全站每日额度仍然兜着底。
 */
export async function gate(rt: Runtime, ip: string, sessionToken?: string, turnstileToken?: string): Promise<GateResult> {
  const secret = rt.turnstileSecret;
  if (!secret) return { ok: true }; // 未配置=功能关闭

  if (sessionToken && (await checkSession(secret, sessionToken, ip))) return { ok: true };

  if (!turnstileToken) return { ok: false, error: 'human_check_required' };

  const verdict = await verifyTurnstile(secret, turnstileToken, ip);
  if (verdict === false) return { ok: false, error: 'human_check_failed' };
  // verdict === null(故障)也签发凭证:让这位访客接下来 30 分钟不必反复卡在这里
  return { ok: true, session: await issueSession(secret, ip) };
}

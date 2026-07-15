// /chat 处理器:限流 → 校验 → 组 prompt → 沿提供商链开流 → SSE 中继给前端。
// 错误码约定(前端据此显示文案):rate_limited / turn_limit / bad_request / upstream_unavailable。
import { LIMITS } from './config';
import { json } from './http';
import { getKnowledge } from './knowledge';
import { buildSystemPrompt } from './prompt';
import { isEuLike, openCompletionStream, providerChain, type UpstreamMessage } from './providers';
import { relayStream } from './sse';
import type { ChatMessage, ChatRequestBody, Runtime } from './types';

/** 历史超长时从最旧开始丢弃(保底保留最后一条 user 消息)。 */
function trimHistory(messages: ChatMessage[], maxChars: number): ChatMessage[] {
  const kept: ChatMessage[] = [];
  let total = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    total += messages[i].content.length;
    if (total > maxChars && kept.length > 0) break;
    kept.unshift(messages[i]);
  }
  return kept;
}

function validate(body: ChatRequestBody): { ok: true; messages: ChatMessage[] } | { ok: false; error: string; status: number } {
  const msgs = Array.isArray(body.messages) ? body.messages : [];
  const wellFormed =
    msgs.length > 0 &&
    msgs.every(
      (m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.length > 0
    ) &&
    msgs[msgs.length - 1].role === 'user';
  if (!wellFormed) return { ok: false, error: 'bad_request', status: 400 };
  if (msgs[msgs.length - 1].content.length > LIMITS.maxUserChars) return { ok: false, error: 'bad_request', status: 400 };
  const userTurns = msgs.filter((m) => m.role === 'user').length;
  if (userTurns > LIMITS.maxTurns) return { ok: false, error: 'turn_limit', status: 429 };
  return { ok: true, messages: msgs };
}

export async function handleChat(request: Request, rt: Runtime): Promise<Response> {
  if (!(await rt.rateLimit(rt.clientIp(request)))) return json({ error: 'rate_limited' }, 429);

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const checked = validate(body);
  if (!checked.ok) return json({ error: checked.error }, checked.status);

  const lang = body.lang === 'en' ? 'en' : 'zh';
  const pack = await getKnowledge(rt.knowledgeUrl);
  const upstreamMessages: UpstreamMessage[] = [
    { role: 'system', content: buildSystemPrompt(pack, lang) },
    ...trimHistory(checked.messages, LIMITS.maxHistoryChars),
  ];

  // EU/EEA/UK 访客:数据不出欧盟(只用 NewAPI,不回退 DeepSeek 中国直连)
  const country = rt.country(request);
  const euLike = isEuLike(country);
  const chain = providerChain(rt.secrets, euLike);
  try {
    const { upstream, provider } = await openCompletionStream(chain, upstreamMessages, LIMITS.maxTokens);
    // 使用量日志(wrangler tail 可查):只记元数据,不含对话内容
    console.log(`[chat] lang=${lang} country=${country || '??'} eu=${euLike} turns=${checked.messages.filter((m) => m.role === 'user').length} provider=${provider.name}`);
    return new Response(relayStream(upstream.body!, provider.name), {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[chat] all providers failed:', err);
    return json({ error: 'upstream_unavailable' }, 503);
  }
}

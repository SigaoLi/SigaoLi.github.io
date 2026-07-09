// LLM 提供商回退链(PRD §22.8 定案):deepseek-v4-pro 直连 → NewAPI(gpt-5-mini → gpt-4.1-nano)。
// 三家全 OpenAI 兼容:provider = (baseUrl, key, model) 配置项,增删提供商零架构成本。
import { LIMITS } from './config';
import type { ProviderSecrets } from './types';

export interface Provider {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export function providerChain(secrets: ProviderSecrets): Provider[] {
  const chain: Provider[] = [];
  if (secrets.deepseekApiKey)
    chain.push({
      name: 'deepseek/v4-pro',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: secrets.deepseekApiKey,
      model: 'deepseek-v4-pro',
    });
  if (secrets.newapiApiKey && secrets.newapiBaseUrl) {
    const base = secrets.newapiBaseUrl.replace(/\/$/, '');
    chain.push(
      { name: 'newapi/gpt-5-mini', baseUrl: base, apiKey: secrets.newapiApiKey, model: 'gpt-5-mini' },
      { name: 'newapi/gpt-4.1-nano', baseUrl: base, apiKey: secrets.newapiApiKey, model: 'gpt-4.1-nano' }
    );
  }
  return chain;
}

export interface UpstreamMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** 沿链依次尝试,返回第一个成功开流的上游 SSE 响应;全部失败抛最后一个错误。 */
export async function openCompletionStream(
  chain: Provider[],
  messages: UpstreamMessage[],
  maxTokens: number
): Promise<{ upstream: Response; provider: Provider }> {
  let lastErr: unknown = new Error('provider chain is empty');
  for (const provider of chain) {
    // 连接超时:上游挂起不响应时不能干等(回退链只对"会失败"的上游生效);
    // 计时只覆盖到响应头返回,拿到流后 clearTimeout,不限制回答流本身的时长。
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(`${provider.name} connect timeout`), LIMITS.upstreamConnectMs);
    try {
      const upstream = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({ model: provider.model, messages, stream: true, max_tokens: maxTokens }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (upstream.ok && upstream.body) return { upstream, provider };
      lastErr = new Error(`${provider.name} HTTP ${upstream.status}`);
      await upstream.body?.cancel();
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
    }
  }
  throw lastErr;
}

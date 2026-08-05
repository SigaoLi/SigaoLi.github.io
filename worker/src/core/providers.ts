// LLM 提供商回退链(PRD §22.8 定案):deepseek-v4-pro 直连 → NewAPI(gpt-5-mini → gpt-4.1-nano)。
// 三家全 OpenAI 兼容:provider = (baseUrl, key, model) 配置项,增删提供商零架构成本。
// EU 数据路由(2026-07-15 定):欧盟/EEA/英国访客只走欧盟落地的 NewAPI 网关(newapi.gisphere.info=
// Azure Sweden,上游非中国转发,Sigao 已确认),排除 DeepSeek(中国)直连,避免 GDPR 跨境到中国。
import { LIMITS } from './config';
import type { ProviderSecrets } from './types';

export interface Provider {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

// EU 27 + EEA(冰岛 IS/列支敦士登 LI/挪威 NO)+ 英国(GB,脱欧后 UK GDPR 同等)。CF-IPCountry 为 2 位码。
const EU_LIKE = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO', 'GB',
]);

/** 访客国别是否受 GDPR/UK GDPR 约束(需避开中国直连)。未知国别('' / 'XX')按非 EU 处理。 */
export function isEuLike(country: string): boolean {
  return EU_LIKE.has(country.toUpperCase());
}

export function providerChain(secrets: ProviderSecrets, euLike = false): Provider[] {
  const deepseek: Provider[] = secrets.deepseekApiKey
    ? [{
        name: 'deepseek/v4-pro',
        baseUrl: 'https://api.deepseek.com/v1',
        apiKey: secrets.deepseekApiKey,
        model: 'deepseek-v4-pro',
        // ⚠️ 不要关 thinking(DeepSeek 默认 enabled/effort=high)。2026-08-05 A/B 实测:关掉后
        // 问「他最喜欢哪张照片」会凭空编出「挪威的雪山、冷得爪爪要冻掉」——即 07-16 修过的照片幻觉,
        // 提示词里的「不得编造」挡不住;回答也从 139 tok 掉到 28 tok,猫设人味明显变干。
        // 只省约 1.3s 首 token,而 Zoe 歪头思考的动画本就在掩盖这段等待,不划算。
        // 另注:v4-pro 的 reasoning_effort=low 会被内部映射回 high,没有"调低"这一档,只有开/关。
        // 分类器 /classify 情况相反(机械任务,输出逐字相同),已在 classify.ts 关闭。
      }]
    : [];
  const newapi: Provider[] =
    secrets.newapiApiKey && secrets.newapiBaseUrl
      ? (() => {
          const base = secrets.newapiBaseUrl!.replace(/\/$/, '');
          return [
            { name: 'newapi/gpt-5-mini', baseUrl: base, apiKey: secrets.newapiApiKey!, model: 'gpt-5-mini' },
            { name: 'newapi/gpt-4.1-nano', baseUrl: base, apiKey: secrets.newapiApiKey!, model: 'gpt-4.1-nano' },
          ];
        })()
      : [];
  // EU 访客:仅欧盟落地的 NewAPI(网关内仍有 gpt-5-mini→nano 二级回退);故意不回退到 DeepSeek——
  // NewAPI 全挂宁可报 upstream_unavailable,也不把欧盟访客数据发去中国(fail-closed 保护隐私)。
  if (euLike) return newapi;
  return [...deepseek, ...newapi];
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

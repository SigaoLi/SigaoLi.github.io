// 知识包运行时拉取 + isolate 内存缓存(PRD §22.1:Worker 运行时拉取 Pages 静态文件)。
// 拉取失败时若有过期缓存则降级续用,机器人不因源站抖动而中断。
import { KNOWLEDGE_TTL_MS } from './config';
import type { KnowledgePack } from './types';

let cache: { pack: KnowledgePack; at: number } | null = null;

export async function getKnowledge(url: string): Promise<KnowledgePack> {
  if (cache && Date.now() - cache.at < KNOWLEDGE_TTL_MS) return cache.pack;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`knowledge fetch HTTP ${res.status}`);
    cache = { pack: (await res.json()) as KnowledgePack, at: Date.now() };
    return cache.pack;
  } catch (err) {
    if (cache) return cache.pack; // 过期缓存兜底
    throw err;
  }
}

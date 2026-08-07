// 全站每日额度(PRD §22.7 费用四件套的最后一件)。
//
// 与限流的分工:每 IP 5 次/分钟防单点狂刷,换 IP 就绕过;Turnstile 防"不是真浏览器"(换多少 IP
// 都拿不出 token);**本模块是最后一道底——整站一个计数器,不看你是谁,今天答满就停**。
// 正因为它对 IP 轮换天然免疫,才配当兜底。
//
// 代价要认:额度用完后当天真实访客也会被拒,所以上限要设得宽(500 而非 50),
// 让它只在真出事时触发,而不是三天两头误伤。按实测 $0.0003/次对话,封顶日损失约 ¥1。
//
// 存储用 KV(免费档:10 万读/天、1000 写/天、**同 key 每秒 1 写**)。日常流量绰绰有余;
// 被爆刷时同 key 写入受限可能丢几次计数,但那时本就要封顶,不影响兜底效果。
import type { Runtime } from './types';

export const DAILY_CAP = 500;

/** 按 UTC+8 分日:Sigao 在上海,日界线跟他的"今天"一致,看数据不用换算 */
export function dayKey(now = new Date()): string {
  return new Date(now.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
}
const countKey = (day: string) => `chat:${day}`;
const alertKey = (day: string) => `alerted:${day}`;

export interface QuotaState {
  ok: boolean;
  used: number;
  cap: number;
}

/** 只读检查。KV 不可用(未绑定/故障)时放行——额度是兜底,不该成为新的故障点。 */
export async function checkQuota(rt: Runtime, day = dayKey()): Promise<QuotaState> {
  if (!rt.kv) return { ok: true, used: 0, cap: DAILY_CAP };
  const raw = await rt.kv.get(countKey(day));
  const used = Number(raw ?? 0) || 0;
  return { ok: used < DAILY_CAP, used, cap: DAILY_CAP };
}

/**
 * 记一次用量;返回递增后的值。刚好越过上限时发一次提醒(每天最多一封,不是每次请求都发)。
 * 保留 40 天:够看月度趋势,又不会无限堆积。
 */
export async function bumpQuota(rt: Runtime, day = dayKey()): Promise<number> {
  if (!rt.kv) return 0;
  const used = (Number((await rt.kv.get(countKey(day))) ?? 0) || 0) + 1;
  await rt.kv.put(countKey(day), String(used), { expirationTtl: 40 * 86400 });
  if (used === DAILY_CAP) await alertOnce(rt, day, used);
  return used;
}

async function alertOnce(rt: Runtime, day: string, used: number): Promise<void> {
  if (!rt.kv) return;
  if (await rt.kv.get(alertKey(day))) return; // 今天已提醒过
  await rt.kv.put(alertKey(day), '1', { expirationTtl: 3 * 86400 });
  console.log(`[quota] daily cap reached day=${day} used=${used}`);
  try {
    await rt.sendAlert?.(
      `sigaoli.com 聊天额度已用完(${day})`,
      [
        `今天(${day}, UTC+8)的对话额度 ${DAILY_CAP} 次已用完,后续请求会被拒答,明天零点自动恢复。`,
        '',
        '这可能是两种情况:',
        '  1. 真实访客变多了 —— 说明该调高上限(改 worker/src/core/quota.ts 的 DAILY_CAP)',
        '  2. 有人在刷 —— Turnstile 没拦住,值得看看',
        '',
        '最近几天的用量: https://api.sigaoli.com/usage',
      ].join('\n')
    );
  } catch (err) {
    console.error('[quota] alert failed:', err); // 提醒失败不能影响主流程
  }
}

/** 最近 N 天用量,给 /usage 端点用——有历史数据才好判断要不要调整上限 */
export async function recentUsage(rt: Runtime, days = 7): Promise<{ day: string; used: number }[]> {
  if (!rt.kv) return [];
  const out: { day: string; used: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = dayKey(new Date(Date.now() - i * 86400_000));
    out.push({ day: d, used: Number((await rt.kv.get(countKey(d))) ?? 0) || 0 });
  }
  return out;
}

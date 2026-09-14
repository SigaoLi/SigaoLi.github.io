// 基线 = 「对面译文当初是照着哪一版内容生成的」，不是「上次看到的版本」。
// 这个区别很要紧：判为「只是润色、不用翻」时**不推进基线**，否则十次各自
// 无害的微调叠起来可能已经变了意思，却因为每次只跟上一次比而永远触发不了。
import { createHash } from 'node:crypto';

export const hashOf = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

/**
 * @param {{en:string, zh:string}|null} base  该文件对的基线；null = 管线从没见过它
 * @param {string|null} en  当前英文内容；null = 文件不存在
 * @param {string|null} zh  当前中文内容
 * @returns {{kind:'unchanged'|'one-side'|'both'|'new'|'deleted'|'gone', changed?:'en'|'zh', gone?:'en'|'zh'}}
 */
export function pairState(base, en, zh) {
  // 没有基线 = 管线没见过这对。此时单边存在只可能是「新增」，
  // 绝不能当成「对面被删了」——那会把刚写好的文件删掉。
  if (!base) return { kind: 'new' };

  if (en === null && zh === null) return { kind: 'gone' };
  if (en === null) return { kind: 'deleted', gone: 'en' };
  if (zh === null) return { kind: 'deleted', gone: 'zh' };

  const enChanged = hashOf(en) !== base.en;
  const zhChanged = hashOf(zh) !== base.zh;

  if (!enChanged && !zhChanged) return { kind: 'unchanged' };
  if (enChanged && zhChanged) return { kind: 'both' };
  return { kind: 'one-side', changed: enChanged ? 'en' : 'zh' };
}

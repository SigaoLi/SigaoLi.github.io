// 粗略 token 估算 — 用于监控知识包体积(PRD §22.1 预算 ~15k token)。
// 经验系数:CJK ≈ 1.6 字/token,其余 ≈ 4 字符/token;只求量级正确,不求精确。

const CJK_RE = /[　-鿿豈-﫿]/g;

export function estimateTokens(text: string): number {
  const cjk = (text.match(CJK_RE) ?? []).length;
  return Math.ceil(cjk / 1.6 + (text.length - cjk) / 4);
}

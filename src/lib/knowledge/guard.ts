// 隐私门卫 — 知识包成品若命中以下模式,构建直接失败(PRD §22.1:隐私边界靠架构不靠自觉)。
// 类别清单的人类可读版在 src/data/knowledge/boundaries.md;此处是机器强制执行版。

const PATTERNS: { name: string; re: RegExp }[] = [
  { name: '中国大陆手机号', re: /(?<!\d)1[3-9]\d{9}(?!\d)/ },
  { name: '身份证号', re: /(?<!\d)\d{17}[\dXx](?!\d)/ },
  { name: '带国际区号的电话', re: /\+\d{10,15}/ },
  { name: '经纬度坐标', re: /\d{1,3}\.\d{3,}\s*°?\s*[NSEW]/i },
];

// 已知需拦截的具体字符串(注意:本文件在公开仓库,只放"万一出现必须拦"的非机密文本;
// 真正的秘密从一开始就不该写进仓库任何位置)。
const BLOCKED_LITERALS: string[] = [];

/** 对知识包 JSON 成品做终检;命中即抛错终止构建。 */
export function assertNoPrivateData(packJson: string): void {
  const hits: string[] = [];
  for (const { name, re } of PATTERNS) {
    const m = packJson.match(re);
    if (m) hits.push(`${name}: "${m[0]}"`);
  }
  for (const lit of BLOCKED_LITERALS) {
    if (packJson.includes(lit)) hits.push(`黑名单字符串: "${lit}"`);
  }
  if (hits.length) {
    throw new Error(
      `[knowledge] 隐私门卫拦截:知识包含疑似敏感内容,构建终止。\n  - ${hits.join('\n  - ')}\n` +
        '  处理:从素材中移除该内容;若确认为误报,在 guard.ts 调整对应模式。'
    );
  }
}

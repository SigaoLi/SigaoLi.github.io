// HTTP 小工具:JSON 响应与 CORS(纯 Web 标准,无平台依赖)。

export const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

/** 白名单命中(或本地开发 localhost)才返回 CORS 头;否则空对象 = 浏览器拒绝跨域读取。 */
export function corsHeaders(origin: string, allowed: string[]): Record<string, string> {
  const ok = allowed.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin);
  if (!ok) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

// Single source of truth for site-wide config & identity copy.
export const site = {
  name: 'Sigao Li',
  title: 'Sigao Li — AI Product Manager · Spatial Data Scientist',
  description:
    'AI Product Manager with geospatial roots. From maps to models, and the products in between.',
  url: 'https://sigaoli.com',
  // AI 分身层 API(Cloudflare Worker;前端与发现层只认这个域名,后端可换 — PRD §22.2)
  api: 'https://api.sigaoli.com',
  email: 'sigao.li@outlook.com',
  tagline: 'AI Product Manager · Spatial Data Scientist',
  narrative: 'From maps to models, and the products in between.',
  socials: {
    github: 'https://github.com/SigaoLi',
    gisphere: 'https://gisphere.info/',
    linkedin: 'https://www.linkedin.com/in/sigao-li',
    researchgate: 'https://www.researchgate.net/profile/Sigao-Li',
  },
  // GoatCounter site code (e.g. 'sigaoli' → sigaoli.goatcounter.com). Empty = analytics off.
  goatcounter: 'sigaoli',
  // Cloudflare Turnstile sitekey。**这是公开值**——它本来就要印在发给每个访客的 HTML 里,
  // 所以直接提交进源码,不放密钥管理(私钥在 worker 的 TURNSTILE_SECRET,绝不入仓库)。
  // 留空 = 人机验证关闭(前端不加载脚本、worker 也跳过校验)。
  //
  // dev 用官方"恒通过"测试 key:真 key 会拦 headless(它的工作就是拦自动化),
  // 否则所有跑真实 worker 的 E2E 都没法过。worker 侧 .dev.vars 配的是配套的测试 secret。
  turnstileSitekey: import.meta.env.DEV ? '1x00000000000000000000BB' : '0x4AAAAAAEJDvBlmNci2AmV1',
};

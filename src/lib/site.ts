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
};

// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://sigaoli.com',
  output: 'static',
  trailingSlash: 'ignore',
  // Astro 7 把默认值从 true 改成 'jsx',后者会吃掉内联元素之间的空格
  // (实测:隐私页「please contact <a>邮箱</a>」渲染成 "contactsigao.li@…")。
  // 显式锁回 v6 行为,避免全站排版回归。
  compressHTML: true,
  devToolbar: { enabled: false },
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh'],
    routing: { prefixDefaultLocale: false },
  },
  // Legacy Jekyll URLs (PRD §5.2) — emitted as meta-refresh pages on GitHub Pages
  redirects: {
    '/publications': '/work',
    '/publication/2024-trying': '/work',
    '/research': '/work#research',
    // 第二批（2026-07-18，GoatCounter `404-` 实测数据）：旧 Jekyll _research/ 详情页仍被外部收录
    '/research/business-geography': '/work#research',
    '/research/quantitative-finance': '/work#research',
    '/research/environmental-monitoring': '/work#research',
    '/research/crime-analysis': '/work#research',
    '/research/public-health': '/work#research',
    '/research/social-media': '/work#research',
    '/media': '/photography',
    '/resume': '/cv',
    '/about': '/',
    '/talks': '/work',
    '/portfolio': '/work',
    '/year-archive': '/work',
    '/talkmap': '/photography',
    '/sitemap': '/sitemap-index.xml',
    '/terms': '/',
  },
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'en',
        locales: { en: 'en', zh: 'zh-CN' },
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      // Pre-bundle all GSAP entry points up front — page-by-page discovery
      // otherwise triggers vite re-optimization (504 Outdated Optimize Dep) in dev.
      include: [
        'gsap',
        'gsap/ScrollTrigger',
        'gsap/SplitText',
        'gsap/DrawSVGPlugin',
        'gsap/MorphSVGPlugin',
        'gsap/Flip',
      ],
    },
  },
});

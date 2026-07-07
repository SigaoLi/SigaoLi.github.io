// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://sigaoli.com',
  output: 'static',
  trailingSlash: 'ignore',
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

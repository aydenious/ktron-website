import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://ktron.my',
  build: { format: 'directory' },
  integrations: [
    sitemap({
      filter: (page) => !/\/(brand|og)\//.test(page),
      i18n: { defaultLocale: 'en', locales: { en: 'en', zh: 'zh-Hans' } },
    }),
  ],
});

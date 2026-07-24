import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  output: 'static',
  build: {
    inlineStylesheets: 'auto',
  },
  integrations: [
    react(),
    tailwind({ applyBaseStyles: false }),
  ],
});

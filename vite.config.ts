import { defineConfig } from 'vite';
import analog from '@analogjs/platform';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/streetsurfclub-gh/',
  build: {
    target: ['es2020'],
  },
  resolve: {
    mainFields: ['module'],
  },
  plugins: [
    analog({
      content: {
        highlighter: 'prism',
      },
      prerender: {
        routes: async () => [
          '/',
          '/about',
          {
            contentDir: 'src/content/blog',
            transform: (file) => {
              if (file.attributes.draft) return false;
              const slug = file.attributes.slug || file.name;
              return `/blog/${slug}`;
            },
            outputSourceFile: (file) =>
              file.attributes.draft ? false : file.content,
          },
          {
            contentDir: 'src/content/pages',
            transform: (file) => {
              const slug = file.attributes.slug || file.name;
              return `/page/${slug}`;
            },
            outputSourceFile: (file) => file.content,
          },
        ],
        sitemap: { host: 'https://streetsurfclub.github.io/streetsurfclub-gh' },
      },
    }),
  ],
});

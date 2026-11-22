import { readdirSync, readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import analog from '@analogjs/platform';

/** Keep in sync with POSTS_PER_PAGE in src/app/post-list.ts. */
const POSTS_PER_PAGE = 12;

function countPosts(): number {
  return readdirSync('src/content/blog')
    .filter((f) => f.endsWith('.md'))
    .filter((f) => !/^draft:\s*true/m.test(readFileSync(`src/content/blog/${f}`, 'utf8')))
    .length;
}

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
        routes: async () => {
          const totalPages = Math.max(1, Math.ceil(countPosts() / POSTS_PER_PAGE));
          return [
            '/',
            // blog pagination: /posts/2 … /posts/N (page 1 is '/')
            ...Array.from({ length: totalPages - 1 }, (_, i) => `/posts/${i + 2}`),
            // tag filtering runs client-side via ?tag= on the prerendered
            // list pages (see post-search.ts) — no per-tag routes needed
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
          ];
        },
        sitemap: { host: 'https://streetsurfclub.github.io/streetsurfclub-gh' },
      },
    }),
  ],
});

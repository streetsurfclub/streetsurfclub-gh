/**
 * migrate-from-blogger.mjs
 * Fetches all Blogger posts + pages, converts HTML to clean Markdown,
 * downloads images to public/images/uploads, writes .md files to
 * src/content/blog/ and src/content/pages/ compatible with AnalogJS + Sveltia CMS.
 *
 * Usage:
 *   node --env-file=../streetsurfclub-analog/.env scripts/migrate-from-blogger.mjs [--dry-run]
 *
 * Required env vars (from .env file):
 *   GOOGLE_BLOGGER_API_KEY
 *   GOOGLE_BLOGGER_ID
 *
 * Dev deps: turndown, turndown-plugin-gfm, jsdom
 */

import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, resolve, join, basename } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { createRequire } from 'module';

import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';

const require = createRequire(import.meta.url);

// Setup JSDOM globals for turndown (needs DOM in Node)
const { window } = new JSDOM('');
globalThis.window = window;
globalThis.document = window.document;

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const CONTENT_BLOG_DIR = join(PROJECT_ROOT, 'src/content/blog');
const CONTENT_PAGES_DIR = join(PROJECT_ROOT, 'src/content/pages');
const MEDIA_DIR = join(PROJECT_ROOT, 'public/images/uploads');
const BASE_URL = '/streetsurfclub-gh/images/uploads';

const BLOGGER_API = 'https://www.googleapis.com/blogger/v3';
const MAX_RESULTS = 50;

// ---- Legacy label cleanup (from label-posts.mjs) -------------------------------
const LABEL_RENAME = {
  'FireStarter': 'Firestarter',
  'Openroad': 'Open Road',
  'WM': 'Weltmeisterschaft',
  'Skater Of The Month': 'Skater of the Month',
  'Skater des Monats': 'Skater of the Month',
  'Gravity Plate': 'Gravityplate',
  'Equipment': 'Ausrüstung',
  'Vereinstreffen': 'Verein',
  'Versammlung': 'Verein',
  'Club': 'Verein',
  'Generalversammlung': 'GV',
  'Medienbericht': 'Medien',
  'Medienberichterstattung': 'Medien',
  'Cruise': 'Cruising',
  'Webseite': 'Website',
};

const LABEL_DELETE = new Set([
  'Luzern',
  'Update', 'Advanced', 'Ankuendigung',
  'SSC Event', 'SSC Movie', 'SSC Frühlings GV 08', 'SSC Herbst GV 07',
  'FireStarter 06', 'FireStarter 07', 'FireStarter 08', 'FireStarter 10',
  'Gioasteka 07',
  'NOTB 06',
  'Neue Bilder', 'Daumenkinobilder',
  '2006', 'Ankündigung', 'Anmeldung', 'Asphalt', 'Augusto',
  'Bearbeitung', 'Behörden', 'Dokument', 'Ehrung', 'Energie',
  'Entwicklung', 'Erlebnis', 'Etablierung', 'Familie', 'Family',
  'Feier', 'Feuer', 'Flow', 'Frau', 'Geschichten', 'Governance',
  'Handwerk', 'Herausforderung', 'Herbst', 'Infrastruktur', 'Jahreskreis',
  'Kontrovers', 'Kooperation', 'Kreativ', 'Künstler', 'Kurven',
  'Leadership', 'Legacy', 'Magaz', 'Material', 'Media', 'Meilenstein',
  'Mentoring', 'Natur', 'Portrait', 'Porträt', 'Präsentation', 'Projekt',
  'Regelmäßig', 'Sonntag', 'Sozial', 'Spiel', 'Spiele', 'Stimmung',
  'Strasse', 'Straße', 'Sunset', 'Tempo', 'Ticket', 'Tipp',
  'Visual', 'Wachstum', 'Wahrnehmung', 'Werbung', 'Wetter', 'Zusammenhalt',
  // Pseudo-tags from old Blogger setup
  'main', 'Main', 'archiv', 'Archiv',
]);

function cleanLabels(labels) {
  if (!labels) return [];
  return [...new Set(
    labels
      .map(l => LABEL_RENAME[l] ?? l)
      .filter(l => !LABEL_DELETE.has(l))
  )];
}

// ---- Helpers --------------------------------------------------------------------

function decodeBloggerContent(content) {
  if (!content) return '';
  try {
    return decodeURIComponent(content.replace(/\\u/g, '%'));
  } catch (e) {
    return content;
  }
}

function htmlToText(html) {
  const dom = new JSDOM(html);
  return dom.window.document.body.textContent ?? '';
}

function cleanTitle(str) {
  return str
    // Remove old pseudo-tags: **Main**, **Archiv** (with or without asterisks)
    .replace(/^\*\*?(Main|Archiv)\*\*?\s*/gi, '')
    .replace(/\*\*/g, ' ')   // **bold** -> space
    .replace(/[\*_~`]+/g, '')  // Remove remaining markdown formatting chars
    .replace(/^\s+|\s+$/g, '')
    .replace(/\s{2,}/g, ' ');
}

function truncateWords(text, maxWords) {
  return text.split(/\s+/).slice(0, maxWords).join(' ');
}

function generatePreview(html, maxLength = 150) {
  const text = htmlToText(html).replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated;
}

// Transliterate umlauts for slugs
const UMLAUT_MAP = {
  ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss',
  Ä: 'Ae', Ö: 'Oe', Ü: 'Ue',
  à: 'a', á: 'a', â: 'a', ã: 'a', å: 'a',
  è: 'e', é: 'e', ê: 'e', ë: 'e',
  ì: 'i', í: 'i', î: 'i', ï: 'i',
  ò: 'o', ó: 'o', ô: 'o', õ: 'o',
  ù: 'u', ú: 'u', û: 'u', ù: 'u',
  ñ: 'n', ç: 'c',
  ' ': '-',
};

function transliterate(str) {
  return str.replace(/[^a-zA-Z0-9\s-]/g, c => UMLAUT_MAP[c] || c);
}

function slugify(str) {
  return transliterate(str)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function makeUniqueSlug(slug, existing) {
  if (!existing.has(slug)) {
    existing.add(slug);
    return slug;
  }
  let i = 2;
  let candidate;
  while (existing.has(candidate = `${slug}-${i}`)) i++;
  existing.add(candidate);
  return candidate;
}

function hash8(str) {
  return createHash('sha256').update(str).digest('hex').slice(0, 8);
}

function getExt(url) {
  const m = url.match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/);
  return m ? m[1].toLowerCase() : 'jpg';
}

function getFilename(url) {
  const bn = basename(url).split('?')[0].split('#')[0];
  const ext = getExt(url);
  return ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'gif' || ext === 'webp' ? bn : `${bn}.${ext}`;
}

// ---- Image handling -------------------------------------------------------------

const imageCache = new Map(); // url -> local filename
const downloaded = new Set();
const allImageUrls = new Set(); // track all unique image URLs for reporting

async function ensureDir(dir) {
  try {
    await mkdir(dir, { recursive: true });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
}

async function downloadImage(url, targetDir) {
  if (imageCache.has(url)) return imageCache.get(url);
  if (downloaded.has(url)) return imageCache.get(url);

  try {
    const res = await fetch(url, { timeout: 30000 });
    if (!res.ok) {
      console.warn(`  ⚠️  Image fetch failed: ${url} (${res.status})`);
      return null;
    }
    const buf = await res.arrayBuffer();
    const ext = getExt(url);
    const h = hash8(url);
    const filename = `${h}.${ext}`;
    const filepath = join(targetDir, filename);
    await writeFile(filepath, Buffer.from(buf));
    downloaded.add(url);
    imageCache.set(url, filename);
    return filename;
  } catch (err) {
    console.warn(`  ⚠️  Image download error: ${url} (${err.message})`);
    return null;
  }
}

function localImagePath(filename) {
  return `${BASE_URL}/${filename}`;
}

// ---- HTML → Markdown -------------------------------------------------------------

let turndown;

async function initTurndown() {
  const td = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    fence: '```',
    emDelimiter: '*',
    strongDelimiter: '**',
    linkStyle: 'inlined',
    linkReferenceStyle: 'full',
  });
  // Load GFM plugin via require (CJS) - exports object with gfm function
  const gfmPlugin = require('turndown-plugin-gfm');
  td.use(gfmPlugin.gfm);

  // Remove empty paragraphs
  td.addRule('removeEmptyParagraphs', {
    filter: ['p'],
    replacement: (content, node) => {
      const text = node.textContent?.trim();
      if (!text || text === '\n') return '';
      return content;
    },
  });

  // Handle Blogger separator divs
  td.addRule('separatorDiv', {
    filter: node => node.nodeName === 'DIV' && node.classList?.contains('separator'),
    replacement: () => '---\n\n',
  });

  // Handle gallery markers
  td.addRule('galleryMarkers', {
    filter: node => node.nodeName === '#comment' && (node.textContent?.includes('gallery-start') || node.textContent?.includes('gallery-end')),
    replacement: () => '',
  });

  // Convert iframes to plain links
  td.addRule('iframes', {
    filter: ['iframe'],
    replacement: (content, node) => {
      const src = node.getAttribute('src');
      if (src) {
        const ytMatch = src.match(/(?:youtube\.com\/embed\/|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/watch\?v=)([^\/&?]+)/);
        const display = ytMatch ? `[YouTube Video](${src})` : `[Embed](${src})`;
        return display;
      }
      return '';
    },
  });

  // Handle <a><img></a> — keep just the image
  td.addRule('linkedImages', {
    filter: node => node.nodeName === 'A' && node.querySelector('img'),
    replacement: (content, node) => {
      const img = node.querySelector('img');
      if (!img) return content;
      const alt = img.getAttribute('alt') || '';
      const src = img.getAttribute('src') || '';
      return `![${alt}](${src})`;
    },
  });

  return td;
}

function htmlToMarkdown(html, imageMap) {
  // Replace image srcs with local paths using imageMap
  const dom = new JSDOM(html);
  const { document } = dom.window;

  // Replace img src with local if in imageMap
  const imgs = document.querySelectorAll('img');
  for (const img of imgs) {
    const src = img.getAttribute('src');
    if (src && imageMap[src]) {
      img.setAttribute('src', imageMap[src]);
    }
  }

  // Remove empty divs
  const emptyDivs = document.querySelectorAll('div:empty');
  for (const d of emptyDivs) d.remove();

  // Remove style/script/noscript
  const bad = document.querySelectorAll('style, script, noscript');
  for (const b of bad) b.remove();

  // Remove Blogger-specific wrapper divs
  const bloggerDivs = document.querySelectorAll('div[class*="blogger-"], div[class*="Blogger"], div[class*="post-body"]');
  for (const d of bloggerDivs) {
    while (d.firstChild) {
      d.parentNode.insertBefore(d.firstChild, d);
    }
    d.remove();
  }

  const bodyHtml = document.body.innerHTML;
  let md = turndown.turndown(bodyHtml);

  // Post-processing
  md = md
    .trim()
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n+$/, '\n');

  // Remove leading H1
  md = md.replace(/^#\s+.+\n\n/, '');

  return md;
}

// ---- Blogger API ----------------------------------------------------------------

async function fetchAllItems(apiKey, blogId, endpoint, fields = 'id,title,content,labels,published,url,images') {
  const items = [];
  let pageToken = null;
  let total = 0;

  do {
    const url = new URL(`${BLOGGER_API}/blogs/${blogId}/${endpoint}`);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('maxResults', String(MAX_RESULTS));
    url.searchParams.set('fields', `nextPageToken,items(${fields})`);
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetch(url.toString(), { timeout: 30000 });
    if (!res.ok) {
      throw new Error(`Blogger API ${endpoint} error: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    const newItems = data.items || [];
    items.push(...newItems);
    total += newItems.length;
    process.stdout.write(`\r  Fetched ${total} ${endpoint}…`);
    pageToken = data.nextPageToken ?? null;
  } while (pageToken);

  process.stdout.write('\n');
  return items;
}

// ---- Main -----------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');

  const apiKey = process.env.GOOGLE_BLOGGER_API_KEY;
  const blogId = process.env.GOOGLE_BLOGGER_ID;

  if (!apiKey || !blogId) {
    console.error('❌ Missing env vars: GOOGLE_BLOGGER_API_KEY, GOOGLE_BLOGGER_ID');
    console.error('   Run with: node --env-file=../streetsurfclub-analog/.env scripts/migrate-from-blogger.mjs');
    process.exit(1);
  }

  console.log(`\n🏄 StreetSurfClub — Migrate Blogger → AnalogJS + Sveltia CMS`);
  console.log(`   Mode: ${isDryRun ? '🔍 DRY-RUN (no files written)' : '✏️  WRITE'}\n`);

  // Initialize turndown
  turndown = await initTurndown();

  // Ensure output dirs
  await ensureDir(CONTENT_BLOG_DIR);
  await ensureDir(CONTENT_PAGES_DIR);
  await ensureDir(MEDIA_DIR);

  // Fetch all
  console.log('📥 Fetching from Blogger…');
  const posts = await fetchAllItems(apiKey, blogId, 'posts', 'id,title,content,labels,published,url,images');
  const pages = await fetchAllItems(apiKey, blogId, 'pages', 'id,title,content,published,url');

  console.log(`   ✅ ${posts.length} posts, ${pages.length} pages\n`);

  // Track slugs globally
  const allSlugs = new Set();

  // Process posts
  console.log('📝 Processing posts…');
  const postResults = [];
  const postImageMap = {}; // url -> local path

   for (const post of posts) {
     const title = post.title ? cleanTitle(htmlToText(post.title)) : `post-${post.id}`;
    const rawContent = decodeBloggerContent(post.content || '');

    // Extract first image for coverImage
    let firstImageUrl = null;
    const dom = new JSDOM(rawContent);
    const firstImg = dom.window.document.querySelector('img');
    if (firstImg) {
      firstImageUrl = firstImg.getAttribute('src');
    }
    if (!firstImageUrl && post.images && post.images.length > 0) {
      firstImageUrl = post.images[0].url;
    }

     // Collect all images
     const postImageUrls = new Set();
     if (firstImageUrl) postImageUrls.add(firstImageUrl);
     const imgs = dom.window.document.querySelectorAll('img');
     for (const img of imgs) {
       const src = img.getAttribute('src');
       if (src) postImageUrls.add(src);
     }
     // Also from <a href> in gallery patterns
     const links = dom.window.document.querySelectorAll('a[href]');
     for (const a of links) {
       const href = a.getAttribute('href');
       if (href && a.querySelector('img')) {
         postImageUrls.add(href);
       }
     }
     // Also from post.images
     if (post.images) {
       for (const img of post.images) {
         if (img.url) postImageUrls.add(img.url);
       }
     }
     // Track for reporting
     for (const url of postImageUrls) allImageUrls.add(url);

     // Download images
     for (const url of postImageUrls) {
       const localName = await downloadImage(url, MEDIA_DIR);
       if (localName) {
         postImageMap[url] = localImagePath(localName);
       }
     }

    // Generate slug
    let slug = slugify(title);
    slug = makeUniqueSlug(slug, allSlugs);

    // Clean labels for tags
    const tags = cleanLabels(post.labels || []);

    // Description from preview
    const description = generatePreview(rawContent, 150);

    // Published date
    const publishedAt = post.published ? new Date(post.published).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

    // Convert to markdown
    let markdown = htmlToMarkdown(rawContent, postImageMap);

     // Strip first image from body if it's the cover
     if (firstImageUrl && postImageMap[firstImageUrl]) {
       const coverPath = postImageMap[firstImageUrl];
       // Remove markdown image referencing coverPath: ![anything](coverPath)
       // Use a simple string-based approach: find and remove the line containing the cover image
       const lines = markdown.split('\n');
       const filtered = lines.filter(line => !line.includes(`](${coverPath})`));
       markdown = filtered.join('\n').replace(/\n{2,}/g, '\n\n').trim();
     }

    const frontmatter = {
      title,
      slug,
      description,
      coverImage: firstImageUrl ? postImageMap[firstImageUrl] : undefined,
      publishedAt,
      tags,
      draft: false,
    };

    postResults.push({ frontmatter, markdown, slug, title });
    console.log(`   ✓ ${title} → ${slug}`);
  }

  // Process pages
  console.log('\n📄 Processing pages…');
  const pageResults = [];
  const pageImageMap = {};

   for (const page of pages) {
     const title = page.title ? cleanTitle(htmlToText(page.title)) : `page-${page.id}`;
    const rawContent = decodeBloggerContent(page.content || '');

     // Collect images
     const pageImageUrls = new Set();
     const dom = new JSDOM(rawContent);
     const imgs = dom.window.document.querySelectorAll('img');
     for (const img of imgs) {
       const src = img.getAttribute('src');
       if (src) pageImageUrls.add(src);
     }
     const links = dom.window.document.querySelectorAll('a[href]');
     for (const a of links) {
       const href = a.getAttribute('href');
       if (href && a.querySelector('img')) {
         pageImageUrls.add(href);
       }
     }
     // Track for reporting
     for (const url of pageImageUrls) allImageUrls.add(url);

     // Download images
     for (const url of pageImageUrls) {
       const localName = await downloadImage(url, MEDIA_DIR);
       if (localName) {
         pageImageMap[url] = localImagePath(localName);
       }
     }

    // Generate slug
    let slug = slugify(title);
    slug = makeUniqueSlug(slug, allSlugs);

    // Description
    const description = generatePreview(rawContent, 150);

    // Convert to markdown
    const markdown = htmlToMarkdown(rawContent, pageImageMap);

    const frontmatter = {
      title,
      slug,
      ...(description ? { description } : {}),
    };

    pageResults.push({ frontmatter, markdown, slug, title });
    console.log(`   ✓ ${title} → ${slug}`);
  }

  // Dry-run report
  if (isDryRun) {
    console.log('\n📋 Dry-run report:');
    console.log(`   Posts: ${postResults.length}`);
    console.log(`   Pages: ${pageResults.length}`);
    console.log(`   Images downloaded: ${downloaded.size}`);
    console.log(`   Failed images: ${Array.from(allImageUrls).length - downloaded.size}`);
    console.log('\n✅ Dry-run complete. Run without --dry-run to write files.\n');
    return;
  }

   // Write files
   console.log('\n💾 Writing files…');

   // Helper: serialize frontmatter object to YAML string
   function serializeFrontmatter(fm) {
     const lines = [];
     for (const [key, value] of Object.entries(fm)) {
       if (value === undefined) continue;
       if (Array.isArray(value)) {
         if (value.length === 0) continue;
         lines.push(`${key}:`);
         for (const v of value) {
           const safe = typeof v === 'string' ? `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : String(v);
           lines.push(`  - ${safe}`);
         }
       } else if (typeof value === 'boolean') {
         lines.push(`${key}: ${value}`);
       } else if (typeof value === 'string') {
         const safe = value.includes(':') || value.includes('#') || value.includes('"') || value.includes('\n')
           ? `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
           : value;
         lines.push(`${key}: ${safe}`);
       } else {
         lines.push(`${key}: ${String(value)}`);
       }
     }
     return lines.join('\n');
   }

   for (const { frontmatter, markdown, slug } of postResults) {
     const fmStr = serializeFrontmatter(frontmatter);
     const content = `---\n${fmStr}\n---\n\n${markdown}\n`;
     const filepath = join(CONTENT_BLOG_DIR, `${slug}.md`);
     await writeFile(filepath, content, 'utf8');
     console.log(`   ✓ ${filepath}`);
   }

   for (const { frontmatter, markdown, slug } of pageResults) {
     const fmStr = serializeFrontmatter(frontmatter);
     const content = `---\n${fmStr}\n---\n\n${markdown}\n`;
     const filepath = join(CONTENT_PAGES_DIR, `${slug}.md`);
     await writeFile(filepath, content, 'utf8');
     console.log(`   ✓ ${filepath}`);
   }

  console.log(`\n✅ Done — ${postResults.length} posts, ${pageResults.length} pages written.\n`);
  console.log(`   Images: ${downloaded.size} downloaded to ${MEDIA_DIR}`);
  console.log('\nNext: npm run build && verify routes, then update public/llms.txt manually.\n');
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  console.error(err.stack);
  process.exit(1);
});

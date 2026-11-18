---
name: update-from-blogger
description: Update StreetSurfClub content from Google Blogger. Fetches all posts and pages, converts HTML to clean Markdown with alt text, downloads images to public/images/uploads, and writes date-prefixed markdown files compatible with AnalogJS + Sveltia CMS. Use when you need to sync content from Blogger or re-import after changes.
---

# Update from Blogger

## Quick Start

```bash
# One-time setup (if not done):
npm install turndown turndown-plugin-gfm jsdom --save-dev

# Run migration (uses env vars from analog project):
node --env-file=../streetsurfclub-analog/.env scripts/migrate-from-blogger.mjs
```

## What It Does

1. **Fetches** all posts + pages from Blogger API v3 (paginated, 50/page)
2. **Cleans HTML** → Markdown:
   - Strips Blogger-specific divs, scripts, styles
   - Converts `<a><img></a>` to plain markdown images
   - YouTube/iframes → plain links
   - Gallery markers → image lists
3. **Alt text**: Empty `alt` attributes get post/page title as fallback (fixes MD045)
4. **Images**: Downloads to `public/images/uploads/<hash8>.ext`, rewrites paths to `/streetsurfclub-gh/images/uploads/...`
5. **Writes** date-prefixed files:
   - Posts: `src/content/blog/YYYY-MM-DD-<slug>.md`
   - Pages: `src/content/pages/YYYY-MM-DD-<slug>.md`
6. **Frontmatter**: title, slug, description, coverImage (first image, stripped from body), publishedAt, tags (cleaned labels), draft: false

## Required Environment Variables

From `streetsurfclub-analog/.env`:
```bash
GOOGLE_BLOGGER_API_KEY=your-api-key
GOOGLE_BLOGGER_ID=your-blog-id
```

Pass via `--env-file=../streetsurfclub-analog/.env` when running the script.

## File Structure

```
streetsurfclub-gh/
├── src/content/
│   ├── blog/
│   │   ├── YYYY-MM-DD-<slug>.md    # 83 posts, sorted chronologically
│   │   └── hello-world.md          # seed file (keep as-is)
│   └── pages/
│       ├── YYYY-MM-DD-<slug>.md    # 8 pages
│       └── colophon.md             # seed file (keep as-is)
├── public/images/uploads/          # 168+ images, hashed filenames
│   ├── <hash8>.jpg
│   └── ...
└── scripts/migrate-from-blogger.mjs
```

## Label Cleanup Rules

Applied to Blogger labels → frontmatter `tags`:

### Renames (from label-posts.mjs legacy):
| From | To |
|---|---|
| FireStarter | Firestarter |
| Openroad | Open Road |
| WM | Weltmeisterschaft |
| Skater Of The Month / Skater des Monats | Skater of the Month |
| Gravity Plate | Gravityplate |
| Equipment | Ausrüstung |
| Vereinstreffen / Versammlung / Club | Verein |
| Generalversammlung | GV |
| Medienbericht / Medienberichterstattung | Medien |
| Cruise | Cruising |
| Webseite | Website |

### Deletions:
- Location noise: Luzern
- Generic: Update, Advanced, Ankuendigung
- SSC-prefixed: SSC Event, SSC Movie, etc.
- Year-specific: FireStarter 06/07/08/10, Gioasteka 07, NOTB 06
- Photo album: Neue Bilder, Daumenkinobilder
- Single-occurrence noise (200+ terms)
- Pseudo-tags: main, Main, archiv, Archiv

## Dry Run

```bash
node --env-file=../streetsurfclub-analog/.env scripts/migrate-from-blogger.mjs --dry-run
```

- Fetches and processes all content
- Downloads images (side effect — cached for real run)
- Prints proposed changes
- Does NOT write any .md files

## Full Migration

```bash
# Clean old files (keep seed files)
cd src/content/blog && rm -f $(ls | grep -v hello-world.md)
cd ../pages && rm -f $(ls | grep -v colophon.md)

# Run migration
node --env-file=../streetsurfclub-analog/.env scripts/migrate-from-blogger.mjs
```

## Post-Migration

1. **Verify**:
   ```bash
   # Check for empty alt text
   grep -rE '!\[\]\(' src/content/ | wc -l  # Should be 0
   
   # Check date-prefixed files
   ls src/content/blog/ | grep -cE '^[0-9]{4}-[0-9]{2}-[0-9]{2}-'
   ```

2. **Build**:
   ```bash
   npm run build
   ```

3. **Update llms.txt** (optional, for LLM indexing):
   ```bash
   # Run the llms.txt generator (one-time)
   node -e "
   const fs = require('fs');
   const path = require('path');
   function extractTitle(fp) {
     const c = fs.readFileSync(fp, 'utf8');
     const m = c.match(/^title:\s*\"?([^\"\n]+)/m);
     return m ? m[1] : path.basename(fp, '.md').replace(/-/g, ' ');
   }
   const blog = fs.readdirSync('src/content/blog').filter(f => f.endsWith('.md') && f !== 'hello-world.md').sort();
   const pages = fs.readdirSync('src/content/pages').filter(f => f.endsWith('.md') && f !== 'colophon.md').sort();
   const lines = ['# StreetSurfClub', '', '> Posts and pages...', '', '## Blog Posts', ''];
   blog.forEach(f => lines.push(\`- [\${extractTitle(\`src/content/blog/\${f}\`)}](https://streetsurfclub.github.io/streetsurfclub-gh/blog/\${f})\`));
   lines.push('', '## Pages', '');
   pages.forEach(f => lines.push(\`- [\${extractTitle(\`src/content/pages/\${f}\`)}](https://streetsurfclub.github.io/streetsurfclub-gh/page/\${f})\`));
   lines.push('', '## Seed', '', '- [Hello World](https://.../blog/hello-world.md)', '- [Colophon](https://.../page/colophon.md)');
   fs.writeFileSync('public/llms.txt', lines.join('\n'));
   "
   ```

## Troubleshooting

| Issue | Fix |
|---|---|
| `Missing env vars` | Ensure `--env-file=../streetsurfclub-analog/.env` points to correct file with `GOOGLE_BLOGGER_API_KEY` and `GOOGLE_BLOGGER_ID` |
| `403 Permission denied` | Blogger API key invalid or quota exceeded |
| Images re-downloaded | Expected on first run; subsequent runs reuse hash-based filenames |
| Build fails with Rollup error | Clear cache: `rm -rf dist node_modules/.vite node_modules/.cache && npm install` |

## Script Details

**Location**: `scripts/migrate-from-blogger.mjs`

**Dependencies** (dev):
```json
{
  "turndown": "^7.2.0",
  "turndown-plugin-gfm": "^1.0.2",
  "jsdom": "^25.0.1"
}
```

**Key Functions**:
- `fetchAllItems()`: Paginated Blogger API fetch
- `htmlToMarkdown(html, imageMap, title)`: HTML → clean Markdown with alt fallback
- `cleanTitle()`: Strip `**Main**`/`**Archiv**` pseudo-tags + markdown formatting
- `cleanLabels()`: Legacy label cleanup (rename + delete)
- `serializeFrontmatter()`: YAML-safe frontmatter serialization

## Routing Compatibility

The date-prefixed filenames do NOT affect routes because:
- `vite.config.ts` uses frontmatter `slug` for route generation
- `injectContentFiles` matches on `attributes.slug`
- `outputSourceFile` emits `/blog/<slug>.md` (slug from frontmatter)

So `/blog/gv-2026-lange-diskutiert-und-viel-erreicht` still works even though the file is `2026-11-14-gv-2026-lange-diskutiert-und-viel-erreicht.md`.

## Sveltia CMS Compatibility

The generated files match `public/admin/config.yml`:
- `media_folder: public/images/uploads`
- `public_folder: /streetsurfclub-gh/images/uploads`
- Collections: `blog` (folder: `src/content/blog`), `pages` (folder: `src/content/pages`)

Sveltia can edit the markdown files directly; images are already in the correct location.

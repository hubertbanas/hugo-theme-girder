// Checks the demo site's build (exampleSite/public/) before it's published:
// - every page in exampleSite/content/ was built, plus the 404 page,
//   robots.txt (pointing at the sitemap) and the sitemap,
// - the absolute addresses (canonical links, the sitemap) are on SITE_URL,
//   and nothing links to localhost,
// - every same-site link, script, stylesheet and image points at a file that
//   exists, and stays under SITE_URL's path: a link that drops the sub-path
//   of a GitHub Pages project site (/hugo-theme-girder/) fails here,
// - pages load nothing from other hosts, and have no inline scripts, <style>
//   elements or event handlers,
// - no file is over GitHub Pages' 100 MiB limit for one file.
// Run after a build with the same baseURL:
//   SITE_URL=https://example.org/hugo-theme-girder/ npm run check:build
import { access, readFile, readdir, stat } from 'node:fs/promises';

const SITE = process.env.SITE_URL;
if (!SITE || !/^https:\/\/[^/]+\/([^?#]*\/)?$/.test(SITE)) {
  console.error('Set SITE_URL to the baseURL of the build, e.g. https://example.org/girder/');
  process.exit(1);
}
const BASE_PATH = new URL(SITE).pathname; // "/" or "/hugo-theme-girder/"

const root = new URL('../exampleSite/public/', import.meta.url);
const content = new URL('../exampleSite/content/', import.meta.url);
const problems = [];
const read = (file) => readFile(new URL(file, root), 'utf8');
const exists = (file) =>
  access(new URL(file, root)).then(
    () => true,
    () => false,
  );
const MAX_FILE_BYTES = 100 * 1024 * 1024;

// content/about/history.md -> about/history/index.html; _index.md and a
// bundle's index.md -> <dir>/index.html.
const pages = (await readdir(content, { recursive: true }))
  .map((f) => f.split('\\').join('/'))
  .filter((f) => f.endsWith('.md'))
  .map((f) => f.replace(/(^|\/)(_?index)\.md$/, '$1').replace(/\.md$/, '/') + 'index.html');
const required = [...pages, '404.html', 'robots.txt', 'sitemap.xml'];
for (const file of required) {
  if (!(await exists(file))) problems.push(`${file}: missing`);
}
const robots = await read('robots.txt').catch(() => '');
if (!robots.split('\n').includes(`Sitemap: ${SITE}sitemap.xml`)) {
  problems.push(`robots.txt: no "Sitemap: ${SITE}sitemap.xml" line`);
}

// A same-site path as a file in public/: /hugo-theme-girder/contact/ ->
// contact/index.html. Paths outside BASE_PATH don't exist on the site.
async function resolves(ref) {
  const pathname = decodeURI(ref.split(/[?#]/)[0]);
  if (!pathname.startsWith(BASE_PATH)) return false;
  const path = pathname.slice(BASE_PATH.length);
  if (path === '' || path.endsWith('/')) return exists(`${path}index.html`);
  return (await exists(path)) || exists(`${path}/index.html`);
}

const files = (await readdir(root, { recursive: true })).map((f) => f.split('\\').join('/'));
let references = 0;

for (const file of files.filter((f) => /\.(html|xml|txt)$/.test(f))) {
  if (/\/\/(localhost|127\.0\.0\.1)[:/]/.test(await read(file))) {
    problems.push(`${file}: links to localhost`);
  }
}

for (const [, loc] of (await read('sitemap.xml').catch(() => '')).matchAll(
  /<loc>([^<]+)<\/loc>/g,
)) {
  references++;
  if (!loc.startsWith(SITE)) problems.push(`sitemap.xml: ${loc} isn't on ${SITE}`);
  else if (!(await resolves(new URL(loc).pathname))) {
    problems.push(`sitemap.xml: ${loc} doesn't exist in public/`);
  }
}

for (const file of files.filter((f) => f.endsWith('.html'))) {
  const html = await read(file);
  const canonical = /<link rel=canonical href=([^\s>]+)|<link rel="canonical" href="([^"]+)"/.exec(
    html,
  );
  if (file !== '404.html') {
    const href = canonical?.[1] ?? canonical?.[2];
    const want = SITE + file.replace(/index\.html$/, '');
    if (href !== want) problems.push(`${file}: canonical ${href}, expected ${want}`);
  }

  for (const [element, tag] of html.matchAll(/<(a|script|link|img|source|iframe)\b[^>]*>/g)) {
    for (const [, attr, quoted, bare] of element.matchAll(
      /\s(src|href|srcset)=(?:"([^"]*)"|([^\s>]*))/g,
    )) {
      const values = attr === 'srcset' ? (quoted ?? bare).split(',') : [quoted ?? bare];
      for (const value of values.map((v) => v.trim().split(/\s+/)[0])) {
        const isLink = tag === 'a' || /\srel="?(canonical|alternate)/.test(element);
        if (value.startsWith(SITE)) continue;
        if (/^(https?:|mailto:|tel:|#)/.test(value)) {
          if (!isLink)
            problems.push(`${file}: <${tag} ${attr}="${value}"> loads from another host`);
          continue;
        }
        references++;
        if (!value.startsWith('/') || value.startsWith('//')) {
          problems.push(`${file}: <${tag} ${attr}="${value}"> is not a path from the site's root`);
        } else if (!(await resolves(value))) {
          problems.push(`${file}: <${tag} ${attr}="${value}"> doesn't exist under ${BASE_PATH}`);
        }
      }
    }
  }
  if (/<style\b/.test(html)) problems.push(`${file}: an inline <style>`);
  if (/<script(?![^>]*\ssrc=)[^>]*>/.test(html)) problems.push(`${file}: an inline <script>`);
  if (/\son[a-z]+=/.test(html)) problems.push(`${file}: an inline event handler (onclick=…)`);
}

// Stylesheets' url()s: the theme's own and the vendored ones (which refer to
// their own files with relative paths).
for (const file of files.filter((f) => f.endsWith('.css'))) {
  for (const [, ref] of (await read(file)).matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
    if (ref.startsWith('data:') || ref.startsWith('#')) continue;
    references++;
    const dir = file.slice(0, file.lastIndexOf('/') + 1);
    const path = ref.startsWith('/') ? ref : `${BASE_PATH}${dir}${ref}`;
    if (/^https?:|^\/\//.test(ref)) {
      problems.push(`${file}: url(${ref}) loads from another host`);
    } else if (!(await resolves(new URL(path, 'https://x').pathname))) {
      problems.push(`${file}: url(${ref}) doesn't exist under ${BASE_PATH}`);
    }
  }
}

for (const file of files) {
  const info = await stat(new URL(file, root));
  if (info.isFile() && info.size > MAX_FILE_BYTES) {
    problems.push(`${file}: ${(info.size / 2 ** 20).toFixed(1)} MiB, over 100 MiB`);
  }
}

if (problems.length) {
  console.error(problems.map((p) => `FAIL ${p}`).join('\n'));
  process.exit(1);
}
console.log(
  `exampleSite/public/ looks right for ${SITE}: ${required.length} required files, ` +
    `${references} same-site references`,
);

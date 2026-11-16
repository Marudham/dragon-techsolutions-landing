#!/usr/bin/env node
/**
 * Static checks for the landing page (no dependencies). Run: npm run check:site
 * Fails (exit 1) on broken anchors/assets/icons, CSP-breaking inline code,
 * missing alt text, leftover placeholder contacts, or secrets in tracked files.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const fail = (m) => problems.push(m);
const read = (f) => readFileSync(path.join(ROOT, f), 'utf8');

for (const page of ['index.html', '404.html']) {
  const html = read(page);

  // 1. Local references exist
  for (const m of html.matchAll(/(?:src|href)="([^"#?]+)(?:[?#][^"]*)?"/g)) {
    const ref = m[1];
    if (/^(https?:|mailto:|tel:|data:)/.test(ref)) continue;
    const file = ref.startsWith('/') ? ref.slice(1) : ref;
    if (!file || file === '/') continue;
    if (!existsSync(path.join(ROOT, file))) fail(`${page}: missing file "${ref}"`);
  }

  // 2. CSP-safe: no inline style attributes, no inline scripts (JSON-LD data blocks are fine)
  if (/\sstyle="/.test(html)) fail(`${page}: inline style="" attribute (blocked by CSP)`);
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)) if (!/type="application\/ld\+json"/.test(m[1])) fail(`${page}: inline <script> (blocked by CSP)`);
  if (/\son[a-z]+="/.test(html)) fail(`${page}: inline event handler attribute`);

  // 3. Images need alt (empty alt allowed for decorative)
  for (const m of html.matchAll(/<img\b[^>]*>/g)) if (!/\balt="/.test(m[0])) fail(`${page}: <img> without alt: ${m[0].slice(0, 80)}`);
}

const index = read('index.html');

// 4. In-page anchors resolve
const ids = new Set([...index.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
for (const m of index.matchAll(/href="#([^"]+)"/g)) if (!ids.has(m[1])) fail(`index.html: anchor #${m[1]} has no matching id`);

// 5. SVG sprite symbols exist
const symbols = new Set([...index.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]));
for (const m of index.matchAll(/<use href="#([^"]+)"/g)) if (!symbols.has(m[1])) fail(`index.html: <use href="#${m[1]}"> has no <symbol>`);

// 6. Exactly one h1, one form, labels for fields
if ((index.match(/<h1[\s>]/g) || []).length !== 1) fail('index.html: expected exactly one <h1>');
if ((index.match(/<form[\s>]/g) || []).length !== 1) fail('index.html: expected exactly one <form>');
for (const m of index.matchAll(/<(?:input|select|textarea)\b[^>]*\bid="([^"]+)"[^>]*>/g)) if (!new RegExp(`for="${m[1]}"`).test(index)) fail(`index.html: field #${m[1]} has no <label for>`);

// 7. Facts that must never regress (see docs/CONTENT-REVIEW.md)
for (const bad of ['555-DRAG', '+1 (800)', 'enterprise@dragontechsolutions.com', 'lorem ipsum', '99.98', '500+ ', 'John Smith']) if (index.toLowerCase().includes(bad.toLowerCase())) fail(`index.html: forbidden/invented content "${bad}"`);
for (const must of ['044 46054287', '97510 74995', 'enquiry@dragontechsolutions.com']) if (!index.includes(must)) fail(`index.html: missing contact detail "${must}"`);
if (/<select\b|name="service"/.test(index)) fail('index.html: the enquiry form must not have a service selector (change request 2)');
if (index.includes('contact@blueark.co.in')) fail('index.html: the private delivery address must stay server-side (worker/wrangler.toml), not in the page');

// 8. No secrets in the repo (excluding node_modules/.git)
const SECRET = /(re_[A-Za-z0-9]{20,}|sk_(live|test)_[A-Za-z0-9]{10,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|0x4[A-Za-z0-9_-]{20,}|api[_-]?key\s*[:=]\s*['"][A-Za-z0-9_\-]{16,})/;
const walk = (dir) => readdirSync(dir).flatMap((n) => {
  if (['node_modules', '.git', '_site', '.wrangler'].includes(n)) return [];
  const p = path.join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p];
});
for (const f of walk(ROOT)) {
  if (!/\.(js|mjs|json|html|css|toml|md|yml|yaml|txt|xml)$/.test(f)) continue;
  const text = readFileSync(f, 'utf8');
  if (SECRET.test(text)) fail(`possible secret in ${path.relative(ROOT, f)}`);
}
const cfg = read('assets/js/config.js');
if (/formEndpoint:\s*'[^']+'/.test(cfg) || /turnstileSiteKey:\s*'[^']+'/.test(cfg)) fail('assets/js/config.js should stay empty in git; production values are injected by the deploy workflow');

if (problems.length) { console.error('Site checks FAILED:\n - ' + problems.join('\n - ')); process.exit(1); }
console.log(`Site checks passed (${ids.size} ids, ${symbols.size} icons, ${walk(ROOT).length} files scanned).`);

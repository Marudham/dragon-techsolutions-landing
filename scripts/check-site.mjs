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

// Pages: landing (/), full website (/website/), form page (/book-a-call/) and the 404.
const PAGES = ['index.html', 'website/index.html', 'book-a-call/index.html', '404.html'];
const FORM_PAGES = ['website/index.html', 'book-a-call/index.html'];
const LANDING_PAGES = ['index.html', 'book-a-call/index.html'];
const all = {};

for (const page of PAGES) {
  const html = (all[page] = read(page));
  const dir = path.dirname(page);

  // 1. Local references exist (resolved relative to the page, or from the site root when they start with "/")
  for (const m of html.matchAll(/(?:src|href)="([^"#?]+)(?:[?#][^"]*)?"/g)) {
    const ref = m[1];
    if (/^(https?:|mailto:|tel:|data:)/.test(ref)) continue;
    const target = ref.startsWith('/') ? ref.slice(1) : path.join(dir, ref);
    if (!target || target === '.' || target === '/') continue;
    const full = path.join(ROOT, target);
    const ok = existsSync(full) && (statSync(full).isFile() || existsSync(path.join(full, 'index.html')));
    if (!ok) fail(`${page}: missing file "${ref}"`);
  }

  // 2. CSP-safe: no inline style attributes, no inline scripts (JSON-LD data blocks are fine)
  if (/\sstyle="/.test(html)) fail(`${page}: inline style="" attribute (blocked by CSP)`);
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)) if (!/type="application\/ld\+json"/.test(m[1])) fail(`${page}: inline <script> (blocked by CSP)`);
  if (/\son[a-z]+="/.test(html)) fail(`${page}: inline event handler attribute`);

  // 3. Images need alt (empty alt allowed for decorative)
  for (const m of html.matchAll(/<img\b[^>]*>/g)) if (!/\balt="/.test(m[0])) fail(`${page}: <img> without alt: ${m[0].slice(0, 80)}`);

  // 4. In-page anchors resolve; SVG sprite symbols exist
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  for (const m of html.matchAll(/href="#([^"]+)"/g)) if (!ids.has(m[1])) fail(`${page}: anchor #${m[1]} has no matching id`);
  const symbols = new Set([...html.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]));
  for (const m of html.matchAll(/<use href="#([^"]+)"/g)) if (!symbols.has(m[1])) fail(`${page}: <use href="#${m[1]}"> has no <symbol>`);

  // 5. Heading, form and label rules (404 is exempt from the h1/form rules)
  if (page !== '404.html') {
    if ((html.match(/<h1[\s>]/g) || []).length !== 1) fail(`${page}: expected exactly one <h1>`);
    const forms = (html.match(/<form[\s>]/g) || []).length;
    if (FORM_PAGES.includes(page) ? forms !== 1 : forms !== 0) fail(`${page}: expected ${FORM_PAGES.includes(page) ? 'exactly one' : 'no'} <form>, found ${forms}`);
    for (const m of html.matchAll(/<(?:input|select|textarea)\b[^>]*\bid="([^"]+)"[^>]*>/g)) if (!new RegExp(`for="${m[1]}"`).test(html)) fail(`${page}: field #${m[1]} has no <label for>`);
    // 6. No service selector anywhere (change request 2) and the private delivery address stays server-side
    if (/name="service"|id="f-service"/.test(html)) fail(`${page}: the enquiry form must not have a service selector (change request 2)`);
    if (html.includes('contact@blueark.co.in')) fail(`${page}: the private delivery address must stay server-side (worker/wrangler.toml), not in the page`);
    // 7. Facts that must never regress (see docs/CONTENT-REVIEW.md)
    for (const bad of ['555-DRAG', '+1 (800)', 'enterprise@dragontechsolutions.com', 'lorem ipsum', '99.98', '500+ ', 'John Smith']) if (html.toLowerCase().includes(bad.toLowerCase())) fail(`${page}: forbidden/invented content "${bad}"`);
    // Landing + form pages must NOT show Dragon's own contact details (team request, 16 Nov); the full website must.
    const COMPANY = ['044 46054287', '97510 74995', 'enquiry@dragontechsolutions.com', '+914446054287', '+919751074995'];
    for (const c of COMPANY) {
      const present = html.includes(c);
      if (LANDING_PAGES.includes(page) && present) fail(`${page}: company contact detail "${c}" must not appear on landing pages`);
    }
    if (page === 'website/index.html') for (const c of COMPANY.slice(0, 3)) if (!html.includes(c)) fail(`${page}: missing contact detail "${c}"`);
    // WhatsApp is the one contact option, and it must be the BlueArk number.
    if (!html.includes('https://wa.me/919626795150')) fail(`${page}: WhatsApp link must point to 919626795150`);
    if (html.includes('919342252587')) fail(`${page}: old WhatsApp number 919342252587 must not be used`);
    // Footer credit links to BlueArk.
    if (!/Designed &amp; developed by <a href="https:\/\/blueark\.co\.in\/"[^>]*>Blueark<\/a>/.test(html)) fail(`${page}: "Blueark" in the footer credit must link to https://blueark.co.in/`);
    // Forms carry the agreed field set.
    if (FORM_PAGES.includes(page)) for (const f of ['firstName', 'lastName', 'email', 'phone', 'jobRole', 'jobTitle', 'designation', 'company', 'country', 'message', 'consent']) if (!new RegExp(`name="${f}"`).test(html)) fail(`${page}: form field "${f}" is missing`);
  }
}
const js = read('assets/js/main.js');
for (const c of ['enquiry@dragontechsolutions.com', '044 46054287', '97510 74995']) if (js.includes(c)) fail(`assets/js/main.js: contains company contact detail "${c}" (it is served on the landing pages)`);
// The two CTAs on the landing page must lead to the other two pages.
if (!/href="book-a-call\/"/.test(all['index.html'])) fail('index.html: "Book a Strategy Call" must link to book-a-call/');
if (!/href="website\/"/.test(all['index.html'])) fail('index.html: "Explore the website" must link to website/');
const ids = new Set(), symbols = new Set(); // for the summary line only

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
console.log(`Site checks passed (${PAGES.length} pages, ${walk(ROOT).length} files scanned).`);

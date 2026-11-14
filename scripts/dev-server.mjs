#!/usr/bin/env node
/**
 * Local review server (no dependencies).
 *
 *   node scripts/dev-server.mjs            -> http://localhost:8080
 *   PORT=9000 node scripts/dev-server.mjs
 *
 * Serves the static site AND runs the real Worker code at /api/enquiry, so the
 * complete form flow can be exercised locally:
 *   - Turnstile uses Cloudflare's official always-pass TEST keys.
 *   - Mail is not sent anywhere: the Worker "sends" to a local in-memory sink.
 *     Open /__mailsink to see what would have been delivered to MAIL_TO.
 *   - /assets/js/config.js is replaced on the fly with local settings; the file
 *     on disk (used in production) is never modified.
 *
 * This file is for local development only and is not deployed.
 */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { handleRequest } from '../worker/src/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8080);
const HOST = '127.0.0.1';
const TEST_SITEKEY = process.env.TS_SITEKEY || '1x00000000000000000000AA'; // always passes
const TEST_SECRET = process.env.TS_SECRET || '1x0000000000000000000000000000000AA';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
};

const sink = [];
const workerEnv = {
  ALLOWED_ORIGINS: `http://localhost:${PORT},http://127.0.0.1:${PORT}`,
  MAIL_TO: 'contact@blueark.co.in',
  MAIL_FROM: 'Dragon TechSolutions Website <no-reply@example.test>',
  MAIL_PROVIDER: 'webhook',
  MAIL_WEBHOOK_URL: `http://${HOST}:${PORT}/__mailsink`,
  MAIL_WEBHOOK_TOKEN: 'local-dev-only',
  TURNSTILE_SECRET: TEST_SECRET,
  DAILY_CAP: '200',
};

const DEV_CONFIG = `document.documentElement.classList.add('js');
window.DRAGON_CONFIG = { formEndpoint: '/api/enquiry', turnstileSiteKey: '${TEST_SITEKEY}' };
`;

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === '/__mailsink') {
      if (req.method === 'POST') {
        if (req.headers.authorization !== `Bearer ${workerEnv.MAIL_WEBHOOK_TOKEN}`) { res.writeHead(401).end(); return; }
        sink.push({ at: new Date().toISOString(), ...JSON.parse((await readBody(req)).toString()) });
        res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(sink, null, 2));
      return;
    }

    if (url.pathname.startsWith('/api/')) {
      const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await readBody(req);
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
      headers.set('CF-Connecting-IP', req.socket.remoteAddress || '');
      const response = await handleRequest(new Request(url, { method: req.method, headers, body }), workerEnv);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }

    if (url.pathname === '/assets/js/config.js' && process.env.DEV_CONFIG !== '0') {
      res.writeHead(200, { 'Content-Type': MIME['.js'], 'Cache-Control': 'no-store' }).end(DEV_CONFIG);
      return;
    }

    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.normalize(path.join(ROOT, rel));
    const allowedTop = ['/index.html', '/assets/', '/robots.txt', '/sitemap.xml', '/404.html'];
    const relPosix = '/' + path.relative(ROOT, file).split(path.sep).join('/');
    if (!file.startsWith(ROOT + path.sep) || !allowedTop.some((p) => relPosix === p || relPosix.startsWith(p))) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    const st = await stat(file).catch(() => null);
    if (!st || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(await readFile(file));
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'text/plain' }).end('Server error');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\n  Dragon TechSolutions – local review\n  Site:      http://localhost:${PORT}\n  Mail sink: http://localhost:${PORT}/__mailsink  (what would be e-mailed)\n`);
});

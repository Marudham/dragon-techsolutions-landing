/**
 * Dragon TechSolutions – enquiry endpoint (Cloudflare Worker).
 *
 * The static site (GitHub Pages) cannot hold secrets, so the browser posts the
 * enquiry here. This Worker validates it, checks Cloudflare Turnstile, applies
 * rate limits and only then sends the e-mail. All credentials live in Worker
 * secrets – never in the repository or the web page.
 *
 *   POST /api/enquiry   JSON body -> { ok: true } | { ok:false, errors, message }
 *
 * Config (see wrangler.toml and docs/DEPLOYMENT.md):
 *   vars:    ALLOWED_ORIGINS, MAIL_TO, MAIL_FROM, MAIL_CC?, MAIL_PROVIDER, DAILY_CAP?,
 *            TURNSTILE_HOSTNAMES?, ENQUIRY_TOPIC? (default "Email Solutions")
 *   secrets: TURNSTILE_SECRET, RESEND_API_KEY | MAIL_WEBHOOK_TOKEN
 *   bindings (optional): RATE_LIMITER (Rate Limiting), RATE_KV (KV namespace)
 */

const MAX_BODY_BYTES = 10 * 1024;
// Which page the enquiry came from. The browser only sends a short key; the Worker maps it to the
// label shown in the e-mail (allow-list, so arbitrary text can never reach the subject line).
//   campaign / book -> the e-mail-solutions landing flow ("Email Solutions", override with ENQUIRY_TOPIC)
//   website         -> the full Dragon TechSolutions website
const DEFAULT_TOPIC = 'Email Solutions';
const WEBSITE_TOPIC = 'Website enquiry';
const SOURCES = ['campaign', 'book', 'website'];

/* ------------------------------------------------------------------ helpers */

const list = (v) => (v || '').split(',').map((s) => s.trim()).filter(Boolean);
// Remove control characters (incl. CR/LF, which enable e-mail header injection).
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
const oneLine = (v, max) => clean(v, max).replace(/[\r\n\u2028\u2029]+/g, ' ');
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(origin ? corsHeaders(origin) : { Vary: 'Origin' }),
    },
  });
}

/* --------------------------------------------------------------- validation */

export function validate(input) {
  const errors = {};
  const v = {
    firstName: oneLine(input.firstName, 60),
    lastName: oneLine(input.lastName, 60),
    email: oneLine(input.email, 150),
    phone: oneLine(input.phone, 20),
    jobRole: oneLine(input.jobRole, 80),
    jobTitle: oneLine(input.jobTitle, 80),
    designation: oneLine(input.designation, 100),
    company: oneLine(input.company, 120),
    country: oneLine(input.country, 60),
    message: clean(input.message, 2000),
    source: SOURCES.includes(oneLine(input.source, 20)) ? oneLine(input.source, 20) : 'book',
  };
  v.name = `${v.firstName} ${v.lastName}`.trim();
  if (v.firstName.length < 1) errors.firstName = 'Please enter your first name.';
  if (v.lastName.length < 1) errors.lastName = 'Please enter your last name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) errors.email = 'Please enter a valid email address.';
  const digits = v.phone.replace(/\D/g, '');
  // Phone is optional; when given it must look like a phone number.
  if (v.phone && (!/^[+\d][\d\s\-()]*$/.test(v.phone) || digits.length < 7 || digits.length > 15)) errors.phone = 'Please enter a valid phone number.';
  if (v.jobRole.length < 2) errors.jobRole = 'Please enter your job role.';
  if (v.jobTitle.length < 2) errors.jobTitle = 'Please enter your job title.';
  if (v.company.length < 2) errors.company = 'Please enter your company name.';
  if (v.country.length < 2) errors.country = 'Please choose your country.';
  if (v.message.length < 10) errors.message = 'Please add a few more details (at least 10 characters).';
  if (input.consent !== true) errors.consent = 'Please tick the box to continue.';
  return { values: v, errors };
}

/* ---------------------------------------------------------------- turnstile */

async function verifyTurnstile(token, ip, env) {
  if (!env.TURNSTILE_SECRET) return env.ALLOW_INSECURE_DEV === '1' ? { ok: true } : { ok: false, misconfigured: true };
  if (!token || typeof token !== 'string' || token.length > 2048) return { ok: false };
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token });
  if (ip) body.set('remoteip', ip);
  try {
    const res = await fetch(env.TURNSTILE_VERIFY_URL || 'https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const data = await res.json();
    if (!data.success) return { ok: false };
    const hosts = list(env.TURNSTILE_HOSTNAMES);
    if (hosts.length && !hosts.includes(data.hostname)) return { ok: false };
    return { ok: true };
  } catch {
    return { ok: false, upstream: true };
  }
}

/* --------------------------------------------------------------- rate limit */

async function rateLimited(env, ip) {
  const key = ip || 'unknown';
  if (env.RATE_LIMITER && typeof env.RATE_LIMITER.limit === 'function') {
    const { success } = await env.RATE_LIMITER.limit({ key });
    if (!success) return true;
  }
  if (env.RATE_KV) {
    const hour = Math.floor(Date.now() / 3.6e6);
    const day = Math.floor(Date.now() / 8.64e7);
    const perIpKey = `ip:${key}:${hour}`;
    const dayKey = `day:${day}`;
    const [ipCount, dayCount] = await Promise.all([env.RATE_KV.get(perIpKey), env.RATE_KV.get(dayKey)]);
    if (Number(ipCount || 0) >= Number(env.PER_IP_HOURLY || 5)) return true;
    if (Number(dayCount || 0) >= Number(env.DAILY_CAP || 200)) return true;
    await Promise.all([
      env.RATE_KV.put(perIpKey, String(Number(ipCount || 0) + 1), { expirationTtl: 7200 }),
      env.RATE_KV.put(dayKey, String(Number(dayCount || 0) + 1), { expirationTtl: 90000 }),
    ]);
  }
  return false;
}

/* --------------------------------------------------------------------- mail */

export function buildMessage(v, meta, env) {
  const topic = v.source === 'website' ? WEBSITE_TOPIC : oneLine(env.ENQUIRY_TOPIC || DEFAULT_TOPIC, 60);
  const subject = oneLine(`New enquiry: ${topic} – ${v.name}`, 200);
  const rows = [
    ['Name', v.name],
    ['Email', v.email],
    ['Phone', v.phone || '—'],
    ['Job role', v.jobRole],
    ['Job title', v.jobTitle],
    ['Designation', v.designation || '—'],
    ['Company', v.company],
    ['Country', v.country],
    ['Topic', topic],
  ];
  const text =
    `New enquiry from the Dragon TechSolutions website\n\n` +
    rows.map(([k, val]) => `${k}: ${val}`).join('\n') +
    `\n\nMessage:\n${v.message}\n\n--\nReceived: ${meta.receivedAt}\nSent from: ${meta.origin}\nReply to this email to respond to the sender.`;
  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#0b2545;max-width:620px">` +
    `<h2 style="margin:0 0 12px;color:#0b2545">New website enquiry</h2>` +
    `<table style="border-collapse:collapse;width:100%">` +
    rows.map(([k, val]) => `<tr><td style="padding:6px 12px 6px 0;color:#4a5d7a;white-space:nowrap;vertical-align:top">${escapeHtml(k)}</td><td style="padding:6px 0"><strong>${escapeHtml(val)}</strong></td></tr>`).join('') +
    `</table>` +
    `<p style="margin:16px 0 4px;color:#4a5d7a">Message</p>` +
    `<div style="white-space:pre-wrap;border-left:3px solid #1d6fe8;padding:8px 14px;background:#f5f8fc">${escapeHtml(v.message)}</div>` +
    `<p style="margin-top:18px;font-size:12px;color:#7f8fae">Received ${escapeHtml(meta.receivedAt)} · Sent from ${escapeHtml(meta.origin)}<br>Reply to this email to respond to the sender.</p></div>`;
  return {
    from: env.MAIL_FROM,
    to: list(env.MAIL_TO),
    cc: list(env.MAIL_CC),
    reply_to: v.email,
    subject,
    text,
    html,
  };
}

async function sendMail(message, env) {
  const provider = env.MAIL_PROVIDER || 'resend';
  if (!/^(?:[^<>]+<)?[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>?$/.test(String(message.from || '')) || /<[^>]*$/.test(String(message.from || ''))) throw new Error('MAIL_FROM is malformed (check the closing > in wrangler.toml)');
  if (provider === 'resend') {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...message, cc: message.cc.length ? message.cc : undefined }),
    });
    if (!res.ok) {
      // Resend's error body names the problem (e.g. unverified domain, bad from address); it holds no visitor data.
      let detail = '';
      try { detail = (await res.text()).slice(0, 300); } catch { /* ignore */ }
      throw new Error(`resend ${res.status} ${detail}`);
    }
    return;
  }
  if (provider === 'webhook') {
    // Generic JSON-over-HTTPS mail relay (e.g. a self-hosted mail API).
    const res = await fetch(env.MAIL_WEBHOOK_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.MAIL_WEBHOOK_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    if (!res.ok) throw new Error(`webhook ${res.status}`);
    return;
  }
  throw new Error('unknown mail provider');
}

/* ------------------------------------------------------------------ handler */

export async function handleRequest(request, env) {
  const url = new URL(request.url);
  const allowed = list(env.ALLOWED_ORIGINS);
  const origin = request.headers.get('Origin') || '';
  const originOk = allowed.includes(origin);

  if (url.pathname !== '/api/enquiry') return json({ ok: false, message: 'Not found' }, 404, null);

  if (request.method === 'OPTIONS') {
    return originOk ? new Response(null, { status: 204, headers: corsHeaders(origin) }) : new Response(null, { status: 403 });
  }
  if (request.method !== 'POST') return json({ ok: false, message: 'Method not allowed' }, 405, originOk ? origin : null);
  if (!originOk) return json({ ok: false, message: 'Forbidden' }, 403, null);

  const reply = (body, status) => json(body, status, origin);

  if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) {
    return reply({ ok: false, message: 'Unsupported content type' }, 415);
  }
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (declared > MAX_BODY_BYTES) return reply({ ok: false, message: 'Request too large' }, 413);
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return reply({ ok: false, message: 'Request too large' }, 413);

  let input;
  try { input = JSON.parse(raw); } catch { return reply({ ok: false, message: 'Invalid JSON' }, 400); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return reply({ ok: false, message: 'Invalid request' }, 400);

  // Honeypot: pretend success so bots learn nothing, but send nothing.
  if (typeof input.website === 'string' && input.website.trim() !== '') return reply({ ok: true }, 200);

  const ip = request.headers.get('CF-Connecting-IP') || '';
  if (await rateLimited(env, ip)) return reply({ ok: false, message: 'Too many requests' }, 429);

  const { values, errors } = validate(input);
  if (Object.keys(errors).length) return reply({ ok: false, errors, message: 'Please check the highlighted fields.' }, 400);

  const ts = await verifyTurnstile(input.turnstileToken, ip, env);
  if (ts.misconfigured) { console.error('config: TURNSTILE_SECRET missing'); return reply({ ok: false, message: 'Service unavailable' }, 503); }
  if (!ts.ok) return reply({ ok: false, message: 'Spam check failed' }, ts.upstream ? 503 : 403);

  try {
    const message = buildMessage(values, { receivedAt: new Date().toISOString(), origin }, env);
    await sendMail(message, env);
  } catch (err) {
    console.error('mail failure:', err && err.message); // no visitor data in logs
    return reply({ ok: false, message: 'Could not send right now' }, 502);
  }
  return reply({ ok: true }, 200);
}

export default { fetch: (request, env) => handleRequest(request, env) };

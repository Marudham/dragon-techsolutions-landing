import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest, validate, buildMessage } from '../src/index.js';

const ORIGIN = 'https://landing.example.test';
const baseEnv = () => ({
  ALLOWED_ORIGINS: `${ORIGIN},http://localhost:8080`,
  MAIL_TO: 'contact@blueark.co.in',
  MAIL_FROM: 'Dragon TechSolutions Website <no-reply@example.test>',
  MAIL_PROVIDER: 'resend',
  RESEND_API_KEY: 're_test_key',
  TURNSTILE_SECRET: 'secret',
});
const goodBody = (over = {}) => ({
  firstName: 'Asha', lastName: 'Rao', email: 'asha@example.test', phone: '+91 98765 43210', jobRole: 'IT', jobTitle: 'IT Manager', designation: 'IT Manager', company: 'Acme', country: 'India',
  message: 'We would like an audit of our network.', consent: true,
  website: '', turnstileToken: 'tok', ...over,
});
const req = (body, { origin = ORIGIN, method = 'POST', headers = {} } = {}) =>
  new Request('https://worker.example.test/api/enquiry', {
    method,
    headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}), 'CF-Connecting-IP': '203.0.113.9', ...headers },
    body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });

/** Replace global fetch for one test; returns the recorded calls. */
function mockFetch(t, { turnstile = { success: true, hostname: 'landing.example.test' }, mailStatus = 200 } = {}) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('siteverify')) return new Response(JSON.stringify(turnstile), { status: 200 });
    return new Response(JSON.stringify({ id: 'm1' }), { status: mailStatus });
  };
  t.after(() => { globalThis.fetch = original; });
  return calls;
}

test('happy path sends one e-mail to contact@blueark.co.in with Reply-To = visitor', async (t) => {
  const calls = mockFetch(t);
  const res = await handleRequest(req(goodBody()), baseEnv());
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  const mail = calls.find((c) => c.url.includes('resend.com'));
  assert.ok(mail, 'resend was called');
  assert.equal(mail.init.headers.Authorization, 'Bearer re_test_key');
  const payload = JSON.parse(mail.init.body);
  assert.deepEqual(payload.to, ['contact@blueark.co.in']);
  assert.equal(payload.reply_to, 'asha@example.test');
  assert.match(payload.subject, /Email Solutions/);
  assert.match(payload.text, /Topic: Email Solutions/);
});

test('turnstile is verified server-side with the secret and visitor IP', async (t) => {
  const calls = mockFetch(t);
  await handleRequest(req(goodBody()), baseEnv());
  const ts = calls.find((c) => c.url.includes('siteverify'));
  const body = ts.init.body;
  assert.equal(body.get('secret'), 'secret');
  assert.equal(body.get('response'), 'tok');
  assert.equal(body.get('remoteip'), '203.0.113.9');
});

test('rejects missing / disallowed Origin', async (t) => {
  const calls = mockFetch(t);
  assert.equal((await handleRequest(req(goodBody(), { origin: '' }), baseEnv())).status, 403);
  assert.equal((await handleRequest(req(goodBody(), { origin: 'https://evil.example' }), baseEnv())).status, 403);
  assert.equal(calls.length, 0, 'nothing downstream was contacted');
});

test('preflight: allowed origin 204, others 403', async () => {
  const ok = await handleRequest(req(null, { method: 'OPTIONS' }), baseEnv());
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  const bad = await handleRequest(req(null, { method: 'OPTIONS', origin: 'https://evil.example' }), baseEnv());
  assert.equal(bad.status, 403);
});

test('only POST /api/enquiry is served', async () => {
  const get = await handleRequest(req(null, { method: 'GET' }), baseEnv());
  assert.equal(get.status, 405);
  const other = await handleRequest(new Request('https://worker.example.test/other', { method: 'POST' }), baseEnv());
  assert.equal(other.status, 404);
});

test('content-type, JSON and size guards', async (t) => {
  mockFetch(t);
  assert.equal((await handleRequest(req(goodBody(), { headers: { 'Content-Type': 'text/plain' } }), baseEnv())).status, 415);
  assert.equal((await handleRequest(req('{not json'), baseEnv())).status, 400);
  assert.equal((await handleRequest(req('[1,2]'), baseEnv())).status, 400);
  assert.equal((await handleRequest(req(goodBody({ message: 'x'.repeat(20000) })), baseEnv())).status, 413);
});

test('server-side validation returns per-field errors', async (t) => {
  const calls = mockFetch(t);
  const res = await handleRequest(req({ turnstileToken: 'tok' }), baseEnv());
  assert.equal(res.status, 400);
  const data = await res.json();
  for (const k of ['firstName', 'lastName', 'email', 'phone', 'jobRole', 'jobTitle', 'company', 'country', 'message', 'consent']) assert.ok(data.errors[k], `error for ${k}`);
  assert.equal(calls.length, 0);
});

test('validate(): consent must be literally true, phone must be plausible, no service field is needed', () => {
  assert.equal('service' in validate(goodBody({ service: 'Hacked' })).values, false);
  assert.deepEqual(validate(goodBody({ service: 'Hacked' })).errors, {});
  assert.ok(validate(goodBody({ consent: 'true' })).errors.consent);
  assert.ok(validate(goodBody({ phone: 'abc' })).errors.phone);
  assert.ok(validate(goodBody({ phone: '12345' })).errors.phone);
  assert.deepEqual(validate(goodBody()).errors, {});
});

test('honeypot: pretends success but sends nothing', async (t) => {
  const calls = mockFetch(t);
  const res = await handleRequest(req(goodBody({ website: 'http://spam.example' })), baseEnv());
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(calls.length, 0);
});

test('failed turnstile -> 403 and no e-mail', async (t) => {
  const calls = mockFetch(t, { turnstile: { success: false } });
  const res = await handleRequest(req(goodBody()), baseEnv());
  assert.equal(res.status, 403);
  assert.equal(calls.filter((c) => c.url.includes('resend.com')).length, 0);
});

test('turnstile hostname mismatch is rejected when TURNSTILE_HOSTNAMES is set', async (t) => {
  mockFetch(t, { turnstile: { success: true, hostname: 'other.example' } });
  const res = await handleRequest(req(goodBody()), { ...baseEnv(), TURNSTILE_HOSTNAMES: 'landing.example.test' });
  assert.equal(res.status, 403);
});

test('missing TURNSTILE_SECRET fails closed (503) unless ALLOW_INSECURE_DEV=1', async (t) => {
  mockFetch(t);
  const env = baseEnv(); delete env.TURNSTILE_SECRET;
  assert.equal((await handleRequest(req(goodBody()), env)).status, 503);
  assert.equal((await handleRequest(req(goodBody()), { ...env, ALLOW_INSECURE_DEV: '1' })).status, 200);
});

test('mail provider failure -> 502 with no internals leaked', async (t) => {
  mockFetch(t, { mailStatus: 500 });
  const res = await handleRequest(req(goodBody()), baseEnv());
  assert.equal(res.status, 502);
  const text = await res.text();
  assert.ok(!/re_test_key|resend/i.test(text));
});

test('rate limiter binding: blocked -> 429 before any work', async (t) => {
  const calls = mockFetch(t);
  const env = { ...baseEnv(), RATE_LIMITER: { limit: async () => ({ success: false }) } };
  assert.equal((await handleRequest(req(goodBody()), env)).status, 429);
  assert.equal(calls.length, 0);
});

test('KV rate limit: per-IP hourly cap and daily cap', async (t) => {
  mockFetch(t);
  const store = new Map();
  const RATE_KV = { get: async (k) => store.get(k) ?? null, put: async (k, v) => { store.set(k, v); } };
  const env = { ...baseEnv(), RATE_KV, PER_IP_HOURLY: '2', DAILY_CAP: '3' };
  assert.equal((await handleRequest(req(goodBody()), env)).status, 200);
  assert.equal((await handleRequest(req(goodBody()), env)).status, 200);
  assert.equal((await handleRequest(req(goodBody()), env)).status, 429, 'third from same IP in the hour');
  const other = (ip) => req(goodBody(), { headers: { 'CF-Connecting-IP': ip } });
  assert.equal((await handleRequest(other('198.51.100.1'), env)).status, 200, 'different IP still ok (daily 3rd)');
  assert.equal((await handleRequest(other('198.51.100.2'), env)).status, 429, 'daily cap reached');
});

test('header injection: CR/LF stripped from single-line fields; HTML escaped in html body', () => {
  const { values } = validate(goodBody({ firstName: 'Eve\r\nBcc: x@evil.test', company: '<img src=x onerror=alert(1)>' }));
  assert.ok(!/[\r\n]/.test(values.name));
  const msg = buildMessage(values, { receivedAt: 't', origin: ORIGIN }, baseEnv());
  assert.ok(!/[\r\n]/.test(msg.subject));
  assert.ok(!msg.html.includes('<img'));
  assert.ok(msg.html.includes('&lt;img'));
  assert.equal(msg.reply_to, 'asha@example.test');
  assert.ok(!('bcc' in msg));
});

test('webhook provider posts the same message with bearer token', async (t) => {
  const calls = mockFetch(t);
  const env = { ...baseEnv(), MAIL_PROVIDER: 'webhook', MAIL_WEBHOOK_URL: 'https://mail.example.test/send', MAIL_WEBHOOK_TOKEN: 'tkn' };
  const res = await handleRequest(req(goodBody()), env);
  assert.equal(res.status, 200);
  const call = calls.find((c) => c.url === 'https://mail.example.test/send');
  assert.equal(call.init.headers.Authorization, 'Bearer tkn');
  assert.deepEqual(JSON.parse(call.init.body).to, ['contact@blueark.co.in']);
});

test('topic: every enquiry is tagged "Email Solutions" by the Worker, overridable via ENQUIRY_TOPIC', () => {
  const { values } = validate(goodBody());
  assert.match(buildMessage(values, { receivedAt: 't', origin: ORIGIN }, baseEnv()).subject, /Email Solutions/);
  const custom = buildMessage(values, { receivedAt: 't', origin: ORIGIN }, { ...baseEnv(), ENQUIRY_TOPIC: 'Spring campaign' });
  assert.match(custom.subject, /Spring campaign/);
});

test('source: website enquiries are labelled "Website enquiry"; unknown sources fall back to the e-mail topic', () => {
  const msg = (over) => buildMessage(validate(goodBody(over)).values, { receivedAt: 't', origin: ORIGIN }, baseEnv());
  assert.match(msg({ source: 'website' }).subject, /Website enquiry/);
  assert.match(msg({ source: 'book' }).subject, /Email Solutions/);
  const evil = msg({ source: 'Hacked\r\nBcc: x@evil.test' });
  assert.match(evil.subject, /Email Solutions/);
  assert.ok(!/Hacked/.test(evil.subject + evil.text));
});

test('designation: optional, single line, shown in the mail', () => {
  const ok = validate(goodBody({ designation: 'IT Manager\r\nBcc: x@evil.test' }));
  assert.deepEqual(ok.errors, {});
  assert.ok(!/[\r\n]/.test(ok.values.designation));
  assert.match(buildMessage(validate(goodBody()).values, { receivedAt: 't', origin: ORIGIN }, baseEnv()).text, /Designation: IT Manager/);
  assert.deepEqual(validate(goodBody({ designation: undefined })).errors, {});
  assert.match(buildMessage(validate(goodBody({ designation: undefined })).values, { receivedAt: 't', origin: ORIGIN }, baseEnv()).text, /Designation: —/);
});

test('new fields: name is built from first+last, job role/title/country/company are required and shown in the mail', () => {
  const ok = validate(goodBody());
  assert.equal(ok.values.name, 'Asha Rao');
  const text = buildMessage(ok.values, { receivedAt: 't', origin: ORIGIN }, baseEnv()).text;
  for (const row of ['Name: Asha Rao', 'Job role: IT', 'Job title: IT Manager', 'Company: Acme', 'Country: India']) assert.ok(text.includes(row), row);
  for (const k of ['jobRole', 'jobTitle', 'company', 'country', 'firstName', 'lastName']) assert.ok(validate(goodBody({ [k]: '' })).errors[k], `${k} required`);
});

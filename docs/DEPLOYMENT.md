# Deployment runbook

Everything below uses free tiers. Do the steps in order. Items marked **(customer)** are done by Dragon TechSolutions' IT/DNS owner.

## Phase 1 – first review deploy (no Cloudflare, no domain needed)

1. Push to a **public** GitHub repo and set **Settings → Pages → Source: GitHub Actions**.
2. The workflow deploys to `https://<github-username>.github.io/<repo>/` in *review mode*: the full page works and the
   enquiry form shows a "call or email us" message. Add the repository variables below only when you want the form live.

See also [todos.md](todos.md) for the current status checklist.

## 0. Decisions needed first

| Decision | Default in this repo |
|---|---|
| Site subdomain, e.g. `landing.<customer-domain>` | _customer to provide_ |
| Mail provider for the Worker | `resend` (HTTPS API). `webhook` adapter exists for a self-hosted relay such as ArkMail |
| Sender address | `no-reply@<a domain Blueark controls>` – must be verified with the mail provider |
| CC the client's mailbox? | No. Set `MAIL_CC` in `wrangler.toml` if agreed |

## 1. GitHub repository (Blueark's personal account)

```bash
cd dragon-techsolutions-landing
git add -A && git commit -m "Initial landing page"
gh repo create <you>/dragon-techsolutions-landing --public --source=. --push   # public is required for free Pages
```

In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## 2. Cloudflare Turnstile (free)

Cloudflare dashboard → **Turnstile → Add widget**. Hostnames: the customer subdomain (and `localhost` only if you want to test the real widget locally).
Mode: *Managed*. Copy the **Site key** (public) and **Secret key** (private).

## 3. Deploy the Worker

```bash
cd worker
npx wrangler login
# edit wrangler.toml: ALLOWED_ORIGINS (https://<customer-subdomain>), MAIL_FROM, TURNSTILE_HOSTNAMES
npx wrangler deploy
npx wrangler secret put TURNSTILE_SECRET        # paste the Turnstile secret key
npx wrangler secret put RESEND_API_KEY          # if MAIL_PROVIDER=resend
```

Optional abuse protection: create a KV namespace and uncomment `RATE_KV` (per-IP hourly cap + daily cap), and/or the `RATE_LIMITER` binding.

The deployed endpoint is `https://dragon-enquiry.<your-account>.workers.dev/api/enquiry`.

### Mail provider options

* **Resend** (default): add and verify the sender domain (SPF/DKIM DNS records at the *sender* domain's DNS), create an API key restricted to sending.
* **webhook** (e.g. ArkMail): set `MAIL_PROVIDER = "webhook"`, var `MAIL_WEBHOOK_URL`, secret `MAIL_WEBHOOK_TOKEN`. The Worker POSTs
  `{from, to[], cc[], reply_to, subject, text, html}` with `Authorization: Bearer …`; adapt `sendMail()` in `worker/src/index.js` if the relay expects a different shape.

## 4. Wire the site

Repository **Settings → Secrets and variables → Actions → Variables** (these are public values, not secrets):

| Variable | Example |
|---|---|
| `SITE_URL` | `https://landing.customer-domain.com` (no trailing slash) |
| `FORM_ENDPOINT` | `https://dragon-enquiry.<account>.workers.dev/api/enquiry` |
| `TURNSTILE_SITE_KEY` | the Turnstile **site** key |

Push to `main` → the workflow runs tests, injects these values, tightens the CSP to the Worker origin and deploys.

## 5. Custom domain **(customer adds one DNS record)**

GitHub Pages does not use a fixed IP for subdomains; it uses a `CNAME` (HTTPS certificate is issued automatically).
The customer uses Google Cloud, so in **Google Cloud Console → Network services → Cloud DNS → (their zone) → Add standard**:

| Field | Value |
|---|---|
| Type | `CNAME` |
| DNS name | the subdomain label, e.g. `landing` |
| TTL | `300` |
| Canonical name | `<github-username>.github.io.` (note the trailing dot) |

If the domain is managed elsewhere (e.g. Squarespace Domains, GoDaddy), it is the same record in that provider's DNS panel.
If a `CAA` record exists on the domain it must allow `letsencrypt.org`.

Then in GitHub: **Settings → Pages → Custom domain** = the subdomain → wait for the DNS check → tick **Enforce HTTPS**.
Commit a `CNAME` file containing just the subdomain so deployments keep it.

Recommended: verify the domain in GitHub (**Settings → Pages → Add a domain** under the account's Pages settings) with the TXT record GitHub shows, which prevents subdomain takeover.

*If an apex domain (no subdomain) were ever used*, GitHub's A records are `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (plus matching AAAA records).

## 6. Go-live verification checklist

- [ ] `https://<subdomain>/` loads over HTTPS, no browser console errors
- [ ] Submit a real enquiry → mail arrives at `contact@blueark.co.in`, Reply-To is the visitor
- [ ] Check spam folder / SPF-DKIM pass on the received mail
- [ ] Honeypot/Turnstile: reload page, submit without waiting → still works; invalid input shows field errors
- [ ] `https://<subdomain>/robots.txt` and `/sitemap.xml` show the real domain (no `__SITE_URL__`)
- [ ] Share the URL in WhatsApp/LinkedIn → preview image appears
- [ ] Update `ALLOWED_ORIGINS` / `TURNSTILE_HOSTNAMES` if the domain changes

## Rollback

Revert the commit on `main` (the workflow redeploys the previous site). To switch the form off instantly, run `npx wrangler delete` for the Worker: visitors then see the form's "could not send, please email enquiry@dragontechsolutions.com" message instead of losing their enquiry silently.

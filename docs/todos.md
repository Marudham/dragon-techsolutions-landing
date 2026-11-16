# TODO / reference

## Status (as of 2026-11-16)

| Step | What | Status |
|---|---|---|
| 1 | Cloudflare account created | ✅ done |
| 2 | Turnstile widget created (site key + secret key copied) | ✅ done |
| 3 | `wrangler login` + edit `worker/wrangler.toml` (`ALLOWED_ORIGINS`, `MAIL_FROM`, `TURNSTILE_HOSTNAMES`) | ⏸ on hold – customer subdomain not known yet |
| 4 | `wrangler deploy` + `wrangler secret put TURNSTILE_SECRET` | ⏸ on hold (needs step 3) |
| 5 | Mail provider (Resend or ArkMail) + `RESEND_API_KEY` secret | ⏳ pending |
| 6 | KV rate limiting (`RATE_KV`) | ⏳ pending |
| 7 | Smoke-test the deployed Worker with curl | ⏳ pending |
| 8 | Set GitHub Actions variables (`SITE_URL`, `FORM_ENDPOINT`, `TURNSTILE_SITE_KEY`) | ⏳ pending |

**Phase 1 (review deploy) is done**: https://marudham.github.io/dragon-techsolutions-landing/ . Change request 2 is implemented: landing (`/`), form page (`/book-a-call/`) and full website (`/website/`), no service selector. See [email-solutions-pivot.md](email-solutions-pivot.md) for what is still open (email ad template, copy approval).

Also open: client content confirmations in [CONTENT-REVIEW.md](CONTENT-REVIEW.md); customer DNS `CNAME` once the subdomain is known ([DEPLOYMENT.md](DEPLOYMENT.md) §5).

### Phase 1 – initial review deploy (needs none of steps 3-8)

1. Create the GitHub repo (**public** – free Pages requires it) and push `main`.
2. Repo **Settings → Pages → Source: GitHub Actions**.
3. The workflow publishes to `https://<github-username>.github.io/dragon-techsolutions-landing/`.
   With no repository variables set it deploys in *review mode*: the whole page works, and the enquiry form shows a
   "please call or email us" message instead of submitting.

### Phase 2 – make the form live (steps 3-8)

The Worker does **not** have to wait for the customer subdomain: set `ALLOWED_ORIGINS` and `TURNSTILE_HOSTNAMES`
to `https://<github-username>.github.io` (and add the Turnstile hostname `<github-username>.github.io`) to test the real form
on the review site; add the customer subdomain later and run `npx wrangler deploy` again.

---

## Cloudflare setup walkthrough

You need about 20 minutes and a free account. **Never paste secret keys into chat.** Type them directly into the terminal prompts below.

### 1. Create the account

1. Go to https://dash.cloudflare.com/sign-up and sign up with your email. Verify the email.
2. You do not need to add a domain. The Worker gets a free `*.workers.dev` address.

### 2. Create the Turnstile widget (spam protection)

1. In the dashboard sidebar, open **Turnstile → Add widget**.
2. Name it `Dragon landing`.
3. Under **Hostnames**, add the customer subdomain once you know it. For staging you can also add `<your-github-username>.github.io`. You can edit this list later.
4. Set **Widget Mode** to *Managed*, then create it.
5. Copy two values:
   - the **Site key**, which is public and goes into a GitHub variable later
   - the **Secret key**, which is private and goes only into the Worker

### 3. Log in and edit the Worker config

In your terminal:

```bash
cd "/Users/apple/Marudham T S/Personal/Projects/dragon-techsolutions-landing/worker"
```

Run the login yourself so the browser sign-in works (in Claude Code, type this in the prompt):

```
! npx wrangler login
```

A browser tab opens. Click **Allow**.

Then edit `worker/wrangler.toml`:

- `ALLOWED_ORIGINS`: `https://<customer-subdomain>`. Add `,https://<your-github-username>.github.io` if you want to test on GitHub's own URL first.
- `MAIL_FROM`: `Dragon TechSolutions Website <no-reply@YOUR-VERIFIED-DOMAIN>`. This comes from step 5.
- `TURNSTILE_HOSTNAMES`: uncomment it and use the same hostnames as in step 2.

### 4. Deploy and add the Turnstile secret

```bash
npx wrangler deploy
npx wrangler secret put TURNSTILE_SECRET
```

- On the first deploy, wrangler asks you to choose a `workers.dev` subdomain name. Pick anything, for example `blueark`.
- The secret command shows a hidden prompt. Paste the Turnstile **Secret key** and press Enter.
- The deploy output ends with your endpoint: `https://dragon-enquiry.<name>.workers.dev`. The form uses that URL plus `/api/enquiry`.

### 5. Mail provider (Resend, recommended)

1. Sign up at https://resend.com and add a sending domain. Use a domain Blueark controls, such as `blueark.co.in`.
2. Resend shows SPF and DKIM DNS records. Add them at that domain's DNS and wait for Resend to show **Verified**.
3. Go to **API Keys → Create** and choose **Sending access** only.
4. Back in the terminal:

```bash
npx wrangler secret put RESEND_API_KEY
```

Paste the key at the hidden prompt.

If ArkMail is preferred instead, switch the Worker to the `webhook` provider. That needs the ArkMail session to confirm it has a send API.

### 6. Abuse protection (recommended, 2 minutes)

```bash
npx wrangler kv namespace create RATE_KV
```

Copy the `id` it prints. In `wrangler.toml`, uncomment the `[[kv_namespaces]]` block and paste the id. Leave the `RATE_LIMITER` block commented out, since it's experimental and the KV limits are enough. Then run `npx wrangler deploy` again.

### 7. Smoke-test the deployed Worker

This request is harmless: it fails validation and sends no mail.

```bash
curl -i -X POST https://dragon-enquiry.<name>.workers.dev/api/enquiry \
  -H "Origin: https://<customer-subdomain>" -H "Content-Type: application/json" -d '{}'
```

You should get `400` with field errors. With a wrong `Origin` you should get `403`. The real end-to-end test (a real email in the inbox) happens after step 8.

### 8. Connect the site

In GitHub, go to repo **Settings → Secrets and variables → Actions → Variables** and add three variables:

- `SITE_URL` = `https://<customer-subdomain>`
- `FORM_ENDPOINT` = `https://dragon-enquiry.<name>.workers.dev/api/enquiry`
- `TURNSTILE_SITE_KEY` = the Turnstile **site** key

Pushing to `main` then deploys with those values. The full checklist is in [DEPLOYMENT.md](DEPLOYMENT.md).

### Handing over to Claude

Once the three non-secret values are known (Worker URL, subdomain, GitHub username), ask Claude to fill in `wrangler.toml` and the `CNAME` file, re-run the endpoint tests against the live Worker, and write the DNS email for the customer.

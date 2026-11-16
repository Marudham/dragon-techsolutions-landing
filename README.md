# Dragon TechSolutions – landing page

Single-page, fully responsive landing page for **Dragon TechSolutions** ("For Your Business Needs"), built by Blueark.
It is a small campaign site focused on **business email solutions** (Microsoft 365 / Google Workspace), built like BlueArk's other campaign pages:

| Page | Path | Purpose |
|---|---|---|
| Landing | `/` | One short screen with two buttons |
| Form page | `/book-a-call/` | "Book a Strategy Call": the enquiry form only |
| Full website | `/website/` | "Explore the website": the complete Dragon TechSolutions site |

See [docs/email-solutions-pivot.md](docs/email-solutions-pivot.md).
Static HTML/CSS/JS hosted on **GitHub Pages**; the enquiry form posts to a small **Cloudflare Worker** that e-mails the lead.

```
 Visitor ──► GitHub Pages (static site, custom subdomain, HTTPS)
    │
    └─ form submit (JSON, HTTPS) ─► Cloudflare Worker  /api/enquiry
                                      1. Origin allow-list + CORS
                                      2. Size / content-type / JSON guards
                                      3. Honeypot, per-IP + daily rate limits
                                      4. Server-side validation (never trusts the browser)
                                      5. Cloudflare Turnstile verification (secret stays server-side)
                                      6. Sends e-mail to contact@blueark.co.in (Reply-To = visitor), tagged by page ("Email Solutions" or "Website enquiry")
```

No credentials exist in the repo or in the web page. The delivery address and mail keys live only in the Worker's config/secrets.

## Project layout

| Path | What it is |
|---|---|
| `index.html`, `book-a-call/index.html`, `website/index.html` | The three pages (semantic, SEO, strict CSP via `<meta>`) |
| `assets/css/styles.css` | Hand-written CSS using the Stitch "Titan Infrastructure" design tokens |
| `assets/js/main.js` | Nav, scroll effects, form validation/submit, lazy Turnstile |
| `assets/js/config.js` | Public runtime config. **Empty in git**; the deploy workflow injects production values |
| `assets/img/`, `assets/fonts/` | Logo, background images, the two email-platform logos (cut from the company profile PDF), self-hosted fonts |
| `worker/` | Cloudflare Worker (`src/index.js`), `wrangler.toml`, unit tests |
| `scripts/dev-server.mjs` | Local review server: serves the site **and** runs the real Worker with a fake mail sink |
| `scripts/check-site.mjs` | Static checks (links, icons, CSP-safety, forbidden claims, secret scan) |
| `.github/workflows/deploy.yml` | Test → assemble → deploy to GitHub Pages |
| `docs/DEPLOYMENT.md` | Step-by-step go-live runbook incl. DNS for the customer |
| `docs/CONTENT-REVIEW.md`, `docs/CONTENT-REVIEW-website.md` | Facts/assumptions the client must confirm (landing + form pages / full website page) |
| `docs/email-solutions-pivot.md` | Change request 2: email-only page, decisions taken, what is still open |
| `docs/voice-note-transcript-2026-11-15.md` | Transcript + English translation of the team's Tamil voice note |

## Run locally (review)

Requires Node 20+. No `npm install` needed.

```bash
npm run dev            # http://localhost:8080
```

* The form works end-to-end locally: Turnstile uses Cloudflare's official **test keys**, and the Worker "sends" mail to an in-memory sink.
  Open <http://localhost:8080/__mailsink> to see exactly what would be delivered to `contact@blueark.co.in`. Nothing is really e-mailed.
* `npm test` – 19 Worker unit tests (validation, CORS/origin, honeypot, Turnstile, rate limits, header-injection, providers).
* `npm run check:site` – static checks.

## Deploy

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**. In short: deploy the Worker, set three repository variables
(`SITE_URL`, `FORM_ENDPOINT`, `TURNSTILE_SITE_KEY`), push to `main`, and ask the customer to add one `CNAME` DNS record.

## Security notes

* Strict Content-Security-Policy (no inline scripts/styles; connect only to the Worker; Turnstile only).
* Honeypot + Turnstile + rate limiting + origin allow-list; server-side validation; CR/LF stripped (no e-mail header injection); all user input HTML-escaped in the e-mail body.
* Privacy: no analytics/trackers, no database; enquiry details go only to the delivery mailbox. A privacy note is in the page footer.

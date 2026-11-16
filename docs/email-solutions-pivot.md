# Change request 2 – focus the page on email solutions only

Date: 15–16 Nov 2026. Source: BlueArk team feedback after reviewing the first deploy.

## What the team said (WhatsApp, 15/11/2026, 11:21 pm)

- "Make for email solutions only"
- "Remove service selection option in form"
- Plus a 1 min 43 s Tamil voice note. Transcript and English translation: [voice-note-transcript-2026-11-15.md](voice-note-transcript-2026-11-15.md)

## Summary of the voice note and the proposed plan (saved verbatim from the review chat)

### What the voice note says

1. The page is for a demand-generation campaign. People arrive from an email advertisement, so the page should be only about the email solution.
2. It should cover the benefits of buying the email solution. It should also cover the risk of insecure email (this line is unclear in the audio), all on one page.
3. It should have two options. Contact us / Book a strategy call opens the form. Explore the website takes them to the page itself.
4. The page should stand alone, apart from Dragon's existing site.
5. They said the page looks good, but "everything feels a bit cluttered". That's fine for now, and changes can come later.
6. In the last sentence they say BlueArk is running demand generation, so "similarly an ad/admin [unclear] should be made ready". This may mean you also need to produce the email advertisement itself.

Combined with the two written messages, that gives three changes: make the page email-solutions only, remove the service dropdown from the form, and add two clear calls to action.

### Proposed plan

Page changes
- Rebuild the hero around the email solution. The two buttons are "Book a strategy call" (scrolls to the form) and "Explore the website".
- Remove the generic Dragon sections: rental, networking, servers and storage, network appliances, and the 16-client logo strip, unless the client confirms them. Keep the About and Contact sections but shorten them.
- New sections: a problem section about insecure or unmanaged email, a benefits section, and the Microsoft 365 and Google Workspace logos (these logos came from the profile PDF).
- Form: remove the service dropdown, add a hidden `source=email-solutions` field, and keep the rest. The Worker's service validation, its tests, the privacy text and the CTA preselect code in `main.js` need updating to match.
- This also trims the page, which should help with the clutter feedback.

Not in the page changes: the email advertisement itself, if that is what the last sentence asks for. It would be a separate HTML email template with the same two buttons.

### Questions raised, and the answer taken ("go with recommended options")

| # | Question | Decision taken |
|---|---|---|
| 1 | Content: PDF has no email benefits/security copy | Draft copy written from generic, verifiable facts about Microsoft 365 / Google Workspace (no numbers, no certifications, no pricing, no "partner" claims). Every claim is listed in `CONTENT-REVIEW.md` as **to be confirmed with client** |
| 2 | "Explore the website" | Scrolls down this page (to the "why it matters" section) |
| 3 | Email advertisement | **Not built yet.** Page first. Needs a go-ahead and the brief for the email (see "Still open" below) |
| 4 | Trimming | Rental, networking, servers, appliances, antivirus, cloud and client logos removed. A one-line footer link to dragontechsolutions.com covers the rest |
| 5 | Hosting | New version replaces the page at the same URL. The old full version is kept in git history and tagged `v1-full-profile` |

Changes beyond this ("any changes will do it later") are deferred.

## Implementation notes

- The Worker no longer accepts a `service` field. It tags every enquiry itself with the topic `Email Solutions` (env var `ENQUIRY_TOPIC`), so the delivery mailbox can tell campaign leads apart. The browser cannot influence this value.
- Form fields now: name, work email, phone, company (optional), message, consent (+ honeypot + Turnstile).
- The ISO 27001 chip was dropped from the page because the certification is still unconfirmed (item 1 in `CONTENT-REVIEW.md`).

## Still open

- [ ] Client/BlueArk to supply or approve the email-solution copy (`CONTENT-REVIEW.md`, section "Email-solutions copy").
- [ ] Is an email advertisement (HTML email template) wanted? If yes: sender, subject line, offer, and which two buttons/URLs.
- [ ] Confirm what "Explore the website" should do (currently scrolls on this page; alternative is a link to dragontechsolutions.com).
- [ ] Tamil speaker to check the lines marked **[unclear]** in the voice-note transcript.
- [ ] Social preview image (`og-image.png`) regenerated for the email message.


---

## Follow-up (16 Nov 2026): the real page structure the team expects

After seeing the first email-only version the team clarified that they want **three separate pages**, with BlueArk's own campaign pages
(https://blueark.co.in/campaign-assets → `/landing/demand-generation`, `/landing/arkmail/`, and a Red Hat style form page) used as the
**structure only**. The visual design stays Dragon's own.

| Page | URL (relative) | What it is |
|---|---|---|
| Landing | `/` | One short screen: logo, badge, headline, intro, six tick-points, **Book a Strategy Call** and **Explore the website** buttons, platform logos, small footer |
| Form page | `/book-a-call/` | Single page with the enquiry form only (intro + what to expect on the left, boxed form on the right), reached from "Book a Strategy Call" |
| Full website | `/website/` | The first-built full Dragon TechSolutions website (what was tagged `v1-full-profile`), reached from "Explore the website" |

Decisions taken (change anything later):
- The full website keeps its original content and design; its form lost the service selector too (same rule for every form). Its "Enquire" buttons simply go to the contact section.
- Every form posts to the same Worker with a `source` key (`book` or `website`). The Worker maps it to a label (allow-list): `Email Solutions` or `Website enquiry`, shown in the mail subject/body, so the team can tell campaign leads from general website enquiries.
- Page copy is still a draft for the team to approve (see `CONTENT-REVIEW.md`); the full website's items are in `CONTENT-REVIEW-website.md`.
- Landing and form pages use one shared stylesheet and script with the website (`assets/`), so a design change is made once.

---

## Change requests log (after the three-page restructure)

| Date | Request (from the team chat) | Status |
|---|---|---|
| 16 Nov 2026 | "Add designation in form" | Done on both forms (`/book-a-call/` and `/website/`). Optional field, sent to the Worker, shown as a "Designation" row in the mail. To make it required: add `required` and an error line to the input, plus a rule in `assets/js/main.js` and `validate()` in `worker/src/index.js` |
| 16 Nov 2026 | "Should we keep the phone 044 46054287 or remove it?" – answer "No issue" | Kept everywhere |
| 16 Nov 2026 | "Is there any possible to change colour" – "yes we can, which color?" – "That should be like human creation" | **Done – option A (logo-matched light theme)** chosen: warm paper background, charcoal text/footer, Dragon brand red accent; flat (no gradients, glow, blur, sparkles or dark photos). All colours are variables at the top of `assets/css/styles.css` (`:root`). The old dark stylesheet is in git history (`a2f4a40`/`43b2bb5`). Social preview images regenerated to match. Axe contrast check is clean on all pages |
| 16 Nov 2026 | WhatsApp: remove or change to 9626795150; remove company phone/email from the landing pages; keep "Explore the website" (team confirmed) | Done. WhatsApp link is `https://wa.me/919626795150` on all three pages. `/` and `/book-a-call/` show no company phone/email (header, footer, privacy note and error messages included); the privacy note offers WhatsApp for deletion requests. `npm run check:site` now fails if those details return. The full website page keeps Dragon's own contact section |
| 16 Nov 2026 | Book page looked blank without contact details | Added a second list of "what we can talk through" points (generic, no claims) |
| 16 Nov 2026 | Form fields: keep all fields of the Red Hat reference form plus our Designation and "How can we help?" | Done on both forms: First name, Last name, Business email, Phone, Job role, Job title, Designation (optional), Company, Country (default India), How can we help?, consent. Mail shows all of them. Worker validation updated, so **deploy the Worker before the site** |
| 16 Nov 2026 | Footer: make "Blueark" a link to https://blueark.co.in/ | Done on all three pages (opens in a new tab) |

Notes for the team: Job role, Job title and Designation overlap; Designation is the only optional one. If it should be dropped or the other two merged, it is a quick change. Form submissions still go by email to `contact@blueark.co.in` (WhatsApp is only a chat link, not a delivery channel).

| 16 Nov 2026 | "Make the phone no non mandatory" | Done on both forms: no asterisk, not required. If filled in it must still look like a phone number; blank is shown as "—" in the mail. Worker and site must both be deployed |
| 16 Nov 2026 | Live form showed "could not send your enquiry" | Cause: `MAIL_FROM` in `worker/wrangler.toml` was missing its closing `>`, so Resend rejected every send. Fixed; the Worker now also logs Resend's error reason and flags a malformed `MAIL_FROM` clearly |

# Content review – items for Dragon TechSolutions / BlueArk to confirm

The page is now **email-solutions only** (change request 2, see [email-solutions-pivot.md](email-solutions-pivot.md)).
Company facts come from the company profile PDF ("Dragon Techsolutions ProfilesUpdated2026") and the client's website.
**Nothing numeric or certified was invented**: no uptime %, customer counts, prices, SLAs or certifications appear on the page.

## Email-solutions copy – DRAFT, please approve or replace

The PDF has no email-specific text (it only lists "Email Solutions" with the Microsoft 365 and Google Workspace logos), so the copy below was drafted from
generic, verifiable facts about those platforms. Every claim should be confirmed or replaced by the team.

| # | Where | What the page says | What to confirm |
|---|---|---|---|
| E1 | Hero | "Dragon TechSolutions plans, sets up and supports your business email" | Does Dragon do planning, set-up **and** ongoing support for email? |
| E2 | Hero / Platforms | Works with **Microsoft 365** and **Google Workspace** | Which platform(s) the campaign is for; whether Dragon holds partner/reseller status (page does **not** claim it) |
| E3 | Why it matters | Free/shared mailboxes, phishing/spam, passwords-only sign-in, no admin control | The "insecure email" angle from the voice note was unclear – is this the message the team wants? |
| E4 | Benefits | Own-domain addresses, built-in spam/phishing filtering, multi-factor sign-in, admin console, any device, calendar/meetings/files | Wording and any extra benefits (migration, backup, archiving, compliance) |
| E5 | How it works | 1 Strategy call → 2 Plan and move (migration) → 3 Ongoing support | Is mailbox migration part of the offer? Steps and wording |
| E6 | Everywhere | CTA "Book a strategy call" (form) and "Explore the website" (scrolls down) | Should "Explore the website" instead open dragontechsolutions.com? |
| E7 | Form | Fields: name, work email, phone, company (optional), message, consent. No service selector | Any extra field wanted (e.g. number of mailboxes)? |
| E8 | Email to the team | Subject/body tagged "Email Solutions" | Preferred subject line / CC |

## Company facts (carried over)

| # | Item | What the page says now | Source / note |
|---|---|---|---|
| 1 | ISO 27001 | **Removed** from the page | Only on the live website ("ISO 27001:**2002**" – probably 2022). Re-add only if certification, year and body are confirmed |
| 2 | Experience | "10+ years" | PDF: "Ten plus years" |
| 3 | WhatsApp number | `+91 93422 52587` | From the live website's WhatsApp link. The PDF lists only `044 46054287 / 97510 74995` for calls |
| 4 | Bengaluru address | "…Naidu Layout, **Kankunte Cross**, Vasanthapura Main Road…" | PDF text reads "KnankunteCross" – spelling needs confirming |
| 5 | Email shown to visitors | `enquiry@dragontechsolutions.com` | PDF. Enquiry-form leads are delivered to `contact@blueark.co.in` per the Blueark arrangement; confirm whether the client's mailbox should also be CC'd |
| 6 | Platform logos | Microsoft 365 and Google Workspace logos cut from the PDF (low resolution; the Microsoft one has a grey box around the text) | Replace with official logo files and confirm brand-usage rules |
| 7 | Footer link | "Visit dragontechsolutions.com" | Keep, or remove to make the page fully stand-alone |
| 8 | Footer credit | "Designed & developed by Blueark" | Remove/link as Blueark prefers |
| 9 | Social links | Facebook, Instagram, YouTube from the live site | Confirm they are current |
| 10 | Privacy note | Short note in footer (data sent by e-mail only, no trackers) | Have the client's counsel review for DPDP Act wording |
| 11 | Background images | Server-room and support images from the PDF (hero and banner) | Confirm the client holds usage rights |

Removed in change request 2 (still in git tag `v1-full-profile`): client logos, services, rental products, other product brands, testimonial discussion.

## Facts guarded by `npm run check:site`

The check fails the build if invented/placeholder content reappears (e.g. `99.98`, `500+`, `+1 (800)`, `John Smith`), if the form gets a service selector again,
if the private delivery address appears in the page, or if a secret-looking string is committed.

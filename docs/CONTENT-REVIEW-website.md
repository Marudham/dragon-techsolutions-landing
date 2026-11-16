# Content review – full website page (/website/)

> This is the list for the **full Dragon TechSolutions website** that opens from "Explore the website". It still contains the original profile content (ISO 27001 chip, client logos, rental, etc.), so these items still need the client's confirmation.
> The email-solutions landing page and the form page are covered in [CONTENT-REVIEW.md](CONTENT-REVIEW.md). The website's enquiry form no longer has a service selector (change request 2).


All copy was written from the company profile PDF ("Dragon Techsolutions ProfilesUpdated2026") and the client's current website.
**Nothing was invented**: the AI-generated Stitch design contained fabricated figures (uptime %, deployment counts, SLA times, stock levels, hardware specs) which were removed.

## Please confirm

| # | Item | What the page says now | Source / note |
|---|---|---|---|
| 1 | ISO 27001 | "ISO 27001 certified" (hero chip + trust strip) | Only on the live website, which says "ISO 27001:**2002**" (the standard dates from 2005 – probably 2022). Confirm certification, year and body, or we remove it |
| 2 | Experience | "10+ years" | PDF: "Ten plus years" |
| 3 | WhatsApp number | `+91 93422 52587` | From the live website's WhatsApp link. The PDF lists only `044 46054287 / 97510 74995` for calls |
| 4 | Bengaluru address | "…Naidu Layout, **Kankunte Cross**, Vasanthapura Main Road…" | PDF text reads "KnankunteCross" – spelling needs confirming |
| 5 | Email shown to visitors | `enquiry@dragontechsolutions.com` | PDF. Enquiry-form leads are delivered to `contact@blueark.co.in` per the Blueark arrangement; confirm whether the client's mailbox should also be CC'd |
| 6 | Client logos | 16 logos cut from the PDF (low resolution) | Request original SVG/PNG files and confirmation each client allows logo display |
| 7 | Partner logos / wording | "Solutions from leading technology brands" | No claim of "authorised partner" is made. Add it only if the client holds those partner statuses |
| 8 | Testimonial | None | The live site's testimonial is a placeholder ("John Smith, Tech Innovations") and was not used. Send real ones to add |
| 9 | Rental products | Names only (12 items from the PDF) | No stock, specs or SLAs are claimed. Send details if they should appear |
| 10 | Services | Exactly the 5 in the PDF | The live site additionally lists Cloud Services, Security Solutions, Systems Management, Unified Communications – add if wanted |
| 11 | Footer credit | "Designed & developed by Blueark" | Remove/link as Blueark prefers |
| 12 | Social links | Facebook, Instagram, YouTube from the live site | Confirm they are current |
| 13 | Copy tidy-ups | "Turnkey", "achieved", "infrastructural" typos fixed; British spelling ("organisation") used | PDF used mixed spelling |
| 14 | Privacy note | Short note in footer (data sent by e-mail only, no trackers) | Have the client's counsel review for DPDP Act wording |
| 15 | Photos | Server-room, network, support and device images from the PDF | Confirm the client holds usage rights |

## Facts guarded by `npm run check:site`

The check fails the build if invented/placeholder content reappears (e.g. `99.98`, `500+`, `+1 (800)`, `John Smith`), if the private delivery address appears in the page, or if a secret-looking string is committed.

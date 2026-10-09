# Get Mchongo — Implementation Plan

## Product direction

A mobile-first Tanzanian jobs and opportunities board with a clear separation between public discovery and protected administration. The only public listings are explicitly published records. Source-collected listings always enter a review queue; incomplete fields remain blank, the source URL is retained separately, and an application link is shown only when provided by the source.

## Design

- **Design movement:** contemporary East African editorial utility—approachable civic-tech with the clarity of a carefully edited opportunities journal.
- **Core principles:** source-first trust; quick filtering and direct application; calm readability; responsive layouts that privilege the job information rather than decoration.
- **Color philosophy:** warm ivory for a humane reading surface, inky charcoal for dependable contrast, and an ownable coastal green for progress and primary actions; a restrained marigold accent marks timely or newly reviewed opportunities without implying information that is not present.
- **Layout paradigm:** left-aligned editorial masthead and asymmetric hero/search band followed by a flexible opportunity feed; show the first 9 listings initially, then use a prominent two-tone gold “View more jobs” button to open a separate page containing the proceeding listings, with a back control to return to the previous page. Preserve active filters when opening that page. The About Us page uses an editorial hero, opportunity-type markers, clear purpose cards and a career-services call to action. A desktop search/filter bar becomes compact stacked controls on phones. Job detail pages put application actions alongside the listing and then flow through the source information.
- **Signature elements:** a rising-path/sun mark integrated into the wordmark; slim deadline/availability rails; compact location and category chips.
- **Interaction philosophy:** search and filters respond immediately; cards have clear focus and click targets; like/save/share give direct, reversible feedback; a compact, fixed middle-right Home pill appears on every non-home route for one-tap return; admin status actions make pending, published, inactive and duplicate states explicit.
- **Animation:** brief, subtle card and button transitions; no essential content depends on motion; honor reduced-motion preferences.
- **Typography:** Newsreader for display headlines with a serif fallback, paired with DM Sans for navigation, forms and body text with system fallbacks. Use clear size/weight hierarchy and comfortably readable line lengths.
- **Brand essence:** a trusted, no-noise place for Tanzanian opportunities and the original application path; **clear, grounded, optimistic**.
- **Brand voice:** direct, encouraging and specific. Example lines: “Make your next move.” “Real opportunities. Original application links.”
- **Wordmark & logo:** a distinctive compact green rising-route/sun glyph paired with the “Get Mchongo” wordmark, not a default text-only logo.
- **Signature brand color:** coastal green `#12664F`.

## Visual refresh

- Make the public homepage more vivid with two original, editorial photographs: a wide Tanzania-inspired collaboration scene as the hero artwork, and a smaller close workplace scene alongside “The Mchongo Way”. Keep headline copy outside the photographs for legibility and responsive cropping.
- Add lightweight, source-controlled SVG/CSS graphics for opportunity discovery and the truthful empty-board state. Preserve the existing green, ivory and marigold identity; use measured soft shapes, thin route lines and small floating labels rather than invented statistics, job cards or company logos.
- Image-search references were considered for visual direction only and are not reused on the site: [Tech In Africa collaboration image](https://files.manuscdn.com/search-media/310519664004490234/ST2pLojWgOk5cgzbxI1519/CYPBiQh3UX8kF2VGRT8XeP.jpg), [Africa Tech Schools Tanzania coworking image](https://files.manuscdn.com/search-media/310519664004490234/ST2pLojWgOk5cgzbxI1519/4RgtrivKVgujkEu6PA7puD.png), and [Dar es Salaam image result](https://files.manuscdn.com/search-media/310519664004490234/ST2pLojWgOk5cgzbxI1519/Hi3EZg3icXejwL6wpqDmjS.jpg). Generate original images rather than copying these third-party pictures.

## Implementation approach

- Extend the initialized React/TypeScript, Express and Drizzle/MySQL project. Use the managed database for jobs, company profiles, sources, pending review records, public reactions and scan schedule state.
- Build public `/`, `/jobs/:id`, and `/companies/:id` views. Public queries return published jobs only. Search covers job title and company text; category and location are filters. Details render only stored/source-verified values, offer an application link only when the source provides one, and retain the original source URL separately. Render crawler-readable job detail HTML and per-job Open Graph/Twitter metadata before the SPA shell; use the job image then company logo, show the job title and Get Mchongo brand, return real 404s for missing/unpublished records, use the known public Preview origin only in development, and require an explicit `PUBLIC_SITE_ORIGIN` for production absolute metadata.
- Add visitor-facing **Contact us** links for phone `+255743738062` and email `frontlinertech@gmail.com`, and a public `/submit` form with a clear “Post a job” entry point. Employers can provide company/institution information, listing details, deadlines, application instructions/link, and optional company logo/listing image/reference URL without registering for an account.
- Add a public `/cv-services` page with the five requested package prices, six expandable CV categories, service inclusions, truthful-benefit statements and WhatsApp ordering to `https://wa.me/255743738062`. Keep the price catalog in one client module because the existing admin has no general site-pricing controls; do not add payments or a new database table.
- Add the verified Kazi Portal, VETA, NACTVET verification, and Mainland employment-rights links to the existing footer Useful links group, plus a separate CV Services footer button.
- Add a public `/contact` message form where a visitor provides an email address and message without signing in. Save messages in a private database inbox visible only in the protected admin dashboard; administrators can mark messages read/unread and use a `mailto:` reply link. Do not publish messages or send automatic email.
- Validate public submissions and insert them only into the pending-review queue, using the existing duplicate matcher to flag possible overlaps. The form confirms that listings remain private until reviewed; admin review can edit/reject/approve them, and only an explicit admin approval publishes the listing. No automatic or direct public publishing from this form.
- For stored admin-uploaded listing images or logos, create a public **1200 × 630 JPEG** share-card rendition from the exact asset using contain/letterbox (no crop); declare its actual MIME type and dimensions, keep the original listing asset unchanged, and version both the image URL and share link when the job/company image record changes. Direct external image URLs remain direct.
- Add a dedicated `/admin` surface backed by server-verified email/password login and a signed, HTTP-only application cookie. The provided password is kept only in protected environment storage. Server endpoints for job, company, source, upload and review operations require the admin session. Do not depend on Manus OAuth or treat a client flag as authentication.
- Add an admin Analytics tab listing unique anonymous browsers per published job. Use a separate random browser key for each job and store only its one-way hash and first/last timestamps in a per-job table; do not collect IP addresses, names or user-agent strings. Respect browser Do Not Track, disclose the counting in job details, and cascade visitor records when a job is deleted. Label results as approximate unique browsers, not identified people.
- Keep admin capabilities narrow: manual jobs, company records, tracked sources, collected-job review, duplicate warnings, upload preview, publish/unpublish and deletion. Avoid employer/candidate accounts, payments and unrelated hiring features.
- Store companies separately and allow a job to retain its source-supplied company name even when no company profile has been created. Represent collected candidates in a separate pending-review table so approval creates/updates the public record explicitly.
- Support RSS/Atom, JSON feeds with administrator-configurable item/field paths, and static career pages. Parse XML/HTML/JSON with bounded response size and timeouts. For static pages, prefer Schema.org JobPosting/JSON-LD, metadata and explicit labeled sections; do not fabricate values. Only send candidates to the pending queue.
- Validate source URLs/redirects against private and local network targets, constrain response size/time and uploads, and record collection errors/run counts. Evaluate possible duplicate matches using normalized title, company, application URL and description similarity; flag rather than silently suppress matches.
- Implement scheduled scanning through the documented Heartbeat management API and authenticated `/api/scheduled/...` callback. Verify the signed platform callback, resolve its task identity, match it to the persisted scan-schedule row, and make runs idempotent. Scheduling can be configured by the admin; automatic scans must never publish.
- Use the platform's durable storage presign API for administrator image uploads and save stable `/manus-storage/...` asset paths in the database. Keep API credentials on the server.
- Add an administrator-only AI import assistant within job management. Accept pasted text up to 40,000 characters or one PDF/JPEG/PNG/WebP image up to 5 MB. Offer “keep source language” (default), English, and Kiswahili output. Use the live-catalog multimodal `gemini-3-flash-preview` model with strict JSON-schema extraction for the existing job/company fields. Treat uploaded content as untrusted data; never follow embedded instructions or invent missing details. Leave unsupported values blank, validate extracted HTTP(S) URLs, and return review notes.
- Uploaded source documents are memory-only and exposed to the model through a random, expiring, token-protected fetch URL; remove the temporary bytes after the request and never persist the source document. Do not use the source PDF/poster automatically as a public company logo or listing image. Map only validated extracted fields into the existing `JobEditor`, force draft status, and require an administrator to review and save/publish explicitly.
- Keep React routes and server code modular, maintain the route manifest, add the additive MySQL migration, and keep secrets out of source, migrations, logs and public bundles.

## Project structure

- `client/src/App.tsx` — public and admin route composition.
- `client/src/pages/` — public job feed/detail/company views and the protected admin login/dashboard.
- `client/src/pages/admin/JobAdImporter.tsx`, `client/src/pages/admin/AdminJobs.tsx` — bounded text/file import, output-language choice, and reviewed draft handoff to the existing job editor.
- `client/src/pages/SubmitOpportunity.tsx`, `client/src/components/SiteFooter.tsx` — public job-submission flow, common contact details and public resource links.
- `client/src/pages/CvServices.tsx`, `client/src/lib/cvServices.ts` — package display, category details, benefits, centralized prices and WhatsApp order links.
- `client/src/pages/ContactUs.tsx`, `client/src/pages/admin/AdminMessages.tsx` — visitor message form and protected admin inbox.
- `client/src/pages/admin/AdminAnalytics.tsx` — per-published-job unique-browser counts.
- `client/src/lib/pageMetadata.ts` — synchronize client-side job titles and share-card metadata with server-rendered details.
- `client/src/components/` — brand header, search/filters, job cards, detail sections, status labels and admin forms.
- `client/src/index.css`, `client/index.html` — responsive visual system and Get Mchongo page metadata.
- `client/public/manus-routes.json` — all public/admin page route patterns served from Vite's configured public directory.
- `server/_core/index.ts` — Express app startup and API mount points.
- `server/getmchongo/` — authentication, public API, server-rendered job share metadata, admin CRUD, upload handling, source collection, duplicate detection and scheduled callback services.
- `server/getmchongo/job-ad-structurer.ts` — strict-schema multimodal extraction and URL-safe normalization; `temporary-documents.ts` — unguessable, expiring, memory-only document access for the model.
- `drizzle/schema.ts`, `drizzle/migrations/` — relational tables and additive migration.

### Share-preview image references

- [Meta sharing best practices](https://developers.facebook.com/documentation/sharing/best-practices) recommends 1080-pixel-wide images for high-resolution display and states 600 pixels as the minimum width for image-link ads; it recommends pre-caching updated images and declaring `og:image:width` / `og:image:height`.
- [Open Graph protocol](https://ogp.me/) defines `og:image:type`, `og:image:width`, `og:image:height` and `og:image:alt` as structured image metadata.

## Data and user-visible behavior

- Jobs hold title, company relation/label, category, location, deadline, description, responsibilities, qualifications, instructions, original application URL, image/logo, source metadata, status and timestamps.
- Approved public submissions retain the submitted company description, website and logo alongside the job record so the job details remain useful even without an existing company profile.
- Companies hold name, description, logo/image, website and location.
- Sources hold type, URL, extraction configuration, active flag, schedule-related state, last run time, count and most recent error.
- Pending jobs hold all extracted fields, source/raw context, duplicate reasons and pending/approved/rejected status.
- Pending jobs also hold public employer submissions with the same company/job detail fields; the public phone/email are site contact channels, not applicant or employer accounts.
- Reactions hold job, anonymous browser token, and like/save kind; no candidate or user directory is introduced.
- Job-view analytics hold a one-way hash of one random browser identifier per published job and its first/last observation timestamps only; no IP address or personal profile is stored.
- Visitor messages hold only a validated reply email, bounded message text, read state and submission time, and are returned only by admin-protected APIs.
- No sample jobs are seeded. A new installation displays a helpful empty state until an administrator adds or approves a real listing.

## Serving and constraints

The Express process serves the React application and API on the configured port. The managed server/database were enabled during initialization. Public pages remain readable without an account. All administrative state changes and file uploads are server-authorized. Any collected record remains private to the review queue until the administrator explicitly approves and publishes it. The initial handoff is a preview unless a later user instruction authorizes public deployment.

# Get Mchongo — Delivery Outcomes

## [x] Public opportunity discovery and job details
- Visitors can browse **published** jobs/opportunities; search/filter by title, category and location; open a job detail; view company logo and company profile; like, save and share jobs; and apply through the original application link.
- Each job page shows, when available: job title; company/institution; company description; logo/image; location; deadline; job description; brief responsibilities; brief qualifications/requirements; how to apply; and application link. **Never invent missing information.**

## [x] Responsive photo and graphic enhancement
- Give the public homepage original editorial imagery in the hero and supporting feature, plus a custom opportunity-path illustration and graphic details; keep crops responsive on phones and do not add fabricated listings or statistics.

## [x] Job-specific share previews
- When a published job is shared, its link preview shows that job's title (and company when available), source-provided description, and its inserted image when present, falling back to the company logo; the site label is **Get Mchongo**, not generic or stale “MchongoDaily job portal” branding. Put these tags and meaningful job content in the initial HTML without requiring JavaScript. Never expose unpublished jobs; return a real 404 for missing or unpublished job pages.

## [x] Social-card picture from the inserted asset
- For an uploaded listing image—or the linked company logo when the job has no image—serve a public, correctly sized **1200 × 630 JPEG** made from that same asset, showing the full image without cropping or substituting unrelated artwork. Declare its accurate MIME type and dimensions in the job’s Open Graph tags.
- Make the share image and Share-button URL change when the listing image/logo record changes, so a newly shared listing does not reuse an old card.

## [x] Protected administrator and manual listings
- A protected admin dashboard accepts the requested administrator login email `frontlinertech@gmail.com`. The provided password stays in protected environment storage; no administrator password is stored in source or a public bundle.
- The admin can add jobs manually; edit/delete/publish/unpublish jobs; upload and preview logos/images; and manage company profiles.

## [x] Public contact and employer job submissions
- Visitor-facing pages show clickable contact options for `+255743738062` and `frontlinertech@gmail.com`.
- Visitors can open a public **Post a job** form without employer registration and enter the job title, company/institution and description; category, location, deadline, responsibilities, qualifications, how-to-apply details, application link, company description/website/logo, listing image and original/reference URL are available as appropriate. Require a title, company and description, plus an application link or clear application instructions.
- Every public submission is stored as **pending review**, possible duplicates are flagged, and it appears in the existing admin review queue for editing, rejection or explicit approval. **Never publish a public submission automatically.** After the administrator clicks **APPROVE & PUBLISH**, the approved details appear on the public job listing.
- Do not create employer accounts, public employer profiles or candidate databases.

## [x] Visitor messages and protected admin inbox
- Visitors can open a public message form, enter a valid email address and message, and submit without an account.
- Store submissions privately and show them only in the protected admin inbox, with new/unread state and read/unread controls; provide a `mailto:` link so an administrator can reply directly.
- Keep messages off public pages and do not send automatic email; validate and bound submitted content before storing it.

## [x] Per-job visitor analytics
- The protected admin tools include an Analytics area showing the visitor count for each published job.
- Analytics is reachable from the admin navigation, a persistent top-bar shortcut, and a clear dashboard-overview shortcut.
- A visitor means an approximate unique browser per job, counted once for that listing; use a separate random browser ID for each job and store only its one-way hash and visit timestamps. This browser-side measurement uses no names, IP addresses or user-agent strings. Respect Do Not Track, explain the count to visitors, and remove a job's visitor records when the job is deleted.

## [x] Tracked sources and automatic collection
- The admin can add, edit, delete, activate/deactivate and run sources of types RSS, JSON API, career/static page, and web scraping when necessary; view collection errors and counts of new jobs found; and configure scheduled scanning.
- For active sources, the system opens each source, finds new jobs and extracts title, company, description, responsibilities, qualifications, location, deadline, how to apply, link and logo/image where available; checks duplicates; and sends results to pending review. Missing source information stays missing. **Never publish automatically.**

## [x] Duplicate detection and pending review
- Duplicate checks consider title, company, application link and description. Possible duplicates are flagged for administrator review.
- The admin can review automatically collected jobs, edit or reject them, or explicitly **APPROVE & PUBLISH**. Only approval/publishing makes the complete approved job immediately visible on the public Get Mchongo site.

## [x] Secure persistent data and intentionally narrow scope
- Jobs, companies, sources, pending jobs, likes and saves are stored persistently and securely.
- Keep the platform simple: do not add employer registration, candidate databases, payments or unnecessary recruitment features.

> Scheduled Heartbeat callbacks target the published website. The admin screen explains this; “Run now” works in Preview, and recurring runs begin only after a successful publication and schedule activation.

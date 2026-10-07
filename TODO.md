# Get Mchongo — Delivery Outcomes

## [x] Public opportunity discovery and job details
- Visitors can browse **published** jobs/opportunities; search/filter by title, category and location; open a job detail; view company logo and company profile; like, save and share jobs; and apply through the original application link.
- Each job page shows, when available: job title; company/institution; company description; logo/image; location; deadline; job description; brief responsibilities; brief qualifications/requirements; how to apply; and application link. **Never invent missing information.**

## [x] Protected administrator and manual listings
- A protected admin dashboard accepts the requested administrator login email `frontlinertech@gmail.com`. The provided password stays in protected environment storage; no administrator password is stored in source or a public bundle.
- The admin can add jobs manually; edit/delete/publish/unpublish jobs; upload and preview logos/images; and manage company profiles.

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

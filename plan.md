# Get Mchongo — Implementation Plan

## Product direction

A mobile-first Tanzanian jobs and opportunities board with a clear separation between public discovery and protected administration. The only public listings are explicitly published records. Source-collected listings always enter a review queue; incomplete fields remain blank, the source URL is retained separately, and an application link is shown only when provided by the source.

## Design

- **Design movement:** contemporary East African editorial utility—approachable civic-tech with the clarity of a carefully edited opportunities journal.
- **Core principles:** source-first trust; quick filtering and direct application; calm readability; responsive layouts that privilege the job information rather than decoration.
- **Color philosophy:** warm ivory for a humane reading surface, inky charcoal for dependable contrast, and an ownable coastal green for progress and primary actions; a restrained marigold accent marks timely or newly reviewed opportunities without implying information that is not present.
- **Layout paradigm:** left-aligned editorial masthead and asymmetric hero/search band followed by a flexible opportunity feed; a desktop search/filter bar becomes compact stacked controls on phones. Job detail pages put application actions alongside the listing and then flow through the source information.
- **Signature elements:** a rising-path/sun mark integrated into the wordmark; slim deadline/availability rails; compact location and category chips.
- **Interaction philosophy:** search and filters respond immediately; cards have clear focus and click targets; like/save/share give direct, reversible feedback; admin status actions make pending, published, inactive and duplicate states explicit.
- **Animation:** brief, subtle card and button transitions; no essential content depends on motion; honor reduced-motion preferences.
- **Typography:** Newsreader for display headlines with a serif fallback, paired with DM Sans for navigation, forms and body text with system fallbacks. Use clear size/weight hierarchy and comfortably readable line lengths.
- **Brand essence:** a trusted, no-noise place for Tanzanian opportunities and the original application path; **clear, grounded, optimistic**.
- **Brand voice:** direct, encouraging and specific. Example lines: “Make your next move.” “Real opportunities. Original application links.”
- **Wordmark & logo:** a distinctive compact green rising-route/sun glyph paired with the “Get Mchongo” wordmark, not a default text-only logo.
- **Signature brand color:** coastal green `#12664F`.

## Implementation approach

- Extend the initialized React/TypeScript, Express and Drizzle/MySQL project. Use the managed database for jobs, company profiles, sources, pending review records, public reactions and scan schedule state.
- Build public `/`, `/jobs/:id`, and `/companies/:id` views. Public queries return published jobs only. Search covers job title and company text; category and location are filters. Details render only stored/source-verified values, offer an application link only when the source provides one, and retain the original source URL separately.
- Add a dedicated `/admin` surface backed by server-verified email/password login and a signed, HTTP-only application cookie. The provided password is kept only in protected environment storage. Server endpoints for job, company, source, upload and review operations require the admin session. Do not depend on Manus OAuth or treat a client flag as authentication.
- Keep admin capabilities narrow: manual jobs, company records, tracked sources, collected-job review, duplicate warnings, upload preview, publish/unpublish and deletion. Avoid employer/candidate accounts, payments and unrelated hiring features.
- Store companies separately and allow a job to retain its source-supplied company name even when no company profile has been created. Represent collected candidates in a separate pending-review table so approval creates/updates the public record explicitly.
- Support RSS/Atom, JSON feeds with administrator-configurable item/field paths, and static career pages. Parse XML/HTML/JSON with bounded response size and timeouts. For static pages, prefer Schema.org JobPosting/JSON-LD, metadata and explicit labeled sections; do not fabricate values. Only send candidates to the pending queue.
- Validate source URLs/redirects against private and local network targets, constrain response size/time and uploads, and record collection errors/run counts. Evaluate possible duplicate matches using normalized title, company, application URL and description similarity; flag rather than silently suppress matches.
- Implement scheduled scanning through the documented Heartbeat management API and authenticated `/api/scheduled/...` callback. Verify the signed platform callback, resolve its task identity, match it to the persisted scan-schedule row, and make runs idempotent. Scheduling can be configured by the admin; automatic scans must never publish.
- Use the platform's durable storage presign API for administrator image uploads and save stable `/manus-storage/...` asset paths in the database. Keep API credentials on the server.
- Keep React routes and server code modular, maintain the route manifest, add the additive MySQL migration, and keep secrets out of source, migrations, logs and public bundles.

## Project structure

- `client/src/App.tsx` — public and admin route composition.
- `client/src/pages/` — public job feed/detail/company views and the protected admin login/dashboard.
- `client/src/components/` — brand header, search/filters, job cards, detail sections, status labels and admin forms.
- `client/src/index.css`, `client/index.html` — responsive visual system and Get Mchongo page metadata.
- `public/manus-routes.json` — all public/admin page route patterns for the website.
- `server/_core/index.ts` — Express app startup and API mount points.
- `server/getmchongo/` — authentication, public API, admin CRUD, upload handling, source collection, duplicate detection and scheduled callback services.
- `drizzle/schema.ts`, `drizzle/migrations/` — relational tables and additive migration.

## Data and user-visible behavior

- Jobs hold title, company relation/label, category, location, deadline, description, responsibilities, qualifications, instructions, original application URL, image/logo, source metadata, status and timestamps.
- Companies hold name, description, logo/image, website and location.
- Sources hold type, URL, extraction configuration, active flag, schedule-related state, last run time, count and most recent error.
- Pending jobs hold all extracted fields, source/raw context, duplicate reasons and pending/approved/rejected status.
- Reactions hold job, anonymous browser token, and like/save kind; no candidate or user directory is introduced.
- No sample jobs are seeded. A new installation displays a helpful empty state until an administrator adds or approves a real listing.

## Serving and constraints

The Express process serves the React application and API on the configured port. The managed server/database were enabled during initialization. Public pages remain readable without an account. All administrative state changes and file uploads are server-authorized. Any collected record remains private to the review queue until the administrator explicitly approves and publishes it. The initial handoff is a preview unless a later user instruction authorizes public deployment.

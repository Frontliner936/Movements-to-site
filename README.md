# Get Mchongo

Get Mchongo is a React / Express / Drizzle job and opportunity site with a MySQL database, a local admin dashboard, source collection/review, uploads, and English/Kiswahili job-ad processing. The public pages, custom admin login, database, source collector, and review flow run in this repository; the deployed app does not need a Manus account or an OpenAI/API credential.

## Run locally

- Install Node.js 22 and `pnpm`.
- Set `DATABASE_URL` and `ADMIN_PASSWORD` in `.env`.
- Install local OCR tools on Debian/Ubuntu: `sudo apt-get install tesseract-ocr tesseract-ocr-eng tesseract-ocr-swa poppler-utils`.
- Set up the CPU-only offline English↔Kiswahili translator (the production Docker image does this automatically):

  ```sh
  python3 -m venv .venv
  .venv/bin/pip install --no-deps argostranslate==1.11.0 ctranslate2==4.8.2 minisbd==0.9.5
  .venv/bin/pip install packaging 'sacremoses>=0.0.53,<0.2' 'sentencepiece>=0.2,<0.3' numpy pyyaml onnxruntime filelock requests
  export PATH="$PWD/.venv/bin:$PATH"
  export ARGOS_PACKAGES_DIR="$PWD/.argos-packages" ARGOS_DEVICE_TYPE=cpu
  python3 server/getmchongo/install-translation-models.py
  ```

- Run `pnpm db:migrate` to apply pending schema migrations to the configured database. Keep the existing `DATABASE_URL` when preserving the current site's records; do not point it at a newly initialized database.
- Run `pnpm dev`.
- Run `pnpm check`, `pnpm test`, and `pnpm build` for validation.

## Railway deployment

1. In Railway, connect the GitHub repository `Frontliner936/Movements-to-site` to the existing web service and deploy the updated `main` branch. The repository's Dockerfile builds the app and listens on Railway's `PORT`. It also installs the OCR tools and downloads the offline translation models into the image; the first build after this change may take longer.
2. **Keep the existing MySQL database and its `DATABASE_URL` unchanged** so published jobs, announcements, company records, users, and admin content remain connected. If using a Railway MySQL service, set the web service's `DATABASE_URL` to a reference to that database's connection variable.
3. In the web service's **Settings → Volumes**, create/attach a persistent Volume and set its mount path to `/data`. Railway supplies `RAILWAY_VOLUME_MOUNT_PATH` automatically; the app writes uploaded files under `<mount path>/uploads`. Alternatively set `UPLOAD_DIR=/data/uploads` explicitly. Do not point uploads at the container's ordinary `/app` filesystem.
4. In the web service's **Variables** tab, keep `ADMIN_PASSWORD` (a strong private password for `/admin/login`), the existing `DATABASE_URL`, and optionally `PUBLIC_SITE_ORIGIN` (your public HTTPS domain for stable job-share previews). **No OpenAI key, OCR key, or translation API key is required.** The new app no longer reads `OPENAI_API_KEY`, `OPENAI_MODEL`, or `OPENAI_API_BASE`; those old variables may be removed from Railway if you added them previously.
5. New visitor-location analytics create their single additive aggregate table automatically on first use, using the existing database connection. No manual Railway shell command is required for this feature. The SQL migration remains available for environments that apply migrations as part of their deployment process.
6. Deploy the updated Docker image, then check `https://<your-domain>/api/health`, log in to the admin dashboard, and test an image, a text PDF, a scanned PDF, and an English↔Kiswahili import. Review all extracted and translated fields before saving or publishing.
7. Scheduled source collection runs within the app process using the existing admin schedule (East Africa Time). Leave one web-service replica running so a schedule slot is not processed by multiple app replicas. No Railway Cron service or Manus Heartbeat credentials are needed.

## Job-ad import behavior

- Photos and scanned PDF pages are read on the app server by [Tesseract OCR](https://github.com/tesseract-ocr/tesseract); PDF pages are rendered locally by Poppler. Text-based PDFs are read directly first. Uploads are temporary for the import request and are not attached to a public job listing.
- Clearly labeled job fields and sections are extracted with conservative rules; missing or unclear facts are left blank rather than invented. Responsibilities and qualifications are stored as bullet items. The result is an editable draft.
- Optional English↔Kiswahili translation uses local [Argos Translate](https://github.com/argosopentech/argos-translate) model packages baked into the Docker image; the request does not call OpenAI or a remote translation API. The models are downloaded during image build from the [Argos package index](https://www.argosopentech.com/argospm/index/).
- Offline translation and OCR can make mistakes. Review names, dates, amounts, eligibility requirements, contact details, and every translated field against the original advert. If source language cannot be identified confidently, text is left unchanged and a review note is shown.
- Job details display responsibilities and qualifications as readable lists. Email addresses, phone numbers, and web links in job text are clickable.

## Media, database, and schedules

- New uploads go directly to the persistent Railway Volume. The legacy `/manus-storage/` URL prefix is intentionally retained so database image URL fields and schema do not need to change; those requests are served from this app's local storage.
- Remote roles are marked explicitly in the admin job editor. The public `/remote-jobs` page shows published listings with this flag. Before deploying code that uses a new schema migration, apply the additive SQL migration to the existing Railway MySQL database (or run the configured Drizzle migrations against that same database); existing jobs default to non-remote.
- Homepage reach is recorded once per browser per day using the existing `gm_site_metrics` aggregate table, so no additional Railway database table or migration is needed when that existing site-metrics table is already installed.
- Automatic source scans are started by the web app itself; saving the schedule no longer calls Manus Heartbeat.
- The two homepage hero/workplace photos that previously used Manus-only storage now use existing workplace photos already used elsewhere on the page.

## Existing files that were previously stored remotely

A GitHub repository does not contain uploaded media or the contents of a remote storage bucket. Newly uploaded files will persist on the Railway Volume, but old database rows that point to files existing only in the former Manus storage will need those original files copied into the new Volume before they can render. Put each legacy object at the same relative key beneath `<volume mount>/uploads` (for example `get-mchongo/uploads/<filename>`), and keep its stored URL path unchanged. If the old storage is no longer accessible and no exported copy exists, those remote-only binaries cannot be recovered from this source repository alone. The MySQL records themselves remain untouched when you keep the existing database.

## Visitor member accounts

- Visitor accounts use the existing MySQL connection in `DATABASE_URL`; this repository does not read `SUPABASE_DATABASE_URL` and does not switch the live site to Supabase.
- Before enabling member signup, set a separate `MEMBER_SESSION_SECRET` in the Railway web service to a unique random value of at least 32 characters. Generate one locally with `openssl rand -base64 48`; paste the output directly into Railway Variables and do not commit or share it.
- Apply `drizzle/0009_member_accounts.sql` to the same existing MySQL database if member accounts are not already installed. It creates only `gm_member_accounts` and `gm_member_favorites` and does not replace existing job or administrator tables.
- Before deploying private profiles and uploaded CVs, apply the additive `drizzle/0010_member_professional_profiles.sql` migration to that same MySQL database. It adds `gm_member_profiles` with a private CV column and a foreign key to member accounts; it does not alter existing job or admin tables.
- Member passwords are stored as salted scrypt hashes. Professional profiles (full name, phone, location, profession and optional CV) are private by default. Only accounts that explicitly opt into the talent directory appear in the protected admin Members view; no public profile links or recruiter login are provided. Members can withdraw consent or remove their profile CV.
- New account passwords must be 6–128 characters and include at least one uppercase letter, one lowercase letter and one symbol; a number is optional.
- Job alerts appear inside the member dashboard for matching published jobs from the recent period. No transactional email provider is configured, so this feature does not send alert emails. CV matching accepts PDF, DOC, DOCX, TXT and RTF files up to 5 MB, extracts text in memory, does not persist the match-check upload or text, and returns a transparent keyword/structure estimate rather than a hiring guarantee. Uploaded profile CVs are stored privately in MySQL and are available only to the administrator while the member has opted in.

## Configuration reference

See `.env.example`. `MANUS_API_URL`, `MANUS_API_KEY`, Manus OAuth settings, OpenAI credentials, and translation-provider credentials are not required for this app's public/admin flows, uploads, job-ad import, or source schedules.

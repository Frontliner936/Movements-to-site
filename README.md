# Get Mchongo

Get Mchongo is a React / Express / Drizzle job and opportunity site with a MySQL database, a local admin dashboard, source collection/review, uploads, and English/Kiswahili job-ad processing. The public pages, custom admin login, database, source collector, and review flow run in this repository; the deployed app does not need a Manus account or Manus API credentials.

## Run locally

- `pnpm install`
- Set `DATABASE_URL` and `ADMIN_PASSWORD` in `.env`.
- Set `OPENAI_API_KEY` to enable photo/PDF job-ad extraction and translation (the standard OpenAI endpoint is used by default).
- `pnpm db:migrate` if initializing a new database; **do not initialize a new database when you need the current site's existing records**.
- `pnpm dev`
- `pnpm check`, `pnpm test`, and `pnpm build` for validation.

## Railway deployment

1. In Railway, connect the GitHub repository `Frontliner936/Movements-to-site` to the existing web service and deploy the updated `main` branch. The repository's Dockerfile builds the app and listens on Railway's `PORT`.
2. **Keep the existing MySQL database and its `DATABASE_URL` unchanged** so published jobs, announcements, company records, users, and admin content remain connected. If using a Railway MySQL service, set the web service's `DATABASE_URL` to a reference to that database's connection variable.
3. In the web service's **Settings → Volumes**, create/attach a persistent Volume and set its mount path to `/data`. Railway supplies `RAILWAY_VOLUME_MOUNT_PATH` automatically; the app writes uploaded files under `<mount path>/uploads`. Alternatively set `UPLOAD_DIR=/data/uploads` explicitly. Do not point uploads at the container's ordinary `/app` filesystem.
4. In the web service's **Variables** tab, set:
   - `ADMIN_PASSWORD` — a strong private password for `/admin/login` (the admin email is `frontlinertech@gmail.com`).
   - `OPENAI_API_KEY` — your provider key, kept server-side as a Railway secret. Without this, public browsing/admin/uploads still work, but AI structuring/translation will return a clear configuration error.
   - `DATABASE_URL` — the existing MySQL connection string.
   - Optional: `OPENAI_MODEL` (default `gpt-4o-mini`), `OPENAI_API_BASE` (defaults to `https://api.openai.com/v1`), and `PUBLIC_SITE_ORIGIN` (recommended: your public HTTPS domain for stable job-share previews; Railway HTTPS forwarded headers are used if it is unset).
5. Review Railway's staged variable changes and deploy them. Check `https://<your-domain>/api/health`, then verify the public site and log into the admin dashboard. Upload a test logo or announcement image, redeploy once, and confirm it still loads.
6. Scheduled source collection now runs within the app process using the existing admin schedule (East Africa Time). Leave one web-service replica running so a schedule slot is not processed by multiple app replicas. No Railway Cron service or Manus Heartbeat credentials are needed.

## What changed for Manus independence

- Job-ad imports send photos directly to an OpenAI-compatible chat-completions endpoint and use structured JSON output. PDFs are text-extracted in the app before structuring; scanned/image-only PDFs should be submitted as a photo or OCR-readable image. Output can stay in the source language or be translated to English/Kiswahili.
- New uploads go directly to the persistent Railway Volume. The legacy `/manus-storage/` URL prefix is intentionally retained so database image URL fields and schema do not need to change; those requests are served from this app's local storage.
- Automatic source scans are started by the web app itself; saving the schedule no longer calls Manus Heartbeat.
- The two homepage hero/workplace photos that previously used Manus-only storage now use existing workplace photos already used elsewhere on the page.

## Existing files that were previously stored remotely

A GitHub repository does not contain uploaded media or the contents of a remote storage bucket. Newly uploaded files will persist on the Railway Volume, but old database rows that point to files existing only in the former Manus storage will need those original files copied into the new Volume before they can render. Put each legacy object at the same relative key beneath `<volume mount>/uploads` (for example `get-mchongo/uploads/<filename>`), and keep its stored URL path unchanged. If the old storage is no longer accessible and no exported copy exists, those remote-only binaries cannot be recovered from this source repository alone. The MySQL records themselves remain untouched when you keep the existing database.

## Configuration reference

See `.env.example`. `MANUS_API_URL`, `MANUS_API_KEY`, and Manus OAuth settings are not required for this app's public/admin flows, media uploads, AI imports, or source schedules.

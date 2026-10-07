# Get Mchongo

React / Express / tRPC / Drizzle starter, adapted from the Sandbox web-db-user template.

- `pnpm dev`: development server; honors `PORT` (default 3000).
- `pnpm build` / `pnpm start`: build and serve `dist/index.js` and `dist/public/`.
- `pnpm db:migrate`: apply checked-in migrations. `pnpm db:push`: generate and apply new schema changes.
- `pnpm check` / `pnpm test`: types and application tests.

Start with the Webdev skill's default-template guide. Platform login, storage, payments and service contracts live in its shared references; read the relevant capability before extending its helper.

`server/_core/publicConfig.ts` exposes only named public runtime values. Private keys stay server-side. The platform serves managed `/manus-storage/` assets; the application does not register a second proxy.

## Supabase Auth

The app keeps its existing MySQL/Drizzle database and uses Supabase Auth for account sign-in and the admin dashboard. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the build and runtime environment. The publishable key is designed for client use; never put a Supabase secret or `service_role` key in the browser or repository.

Enable Supabase Email authentication and email confirmation. Set the Supabase Auth Site URL and allowed redirect URLs to the deployed site's origin. Users can register or sign in at `/account`. The admin dashboard at `/admin/login` accepts only the verified `frontlinertech@gmail.com` account; sign up for that address, confirm it by email, then use Supabase Auth to sign in. The existing `ADMIN_PASSWORD` login is no longer used.

Platform configuration is readable and editable through `webdev.config`. Default settings are initial values, not enforced constraints. The agent may modify the files, commands and configuration or follow the flexible guide for another stack.

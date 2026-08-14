# AGENTS.md

## Cursor Cloud specific instructions

This repo is a single **Next.js 15** (App Router, React 19, TypeScript, Turbopack) app — internal name `kcw-v2`, an internal ERP/BI back-office for the KCW business (UI is mostly Thai). There is one `package.json` at the repo root; package manager is **npm** (`package-lock.json`). Standard scripts (`dev`, `build`, `start`, `lint`, `test`) live in `package.json` — run them as documented there. Shared data dictionaries: [kcw-docs/dictionaries](https://github.com/pthengtr/kcw-docs/blob/main/dictionaries/README.md).

### Services

- **Next.js dev server** — `npm run dev` (Turbopack) on http://localhost:3000. This is the whole product (UI + API routes + server actions).
- **Supabase (hosted)** — the only backend: Postgres + Auth + Storage + `fn_bi_*` RPCs. There is **no** local Supabase/Docker stack and no `supabase/config.toml` in this repo; the schema/RPCs/tables are managed externally, so a fresh local Supabase will not satisfy the app. The app talks to a pre-provisioned hosted project and **500s on every request** (even `/login`) if the Supabase env vars are missing — `src/lib/supabase/middleware.tsx` builds a Supabase client on every request.
- **OpenAI** — optional, used only by the Knowledge Base (`/kb`) embedding feature (`OPENAI_API_KEY`, `KB_EMBEDDING_MODEL`, `KB_EMBEDDING_DIMENSIONS`).
- **Windows PC workers (HQ-PC / SYP-PC)** — external `kcw-api` project that polls `ops.job_queue`; not runnable in this environment. Sync buttons (inventory / PO / image) enqueue jobs that stay pending here. Bank statement Excel upload goes through the `import-bank-statement` Edge Function (no PC worker). All read-only views still work. Bank-statement matching is done outside the app via chat agents (see `prompts/bank-statement-match-*.md`).

### Required environment variables (secrets)

The code reads these exact names (no `.env.local` bridging is needed — inject them as Cloud Agent secrets so they land in `process.env`; Next.js dev inlines `NEXT_PUBLIC_*` for the browser bundle from `process.env`):

- `NEXT_PUBLIC_SUPABASE_URL` — hosted Supabase project URL (browser/server/middleware clients).
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (auth + user-scoped queries).
- `SUPABASE_SERVICE_KEY` — service-role key; `src/lib/supabase/admin.ts` throws without it. Powers BI/PO/bank/RBAC/KB privileged RPCs (the `ops`/curated schemas are not exposed via PostgREST).
- `NEXT_PUBLIC_LINE_LIFF_PRODUCT_SCANNER_ID` — optional; LIFF ID for `/liff/scan-product` (LINE chatbot scanner). Browser-safe only.

`admin.ts` also accepts fallbacks `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, but the browser Supabase client only reads the `NEXT_PUBLIC_*` names, so those two must be set with the `NEXT_PUBLIC_` prefix.

### Auth / RBAC (how to reach a page)

- Unauthenticated requests to any non-public path redirect to `/login` (public prefixes: `/login`, `/auth`, `/error`, `/no-access`, `/liff`). Login is Supabase email/password.
- **`/liff/*`** is public to Supabase on purpose (LINE WebView). It must not require a second KCW login. Product authorization stays in **kcw-api** LINE webhook / `ops.line_access`. See `docs/liff-product-scan.md`.
- **Layer 1:** a signed-in user must have ≥1 row in `public.kcw_user_roles`, else they are redirected to `/no-access`. A DB trigger (`trg_kcw_assign_default_role`) auto-grants the `normal` role on new signup, so a freshly created Auth user can immediately reach the home menu.
- **Layer 2:** per-page permission checks (`src/lib/auth/`, `kcw_role_page_permissions`); the `admin` role bypasses page checks. Admin-only areas (e.g. `/admin/rbac`, BI dashboards) need the `admin` role.
- The hosted DB holds **real business data** — prefer read-only flows when testing; do not mutate production tables.

### Provisioning a test login (needs `SUPABASE_SERVICE_KEY`)

Create/confirm a throwaway Auth user with the service-role key and (optionally) grant `admin`. Run from the repo root so `@supabase/supabase-js` resolves; do not commit the script or any password.

```js
// node ./tmp-provision.mjs   (delete after use; do not commit)
import { createClient } from '@supabase/supabase-js';
const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);
const email = 'cursor.agent.test@kcw-dev.local';
const password = process.env.TEST_PW; // pass a fresh password via env, never hard-code
const { data } = await s.auth.admin.listUsers({ page: 1, perPage: 1000 });
const existing = data.users.find(u => u.email === email);
const id = existing
  ? (await s.auth.admin.updateUserById(existing.id, { password, email_confirm: true })).data.user.id
  : (await s.auth.admin.createUser({ email, password, email_confirm: true })).data.user.id;
// trigger grants 'normal'; upsert 'admin' for full access:
await s.from('kcw_user_roles').upsert({ user_id: id, role_key: 'admin' });
```

### Notes / gotchas

- **Malformed secret values:** if Supabase requests fail with `Invalid URL` or `Your project's URL and Key are required`, check that the injected secret *values* did not accidentally include the `NAME=` prefix (e.g. a value of `NEXT_PUBLIC_SUPABASE_URL=https://...` instead of just `https://...`). The correct fix is to re-enter the secret values without the leading `NAME=`. As a stopgap you can strip it at the shell before starting the server, e.g. `export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL#NEXT_PUBLIC_SUPABASE_URL=}"` (same for the anon key). `SUPABASE_SERVICE_KEY` is a JWT starting with `eyJ` and is easy to sanity-check.
- `next.config.ts` hard-codes the Supabase Storage hostname `jdzitzsucntqbjvwiwxm.supabase.co` for `next/image`; the provisioned `NEXT_PUBLIC_SUPABASE_URL` should point at that same project.
- `npm run build` runs static prerendering and **fails without Supabase env** (some pages instantiate Supabase at build time). For dev, `npm run dev` is what matters; provide the env vars before `build`.
- Known pre-existing test failure on `master`: `src/lib/webapp-mobile.test.ts` asserts `src/components/nav/NavbarClient.tsx` contains `md:hidden` / `hidden md:flex`, but the navbar now uses `lg:` breakpoints. This is a stale assertion in the repo, unrelated to environment setup (113/114 tests pass).

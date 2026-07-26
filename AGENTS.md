# AGENTS.md

## Cursor Cloud specific instructions

This is a single Next.js 15 (App Router, React 19, TypeScript) app — internal name `kcw-v2`, an internal ERP/BI back-office for the KCW auto-parts business. There is one `package.json` at the repo root. Package manager is **npm** (`package-lock.json`). Standard scripts live in `package.json` (`dev`, `build`, `start`, `lint`, `test`); run them as documented there.

### Services

- **Next.js dev server** — `npm run dev` (Turbopack) on http://localhost:3000. This is the whole product (UI + API routes + server actions).
- **Supabase (hosted)** — the only backend. Postgres + Auth + Storage + `fn_bi_*` RPCs. There is no local Supabase/Docker stack in this repo; the app talks to a hosted project. The app crashes at request time if Supabase env vars are missing.
- **OpenAI** — optional, used only by the Knowledge Base (`/kb`) embedding feature (`OPENAI_API_KEY`, `KB_EMBEDDING_MODEL`, `KB_EMBEDDING_DIMENSIONS`). Everything else runs without it.

### Environment variables (non-obvious secret-name mapping)

The code reads `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_KEY`, but the Cloud Agent secrets are injected under **different** names: `SUPABASE_URL`, `SUPABASE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. The startup update script bridges this by writing a `.env.local` (git-ignored) that maps them via `${...}` references (Next.js expands these from `process.env` via dotenv-expand — no secret values are written to disk). If the dev server reports missing Supabase env, confirm `.env.local` exists with those three mappings.

### Auth / testing the authenticated app

- Unauthenticated requests to any non-`/login`, non-`/api`, non-`/auth`, non-`/error` path redirect to `/login` (see `src/lib/supabase/middleware.tsx`). Login is Supabase email/password (`src/app/(auth)/action.tsx`).
- Admin-gated features (all `/bi/*` dashboards and several `/api/bank/*`, `/api/bi/*` routes) additionally require the logged-in user's email to exist in the `kcw_admin` table (`user_id` = email); see `src/lib/auth/requireAdmin.ts`. Plain authentication is enough for the home menu and most non-BI modules.
- The hosted DB contains **real business data** — avoid creating/mutating records in production tables during testing; prefer read-only flows (e.g. viewing a BI report).
- To test end-to-end, provision a test user with the service-role key (do not commit passwords). Example (run from the repo root so `@supabase/supabase-js` resolves):

  ```js
  // node ./tmp-provision.mjs   (delete after use; do not commit)
  import { createClient } from '@supabase/supabase-js';
  const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const email = 'cursor.agent.test@kcw-dev.local';
  const password = process.env.TEST_PW; // pass a fresh password via env
  const { data } = await s.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = data.users.find(u => u.email === email);
  if (existing) await s.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
  else await s.auth.admin.createUser({ email, password, email_confirm: true });
  await s.from('kcw_admin').upsert({ user_id: email }); // grants BI/admin access
  ```

  A test account `cursor.agent.test@kcw-dev.local` already exists and is in `kcw_admin`; reset its password with the snippet above (via `updateUserById`) when you need to log in.

### Notes

- `next.config.ts` hard-codes the Supabase storage hostname `jdzitzsucntqbjvwiwxm.supabase.co` for `next/image`; the injected `SUPABASE_URL` points at the same project.
- `npm run lint` currently emits one pre-existing `react-hooks/exhaustive-deps` warning in `src/components/reminder/ReminderTable.tsx` (not an error).

# Bank statement web upload (kcw-v2)

Thin UI for KBANK / KTB Excel statements. Parsing and privileged `bank.*` writes live in the Supabase Edge Function `import-bank-statement` (kcw-analytics) — do not reimplement SheetJS / fingerprints here.

Upstream contract: [kcw-analytics `docs/bank_statement_upload.md`](https://github.com/pthengtr/kcw-analytics/blob/main/docs/bank_statement_upload.md).

## UI

- Page: `/bank-statement-sync` (`BankStatementSyncPage`)
- Dialog: `StatementUploadDialog` → `invokeBankStatementImport` in `src/lib/bank/statement-upload.ts`
- Auth: signed-in user; Edge Function requires email in `public.kcw_admin`
- RBAC page key: `bank_statement_sync` (unchanged)

```ts
const form = new FormData();
form.append("file", file); // .xlsx / .xls / .xlsm
form.append("bank_name", "KBANK"); // or "KTB"

const { data, error } = await supabase.functions.invoke(
  "import-bank-statement",
  { body: form }
);
```

Do **not** set `Content-Type` manually when using `FormData`.

## Removed

The former **Bank Sync** worker trigger (`POST /api/bank/sync`, poll `/api/bank/sync/:jobId`, `/api/bank/meta`, `src/lib/bank/worker-jobs.ts`) is removed. Daily HQ Drive BAT may still run offline; web uploads use Storage `bank-statements`.

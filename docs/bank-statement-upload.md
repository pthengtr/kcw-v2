# Bank statement web upload + report (kcw-v2)

Thin UI for KBANK / KTB Excel statements and the monthly match report. Privileged `bank.*` / Storage work lives in Supabase Edge Functions — do not reimplement parsers or Excel layout here.

**Import Edge Function (source of truth in this repo):** [`supabase/functions/import-bank-statement/`](../supabase/functions/import-bank-statement/) — `parser_version: auto_v2` (fingerprint = account + date + amount + direction + stable detail + bank_reference + balance_after; display description excluded). Auth: RBAC page `bank_statement_sync` (or `admin`).

Upstream notes / Drive BAT: [kcw-analytics `docs/bank_statement_upload.md`](https://github.com/pthengtr/kcw-analytics/blob/main/docs/bank_statement_upload.md). The HQ Drive notebook path in kcw-analytics is still **`auto_v1`** until that repo is updated to the same fingerprint identity — overlapping monthly/cumulative Excel files can still double-insert via BAT even though web upload is `auto_v2`.

Report layout parity: [kcw-analytics `src/kcw/bank_statement_report.py`](https://github.com/pthengtr/kcw-analytics/blob/main/src/kcw/bank_statement_report.py).

## UI

- Page: `/bank-statement-sync` (`BankStatementSyncPage`)
- Upload dialog: `StatementUploadDialog` → `invokeBankStatementImport` in `src/lib/bank/statement-upload.ts`
- Report dialog: `StatementReportDialog` → `invokeBankStatementReport` in `src/lib/bank/statement-report.ts`
- Auth: signed-in user with RBAC page `bank_statement_sync` (or `admin` role)
- RBAC page key: `bank_statement_sync` (unchanged)

### Upload

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

### Monthly report (Storage only)

```ts
const { data, error } = await supabase.functions.invoke(
  "generate-bank-statement-report",
  { body: { year: 2026, month: 7 } } // omit → Bangkok today − 10 days
);
// data.signed_url → browser download; object at
// bank-statements/reports/{year}/{mm}/bank_statement_report_{year}_{mm}.xlsx
```

Source of the Edge Function: [`supabase/functions/generate-bank-statement-report/`](../supabase/functions/generate-bank-statement-report/) (Deno; excluded from the Next.js `tsconfig` so `npm:` imports are not typechecked by `next build`).  
No Google Drive write — operators download from the signed URL (or Storage path under the private `bank-statements` bucket).

## Removed

The former **Bank Sync** worker trigger (`POST /api/bank/sync`, poll `/api/bank/sync/:jobId`, `/api/bank/meta`, `src/lib/bank/worker-jobs.ts`) is removed. Daily HQ Drive BAT may still run offline for imports; web uploads and the match **report** use Storage `bank-statements`.

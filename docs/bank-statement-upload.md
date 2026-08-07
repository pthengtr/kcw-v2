# Bank statement web upload + report (kcw-v2)

Thin UI for KBANK / KTB Excel statements and the monthly match report. Privileged `bank.*` / Storage work lives in Supabase Edge Functions — do not reimplement parsers or Excel layout here.

**Import Edge Function (source of truth in this repo):** [`supabase/functions/import-bank-statement/`](../supabase/functions/import-bank-statement/) — `parser_version: auto_v2`.

Fingerprint identity:

```
account | date | amount | direction | normalized_stable_detail | bank_reference | balance_after
```

Display description is excluded. KTB detail is normalized (strip trailing online transfer ids / `Tran:` / `Future Amount` noise) so old `DownLoadService` and new Thai Corporate Online exports of the same txn share one fingerprint.

**Auth**

- Web UI: signed-in user with RBAC page `bank_statement_sync` (or `admin`)
- HQ Drive bulk: service-role bearer (`raw_metadata.source = edge_drive_bulk`)

**KTB layouts supported**

| Sheet | Amount | Detail |
|-------|--------|--------|
| `DownLoadService` | signed `Amount` | `Description` |
| `Account_Statement_Report_TH_XLS` | signed `ถอนเงิน/ฝากเงิน` | `รายละเอียด` |

Upstream Drive BAT (thin uploader → this Edge Function): [kcw-analytics `docs/bank_statement_upload.md`](https://github.com/pthengtr/kcw-analytics/blob/main/docs/bank_statement_upload.md).

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
Rows with `match_status = ignored` (operator ไม่ใช้) are **omitted** from the Excel; response includes `ignored_skipped`.

## Idempotency / reimport

- Same file bytes → `statement_import_files.file_hash` skip.
- Same txn fingerprint → `upsert(..., ignoreDuplicates: true)` — **existing `match_*` fields are not overwritten**.
- Full-folder reimport only inserts new fingerprints as `pending`; matched work on existing rows is preserved.

## Removed

The former **Bank Sync** worker trigger (`POST /api/bank/sync`, poll `/api/bank/sync/:jobId`, `/api/bank/meta`, `src/lib/bank/worker-jobs.ts`) is removed. Daily HQ Drive BAT uploads via the Edge Function (service role); web uploads and the match **report** use Storage `bank-statements`.

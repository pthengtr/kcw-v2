# Worker jobs (Supabase queue)

PC background work is coordinated **only through Supabase**. LINE (`kcw-api`) and kcw-v2 (this webapp) both **enqueue by inserting into `ops.job_queue`**. Do not invent another queue or call a special job HTTP API.

**One-liner for kcw-v2:** always enqueue via `ops.job_queue` like LINE; use heartbeats to gate online workers; poll the same row for status.

---

## Flow

1. Client (LINE handler or kcw-v2 UI) inserts a row into `ops.job_queue` with `status='pending'`.
2. Windows workers (`HQ-PC`, `SYP-PC`) heartbeat into `ops.worker_heartbeat`.
3. Each worker claims the next pending job where `worker_name is null` **or** `worker_name` matches that PC.
4. Worker runs the local command from its `.env`: `WORKER_JOB_<JOB_TYPE>_COMMAND` (usually `worker_tasks\*.bat`).
5. Worker updates the same row to `done` / `failed` with `result_message` / `error_message`.

kcw-v2 only needs **steps 1 + status polling**. Pipeline/BAT code lives in analytic; worker process lives in **kcw-api** on the PCs.

```text
kcw-v2 / LINE  --insert-->  ops.job_queue (pending)
                                 ↑ claim
                    HQ-PC / SYP-PC workers (kcw-api)
                                 ↓
                            done | failed
kcw-v2  --poll same row-->  status UI
```

---

## Tables

### `ops.job_queue`

| Column | Type / values | Notes |
|--------|---------------|-------|
| `job_type` | text | snake_case key workers understand |
| `payload` | jsonb | e.g. `{ "task": "...", "site": "HQ" }` |
| `status` | `pending` → `running` → `done` \| `failed` | |
| `worker_name` | `'HQ-PC'` \| `'SYP-PC'` \| `null` | `null` = any PC may claim |
| `requested_by` | uuid / text | user id |
| `source` | `'line'` or `'web'` | use `'web'` from kcw-v2 |
| `requested_at` / `started_at` / `finished_at` | timestamptz | |
| `result_message` / `error_message` | text | set by worker |

### `ops.worker_heartbeat`

| Column | Notes |
|--------|-------|
| `worker_name` | `'HQ-PC'` or `'SYP-PC'` |
| `last_seen` | Treat as **online** if within ~**30s** |
| `status` | `idle` / `running` |

---

## How kcw-v2 enqueues (same rules as chat)

Before insert: **read heartbeats**; only enqueue if the required worker(s) are online.

Assignment patterns:

| Pattern | How |
|---------|-----|
| **One site** | One row, `worker_name='HQ-PC'` or `'SYP-PC'` |
| **Both sites** | Two rows (same logical batch), one per PC |
| **Either PC** | One row, `worker_name=null` |

Example insert:

```sql
insert into ops.job_queue (
  job_type, payload, status, worker_name, requested_by, source
) values (
  'bank_statement_import',
  '{"task":"bank_statement_import"}'::jsonb,
  'pending',
  'HQ-PC',
  '<user_id>',
  'web'
)
returning id, job_type, status, worker_name, requested_at;
```

Poll with `select ... from ops.job_queue where id = :id` until `done` / `failed`.

---

## Known `job_type`s (keep in sync with kcw-api chat)

| job_type | worker_name | payload notes |
|----------|-------------|----------------|
| `sync_inventory` | HQ-PC + SYP-PC (**2 jobs**, shared `batch_id`) | `{ "site": "HQ"\|"SYP", "batch_id" }` |
| `sync_product_images` | HQ-PC + SYP-PC | site + bucket/folder |
| `sync_online_sales` | HQ-PC | site HQ |
| `sync_pomas_podet` | HQ-PC + SYP-PC | `{ "task","site" }` |
| `sync_iclow` | HQ-PC + SYP-PC (**2 jobs**, shared `batch_id`) | `{ "task":"sync_iclow", "site":"HQ"\|"SYP", "batch_id" }` |
| `sync_po_related` | HQ-PC + SYP-PC (**2 jobs**, shared `batch_id`) | `{ "task":"sync_po_related", "site":"HQ"\|"SYP", "batch_id" }` — combined PO page refresh |
| `bank_statement_import` | HQ-PC | `{ "task":"bank_statement_import" }` — BAT: BRDET/BPDET + Drive statement Excel → `bank.statement_*` (web UI uses Edge Function instead; see below) |
| `syp_raw` | SYP-PC | `{ "task","site":"SYP" }` |
| `hq_raw` / `hq_full` | HQ-PC | `{ "task","site":"HQ" }` |

When adding a type here, update kcw-api LINE triggers the same way so chat and web stay aligned.

---

## When adding a new worker feature

1. **Analytic:** implement CLI + `worker_tasks/run_....bat`; set `WORKER_JOB_<TYPE>_COMMAND` on the PC(s).
2. **kcw-api:** add LINE trigger that inserts the same `job_type` / payload / assignment.
3. **kcw-v2:** add UI button that inserts the **same** row shape with `source='web'`, then show job status (poll `ops.job_queue`).

New features almost never need new queue tables — only new `job_type` values and matching BAT/env on workers.

### PO sync from `/po` (kcw-v2)

- **Primary UI button อัปเดตข้อมูล** uses `sync_po_related` — one click enqueues **two rows** (HQ-PC + SYP-PC) with shared `batch_id`.
- Payload: `{ "task":"sync_po_related", "site":"HQ"|"SYP", "batch_id":"<uuid>" }`.
- Worker BATs (kcw-analytics):
  - **HQ** [`run_hq_po_related_sync.bat`](https://github.com/pthengtr/kcw-analytics/blob/main/worker_tasks/run_hq_po_related_sync.bat): POMAS/PODET + ICLOW + **SIDET/SIMAS** (latest 6 months) → Drive + `raw_kcw`, then inventory on-hand qty.
  - **SYP** [`run_syp_po_related_sync.bat`](https://github.com/pthengtr/kcw-analytics/blob/main/worker_tasks/run_syp_po_related_sync.bat): POMAS/PODET + ICLOW → Drive + `raw_kcw`, then inventory (no sales Supabase upload).
- Pending-receive / ค้างรับ semantics: [bi/kcw-iclow-pending-receive-data-dictionary.md](./bi/kcw-iclow-pending-receive-data-dictionary.md) (from analytic `parts9_pending_receive`).
- Before insert: if any recent (`< 30 min`) `sync_po_related` is `pending`/`running`, return **already running**.
- Gate: at least one PC online (~30s); still enqueue both site jobs.
- UI keeps **per-stream last-updated** (PO HQ/SYP, ICLOW HQ/SYP, สต็อก HQ) so operators can see which side moved.
- Service-role RPCs: `fn_po_related_find_inflight_sync()`, `fn_po_related_enqueue_sync(p_requested_by)` — see [bi/sql/fn_po_related_sync_ops.sql](./bi/sql/fn_po_related_sync_ops.sql).
- Legacy single-site `sync_pomas_podet` RPCs remain for LINE/compat (`fn_po_enqueue_sync`) — see [bi/sql/fn_po_sync_ops.sql](./bi/sql/fn_po_sync_ops.sql).
- Open-PO indexes: [bi/sql/fn_po_list.sql](./bi/sql/fn_po_list.sql).

### Bank statement upload from `/bank-statement-sync` (kcw-v2) — **not** a PC worker job

- UI **อัปโหลด Statement** → browser calls Supabase Edge Function `import-bank-statement` with `FormData` (`file` + `bank_name` = `KBANK`|`KTB`).
- Parse + insert into `bank.statement_*` and Storage `bank-statements` live in **kcw-analytics** (same `auto_v1` heuristics as the Drive notebook). Contract: [kcw-analytics `docs/bank_statement_upload.md`](https://github.com/pthengtr/kcw-analytics/blob/main/docs/bank_statement_upload.md).
- Caller must be signed in with RBAC page `bank_statement_sync` (or `admin` role); kcw-v2 only provides the upload UI (`StatementUploadDialog`).
- Daily HQ BAT [`run_bank_statement_import.bat`](https://github.com/pthengtr/kcw-analytics/blob/main/worker_tasks/run_bank_statement_import.bat) can still run offline Drive drops + BRDET/BPDET; web uploads no longer enqueue `ops.job_queue`.
- Data dictionary: [bi/kcw-brdet-bpdet-cheque-transfers-data-dictionary.md](./bi/kcw-brdet-bpdet-cheque-transfers-data-dictionary.md).
- Legacy service-role RPCs `fn_bank_find_inflight_import` / `fn_bank_enqueue_import` remain for LINE/compat — see [bi/sql/fn_bank_sync_ops.sql](./bi/sql/fn_bank_sync_ops.sql) — but the kcw-v2 web button no longer uses them.

### Bank statement monthly report from `/bank-statement-sync` (kcw-v2) — **not** a PC worker job

- UI **สร้างรายงาน** → browser calls Supabase Edge Function `generate-bank-statement-report` with JSON `{ year, month }` (default = Bangkok today − 10 days).
- Builds the VAT-style multi-account Excel (one sheet per account, live `match_status` / reason columns) and uploads to Storage `bank-statements/reports/{year}/{mm}/…`; returns a signed download URL. **No Google Drive.**
- Source: [`supabase/functions/generate-bank-statement-report/`](../supabase/functions/generate-bank-statement-report/). Layout parity with kcw-analytics `bank_statement_report.py` / `run_bank_statement_report.bat` (Drive path optional/legacy).
- Auth: same RBAC gate as import (`bank_statement_sync` or `admin`). Client helper: `src/lib/bank/statement-report.ts` + `StatementReportDialog`.
- Docs: [bank-statement-upload.md](./bank-statement-upload.md).

### Inventory sync from `/po` (kcw-v2)

- Job: `sync_inventory` — **one button** enqueues **two rows** (HQ-PC + SYP-PC) with shared `batch_id`.
- Payload: `{ "site":"HQ"|"SYP", "batch_id":"<uuid>" }` (same shape as LINE/kcw-api).
- Before insert: if any recent (`< 30 min`) `sync_inventory` is `pending`/`running`, return **already running**.
- Gate: at least one PC online (~30s); still enqueue both site jobs.
- UI **Inventory Sync** → `POST /api/po/inventory-sync`, poll `GET /api/po/inventory-sync/:jobId` for each job; meta includes `inventory.hqLastUpdatedAt` + `inventory.inFlightJobs`.
- SYP PO line detail shows HQ on-hand from `curated_kcw.inventory_qty_latest` (`branch='HQ'`) next to ICMAS location — see [bi/sql/po_syp_prepare_line.sql](./bi/sql/po_syp_prepare_line.sql).
- Service-role RPCs: `fn_inventory_find_inflight_sync()`, `fn_inventory_enqueue_sync(p_requested_by)`, `fn_inventory_last_updated_at` — see [bi/sql/fn_inventory_sync_ops.sql](./bi/sql/fn_inventory_sync_ops.sql).

### ICLOW sync from `/po` (kcw-v2) — รอสั่งซื้อ / ค้างรับ

- Job: `sync_iclow` — **one button** enqueues **two rows** (HQ-PC + SYP-PC) with shared `batch_id` (same as LINE).
- Payload: `{ "task":"sync_iclow", "site":"HQ"|"SYP", "batch_id":"<uuid>" }`.
- Before insert: if any recent (`< 30 min`) `sync_iclow` is `pending`/`running`, return **already running**.
- Gate: at least one PC online (~30s); still enqueue both site jobs.
- UI **อัพเดตรอสั่งซื้อ/ค้างรับ** → `POST /api/po/iclow-sync`, poll `GET /api/po/iclow-sync/:jobId`; meta includes `iclow.hqLastIngestedAt` / `sypLastIngestedAt` + `iclow.inFlightJobs`.
- Service-role RPCs: `fn_iclow_find_inflight_sync()`, `fn_iclow_enqueue_sync(p_requested_by)`, `fn_iclow_last_ingested_at` — see [bi/sql/fn_iclow_sync_ops.sql](./bi/sql/fn_iclow_sync_ops.sql).

### Bank statement match — จับคู่ยอดเข้า (chat agents)

- **Not** a kcw-v2 UI / API trigger and **not** a `ops.job_queue` PC worker job. Matching is run by a chat agent (ChatGPT/Codex, Claude/Cowork, or similar) using the account prompts under [`prompts/`](../prompts/).
- Prompt sources (keys = `bank.statement_lines.account_no`, full numbers):
  - `064-8-91723-6` (ends 7236) inbound sales + outbound internal sweeps: [`prompts/bank-statement-match-7236.md`](../prompts/bank-statement-match-7236.md)
  - `141-1-72355-7` (ends 3557) outbound payments + inbound internal funding: [`prompts/bank-statement-match-3557.md`](../prompts/bank-statement-match-3557.md)
  - `064-8-92039-3` (ends 0393) SYP sales (3TR / 3TAR) + app expense PV: [`prompts/bank-statement-match-0393.md`](../prompts/bank-statement-match-0393.md)
  - `233-1-18475-9` (ends 4759) SYP OpEx (took over 0393 expense payments from Jul 2026): [`prompts/bank-statement-match-4759.md`](../prompts/bank-statement-match-4759.md)
  - `248-0-42113-9` (KTB / ends 1139) marketplace RVI: [`prompts/bank-statement-match-1139.md`](../prompts/bank-statement-match-1139.md)
  - `248-6-00618-4` payroll / expense cheques + inbound internal funding: [`prompts/bank-statement-match-6184.md`](../prompts/bank-statement-match-6184.md)
- Before running, fill placeholders `{{account_no}}` / `{{from}}` / `{{to}}` (or tell the chat agent the account + date range). Optional local Codex wrapper: [`worker_tasks/run_bank_statement_match.bat`](../worker_tasks/run_bank_statement_match.bat).
- Agent updates `bank.statement_lines` match_* fields only, and **only** rows with `match_status` in (`pending`, `unmatched`, `ignored`). Re-run rematches prior `unmatched` / `ignored` rows when source data catches up or when internal transfers should be upgraded to `matched`.
- Operator workflow in `/bank-statement-sync` Statement Lines: review results, edit reason/notes; `review` → `resolved`, leftovers → `manual`; CSV export from filters.
- Status SQL: [`bi/sql/alter_bank_statement_lines_match_workflow.sql`](./bi/sql/alter_bank_statement_lines_match_workflow.sql).

### Do / don’t

| Do | Don’t |
|----|--------|
| Insert into `ops.job_queue` | Invent a second queue table |
| Gate on `ops.worker_heartbeat` (~30s) | Call a custom “start job” HTTP API on the PC |
| Use same `job_type` + payload as LINE | Drift web vs chat payloads |
| Poll the queued row for status | Assume fire-and-forget without UI feedback |

---

## Related

- Purchase orders synced by `sync_pomas_podet` — see [bi/kcw-po-data-dictionary.md](./bi/kcw-po-data-dictionary.md)
- Pending receive / ICLOW — [bi/kcw-iclow-pending-receive-data-dictionary.md](./bi/kcw-iclow-pending-receive-data-dictionary.md)
- Cheque/transfer registers (BRDET/BPDET) — [bi/kcw-brdet-bpdet-cheque-transfers-data-dictionary.md](./bi/kcw-brdet-bpdet-cheque-transfers-data-dictionary.md)
- BI data docs — [bi/README.md](./bi/README.md)
- Analytic pipelines / BATs — [kcw-analytics](https://github.com/pthengtr/kcw-analytics)

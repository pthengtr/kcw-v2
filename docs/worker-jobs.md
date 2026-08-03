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
| `bank_statement_import` | HQ-PC | `{ "task":"bank_statement_import" }` — BAT: BRDET/BPDET + Drive statement Excel → `bank.statement_*` |
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

### Bank statement sync from `/bank-statement-sync` (kcw-v2)

- Job: `bank_statement_import` with `{ "task":"bank_statement_import" }`, `worker_name='HQ-PC'` (**HQ only** — Drive statement path + PARTS9 BRDET/BPDET live on HQ).
- Worker BAT [`run_bank_statement_import.bat`](https://github.com/pthengtr/kcw-analytics/blob/main/worker_tasks/run_bank_statement_import.bat) (kcw-analytics) runs **two** steps on HQ:
  1. PARTS9 **BRDET/BPDET** (ทะเบียนเช็ครับ/จ่าย — cheque **or** transfer lines) → Drive + `raw_kcw.raw_hq_brdet_cheques_received` / `raw_hq_bpdet_cheques_paid`
  2. Drive `01_raw/statement` Excel (KBANK + KTB) → `bank.statement_*`
- Data dictionary: [bi/kcw-brdet-bpdet-cheque-transfers-data-dictionary.md](./bi/kcw-brdet-bpdet-cheque-transfers-data-dictionary.md).
- Before insert: if a `bank_statement_import` row is already `pending`/`running`, return **already running**.
- Gate on **HQ-PC** heartbeat (~30s).
- UI **Bank Sync** button → `POST /api/bank/sync`, then poll `GET /api/bank/sync/:jobId`; meta via `GET /api/bank/meta`.
- Service-role RPCs: `fn_bank_find_inflight_import`, `fn_bank_enqueue_import` (plus shared `fn_po_worker_heartbeat` / `fn_po_get_job`) — see [bi/sql/fn_bank_sync_ops.sql](./bi/sql/fn_bank_sync_ops.sql).

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

### Bank statement match — จับคู่ยอดเข้า (full account numbers)

- Not a PC worker job. UI button **จับคู่ยอดเข้า** on Statement Lines → `POST /api/bank/match`.
- Scope comes from the selected month; allowed accounts come from `BANK_MATCH_PROMPTS` in [`match-prompt-constants.ts`](../src/lib/bank/match-prompt-constants.ts). Keys must match `bank.statement_lines.account_no` (KBANK now stores full numbers, same as KTB).
- Prompt sources:
  - `064-8-91723-6` (ends 7236) inbound: [`prompts/bank-statement-match-7236.md`](../prompts/bank-statement-match-7236.md)
  - `141-1-72355-7` (ends 3557) outbound payments: [`prompts/bank-statement-match-3557.md`](../prompts/bank-statement-match-3557.md)
  - `064-8-92039-3` (ends 0393) SYP sales (3TR / 3TAR) + app expense PV: [`prompts/bank-statement-match-0393.md`](../prompts/bank-statement-match-0393.md)
  - `233-1-18475-9` (ends 4759) SYP OpEx (took over 0393 expense payments from Jul 2026): [`prompts/bank-statement-match-4759.md`](../prompts/bank-statement-match-4759.md)
  - `248-0-42113-9` (KTB / ends 1139) marketplace RVI: [`prompts/bank-statement-match-1139.md`](../prompts/bank-statement-match-1139.md)
  - `248-6-00618-4` payroll / expense cheques: [`prompts/bank-statement-match-6184.md`](../prompts/bank-statement-match-6184.md)
- Placeholders `{{account_no}}` / `{{from}}` / `{{to}}` are injected by the API with the full selected `account_no`.
- Requires server env `CURSOR_API_KEY` (optional `CURSOR_AGENT_REPO_URL`, `CURSOR_AGENT_STARTING_REF`, `CURSOR_AGENT_MODEL`, `CURSOR_AGENT_MODEL_OPTIMIZE_FOR`).
- Launches Cursor Cloud Agent via `POST https://api.cursor.com/v1/agents` with Cursor Router Auto by default (`model.id=auto-smart`, `optimize_for=balanced`). If Auto/Router is rejected for the API key, the launcher retries with no `model` (user/team/system default). Override with `CURSOR_AGENT_MODEL` (`auto-smart` | `auto` | explicit id | `omit`).
- Agent updates `bank.statement_lines` match_* fields only, and **only** rows with `match_status = 'pending'`.
- Operator workflow: edit reason/notes in the row dialog; `review` → `resolved`, leftovers `unmatched`/`pending` → `manual`; CSV export from Statement Lines filters.
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
- BI data docs — [bi/README.md](./bi/README.md)

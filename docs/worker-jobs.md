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
  null,                 -- either HQ-PC or SYP-PC
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
| `sync_inventory` | HQ-PC + SYP-PC (**2 jobs**) | `{ "site": "HQ"\|"SYP" }` |
| `sync_product_images` | HQ-PC + SYP-PC | site + bucket/folder |
| `sync_online_sales` | HQ-PC | site HQ |
| `sync_pomas_podet` | HQ-PC + SYP-PC | `{ "task","site" }` |
| `bank_statement_import` | `null` (either) | `{ "task":"bank_statement_import" }` |
| `syp_raw` | SYP-PC | `{ "task","site":"SYP" }` |
| `hq_raw` / `hq_full` | HQ-PC | `{ "task","site":"HQ" }` |

When adding a type here, update kcw-api LINE triggers the same way so chat and web stay aligned.

---

## When adding a new worker feature

1. **Analytic:** implement CLI + `worker_tasks/run_....bat`; set `WORKER_JOB_<TYPE>_COMMAND` on the PC(s).
2. **kcw-api:** add LINE trigger that inserts the same `job_type` / payload / assignment.
3. **kcw-v2:** add UI button that inserts the **same** row shape with `source='web'`, then show job status (poll `ops.job_queue`).

New features almost never need new queue tables — only new `job_type` values and matching BAT/env on workers.

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

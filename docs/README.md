# KCW-v2 documentation

| Doc | Purpose |
|-----|---------|
| [worker-jobs.md](./worker-jobs.md) | **PC worker queue** — enqueue via `ops.job_queue` (same as LINE); heartbeats; known `job_type`s |
| [bank-statement-upload.md](./bank-statement-upload.md) | Bank Excel upload UI → Edge Function `import-bank-statement` (no PC worker) |
| [bi/README.md](./bi/README.md) | BI data dictionaries + RPC contracts (`raw_kcw` / `curated_kcw` / app tables) |

Upstream extract / BAT pipelines live in **[kcw-analytics](https://github.com/pthengtr/kcw-analytics)** (PARTS9 → Drive → Supabase). Mirror domain docs here when the webapp consumes those tables — e.g. [ICLOW ค้างรับ](./bi/kcw-iclow-pending-receive-data-dictionary.md), [BRDET/BPDET เช็ครับ-จ่าย](./bi/kcw-brdet-bpdet-cheque-transfers-data-dictionary.md).

## Agent note (workers)

Always enqueue background PC work through **`ops.job_queue`** like LINE. Check **`ops.worker_heartbeat`** before insert; poll the same job row for `done` / `failed`. Do not add a parallel job API.

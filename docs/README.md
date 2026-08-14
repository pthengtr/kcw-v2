# KCW-v2 documentation

| Doc | Purpose |
|-----|---------|
| [worker-jobs.md](./worker-jobs.md) | **PC worker queue** — enqueue via `ops.job_queue` (same as LINE); heartbeats; known `job_type`s |
| [bank-statement-upload.md](./bank-statement-upload.md) | Bank Excel upload UI → Edge Function `import-bank-statement` (no PC worker) |
| [liff-product-scan.md](./liff-product-scan.md) | **Retired.** Product scan is LINE camera → [kcw-api product-scan.md](https://github.com/pthengtr/kcw-api/blob/master/docs/product-scan.md) |
| [bi/README.md](./bi/README.md) | BI RPC contracts + app-only BI docs (`raw_kcw` / `curated_kcw` / app tables) |
| [kcw-docs dictionaries](https://github.com/pthengtr/kcw-docs/blob/main/dictionaries/README.md) | Shared data dictionaries (sales, ICMAS, PO, ICLOW, …) |

Upstream extract / BAT pipelines live in **[kcw-analytics](https://github.com/pthengtr/kcw-analytics)** (PARTS9 → Drive → Supabase). Domain meaning lives in **[kcw-docs](https://github.com/pthengtr/kcw-docs)** — e.g. [ICLOW ค้างรับ](https://github.com/pthengtr/kcw-docs/blob/main/dictionaries/kcw-iclow-pending-receive-data-dictionary.md), [BRDET/BPDET เช็ครับ-จ่าย](https://github.com/pthengtr/kcw-docs/blob/main/dictionaries/kcw-brdet-bpdet-cheque-transfers-data-dictionary.md).

## Agent note (workers)

Always enqueue background PC work through **`ops.job_queue`** like LINE. Check **`ops.worker_heartbeat`** before insert; poll the same job row for `done` / `failed`. Do not add a parallel job API.

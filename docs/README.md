# KCW-v2 documentation

| Doc | Purpose |
|-----|---------|
| [worker-jobs.md](./worker-jobs.md) | **PC worker queue** — enqueue via `ops.job_queue` (same as LINE); heartbeats; known `job_type`s |
| [bi/README.md](./bi/README.md) | BI data dictionaries + RPC contracts (`raw_kcw` / `curated_kcw` / app tables) |

## Agent note (workers)

Always enqueue background PC work through **`ops.job_queue`** like LINE. Check **`ops.worker_heartbeat`** before insert; poll the same job row for `done` / `failed`. Do not add a parallel job API.

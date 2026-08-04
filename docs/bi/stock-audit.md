# Stock date-audit (kcw-v2)

Track **when** each product (`BCODE`) was last stock-checked. Qty adjustment stays in legacy POS; this app only records the audit date so we can see inventory audit health.

## Why not POS `DATEAUDIT` alone?

ICMAS already has `DATEAUDIT`, but operators find it unreliable / hard to set. As of the first cut (HQ, with stock):

| Bucket | Approx count |
|--------|--------------|
| ≤30d | ~2.0k |
| 31–90d | ~2.9k |
| 91–180d | ~2.8k |
| 181–365d | ~4.4k |
| **>1 year** | **~13.6k** |
| Never (app∪POS) | hundreds (mostly odd qty edges) |

We keep POS as a **baseline** and treat app marks as the write path.

**Effective last audit** = `GREATEST(app last mark date, POS DATEAUDIT)` (either side may be null).

## Features

1. **Smart daily batch** — operator chooses how many (1–200), optional location filter. Picks never/stale first, clusters by `LOCATION1`, skips items already pending or audited within 7 days.
2. **Mark audited** — one tap after checking in POS; no qty fields. Also on-demand by BCODE.
3. **Status dashboard** — color buckets: never / ≤30d / 30–90 / 3–6m / 6–12m / >1y.

## Schema / RPCs

Source of truth SQL: `docs/bi/sql/fn_stock_audit_ops.sql`  
Migration mirror: `supabase/migrations/20260804180000_stock_audit_ops.sql`

Tables (service_role only, RLS on, no anon/authenticated grants):

- `stock_audit_status` — latest app mark per `(branch, bcode)`
- `stock_audit_event` — append-only history
- `stock_audit_batch` / `stock_audit_batch_item` — work sets

RPCs (execute → service_role):

- `fn_stock_audit_overview`
- `fn_stock_audit_create_batch`
- `fn_stock_audit_get_batch`
- `fn_stock_audit_mark`
- `fn_stock_audit_skip_item`
- `fn_stock_audit_lookup`

## App surface

- Page: `/stock-audit` (RBAC key `stock_audit`)
- APIs under `/api/stock-audit/*`
- Home menu tile: ตรวจนับสต็อก

Admin users bypass RBAC; grant `stock_audit` to other roles via `/admin/rbac`.

## Out of scope (v1)

- Writing back into POS `DATEAUDIT`
- Cycle-count qty entry / variance
- Auto-scheduling / cron batches
- Mobile scanner PWA polish (desktop + barcode keyboard input works today)

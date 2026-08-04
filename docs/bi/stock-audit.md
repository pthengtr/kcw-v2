# Stock date-audit (kcw-v2)

Track **when** each product (`BCODE`) was last stock-checked in kcw-v2. Qty adjustment stays in legacy POS; this app only records the audit date and prioritizes what to check next.

## Schema: `stock` (not `public`)

Matches other domain schemas (`bank`, `kb`, `ops`, `tiger_pay`):

| Object | Location |
|--------|----------|
| Tables | `stock.audit_status`, `stock.audit_event`, `stock.audit_batch`, `stock.audit_batch_item` |
| RPCs | `public.fn_stock_audit_*` (service_role SECURITY DEFINER) |

Tables are service_role-only (RLS on, no anon/authenticated grants).

SQL: `docs/bi/sql/fn_stock_audit_ops.sql`  
Migration: `supabase/migrations/20260804180000_stock_audit_ops.sql`

## What counts as “last audited”?

**App marks only** (`stock.audit_status`).

POS ICMAS `DATEAUDIT` is treated as **stale / unreliable** — shown as reference on rows, **not** used for:

- status color buckets
- smart-pick priority
- “skip if audited in last 7 days”

Until operators start marking in kcw-v2, almost every stocked SKU is in the **never** bucket. That is intentional.

## Smart pick (daily / on-demand batch)

Rank score (higher = pick sooner):

1. **Current-period sales** (last 30 days Bangkok) — sell qty + light revenue (best sellers first)
2. **App-audit staleness** — never marked in app gets a large boost; older marks score higher
3. **On-hand qty** — light preference for items that still have stock
4. Soft cluster by `LOCATION1` for walking the warehouse

Operator chooses count (1–200) and optional location filter.

## Features

1. Smart daily batch + mark / skip queue
2. On-demand BCODE lookup + mark
3. Status dashboard buckets: never / ≤30d / 30–90 / 3–6m / 6–12m / >1y (**app dates**)

## Access

- Page: `/stock-audit`
- RBAC: `stock_audit` (admins bypass; grant via `/admin/rbac`)
- Home tile: ตรวจนับสต็อก

## Out of scope (v1)

- Writing back into POS `DATEAUDIT`
- Cycle-count qty / variance
- Cron auto-batches
- Configurable sales window (fixed 30d for now)

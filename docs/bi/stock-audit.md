# Stock date-audit status (kcw-v2)

Branch operators count stock on the **LAN stock-check app** (LINE → `/stock-check/`). That flow mirrors into Supabase `stock.audit_event` / `stock.audit_status`. This page is a **read-only status / KPI board** — not a second place to mark items.

## Schema: `stock`

| Object | Location |
|--------|----------|
| Tables | `stock.audit_status`, `stock.audit_event`, `stock.audit_batch`, `stock.audit_batch_item` |
| RPCs | `public.fn_stock_audit_*` (service_role SECURITY DEFINER) |

SQL: `docs/bi/sql/fn_stock_audit_ops.sql`  
Migrations: `supabase/migrations/20260804180000_stock_audit_ops.sql`, `20260804193000_stock_audit_overview_charts.sql`, `20260810192359_stock_audit_operator_marks.sql`

## What counts as “last audited”?

**App marks only** (`stock.audit_status`), including rows mirrored from branch stock-check.

POS ICMAS `DATEAUDIT` is **reference only** — not used for buckets or priority.

`audited_by` from LINE mirrors as `DisplayName|LINE_UID`. Operator KPI uses the name before `|`.

## Features (status UI)

1. **สถานะ** — progress strip, KPIs, freshness pie, daily bars, **per-operator today/7d**, bucket list
2. **ค้นหารหัส** — read-only BCODE lookup (no mark)
3. Soft daily target of 30 (`STOCK_AUDIT_DAILY_TARGET`) for HQ progress on home

Workbench create-batch / mark / skip UI was removed. Write RPCs remain for compatibility but are unused by this page.

## Access

- Page: `/stock-audit`
- RBAC: `stock_audit`
- Home menu: สถานะตรวจนับ

## Out of scope

- Writing back into POS `DATEAUDIT` from v2
- Mapping LINE UIDs to Auth users
- Creating count batches from the back office

# Stock date-audit status (kcw-v2)

Branch operators count stock on the **LAN stock-check app** (LINE → `/stock-check/`). That flow mirrors into Supabase `stock.audit_event` / `stock.audit_status` (freshness) and `stock.work_event` (operator work KPI). This page is a **read-only status / KPI board** — not a second place to mark items.

## Schema: `stock`

| Object | Location |
|--------|----------|
| Tables | `stock.audit_status`, `stock.audit_event`, `stock.audit_batch`, `stock.audit_batch_item`, `stock.work_event` |
| RPCs | `fn_stock_audit_overview`, `fn_stock_audit_lookup`, `fn_stock_work_kpi` (service_role) |

SQL: `docs/bi/sql/fn_stock_audit_ops.sql`, `docs/bi/sql/fn_stock_work_kpi.sql`  
Migrations: `supabase/migrations/20260804180000_stock_audit_ops.sql`, `20260804193000_stock_audit_overview_charts.sql`, `20260810192359_stock_audit_operator_marks.sql`, `20260811043000_drop_obsolete_stock_audit_workbench_rpcs.sql`, `20260813040000_stock_work_kpi.sql`  
(kcw-api also ships `20260813020000_stock_work_event.sql` for the table.)

## Work KPI (`stock.work_event`)

Event types from branch stock-check:

| `event_type` | Meaning |
|--------------|---------|
| `count_correct` | Count matched system qty |
| `count_variance` | Count differed · pending audit |
| `count_edit` | Operator edited pending count |
| `audit_approve` | Maker-checker approve |
| `audit_reject` | Maker-checker reject |

**Completed counts** (daily target progress) = `count_correct + count_variance`.

RPC `fn_stock_work_kpi(p_branch)` returns `summary_today` / `summary_week`, 14-day `daily`, and per-operator today/week breakdowns. API: `GET /api/stock-audit/work-kpi?branch=HQ|SYP`.

## What counts as “last audited”?

**App marks only** (`stock.audit_status`), including rows mirrored from branch stock-check.

POS ICMAS `DATEAUDIT` is **reference only** — not used for buckets or priority.

`audited_by` from LINE mirrors as `DisplayName|LINE_UID`. Freshness buckets use app marks; work KPI uses `display_name` on `work_event`.

## Features (status UI)

1. **งานตรวจนับวันนี้** — progress strip (completed counts vs soft target 30), event-type KPIs, work daily bars, **per-operator work breakdown**
2. **ความสดของสต็อก** — never / freshness pie, bucket list from `fn_stock_audit_overview`
3. **ค้นหารหัส** — read-only BCODE lookup (no mark)
4. Soft daily target of 30 (`STOCK_AUDIT_DAILY_TARGET`) for HQ progress on home (from work KPI completed counts)

Workbench create-batch / mark / skip UI and RPCs were removed. Daily pick lives in **kcw-api** stock-check (`src/stock_check/daily_pick.py`).

## Access

- Page: `/stock-audit`
- RBAC: `stock_audit`
- Home menu: สถานะตรวจนับ

## Out of scope

- Writing back into POS `DATEAUDIT` from v2
- Mapping LINE UIDs to Auth users
- Creating count batches from the back office

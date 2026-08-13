# Product image operator KPI (kcw-v2)

LINE chatbot uploads/replaces/deletes write `ops.product_image_event` (kcw-api). kcw-v2 reads those rows via a service_role RPC for a dashboard.

## Source

| Object | Notes |
|--------|-------|
| `ops.product_image_event` | `image_upload` · `image_replace` · `image_delete` |
| `ops.product_image_kpi_daily` | Per operator × Bangkok day rollup |
| `public.fn_product_image_kpi(p_from, p_to)` | JSON for UI (service_role) |

SQL: `docs/bi/sql/fn_product_image_kpi.sql`  
Migration: `supabase/migrations/20260813041000_product_image_kpi.sql`  
(Table/view from kcw-api `20260813030000_product_image_event.sql`.)

## API / UI

- `GET /api/product-images/kpi?from=YYYY-MM-DD&to=YYYY-MM-DD` (auth required; no dedicated RBAC page key)
- Page: `/product-images/kpi` — today cards, operator leaderboard, recent activity
- Admin slots: `/product-images` — linked via tabs
- Home menu “จัดการรูปสินค้า” → KPI page

## Notes

- Historical Storage uploads before the event table have no actor and are not backfilled.
- Empty state is expected until LINE writes events.

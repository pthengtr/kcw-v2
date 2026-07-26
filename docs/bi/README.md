# KCW BI documentation

Living docs for BI dashboards built on Supabase schemas `raw_kcw` and `curated_kcw`.

## Files

| File | Purpose |
|------|---------|
| [kcw-sales-data-dictionary.md](./kcw-sales-data-dictionary.md) | Sales naming, grain, joins, codes, billing rules |
| [kcw-icmas-data-dictionary.md](./kcw-icmas-data-dictionary.md) | Product master (ICMAS): `BCODE`, `CODE1`, categories |
| [sql/fn_bi_sales_overview.sql](./sql/fn_bi_sales_overview.sql) | RPC used by `/bi/sales` overview dashboard |
| [sql/fn_bi_product_overview.sql](./sql/fn_bi_product_overview.sql) | RPC used by `/bi/products` ranking dashboard |

## App entry

- UI: `/bi/sales`, `/bi/products` (shell + side panel; customer ranking TBD)
- API: `GET /api/bi/sales/overview?from=&to=&branch=`
- API: `GET /api/bi/products/overview?from=&to=&branch=&limit=`
- Auth: admin-only (`requireAdmin` + service role RPC)

## How we maintain this

1. Put **business meaning** and **metric definitions** here (not only in chat).
2. Mark each fact as **Confirmed** or **TBD**.
3. When a rule changes, add a row under **Changelog** with the effective date.
4. Prefer encoding stable rules into curated SQL views later; this MD stays the contract.

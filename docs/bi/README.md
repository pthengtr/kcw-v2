# KCW BI documentation

Living docs for BI dashboards built on Supabase schemas `raw_kcw` and `curated_kcw`.

## Files

| File | Purpose |
|------|---------|
| [kcw-sales-data-dictionary.md](./kcw-sales-data-dictionary.md) | Sales naming, grain, joins, codes, billing rules |
| [sql/fn_bi_sales_overview.sql](./sql/fn_bi_sales_overview.sql) | RPC used by `/bi/sales` overview dashboard |

## App entry

- UI: `/bi/sales` (shell + side panel for future reports)
- API: `GET /api/bi/sales/overview?from=&to=&branch=`
- Auth: admin-only (`requireAdmin` + service role RPC)

## How we maintain this

1. Put **business meaning** and **metric definitions** here (not only in chat).
2. Mark each fact as **Confirmed** or **TBD**.
3. When a rule changes, add a row under **Changelog** with the effective date.
4. Prefer encoding stable rules into curated SQL views later; this MD stays the contract.

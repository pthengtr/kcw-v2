# KCW BI documentation

Living docs for BI dashboards. Sales/product/customer reports use `raw_kcw` / `curated_kcw`; the expense report uses **`public`** app tables.

Parent index: [docs/README.md](../README.md) · PC workers / sync jobs: [docs/worker-jobs.md](../worker-jobs.md)

## Files

| File | Purpose |
|------|---------|
| [kcw-sales-data-dictionary.md](./kcw-sales-data-dictionary.md) | Sales naming, grain, joins, codes, billing rules; customer `ACCTNO` / party |
| [kcw-icmas-data-dictionary.md](./kcw-icmas-data-dictionary.md) | Product master (ICMAS): `BCODE`, `CODE1`, categories |
| [kcw-ar-ap-data-dictionary.md](./kcw-ar-ap-data-dictionary.md) | AR/AP masters (ARMAS/APMAS); **`MOBILE` = tax id** |
| [kcw-expense-data-dictionary.md](./kcw-expense-data-dictionary.md) | App expense tables + amount rules (company + general) |
| [kcw-income-data-dictionary.md](./kcw-income-data-dictionary.md) | Gross / net income (sales margin − app opex) |
| [kcw-purchase-data-dictionary.md](./kcw-purchase-data-dictionary.md) | HQ PIDET purchase **invoice** lines (JOURMODE / BILLTYPE) |
| [kcw-po-data-dictionary.md](./kcw-po-data-dictionary.md) | Purchase **orders** in `raw_kcw` (HQ+SYP); PO id = `DOCNO`; SYP prepare = `po_syp_prepare` |
| [sql/po_syp_prepare.sql](./sql/po_syp_prepare.sql) | App overlay for SYP “prepared for transfer” |
| [sql/fn_po_sync_ops.sql](./sql/fn_po_sync_ops.sql) | Service-role RPCs for PO sync via `ops.job_queue` |
| [kcw-product-movement-data-dictionary.md](./kcw-product-movement-data-dictionary.md) | Stock-more + dead-stock aging rules |
| [sql/fn_bi_sales_overview.sql](./sql/fn_bi_sales_overview.sql) | RPC used by `/bi/sales` |
| [sql/fn_bi_product_overview.sql](./sql/fn_bi_product_overview.sql) | RPC used by `/bi/products` |
| [sql/fn_bi_product_movement.sql](./sql/fn_bi_product_movement.sql) | RPC used by `/bi/product-movement` |
| [sql/fn_bi_customer_overview.sql](./sql/fn_bi_customer_overview.sql) | RPC used by `/bi/customers` |
| [sql/fn_bi_expense_overview.sql](./sql/fn_bi_expense_overview.sql) | RPC used by `/bi/expenses` |
| [sql/fn_bi_income_overview.sql](./sql/fn_bi_income_overview.sql) | RPC used by `/bi/income` |
| [sql/fn_bi_income_blank_costs.sql](./sql/fn_bi_income_blank_costs.sql) | Blank-cost line drilldown for `/bi/income` |

## App entry

- UI: `/po` — HQ/SYP purchase-order status (sync via `sync_pomas_podet`; SYP prepare overlay)
- UI: `/bi/sales`, `/bi/sales-compare`, `/bi/products`, `/bi/product-movement`, `/bi/customers`, `/bi/expenses`, `/bi/income`
- API: `GET /api/bi/sales/overview?from=&to=&branch=`
- API: `GET /api/bi/sales/compare?mode=years|months&years=&periods=&branch=`
- API: `GET /api/bi/products/overview?from=&to=&branch=&limit=`
- API: `GET /api/bi/products/movement?from=&to=&branch=&stock_limit=&dead_limit=`
- API: `GET /api/bi/customers/overview?from=&to=&branch=&limit=`
- API: `GET /api/bi/expenses/overview?from=&to=&branch=&source=&limit=`
- API: `GET /api/bi/income/overview?from=&to=&branch=`
- API: `GET /api/bi/income/blank-costs?from=&to=&branch=&limit=`
- Auth: admin-only (`requireAdmin` + service role RPC)

### Sales comparison note

`/bi/sales-compare` is a **separate report** (not jammed into overview): pick years for seasonal month overlay, or pick specific month–years, then toggle table / bar / line. It reuses `fn_bi_sales_overview` per selected range.

## How we maintain this

1. Put **business meaning** and **metric definitions** here (not only in chat).
2. Mark each fact as **Confirmed** or **TBD**.
3. When a rule changes, add a row under **Changelog** with the effective date.
4. Prefer encoding stable rules into curated SQL views later; this MD stays the contract.

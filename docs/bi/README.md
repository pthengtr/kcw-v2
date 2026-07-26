# KCW BI documentation

Living docs for BI dashboards. Sales/product/customer reports use `raw_kcw` / `curated_kcw`; the expense report uses **`public`** app tables.

## Files

| File | Purpose |
|------|---------|
| [kcw-sales-data-dictionary.md](./kcw-sales-data-dictionary.md) | Sales naming, grain, joins, codes, billing rules; customer `ACCTNO` / party |
| [kcw-icmas-data-dictionary.md](./kcw-icmas-data-dictionary.md) | Product master (ICMAS): `BCODE`, `CODE1`, categories |
| [kcw-expense-data-dictionary.md](./kcw-expense-data-dictionary.md) | App expense tables + amount rules (company + general) |
| [sql/fn_bi_sales_overview.sql](./sql/fn_bi_sales_overview.sql) | RPC used by `/bi/sales` |
| [sql/fn_bi_product_overview.sql](./sql/fn_bi_product_overview.sql) | RPC used by `/bi/products` |
| [sql/fn_bi_customer_overview.sql](./sql/fn_bi_customer_overview.sql) | RPC used by `/bi/customers` |
| [sql/fn_bi_expense_overview.sql](./sql/fn_bi_expense_overview.sql) | RPC used by `/bi/expenses` |

## App entry

- UI: `/bi/sales`, `/bi/products`, `/bi/customers`, `/bi/expenses`
- API: `GET /api/bi/sales/overview?from=&to=&branch=`
- API: `GET /api/bi/products/overview?from=&to=&branch=&limit=`
- API: `GET /api/bi/customers/overview?from=&to=&branch=&limit=`
- API: `GET /api/bi/expenses/overview?from=&to=&branch=&source=&limit=`
- Auth: admin-only (`requireAdmin` + service role RPC)

## How we maintain this

1. Put **business meaning** and **metric definitions** here (not only in chat).
2. Mark each fact as **Confirmed** or **TBD**.
3. When a rule changes, add a row under **Changelog** with the effective date.
4. Prefer encoding stable rules into curated SQL views later; this MD stays the contract.

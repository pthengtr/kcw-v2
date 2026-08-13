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
| [kcw-income-data-dictionary.md](./kcw-income-data-dictionary.md) | Overall gross / net (VAT + non-VAT sales − opex) |
| [kcw-income-statement-data-dictionary.md](./kcw-income-statement-data-dictionary.md) | Taxed-only VAT-book P&L + CIT + year-end forecast |
| [kcw-vat-data-dictionary.md](./kcw-vat-data-dictionary.md) | VAT sales/purchase tax books + mid-period forecast |
| [kcw-purchase-data-dictionary.md](./kcw-purchase-data-dictionary.md) | HQ PIDET purchase **invoice** lines (JOURMODE / BILLTYPE) |
| [kcw-po-data-dictionary.md](./kcw-po-data-dictionary.md) | Purchase **orders** in `raw_kcw` (HQ+SYP); PO id = `DOCNO`; SYP prepare = `po_syp_prepare` |
| [kcw-iclow-pending-receive-data-dictionary.md](./kcw-iclow-pending-receive-data-dictionary.md) | PARTS9 **ค้างรับ** = `ICLOW` (`ORDERED`/`RECEIVED`/`CANCELED`) |
| [kcw-brdet-bpdet-cheque-transfers-data-dictionary.md](./kcw-brdet-bpdet-cheque-transfers-data-dictionary.md) | PARTS9 **ทะเบียนเช็ครับ/จ่าย** = `BRDET`/`BPDET` (`CHKNO` = cheque # or method label) |
| [sql/po_syp_prepare.sql](./sql/po_syp_prepare.sql) | App overlay for SYP “prepared for transfer” (header) |
| [sql/po_syp_prepare_line.sql](./sql/po_syp_prepare_line.sql) | Per-line prepare + HQ LOCATION1/2 + HQ inventory qty via `fn_po_syp_lines` |
| [sql/fn_inventory_sync_ops.sql](./sql/fn_inventory_sync_ops.sql) | Enqueue/poll `sync_inventory` + last HQ inventory `updated_at` |
| [sql/fn_po_sync_ops.sql](./sql/fn_po_sync_ops.sql) | Service-role RPCs for PO sync via `ops.job_queue` |
| [sql/fn_po_related_sync_ops.sql](./sql/fn_po_related_sync_ops.sql) | Combined `/po` update button — `sync_po_related` HQ+SYP |
| [sql/fn_po_list.sql](./sql/fn_po_list.sql) | PO list + last-ingested RPCs / open-PO indexes |
| [sql/fn_po_pending_receive.sql](./sql/fn_po_pending_receive.sql) | ICLOW `/po` pending tab; HQ `RCVDNO→PIDET`; SYP `RCVDNO∪REMARKS TF→SIDet`; SYP BCODE prepare via `fn_po_syp_tf_prepare_by_bcode` |
| [sql/fn_po_syp_tf_prepare_by_bcode.sql](./sql/fn_po_syp_tf_prepare_by_bcode.sql) | Per-BCODE TF prepare qty for SYP ICLOW tabs |
| [kcw-product-movement-data-dictionary.md](./kcw-product-movement-data-dictionary.md) | Stock-more + dead-stock aging rules |
| [sql/fn_bank_sync_ops.sql](./sql/fn_bank_sync_ops.sql) | Legacy enqueue/poll `bank_statement_import` (HQ-PC); web UI uses Edge Function |
| [sql/create_raw_hq_brdet_bpdet.sql](./sql/create_raw_hq_brdet_bpdet.sql) | `raw_kcw` BRDET/BPDET cheque+transfer registers (from kcw-analytics) |
| [sql/fn_bi_sales_revenue_filters.sql](./sql/fn_bi_sales_revenue_filters.sql) | Shared revenue include/exclude helper (`fn_bi_sales_bill_excluded_from_revenue`) |
| [sql/fn_bi_sales_overview.sql](./sql/fn_bi_sales_overview.sql) | RPC used by `/bi/sales` |
| [sql/fn_bi_product_overview.sql](./sql/fn_bi_product_overview.sql) | RPC used by `/bi/products` |
| [sql/fn_bi_product_movement.sql](./sql/fn_bi_product_movement.sql) | RPC used by `/bi/product-movement` |
| [sql/fn_bi_customer_overview.sql](./sql/fn_bi_customer_overview.sql) | RPC used by `/bi/customers` |
| [sql/fn_bi_expense_overview.sql](./sql/fn_bi_expense_overview.sql) | RPC used by `/bi/expenses` |
| [sql/fn_bi_cashflow_overview.sql](./sql/fn_bi_cashflow_overview.sql) | RPC used by `/bi/cash-flow` (bank statements) |
| [sql/fn_bi_income_overview.sql](./sql/fn_bi_income_overview.sql) | RPC used by `/bi/income` |
| [sql/fn_bi_income_blank_costs.sql](./sql/fn_bi_income_blank_costs.sql) | Blank-cost line drilldown for `/bi/income` |
| [sql/fn_bi_vat_overview.sql](./sql/fn_bi_vat_overview.sql) | RPC used by `/bi/vat` (ภาษีขาย/ซื้อ + พยากรณ์) |
| [stock-audit.md](./stock-audit.md) | Branch stock-check status + work KPI (`stock.work_event`) |
| [product-image-kpi.md](./product-image-kpi.md) | LINE product-image operator KPI |
| [sql/fn_stock_work_kpi.sql](./sql/fn_stock_work_kpi.sql) | RPC used by `/stock-audit` work section |
| [sql/fn_product_image_kpi.sql](./sql/fn_product_image_kpi.sql) | RPC used by `/product-images/kpi` |

## App entry

- UI: `/po` — HQ/SYP purchase-order status; pending receive (ค้างรับ) = `ICLOW` — see [ICLOW dictionary](./kcw-iclow-pending-receive-data-dictionary.md)
- UI: `/bank-statement-sync` — upload Excel via `import-bank-statement` Edge Function + match; daily HQ BAT can still refresh Drive Excel + BRDET/BPDET — see [cheque/transfer dictionary](./kcw-brdet-bpdet-cheque-transfers-data-dictionary.md)
- UI: `/bi/sales`, `/bi/sales-compare`, `/bi/products`, `/bi/product-movement`, `/bi/customers`, `/bi/expenses`, `/bi/cash-flow`, `/bi/income`, `/bi/income-statement`, `/bi/vat`
- API: `GET /api/bi/sales/overview?from=&to=&branch=`
- API: `GET /api/bi/sales/compare?mode=years|months&years=&periods=&branch=`
- API: `GET /api/bi/products/overview?from=&to=&branch=&limit=`
- API: `GET /api/bi/products/movement?from=&to=&branch=&stock_limit=&dead_limit=`
- API: `GET /api/bi/customers/overview?from=&to=&branch=&limit=`
- API: `GET /api/bi/expenses/overview?from=&to=&branch=&source=&limit=`
- API: `GET /api/bi/cashflow/overview?from=&to=&account=&limit=`
- API: `GET /api/bi/income/overview?from=&to=&branch=`
- API: `GET /api/bi/income/blank-costs?from=&to=&branch=&limit=`
- API: `GET /api/bi/income-statement/overview?from=&to=&branch=`
- API: `GET /api/bi/vat/overview?from=&to=&branch=`
- Auth: admin-only (`requireAdmin` + service role RPC)

### Sales comparison note

`/bi/sales-compare` is a **separate report** (not jammed into overview): pick years for seasonal month overlay, or pick specific month–years, then toggle table / bar / line. It reuses `fn_bi_sales_overview` per selected range.

## How we maintain this

1. Put **business meaning** and **metric definitions** here (not only in chat).
2. Mark each fact as **Confirmed** or **TBD**.
3. When a rule changes, add a row under **Changelog** with the effective date.
4. Prefer encoding stable rules into curated SQL views later; this MD stays the contract.

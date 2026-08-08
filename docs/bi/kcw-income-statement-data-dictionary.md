# KCW income statement from VAT books (งบกำไรขาดทุนจากสมุดภาษี)

Source of truth for `/bi/income-statement` — a **simplified P&L** derived from the same VAT sales / purchase / expense tax books as `/bi/vat`, plus an estimated corporate income tax and mid-period run-rate forecast.

Not the same as `/bi/income` (sales margin − app opex with COGS from `LAST_PURCHASE_COST`).

Status legend: **Confirmed** · **TBD** · **Inferred**

Last reviewed: 2026-08-08

---

## 1. Scope

| Fact | Status |
|------|--------|
| Revenue = VAT sales **before-tax** (`sales_before`) | Confirmed |
| Costs = VAT purchase goods + VAT expense **before-tax** | Confirmed |
| Same sources / filters as [kcw-vat-data-dictionary.md](./kcw-vat-data-dictionary.md) | Confirmed |
| CIT approx **20%** on positive profit only | Confirmed (flat; SME tiers TBD) |
| Trend / year-end forecast = VAT run-rate factor | Confirmed |
| Label UI as **ประมาณการ** — not statutory filing | Confirmed |

---

## 2. Formulas (Confirmed)

```text
revenue          = sales_before          -- VAT sales book
purchase_cost    = purchase_before       -- PIDET VAT purchases
expense          = expense_before        -- app expense VAT bases
total_cost       = purchase_cost + expense
profit_before_tax = revenue − total_cost
income_tax       = max(0, profit_before_tax) × 0.20
net_profit       = profit_before_tax − income_tax
```

Trend chart recovers period bases as `vat_amount / 0.07` (expense VAT is exact; sales/purchase are close). KPI / statement / forecast / branch use real `*_before` fields from `fn_bi_vat_overview`.

**Forecast** (same as VAT): when `as_of < p_to`,

```text
factor = days_in_range / days_elapsed
forecast_x = actual_x × factor
```

YTD preset uses `Jan 1 → Dec 31` so mid-year forecast targets year-end.

---

## 3. App entry

- UI: `/bi/income-statement`
- API: `GET /api/bi/income-statement/overview?from=&to=&branch=`
- Data: reuses `fn_bi_vat_overview` → `deriveIncomeStatementFromVat`
- Page key: `bi_income_statement` (admin bypass)

---

## 4. Changelog

| Date | Change |
|------|--------|
| 2026-08-08 | Initial VAT-based income statement + CIT estimate + forecast |

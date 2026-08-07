# KCW Cash Flow Dashboard — data dictionary

Formal cash-flow statement (operating / investing / financing) built from imported
bank statements. Distinct from P&L (`/bi/income`) and from raw bank movement
totals.

## Source of cash

| Layer | Role |
|-------|------|
| `bank.statement_lines` | Fact table: every bank debit/credit (incl. `ignored`) |
| `public.cashflow_categories` | Codes `1001`–`3002` + activity/direction |
| `public.cashflow_ref_map` | `matched_ref_type` → cashflow code |
| `public.cashflow_bank_accounts` | Display labels for known accounts |

There is **no duplicated `cash_transactions` table**. A view
`public.v_cash_transactions` projects statement lines + mapped codes. Manual
overrides can be added later via an optional `cashflow_code` column on
`bank.statement_lines` (not required for v1).

## Accounting rule

Bank inflow ≠ sales. Classification happens **before** operating cash is
computed. Example: ฿6.4M bank in with ฿1M loan → sales cash `1001` = ฿5.4M,
financing `3001` = ฿1M.

`internal_transfer` is **excluded** from O/I/F activity totals (same cash moving
between own accounts) but still appears in bank reconciliation.

Unmapped / unmatched lines are tracked as `unclassified_*` and are **not** forced
into `1001`.

## Codes (Excel parity)

| Code | Activity | Direction | Meaning |
|------|----------|-----------|---------|
| 1001 | OPERATING | INFLOW | Cash received from sales |
| 1002 | OPERATING | OUTFLOW | Cash paid for inventory/purchases |
| 1003 | OPERATING | OUTFLOW | Operating expenses |
| 1004 | OPERATING | OUTFLOW | Interest and tax payments |
| 2001 | INVESTING | INFLOW | Cash from sale of assets |
| 2002 | INVESTING | OUTFLOW | Cash paid for asset purchases |
| 3001 | FINANCING | INFLOW | Investment / loans received |
| 3002 | FINANCING | OUTFLOW | Dividends / loan repayments |

### `matched_ref_type` → code (v1)

| `matched_ref_type` | Code | Status |
|--------------------|------|--------|
| `tar_cntar_net`, `tr_bill`, `tr_bundle`, `tr_remainder`, `3tr_bill`, `rvmas`, `rvi` | 1001 | Confirmed (sales receipts) |
| `pvmas`, `pimas`, `pimas_possible_bundle`, `bank_cheque` | 1002 | Confirmed (supplier/inventory) |
| `expense_pv`, `expense_payroll`, `employee_advance` | 1003 | Confirmed (opex) |
| `withholding_tax` | 1004 | Confirmed (tax) |
| `internal_transfer` | *(exclude)* | Confirmed |
| `interest_income`, `vendor_rebate`, `unclassified_inflow` | *(unclassified)* | TBD vs Excel |
| loan / dividend types | 3001 / 3002 | **Missing in bank match today** — add when Excel/match agents tag them |
| asset sale/purchase | 2001 / 2002 | **Missing** until tagged |

## Formulas

```
operating = 1001 - 1002 - 1003 - 1004
investing = 2001 - 2002
financing = 3001 - 3002
net_cash_change = operating + investing + financing
ending_cash = opening_cash + net_cash_change   -- SCF identity
```

Bank ending balance (sum of latest `balance_after` per account) may differ from
SCF ending when unclassified or timing gaps exist — shown in Bank Reconciliation.

### Bank reconciliation (per account completeness)

For each account in the selected year window:

```
opening =
  last balance_after before Jan 1
  OR (if none) first_in_range.balance_after ∓ first_in_range.amount  -- inferred
calculated_close = opening + cash_in − cash_out
actual = last balance_after in window
variance = actual − calculated_close
is_complete = abs(variance) < 0.01
```

Operators use per-account **ครบ / ขาดช่วง** to verify import completeness.
A non-zero variance after inferred opening means gaps or inconsistent
`balance_after` in the imported series — not a missing “opening = 0” artifact.

## RPC

- `public.fn_bi_cashflow_dashboard(p_year, p_through_month)` — dashboard payload
- `public.fn_bi_cashflow_drilldown(p_year, p_month, p_code, p_limit)` — line drilldown

## Auth

Page key `bi_cashflow` (same as `/bi/cash-flow`). Service-role RPC only.

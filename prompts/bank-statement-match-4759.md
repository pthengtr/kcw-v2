# Match expenses for account 4759

You are a matching agent for bank rows in `bank.statement_lines`.
Follow the rules below strictly, then update rows in Supabase directly.

Account **4759** (Kasikorn) is the **SYP / สี่แยกพัฒนา OpEx paying account** that took over day-to-day expense payments previously paid from **0393**:

- **Outbound** ≈ app payment vouchers (**PV / 3PV**) from `public.expense_*` (not PARTS9 `raw_kcw` PVMAS)
- Payment method text is `กสิกร xxxxxx4759` (same pattern as the old `กสิกร xxxxxx0393`)
- **Inbound** ≈ funding sweeps from **0393** / **7236** — mark as internal transfers; do **not** run sales matching here
- Sales settlements (`3TR` / `3TAR−3CNTAR`) stay on account **0393** — never use those sources on 4759

Observed cutover: from **July 2026**, almost all direct KBANK OpEx receipts switched from `%0393%` to `%4759%`.

## Job scope (injected by the system)

- Account: `{{account_no}}`
- Dates: `{{from}}` to `{{to}}`

Scope rules:

1. Only account **4759**
2. If `{{account_no}}` is not `4759`, stop immediately and do not change any rows
3. Only work on `txn_date` within `{{from}}`..`{{to}}`
4. Touch both directions while `match_status = 'pending'`:
   - `direction = 'out'` → expense PV sources first, then residual outflows
   - `direction = 'in'` → internal funding only (no sales)
5. Never change amount / description / source_* / any money fields
6. Write only `match_*` and `matched_*` fields
7. **Never** update rows in `matched` / `review` / `resolved` / `unmatched` / `manual` / `ignored` — those belong to finished agent work or operators
8. Bank narrative text lives in `raw_json` (Thai keys `รายการ`, `รายละเอียด`, `ช่องทาง`). The `description` column is often just a time — use `raw_json` when classifying

## Match sources — OUTBOUND (priority order)

### 1) App payment vouchers PV / 3PV (`public.expense_*`)

Primary source: `public.expense_receipt`  
Join: `public.payment_method` on `payment_uuid`, optional `public.branch` / `public.party` for notes.

These are the in-app expenses that print as **PV…** (HQ) / **3PV…** (SYP สี่แยกพัฒนา). Do **not** use `raw_kcw.raw_hq_pvmas_notes_vouchers` for this account.

Filter payment methods:

1. **Direct 4759 pay** — `payment_description ILIKE '%4759%'` (stored as `กสิกร xxxxxx4759`, `voucher_type = individual`)
2. **Director reimbursement** — `payment_description ILIKE '%คืนเงินสำรอง%'` (`voucher_type = group`). These are often banked as transfers to Narumon / X2446 who paid cash; they still belong to the PV expense workflow (same as on 0393)

Do **not** use `payment_description ILIKE '%0393%'` on this account — those receipts belong to historical **0393** outflows.

**Amount to match (critical):** bank `amount` equals the voucher **net paid**, not raw `signed_total` alone:

```text
total_net =
  total_amount - discount
  + (total_amount - discount - coalesce(tax_exempt,0)) * (coalesce(vat,0) / 100)
  - (total_amount - discount - coalesce(tax_exempt,0)) * (coalesce(withholding,0) / 100)
```

Round to 2 decimals. Prefer `abs(total_net) = amount`. Fall back to `abs(signed_total) = amount` only when net does not hit and signed is uniquely clear.

Date window:

- Prefer **same calendar day** on `receipt_date::date = txn_date`
- Allow `receipt_date` within **txn_date − 3 .. txn_date + 3** when same-day is empty but the amount is unique
- Unique 1:1 only for auto-`matched`. Multiple candidates → `review`

| Kind | Meaning | `match_status` | `match_reason` (Thai) |
|---|---|---|---|
| `expense_pv_same_day` | Unique net on same `receipt_date` | `matched` | `ใบสำคัญจ่าย PV (วันเดียวกัน)` |
| `expense_pv_near` | Unique net within ±3d | `matched` if clearly unique else `review` | `ใบสำคัญจ่าย PV (ใกล้วัน)` |
| `expense_pv_bundle` | Several receipts sum to one transfer | `matched` / `review` | `ใบสำคัญจ่าย PV (รวมหลายใบ)` |
| ambiguous | Multiple candidates | `review` | `ใบสำคัญจ่าย PV (กำกวม)` |

`matched_ref_type = expense_pv`  
`matched_ref_id = <receipt_uuid>` (comma-separated UUIDs for bundles). Put `receipt_number` and voucher description in `match_notes`.

Notes from July 2026 probe:

- Direct OpEx receipts moved to `กสิกร xxxxxx4759` in July; director-reimbursement receipts continue as `คืนเงินสำรองจ่ายกรรมการ`
- Using `total_net` (not `signed_total`) covers most outflows 1:1 against 4759 + director-reimbursement receipts
- Same-day hits dominate for tax / SSO / suppliers / reimbursements to X2446
- Duplicate same-day nets (e.g. two identical phone / 2C2P bills) → `review`, do not pick arbitrarily
- Some late-month bank outs may not have an expense receipt yet — leave `unmatched` / `review`; do not invent matches
- Some `receipt_number` values already look like `PV…` / `3PV…` / tax refs — still match via `expense_receipt`, not PARTS9 PVMAS
- `expense_general` with payment 4759 was **not** required in the July probe — do not invent general-row matches unless a unique hit appears

### 2) Large / residual outflows

| Category | `matched_ref_type` | `match_status` | Notes | `match_reason` (Thai) |
|---|---|---|---|---|
| Internal sweep out | `internal_transfer` | `ignored` | Large transfers to other KCW accounts when counterpart is clear | `โอนภายใน` |
| No unique expense | — | `unmatched` / `review` | Do not invent blind subset-sums across many receipts | `ยังไม่พบใบสำคัญจ่าย` |

## Match sources — INBOUND

No sales matching on this account.

| Category | `matched_ref_type` | `match_status` | Notes | `match_reason` (Thai) |
|---|---|---|---|---|
| Internal transfer in | `internal_transfer` | `ignored` | Funding from X0393 / X7236 / other KCW accounts (`รับโอนเงิน` + company name) | `โอนภายใน` |
| Other / unclear inflow | — | `review` / `unmatched` | Do not treat as 3TR / 3TAR | `รายรับรอตรวจ` |

July 2026 inflows observed were funding sweeps from **X0393** and **X7236** only.

## Exclusions (do not use)

- SYP sales sources: `3TR%`, `billgen.fin_3tar_lines`, `fin_3cntar_lines` (those belong to **0393**)
- HQ `TR%` / `billgen.fin_tar_lines` / `fin_cntar_lines` (those belong to **7236**)
- `raw_kcw.raw_hq_pvmas_notes_vouchers` / `raw_hq_pimas_purchase_bills` (those belong to **3557**)
- Payment methods for **0393** / **6184** / **1139** — wrong paying account
- Online fee receipts with `voucher_type = skip` / `หักจากรายได้` — not banked on 4759
- Blind unconstrained subset-sum without a payment-method constraint
- Changing money fields or opening PRs for a pure matching data job

## Fields to write on each decision

Always set:

- `match_status`: `matched` | `review` | `ignored` | `unmatched` if still unknown after this pass
  - Start from `pending` only; never write back to `pending`
  - Operators own `resolved` / `manual` — do not touch those rows
- `match_reason`: short Thai text from the tables above
- `match_confidence`: 0 to 1
- `matched_ref_type` / `matched_ref_id`
- `match_notes`: short Thai sentence for operators
- `matched_at = now()`
- `matched_by = agent:bank-matcher-4759-v1`

Confidence guide:

- Clear 1:1 expense PV same-day ≥ **0.95**
- Expense near-day ≈ **0.85–0.90**
- Expense multi-receipt bundle ≈ **0.80–0.90** (use `review` if unsure)
- Ambiguous → `review` and confidence ≤ **0.55**
- Ignored internal transfers: confidence **1.0** when counterpart account is clear

## Thai note style (required for operator UI)

Examples:

- `จับคู่กับใบสำคัญจ่าย PV จาก expense_receipt RC0000020260703-00002 สุทธิ 5,734.58 บาท วันที่ 03/07/2026 ชำระผ่าน กสิกร xxxxxx4759`
- `จับคู่กับใบสำคัญจ่ายคืนเงินสำรอง 462252 สุทธิ 25,279.65 บาท โอนเข้า X2446 วันที่ 04/07/2026`
- `จับคู่กับใบสำคัญจ่าย PV (ภาษี / SSO) สุทธิ 27,616.00 บาท วันที่ 13/07/2026 ชำระผ่าน กสิกร xxxxxx4759`
- `รายการซ้ำยอดเท่ากันสองใบในวันเดียวกัน — รอตรวจ (ใบสำคัญจ่าย PV กำกวม)`
- `โอนภายในจากบัญชี X0393 จำนวน 200,000.00 บาท — ไม่ใช่ยอดขาย`

Do not use cryptic codes like `expense_pv:` or `T+1 net=` as the main `match_notes` text.

## Expected coverage (probe, July 2026)

Approximate unique candidates observed (do not force these numbers; use as sanity check):

- Outbound: most tax / SSO / supplier / X2446 reimbursements 1:1 via `total_net` against `%4759%` + `คืนเงินสำรอง`
- Duplicate same-day amounts (e.g. twin 2C2P / phone nets) stay in `review`
- Late-month outs without a receipt yet → `unmatched` / `review`
- Inbound: funding from X0393 / X7236 → `ignored` internal transfers

If your run lands far below that for the same month, re-check filters (`total_net` VAT/WHT formula, payment_method text `%4759%` / `คืนเงินสำรอง`) before inventing new rules.

## End-of-run summary

Report briefly in English:

- Counts of `matched` / `review` / `ignored` / `unmatched` (split by `in` / `out` if useful)
- Confirm zero remaining `pending` in scope (or list any still pending and why)
- Breakdown by source: expense_pv / internal / other
- Rows that need human review

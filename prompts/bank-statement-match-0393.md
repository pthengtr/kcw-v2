# Match sales and expenses for account 064-8-92039-3

You are a matching agent for bank rows in `bank.statement_lines`.
Follow the rules below strictly, then update rows in Supabase directly.

Account **064-8-92039-3** (Kasikorn, ends **0393**) is the **SYP / สี่แยกพัฒนา** operating account:

- **Inbound** ≈ SYP sales settlements (`3TR` transfer bills + daily `3TAR−3CNTAR` net) — same logic as account **064-8-91723-6** (ends 7236), but with the SYP `3…` prefixes and `billgen.fin_3*` tables
- **Outbound** ≈ app payment vouchers (**PV / 3PV**) from `public.expense_*` (not PARTS9 `raw_kcw` PVMAS)
- From **July 2026**, most direct OpEx payments moved to account **233-1-18475-9** (ends 4759, payment text `กสิกร xxxxxx4759`). Keep matching `%0393%` receipts here when they appear; do **not** pull `%4759%` receipts onto this account

## Job scope (injected by the system)

- Account: `{{account_no}}`
- Dates: `{{from}}` to `{{to}}`

Scope rules:

1. Only account **064-8-92039-3**
2. If `{{account_no}}` is not `064-8-92039-3`, stop immediately and do not change any rows
3. Only work on `txn_date` within `{{from}}`..`{{to}}`
4. Touch both directions while `match_status` in (`pending`, `unmatched`):
   - `direction = 'in'` → sales sources first, then non-sales inflows
   - `direction = 'out'` → expense PV sources, then non-expense outflows
5. Never change amount / description / source_* / any money fields
6. Write only `match_*` and `matched_*` fields
7. **Never** update rows in `matched` / `review` / `resolved` / `manual` / `ignored` — those belong to finished agent work or operators
8. Bank narrative text lives in `raw_json` (Thai keys `รายการ`, `รายละเอียด`, `ช่องทาง`). The `description` column is often just a time — use `raw_json` when classifying

## Match sources — INBOUND (priority order)

Apply in this order. Later sources must not steal rows already claimed by earlier sources.

### 1) 3TR transfer bills (SYP)

Source: `curated_kcw.fact_sales_bills_all`

- Use bills where `BILLNO LIKE '3TR%'` and not canceled (`CANCELED = 'N'`)
- Bill amount uses `AFTERTAX` (or `CHKAMT` if needed)
- Same idea as HQ `TR%` on `064-8-91723-6`, with two timing differences confirmed on May/June 2026:
  - **Thai QR / K SHOP** remainder (and many small single bills) usually hit **same calendar day**
  - Separate bank transfers for 3TR bills often arrive **T+1** (sometimes T+2 / T+3 around weekends / holidays)
- Each bill-date, partition that day’s 3TR bills across one or more inbound rows:
  - **1:1** (one bill = one transfer or one QR)
  - **bundle** 2+ bills summing to one transfer / one QR
  - leftover unclaimed same-day 3TR amount = Thai QR / K SHOP when the QR row equals that remainder

| Kind | Meaning | `match_reason` (Thai, for operators) |
|---|---|---|
| `tr_bill` | 1 bill = 1 inbound | `บิลโอน 3TR (ใบเดียว)` |
| `tr_bundle` | Several bills sum to 1 inbound | `บิลโอน 3TR (รวมหลายใบ)` |
| `tr_remainder` | Remaining unclaimed 3TR = Thai QR / K SHOP | `ยอดเหลือ 3TR ผ่าน Thai QR` |

Notes:

- Daily 3TR count is small, so same-day / next-day allocation is fine
- Do not mix daily 3TAR−3CNTAR net rows into 3TR matching
- Prefer smallest unique lag when a bill/bundle can hit multiple days
- If no unique allocation → `review` or leave for later sources / `unmatched`

`matched_ref_type = tr_bill` | `tr_bundle` | `tr_remainder`  
`matched_ref_id = <BILLNO>` or comma-separated BILLNOs for bundles / remainders

### 2) Daily net 3TAR − 3CNTAR

Sources:

- `billgen.fin_3tar_lines`
- `billgen.fin_3cntar_lines`

Daily formula:

```text
net = SUM(fin_3tar_lines.amount) + SUM(fin_3cntar_lines.amount)
```

3CNTAR amounts are already stored as negatives, so add them (do not subtract again).

Matching to inbound deposits:

- Find rows where `amount = net`
- Usually settles on **T+1**
- Allow **T+2 / T+3** (and occasionally **T+4** around long weekends / holidays) when T+1 is missing
- Prefer the smallest unique lag
- If multiple competing rows → `review`
- **Shortfall catch-up:** sometimes the main settlement is short, and a separate smaller transfer arrives later to catch up. When you detect that pattern, match it and explain it clearly in `match_notes`
- Some bill-dates may have **no** settlement inside the statement window (observed gaps in late May) — do not invent matches; leave related open inflows for review/`unmatched`

`match_reason` (Thai):

- T+1 → `ยอดขายสุทธิ 3TAR (เข้าวันถัดไป)`
- T+2 → `ยอดขายสุทธิ 3TAR (เข้าช้า 2 วัน)`
- T+3 / T+4 → `ยอดขายสุทธิ 3TAR (เข้าช้า N วัน)`
- Shortfall catch-up → `ยอดขายสุทธิ 3TAR (ชดเชยส่วนขาด)`

`matched_ref_type = tar_cntar_net`  
`matched_ref_id = <billdate of the net being settled / completed>`

### 3) Non-sales inflows (after 3TR / 3TAR)

| Category | `matched_ref_type` | `match_status` | Notes | `match_reason` (Thai) |
|---|---|---|---|---|
| Internal transfer in | `internal_transfer` | `ignored` | From another KCW account (e.g. X3557 / company name) | `โอนภายใน` |
| Vendor rebate / misc | `vendor_rebate` | `matched` or `review` | No internal bill — match by description; confidence ~0.85–0.90 | `เงินคืนจากผู้ขาย` |
| Bank interest / WHT | `interest_income` / `withholding_tax` | `ignored` | Same pattern as `064-8-91723-6` if present | `ดอกเบี้ยเงินฝาก` / `ภาษีหัก ณ ที่จ่ายดอกเบี้ย` |

## Match sources — OUTBOUND (priority order)

### 1) App payment vouchers PV / 3PV (`public.expense_*`)

Primary source: `public.expense_receipt`  
Join: `public.payment_method` on `payment_uuid`, optional `public.branch` for notes.

These are the in-app expenses that print as **PV…** (HQ) / **3PV…** (SYP สี่แยกพัฒนา). Do **not** use `raw_kcw.raw_hq_pvmas_notes_vouchers` for this account.

Filter payment methods:

1. **Direct 0393 pay** — `payment_description ILIKE '%0393%'` (stored as `กสิกร xxxxxx0393`, `voucher_type = individual`; last-4 of this account)
2. **Director reimbursement** — `payment_description ILIKE '%คืนเงินสำรอง%'` (`voucher_type = group`). These are often banked as transfers to Narumon / X2446 who paid cash; they still belong to the PV expense workflow
3. Do **not** use `payment_description ILIKE '%4759%'` — those belong to account **233-1-18475-9**

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

Notes from May/June probe:

- Using `total_net` (not `signed_total`) covers ~**88%** of outflows 1:1 against `%0393%` + director-reimbursement receipts
- Same-day hits dominate for direct `%0393%` payments (tax, SSO, rent, suppliers)
- Small director reimbursements to X2446 are usually 1:1 same day; phone / multi-bill days may need a **bundle**
- Some `receipt_number` values already look like `PV69…` / `3PV69…` (rent etc.) — still match via `expense_receipt`, not PARTS9 PVMAS
- `expense_general` with `%0393%` payment was **not** observed in May/June — do not invent general-row matches unless a unique hit appears

### 2) Large / residual outflows

| Category | `matched_ref_type` | `match_status` | Notes | `match_reason` (Thai) |
|---|---|---|---|---|
| Internal sweep out | `internal_transfer` | `ignored` | Large transfers to other KCW accounts (e.g. X6184) | `โอนภายใน` |
| No unique expense | — | `unmatched` / `review` | Do not invent blind subset-sums across many receipts | `ยังไม่พบใบสำคัญจ่าย` |

## Exclusions (do not use)

- HQ `TR%` / `billgen.fin_tar_lines` / `fin_cntar_lines` (those belong to **064-8-91723-6**)
- `raw_kcw.raw_hq_pvmas_notes_vouchers` / `raw_hq_pimas_purchase_bills` (those belong to **141-1-72355-7**)
- Online fee receipts with `voucher_type = skip` / `หักจากรายได้` — not banked on `064-8-92039-3`
- Blind unconstrained subset-sum without a payment-method or same-day 3TR constraint
- Changing money fields or opening PRs for a pure matching data job

## Fields to write on each decision

Always set:

- `match_status`: `matched` | `review` | `ignored` | `unmatched` if still unknown after this pass
  - Start from `pending` or `unmatched` only; never write back to `pending`
  - Operators own `resolved` / `manual` — do not touch those rows
- `match_reason`: short Thai text from the tables above
- `match_confidence`: 0 to 1
- `matched_ref_type` / `matched_ref_id`
- `match_notes`: short Thai sentence for operators
- `matched_at = now()`
- `matched_by = agent:bank-matcher-0393-v1`

Confidence guide:

- Clear 1:1 3TR / 3TAR T+1 / expense PV same-day ≥ **0.95**
- 3TR bundle / QR remainder / 3TAR T+2–T+3 / expense near-day ≈ **0.85–0.90**
- Expense multi-receipt bundle ≈ **0.80–0.90** (use `review` if unsure)
- Ambiguous → `review` and confidence ≤ **0.55**
- Ignored internal transfers: confidence **1.0** when counterpart account is clear

## Thai note style (required for operator UI)

Examples:

- `จับคู่กับบิลโอน 3TR6905-002 จำนวน 417.30 บาท วันที่ 02/05/2026 (Thai QR 1 ต่อ 1)`
- `ยอดเหลือจากบิลโอน 3TR ที่ยังไม่ถูกโอนแยก (3TR6906-007,3TR6906-008) รวม 2,635.45 บาท เข้าผ่าน Thai QR วันที่ 08/06/2026`
- `ยอดขายสุทธิรายวัน (3TAR หัก 3CNTAR) ของวันที่ 01/05/2026 จำนวน 53,630.80 บาท เข้าบัญชีวันถัดไป (02/05/2026)`
- `จับคู่กับใบสำคัญจ่าย PV จาก expense_receipt IV69050238 (CLEAR OPP TAPE) สุทธิ 13,057.00 บาท วันที่ 06/05/2026 ชำระผ่าน กสิกร xxxxxx0393`
- `จับคู่กับใบสำคัญจ่ายคืนเงินสำรอง 452203 (ค่าขนส่ง PMPL) สุทธิ 25,131.15 บาท โอนเข้า X2446 วันที่ 04/05/2026`
- `โอนภายในไปบัญชี X6184 จำนวน 200,000.00 บาท — ไม่ใช่ค่าใช้จ่าย`

Do not use cryptic codes like `3tr_remainder:` or `T+1 net=` as the main `match_notes` text.

## Expected coverage (probe, May+June 2026)

Approximate unique candidates observed (do not force these numbers; use as sanity check):

- Inbound: most large transfers are 3TAR T+1; most QR / small transfers are 3TR
- Outbound: expense `total_net` vs `%0393%` + director-reimbursement receipts ≈ **88%** 1:1
- Remaining large outflows are usually internal sweeps to X6184 → `ignored`

If your run lands far below that for the same months, re-check filters (`CANCELED`, 3TR prefix, `total_net` VAT/WHT formula, payment_method text) before inventing new rules.

## End-of-run summary

Report briefly in English:

- Counts of `matched` / `review` / `ignored` / `unmatched` (split by `in` / `out` if useful)
- Confirm zero remaining `pending` or `unmatched` in scope (or list any still open and why)
- Breakdown by source: 3TR / 3TAR / expense_pv / internal / other
- Any 3TAR shortfall catch-up pairs or missing settlement days
- Rows that need human review

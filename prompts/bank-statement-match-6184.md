# Match payroll and expense cheques for account 248-6-00618-4

You are a matching agent for bank rows in `bank.statement_lines`.
Follow the rules below strictly, then update rows in Supabase directly.

Account **248-6-00618-4** (Krungthai, ends with **6184**) is the **payroll + OpEx cheque** account:

- **Outbound** ≈ app expenses / payment vouchers (**PV / 3PV**) and **payroll** from `public.expense_*`
- Payments clear as bank cheques (`SBK… ICAS…`, `CHEQUE NO.` in `raw_json`) or as payroll / utility transfers
- **Inbound** transfers (from 1139 / 0393 / 7236) fund the account — **do not match or update them**

Do **not** use PARTS9 `raw_kcw.raw_hq_pvmas_notes_vouchers` for this account (that belongs to **3557**).

## Job scope (injected by the system)

- Account: `{{account_no}}`
- Dates: `{{from}}` to `{{to}}`

Scope rules:

1. Only account **248-6-00618-4**
2. If `{{account_no}}` is not `248-6-00618-4`, stop immediately and do not change any rows
3. Only work on `txn_date` within `{{from}}`..`{{to}}`
4. Primary target: `direction = 'out'` and `match_status = 'pending'`
5. **Inbound (`direction = 'in'`): do nothing** — leave `pending` (or whatever status they already have). Never write match fields on inflows for this account
6. Never change amount / description / source_* / any money fields
7. Write only `match_*` and `matched_*` fields
8. **Never** update rows in `matched` / `review` / `resolved` / `unmatched` / `manual` / `ignored` — those belong to finished agent work or operators
9. Cheque number lives in `bank_reference` and/or `raw_json->>'CHEQUE NO.'` for ICAS clears (`TRANSACTION CODE` often `CBCA`)

## Match sources — OUTBOUND (priority order)

Apply in this order. Later sources must not steal rows already claimed by earlier sources.

### 1) Payroll (`public.expense_receipt` + payment method เงินเดือน)

Source: `public.expense_receipt`  
Join: `public.payment_method` on `payment_uuid`

Filter:

- `payment_description ILIKE '%6184%เงินเดือน%'` (stored as `กรุงไทย xxxxxx6184 - เงินเดือน`, `voucher_type = skip`)
- Usually one **HQ** + one **SYP** salary receipt per month (`voucher_description` / `receipt_number` contain `salary` / `Salary`)

Amount rules:

- Bank payroll often posts as **one large `PAY1 …` transfer** plus a **small residual TR** to an employee on the same day
- Match when `PAY1.amount + residual_TR.amount = HQ.signed_total + SYP.signed_total` (exact, 2 decimals)
- Prefer `receipt_date` within **txn_date − 3 .. txn_date + 3**
- Unique month pair only for auto-`matched`. If only one of PAY1 / residual is present → `review`

| Kind | Meaning | `match_status` | `match_reason` (Thai) |
|---|---|---|---|
| `payroll_pay1_bundle` | PAY1 + residual TR = HQ+SYP salary | `matched` | `เงินเดือน (PAY1 รวมส่วนต่าง)` |
| `payroll_ambiguous` | Salary totals found but bank split unclear | `review` | `เงินเดือน (กำกวม)` |

`matched_ref_type = expense_payroll`  
`matched_ref_id` = comma-separated `receipt_uuid`s (HQ then SYP). Mention both receipt numbers and the residual TR in `match_notes`.

Write **both** statement rows (PAY1 and residual TR) with the same refs / notes (explain which part each row is).

Confidence: clear exact bundle ≥ **0.95**; review ≤ **0.55**

Notes from May/June 2026 probe:

- June: `PAY1` 435,851.00 on 2026-06-26 + TR 714.00 same day = **436,565.00** = HQ 376,779 + SYP 59,786 (`receipt_date` 2026-06-27)
- May salary HQ+SYP = 409,870.00 had **no** matching `PAY1` / bundle inside the May–June statement window — leave related open outs alone; do not force ICAS cheques onto payroll

### 2) App expense PV / utilities (`public.expense_receipt`)

Primary source: `public.expense_receipt`  
Join: `public.payment_method` on `payment_uuid`, optional `public.party` for notes.

These print as **PV…** (HQ) / **3PV…** (SYP) in the expense voucher UI. Match via `expense_receipt`, not PARTS9 PVMAS.

Filter payment methods:

1. **Direct 6184 pay** — `payment_description = 'กรุงไทย xxxxxx6184'` (`voucher_type = individual`)
2. **Group multi-invoice cheque** — `payment_description ILIKE '%6184%จ่ายรวม%'` (`voucher_type = group`) when present

**Amount to match:** bank `amount` equals voucher **net paid**:

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
- Multi-receipt **bundle** only when payment method is the **group** 6184 method (or a clearly same-day unique sum); otherwise do not invent blind subset-sums

Common May/June pattern: **Provincial Electricity** bank description (`Provincial Electricit…`) 1:1 with `voucher_description` ค่าไฟฟ้า and party การไฟฟ้าส่วนภูมิภาค.

| Kind | Meaning | `match_status` | `match_reason` (Thai) |
|---|---|---|---|
| `expense_pv_same_day` | Unique net on same `receipt_date` | `matched` | `ใบสำคัญจ่าย PV (วันเดียวกัน)` |
| `expense_pv_near` | Unique net within ±3d | `matched` if clearly unique else `review` | `ใบสำคัญจ่าย PV (ใกล้วัน)` |
| `expense_pv_utility` | Electricity / utility transfer | `matched` | `ใบสำคัญจ่าย PV (ค่าสาธารณูปโภค)` |
| `expense_pv_bundle` | Several receipts on group cheque | `matched` / `review` | `ใบสำคัญจ่าย PV (รวมหลายใบ)` |
| ambiguous | Multiple candidates | `review` | `ใบสำคัญจ่าย PV (กำกวม)` |

`matched_ref_type = expense_pv`  
`matched_ref_id = <receipt_uuid>` (comma-separated for bundles). Put `receipt_number`, PV/3PV-style id if present, and voucher description in `match_notes`.

Confidence: clear same-day utility ≥ **0.95**; near-day unique ≈ **0.85–0.90**

Notes from May/June 2026 probe:

- Direct 6184 individual receipts in-window are almost only **electricity** (4 outs matched 1:1)
- Tax / SSO / phones that historically used 6184 moved to **0393**, then from **July 2026** to **4759** — do not pull 0393/4759-paid receipts onto 6184
- `expense_general` with payment 6184 was **not** observed — do not invent general-row matches unless a unique hit appears

### 3) Supplier cheque clears — PIMAS purchase bills (`raw_kcw.raw_hq_pimas_purchase_bills`)

Rows with description like `SBK:11 SBR:642 ICAS INCL R1` and a cheque number in `bank_reference` / `raw_json->>'CHEQUE NO.'` are **cleared supplier cheques** paid via PIMAS (not PVMAS).

**Key insight from May/June 2026 probe:** almost all ICAS cheques on this account are payments to **บจก.ศรีสยามกลการ (สาขาที่ 00001)** (`ACCTNAME ILIKE '%ศรีสยาม%'`). The cheque payment date is stored in `REMARKS` as `D/M/YY##<tax-id>` (Thai Buddhist year, 2-digit: `69` = 2026). Match by grouping `CHKAMT` bills per parsed `REMARKS` date and comparing the **bundle sum** to the statement amount.

**Date lag:** cheques typically clear ICAS **28–32 days** after the `REMARKS` payment date (Thailand 30-day payment terms). Use a window of `chk_date` between `txn_date − 60` and `txn_date + 2`.

**Amount tolerance:** PIMAS stores CHKAMT with sub-baht precision; the bank statement rounds to whole baht. Accept `abs(bundle_sum − amount) < 1.00`.

**Date parsing** for `REMARKS` (format `D/M/YY##ref` or `DD/MM/YYYY##ref`):
```text
y = parsed year integer
if y >= 2400: CE = y − 543        (4-digit Buddhist, e.g. 2568 → 2025)
if y >= 100:  CE = y              (already CE)
else:         CE = (2500 + y) − 543   (2-digit Buddhist, e.g. 69 → 2026)
```

If no ศรีสยาม bundle matches, try all suppliers' PIMAS CHKAMT bundles same way.

#### Paid-but-unlinked PIMAS fallback

If the normal PIMAS `CHKAMT` bundle search produces no match, check for possible operator-entry or export-linkage errors.

Eligible fallback bills must:

- have `PAID = 'Y'`
- have `coalesce(DUEAMT, 0) = 0`
- have both `VOUCNO1` and `VOUCNO2` empty
- not be cancelled
- have `BILLDATE` on or before the bank clearing date
- fall within a broad lookback of up to **180 days** before `txn_date`

Search combinations of **2 to 4 bills belonging to the same `ACCTNO` only**. Evaluate each supplier independently. Do not perform an unrestricted subset-sum across bills from different suppliers.

Rank possible combinations by:

1. smallest absolute difference from the bank amount
2. all bills belonging to the same supplier account
3. latest bill date closest to the cheque-clearing date
4. fewer bills
5. bills not already linked to another voucher
6. consistent supplier name and tax reference across the bills

Amount handling:

- Difference below ฿1.00: strong candidate
- Difference from ฿1.00 through ฿10.00: plausible manual rounding or adjustment
- Difference above ฿10.00: show only when exceptionally plausible; never auto-match
- Maximum review tolerance: the smaller of **฿100.00** or **0.05% of the bank amount**

This fallback is always `review`, never automatically `matched`, because the missing PVMAS linkage prevents confirmation.

| Kind | `matched_ref_type` | `match_status` | `match_reason` (Thai) |
|---|---|---|---|
| PIMAS bundle exact | `pimas` | `matched` | `บิลซื้อ PIMAS (เช็คจ่ายชัดเจน)` |
| PIMAS bundle ≈ (< 1฿ diff) | `pimas` | `matched` | `บิลซื้อ PIMAS (เช็คจ่ายชัดเจน)` |
| Paid unlinked PIMAS combination | `pimas_possible_bundle` | `review` | `อาจเป็นเช็ครวมหลายบิล PIMAS ที่ไม่มีเลขใบสำคัญจ่าย` |
| no PIMAS hit (after fallback) | `bank_cheque` | `review` | `เช็คเคลียร์ (ยังไม่พบใบสั่งซื้อ)` |

`matched_ref_id` = comma-separated `BILLNO`s from the bundle (or candidate bills for the paid-unlinked fallback).  
Confidence: exact 0.95; ≈ match 0.90; paid-unlinked fallback **0.55–0.75** (amount difference, supplier consistency, date plausibility); no hit ≤ 0.55

Operator note for paid-unlinked fallback must show:

- cheque number and clearing date
- supplier account and supplier name
- each bill number, date, and amount
- combination total
- bank amount
- difference
- explicit warning that the bills are marked paid but have no PVMAS voucher linkage

Notes from May/June 2026 probe:

- 18 / 25 ICAS cheques matched to ศรีสยาม PIMAS bundles (lags 28–32 days)
- Remaining ICAS cheques: try paid-unlinked PIMAS fallback before leaving as plain `bank_cheque` review — some may be multi-bill payments with empty `VOUCNO1`/`VOUCNO2`

### 4) Other residual outflows

Small personal TRs (e.g. 3,000 baht education / advances) with no unique expense row → `unmatched` or `review` with a Thai note. Do not invent links to cash `expense_general` on unrelated payment methods.

## Exclusions (do not use)

- **Any update to `direction = 'in'`**
- `raw_kcw.raw_hq_pvmas_notes_vouchers` / `raw_hq_pimas_purchase_bills` (account **3557**)
<<<<<<< HEAD
- Expense receipts paid via **0393** / **4759** / director reimbursement / online-fee skip methods
- Blind unconstrained subset-sum across many receipts
=======
- Expense receipts paid via **0393** / director reimbursement / online-fee skip methods
- Blind unconstrained subset-sum across many receipts or across different PIMAS suppliers (paid-unlinked fallback may combine **2–4** bills of the **same `ACCTNO` only**)
>>>>>>> origin/master
- Changing money fields

## Fields to write on each decision

Always set (outbound only):

- `match_status`: `matched` | `review` | `ignored` | `unmatched` if still unknown after this pass
  - Start from `pending` only; never write back to `pending`
  - Operators own `resolved` / `manual` — do not touch those rows
  - Inflows stay untouched (may remain `pending`)
- `match_reason`: short Thai text from the tables above
- `match_confidence`: 0 to 1
- `matched_ref_type` / `matched_ref_id`
- `match_notes`: short Thai sentence for operators
- `matched_at = now()`
- `matched_by = agent:bank-matcher-6184-v1`

## Thai note style (required for operator UI)

Examples:

- `จับคู่เงินเดือนมิ.ย. HQ+SYP (Salary HQ 6/26 + Salary SYP 06/26) รวม 436,565.00 บาท — PAY1 435,851.00 กับโอนส่วนต่าง 714.00 วันที่ 26/06/2026`
- `จับคู่กับใบสำคัญจ่ายค่าไฟฟ้า 000095634096 สุทธิ 8,274.37 บาท วันที่ 22/05/2026 ชำระผ่าน กรุงไทย xxxxxx6184 (Provincial Electricity)`
- `เช็คเลขที่ 10127780 เคลียร์ ICAS ยอด 136,633.00 บาท วันที่ 05/05/2026 — ยังไม่พบ expense_receipt ยอดตรง รอตรวจ`
- `เช็คเลขที่ 10127908 เคลียร์วันที่ 22/06/2026 ยอด 219,945.05 บาท — อาจตรงกับบิลของผู้ขาย 7SSY: D-O-260100347 78,382.58 บาท + D-O-260300852 141,558.89 บาท รวม 219,941.47 บาท ต่าง 3.58 บาท ทั้งสองบิลถูกระบุว่าชำระแล้วแต่ไม่มีเลข PVMAS รอตรวจสอบ`

Do not use cryptic codes like `payroll:` or `ICAS=` as the main `match_notes` text.

## Expected coverage (probe, May+June 2026 outbound)

Approximate (do not force these numbers; sanity check only):

- Utility / direct 6184 expense PV ≈ **4** outs (electricity)
- Payroll bundle ≈ **2** outs in June (PAY1 + residual); May salary may be absent from the window
- ICAS cheque clears ≈ **25** outs → ~18 match PIMAS ศรีสยาม bundles (0.90–0.95); leftovers try paid-unlinked fallback (`pimas_possible_bundle` / `review`) before plain `bank_cheque` review
- Inflows ≈ **24** → **leave pending**

If utility + payroll coverage collapses for the same months, re-check `total_net` VAT/WHT formula and payment_method text before inventing new rules.

## End-of-run summary

Report briefly in English:

- Counts of `matched` / `review` / `ignored` / `unmatched` for **outbound** only
- Confirm inflows were left untouched
- Breakdown: payroll / expense_pv / pimas / pimas_possible_bundle review / bank_cheque review / other
- Rows that need human review (especially ICAS cheques and paid-unlinked PIMAS candidates)

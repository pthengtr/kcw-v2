# Match inbound marketplace settlements for account 248-0-42113-9

You are a matching agent for bank rows in `bank.statement_lines`.
Follow the rules below strictly, then update rows in Supabase directly.

Account **248-0-42113-9** (KTB, ends with **1139**) receives **online marketplace settlement payouts** (Shopee / Lazada / TikTok). These are booked in RVMAS as **`RVI…` vouchers**, not as classic customer `RC…` receipts and not as individual `TAD` sales bills.

## Job scope (injected by the system)

- Account: `{{account_no}}`
- Dates: `{{from}}` to `{{to}}`

Scope rules:

1. Only account **248-0-42113-9**
2. If `{{account_no}}` is not `248-0-42113-9`, stop immediately and do not change any rows
3. Only work on `txn_date` within `{{from}}`..`{{to}}`
4. Primary target: `direction = 'in'` and `match_status` in (`pending`, `unmatched`)
5. Also clear outbound (`direction = 'out'`) rows with `match_status` in (`pending`, `unmatched`) using the internal-transfer rule below
6. Never change amount / description / source_* / any money fields
7. Write only `match_*` and `matched_*` fields
8. **Never** update rows in `matched` / `review` / `resolved` / `manual` / `ignored` — those belong to finished agent work or operators

## Date parsing note (important)

RVMAS `VOUCDATE` / `RCPTDATE` in this project are usually ISO dates like `2026-05-05` (with dashes). Sometimes they appear as `YYYYMMDD`. Always parse both forms before comparing to `txn_date`.

## Match sources (priority order)

Apply in this order. Later sources must not steal rows already claimed by earlier sources.

### 1) RVMAS marketplace vouchers — RVI (high confidence)

Source: `raw_kcw.raw_hq_rvmas_notes_vouchers`

This account’s inflows are almost entirely **`VOUCNO` starting with `RVI`** (online channel settlement receipts).

- Not canceled (`CANCELED = 'N'`)
- Prefer **`VOUCNO LIKE 'RVI%'`**
- Match **1:1** on `PAYAMT` ≈ statement `amount`
- Prefer **same calendar day**: parsed `VOUCDATE = txn_date`
- Amount compare: use `ROUND(..., 2)`; allow **±0.01** when the voucher is otherwise unique same-day (seen for TikTok / floating money, e.g. bank `56056.49` ↔ voucher `56056.50`)
- If multiple vouchers collide on the same amount+day → `review`
- Do **not** widen to multi-day windows for auto-`matched` unless amount is unique within ±1 day and clearly the same settlement (otherwise leave `unmatched` or `review`)

| Kind | Meaning | `match_status` | `match_reason` (Thai) |
|---|---|---|---|
| `rvi_same_day` | Unique `PAYAMT` on `VOUCDATE = txn_date` | `matched` | `ใบสำคัญรับเงินออนไลน์ RVI (วันเดียวกัน)` |
| `rvi_rounding` | Unique same-day hit within ±0.01 | `matched` | `ใบสำคัญรับเงินออนไลน์ RVI (ปัดเศษ)` |
| ambiguous | Multiple candidates | `review` | `ใบสำคัญรับเงินออนไลน์ RVI (กำกวม)` |

`matched_ref_type = rvmas`  
`matched_ref_id = <VOUCNO>`  
Confidence: clear unique same-day ≥ **0.95**; ±0.01 rounding ≈ **0.90**; review ≤ **0.55**

#### Channel hints (description → typical RVI `ACCTNAME`)

Use these only as supporting evidence in `match_notes` — amount + same-day uniqueness still decides the match.

| Statement `description` pattern | Channel | Typical RVI shops |
|---|---|---|
| `004-8471012131` | Shopee | `SHOPEE (พี่ภู่)`, `PNT TRACTOR (Shopee)`, `SHOPEE I.C.E tractor`, `ICE AUTO PARTS ( SHOPEE)` |
| `BPS/…/Lazada Ltd.…` | Lazada | `LAZADA (KC INDUSTRY)`, `PNT TRACTOR (Lazada)`, `LAZADA I.C.E tractor`, `ICE AUTO PARTS (LAZADA)`, `LAZADA (Tractor Group )` |
| `004-1521670041…` or `024-6993647915…` | TikTok | `ICE TIKTOK SHOP` |

### 2) Do **not** match individual TAD bills to deposits

Source **not** used for this account’s bank lines: `curated_kcw.fact_sales_bills_all` with `BILLTYPE_STD = 'TAD'`.

- TAD = individual online VAT invoices
- Bank deposits = marketplace **payout batches**, already summarized into **RVI** vouchers
- Daily TAD nets and 1:1 TAD `AFTERTAX` do **not** line up with these statement amounts — do not invent TAD matches

If an operator asks conceptually: this account **supports online sales (TAD) economically**, but the **matchable book source** is RVMAS **RVI**.

### 3) Classic RC customer receipts — exclude for this account

`VOUCNO LIKE 'RC%'` customer receipts (trade debtors) settle on **064-8-91723-6** (ends 7236), not here.

- Do not force `RC…` onto `248-0-42113-9` inflows
- May/Jun probe: **0** unique same-day `RC` hits on this account

### 4) Outbound internal sweeps

All observed outflows are transfers to the sister KTB account:

- Description like `TR to 2486006184 KIATCHAI AUTO PART 2007`
- Counterpart account: `248-6-00618-4`

| Kind | `match_status` | `matched_ref_type` | `match_reason` (Thai) |
|---|---|---|---|
| Internal sweep | `ignored` | `internal_transfer` | `โอนภายใน` |

`matched_ref_id = 248-6-00618-4` (or the digits from the description)  
Confidence: **1.0** when description clearly names that counterpart

### 5) Bank interest / tiny residuals

Rare tiny inflows with null/empty description (e.g. **11.57**) and no RVI candidate:

| Kind | `match_status` | `matched_ref_type` | `match_reason` (Thai) |
|---|---|---|---|
| Likely interest / bank credit | `ignored` | `interest_income` | `ดอกเบี้ยเงินฝาก` |

Only when amount is tiny and no RVI exists nearby. Otherwise leave `unmatched`.

## Expected coverage (probe, May+June 2026 inbound)

Approximate unique candidates observed in analysis (sanity check only — do not force these numbers):

- RVI same-day exact ≈ **58/61 (~95%)**
- Plus ±0.01 rounding ≈ **+1** → ~**59/61 (~97%)**
- Leftovers seen: missing voucher gap (e.g. Shopee `14,262` on 2026-06-30 with RVI sequence jump `033→035`), plus tiny interest

If your run lands far below that for the same months, re-check date parsing (ISO vs `YYYYMMDD`) and amount casts before inventing new rules.

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
- `matched_by = agent:bank-matcher-1139-v1`

## Thai note style (required for operator UI)

Examples:

- `จับคู่กับใบสำคัญรับเงินออนไลน์ RVI6905-003 จำนวน 1,079.00 บาท วันที่ 05/05/2026 (Shopee ICE AUTO PARTS — ตรงยอด 1 ต่อ 1 วันเดียวกัน)`
- `จับคู่กับใบสำคัญรับเงินออนไลน์ RVI6905-006 จำนวน 59,822.56 บาท วันที่ 06/05/2026 (Lazada KC INDUSTRY)`
- `จับคู่กับใบสำคัญรับเงินออนไลน์ RVI6905-018 จำนวน 56,056.50 บาท วันที่ 20/05/2026 (TikTok — ต่างจากยอดธนาคาร 0.01 บาท)`
- `โอนภายในไปบัญชี 248-6-00618-4 จำนวน 120,000.00 บาท — ไม่ใช่ยอดขาย`
- `ยอดเล็ก 11.57 บาท ไม่มีใบ RVI — น่าจะดอกเบี้ยเงินฝาก`

Do not use cryptic codes like `rvi:` or `T+0=` as the main `match_notes` text.

## Do not

- Match any account other than `248-0-42113-9`
- Change money fields or source descriptions
- Match individual TAD / CNTAD bills directly to deposits
- Force classic `RC…` customer receipts onto this account
- Invent blind subset-sums across many vouchers
- Force a match when unsure — use `review` or set `unmatched`
- Open a PR / change repo code for this job unless required to update data

## End-of-run summary

Report briefly in English:

- Counts of `matched` / `review` / `ignored` / `unmatched`
- Confirm zero remaining `pending` or `unmatched` in scope (or list any still open and why)
- Breakdown by source: RVI / internal sweep / interest
- Any ±0.01 rounding pairs
- Rows that need human review (missing vouchers, collisions)

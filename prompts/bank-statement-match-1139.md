# Match inbound marketplace settlements for account 248-0-42113-9

You are a matching agent for bank rows in `bank.statement_lines`.
Run this prompt in a chat agent (ChatGPT/Codex, Claude/Cowork, or similar) with Supabase access.
Follow the rules below strictly, then update rows in Supabase directly.

Account **248-0-42113-9** (KTB, ends with **1139**) receives **online marketplace settlement payouts** (Shopee / Lazada / TikTok). These are booked in RVMAS as **`RVI…` vouchers**, not as classic customer `RC…` receipts and not as individual `TAD` sales bills.

## Job scope

- Account: `{{account_no}}`
- Dates: `{{from}}` to `{{to}}`

Replace `{{account_no}}`, `{{from}}`, and `{{to}}` with the target account and inclusive date range (YYYY-MM-DD), or confirm those values with the operator before changing any rows.

Scope rules:

1. Only account **248-0-42113-9**
2. If `{{account_no}}` is not `248-0-42113-9`, stop immediately and do not change any rows
3. Only work on `txn_date` within `{{from}}`..`{{to}}`
4. Primary target: `direction = 'in'` and `match_status` in (`pending`, `unmatched`)
5. Also clear outbound (`direction = 'out'`) rows with `match_status` in (`pending`, `unmatched`) using the internal-transfer rule below
6. **Re-match `unmatched` every run** — a prior `unmatched` is not final. RVI vouchers often post after the bank settlement; when a unique RVI now exists, overwrite the old unmatched decision with `matched` / `review`. Never skip `unmatched` rows. **Do not** “finish” an inflow by writing only a channel label (Shopee/Lazada/TikTok) without an RVI `matched_ref_id` — leave it `unmatched` so the next run can attach the voucher.
7. **Never write `match_status = ignored`** — operator-only (exclude from monthly Excel). Interest / bank credits → `matched` with `interest_income`. Possible duplicate rows → `review` (`possible_duplicate`); ask the operator to set `ignored` manually if confirmed.
8. Never change amount / description / source_* / any money fields
9. Write only `match_*` and `matched_*` fields
10. **Never** update rows in `matched` / `review` / `resolved` / `manual` / `ignored` — those belong to finished agent work or operators

## Date window policy

When comparing source dates to statement `txn_date`:

1. **Auto-`matched` tier** — only when the hit is within the strict window documented for that source below.
2. **Review tier (relaxed window)** — if amount + source uniquely identify one candidate **outside** the auto-tier but still within the relaxed window, set `match_status = review` — **not** `unmatched`. Always populate `matched_ref_type`, `matched_ref_id`, `match_reason`, and `match_confidence`. Prefix `match_notes` with `⚠️ วันที่ไม่ตรงช่วงปกติ:` and explain the candidate (ref id, amount, source date, `txn_date`, days apart, why it is still plausible).
3. **`unmatched`** — only when no plausible candidate exists after the relaxed window, or multiple candidates collide.

Default relaxed window for RVI on this account: auto same day; relaxed `review` **`txn_date − 5 .. txn_date + 5`**.

Never auto-`matched` outside the strict auto-tier. Wider hits are always `review` with the warning prefix.

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
- Auto-`matched`: parsed `VOUCDATE = txn_date` (same calendar day)
- Amount compare: use `ROUND(..., 2)`; allow **±0.01** when the voucher is otherwise unique same-day (seen for TikTok / floating money, e.g. bank `56056.49` ↔ voucher `56056.50`)
- Relaxed `review`: unique `PAYAMT` within **`txn_date − 5 .. txn_date + 5`** — populate matched refs + `⚠️ วันที่ไม่ตรงช่วงปกติ:` warning; do not leave `unmatched` when a plausible late/early settlement exists
- If multiple vouchers collide on the same amount+day → `review`

| Kind | Meaning | `match_status` | `match_reason` (Thai) |
|---|---|---|---|
| `rvi_same_day` | Unique `PAYAMT` on `VOUCDATE = txn_date` | `matched` | `ใบสำคัญรับเงินออนไลน์ RVI (วันเดียวกัน)` |
| `rvi_rounding` | Unique same-day hit within ±0.01 | `matched` | `ใบสำคัญรับเงินออนไลน์ RVI (ปัดเศษ)` |
| `rvi_relaxed` | Unique hit within ±5d relaxed window | `review` | `ใบสำคัญรับเงินออนไลน์ RVI (วันไม่ตรง — รอตรวจ)` |
| ambiguous | Multiple candidates | `review` | `ใบสำคัญรับเงินออนไลน์ RVI (กำกวม)` |

`matched_ref_type = rvmas`  
`matched_ref_id = <VOUCNO>`  
Confidence: clear unique same-day ≥ **0.95**; ±0.01 rounding ≈ **0.90**; review ≤ **0.55**

#### Channel hints (description → typical RVI `ACCTNAME`)

Use these only as supporting evidence in `match_notes` — amount + same-day uniqueness still decides the match. **Channel label alone is never a finished match.**

| Statement `description` pattern | Channel | Typical RVI shops |
|---|---|---|
| `004-8471012131` | Shopee | `SHOPEE (พี่ภู่)`, `PNT TRACTOR (Shopee)`, `SHOPEE I.C.E tractor`, `ICE AUTO PARTS ( SHOPEE)` |
| `TR from 9825080752 Shopeepay` | ShopeePay | same Shopee RVI shops |
| `BPS/…/Lazada Ltd.…` | Lazada | `LAZADA (KC INDUSTRY)`, `PNT TRACTOR (Lazada)`, `LAZADA I.C.E tractor`, `ICE AUTO PARTS (LAZADA)`, `LAZADA (Tractor Group )` |
| `004-1521670041…` or `024-6993647915…` | TikTok | `ICE TIKTOK SHOP` |

July 2026 lesson: all 29 marketplace inflows had a unique RVI within ±5d, but operators only wrote channel labels (`Shopee` / `Lazada` / `TikTok`) with no `matched_ref_id`. Always attach `VOUCNO`. If RVI is missing today, leave `unmatched` (so the next run can rematch) — do not convert to `manual`-style channel-only notes.
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
| Internal sweep | `matched` | `internal_transfer` | `โอนภายใน` |

`matched_ref_id = 248-6-00618-4` (or the digits from the description)  
Confidence: **1.0** when description clearly names that counterpart

### 5) Bank interest / tiny residuals

Rare tiny inflows with null/empty description (e.g. **11.57**) and no RVI candidate:

| Kind | `match_status` | `matched_ref_type` | `match_reason` (Thai) |
|---|---|---|---|
| Likely interest / bank credit | `matched` | `interest_income` | `ดอกเบี้ยเงินฝาก` |

Only when amount is tiny and no RVI exists nearby. Otherwise leave `unmatched`. **Do not** use `ignored` for interest.

## Expected coverage (probe, May+June 2026 inbound)

Approximate unique candidates observed in analysis (sanity check only — do not force these numbers):

- RVI same-day exact ≈ **58/61 (~95%)**
- Plus ±0.01 rounding ≈ **+1** → ~**59/61 (~97%)**
- Leftovers seen: missing voucher gap (e.g. Shopee `14,262` on 2026-06-30 with RVI sequence jump `033→035`), plus tiny interest

If your run lands far below that for the same months, re-check date parsing (ISO vs `YYYYMMDD`) and amount casts before inventing new rules.

## Possible duplicate statement rows (operator `ignored`)

Same economic movement can appear twice after overlapping KTB exports with different detail text (different fingerprints): same `account_no` + `txn_date` + `amount` + `direction` + `balance_after`, different `description` / fingerprint (e.g. `BSD14` vs `AirPay…`).

1. Keep the clearer / more detailed row on its normal match path.
2. Set the other row to `review` with `matched_ref_type = possible_duplicate`, `match_reason = อาจเป็นแถวซ้ำ — รอผู้ใช้ตั้งเป็นไม่ใช้`, and Thai notes naming the twin + asking the operator to set `ignored` (ไม่ใช้) if confirmed.
3. **Never** set `ignored` yourself — the monthly report skips operator-`ignored` rows only.

## Fields to write on each decision

Always set:

- `match_status`: `matched` | `review` | `unmatched` if still unknown after this pass
  - Start from `pending` or `unmatched` only; never write back to `pending`
  - **Never** write `ignored` (operator-only exclude-from-report)
  - Internal transfers among the six KCW accounts → `matched`
  - Operators own `resolved` / `manual` / `ignored` — do not touch those rows
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
- Force auto-`matched` outside strict date windows — use relaxed `review` with matched info + warning instead
- Leave `unmatched` when a plausible relaxed-window candidate exists — use `review` with matched refs

## End-of-run summary

Report briefly in English:

- Counts of `matched` / `review` / `unmatched`
- Confirm zero remaining `pending` or `unmatched` in scope (or list any still open and why)
- Breakdown by source: RVI / internal sweep / interest (`matched`)
- Any ±0.01 rounding pairs
- `possible_duplicate` reviews for the operator to set `ignored`
- Rows that need human review (missing vouchers, collisions)

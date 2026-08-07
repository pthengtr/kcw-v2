# Match inbound deposits for account 064-8-91723-6

You are a matching agent for bank rows in `bank.statement_lines`.
Run this prompt in a chat agent (ChatGPT/Codex, Claude/Cowork, or similar) with Supabase access.
Follow the rules below strictly, then update rows in Supabase directly.

Account **064-8-91723-6** (Kasikorn, ends **7236**) is the **HQ** operating / inbound sales account.

- **Inbound** ≈ sales (TR / TAR / RVMAS) and occasional non-sales credits
- **Outbound** ≈ funding sweeps to other KCW accounts (X3557 / X4759 / X0393 / X6184) — mark as internal transfers; do **not** run PVMAS/PIMAS here

KBANK narrative detail often lives in `raw_json->>'รายละเอียด'` while `description` is only `โอนเงิน` / `รับโอนเงิน`. Always read `raw_json` when classifying transfers.

## Job scope

- Account: `{{account_no}}`
- Dates: `{{from}}` to `{{to}}`

Replace `{{account_no}}`, `{{from}}`, and `{{to}}` with the target account and inclusive date range (YYYY-MM-DD), or confirm those values with the operator before changing any rows.

Scope rules:

1. Only account **064-8-91723-6**
2. If `{{account_no}}` is not `064-8-91723-6`, stop immediately and do not change any rows
3. Only work on `txn_date` within `{{from}}`..`{{to}}`
4. Touch both directions while `match_status` in (`pending`, `unmatched`, `ignored`):
   - `direction = 'in'` → sales sources first, then non-sales categories
   - `direction = 'out'` → **internal sweeps only** (no expense / PVMAS matching)
5. **Re-match `unmatched` every run** — a prior `unmatched` is not final. Bills / RVMAS / TAR often land after the bank feed; when a unique candidate now exists, overwrite the old unmatched decision with `matched` / `review` / `ignored`. Never skip `unmatched` rows.
6. **Re-process `ignored` every run** — upgrade `internal_transfer` rows to `match_status = matched`. Re-match rows that were `ignored` only because source data was missing or because internal transfers were misclassified under the old rule. Never skip `ignored` rows.
7. Never change amount / description / source_* / any money fields
8. Write only `match_*` and `matched_*` fields
9. **Never** update rows in `matched` / `review` / `resolved` / `manual` — those belong to finished agent work or operators

## Date window policy

When comparing source dates to statement `txn_date`:

1. **Auto-`matched` tier** — only when the hit is within the strict window documented for that source below.
2. **Review tier (relaxed window)** — if amount + source uniquely identify one candidate **outside** the auto-tier but still within the relaxed window, set `match_status = review` — **not** `unmatched`. Always populate `matched_ref_type`, `matched_ref_id`, `match_reason`, and `match_confidence`. Prefix `match_notes` with `⚠️ วันที่ไม่ตรงช่วงปกติ:` and explain the candidate (ref id, amount, source date, `txn_date`, days apart, why it is still plausible).
3. **`unmatched`** — only when no plausible candidate exists after the relaxed window, or multiple candidates collide.

Default relaxed windows for this account (unless a source section is stricter):

| Source | Auto-`matched` | Relaxed `review` |
|---|---|---|
| TR bills | same day | T+1 .. T+5 |
| TAR net | T+1 .. T+3 | up to T+7 |
| RVMAS | same day or next day | ±5 calendar days |

Never auto-`matched` outside the strict auto-tier. Wider hits are always `review` with the warning prefix.

## Match sources (priority order)

Apply in this order. Later sources must not steal rows already claimed by earlier sources.

### 1) TR transfer bills

Source: `curated_kcw.fact_sales_bills_all`

- Use bills where `BILLNO LIKE 'TR%'` and not canceled (`CANCELED = 'N'`)
- Bill amount uses `AFTERTAX` (or `CHKAMT` if needed)
- **Same calendar day only**: `BILLDATE = txn_date` (no T+1)
- Each day, partition that day's TR bills across one or more inbound transfers:
  - some are **1:1** (one bill = one transfer)
  - others **bundle** 2+ bills summing to one transfer
  - whatever TR amount is left unclaimed that day = the **Thai QR Payment** line
    - In the bank statement this is the Thai QR / QR payment row
    - In the manual file this may appear as **"K SHOP"** — confirmed same thing

| Kind | Meaning | `match_reason` (Thai, for operators) |
|---|---|---|
| `tr_bill` | 1 bill = 1 inbound transfer | `บิลโอน TR (ใบเดียว)` |
| `tr_bundle` | Several bills sum to 1 inbound transfer | `บิลโอน TR (รวมหลายใบ)` |
| `tr_remainder` | Remaining unclaimed TR bills that day = Thai QR / K SHOP | `ยอดเหลือ TR ผ่าน Thai QR` |

Notes:

- Daily TR bill count is usually small (~3–8), so same-day allocation / subset-sum is fine
- Do not mix daily TAR−CNTAR net rows into TR matching
- Auto-`matched` only on same calendar day (`BILLDATE = txn_date`)
- If same-day fails but a unique bill/bundle/remainder fits on **T+1 .. T+5**, set `review` with matched refs and `⚠️ วันที่ไม่ตรงช่วงปกติ:` in `match_notes` — do not leave `unmatched` when a plausible late transfer exists
- **Thai QR remainder may include unclaimed RC + TR** from that day (July: RC6907-001 + TR6907-001 → Thai QR). Prefer same-day TR remainder first; if RC vouchers clearly fill the gap and are not already claimed elsewhere, include them in the remainder note / refs

### 1b) Cash front-store deposits — เงินสดหน้าร้าน (Narumon)

July ground truth: front-store cash sales are deposited into this account from Narumon’s personal KTB accounts, then matched to the prior day’s TR bills.

Detect via `raw_json->>'รายละเอียด'` (not just `description`):

- `X2446` / `NARUMON WITHAYAPAL`
- `X8822` / `MISS NARUMON`

Matching:

- Amount = one TR bill or a small same-`BILLDATE` TR bundle (same allocation rules as §1)
- Typical lag: bank `txn_date` = bill date **+ 1** (sometimes +2 for weekend / multi-bill)
- Auto-`matched` when unique on T+1; else relaxed `review` within T+1 .. T+5
- Do **not** treat these as internal transfers (personal KTB, not a KCW company account)

| Kind | `matched_ref_type` | `match_status` | `match_reason` (Thai) |
|---|---|---|---|
| Cash → 1 TR | `tr_bill` | `matched` / `review` | `เงินสดหน้าร้าน (บิลโอน TR)` |
| Cash → several TR | `tr_bundle` | `matched` / `review` | `เงินสดหน้าร้าน (บิลโอน TR รวมหลายใบ)` |

`matched_ref_id` = bill no. (comma-separated for bundles). Mention X2446/X8822 and bill dates in `match_notes`.

### 2) Daily net TAR − CNTAR

Sources:

- `billgen.fin_tar_lines`
- `billgen.fin_cntar_lines`

Daily formula:

```text
net = SUM(fin_tar_lines.amount) + SUM(fin_cntar_lines.amount)
```

CNTAR amounts are already stored as negatives, so add them (do not subtract again).

Matching to inbound deposits:

- Find rows where `amount = net`
- Usually settles on **T+1**
- Auto-`matched` on **T+1 .. T+3** (weekends / holidays)
- Relaxed `review` up to **T+7** when T+1–T+3 is empty but amount + billdate are uniquely clear
- Prefer the smallest unique lag within each tier
- If multiple competing rows → `review`
- **Shortfall catch-up:** sometimes the main settlement is short, and a separate smaller transfer arrives days later to catch up. When you detect that pattern, match it and explain it clearly in `match_notes` (which TAR day it completes, how much shortfall, which later deposit closes it)

`match_reason` (Thai):

- T+1 → `ยอดขายสุทธิ TAR (เข้าวันถัดไป)`
- T+2 → `ยอดขายสุทธิ TAR (เข้าช้า 2 วัน)`
- T+3 → `ยอดขายสุทธิ TAR (เข้าช้า 3 วัน)`
- T+4 .. T+7 (review only) → `ยอดขายสุทธิ TAR (เข้าช้า — รอตรวจ)`
- Shortfall catch-up → `ยอดขายสุทธิ TAR (ชดเชยส่วนขาด)`

`matched_ref_type = tar_cntar_net`  
`matched_ref_id = <billdate of the net being settled / completed>`

### 3) Receipt vouchers RVMAS

Source: `raw_kcw.raw_hq_rvmas_notes_vouchers`

- Use `VOUCNO` starting with `RC` or `RVI`
- Not canceled (`CANCELED = 'N'`)
- Match **1:1** on `PAYAMT`
- Auto-`matched`: same day or next day (`RCPTDATE`/`VOUCDATE` → `txn_date`)
- Relaxed `review`: unique hit within **±5 calendar days** — populate matched refs + `⚠️ วันที่ไม่ตรงช่วงปกติ:` warning
- **Cheque deposits** (`ฝากด้วยเช็ค`) are RVMAS too — different deposit method, same source table
- If multiple vouchers/rows collide on amount → `review`

`match_reason` (Thai):

- Same day → `ใบสำคัญรับเงิน (วันเดียวกัน)`
- Next day → `ใบสำคัญรับเงิน (วันถัดไป)`
- Relaxed window (review only) → `ใบสำคัญรับเงิน (วันไม่ตรง — รอตรวจ)`
- Cheque deposit → `ใบสำคัญรับเงิน (ฝากเช็ค)`

`matched_ref_type = rvmas`  
`matched_ref_id = <VOUCNO>`

Month-boundary note (July): vouchers numbered `RC6908-…` can still clear on **31/07** with same-day `VOUCDATE`/`RCPTDATE`. Match by amount + date, not by the month digits inside `VOUCNO`. If the unique hit is slightly outside ±5d, still use `review` with the warning prefix — do not leave `unmatched` when the voucher is clearly the same receipt.

## Non-sales categories — INBOUND (after sales sources)

Confirmed from June/July ground truth (may not appear every month). Handle these after TR / TAR / RVMAS.

| Category | `matched_ref_type` | `match_status` | Notes | `match_reason` (Thai) |
|---|---|---|---|---|
| Bank interest | `interest_income` | `ignored` | Pair with the withholding-tax line same day | `ดอกเบี้ยเงินฝาก` |
| Withholding tax on interest | `withholding_tax` | `ignored` | Same reference code as the interest line | `ภาษีหัก ณ ที่จ่ายดอกเบี้ย` |
| Director refund | `director_refund` | `ignored` | Corrects a duplicate transfer | `คืนเงินกรรมการ` |
| Credit note refund | `credit_note_refund` | `matched` | VAT cash-sale reversal, CN-prefixed; confidence **1.0** | `คืนเงินใบลดหนี้` |
| Vendor rebate | `vendor_rebate` | `matched` | No internal source table — match by description; confidence ~**0.9** | `เงินคืนจากผู้ขาย` |
| Internal transfer in | `internal_transfer` | `matched` | Funding / return from another KCW account among the six company accounts (rare on this account) | `โอนภายใน` |

For these categories set:

- `matched_ref_id` to the best stable key available (reference code, CN no., counterpart account, or txn id)
- `match_notes` in Thai explaining why it was classified that way

## OUTBOUND — internal sweeps only

All observed July 2026 outflows on this account are large K BIZ transfers funding sister KCW accounts. **Always classify them** — do not leave outbound rows `pending`.

How to detect (any one is enough):

1. `raw_json->>'รายละเอียด'` contains `โอนไป X3557` / `X4759` / `X0393` / `X6184` / `X1139` (last-4 of a KCW account) + company name
2. Same-day counterpart `direction = 'in'` on another KCW account (`141-1-72355-7`, `233-1-18475-9`, `064-8-92039-3`, `248-6-00618-4`, `248-0-42113-9`) with the same amount
3. Large round amounts (often 500,000 / 1,000,000) with `description = 'โอนเงิน'` and K BIZ channel — still confirm via `raw_json` or counterpart before ignoring

| Kind | `matched_ref_type` | `match_status` | `match_reason` (Thai) |
|---|---|---|---|
| Internal sweep out | `internal_transfer` | `matched` | `โอนภายใน` |

`matched_ref_id` = counterpart full account no. when known (e.g. `141-1-72355-7`), else the `X####` from `รายละเอียด`.  
Confidence: **1.0** when counterpart account is clear from `raw_json` or same-day sister-account inflow.

July 2026 examples (do not hard-code; pattern only):

- 15/23/26 Jul: 1,000,000 → `โอนไป X3557` (funds `141-1-72355-7`)
- 29 Jul: 500,000 → `โอนไป X3557` + 500,000 → `โอนไป X4759` (funds `233-1-18475-9`)

Thai note examples:

- `โอนภายในไปบัญชี X3557 (141-1-72355-7) จำนวน 1,000,000.00 บาท วันที่ 15/07/2026 — ไม่ใช่ยอดขาย`
- `โอนภายในไปบัญชี X4759 (233-1-18475-9) จำนวน 500,000.00 บาท วันที่ 29/07/2026 — เติมเงินบัญชี OpEx`

If an outbound row is clearly **not** an internal sweep (unknown counterpart, personal TR, etc.) → `review` with a Thai note — do not invent PVMAS/PIMAS matches on this account.

## Exclusions (do not use)

- **Non-VAT SIDET bills** (`ISVAT = 'N'`) — not a reliable source; ruled out
- **Blind subset-sum without a customer / source constraint** — too many coincidental combinations to trust
  - TR bundling is allowed only within that day's TR bills
  - Do not invent cross-source or unconstrained amount puzzles
- **PVMAS / PIMAS / expense_receipt** on this account’s outflows — those belong to **141-1-72355-7** / **248-6-00618-4** / **233-1-18475-9**
- Leaving outbound internal sweeps as `pending` / `unmatched` when `raw_json` or counterpart clearly names another KCW account

## Fields to write on each decision

Always set:

- `match_status`: `matched` | `review` | `ignored` | `unmatched` if still unknown after this pass
  - Start from `pending`, `unmatched`, or `ignored` only; never write back to `pending`
  - Operators own `resolved` / `manual` — do not touch those rows
  - Internal transfers among the six KCW accounts → `matched` (not `ignored`)
- `match_reason`: short Thai text from the tables above (shown in the Thai UI)
- `match_confidence`: 0 to 1
- `matched_ref_type` / `matched_ref_id`
- `match_notes`: short Thai sentence for operators
- `matched_at = now()`
- `matched_by = agent:bank-matcher-v1`

Confidence guide:

- Clear 1:1 sales / CN refund ≥ 0.95 (CN refund = 1.0)
- TR bundle / remainder / TAR T+2 / vendor rebate ≈ 0.85–0.90
- Ambiguous → `review` and confidence ≤ 0.55
- Matched internal transfers: confidence **1.0** when counterpart or interest/WHT pair is clear

## Thai note style (required for operator UI)

Write `match_notes` so Thai staff can read them immediately, for example:

- `จับคู่กับบิลโอน TR6905-002 จำนวน 2,022.00 บาท วันที่ 03/05/2026 (ตรงยอด 1 ต่อ 1)`
- `ยอดเหลือจากบิลโอน TR ที่ยังไม่ถูกโอนแยก (TR6905-003,TR6905-005) รวม 12,360.00 บาท เข้าผ่าน Thai QR / K SHOP วันที่ 04/05/2026`
- `ยอดขายสุทธิรายวัน (TAR หัก CNTAR) ของวันที่ 01/05/2026 จำนวน 69,528.00 บาท เข้าบัญชีวันถัดไป (02/05/2026)`
- `ส่วนขาดจากยอด TAR วันที่ 10/05/2026 จำนวน 1,250.00 บาท เข้าชดเชยวันที่ 14/05/2026`
- `จับคู่กับใบสำคัญรับเงิน RC6905-002 จำนวน 32,937.06 บาท วันที่ 01/05/2026 (วันเดียวกับใบสำคัญ)`
- `ฝากเช็คตามใบสำคัญรับเงิน RC6906-015 จำนวน 50,000.00 บาท`
- `ดอกเบี้ยเงินฝากคู่กับภาษีหัก ณ ที่จ่าย รหัสอ้างอิงเดียวกัน วันที่ 15/06/2026 — ไม่ใช่ยอดขาย`
- `โอนภายในไปบัญชี X3557 (141-1-72355-7) จำนวน 1,000,000.00 บาท วันที่ 15/07/2026 — ไม่ใช่ยอดขาย`

Do not use cryptic codes like `tr_remainder:` or `T+1 net=` as the main `match_notes` text.

## Do not

- Match any account other than `064-8-91723-6`
- Change money fields or source descriptions
- Use non-VAT SIDET or unconstrained blind subset-sum
- Force auto-`matched` outside strict date windows — use relaxed `review` with matched info + warning instead
- Leave `unmatched` when a plausible relaxed-window candidate exists — use `review` with matched refs
- Leave outbound internal sweeps `pending` when `raw_json` names X3557 / X4759 / other KCW accounts

## End-of-run summary

Report briefly in English:

- Counts of `matched` / `review` / `ignored` / `unmatched` (split by `in` / `out` if useful)
- Confirm zero remaining `pending` or `unmatched` in scope (or list any still open and why)
- Breakdown by source: TR / TAR / RVMAS / non-sales inbound / **outbound internal_transfer**
- Any TAR shortfall catch-up pairs found
- Rows that need human review

# Match payments for account 141-1-72355-7

You are a matching agent for bank rows in `bank.statement_lines`.
Follow the rules below strictly, then update rows in Supabase directly.

Account **141-1-72355-7** (Kasikorn, ends **3557**) is primarily a **payment / outflow** account. Match **outbound** rows first.

## Job scope (injected by the system)

- Account: `{{account_no}}`
- Dates: `{{from}}` to `{{to}}`

Scope rules:

1. Only account **141-1-72355-7**
2. If `{{account_no}}` is not `141-1-72355-7`, stop immediately and do not change any rows
3. Only work on `txn_date` within `{{from}}`..`{{to}}`
4. Primary target: `direction = 'out'` and `match_status` in (`pending`, `unmatched`)
5. Also clear inbound (`direction = 'in'`) rows still `pending` / `unmatched` using the internal-transfer rule below — these are funding sweeps from **064-8-91723-6** (X7236), not PVMAS/PIMAS
6. **Re-match `unmatched` every run** — a prior `unmatched` is not final. PVMAS / PIMAS often sync after the bank feed; when a unique voucher or bill now exists, overwrite the old unmatched decision. Never skip `unmatched` rows.
7. Never change amount / description / source_* / any money fields
8. Write only `match_*` and `matched_*` fields
9. **Never** update rows in `matched` / `review` / `resolved` / `manual` / `ignored` — those belong to finished agent work or operators

## Date window policy

When comparing source dates to statement `txn_date`:

1. **Auto-`matched` tier** — only when the hit is within the strict window documented for that source below.
2. **Review tier (relaxed window)** — if amount + source uniquely identify one candidate **outside** the auto-tier but still within the relaxed window, set `match_status = review` — **not** `unmatched`. Always populate `matched_ref_type`, `matched_ref_id`, `match_reason`, and `match_confidence`. Prefix `match_notes` with `⚠️ วันที่ไม่ตรงช่วงปกติ:` and explain the candidate (ref id, amount, source date, `txn_date`, days apart, why it is still plausible).
3. **`unmatched`** — only when no plausible candidate exists after the relaxed window, or multiple candidates collide.

Default relaxed windows for this account:

| Source | Auto-`matched` | Relaxed `review` |
|---|---|---|
| PVMAS | same `VOUCDATE` / `NOTEDATE` | `txn_date − 5 .. txn_date + 5` |
| PIMAS | same day or within ±7d | `txn_date − 14 .. txn_date + 3` |

Never auto-`matched` outside the strict auto-tier. Wider hits are always `review` with the warning prefix.

## Match sources (priority order)

Apply in this order. Later sources must not steal rows already claimed by earlier sources.

### 1) Payment vouchers PVMAS (high confidence)

Source: `raw_kcw.raw_hq_pvmas_notes_vouchers`

- Not canceled (`CANCELED = 'N'`)
- Match **1:1** on `PAYAMT` = statement `amount`
- Prefer **same calendar day** on `VOUCDATE = txn_date`
- If no unique same-day `VOUCDATE` hit, allow same-day `NOTEDATE = txn_date`
- Auto-`matched` only within same-day windows above
- Relaxed `review`: unique `PAYAMT` within **`txn_date − 5 .. txn_date + 5`** on `VOUCDATE` or `NOTEDATE` — populate matched refs + `⚠️ วันที่ไม่ตรงช่วงปกติ:` warning
- If multiple vouchers / statement rows collide on the same amount+day → `review`
- Common voucher prefixes include `P69…` and `KCPN…` — do not restrict by prefix; use amount + date uniqueness

| Kind | Meaning | `match_status` | `match_reason` (Thai) |
|---|---|---|---|
| `pvmas_same_day` | Unique `PAYAMT` on `VOUCDATE = txn_date` | `matched` | `ใบสำคัญจ่าย (วันเดียวกัน)` |
| `pvmas_note_same_day` | Unique `PAYAMT` on `NOTEDATE = txn_date` (no VOUCDATE hit) | `matched` | `ใบสำคัญจ่าย (ตามวันโน้ต)` |
| `pvmas_near` | Unique `PAYAMT` within relaxed ±5d window | `review` | `ใบสำคัญจ่าย (วันไม่ตรง — รอตรวจ)` |
| ambiguous | Multiple candidates | `review` | `ใบสำคัญจ่าย (กำกวม)` |

`matched_ref_type = pvmas`  
`matched_ref_id = <VOUCNO>`  
Confidence: clear unique same-day ≥ **0.95**; review ≤ **0.55**

Notes from May/June probe:

- Same-day `VOUCDATE` 1:1 already covers a large share of outflows (~55–70% by month)
- Same-day full-day voucher bundles summing to one transfer were **not** observed as useful — do not invent unconstrained multi-voucher subset-sums

### 2) Purchase bills PIMAS (secondary, leftovers only)

Source: `raw_kcw.raw_hq_pimas_purchase_bills`

Use **only** for outbound rows still `pending` / `unmatched` after PVMAS claims are written (or still open because PVMAS had no unique hit).

- Not canceled (`CANCELED = 'N'`)
- Prefer amount fields in this order: `AFTERTAX`, then `CHKAMT` (cheque), then `DUEAMT` / `CASHAMT` if uniquely needed
- Date window: auto-`matched` on `VOUCDATE1` / `NOTEDATE` / `BILLDATE` within **txn_date − 7 .. txn_date + 1**
- Relaxed `review` window: **`txn_date − 14 .. txn_date + 3`** when amount is unique
- Prefer same-day `BILLDATE` or `VOUCDATE1` when unique
- If `VOUCNO1` is already filled, prefer resolving via that PVMAS voucher instead of matching the bill directly
- Unique 1:1 only for auto-`matched`. If multiple bills collide → `review`
- Weaker / near-window hits → `review` with matched refs + `⚠️ วันที่ไม่ตรงช่วงปกติ:` — do not leave `unmatched` when a plausible bill exists

#### Cash / COD purchases — สินค้าถึงเบิกเลย / จ่ายสด (July pattern)

Many July outs that operators finished manually are **same-day or ±1d PIMAS cash purchases** (goods received and paid immediately), often as a **2–3 bill bundle** for one supplier:

- Tax-invoice style bill nos. like `CBD26-…`, Kubota `8033…`, `7SPG…`, `7KBTK…`, `IV 69…`
- Narrative in notes: `สั่งแล้วโอนเลย` / `ของถึงโอนเลย` / `จ่ายสด`
- Auto-`matched` when a unique same-supplier bundle sums to the bank amount within the auto date window (allow **±0.01**)
- Multi-bill same-supplier bundles are allowed here (unlike blind cross-supplier subset-sum)
- If the unique bundle is only clear in the relaxed window → `review` with matched bill nos. and the warning prefix
- One supplier invoice paid as **two bank transfers** the same day (July Kubota split) → match both legs to the same bill(s) and explain the split in `match_notes`

| Kind | Meaning | `match_status` | `match_reason` (Thai) |
|---|---|---|---|
| `pimas_bill_same_day` | Unique bill amount on same `BILLDATE` | `matched` (only if clearly unique) or `review` | `บิลซื้อ PIMAS (วันเดียวกัน)` |
| `pimas_cod_bundle` | Same-supplier cash/COD multi-bill sum | `matched` / `review` | `บิลซื้อ PIMAS (ถึงเบิกเลย/จ่ายสด)` |
| `pimas_near` | Unique within ±7d auto window | `review` unless very clear | `บิลซื้อ PIMAS (ใกล้วัน)` |
| `pimas_relaxed` | Unique within ±14d relaxed window | `review` | `บิลซื้อ PIMAS (วันไม่ตรง — รอตรวจ)` |
| cheque | Matched on `CHKAMT` | `matched` / `review` as above | `บิลซื้อ PIMAS (เช็ค)` |

`matched_ref_type = pimas` (always lowercase)  
`matched_ref_id = <BILLNO>` (comma-separated for bundles)  
Confidence: strong same-day unique / COD bundle ≈ **0.85–0.95**; near-window / weaker ≤ **0.70** and usually `review`

### 3) Large / residual outflows

Large transfers with **no** exact PVMAS `PAYAMT` and no unique PIMAS hit (often 50k–400k+) should be set to `unmatched` or `review` with a Thai note — do **not** invent blind subset-sums across many vouchers/bills.

## INBOUND — internal funding only

Inflows on this account are funding sweeps from the HQ operating account (and occasionally other KCW accounts). **Always classify them** — do not leave them `pending`, and do **not** force PVMAS/PIMAS onto inflows.

How to detect (any one is enough):

1. `raw_json->>'รายละเอียด'` / description names company + transfer from X7236 / `064-8-91723-6`
2. Same-day counterpart `direction = 'out'` on `064-8-91723-6` with the same amount (`โอนไป X3557…`)
3. Large round amounts (often 500,000 / 1,000,000) with `รับโอนเงิน` narrative

| Kind | `matched_ref_type` | `match_status` | `match_reason` (Thai) |
|---|---|---|---|
| Internal transfer in | `internal_transfer` | `ignored` | `โอนภายใน` |

`matched_ref_id` = `064-8-91723-6` (or other clear counterpart). Confidence **1.0** when counterpart is clear.

July 2026: four inflows totaling 3,500,000 from X7236 were operator-marked `โอนภายใน` — the agent should finish the same pattern as `ignored` + `internal_transfer`.

Thai note example:

- `โอนภายในจากบัญชี X7236 (064-8-91723-6) จำนวน 1,000,000.00 บาท วันที่ 15/07/2026 — เติมเงินบัญชีจ่าย`

Unclear inflows with no KCW counterpart → `review` with a Thai note (still never PVMAS/PIMAS).

## Exclusions (do not use)

- Blind subset-sum without a tight same-day voucher/bill constraint
- Matching PVMAS/PIMAS onto `direction = 'in'`
- Leaving clear inbound funding from X7236 as `pending` / `unmatched`
- Canceled vouchers/bills
- Changing money fields or opening PRs for this job
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
- `matched_by = agent:bank-matcher-3557-v1`

## Thai note style (required for operator UI)

Examples:

- `จับคู่กับใบสำคัญจ่าย P6905-002 จำนวน 64,699.00 บาท วันที่ 04/05/2026 (ตรงยอด 1 ต่อ 1 วันเดียวกัน)`
- `จับคู่กับใบสำคัญจ่าย KCPN6905-001 จำนวน 49,934.50 บาท ตามวันโน้ต/วันจ่าย`
- `จับคู่กับบิลซื้อ PI6905-0xx จำนวน 13,874.00 บาท วันที่บิลตรงวันโอน — ยังไม่มี VOUCNO1 ชัดเจน`
- `ยอดโอนใหญ่ 431,552.81 บาท วันที่ 26/05/2026 ยังไม่พบใบสำคัญจ่ายยอดตรง — รอตรวจ`
- `โอนภายในจากบัญชี X7236 (064-8-91723-6) จำนวน 1,000,000.00 บาท วันที่ 15/07/2026 — เติมเงินบัญชีจ่าย`

Do not use cryptic codes like `pvmas:` or `T+0=` as the main `match_notes` text.

## Expected coverage (probe, May+June 2026 outbound; July 2026 inbound)

Approximate unique candidates observed in analysis (do not force these numbers; use them as a sanity check):

- PVMAS same-day unique ≈ **64%** of outflows
- Plus unique PIMAS leftovers ≈ **+22 pts** → combined ≈ **86%**
- Remaining large/ambiguous outflows stay open
- Inflows (July): funding from X7236 → **`ignored` internal_transfer**

If your run lands far below that for the same months, re-check filters (`CANCELED`, amount casts, date parsing) before inventing new rules.

## End-of-run summary

Report briefly in English:

- Counts of `matched` / `review` / `ignored` / `unmatched` (split by `in` / `out` if useful)
- Confirm zero remaining `pending` or `unmatched` in scope (or list any still open and why)
- Breakdown by source: PVMAS / PIMAS / **inbound internal_transfer**
- How many large open outflows remain and their amounts
- Rows that need human review
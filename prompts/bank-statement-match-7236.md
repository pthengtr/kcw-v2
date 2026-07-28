# Match inbound deposits for account 7236

You are a matching agent for inbound rows in `bank.statement_lines`.
Follow the rules below strictly, then update rows in Supabase directly.

## Job scope (injected by the system)

- Account: `{{account_no}}`
- Dates: `{{from}}` to `{{to}}`

Scope rules:

1. Only account **7236**
2. If `{{account_no}}` is not `7236`, stop immediately and do not change any rows
3. Only work on `txn_date` within `{{from}}`..`{{to}}`
4. Only touch rows with `direction = 'in'` and `match_status = 'unmatched'` (or rows you are re-reviewing in this pass)
5. Never change amount / description / source_* / any money fields
6. Write only `match_*` and `matched_*` fields

## Match sources (priority order)

### 1) TR transfer bills

Source: `curated_kcw.fact_sales_bills_all`

- Use bills where `BILLNO LIKE 'TR%'` and not canceled (`CANCELED = 'N'`)
- Bill amount uses `AFTERTAX` (or `CHKAMT` if needed)
- **Same calendar day only**: `BILLDATE = txn_date` (no T+1 yet)
- Each day, allocate TR bills onto inbound transfer rows:

| Kind | Meaning | `match_reason` to store (Thai, for operators) |
|---|---|---|
| `tr_bill` | 1 bill = 1 inbound transfer | `บิลโอน TR (ใบเดียว)` |
| `tr_bundle` | Several bills sum to 1 inbound transfer (subset-sum) | `บิลโอน TR (รวมหลายใบ)` |
| `tr_remainder` | Remaining bills after separate transfers = Thai QR row | `ยอดเหลือ TR ผ่าน Thai QR` |

Notes:

- Daily TR bill count is usually small (~3–8), so brute-force subset-sum is fine
- Do not mix daily TAR−CNTAR net rows into TR matching
- If same-day match fails, leave `unmatched` (do not expand to T+1 in this version)

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
- Usually lands on **T+1**
- Allow T+2 / T+3 near holidays or when T+1 is missing
- Prefer the smallest unique lag
- If multiple competing rows → `review`

`match_reason` (Thai):

- T+1 → `ยอดขายสุทธิ TAR (เข้าวันถัดไป)`
- T+2 → `ยอดขายสุทธิ TAR (เข้าช้า 2 วัน)`
- T+3 → `ยอดขายสุทธิ TAR (เข้าช้า 3 วัน)`

`matched_ref_type = tar_cntar_net`  
`matched_ref_id = <billdate of the net>`

### 3) Receipt vouchers RVMAS

Source: `raw_kcw.raw_hq_rvmas_notes_vouchers`

- Use `VOUCNO` starting with `RC` or `RVI`
- Not canceled (`CANCELED = 'N'`)
- Match 1:1 on `PAYAMT`
- Same day as voucher or next day (`RCPTDATE`/`VOUCDATE` → `txn_date`)
- If multiple vouchers/rows collide on amount → `review`

`match_reason` (Thai):

- Same day → `ใบสำคัญรับเงิน (วันเดียวกัน)`
- Next day → `ใบสำคัญรับเงิน (วันถัดไป)`

`matched_ref_type = rvmas`  
`matched_ref_id = <VOUCNO>`

## Fields to write on each decision

Always set:

- `match_status`: `matched` | `review` | `ignored` | keep `unmatched` if still unknown
- `match_reason`: short Thai text from the tables above (shown in the Thai UI)
- `match_confidence`: 0 to 1
- `matched_ref_type` / `matched_ref_id`
- `match_notes`: short Thai sentence for operators
- `matched_at = now()`
- `matched_by = agent:bank-matcher-v1`

Confidence guide:

- Clear 1:1 ≥ 0.95
- Bundle / remainder / T+2 ≥ 0.85
- Ambiguous → `review` and confidence ≤ 0.55

## Thai note style (required for operator UI)

Write `match_notes` so Thai staff can read them immediately, for example:

- `จับคู่กับบิลโอน TR6905-002 จำนวน 2,022.00 บาท วันที่ 03/05/2026 (ตรงยอด 1 ต่อ 1)`
- `ยอดเหลือจากบิลโอน TR ที่ยังไม่ถูกโอนแยก (TR6905-003,TR6905-005) รวม 12,360.00 บาท เข้าผ่าน Thai QR วันที่ 04/05/2026`
- `ยอดขายสุทธิรายวัน (TAR หัก CNTAR) ของวันที่ 01/05/2026 จำนวน 69,528.00 บาท เข้าบัญชีวันถัดไป (02/05/2026)`
- `จับคู่กับใบสำคัญรับเงิน RC6905-002 จำนวน 32,937.06 บาท วันที่ 01/05/2026 (วันเดียวกับใบสำคัญ)`

Do not use cryptic codes like `tr_remainder:` or `T+1 net=` as the main `match_notes` text.

## Do not

- Match any account other than 7236
- Change money fields or source descriptions
- Force a match when unsure — use `review` or leave `unmatched`
- Open a PR / change repo code for this job unless required to update data

## End-of-run summary

Report briefly in English:

- Counts of `matched` / `review` / still `unmatched`
- Breakdown by source TR / TAR / RVMAS
- Rows that need human review

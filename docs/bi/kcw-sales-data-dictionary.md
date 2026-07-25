# KCW sales data dictionary

Source of truth for naming, grain, joins, codes, and billing rules used by the sales BI dashboard.

Schemas: `raw_kcw` (source) · `curated_kcw` (BI-ready)

Status legend:

- **Confirmed** — verified from data inspection and/or business owner
- **TBD** — needs owner confirmation before using in metrics
- **Inferred** — looks true from data patterns; not yet locked

Last reviewed: 2026-07-25

---

## 1. Schema map (sales)

| Object | Kind | Grain | Branches (as of 2026-07-25) | Approx rows | Role in BI |
|--------|------|-------|-----------------------------|------------:|------------|
| `curated_kcw.fact_sales_all` | table | **1 row = 1 bill line item** | HQ, SYP | ~533k | Product qty, unit price, line amount, cost |
| `curated_kcw.fact_sales_bills_all` | table | **1 row = 1 bill header** | HQ, SYP | ~195k | Bill totals, payment, customer, salesman |
| `curated_kcw.fact_sales_all_stg` | staging | same as line fact | — | — | Upload/staging twin; not for reporting |
| `curated_kcw.fact_sales_bills_all_stg` | staging | same as bill fact | — | — | Upload/staging twin; not for reporting |

**Confirmed:** Use final tables (`fact_sales_all`, `fact_sales_bills_all`) for dashboards, not `_stg`.

**TBD:** Full inventory of other `curated_kcw` / `raw_kcw` objects relevant to BI (products, customers, purchases, etc.).

---

## 2. Relationship & join keys

```
fact_sales_bills_all          fact_sales_all
(1 bill header)   1 ──< N     (line items)
```

| Key | Tables | Notes |
|-----|--------|-------|
| `("BRANCH", "BILLNO")` | bills ↔ lines | **Confirmed** primary join |
| `"BRANCH_BILLNO"` | lines only | Composite helper like `HQ-8K69-0013225` |

### Join coverage (rechecked after SYP bill upload fix, 2026-07-25)

| Branch | Line bills | Matched headers | Line-only missing |
|--------|----------:|----------------:|------------------:|
| HQ | 174,757 | 174,757 | 0 |
| SYP | 20,567 | 20,567 | 0 |
| **All** | **195,324** | **195,324** | **0** |

Bill headers with **no** matching lines: **29** (all HQ). Mostly odd headers — see [§7 Gotchas](#7-gotchas--data-quality).

**Confirmed:** Date span for both facts roughly **2023-07-25 → 2026-07-25** (SYP bill headers start **2025-06-23**).

---

## 3. Global conventions

| Topic | Rule | Status |
|-------|------|--------|
| Column casing | Business columns are **UPPERCASE**; quote in SQL: `"BILLNO"` | Confirmed |
| Data types | Nearly all business fields stored as **`text`** (including amounts) | Confirmed |
| Numeric use | Cast with care, e.g. `"AMOUNT"::numeric`; prefer `"AMOUNT_NUM"` / `"PRICE_NUM"` on lines when present | Confirmed / prefer |
| Branches | Known values: `HQ`, `SYP` | Confirmed |
| Staging vs prod | Report from non-`_stg` tables | Confirmed |
| RLS | Currently **disabled** on curated sales tables — treat as private BI data | Confirmed (security follow-up TBD) |

---

## 4. `fact_sales_all` — line items

### 4.1 Purpose

One row per product (or charge line) on a sales bill. Use for product mix, quantity, line revenue, and cost/margin at line level.

### 4.2 Column glossary

| Column | Meaning | Status | Notes |
|--------|---------|--------|-------|
| `_ingested_at` | Row load timestamp | Confirmed | Pipeline metadata |
| `_source_file` | Source file name | Confirmed | Pipeline metadata |
| `BRANCH` | Branch code | Confirmed | `HQ`, `SYP` |
| `BILLDATE` | Bill date | Confirmed | Text `YYYY-MM-DD` |
| `BILLNO` | Bill number | Confirmed | Part of join key |
| `BRANCH_BILLNO` | `BRANCH` + bill no helper | Confirmed | e.g. `HQ-8K69-0013225` |
| `BILLTYPE` | Raw bill type code | TBD | Seen: `0`, `1`, `2` (and rare others on bills) |
| `BILLTYPE_STD` | Standardized bill type | TBD | Seen: `TAR`, `TF`, `TFV`, `TAD`, `TD`, `TR`, `DN`, `CN`, `UNKNOWN` — meanings TBD |
| `JOURMODE` | Journal / posting mode | TBD | Seen: `0`, `1`, `2` |
| `BCODE` | Product / item code | Confirmed (name) | Item SKU-like code |
| `DETAIL` | Product description | Confirmed | Thai/English text |
| `QTY` | Quantity sold | Confirmed | Text numeric |
| `UI` | Unit of measure | Confirmed | e.g. `หน่วย`, `ชุด` |
| `MTP` | Multiplier / packing factor? | TBD | Often `1.0` |
| `PRICE` | Unit selling price | Confirmed (name) | Text; also `PRICE_NUM` |
| `XPRICE` | Appears related to cost/ref price | Inferred | Often close to `LAST_PURCHASE_COST` |
| `DISCNT1`…`DISCNT4` | Discount fields | TBD | Meaning of each slot TBD |
| `DED` | Deduction | TBD | |
| `VAT` | VAT amount on line | TBD | Often null on samples |
| `AMOUNT` | Line amount | Confirmed (name) | Prefer `AMOUNT_NUM` for math |
| `PRICE_NUM` | Numeric price helper | Confirmed | Text still; curated helper |
| `AMOUNT_NUM` | Numeric amount helper | Confirmed | Text still; curated helper |
| `TAXIC` | Tax indicator | TBD | |
| `ISVAT` | VAT flag | TBD | |
| `ACCTNO` | Account / customer short name? | TBD | Sometimes Thai nickname |
| `ACCT_NO` | Alternate account field | TBD | Differs from `ACCTNO` — clarify |
| `PAID` | Paid flag on line | TBD | Seen `Y` |
| `STATUS` | Line/bill status | TBD | Seen `1.0`, `8.0` |
| `DONE` | Done flag | TBD | Mostly `N` |
| `CANCELED` | Canceled flag | Confirmed | `Y` / `N` |
| `IS_VALID` | Curated validity flag | Confirmed | `True` / `False` (text) |
| `INVALID_REASON` | Why invalid | Confirmed | e.g. `CANCELED`, `BAD_BCODE`, `BAD_AMOUNT`, `BAD_PRICE` (can combine with `\|`) |
| `ROW_ID` | Curated row id | Confirmed | |
| `LAST_PURCHASE_DATE` | Last purchase date for cost | Confirmed (name) | |
| `LAST_PURCHASE_COST` | Last purchase unit cost | Confirmed (name) | |
| `COST_STATUS` | Cost lookup status | Confirmed | `OK`, `UNKNOWN` |

### 4.3 Validity (line)

| `IS_VALID` | Typical reasons when false | Status |
|------------|----------------------------|--------|
| `True` | — | Confirmed (~529k rows) |
| `False` | `CANCELED`, `BAD_BCODE`, `BAD_AMOUNT`, `BAD_PRICE` | Confirmed |

**TBD — default BI filter for “good sales lines”:**

```sql
-- PROPOSED (not locked):
WHERE "IS_VALID" = 'True'
  AND "CANCELED" = 'N'
```

Owner: confirm whether `STATUS`, `JOURMODE`, and `BILLTYPE_STD` must also be filtered.

---

## 5. `fact_sales_bills_all` — bill headers

### 5.1 Purpose

One row per bill. Use for bill count, bill totals (before/after tax), payment status, customer, terms, salesman.

### 5.2 Column glossary

| Column | Meaning | Status | Notes |
|--------|---------|--------|-------|
| `_ingested_at` | Row load timestamp | Confirmed | |
| `_source_file` | Source file | Confirmed | |
| `BRANCH` | Branch code | Confirmed | `HQ`, `SYP` |
| `JOURMODE` | Journal mode | TBD | Seen `0`, `1`, `2` |
| `JOURTYPE` | Journal type | TBD | Mostly `SJ`; rare `AR` |
| `JOURDATE` / `JOURNO` / `JOURTIME` | Journal date/no/time | TBD | |
| `DEPTNO` / `BOOKNO` | Dept / book | TBD | |
| `BILLTYPE` | Raw bill type | TBD | Seen `0`, `1`, `2`, `R` |
| `BILLTYPE_STD` | Standardized bill type | TBD | Same family as lines |
| `BILLDATE` | Bill date | Confirmed | Text datetime-like |
| `BILLTIME` | Bill time | Confirmed | e.g. ` 1729` |
| `BILLNO` | Bill number | Confirmed | Join key with `BRANCH` |
| `LINES` | Number of lines on bill | Confirmed (name) | Text; can be `0` / null on orphans |
| `TAXIC` | Tax indicator | TBD | Seen `N` |
| `DISCOUNT` | Bill discount | TBD | |
| `DEDUCT` | Bill deduction | TBD | |
| `BEFORETAX` | Amount before tax | Confirmed (name) | Main pre-tax total candidate |
| `VAT` | VAT | TBD | |
| `TAX` | Tax | TBD | |
| `AFTERTAX` | Amount after tax | Confirmed (name) | Main bill total candidate |
| `EXEMPT` | Tax exempt amount | TBD | |
| `SVCCHG` | Service charge | TBD | |
| `PAID` | Paid flag | TBD | `Y` / `N` |
| `CASHED` | Cashed / cash-received flag | TBD | `Y` / `N` |
| `CASHAMT` | Cash amount | TBD | |
| `CHKAMT` | Check / transfer amount? | TBD | Often used when paid non-cash-label |
| `DUEAMT` | Amount still due | TBD | |
| `PAYSTAT` | Payment status code | TBD | Seen: null, `$`, `=`, `%`, `&` |
| `ACCTNO` | Customer account code | TBD | |
| `ACCTNAME` | Customer / payer name | Confirmed (name) | e.g. `เงินสด`, person/company names |
| `ADDR1` / `ADDR2` | Address | TBD | |
| `PO` | PO reference | TBD | |
| `SALE` | Salesperson code | Confirmed (name) | e.g. `NUY`, `JEAB`, `NONG` |
| `RE` | ? | TBD | |
| `TERM` | Credit term (days?) | TBD | e.g. `30.0` |
| `DUEDATE` | Due date | TBD | |
| `NOTEDATE` / `NOTENO` | Note refs | TBD | |
| `VOUCDATE1` / `VOUCNO1` / `VOUCDATE2` / `VOUCNO2` | Voucher refs | TBD | |
| `POSTED1` / `POSTED2` | Posted flags | TBD | |
| `REMARKS` | Remarks | TBD | |
| `CANCELED` | Canceled flag | Confirmed | `Y` / `N` |
| `DONE` | Done flag | TBD | Mostly `N` |

**TBD — default BI filter for “good bills”:**

```sql
-- PROPOSED (not locked):
WHERE "CANCELED" = 'N'
```

---

## 6. Code tables (fill as we confirm)

### 6.1 `BILLTYPE` (raw)

| Code | Meaning | Include in revenue? | Status |
|------|---------|---------------------|--------|
| `0` | TBD | TBD | TBD |
| `1` | TBD (majority) | TBD | TBD |
| `2` | TBD (often with `CN`) | TBD | TBD |
| `R` | TBD (orphan-like headers, `&…` bill nos) | TBD | TBD |

### 6.2 `BILLTYPE_STD`

| Code | Meaning | Include in revenue? | Status |
|------|---------|---------------------|--------|
| `UNKNOWN` | Not standardized / default | TBD | Confirmed value exists (large share) |
| `TAR` | TBD | TBD | TBD |
| `TF` | TBD | TBD | TBD |
| `TFV` | TBD | TBD | TBD |
| `TAD` | TBD | TBD | TBD |
| `TD` | TBD | TBD | TBD |
| `TR` | TBD | TBD | TBD |
| `DN` | Debit note? | TBD | Inferred name only |
| `CN` | Credit note? | TBD | Inferred name only |

### 6.3 `JOURMODE`

| Code | Meaning | Status |
|------|---------|--------|
| `0` | TBD | TBD |
| `1` | TBD | TBD |
| `2` | TBD (majority on both tables) | TBD |

### 6.4 `JOURTYPE` (bills)

| Code | Meaning | Status |
|------|---------|--------|
| `SJ` | Sales journal? | Inferred |
| `AR` | Accounts receivable? | Inferred |

### 6.5 `PAYSTAT` (bills)

| Code | Meaning | Status |
|------|---------|--------|
| `null` | TBD (very common) | TBD |
| `$` | TBD | TBD |
| `=` | TBD (often with credit / due?) | Inferred from samples |
| `%` | TBD | TBD |
| `&` | TBD (rare) | TBD |

### 6.6 Line `STATUS`

| Code | Meaning | Status |
|------|---------|--------|
| `1.0` | TBD (majority) | TBD |
| `8.0` | TBD | TBD |

---

## 7. Gotchas & data quality

1. **Text numerics** — Always cast; do not sum text blindly in some tools.
2. **Quoted identifiers** — `"BRANCH"`, `"BILLNO"`, etc.
3. **`BILLTYPE_STD = UNKNOWN` is common** — do not treat “UNKNOWN” as rare dirty data without a rule.
4. **Bill orphans (29 HQ)** — headers with no lines: many `BILLTYPE = R` / `&…` numbers, or `LINES = 0` / null amounts. Decide whether to exclude from bill counts.
5. **`ACCTNO` vs `ACCT_NO` on lines** — two similarly named fields; meanings TBD.
6. **Cash customers** — bill `ACCTNAME = 'เงินสด'` often appears on cash sales.
7. **Cost gaps** — `COST_STATUS = UNKNOWN` (~13k lines); margin metrics need a policy.
8. **Staging tables** — do not report from `*_stg`.

---

## 8. Metric definitions (lock before dashboard build)

> Fill formulas here as we agree. Until marked **Confirmed**, do not treat as official KPIs.

### 8.1 Revenue (line-based) — TBD

```text
TBD: sum of line AMOUNT_NUM
Filters: TBD (IS_VALID, CANCELED, BILLTYPE_STD, JOURMODE, …)
Sign rules for CN/returns: TBD
```

### 8.2 Revenue (bill-based) — TBD

```text
TBD: sum of AFTERTAX or BEFORETAX
When to use bill vs line totals: TBD
```

### 8.3 Bill count — TBD

```text
TBD: count distinct (BRANCH, BILLNO) with filters …
```

### 8.4 Gross margin — TBD

```text
TBD: e.g. AMOUNT_NUM - (QTY * LAST_PURCHASE_COST) or XPRICE
Only where COST_STATUS = 'OK'? TBD
```

### 8.5 Paid vs credit — TBD

```text
TBD: rules using PAID, CASHED, DUEAMT, PAYSTAT, TERM, ACCTNAME
```

---

## 9. Open questions (working list)

- [ ] Exact meaning of each `BILLTYPE` / `BILLTYPE_STD` code and which count as sales revenue
- [ ] Meaning of `JOURMODE` 0/1/2 and whether BI should filter to one mode
- [ ] Official revenue field: line `AMOUNT_NUM` vs bill `AFTERTAX` / `BEFORETAX`
- [ ] Credit note / debit note sign handling (`CN`, `DN`)
- [ ] `PAYSTAT` legend and AR aging rules
- [ ] Difference between `PRICE` / `XPRICE` / `LAST_PURCHASE_COST`
- [ ] Difference between line `ACCTNO` and `ACCT_NO`
- [ ] Whether `BILLTYPE = R` headers should appear in any dashboard
- [ ] Default timezone / business day cutoff for `BILLDATE`
- [ ] Product / customer dimension tables to join next

---

## 10. Changelog

| Date | Change | By |
|------|--------|----|
| 2026-07-25 | Initial dictionary from `fact_sales_all` + `fact_sales_bills_all` inspection | Cursor + owner |
| 2026-07-25 | Rechecked bills after upload fix: SYP headers present; join coverage complete for both branches | Cursor |

---

## 11. Scratch / owner notes

> Paste informal notes here during working sessions; promote into sections above when confirmed.

-

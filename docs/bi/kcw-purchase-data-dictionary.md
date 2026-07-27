# KCW purchase data dictionary (PIDET)

Source of truth for **HQ purchase lines** used by product-movement BI.  
Table: `raw_kcw.raw_hq_pidet_purchase_lines` (staging twin `_stg` — do not report from).

Status legend: **Confirmed** · **TBD** · **Inferred**

Last reviewed: 2026-07-26

---

## 1. Scope

| Fact | Status |
|------|--------|
| Purchases always booked at **HQ** (no SYP PIDET) | Confirmed |
| Grain: 1 row ≈ 1 purchase line | Confirmed |
| No curated `fact_purchase_*` yet — BI reads raw HQ PIDET | Confirmed (v1) |
| App `public.expense_*` is **not** product purchase | Confirmed |

---

## 2. `JOURMODE` (Confirmed)

| Value | Meaning |
|-------|---------|
| `1` | VAT purchase path (~ISVAT=Y) |
| `2` | Non-VAT purchase path (~ISVAT=N) |

**BI include:** both `1` and `2`.  
(Unlike sales, do **not** treat `JOURMODE` as a reopen/exclude signal here.)

---

## 3. `BILLTYPE` (Confirmed)

| Value | Meaning | Product movement |
|-------|---------|------------------|
| `1` | Normal purchase (รับเข้าสินค้า) | **Include** — primary inbound; defines `last_purchase_date` |
| `2` | Purchase credit / คืนของ (CN) | **Include** in net qty (usually negative) |
| `3` | Debit note / ปรับเพิ่ม (DN) | **Include** in net qty |
| `5` | Expense / ค่าใช้จ่าย (no stock) | **Exclude** — no `BCODE` |
| `Q` | Junk | **Exclude** |

Product lines require non-blank `BCODE`.

```text
purchase_product_line =
  BILLTYPE IN ('1','2','3')
  AND nullif(btrim(BCODE), '') IS NOT NULL
  AND JOURMODE IN ('1','2')   -- both VAT / non-VAT
```

`last_purchase_date(BCODE) = max(BILLDATE)` where `BILLTYPE = '1'` (normal receive only).

---

## 4. Quantity

```text
base_qty = QTY::numeric × coalesce(nullif(MTP, 0), 1)
```

Same MTP convention as sales. CN (`BILLTYPE=2`) keeps natural signed qty.

---

## 5. Relation to sales BI

| Topic | Rule |
|-------|------|
| Sales branch filter | HQ / SYP / ONLINE — applies to **sales** metrics only |
| Purchase metrics | Always HQ PIDET |
| On-hand | ICMAS `QTYOH2` (HQ master) |
| Supplier master | PIDET `"ACCTNO"` → `raw_hq_apmas_payable."ACCTNO"` — see [kcw-ar-ap-data-dictionary.md](./kcw-ar-ap-data-dictionary.md) (`MOBILE` = tax id) |

See [kcw-product-movement-data-dictionary.md](./kcw-product-movement-data-dictionary.md).

---

## 6. Changelog

| Date | Change |
|------|--------|
| 2026-07-26 | Lock JOURMODE 1/2 + BILLTYPE 1/2/3/5/Q; purchases HQ-only for movement BI |
| 2026-07-27 | Link AP master; note APMAS `MOBILE` = tax id |

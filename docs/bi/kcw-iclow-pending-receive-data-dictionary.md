# KCW pending-receive data dictionary (`ICLOW`)

Source of truth for PARTS9 **ค้างรับ** (pending receive) — the legacy report / operator list.

Status legend: **Confirmed** · **TBD** · **Inferred**

Last reviewed: 2026-08-01

**Related:** purchase **orders** [`POMAS`/`PODET`](./kcw-po-data-dictionary.md); purchase **invoices** [`PIMAS`/`PIDET`](./kcw-purchase-data-dictionary.md).

---

## 1. Source (Confirmed)

Pending receive comes from **`dbo.ICLOW`** (PARTS9 / KSS HQ).

**Separate from the PO list:** `/po` **รายการ PO** reads `POMAS`/`PODET`; `/po` ICLOW tabs (**รอสั่งซื้อ** / **ค้างรับ** / **รับบางส่วน** / **รับแล้ว**) read `ICLOW` only. Same page, two sources — do not mix membership logic.

It is **not** driven by flags on `POMAS` / `PODET`, and **not** by `PODET.QTY − PIDET.QTY`.

Validated against operator Excel: the filter below returns **616 rows** with matching dates, BCODEs, and qtys (ingested HQ snapshot ≈ **603** — sync lag).

Ingested tables:

| Site | Table |
|------|--------|
| HQ | `raw_kcw.raw_hq_iclow_stock_orders` |
| SYP | `raw_kcw.raw_syp_iclow_stock_orders` |

---

## 2. How PARTS9 marks ค้างรับ

| Field | Pending value | Meaning |
|-------|---------------|---------|
| `ORDERED` | `'Y'` | Ordered against the PO |
| `RECEIVED` | `'N'` (treat null as `'N'`) | Not yet received |
| `CANCELED` | `'N'` (treat null as `'N'`) | Not canceled |

When goods arrive, the app sets:

- `RECEIVED = 'Y'`
- fills `RCVDDATE` / `RCVDNO`

### Canonical pending filter

```sql
SELECT *
FROM dbo.ICLOW
WHERE ORDERED = 'Y'
  AND ISNULL(RECEIVED, 'N') = 'N'
  AND ISNULL(CANCELED, 'N') = 'N';
```

Postgres / Supabase equivalent:

```sql
WHERE "ORDERED" = 'Y'
  AND coalesce("RECEIVED", 'N') = 'N'
  AND coalesce("CANCELED", 'N') = 'N'
```

---

## 3. Do not use as receive indicators

| Field | Why |
|-------|-----|
| `PODET.DONE` / `POMAS.DONE` | Always `'N'` in this DB — unused for receive |
| `PODET.STATUS` | Product status (≈ `ICMAS.STATUS`), not receive state |
| `POMAS.BILLED` / `BILLNO` | Header “billed at least once”; partial bills can still leave other lines pending in `ICLOW` |
| `PODET.QTY − PIDET.QTY` | **Wrong** for ค้างรับ — does not match PARTS9 / operator list |

`BILLED = 'Y'` can coexist with remaining `ICLOW` pending rows on the same PO.

---

## 4. Useful columns on `ICLOW` (Confirmed shape)

Same grain as the legacy report. Observed / used fields include:

| Group | Columns | Notes |
|-------|---------|-------|
| Identity | `ID` | PARTS9 row id (stable key for app list) |
| PO link | `DOCNO`, `DOCDATE` | PO identity when ordered; **null** while still “to be ordered” |
| Vendor | `VENDOR` | Supplier code; join **APMAS** for name (not POMAS) |
| Product | `BCODE`, `DESCR`, `MCODE`, `PCODE` | Match / display |
| Qty | `QTY`, `UI`, `MTP` | Qty on the ICLOW row |
| Order flags | `ORDERED`, `RECEIVED`, `CANCELED` | Receive lifecycle |
| Receive fill | `RCVDDATE`, `RCVDNO` | Set when `RECEIVED = 'Y'` |
| Other | `DONE` | Rare (`X` on a few draft rows) — not used for UI status |

---

## 5. Grain & joins

| Object | Grain |
|--------|-------|
| `ICLOW` row | 1 row ≈ 1 stock-order / receive-tracking line in PARTS9 |

```text
ICLOW  →  APMAS   on  VENDOR = ACCTNO   (vendor name only)
ICLOW  →  product on  BCODE  (ICMAS)     (optional display)
```

Do **not** join `POMAS`/`PODET` for pending-receive membership or list status.

- **ค้างรับ membership** = `ICLOW` alone (§2).
- **`DOCNO` on ICLOW** is the PO number string (same format as `POMAS.DOCNO`) but the pending-receive feature does not read POMAS. Pending rows have no `RCVDNO`.
- **Received link to PI** (when `RECEIVED='Y'`):

```text
ICLOW.RCVDNO   = PIMAS.BILLNO
ICLOW.RCVDDATE = PIMAS.BILLDATE   (optional)
PIMAS          → PIDET on BILLNO + BILLDATE
                 (BILLTYPE in 1/2/3, not canceled)
```

Do **not** use `PIMAS.PO` — often blank/noisy.

---

## 6. App status model (`/po` pending tab) — Confirmed design

Operators filter by one of four statuses.

### 6.1 Status rules

Exclude from all buckets:

- `coalesce(CANCELED,'N') = 'Y'`
- `ORDERED = 'X'` (**TBD** — hidden until confirmed)

**Ordered grain = `DOCNO + BCODE`** (sum ICLOW `QTY`).  
**HQ received qty** = sum `PIDET.QTY` joined on distinct `ICLOW.RCVDNO` → `PIDET.BILLNO` + same `BCODE`.  
Legacy PARTS9 truncates `ICLOW.RCVDNO` to **12 chars** while `PIMAS.BILLNO` can be longer — match exact `BILLNO = RCVDNO`, else `left(BILLNO,12) = RCVDNO` when `length(RCVDNO)=12`.  
Do **not** use `PIMAS.PO` (unreliable).  
`RECEIVED='Y'` alone is not “fully received” — it means complete **or** partial after the PIDET qty check.

| Status key | Thai (UI) | Grain | Predicate |
|------------|-----------|-------|-----------|
| `to_be_ordered` | รอสั่งซื้อ | line | `ORDERED=N`. `DOCNO` null in practice. |
| `pending_receive` | ค้างรับ | bcode | `ORDERED=Y` and **no** ICLOW row for that DOCNO+BCODE has `RECEIVED='Y'`. |
| `partially_received` | รับบางส่วน | bcode | Any `RECEIVED='Y'` on that DOCNO+BCODE, and PIDET qty via `RCVDNO` **&lt;** ordered qty (includes Y with no matching PIDET). |
| `complete` | รับแล้ว | bcode | Any `RECEIVED='Y'` and PIDET qty via `RCVDNO` **≥** ordered qty. |

SYP has no PIDET: `received_qty` = sum ICLOW `QTY` where `RECEIVED='Y'` on that DOCNO+BCODE; same complete/partial/pending split.

### 6.2 Document links (UI)

No mixed missing/received breakdown dialog. On ICLOW tabs:

| Click | Opens |
|-------|--------|
| **DOCNO** | Same PO lines dialog as รายการ PO — HQ `POMAS`/`PODET` or SYP `POMAS`/`PODET` (`GET /api/po/hq/[docno]` / `GET /api/po/syp/[docno]`) |
| **RCVDNO** (HQ, when PIMAS exists) | Purchase invoice — `PIMAS`/`PIDET` via exact `BILLNO` or `left(BILLNO,12)` (`GET /api/po/pi/[billno]`) |
| **RCVDNO** with `(ไม่พบลิงก์ PIMAS)` | Not clickable |

Legacy RPC `fn_po_pending_receive_detail` / `GET /api/po/pending-receive/[docno]` may still exist but is unused by the simplified UI.

### 6.3 Notes

- Do **not** use mixed-DOCNO sibling logic for รับบางส่วน.
- Do **not** use `PIMAS.PO` or `PODET.QTY − PIDET.QTY` for membership.
- Default UI filter: **`pending_receive`**.
- `complete` / `partially_received` / `pending_receive` keep a date window on `DOCDATE` (UI default: **last 30 days**; quick presets: 60d / 3m / 6m / 1y).
- `to_be_ordered` skips the date cutoff.

### 6.4 Observed HQ counts (ingested snapshot 2026-08-01)

| Bucket | ≈ |
|--------|--:|
| `to_be_ordered` (lines) | 274 |
| `pending_receive` (bcode) | (no RECEIVED=Y) |
| `partially_received` (bcode) | RECEIVED=Y and PIDET via RCVDNO incomplete |
| `complete` (bcode) | RECEIVED=Y and PIDET via RCVDNO covers ordered qty |
| `ORDERED='X'` (hidden) | 60 |

### 6.5 API / RPC

| Piece | Contract |
|-------|----------|
| List RPC | `public.fn_po_pending_receive` |
| List API | `GET /api/po/pending-receive?site=&status=` |
| PO lines API | `GET /api/po/hq/[docno]` · `GET /api/po/syp/[docno]` |
| PI detail API | `GET /api/po/pi/[billno]` (RCVDNO → PIMAS/PIDET) |
| Legacy detail RPC | `public.fn_po_pending_receive_detail` (unused by UI) |
| SQL | [`sql/fn_po_pending_receive.sql`](./sql/fn_po_pending_receive.sql) |

---

## 7. Supabase / app status

| Topic | Status |
|-------|--------|
| Source | PARTS9 `dbo.ICLOW` (HQ / KSS) — Confirmed |
| SYP `ICLOW` | Confirmed ingested (`raw_syp_iclow_stock_orders`) |
| Ingest into `raw_kcw` | Confirmed — `raw_{hq\|syp}_iclow_stock_orders` |
| App list | Wire `/po` pending tab to ICLOW + §6 statuses |
| `ORDERED='X'` meaning | TBD |

---

## 8. Changelog

| Date | Change | By |
|------|--------|-----|
| 2026-08-01 | Default ICLOW dated tabs to last 30 days (avoid 12‑month statement timeouts) | Agent |
| 2026-08-01 | Simplify UI: DOCNO→POMAS/PODET, RCVDNO→PIMAS/PIDET; drop partial missing/received dialog | Agent |
| 2026-08-01 | Match truncated RCVDNO via `left(PIMAS.BILLNO,12)` (legacy 12-char ICLOW field) | Agent |
| 2026-08-01 | UI shows `(ไม่พบลิงก์ PIMAS)` when ICLOW.RCVDNO has no matching ingested PIMAS bill | Agent |
| 2026-08-01 | BCODE grain: RECEIVED=Y → complete/partial via RCVDNO→PIDET qty; drop mixed DOCNO + PIMAS.PO | Agent |
| 2026-08-01 | `partially_received` = ICLOW line rows on mixed DOCNO with receive_state + PIMAS BILLNO | Agent |
| 2026-08-01 | Document PARTS9 ค้างรับ = `ICLOW` (`ORDERED=Y`, `RECEIVED=N`, `CANCELED=N`); match Excel 616 rows | Owner |
| 2026-08-01 | Confirm ingest tables; define `/po` four-status design; reject PODET−PIDET for membership | Agent |
| 2026-08-01 | รับบางส่วน = ICLOW DOCNO group with mixed receive; detail via `RCVDNO→PIDET`; no POMAS join | Agent |

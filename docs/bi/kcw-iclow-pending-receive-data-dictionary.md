# KCW pending-receive data dictionary (`ICLOW`)

Source of truth for PARTS9 **ค้างรับ** (pending receive) — the legacy report / operator list.

Status legend: **Confirmed** · **TBD** · **Inferred**

Last reviewed: 2026-08-01

**Related:** purchase **orders** [`POMAS`/`PODET`](./kcw-po-data-dictionary.md); purchase **invoices** [`PIMAS`/`PIDET`](./kcw-purchase-data-dictionary.md).

---

## 1. Source (Confirmed)

Pending receive comes from **`dbo.ICLOW`** (PARTS9 / KSS HQ).

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
| Vendor | `VENDOR` | = `POMAS.ACCTNO` when PO exists; join APMAS / POMAS for name |
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
ICLOW  →  POMAS   on  DOCNO (+ DOCDATE when needed)
ICLOW  →  APMAS   on  VENDOR = ACCTNO
ICLOW  →  product on  BCODE  (ICMAS)
```

Join to `PODET` is optional for display enrichment.

- **ค้างรับ membership** = `ICLOW` alone (§2).
- **`DOCNO` = PO** (`POMAS.DOCNO`). Pending rows have no `RCVDNO`.
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

| Status key | Thai (UI) | Grain | Predicate |
|------------|-----------|-------|-----------|
| `to_be_ordered` | รอสั่ง | line | `ORDERED=N`. `DOCNO` null in practice. |
| `pending_receive` | ค้างรับ | line | Canonical ค้างรับ (§2) **and** no sibling on same `DOCNO` has `RECEIVED='Y'`. Whole PO still waiting. |
| `partially_received` | รับบางส่วน | **PO** | Same `DOCNO` has both `RECEIVED='Y'` and `RECEIVED='N'` ICLOW lines. |
| `complete` | รับแล้ว | line | `ORDERED='Y' AND RECEIVED='Y'`. |

### 6.2 Partial PO detail (`fn_po_pending_receive_detail`)

Click a partial PO:

| Section | Source |
|---------|--------|
| **Missing** | ICLOW on that `DOCNO` with `RECEIVED='N'` |
| **Received (HQ)** | `RCVDNO` → `PIMAS.BILLNO` → `PIDET` lines; if `RCVDNO` not in PIMAS, show the ICLOW received row (`source=iclow`) |
| **Received (SYP)** | ICLOW `RECEIVED='Y'` only (no SYP PIDET) |

If every ICLOW line on the PO is `RECEIVED='Y'` → that PO is **complete**, not partial.

### 6.3 Notes

- Classic Excel ค้างรับ (all `RECEIVED=N`) ≈ lines in `pending_receive` **plus** missing lines inside partial PO detail.
- Do **not** use `PODET.QTY − PIDET.QTY` for membership.
- Default UI filter: **`pending_receive`**.
- `complete` keeps a date / months window on `DOCDATE` (default 12).
- `to_be_ordered` skips the months cutoff.

### 6.4 Observed HQ counts (ingested snapshot 2026-08-01)

| Bucket | ≈ |
|--------|--:|
| `to_be_ordered` (lines) | 274 |
| `pending_receive` (lines) | 415 |
| `partially_received` (POs) | 127 |
| `complete` (lines) | 8089 |
| `ORDERED='X'` (hidden) | 60 |

### 6.5 API / RPC

| Piece | Contract |
|-------|----------|
| List RPC | `public.fn_po_pending_receive` |
| Detail RPC | `public.fn_po_pending_receive_detail(p_site, p_docno)` |
| List API | `GET /api/po/pending-receive?site=&status=` |
| Detail API | `GET /api/po/pending-receive/[docno]?site=` |
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
| 2026-08-01 | Document PARTS9 ค้างรับ = `ICLOW` (`ORDERED=Y`, `RECEIVED=N`, `CANCELED=N`); match Excel 616 rows | Owner |
| 2026-08-01 | Confirm ingest tables; define `/po` four-status design; reject PODET−PIDET for membership | Agent |
| 2026-08-01 | รับบางส่วน = PO with mixed ICLOW receive; detail via `RCVDNO→PIDET`; missing = pending ICLOW | Agent |

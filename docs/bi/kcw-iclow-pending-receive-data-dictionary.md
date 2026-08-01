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

Join to `PODET` is optional for display enrichment; **membership & status are defined on `ICLOW` alone** (plus sibling rows on the same `DOCNO` for “partially received”).

---

## 6. App status model (`/po` pending tab) — Confirmed design

The PO page **รอรับของ** tab is an **ICLOW line list** (not PODET−PIDET). Operators filter by one of four statuses.

### 6.1 Line status rules

Exclude from all four buckets:

- `coalesce(CANCELED,'N') = 'Y'`
- `ORDERED = 'X'` (**TBD** meaning — often looks voided / supplier-unavailable; hide until confirmed)

| Status key | Thai (UI) | Predicate |
|------------|-----------|-----------|
| `to_be_ordered` | รอสั่ง | `coalesce(ORDERED,'N') = 'N'` and not canceled. `DOCNO` is null in practice — draft lines waiting to become a PO. |
| `pending_receive` | ค้างรับ | Canonical ค้างรับ (§2) **and** no sibling on same `DOCNO` has `RECEIVED='Y'`. Whole PO still waiting. |
| `partially_received` | รับบางส่วน | Canonical ค้างรับ (§2) **and** ≥1 sibling on same `DOCNO` has `ORDERED='Y' AND RECEIVED='Y'`. This line still pending; PO already received something. |
| `complete` | รับแล้ว | `ORDERED='Y' AND RECEIVED='Y'` and not canceled. |

Notes:

- Classic PARTS9 ค้างรับ Excel ≈ `pending_receive` ∪ `partially_received`.
- Default UI filter: **`pending_receive`** (operators’ main work queue). Offer the other three in the same status select.
- `complete` can be large (~8k HQ); keep date / months window (default 12 months on `DOCDATE`).
- `to_be_ordered` has no `DOCDATE` — do not apply the months cutoff; sort by `VENDOR`, `BCODE`.

### 6.2 Observed HQ counts (ingested snapshot 2026-08-01)

| Bucket | ≈ rows |
|--------|-------:|
| `to_be_ordered` | 274 |
| `pending_receive` | ~415 (603 pending − ~188 with received sibling) |
| `partially_received` | ~188 |
| `complete` | 8089 |
| `ORDERED='X'` (hidden) | 60 |

SYP has the same flag shape (smaller volumes).

### 6.3 API / RPC

| Piece | Contract |
|-------|----------|
| RPC | `public.fn_po_pending_receive` (service-role) |
| Source | `raw_kcw.raw_{hq\|syp}_iclow_stock_orders` |
| Params | `p_site`, `p_status` (`to_be_ordered` \| `pending_receive` \| `partially_received` \| `complete`), `p_q`, `p_vendor`, `p_from`, `p_to`, `p_months`, `p_limit`, `p_offset` |
| Row fields | `id`, `docno`, `docdate`, `vendor`, `acctname`, `bcode`, `descr`, `qty`, `ui`, `ordered`, `received`, `rcvddate`, `rcvdno`, `status` |
| SQL source file | [`sql/fn_po_pending_receive.sql`](./sql/fn_po_pending_receive.sql) |

Optional later: status **counts** for badges (`fn_po_pending_receive_counts`) — not required for v1.

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
| 2026-08-01 | Confirm ingest tables; define `/po` four-status design; reject PODET−PIDET | Agent |

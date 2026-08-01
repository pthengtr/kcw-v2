# KCW pending-receive data dictionary (`ICLOW`)

Source of truth for PARTS9 **ค้างรับ** (pending receive) — the legacy report / operator list.

Status legend: **Confirmed** · **TBD** · **Inferred**

Last reviewed: 2026-08-01

**Related:** purchase **orders** [`POMAS`/`PODET`](./kcw-po-data-dictionary.md); purchase **invoices** [`PIMAS`/`PIDET`](./kcw-purchase-data-dictionary.md).

---

## 1. Source (Confirmed)

Pending receive comes from **`dbo.ICLOW`** (PARTS9 / KSS HQ).

It is **not** driven by flags on `POMAS` / `PODET`.

Validated against operator Excel: the filter below returns **616 rows** with matching dates, BCODEs, and qtys.

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

Postgres / Supabase equivalent once ingested:

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

`BILLED = 'Y'` can coexist with remaining `ICLOW` pending rows on the same PO.

---

## 4. Useful columns on `ICLOW` (Confirmed shape)

Same grain as the legacy report. Observed / used fields include:

| Group | Columns | Notes |
|-------|---------|-------|
| PO link | `DOCNO`, `DOCDATE` | PO identity (same family as `POMAS`) |
| Vendor | `VENDOR` | Supplier ref on the pending row |
| Product | `BCODE` | Match / display key |
| Qty | `QTY` | Ordered / pending qty on the row |
| Order flags | `ORDERED`, `RECEIVED`, `CANCELED` | Receive lifecycle |
| Receive fill | `RCVDDATE`, `RCVDNO` | Set when `RECEIVED = 'Y'` |

Full PARTS9 column list / types: expand after Supabase ingest (TBD).

---

## 5. Grain & joins

| Object | Grain |
|--------|-------|
| `ICLOW` pending row | 1 row ≈ 1 ordered / not-yet-received line tracked by PARTS9 |

```text
ICLOW  →  POMAS   on  DOCNO (+ DOCDATE when needed)
ICLOW  →  product on  BCODE  (ICMAS)
```

Join to `PODET` is optional for display enrichment; **pending membership is defined on `ICLOW` alone**.

---

## 6. Supabase / app status

| Topic | Status |
|-------|--------|
| Source | PARTS9 `dbo.ICLOW` (HQ / KSS) — Confirmed |
| SYP `ICLOW` | TBD (mirror if SYP PARTS9 has the same table) |
| Ingest into `raw_kcw` | **In progress** (owner creating table + sync) |
| Expected raw table name | `raw_kcw.raw_hq_iclow_*` (name TBD at ingest) |
| App list | Filter ingested `ICLOW` with §2 predicate; sort/filters on `DOCDATE`, `DOCNO`, `VENDOR`, `BCODE` |

---

## 7. Changelog

| Date | Change | By |
|------|--------|----|
| 2026-08-01 | Document PARTS9 ค้างรับ = `ICLOW` (`ORDERED=Y`, `RECEIVED=N`, `CANCELED=N`); match Excel 616 rows | Owner |

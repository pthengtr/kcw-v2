# KCW pending-receive data dictionary (`ICLOW`)

Source of truth for PARTS9 **ค้างรับ** (pending receive) — the legacy report / operator list.

Status legend: **Confirmed** · **TBD** · **Inferred**

Last reviewed: 2026-08-01

**Related:** purchase **orders** [`POMAS`/`PODET`](./kcw-po-data-dictionary.md); purchase **invoices** [`PIMAS`/`PIDET`](./kcw-purchase-data-dictionary.md).

---

## 1. Verdict (Confirmed)

Pending receive is **not** driven by flags on `POMAS` / `PODET`.

It comes from **`dbo.ICLOW`** (PARTS9 / KSS HQ).

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

## 3. What it is *not*

Do **not** use these as receive / pending indicators for this report:

| Field | Why |
|-------|-----|
| `PODET.DONE` / `POMAS.DONE` | Always `'N'` in this DB — unused for receive |
| `PODET.STATUS` | Product status (≈ `ICMAS.STATUS`), not receive state |
| `POMAS.BILLED` / `BILLNO` | Header “billed at least once”; partial bills still leave other lines pending in `ICLOW` |
| Computed `PODET.QTY − Σ PIDET.QTY` by BCODE | Heuristic only; **not** what PARTS9 uses for ค้างรับ |

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
| App UI `/po` → รอรับของ (ทดลองใช้) | Currently uses interim `fn_po_pending_receive` (PODET−PIDET / open headers) — **revise after ICLOW ingest** |
| Correct v2 list | Filter `ICLOW` with §2 predicate; sort/filters on `DOCDATE`, `DOCNO`, `VENDOR`, `BCODE` |

---

## 7. App revision checklist (after ingest)

1. Confirm raw table name + columns in Supabase
2. Replace / rewrite `fn_po_pending_receive` to read `ICLOW` pending filter (§2)
3. Point `/api/po/pending-receive` + UI tab at the new RPC
4. Keep per-branch UX (HQ / SYP) if SYP `ICLOW` exists; otherwise HQ-only for this list
5. Drop reliance on PIDET qty reconciliation for this screen

---

## 8. Changelog

| Date | Change | By |
|------|--------|----|
| 2026-08-01 | Document PARTS9 ค้างรับ = `ICLOW` (`ORDERED=Y`, `RECEIVED=N`, `CANCELED=N`); match Excel 616 rows; mark PODET−PIDET trial as interim | Owner |

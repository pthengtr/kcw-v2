# KCW ICMAS (product master) data dictionary

Naming and code meanings for product master data in `raw_kcw` ICMAS tables, used to enrich sales BI (join on `BCODE`).

Sources:

- `raw_kcw.raw_hq_icmas_products`
- `raw_kcw.raw_syp_icmas_products`
- Drive curated dims (reference): [kcw_analytics / 03_curated](https://drive.google.com/drive/folders/1zn_5KoMRFOOBQFDTj0STRPsR-TXpQIQe)

Status legend: **Confirmed** · **TBD** · **Inferred**

Last reviewed: 2026-07-26

---

## 1. Schema map (products)

| Object | Grain | Role |
|--------|-------|------|
| `raw_kcw.raw_hq_icmas_products` | 1 row ≈ 1 product (`BCODE`) at HQ | Product attributes, prices, costs, pack MTPs |
| `raw_kcw.raw_syp_icmas_products` | same for SYP | Branch product master |
| Drive `dim_product.csv` | curated product dim | `BCODE`, `DETAIL`, `UI`, `CATEGORY_CODE` |
| Drive `dim_category.csv` | category codes only | `CATEGORY_CODE` = first 2 digits of `BCODE` — **names TBD** (file has codes only) |

Join to sales lines: `fact_sales_all."BCODE" = icmas."BCODE"` (prefer HQ master unless SYP-only item).

---

## 2. `BCODE` structure (working)

| Part | Meaning | Status |
|------|---------|--------|
| Digits 1–2 | `CATEGORY_CODE` / aligns with ICMAS `MAIN` | Confirmed (pattern) |
| Rest | Item identity within category | TBD detail |

Drive `dim_category.csv` lists codes (`01`…`35`, `40`, `70`, `88`, `91`) but **no Thai labels yet**.

---

## 3. `CODE1` — part-type / item-class letter (Confirmed)

Owner-provided legend. Field: ICMAS `"CODE1"` (single letter on the product).

Use for: product-type filters/facets (seal, bearing, filter, …), separate from `BCODE` 2-digit category.

| CODE1 | Category (Thai) | Status | HQ row count (approx, non-canceled) |
|-------|-----------------|--------|-------------------------------------:|
| `A` | ถ่าน | Confirmed | ~424 |
| `C` | ซีล | Confirmed | ~3,044 |
| `D` | บู๊ช | Confirmed | ~860 |
| `E` | ลูกปืนเข็ม/กรงนก | Confirmed | ~356 |
| `F` | ไส้กรองอากาศ | Confirmed | ~669 |
| `G` | ยอยกากบาท | Confirmed | ~383 |
| `I` | ลูกปืนตลับ / ลูกปืน | Confirmed | ~2,281 |
| `K` | จานคลัช | Confirmed | ~1,010 |
| `L` | สายอ่อน | Confirmed | ~436 |
| `O` | โอริง | Confirmed | ~1,567 |
| `P` | ไส้กรองน้ำมันเครื่อง | Confirmed | ~546 |
| `Q` | ลูกหมาก | Confirmed | ~301 |
| `R` | ลูกยาง | Confirmed | ~49 |

### Notes / gotchas

1. **Most products have `CODE1` null** (~103k HQ rows) — letter class is only populated for some parts families; null ≠ “unknown category from BCODE”.
2. Dirty values exist (spaces, `C `, `CC`, Thai `จ`, `.`, `-`, digits). For BI, prefer:
   ```sql
   upper(trim("CODE1"))
   ```
   and only map letters in the table above; else `NULL` / `OTHER`.
3. **`CODE1` ≠ `CATEGORY_CODE`**  
   - `CATEGORY_CODE` / `left(BCODE,2)` / `MAIN` = broad catalog group  
   - `CODE1` = part-type letter (ซีล, ลูกปืน, …)

### Proposed label expression

```sql
CASE upper(trim("CODE1"))
  WHEN 'A' THEN 'ถ่าน'
  WHEN 'C' THEN 'ซีล'
  WHEN 'D' THEN 'บู๊ช'
  WHEN 'E' THEN 'ลูกปืนเข็ม/กรงนก'
  WHEN 'F' THEN 'ไส้กรองอากาศ'
  WHEN 'G' THEN 'ยอยกากบาท'
  WHEN 'I' THEN 'ลูกปืนตลับ / ลูกปืน'
  WHEN 'K' THEN 'จานคลัช'
  WHEN 'L' THEN 'สายอ่อน'
  WHEN 'O' THEN 'โอริง'
  WHEN 'P' THEN 'ไส้กรองน้ำมันเครื่อง'
  WHEN 'Q' THEN 'ลูกหมาก'
  WHEN 'R' THEN 'ลูกยาง'
  ELSE NULL
END AS code1_category
```

---

## 4. Part numbers: `PCODE` / `MCODE` (Confirmed)

| Field | Meaning | Status | Notes |
|-------|---------|--------|-------|
| `PCODE` | **เบอร์แท้** (genuine / OEM / maker part no.) | Confirmed | Often looks like OEM catalog no. (`203-07150B`, `1121210010`). Some dirty values exist (`ราคา 09/2008`, `69ซม.`) — treat as free text, not always a clean PN |
| `MCODE` | **เบอร์โรงงาน** (factory / internal supplier part no.) | Confirmed | Factory/cross-ref number (`HTC105-135-14`, `01A-BAD146-4B`) |

Examples (HQ ICMAS):

| BCODE | DESCR | PCODE (เบอร์แท้) | MCODE (เบอร์โรงงาน) |
|-------|-------|------------------|---------------------|
| 01010044 | ซีลข้อเหวี่ยง | MO-1484S | HTC105-135-14 |
| 01010045 | หม้อลมเบรค | 203-07150B | 01A-BAD146-4B |
| 01010080 | ซีลล้อหน้า | AAA077-AO | TAY75-115-20.5 |

**BI use:** search / match alternate part numbers; do not use as grain key (use `BCODE`).  
Still TBD: exact difference vs `OEM` flag / `XCODE` / `ACODE`.

---

## 5. Units & prices: `UI*` / `MTP*` / `PRICE*` / `PRICEM*` (Confirmed)

Pack hierarchy on the product master:

| Field | Meaning | Status |
|-------|---------|--------|
| `UI1` | **Smallest unit** name (ชิ้น/ตัว/แผ่น/…) | Confirmed |
| `UI2` | **Large unit** name (กล่อง/ลัง/ถุง/…) | Confirmed |
| `MTP2` | How many **small units** in one **large unit** (`UI2`) | Confirmed |
| `PRICE1`…`PRICE5` (`PRICEx`) | Price for the **small unit** (`UI1`) | Confirmed (family) |
| `PRICEM1`…`PRICEM5` (`PRICEMx`) | Price for the **large unit** (`UI2`) | Confirmed (family) |

```text
1 × UI2  =  MTP2 × UI1
PRICEMx  ≈  price of one large pack
PRICEx   ≈  price of one small unit
```

Example: `UI1=ชุด`, `UI2=กล่อง`, `MTP2=10`, `PRICE1=25`, `PRICEM1=170`  
→ box of 10; small unit 25; box 170.

### Relation to sales fact `UI` / `MTP`

Sales line `"UI"` / `"MTP"` (see sales dictionary) are the **sold** pack on the bill.  
ICMAS `UI1`/`UI2`/`MTP2` are the **master** pack definition. They often align but are not guaranteed identical on every bill line.

### Still TBD in this family

| Field | Question |
|-------|----------|
| `UI3` / `UI4`, `MTP3` / `MTP4` | Extra pack levels? |
| Which of `PRICE1`…`PRICE5` is the “list” price vs tier | Price list levels |
| When `MTP2=0` or `PRICEM*=0` / null | Treat as unused large-pack slot |

---

## 6. `SIZE1` / `SIZE2` / `SIZE3` by `CODE1` (Confirmed)

Size columns are **dimension slots**; their meaning depends on `CODE1`.

| CODE1 | Category | SIZE1 | SIZE2 | SIZE3 | Status |
|-------|----------|-------|-------|-------|--------|
| `A` | ถ่าน | สูง | กว้าง | — | Confirmed |
| `C` | ซีล | ใน | นอก | หนา | Confirmed |
| `D` | บู๊ช | ใน | นอก | หนา | Confirmed |
| `E` | ลูกปืนเข็ม/กรงนก | ใน | นอก | หนา | Confirmed |
| `F` | ไส้กรองอากาศ | ใน | นอก | สูง | Confirmed |
| `G` | ยอยกากบาท | ปลอก | ยาว | — | Confirmed |
| `I` | ลูกปืนตลับ | ใน | นอก | หนา | Confirmed |
| `K` | จานคลัช | ยาว(นิ้ว) | ฟัน | ขนาดรูเฟือง | Confirmed |
| `L` | สายอ่อน | หัวสาย 1 | หัวสาย 2 | ยาว | Confirmed |
| `O` | โอริง | ใน | หนา | — | Confirmed |
| `P` | ไส้กรองน้ำมันเครื่อง | ใน | นอก | สูง | Confirmed |
| `Q` | ลูกหมาก | TBD | TBD | TBD | TBD |
| `R` | ลูกยาง | TBD | TBD | TBD | TBD |

`—` = slot not used for that part type.

**BI tip:** when showing sizes, label columns from `CODE1` (e.g. for `C`: `SIZE1`→ใน, `SIZE2`→นอก, `SIZE3`→หนา). Do not use one global “size1/2/3” label across all products.

Example (`CODE1=C` ซีล): `SIZE1=31`, `SIZE2=46`, `SIZE3=7` → ใน 31 / นอก 46 / หนา 7.

---

## 7. Other ICMAS codes (queue)

| Field | Meaning | Status |
|-------|---------|--------|
| `CODE2` / `CODE3` / `CODE4` | TBD | TBD |
| `XCODE` / `ACODE` | TBD | TBD |
| `MAIN` / `SUB` / `PART` | Aligns with BCODE structure; names TBD | Inferred |
| `CATEGORY_CODE` (Drive dim) | `left(BCODE,2)` | Confirmed pattern; **labels TBD** |
| `DESCR`, `BRAND`, `MODEL` | Description / brand / model | Confirmed (name) |

---

## 8. Open questions

- [x] `CODE1` letter meanings (A/C/D/E/F/G/I/K/L/O/P/Q/R) — Confirmed
- [x] `PCODE` = เบอร์แท้; `MCODE` = เบอร์โรงงาน — Confirmed
- [x] `UI1`/`UI2`/`MTP2` + `PRICEx`/`PRICEMx` pack & price rules — Confirmed
- [x] `SIZE1–3` meanings by `CODE1` (A/C/D/E/F/G/I/K/L/O/P) — Confirmed
- [ ] `SIZE*` meanings for `CODE1` = `Q`, `R`
- [ ] Thai/English names for `CATEGORY_CODE` (`01`…`91`)
- [ ] Meanings of `CODE2`–`CODE4`, `XCODE`, `ACODE`
- [ ] `UI3`/`UI4`/`MTP3`/`MTP4` and price-tier roles of `PRICE1`…`PRICE5`
- [ ] Which master to prefer when HQ and SYP ICMAS disagree on the same `BCODE`
- [ ] Whether to curate `dim_code1` / size labels into Supabase `curated_kcw`

---

## 9. Changelog

| Date | Change | By |
|------|--------|----|
| 2026-07-26 | Start ICMAS dictionary; lock `CODE1` category letters | Owner |
| 2026-07-26 | Lock `PCODE`=เบอร์แท้, `MCODE`=เบอร์โรงงาน | Owner |
| 2026-07-26 | Lock UI/MTP/PRICE pack rules + SIZE1–3 meanings by CODE1 | Owner |

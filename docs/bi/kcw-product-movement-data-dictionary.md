# KCW product movement BI

Report: **`/bi/product-movement`** — sell frequency vs HQ buys + dead-stock aging.

Status legend: **Confirmed** · **TBD** · **Inferred**

Last reviewed: 2026-07-26

---

## 1. Goals (Confirmed)

| Goal | Rule |
|------|------|
| **Stock more** | Rank SKUs by **most move-out** in the period (`sell_qty` desc) |
| **Dead / careful** | Age from **last HQ purchase** with **no subsequent sale**, plus never-sold in same windows |
| Purchase side | Always **HQ** PIDET |
| Sales side | Optional branch filter HQ / SYP / ONLINE |

Aging colors:

| Tier | Age since last purchase (no sale after) |
|------|-----------------------------------------|
| Yellow | ≥ 3 months (90 days) |
| Orange | ≥ 6 months (180 days) |
| Red | ≥ 1 year (365 days) |

Same windows apply to “never sold in timeframe” (worst tier wins).

---

## 2. Sources

| Side | Source |
|------|--------|
| Sales | `curated_kcw.fact_sales_*` — same include filters as product BI |
| Purchase | `raw_kcw.raw_hq_pidet_purchase_lines` — see purchase dictionary |
| On-hand | `raw_kcw.raw_hq_icmas_products."QTYOH2"` |

---

## 3. Metrics

### Period block (`from`–`to`)

| Metric | Definition |
|--------|------------|
| `sell_qty` | Sum `QTY×MTP` on filtered sales lines |
| `sell_bills` | Distinct sales bills |
| `sell_days` | Distinct sales dates |
| `buy_qty` | Sum signed purchase `QTY×MTP` for BILLTYPE 1/2/3 + BCODE (HQ) |
| `buy_bills` | Distinct purchase bills (same set) |

### As-of `to` (dead stock)

| Metric | Definition |
|--------|------------|
| `last_purchase_date` | Max `BILLDATE` where `BILLTYPE=1` and BCODE set, ≤ `to` |
| `last_sale_date` | Max sales `BILLDATE` with product filters (+ branch), ≤ `to` |
| `no_move_since_purchase` | `last_sale_date` is null **or** `last_sale_date < last_purchase_date` |
| `days_since_purchase` | `to − last_purchase_date` |
| `dead_tier` | `red` / `orange` / `yellow` / null — see §1 |

Universe for dead list: has `last_purchase_date`, **`on_hand_qty > 0`**, and  
(`no_move_since_purchase` **or** never sold within 90/180/365 days).

---

## 4. RPC / API

| Piece | Detail |
|-------|--------|
| RPC | `public.fn_bi_product_movement(from, to, branch, stock_limit, dead_limit, dead_offset)` |
| Dead list order | **Yellow (3m) → orange (6m) → red (1y+)**; within tier `days_since_purchase ASC` |
| Pagination | `dead_offset` + `dead_limit` (default 100); response includes `dead_has_more` |
| UI | `/bi/product-movement` — row highlight by tier; prev/next on dead list (no color filter chips) |
| API | `GET /api/bi/products/movement?from=&to=&branch=&stock_limit=&dead_limit=&dead_offset=` |

---

## 5. Changelog

| Date | Change |
|------|--------|
| 2026-07-26 | Dead list: yellow-first sort + offset pagination; remove tier filter chips |
| 2026-07-26 | Lock stock-more rank + dead tiers 90/180/365; HQ purchases; ship report |

-- Product movement BI: stock-more (sell qty rank) + dead-stock aging from last HQ buy.
-- See docs/bi/kcw-product-movement-data-dictionary.md and kcw-purchase-data-dictionary.md.
--
-- p_mode:
--   stock_more — period sell rank only (no dead scan)
--   dead       — as-of dead list only (no period sell rank)
--   both       — full payload (heavier; avoid in UI)

DROP FUNCTION IF EXISTS public.fn_bi_product_movement(date, date, text, integer, integer);
DROP FUNCTION IF EXISTS public.fn_bi_product_movement(date, date, text, integer, integer, integer);
DROP FUNCTION IF EXISTS public.fn_bi_product_movement(date, date, text, integer, integer, integer, text);
DROP FUNCTION IF EXISTS public.fn_bi_product_movement(date, date, text, integer, integer, integer, text, text);
DROP FUNCTION IF EXISTS public.fn_bi_product_movement(date, date, text, integer, integer, integer, text, text, text, text);

CREATE OR REPLACE FUNCTION public.fn_bi_product_movement(
  p_from date,
  p_to date,
  p_branch text DEFAULT NULL,
  p_stock_limit integer DEFAULT 50,
  p_dead_limit integer DEFAULT 100,
  p_dead_offset integer DEFAULT 0,
  p_dead_sort text DEFAULT 'deep',
  p_mode text DEFAULT 'both',
  p_dead_tier text DEFAULT NULL,
  p_category text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, curated_kcw, raw_kcw
SET statement_timeout = '60s'
AS $$
DECLARE
  v_stock_limit int;
  v_dead_limit int;
  v_dead_offset int;
  v_dead_sort text;
  v_mode text;
  v_want_stock boolean;
  v_want_dead boolean;
  v_dead_tier text;
  v_category text;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'Invalid date range';
  END IF;

  IF p_branch IS NOT NULL AND p_branch NOT IN ('HQ', 'SYP', 'ONLINE') THEN
    RAISE EXCEPTION 'Invalid branch';
  END IF;

  v_stock_limit := GREATEST(1, LEAST(COALESCE(p_stock_limit, 50), 200));
  v_dead_limit := GREATEST(1, LEAST(COALESCE(p_dead_limit, 100), 500));
  v_dead_offset := GREATEST(0, COALESCE(p_dead_offset, 0));
  v_dead_sort := lower(COALESCE(p_dead_sort, 'deep'));
  IF v_dead_sort NOT IN (
    'deep', 'recent', 'value_desc', 'value_asc', 'qty_desc', 'cost_desc'
  ) THEN
    v_dead_sort := 'deep';
  END IF;
  v_mode := lower(COALESCE(p_mode, 'both'));
  IF v_mode NOT IN ('stock_more', 'dead', 'both') THEN
    RAISE EXCEPTION 'Invalid mode';
  END IF;
  v_want_stock := v_mode IN ('stock_more', 'both');
  v_want_dead := v_mode IN ('dead', 'both');

  v_dead_tier := lower(nullif(btrim(COALESCE(p_dead_tier, '')), ''));
  IF v_dead_tier IS NOT NULL AND v_dead_tier NOT IN ('yellow', 'orange', 'red') THEN
    RAISE EXCEPTION 'Invalid dead_tier';
  END IF;

  IF p_category IS NULL OR btrim(p_category) = '' THEN
    v_category := NULL;
  ELSE
    v_category := lpad(left(btrim(p_category), 2), 2, '0');
  END IF;

  RETURN (
    WITH
    -- Period bills only (stock-more / period KPIs)
    sales_bills_period AS (
      SELECT
        b."BRANCH" AS store_branch,
        b."BILLNO" AS bill_no,
        left(b."BILLDATE", 10)::date AS bill_date,
        CASE
          WHEN COALESCE(b."BILLTYPE_STD", '') = 'TAD' THEN 'ONLINE'
          WHEN COALESCE(b."BILLTYPE_STD", '') = 'CN'
            AND b."BILLNO" ~* '^CNTAD' THEN 'ONLINE'
          ELSE b."BRANCH"
        END AS reporting_branch
      FROM curated_kcw.fact_sales_bills_all b
      WHERE v_want_stock
        AND b."CANCELED" = 'N'
        AND b."JOURMODE" <> '0'
        AND COALESCE(b."BILLTYPE_STD", '') NOT IN ('TF', 'TFV', 'TAR')
      AND upper(btrim(b."BILLNO")) !~ '^(3)?SA'
        AND b."BILLDATE" >= p_from::text
        AND b."BILLDATE" < (p_to + 1)::text
    ),
    sales_period AS (
      SELECT
        nullif(btrim(l."BCODE"), '') AS bcode,
        max(COALESCE(l."DETAIL", '')) AS detail,
        sum(
          COALESCE(NULLIF(replace(l."QTY", ',', ''), '')::numeric, 0)
          * COALESCE(
              NULLIF(
                COALESCE(NULLIF(replace(nullif(trim(l."MTP"), ''), ',', ''), '')::numeric, 0),
                0
              ),
              1
            )
        ) AS sell_qty,
        count(DISTINCT (b.store_branch, b.bill_no))::int AS sell_bills,
        count(DISTINCT b.bill_date)::int AS sell_days
      FROM curated_kcw.fact_sales_all l
      JOIN sales_bills_period b
        ON b.store_branch = l."BRANCH"
       AND b.bill_no = l."BILLNO"
      WHERE v_want_stock
        AND l."IS_VALID" = 'True'
        AND l."CANCELED" = 'N'
        AND nullif(btrim(l."BCODE"), '') IS NOT NULL
        AND (p_branch IS NULL OR b.reporting_branch = p_branch)
      GROUP BY 1
    ),
    -- Light last-sale dates (no QTY×MTP) — only for dead aging
    last_sale AS (
      SELECT
        nullif(btrim(l."BCODE"), '') AS bcode,
        max(left(l."BILLDATE", 10)::date) AS last_sale_date
      FROM curated_kcw.fact_sales_all l
      JOIN curated_kcw.fact_sales_bills_all b
        ON b."BRANCH" = l."BRANCH"
       AND b."BILLNO" = l."BILLNO"
      WHERE v_want_dead
        AND l."IS_VALID" = 'True'
        AND l."CANCELED" = 'N'
        AND b."CANCELED" = 'N'
        AND b."JOURMODE" <> '0'
        AND COALESCE(b."BILLTYPE_STD", '') NOT IN ('TF', 'TFV', 'TAR')
      AND upper(btrim(b."BILLNO")) !~ '^(3)?SA'
        AND l."BILLDATE" < (p_to + 1)::text
        AND nullif(btrim(l."BCODE"), '') IS NOT NULL
        AND (
          v_category IS NULL
          OR lpad(left(nullif(btrim(l."BCODE"), ''), 2), 2, '0') = v_category
        )
      GROUP BY 1
    ),
    purchase_product AS (
      SELECT
        nullif(btrim(p."BCODE"), '') AS bcode,
        COALESCE(p."DETAIL", '') AS detail,
        p."BILLTYPE" AS billtype,
        left(p."BILLDATE", 10)::date AS bill_date,
        p."BILLNO" AS bill_no,
        COALESCE(NULLIF(replace(p."QTY", ',', ''), '')::numeric, 0)
          * COALESCE(
              NULLIF(
                COALESCE(NULLIF(replace(nullif(trim(p."MTP"), ''), ',', ''), '')::numeric, 0),
                0
              ),
              1
            ) AS base_qty
      FROM raw_kcw.raw_hq_pidet_purchase_lines p
      WHERE (v_want_dead OR v_want_stock)
        AND COALESCE(p."JOURMODE", '') IN ('1', '2')
        AND COALESCE(p."BILLTYPE", '') IN ('1', '2', '3')
        AND nullif(btrim(p."BCODE"), '') IS NOT NULL
        AND p."BILLDATE" < (p_to + 1)::text
        AND (
          v_want_dead
          OR (
            left(p."BILLDATE", 10)::date >= p_from
            AND left(p."BILLDATE", 10)::date <= p_to
          )
        )
        AND (
          NOT v_want_dead
          OR v_category IS NULL
          OR lpad(left(nullif(btrim(p."BCODE"), ''), 2), 2, '0') = v_category
        )
    ),
    purchase_period AS (
      SELECT
        bcode,
        max(detail) AS detail,
        sum(base_qty) AS buy_qty,
        count(DISTINCT bill_no)::int AS buy_bills
      FROM purchase_product
      WHERE v_want_stock
        AND bill_date >= p_from
        AND bill_date <= p_to
      GROUP BY bcode
    ),
    last_purchase AS (
      SELECT
        bcode,
        max(detail) AS detail,
        max(bill_date) AS last_purchase_date
      FROM purchase_product
      WHERE v_want_dead
        AND billtype = '1'
      GROUP BY bcode
    ),
    icmas AS (
      SELECT
        nullif(btrim(i."BCODE"), '') AS bcode,
        max(COALESCE(i."DESCR", '')) AS descr,
        max(COALESCE(i."CODE1", '')) AS code1,
        max(
          COALESCE(NULLIF(replace(nullif(btrim(i."QTYOH2"), ''), ',', ''), '')::numeric, 0)
        ) AS on_hand_qty,
        max(
          NULLIF(replace(nullif(btrim(i."COSTLAST"), ''), ',', ''), '')::numeric
        ) AS unit_cost
      FROM raw_kcw.raw_hq_icmas_products i
      WHERE nullif(btrim(i."BCODE"), '') IS NOT NULL
      GROUP BY 1
    ),
    dead_scored AS (
      SELECT
        lp.bcode,
        COALESCE(NULLIF(i.descr, ''), NULLIF(lp.detail, ''), lp.bcode) AS detail,
        lpad(left(lp.bcode, 2), 2, '0') AS category_code,
        nullif(btrim(COALESCE(i.code1, '')), '') AS code1,
        COALESCE(i.on_hand_qty, 0) AS on_hand_qty,
        i.unit_cost,
        COALESCE(i.on_hand_qty, 0) * COALESCE(i.unit_cost, 0) AS stock_value,
        lp.last_purchase_date,
        ls.last_sale_date,
        (p_to - lp.last_purchase_date) AS days_since_purchase,
        CASE
          WHEN ls.last_sale_date IS NULL THEN NULL
          ELSE (p_to - ls.last_sale_date)
        END AS days_since_sale,
        true AS no_move_since_purchase,
        CASE
          WHEN (p_to - lp.last_purchase_date) >= 730 THEN 'red'
          WHEN (p_to - lp.last_purchase_date) >= 365 THEN 'orange'
          WHEN (p_to - lp.last_purchase_date) >= 180 THEN 'yellow'
          ELSE NULL
        END AS dead_tier
      FROM last_purchase lp
      LEFT JOIN last_sale ls ON ls.bcode = lp.bcode
      LEFT JOIN icmas i ON i.bcode = lp.bcode
      WHERE v_want_dead
        AND COALESCE(i.on_hand_qty, 0) > 0
        AND (ls.last_sale_date IS NULL OR ls.last_sale_date < lp.last_purchase_date)
        AND (p_to - lp.last_purchase_date) >= 180
        AND (
          v_category IS NULL
          OR lpad(left(lp.bcode, 2), 2, '0') = v_category
        )
    ),
    -- Tier counts within current category (before tier chip filter)
    dead_filtered AS (
      SELECT *
      FROM dead_scored
      WHERE dead_tier IS NOT NULL
    ),
    dead_list_source AS (
      SELECT *
      FROM dead_filtered
      WHERE v_dead_tier IS NULL OR dead_tier = v_dead_tier
    ),
    stock_more AS (
      SELECT
        s.bcode,
        COALESCE(NULLIF(i.descr, ''), NULLIF(s.detail, ''), s.bcode) AS detail,
        lpad(left(s.bcode, 2), 2, '0') AS category_code,
        nullif(btrim(COALESCE(i.code1, '')), '') AS code1,
        s.sell_qty,
        s.sell_bills,
        s.sell_days,
        COALESCE(p.buy_qty, 0) AS buy_qty,
        COALESCE(p.buy_bills, 0) AS buy_bills,
        COALESCE(i.on_hand_qty, 0) AS on_hand_qty,
        ls.last_sale_date,
        lp.last_purchase_date
      FROM sales_period s
      LEFT JOIN purchase_period p ON p.bcode = s.bcode
      LEFT JOIN icmas i ON i.bcode = s.bcode
      LEFT JOIN last_sale ls ON ls.bcode = s.bcode
      LEFT JOIN last_purchase lp ON lp.bcode = s.bcode
      WHERE v_want_stock
      ORDER BY s.sell_qty DESC, s.sell_bills DESC, s.bcode
      LIMIT v_stock_limit
    ),
    dead_list AS (
      SELECT
        d.bcode,
        d.detail,
        d.category_code,
        d.code1,
        d.on_hand_qty,
        d.unit_cost,
        d.stock_value,
        d.last_purchase_date,
        d.last_sale_date,
        d.days_since_purchase,
        d.days_since_sale,
        d.no_move_since_purchase,
        d.dead_tier,
        0::numeric AS sell_qty_period,
        0::numeric AS buy_qty_period
      FROM dead_list_source d
      WHERE v_want_dead
      ORDER BY
        CASE
          WHEN v_dead_sort = 'deep' THEN
            CASE d.dead_tier
              WHEN 'red' THEN 1
              WHEN 'orange' THEN 2
              WHEN 'yellow' THEN 3
              ELSE 4
            END
          WHEN v_dead_sort = 'recent' THEN
            CASE d.dead_tier
              WHEN 'yellow' THEN 1
              WHEN 'orange' THEN 2
              WHEN 'red' THEN 3
              ELSE 4
            END
          ELSE 0
        END,
        CASE WHEN v_dead_sort = 'deep' THEN d.days_since_purchase END DESC NULLS LAST,
        CASE WHEN v_dead_sort = 'recent' THEN d.days_since_purchase END ASC NULLS LAST,
        CASE WHEN v_dead_sort = 'value_desc' THEN d.stock_value END DESC NULLS LAST,
        CASE WHEN v_dead_sort = 'value_asc' THEN d.stock_value END ASC NULLS LAST,
        CASE WHEN v_dead_sort = 'qty_desc' THEN d.on_hand_qty END DESC NULLS LAST,
        CASE WHEN v_dead_sort = 'cost_desc' THEN d.unit_cost END DESC NULLS LAST,
        d.bcode
      OFFSET v_dead_offset
      LIMIT CASE WHEN v_want_dead THEN v_dead_limit ELSE 0 END
    ),
    summary AS (
      SELECT
        CASE WHEN v_want_stock THEN (SELECT count(*)::int FROM sales_period) ELSE 0 END AS sold_sku_count,
        CASE WHEN v_want_stock THEN (SELECT COALESCE(sum(sell_qty), 0) FROM sales_period) ELSE 0 END AS sell_qty,
        CASE WHEN v_want_stock THEN (SELECT count(*)::int FROM purchase_period) ELSE 0 END AS bought_sku_count,
        CASE WHEN v_want_stock THEN (SELECT COALESCE(sum(buy_qty), 0) FROM purchase_period) ELSE 0 END AS buy_qty,
        CASE WHEN v_want_dead THEN (SELECT count(*)::int FROM dead_filtered WHERE dead_tier = 'yellow') ELSE 0 END AS dead_yellow_count,
        CASE WHEN v_want_dead THEN (SELECT count(*)::int FROM dead_filtered WHERE dead_tier = 'orange') ELSE 0 END AS dead_orange_count,
        CASE WHEN v_want_dead THEN (SELECT count(*)::int FROM dead_filtered WHERE dead_tier = 'red') ELSE 0 END AS dead_red_count,
        CASE WHEN v_want_dead THEN (SELECT count(*)::int FROM dead_list_source) ELSE 0 END AS dead_total_count,
        CASE WHEN v_want_dead THEN (SELECT count(*)::int FROM dead_filtered) ELSE 0 END AS dead_category_total,
        CASE WHEN v_want_dead THEN (
          SELECT COALESCE(sum(stock_value), 0) FROM dead_list_source
        ) ELSE 0 END AS dead_stock_value,
        CASE WHEN v_want_dead THEN (
          SELECT COALESCE(sum(stock_value), 0) FROM dead_filtered
        ) ELSE 0 END AS dead_category_stock_value
    )
    SELECT jsonb_build_object(
      'from', p_from,
      'to', p_to,
      'branch', p_branch,
      'mode', v_mode,
      'stock_limit', v_stock_limit,
      'dead_limit', v_dead_limit,
      'dead_offset', v_dead_offset,
      'dead_sort', v_dead_sort,
      'dead_tier', v_dead_tier,
      'dead_category', v_category,
      'dead_returned_count', (SELECT count(*)::int FROM dead_list),
      'dead_has_more', (
        v_want_dead
        AND (v_dead_offset + (SELECT count(*)::int FROM dead_list))
          < (SELECT dead_total_count FROM summary)
      ),
      'summary', (SELECT jsonb_build_object(
        'sold_sku_count', sold_sku_count,
        'sell_qty', sell_qty,
        'bought_sku_count', bought_sku_count,
        'buy_qty', buy_qty,
        'dead_yellow_count', dead_yellow_count,
        'dead_orange_count', dead_orange_count,
        'dead_red_count', dead_red_count,
        'dead_total_count', dead_total_count,
        'dead_category_total', dead_category_total,
        'dead_stock_value', dead_stock_value,
        'dead_category_stock_value', dead_category_stock_value
      ) FROM summary),
      'stock_more', CASE WHEN NOT v_want_stock THEN '[]'::jsonb ELSE COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'bcode', sm.bcode,
          'detail', sm.detail,
          'category_code', sm.category_code,
          'category_name', sm.category_code,
          'code1', sm.code1,
          'code1_name', sm.code1,
          'sell_qty', sm.sell_qty,
          'sell_bills', sm.sell_bills,
          'sell_days', sm.sell_days,
          'buy_qty', sm.buy_qty,
          'buy_bills', sm.buy_bills,
          'on_hand_qty', sm.on_hand_qty,
          'last_sale_date', sm.last_sale_date,
          'last_purchase_date', sm.last_purchase_date
        ) ORDER BY sm.sell_qty DESC, sm.sell_bills DESC, sm.bcode)
        FROM stock_more sm
      ), '[]'::jsonb) END,
      'dead_stock', CASE WHEN NOT v_want_dead THEN '[]'::jsonb ELSE COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'bcode', dl.bcode,
          'detail', dl.detail,
          'category_code', dl.category_code,
          'category_name', dl.category_code,
          'code1', dl.code1,
          'code1_name', dl.code1,
          'on_hand_qty', dl.on_hand_qty,
          'unit_cost', dl.unit_cost,
          'stock_value', dl.stock_value,
          'last_purchase_date', dl.last_purchase_date,
          'last_sale_date', dl.last_sale_date,
          'days_since_purchase', dl.days_since_purchase,
          'days_since_sale', dl.days_since_sale,
          'no_move_since_purchase', dl.no_move_since_purchase,
          'dead_tier', dl.dead_tier,
          'sell_qty_period', dl.sell_qty_period,
          'buy_qty_period', dl.buy_qty_period
        ) ORDER BY
          CASE
            WHEN v_dead_sort = 'deep' THEN
              CASE dl.dead_tier
                WHEN 'red' THEN 1
                WHEN 'orange' THEN 2
                WHEN 'yellow' THEN 3
                ELSE 4
              END
            WHEN v_dead_sort = 'recent' THEN
              CASE dl.dead_tier
                WHEN 'yellow' THEN 1
                WHEN 'orange' THEN 2
                WHEN 'red' THEN 3
                ELSE 4
              END
            ELSE 0
          END,
          CASE WHEN v_dead_sort = 'deep' THEN dl.days_since_purchase END DESC NULLS LAST,
          CASE WHEN v_dead_sort = 'recent' THEN dl.days_since_purchase END ASC NULLS LAST,
          CASE WHEN v_dead_sort = 'value_desc' THEN dl.stock_value END DESC NULLS LAST,
          CASE WHEN v_dead_sort = 'value_asc' THEN dl.stock_value END ASC NULLS LAST,
          CASE WHEN v_dead_sort = 'qty_desc' THEN dl.on_hand_qty END DESC NULLS LAST,
          CASE WHEN v_dead_sort = 'cost_desc' THEN dl.unit_cost END DESC NULLS LAST,
          dl.bcode
        )
        FROM dead_list dl
      ), '[]'::jsonb) END
    )
  );
END;
$$;

COMMENT ON FUNCTION public.fn_bi_product_movement(date, date, text, integer, integer, integer, text, text, text, text) IS
  'Product movement BI; dead cost/value + sort modes; statement_timeout 60s; buys always HQ.';

GRANT EXECUTE ON FUNCTION public.fn_bi_product_movement(date, date, text, integer, integer, integer, text, text, text, text) TO service_role;

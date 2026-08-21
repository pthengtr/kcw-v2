-- Single-SKU sales report for /bi/product-sales.
-- Revenue: line-grain net (same filters as fn_bi_product_overview).
-- Gross margin: LAST_PURCHASE_COST x base qty on costed lines only
--   (same cost field as /bi/income -- not period purchase amount).
-- Purchases: HQ PIDET in the same window, shown separately (restock, not COGS).
-- Category / CODE1 names are filled in the app from icmas-labels.

CREATE INDEX IF NOT EXISTS fact_sales_all_bcode_billdate_idx
  ON curated_kcw.fact_sales_all ("BCODE", "BILLDATE");

CREATE OR REPLACE FUNCTION public.fn_bi_product_sales(
  p_bcode text,
  p_from date,
  p_to date,
  p_branch text DEFAULT NULL,
  p_history_limit integer DEFAULT 40
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, curated_kcw, raw_kcw
SET statement_timeout = '60s'
AS $fn$
DECLARE
  v_bcode text;
  v_hist int;
  v_prev_from date;
  v_prev_to date;
  v_span int;
BEGIN
  v_bcode := btrim(COALESCE(p_bcode, ''));
  IF v_bcode = '' THEN
    RAISE EXCEPTION 'Invalid bcode';
  END IF;

  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'Invalid date range';
  END IF;

  IF p_branch IS NOT NULL AND p_branch NOT IN ('HQ', 'SYP', 'ONLINE') THEN
    RAISE EXCEPTION 'Invalid branch';
  END IF;

  v_hist := GREATEST(1, LEAST(COALESCE(p_history_limit, 40), 100));
  v_span := (p_to - p_from);
  v_prev_to := p_from - 1;
  v_prev_from := v_prev_to - v_span;

  RETURN (
    WITH
    icmas AS (
      SELECT
        nullif(btrim(i."BCODE"), '') AS bcode,
        COALESCE(nullif(btrim(i."DESCR"), ''), '') AS descr,
        upper(trim(i."CODE1")) AS code1,
        nullif(btrim(i."BRAND"), '') AS brand,
        nullif(btrim(i."MODEL"), '') AS model,
        nullif(btrim(i."PCODE"), '') AS pcode,
        nullif(btrim(i."MCODE"), '') AS mcode,
        COALESCE(NULLIF(replace(nullif(btrim(i."QTYOH2"), ''), ',', ''), '')::numeric, 0) AS on_hand_qty,
        NULLIF(replace(nullif(btrim(i."COSTLAST"), ''), ',', ''), '')::numeric AS costlast
      FROM raw_kcw.raw_hq_icmas_products i
      WHERE nullif(btrim(i."BCODE"), '') = v_bcode
      LIMIT 1
    ),
    line_base AS (
      SELECT
        s.bill_date,
        s.reporting_branch,
        s.store_branch,
        s.bill_no,
        s.billtype_std,
        s.detail,
        s.revenue_net,
        s.base_qty,
        s.unit_cost,
        s.blank_cost_flag,
        CASE WHEN s.blank_cost_flag = 0 THEN s.base_qty * s.unit_cost ELSE 0 END AS cogs,
        CASE WHEN s.blank_cost_flag = 0 THEN s.revenue_net ELSE 0 END AS costed_revenue_net
      FROM public.fn_bi_product_sales_lines(v_bcode, p_from, p_to, p_branch) s
    ),
    prev_lines AS (
      SELECT
        s.revenue_net,
        s.base_qty,
        CASE WHEN s.blank_cost_flag = 0 THEN s.base_qty * s.unit_cost ELSE 0 END AS cogs,
        CASE WHEN s.blank_cost_flag = 0 THEN s.revenue_net ELSE 0 END AS costed_revenue_net
      FROM public.fn_bi_product_sales_lines(v_bcode, v_prev_from, v_prev_to, p_branch) s
    ),
    summary AS (
      SELECT
        COALESCE(sum(revenue_net), 0) AS revenue_net,
        COALESCE(sum(base_qty), 0) AS base_qty,
        count(*)::int AS line_count,
        count(DISTINCT (store_branch, bill_no))::int AS bill_count,
        COALESCE(sum(cogs), 0) AS cogs,
        COALESCE(sum(costed_revenue_net), 0) AS costed_revenue_net,
        COALESCE(sum(costed_revenue_net) - sum(cogs), 0) AS gross_profit,
        COALESCE(sum(blank_cost_flag), 0)::int AS blank_cost_line_count,
        COALESCE(sum(revenue_net) FILTER (WHERE reporting_branch = 'HQ'), 0) AS hq_revenue_net,
        COALESCE(sum(revenue_net) FILTER (WHERE reporting_branch = 'SYP'), 0) AS syp_revenue_net,
        COALESCE(sum(revenue_net) FILTER (WHERE reporting_branch = 'ONLINE'), 0) AS online_revenue_net,
        COALESCE(sum(base_qty) FILTER (WHERE reporting_branch = 'HQ'), 0) AS hq_qty,
        COALESCE(sum(base_qty) FILTER (WHERE reporting_branch = 'SYP'), 0) AS syp_qty,
        COALESCE(sum(base_qty) FILTER (WHERE reporting_branch = 'ONLINE'), 0) AS online_qty
      FROM line_base
    ),
    prev_summary AS (
      SELECT
        COALESCE(sum(revenue_net), 0) AS revenue_net,
        COALESCE(sum(base_qty), 0) AS base_qty,
        count(*)::int AS line_count,
        COALESCE(sum(cogs), 0) AS cogs,
        COALESCE(sum(costed_revenue_net) - sum(cogs), 0) AS gross_profit
      FROM prev_lines
    ),
    by_branch AS (
      SELECT
        reporting_branch AS key,
        sum(revenue_net) AS revenue_net,
        sum(base_qty) AS base_qty,
        count(DISTINCT (store_branch, bill_no))::int AS bill_count,
        sum(cogs) AS cogs,
        sum(costed_revenue_net) - sum(cogs) AS gross_profit
      FROM line_base
      GROUP BY 1
    ),
    daily AS (
      SELECT
        bill_date::text AS period,
        sum(revenue_net) AS revenue_net,
        sum(base_qty) AS base_qty,
        count(DISTINCT (store_branch, bill_no))::int AS bill_count,
        COALESCE(sum(revenue_net) FILTER (WHERE reporting_branch = 'HQ'), 0) AS hq_revenue_net,
        COALESCE(sum(revenue_net) FILTER (WHERE reporting_branch = 'SYP'), 0) AS syp_revenue_net,
        COALESCE(sum(revenue_net) FILTER (WHERE reporting_branch = 'ONLINE'), 0) AS online_revenue_net,
        COALESCE(sum(base_qty) FILTER (WHERE reporting_branch = 'HQ'), 0) AS hq_qty,
        COALESCE(sum(base_qty) FILTER (WHERE reporting_branch = 'SYP'), 0) AS syp_qty,
        COALESCE(sum(base_qty) FILTER (WHERE reporting_branch = 'ONLINE'), 0) AS online_qty,
        sum(cogs) AS cogs,
        sum(costed_revenue_net) - sum(cogs) AS gross_profit
      FROM line_base
      GROUP BY 1
    ),
    monthly AS (
      SELECT
        to_char(date_trunc('month', bill_date), 'YYYY-MM') AS period,
        sum(revenue_net) AS revenue_net,
        sum(base_qty) AS base_qty,
        count(DISTINCT (store_branch, bill_no))::int AS bill_count,
        COALESCE(sum(revenue_net) FILTER (WHERE reporting_branch = 'HQ'), 0) AS hq_revenue_net,
        COALESCE(sum(revenue_net) FILTER (WHERE reporting_branch = 'SYP'), 0) AS syp_revenue_net,
        COALESCE(sum(revenue_net) FILTER (WHERE reporting_branch = 'ONLINE'), 0) AS online_revenue_net,
        COALESCE(sum(base_qty) FILTER (WHERE reporting_branch = 'HQ'), 0) AS hq_qty,
        COALESCE(sum(base_qty) FILTER (WHERE reporting_branch = 'SYP'), 0) AS syp_qty,
        COALESCE(sum(base_qty) FILTER (WHERE reporting_branch = 'ONLINE'), 0) AS online_qty,
        sum(cogs) AS cogs,
        sum(costed_revenue_net) - sum(cogs) AS gross_profit
      FROM line_base
      GROUP BY 1
    ),
    purchase_lines AS (
      SELECT
        left(p."BILLDATE", 10)::date AS bill_date,
        p."BILLNO" AS bill_no,
        COALESCE(p."BILLTYPE", '') AS billtype,
        COALESCE(nullif(btrim(p."DETAIL"), ''), '') AS detail,
        nullif(btrim(p."ACCTNO"), '') AS acctno,
        COALESCE(NULLIF(replace(p."QTY", ',', ''), '')::numeric, 0)
          * COALESCE(
              NULLIF(
                COALESCE(NULLIF(replace(nullif(trim(p."MTP"), ''), ',', ''), '')::numeric, 0),
                0
              ),
              1
            ) AS base_qty,
        COALESCE(NULLIF(replace(p."PRICE", ',', ''), '')::numeric, 0) AS unit_price,
        CASE
          WHEN p."ISVAT" = 'Y' AND p."TAXIC" = 'Y'
            THEN COALESCE(NULLIF(replace(p."AMOUNT", ',', ''), '')::numeric, 0) / 1.07
          ELSE COALESCE(NULLIF(replace(p."AMOUNT", ',', ''), '')::numeric, 0)
        END AS amount_net
      FROM raw_kcw.raw_hq_pidet_purchase_lines p
      WHERE nullif(btrim(p."BCODE"), '') = v_bcode
        AND COALESCE(p."JOURMODE", '') IN ('1', '2')
        AND COALESCE(p."BILLTYPE", '') IN ('1', '2', '3')
        AND COALESCE(p."CANCELED", 'N') <> 'Y'
        AND left(p."BILLDATE", 10)::date >= p_from
        AND left(p."BILLDATE", 10)::date <= p_to
    ),
    purchase_summary AS (
      SELECT
        COALESCE(sum(base_qty), 0) AS buy_qty,
        COALESCE(sum(amount_net), 0) AS buy_amount_net,
        count(DISTINCT bill_no)::int AS buy_bills,
        CASE
          WHEN COALESCE(sum(base_qty) FILTER (WHERE base_qty <> 0), 0) = 0 THEN 0
          ELSE COALESCE(sum(amount_net) FILTER (WHERE base_qty <> 0), 0)
            / sum(base_qty) FILTER (WHERE base_qty <> 0)
        END AS avg_unit_cost
      FROM purchase_lines
    ),
    last_sale AS (
      SELECT max(left(l."BILLDATE", 10)::date) AS last_sale_date
      FROM curated_kcw.fact_sales_all l
      JOIN curated_kcw.fact_sales_bills_all b
        ON b."BRANCH" = l."BRANCH"
       AND b."BILLNO" = l."BILLNO"
      WHERE nullif(btrim(l."BCODE"), '') = v_bcode
        AND l."IS_VALID" = 'True'
        AND l."CANCELED" = 'N'
        AND b."CANCELED" = 'N'
        AND b."JOURMODE" <> '0'
        AND NOT public.fn_bi_sales_bill_excluded_from_revenue(b."BILLNO", b."BILLTYPE_STD")
        AND upper(btrim(b."BILLNO")) !~ '^(3)?SA'
        AND l."BILLDATE" < (p_to + 1)::text
    ),
    last_purchase AS (
      SELECT max(left(p."BILLDATE", 10)::date) AS last_purchase_date
      FROM raw_kcw.raw_hq_pidet_purchase_lines p
      WHERE nullif(btrim(p."BCODE"), '') = v_bcode
        AND COALESCE(p."JOURMODE", '') IN ('1', '2')
        AND COALESCE(p."BILLTYPE", '') = '1'
        AND COALESCE(p."CANCELED", 'N') <> 'Y'
        AND left(p."BILLDATE", 10)::date <= p_to
    ),
    sales_history AS (
      SELECT *
      FROM line_base
      ORDER BY bill_date DESC, bill_no DESC, store_branch
      LIMIT v_hist
    ),
    purchase_history AS (
      SELECT *
      FROM purchase_lines
      ORDER BY bill_date DESC, bill_no DESC
      LIMIT v_hist
    ),
    product_card AS (
      SELECT
        v_bcode AS bcode,
        COALESCE(NULLIF(i.descr, ''), (SELECT max(detail) FROM line_base), v_bcode) AS detail,
        lpad(left(v_bcode, 2), 2, '0') AS category_code,
        CASE WHEN i.code1 ~ '^[A-Z]$' THEN i.code1 ELSE NULL END AS code1,
        i.brand,
        i.model,
        i.pcode,
        i.mcode,
        COALESCE(i.on_hand_qty, 0) AS on_hand_qty,
        i.costlast,
        (SELECT last_sale_date FROM last_sale) AS last_sale_date,
        (SELECT last_purchase_date FROM last_purchase) AS last_purchase_date
      FROM (SELECT 1) dummy
      LEFT JOIN icmas i ON true
    )
    SELECT jsonb_build_object(
      'from', p_from,
      'to', p_to,
      'branch', p_branch,
      'bcode', v_bcode,
      'previous_from', v_prev_from,
      'previous_to', v_prev_to,
      'product', (
        SELECT jsonb_build_object(
          'bcode', bcode,
          'detail', detail,
          'category_code', category_code,
          'code1', code1,
          'brand', brand,
          'model', model,
          'pcode', pcode,
          'mcode', mcode,
          'on_hand_qty', on_hand_qty,
          'costlast', costlast,
          'last_sale_date', last_sale_date,
          'last_purchase_date', last_purchase_date
        ) FROM product_card
      ),
      'summary', (
        SELECT jsonb_build_object(
          'revenue_net', revenue_net,
          'base_qty', base_qty,
          'line_count', line_count,
          'bill_count', bill_count,
          'avg_unit_price', CASE WHEN base_qty = 0 THEN 0 ELSE revenue_net / base_qty END,
          'cogs', cogs,
          'costed_revenue_net', costed_revenue_net,
          'gross_profit', gross_profit,
          'gross_margin_pct', CASE
            WHEN costed_revenue_net = 0 THEN NULL
            ELSE (gross_profit / costed_revenue_net) * 100
          END,
          'blank_cost_line_count', blank_cost_line_count,
          'hq_revenue_net', hq_revenue_net,
          'syp_revenue_net', syp_revenue_net,
          'online_revenue_net', online_revenue_net,
          'hq_qty', hq_qty,
          'syp_qty', syp_qty,
          'online_qty', online_qty
        ) FROM summary
      ),
      'previous_summary', (
        SELECT jsonb_build_object(
          'revenue_net', revenue_net,
          'base_qty', base_qty,
          'line_count', line_count,
          'cogs', cogs,
          'gross_profit', gross_profit
        ) FROM prev_summary
      ),
      'purchase', (
        SELECT jsonb_build_object(
          'buy_qty', buy_qty,
          'buy_amount_net', buy_amount_net,
          'buy_bills', buy_bills,
          'avg_unit_cost', avg_unit_cost
        ) FROM purchase_summary
      ),
      'by_branch', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'key', key,
          'revenue_net', revenue_net,
          'base_qty', base_qty,
          'bill_count', bill_count,
          'cogs', cogs,
          'gross_profit', gross_profit
        ) ORDER BY key)
        FROM by_branch
      ), '[]'::jsonb),
      'trend_daily', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'period', period,
          'revenue_net', revenue_net,
          'base_qty', base_qty,
          'bill_count', bill_count,
          'hq_revenue_net', hq_revenue_net,
          'syp_revenue_net', syp_revenue_net,
          'online_revenue_net', online_revenue_net,
          'hq_qty', hq_qty,
          'syp_qty', syp_qty,
          'online_qty', online_qty,
          'cogs', cogs,
          'gross_profit', gross_profit
        ) ORDER BY period)
        FROM daily
      ), '[]'::jsonb),
      'trend_monthly', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'period', period,
          'revenue_net', revenue_net,
          'base_qty', base_qty,
          'bill_count', bill_count,
          'hq_revenue_net', hq_revenue_net,
          'syp_revenue_net', syp_revenue_net,
          'online_revenue_net', online_revenue_net,
          'hq_qty', hq_qty,
          'syp_qty', syp_qty,
          'online_qty', online_qty,
          'cogs', cogs,
          'gross_profit', gross_profit
        ) ORDER BY period)
        FROM monthly
      ), '[]'::jsonb),
      'sales_history', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'bill_date', bill_date,
          'reporting_branch', reporting_branch,
          'store_branch', store_branch,
          'bill_no', bill_no,
          'billtype', billtype_std,
          'base_qty', base_qty,
          'revenue_net', revenue_net,
          'unit_cost', CASE WHEN blank_cost_flag = 0 THEN unit_cost ELSE NULL END,
          'cogs', cogs,
          'gross_profit', CASE WHEN blank_cost_flag = 0 THEN revenue_net - cogs ELSE NULL END
        ) ORDER BY bill_date DESC, bill_no DESC)
        FROM sales_history
      ), '[]'::jsonb),
      'purchase_history', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'bill_date', bill_date,
          'bill_no', bill_no,
          'billtype', billtype,
          'detail', detail,
          'acctno', acctno,
          'base_qty', base_qty,
          'unit_price', unit_price,
          'amount_net', amount_net
        ) ORDER BY bill_date DESC, bill_no DESC)
        FROM purchase_history
      ), '[]'::jsonb)
    )
  );
END;
$fn$;

COMMENT ON FUNCTION public.fn_bi_product_sales(text, date, date, text, integer) IS
  'Single-SKU BI: line net sales by branch/period + LAST_PURCHASE_COST margin; HQ PIDET purchases shown separately.';

REVOKE ALL ON FUNCTION public.fn_bi_product_sales(text, date, date, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_bi_product_sales(text, date, date, text, integer) TO service_role;

-- Applied via Supabase migration: fn_bi_sales_overview (+ ONLINE branch + trend splits)
-- Sales BI overview: bill-grain net revenue (BEFORETAX) with confirmed filters.
-- See docs/bi/kcw-sales-data-dictionary.md §8.
-- Reporting branch: TAD/CNTAD count as ONLINE (not HQ store).

CREATE OR REPLACE FUNCTION public.fn_bi_sales_overview(
  p_from date,
  p_to date,
  p_branch text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, curated_kcw
AS $$
DECLARE
  v_result jsonb;
  v_prev_from date;
  v_prev_to date;
  v_span int;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'Invalid date range';
  END IF;

  IF p_branch IS NOT NULL AND p_branch NOT IN ('HQ', 'SYP', 'ONLINE') THEN
    RAISE EXCEPTION 'Invalid branch';
  END IF;

  v_span := (p_to - p_from);
  v_prev_to := p_from - 1;
  v_prev_from := v_prev_to - v_span;

  WITH base AS (
    SELECT
      left(b."BILLDATE", 10)::date AS bill_date,
      -- BI reporting branch: TAD/CNTAD are ONLINE, not HQ store
      CASE
        WHEN COALESCE(b."BILLTYPE_STD", '') = 'TAD' THEN 'ONLINE'
        WHEN COALESCE(b."BILLTYPE_STD", '') = 'CN'
          AND b."BILLNO" ~* '^CNTAD' THEN 'ONLINE'
        ELSE b."BRANCH"
      END AS branch,
      b."BILLNO" AS bill_no,
      COALESCE(NULLIF(b."BILLTYPE_STD", ''), 'UNKNOWN') AS billtype_std,
      CASE
        WHEN COALESCE(b."BILLTYPE_STD", '') = 'TAD' THEN 'ONLINE'
        WHEN COALESCE(b."BILLTYPE_STD", '') = 'CN'
          AND b."BILLNO" ~* '^CNTAD' THEN 'ONLINE'
        ELSE 'COUNTER'
      END AS channel,
      CASE
        WHEN COALESCE(b."BILLTYPE_STD", '') IN ('TAD', 'TD', 'TR') THEN 'VAT'
        WHEN COALESCE(b."BILLTYPE_STD", '') IN ('CN', 'DN')
          AND COALESCE(NULLIF(replace(b."TAX", ',', ''), '')::numeric, 0) <> 0 THEN 'VAT'
        WHEN COALESCE(b."BILLTYPE_STD", '') = 'UNKNOWN'
          AND b."BILLNO" ~* '^(IV|TA)' THEN 'VAT'
        ELSE 'NON_VAT'
      END AS sales_type,
      COALESCE(NULLIF(replace(b."BEFORETAX", ',', ''), '')::numeric, 0) AS revenue_net,
      COALESCE(NULLIF(replace(b."TAX", ',', ''), '')::numeric, 0) AS vat_baht
    FROM curated_kcw.fact_sales_bills_all b
    WHERE b."CANCELED" = 'N'
      AND b."JOURMODE" <> '0'
      AND NOT public.fn_bi_sales_bill_excluded_from_revenue(b."BILLNO", b."BILLTYPE_STD")
      AND upper(btrim(b."BILLNO")) !~ '^(3)?SA'
      AND b."BILLDATE" >= p_from::text
      AND b."BILLDATE" < (p_to + 1)::text
  ),
  filtered AS (
    SELECT * FROM base
    WHERE p_branch IS NULL OR branch = p_branch
  ),
  prev_base AS (
    SELECT
      CASE
        WHEN COALESCE(b."BILLTYPE_STD", '') = 'TAD' THEN 'ONLINE'
        WHEN COALESCE(b."BILLTYPE_STD", '') = 'CN'
          AND b."BILLNO" ~* '^CNTAD' THEN 'ONLINE'
        ELSE b."BRANCH"
      END AS branch,
      COALESCE(NULLIF(replace(b."BEFORETAX", ',', ''), '')::numeric, 0) AS revenue_net,
      COALESCE(NULLIF(replace(b."TAX", ',', ''), '')::numeric, 0) AS vat_baht
    FROM curated_kcw.fact_sales_bills_all b
    WHERE b."CANCELED" = 'N'
      AND b."JOURMODE" <> '0'
      AND NOT public.fn_bi_sales_bill_excluded_from_revenue(b."BILLNO", b."BILLTYPE_STD")
      AND upper(btrim(b."BILLNO")) !~ '^(3)?SA'
      AND b."BILLDATE" >= v_prev_from::text
      AND b."BILLDATE" < (v_prev_to + 1)::text
  ),
  prev AS (
    SELECT revenue_net, vat_baht
    FROM prev_base
    WHERE p_branch IS NULL OR branch = p_branch
  ),
  summary AS (
    SELECT
      COALESCE(sum(revenue_net), 0) AS revenue_net,
      COALESCE(sum(vat_baht), 0) AS vat_baht,
      count(*)::int AS bill_count,
      CASE WHEN count(*) > 0
        THEN COALESCE(sum(revenue_net), 0) / count(*)
        ELSE 0
      END AS avg_bill
    FROM filtered
  ),
  prev_summary AS (
    SELECT
      COALESCE(sum(revenue_net), 0) AS revenue_net,
      COALESCE(sum(vat_baht), 0) AS vat_baht,
      count(*)::int AS bill_count
    FROM prev
  ),
  by_sales_type AS (
    SELECT sales_type AS key, sum(revenue_net) AS revenue_net, count(*)::int AS bill_count
    FROM filtered
    GROUP BY 1
  ),
  by_branch AS (
    SELECT branch AS key, sum(revenue_net) AS revenue_net, count(*)::int AS bill_count
    FROM filtered
    GROUP BY 1
  ),
  by_channel AS (
    SELECT channel AS key, sum(revenue_net) AS revenue_net, count(*)::int AS bill_count
    FROM filtered
    GROUP BY 1
  ),
  by_billtype AS (
    SELECT billtype_std AS key, sum(revenue_net) AS revenue_net, count(*)::int AS bill_count
    FROM filtered
    GROUP BY 1
  ),
  daily AS (
    SELECT
      bill_date::text AS period,
      sum(revenue_net) AS revenue_net,
      count(*)::int AS bill_count,
      COALESCE(sum(revenue_net) FILTER (WHERE branch = 'HQ'), 0) AS hq_revenue_net,
      COALESCE(sum(revenue_net) FILTER (WHERE branch = 'SYP'), 0) AS syp_revenue_net,
      COALESCE(sum(revenue_net) FILTER (WHERE branch = 'ONLINE'), 0) AS online_revenue_net
    FROM filtered
    GROUP BY 1
    ORDER BY 1
  ),
  monthly AS (
    SELECT
      to_char(date_trunc('month', bill_date), 'YYYY-MM') AS period,
      sum(revenue_net) AS revenue_net,
      count(*)::int AS bill_count,
      COALESCE(sum(revenue_net) FILTER (WHERE branch = 'HQ'), 0) AS hq_revenue_net,
      COALESCE(sum(revenue_net) FILTER (WHERE branch = 'SYP'), 0) AS syp_revenue_net,
      COALESCE(sum(revenue_net) FILTER (WHERE branch = 'ONLINE'), 0) AS online_revenue_net
    FROM filtered
    GROUP BY 1
    ORDER BY 1
  )
  SELECT jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'branch', p_branch,
    'previous_from', v_prev_from,
    'previous_to', v_prev_to,
    'summary', (
      SELECT jsonb_build_object(
        'revenue_net', revenue_net,
        'vat_baht', vat_baht,
        'bill_count', bill_count,
        'avg_bill', avg_bill
      ) FROM summary
    ),
    'previous_summary', (
      SELECT jsonb_build_object(
        'revenue_net', revenue_net,
        'vat_baht', vat_baht,
        'bill_count', bill_count
      ) FROM prev_summary
    ),
    'by_sales_type', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', key, 'revenue_net', revenue_net, 'bill_count', bill_count
      ) ORDER BY key)
      FROM by_sales_type
    ), '[]'::jsonb),
    'by_branch', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', key, 'revenue_net', revenue_net, 'bill_count', bill_count
      ) ORDER BY key)
      FROM by_branch
    ), '[]'::jsonb),
    'by_channel', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', key, 'revenue_net', revenue_net, 'bill_count', bill_count
      ) ORDER BY key)
      FROM by_channel
    ), '[]'::jsonb),
    'by_billtype', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', key, 'revenue_net', revenue_net, 'bill_count', bill_count
      ) ORDER BY revenue_net DESC)
      FROM by_billtype
    ), '[]'::jsonb),
    'trend_daily', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'period', period,
        'revenue_net', revenue_net,
        'bill_count', bill_count,
        'hq_revenue_net', hq_revenue_net,
        'syp_revenue_net', syp_revenue_net,
        'online_revenue_net', online_revenue_net
      ) ORDER BY period)
      FROM daily
    ), '[]'::jsonb),
    'trend_monthly', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'period', period,
        'revenue_net', revenue_net,
        'bill_count', bill_count,
        'hq_revenue_net', hq_revenue_net,
        'syp_revenue_net', syp_revenue_net,
        'online_revenue_net', online_revenue_net
      ) ORDER BY period)
      FROM monthly
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.fn_bi_sales_overview(date, date, text) IS
  'Sales BI overview: net BEFORETAX; reporting_branch HQ/SYP/ONLINE (TAD/CNTAD not in HQ).';

GRANT EXECUTE ON FUNCTION public.fn_bi_sales_overview(date, date, text) TO service_role;

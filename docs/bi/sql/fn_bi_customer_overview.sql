-- Customer BI overview: bill-grain net revenue ranked by bill ACCTNO (AR customer).
-- Blank ACCTNO excluded (walk-in / cash).
-- Display name: public.party → raw_kcw ARMAS → blank (only when both missing).
-- See docs/bi/kcw-sales-data-dictionary.md §6.9 / §8.7 and kcw-ar-ap-data-dictionary.md.

CREATE OR REPLACE FUNCTION public.fn_bi_customer_overview(
  p_from date,
  p_to date,
  p_branch text DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, curated_kcw, raw_kcw
AS $$
DECLARE
  v_result jsonb;
  v_prev_from date;
  v_prev_to date;
  v_span int;
  v_limit int;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'Invalid date range';
  END IF;

  IF p_branch IS NOT NULL AND p_branch NOT IN ('HQ', 'SYP', 'ONLINE') THEN
    RAISE EXCEPTION 'Invalid branch';
  END IF;

  v_limit := GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
  v_span := (p_to - p_from);
  v_prev_to := p_from - 1;
  v_prev_from := v_prev_to - v_span;

  WITH base AS (
    SELECT
      left(b."BILLDATE", 10)::date AS bill_date,
      CASE
        WHEN COALESCE(b."BILLTYPE_STD", '') = 'TAD' THEN 'ONLINE'
        WHEN COALESCE(b."BILLTYPE_STD", '') = 'CN'
          AND b."BILLNO" ~* '^CNTAD' THEN 'ONLINE'
        ELSE b."BRANCH"
      END AS reporting_branch,
      b."BILLNO" AS bill_no,
      nullif(btrim(COALESCE(b."ACCTNO"::text, '')), '') AS acctno,
      nullif(btrim(COALESCE(b."ACCTNAME"::text, '')), '') AS bill_acctname,
      COALESCE(NULLIF(replace(b."BEFORETAX", ',', ''), '')::numeric, 0) AS revenue_net
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
    WHERE p_branch IS NULL OR reporting_branch = p_branch
  ),
  ranked AS (
    SELECT * FROM filtered
    WHERE acctno IS NOT NULL
  ),
  walkin AS (
    SELECT * FROM filtered
    WHERE acctno IS NULL
  ),
  prev_base AS (
    SELECT
      CASE
        WHEN COALESCE(b."BILLTYPE_STD", '') = 'TAD' THEN 'ONLINE'
        WHEN COALESCE(b."BILLTYPE_STD", '') = 'CN'
          AND b."BILLNO" ~* '^CNTAD' THEN 'ONLINE'
        ELSE b."BRANCH"
      END AS reporting_branch,
      nullif(btrim(COALESCE(b."ACCTNO"::text, '')), '') AS acctno,
      COALESCE(NULLIF(replace(b."BEFORETAX", ',', ''), '')::numeric, 0) AS revenue_net
    FROM curated_kcw.fact_sales_bills_all b
    WHERE b."CANCELED" = 'N'
      AND b."JOURMODE" <> '0'
      AND NOT public.fn_bi_sales_bill_excluded_from_revenue(b."BILLNO", b."BILLTYPE_STD")
      AND upper(btrim(b."BILLNO")) !~ '^(3)?SA'
      AND b."BILLDATE" >= v_prev_from::text
      AND b."BILLDATE" < (v_prev_to + 1)::text
  ),
  prev_ranked AS (
    SELECT *
    FROM prev_base
    WHERE acctno IS NOT NULL
      AND (p_branch IS NULL OR reporting_branch = p_branch)
  ),
  customer_agg AS (
    SELECT
      acctno,
      max(bill_acctname) AS bill_acctname,
      sum(revenue_net) AS revenue_net,
      count(*)::int AS bill_count,
      CASE WHEN count(*) > 0
        THEN sum(revenue_net) / count(*)
        ELSE 0
      END AS avg_bill,
      COALESCE(sum(revenue_net) FILTER (WHERE reporting_branch = 'HQ'), 0) AS hq_revenue_net,
      COALESCE(sum(revenue_net) FILTER (WHERE reporting_branch = 'SYP'), 0) AS syp_revenue_net,
      COALESCE(sum(revenue_net) FILTER (WHERE reporting_branch = 'ONLINE'), 0) AS online_revenue_net
    FROM ranked
    GROUP BY acctno
  ),
  armas AS (
    SELECT DISTINCT ON (nullif(btrim(COALESCE(a."ACCTNO"::text, '')), ''))
      nullif(btrim(COALESCE(a."ACCTNO"::text, '')), '') AS acctno,
      nullif(btrim(COALESCE(a."ACCTNAME"::text, '')), '') AS armas_name
    FROM raw_kcw.raw_hq_armas_receivable a
    WHERE nullif(btrim(COALESCE(a."ACCTNO"::text, '')), '') IS NOT NULL
      AND COALESCE(a."CANCELED", 'N') <> 'Y'
    ORDER BY
      nullif(btrim(COALESCE(a."ACCTNO"::text, '')), ''),
      CASE WHEN nullif(btrim(COALESCE(a."ACCTNAME"::text, '')), '') IS NOT NULL
        THEN 0 ELSE 1 END
  ),
  enriched AS (
    SELECT
      a.acctno,
      CASE
        WHEN nullif(btrim(COALESCE(p.party_name, '')), '') IS NOT NULL
          THEN btrim(p.party_name)
        WHEN nullif(btrim(COALESCE(ar.armas_name, '')), '') IS NOT NULL
          THEN btrim(ar.armas_name)
        ELSE NULL
      END AS customer_name,
      CASE
        WHEN nullif(btrim(COALESCE(p.party_name, '')), '') IS NOT NULL THEN 'party'
        WHEN nullif(btrim(COALESCE(ar.armas_name, '')), '') IS NOT NULL THEN 'armas'
        ELSE 'none'
      END AS name_source,
      a.bill_acctname,
      (p.party_code IS NOT NULL) AS in_party,
      (ar.acctno IS NOT NULL) AS in_armas,
      p.kind AS party_kind,
      a.revenue_net,
      a.bill_count,
      a.avg_bill,
      a.hq_revenue_net,
      a.syp_revenue_net,
      a.online_revenue_net
    FROM customer_agg a
    LEFT JOIN public.party p ON p.party_code = a.acctno
    LEFT JOIN armas ar ON ar.acctno = a.acctno
  ),
  summary AS (
    SELECT
      COALESCE(sum(revenue_net), 0) AS revenue_net,
      count(*)::int AS customer_count,
      COALESCE(sum(bill_count), 0)::int AS bill_count,
      CASE WHEN COALESCE(sum(bill_count), 0) > 0
        THEN COALESCE(sum(revenue_net), 0) / sum(bill_count)
        ELSE 0
      END AS avg_bill,
      count(*) FILTER (WHERE in_party)::int AS matched_customer_count,
      count(*) FILTER (WHERE NOT in_party)::int AS unmatched_customer_count
    FROM enriched
  ),
  walkin_summary AS (
    SELECT
      COALESCE(sum(revenue_net), 0) AS revenue_net,
      count(*)::int AS bill_count
    FROM walkin
  ),
  prev_summary AS (
    SELECT
      COALESCE(sum(revenue_net), 0) AS revenue_net,
      count(DISTINCT acctno)::int AS customer_count,
      count(*)::int AS bill_count
    FROM prev_ranked
  ),
  by_branch AS (
    SELECT
      reporting_branch AS key,
      sum(revenue_net) AS revenue_net,
      count(*)::int AS bill_count
    FROM ranked
    GROUP BY 1
  ),
  top_customers AS (
    SELECT *
    FROM enriched
    ORDER BY revenue_net DESC, bill_count DESC, acctno
    LIMIT v_limit
  ),
  unmatched_customers AS (
    SELECT *
    FROM enriched
    WHERE NOT in_party
    ORDER BY revenue_net DESC, bill_count DESC, acctno
  ),
  month_columns AS (
    SELECT to_char(d::date, 'YYYY-MM') AS period
    FROM generate_series(
      date_trunc('month', p_from::timestamp)::date,
      date_trunc('month', p_to::timestamp)::date,
      interval '1 month'
    ) AS d
  ),
  customer_month AS (
    SELECT
      acctno,
      to_char(bill_date, 'YYYY-MM') AS period,
      sum(revenue_net) AS revenue_net
    FROM ranked
    GROUP BY acctno, to_char(bill_date, 'YYYY-MM')
  ),
  by_customer_month AS (
    SELECT
      tc.acctno::text AS key,
      COALESCE(tc.customer_name, tc.acctno) AS label,
      tc.acctno AS sublabel,
      tc.revenue_net AS total,
      COALESCE(
        (
          SELECT jsonb_object_agg(cm.period, cm.revenue_net)
          FROM customer_month cm
          WHERE cm.acctno = tc.acctno
        ),
        '{}'::jsonb
      ) AS months
    FROM top_customers tc
  )
  SELECT jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'branch', p_branch,
    'limit', v_limit,
    'previous_from', v_prev_from,
    'previous_to', v_prev_to,
    'summary', (
      SELECT jsonb_build_object(
        'revenue_net', revenue_net,
        'customer_count', customer_count,
        'bill_count', bill_count,
        'avg_bill', avg_bill,
        'matched_customer_count', matched_customer_count,
        'unmatched_customer_count', unmatched_customer_count
      ) FROM summary
    ),
    'walkin_summary', (
      SELECT jsonb_build_object(
        'revenue_net', revenue_net,
        'bill_count', bill_count
      ) FROM walkin_summary
    ),
    'previous_summary', (
      SELECT jsonb_build_object(
        'revenue_net', revenue_net,
        'customer_count', customer_count,
        'bill_count', bill_count
      ) FROM prev_summary
    ),
    'by_branch', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', key,
        'revenue_net', revenue_net,
        'bill_count', bill_count
      ) ORDER BY key)
      FROM by_branch
    ), '[]'::jsonb),
    'top_customers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'acctno', acctno,
        'customer_name', customer_name,
        'name_source', name_source,
        'bill_acctname', bill_acctname,
        'in_party', in_party,
        'in_armas', in_armas,
        'party_kind', party_kind,
        'revenue_net', revenue_net,
        'bill_count', bill_count,
        'avg_bill', avg_bill,
        'hq_revenue_net', hq_revenue_net,
        'syp_revenue_net', syp_revenue_net,
        'online_revenue_net', online_revenue_net
      ) ORDER BY revenue_net DESC, bill_count DESC, acctno)
      FROM top_customers
    ), '[]'::jsonb),
    'unmatched_customers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'acctno', acctno,
        'customer_name', customer_name,
        'name_source', name_source,
        'bill_acctname', bill_acctname,
        'in_party', in_party,
        'in_armas', in_armas,
        'party_kind', party_kind,
        'revenue_net', revenue_net,
        'bill_count', bill_count,
        'avg_bill', avg_bill,
        'hq_revenue_net', hq_revenue_net,
        'syp_revenue_net', syp_revenue_net,
        'online_revenue_net', online_revenue_net
      ) ORDER BY revenue_net DESC, bill_count DESC, acctno)
      FROM unmatched_customers
    ), '[]'::jsonb),
    'month_columns', COALESCE((
      SELECT jsonb_agg(period ORDER BY period)
      FROM month_columns
    ), '[]'::jsonb),
    'by_customer_month', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', key,
        'label', label,
        'sublabel', sublabel,
        'total', total,
        'months', months
      ) ORDER BY total DESC, label)
      FROM by_customer_month
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.fn_bi_customer_overview(date, date, text, integer) IS
  'Customer BI: bill BEFORETAX ranking by ACCTNO; name = party → ARMAS → blank; expose name_source.';

GRANT EXECUTE ON FUNCTION public.fn_bi_customer_overview(date, date, text, integer) TO service_role;

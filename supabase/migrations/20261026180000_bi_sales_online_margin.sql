-- Applied via Supabase migration: fn_bi_sales_overview (+ ONLINE branch + trend splits)
-- Sales BI overview: bill-grain net revenue (BEFORETAX) with confirmed filters.
-- See docs/bi/kcw-sales-data-dictionary.md §8.
-- Reporting branch: TAD/CNTAD count as ONLINE (not HQ store).
-- Online margin (ALL or ONLINE): statement fees linked to each bill, plus daily FIFO cost.

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
  ),
  -- Marketplace fees are stored as negative expense on the payout line.
  -- Share one order's fees across its bills by after-tax weight so a split
  -- shipment is not charged twice and is not dumped onto the first bill only.
  link_bill AS (
    SELECT
      ob.payout_key,
      nullif(btrim(ob.order_id), '') AS order_id,
      ob.billno,
      lower(ob.platform) AS platform,
      abs(coalesce(ob.aftertax, 0)) AS weight
    FROM curated_kcw.online_order_bills ob
    WHERE NOT ob.canceled
  ),
  link_share AS (
    SELECT
      payout_key,
      order_id,
      billno,
      platform,
      CASE
        WHEN sum(weight) OVER (PARTITION BY payout_key, order_id) > 0
          THEN weight / sum(weight) OVER (PARTITION BY payout_key, order_id)
        ELSE 1.0 / count(*) OVER (PARTITION BY payout_key, order_id)
      END AS order_share
    FROM link_bill
    WHERE order_id IS NOT NULL
  ),
  payout_bill AS (
    SELECT DISTINCT payout_key, billno, weight
    FROM link_bill
  ),
  payout_share AS (
    SELECT
      payout_key,
      billno,
      CASE
        WHEN sum(weight) OVER (PARTITION BY payout_key) > 0
          THEN weight / sum(weight) OVER (PARTITION BY payout_key)
        ELSE 1.0 / count(*) OVER (PARTITION BY payout_key)
      END AS payout_share
    FROM payout_bill
  ),
  order_expense AS (
    SELECT
      payout_key,
      nullif(btrim(order_id), '') AS order_id,
      sum(coalesce(expense_amount, 0)) AS expense_amount
    FROM curated_kcw.online_payout_lines
    WHERE nullif(btrim(order_id), '') IS NOT NULL
    GROUP BY 1, 2
  ),
  payout_expense AS (
    SELECT
      payout_key,
      sum(coalesce(expense_amount, 0)) AS expense_amount
    FROM curated_kcw.online_payout_lines
    WHERE nullif(btrim(order_id), '') IS NULL
    GROUP BY 1
  ),
  bill_fee AS (
    SELECT billno, sum(expense_amount) AS expense_amount
    FROM (
      SELECT s.billno, s.order_share * e.expense_amount AS expense_amount
      FROM link_share s
      JOIN order_expense e
        ON e.payout_key = s.payout_key
       AND e.order_id = s.order_id
      UNION ALL
      SELECT s.billno, s.payout_share * e.expense_amount
      FROM payout_share s
      JOIN payout_expense e ON e.payout_key = s.payout_key
    ) allocated
    GROUP BY billno
  ),
  line_fee_item AS (
    SELECT
      l.payout_key,
      l.line_no,
      nullif(btrim(l.order_id), '') AS order_id,
      l.expense_amount,
      coalesce(nullif(btrim(f.elem->>'name'), ''), 'ค่าธรรมเนียม') AS fee_name,
      btrim(f.elem->>'amount')::numeric AS amount
    FROM curated_kcw.online_payout_lines l
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(l.fees, '[]'::jsonb)) AS f(elem)
    WHERE btrim(f.elem->>'amount') ~ '^-?[0-9]+(\.[0-9]+)?$'
      AND btrim(f.elem->>'amount')::numeric < 0
  ),
  line_fee_scaled AS (
    SELECT
      payout_key,
      order_id,
      fee_name,
      CASE
        WHEN sum(amount) OVER (PARTITION BY payout_key, line_no) = 0 THEN 0
        ELSE amount * expense_amount / sum(amount) OVER (PARTITION BY payout_key, line_no)
      END AS amount
    FROM line_fee_item
  ),
  line_fee_fallback AS (
    SELECT
      l.payout_key,
      nullif(btrim(l.order_id), '') AS order_id,
      'ค่าธรรมเนียม'::text AS fee_name,
      l.expense_amount AS amount
    FROM curated_kcw.online_payout_lines l
    WHERE coalesce(l.expense_amount, 0) <> 0
      AND NOT EXISTS (
        SELECT 1
        FROM line_fee_item i
        WHERE i.payout_key = l.payout_key
          AND i.line_no = l.line_no
      )
  ),
  named_fee AS (
    SELECT payout_key, order_id, fee_name, sum(amount) AS amount
    FROM (
      SELECT payout_key, order_id, fee_name, amount FROM line_fee_scaled
      UNION ALL
      SELECT payout_key, order_id, fee_name, amount FROM line_fee_fallback
    ) named
    GROUP BY 1, 2, 3
  ),
  bill_fee_name AS (
    SELECT billno, fee_name, sum(amount) AS amount
    FROM (
      SELECT s.billno, n.fee_name, s.order_share * n.amount AS amount
      FROM link_share s
      JOIN named_fee n
        ON n.payout_key = s.payout_key
       AND n.order_id = s.order_id
      UNION ALL
      SELECT s.billno, n.fee_name, s.payout_share * n.amount
      FROM payout_share s
      JOIN named_fee n
        ON n.payout_key = s.payout_key
       AND n.order_id IS NULL
    ) named_alloc
    GROUP BY billno, fee_name
  ),
  bill_platform AS (
    SELECT billno, min(platform) AS platform
    FROM link_bill
    GROUP BY billno
  ),
  online_now AS (
    SELECT bill_no, bill_date, revenue_net
    FROM base
    WHERE branch = 'ONLINE'
      AND (p_branch IS NULL OR p_branch = 'ONLINE')
  ),
  online_prev AS (
    SELECT
      b."BILLNO" AS bill_no,
      left(b."BILLDATE", 10)::date AS bill_date,
      COALESCE(NULLIF(replace(b."BEFORETAX", ',', ''), '')::numeric, 0) AS revenue_net
    FROM curated_kcw.fact_sales_bills_all b
    WHERE b."CANCELED" = 'N'
      AND b."JOURMODE" <> '0'
      AND NOT public.fn_bi_sales_bill_excluded_from_revenue(b."BILLNO", b."BILLTYPE_STD")
      AND upper(btrim(b."BILLNO")) !~ '^(3)?SA'
      AND b."BILLDATE" >= v_prev_from::text
      AND b."BILLDATE" < (v_prev_to + 1)::text
      AND (
        COALESCE(b."BILLTYPE_STD", '') = 'TAD'
        OR (
          COALESCE(b."BILLTYPE_STD", '') = 'CN'
          AND b."BILLNO" ~* '^CNTAD'
        )
      )
      AND (p_branch IS NULL OR p_branch = 'ONLINE')
  ),
  online_scope AS (
    SELECT 'now'::text AS span, bill_no, bill_date, revenue_net FROM online_now
    UNION ALL
    SELECT 'prev'::text, bill_no, bill_date, revenue_net FROM online_prev
  ),
  fifo_for_bills AS (
    SELECT
      c.sale_billno,
      sum(c.fifo_ext_cost)::numeric AS fifo_ext_cost,
      count(*)::int AS cost_lines,
      count(*) FILTER (WHERE c.status <> 'OK')::int AS weak_lines
    FROM fifo.sale_cost c
    WHERE c.sale_billno IN (SELECT bill_no FROM online_scope)
    GROUP BY c.sale_billno
  ),
  online_rows AS (
    SELECT
      s.span,
      s.bill_no,
      s.bill_date,
      s.revenue_net,
      COALESCE(-f.expense_amount, 0) AS fee_baht,
      COALESCE(fc.fifo_ext_cost, 0) AS fifo_ext_cost,
      COALESCE(fc.cost_lines, 0) AS cost_lines,
      COALESCE(fc.weak_lines, 0) AS weak_lines,
      (f.billno IS NOT NULL) AS fee_linked,
      COALESCE(bp.platform, 'unlinked') AS platform
    FROM online_scope s
    LEFT JOIN bill_fee f ON f.billno = s.bill_no
    LEFT JOIN fifo_for_bills fc ON fc.sale_billno = s.bill_no
    LEFT JOIN bill_platform bp ON bp.billno = s.bill_no
  ),
  online_summary AS (
    SELECT
      spans.span,
      COALESCE(sum(r.revenue_net), 0) AS revenue_net,
      COALESCE(sum(r.fee_baht), 0) AS fee_baht,
      COALESCE(sum(r.fifo_ext_cost), 0) AS fifo_ext_cost,
      COALESCE(sum(r.revenue_net), 0)
        - COALESCE(sum(r.fee_baht), 0)
        - COALESCE(sum(r.fifo_ext_cost), 0) AS profit,
      count(r.bill_no)::int AS bill_count,
      count(r.bill_no) FILTER (WHERE r.fee_linked)::int AS fee_bill_count,
      count(r.bill_no) FILTER (WHERE r.cost_lines > 0)::int AS fifo_bill_count,
      count(r.bill_no) FILTER (WHERE r.weak_lines > 0)::int AS fifo_partial_bill_count,
      count(r.bill_no) FILTER (
        WHERE r.cost_lines = 0 AND r.bill_no !~* '^(3)?CNTAD'
      )::int AS fifo_missing_bill_count
    FROM (VALUES ('now'), ('prev')) AS spans(span)
    LEFT JOIN online_rows r ON r.span = spans.span
    GROUP BY spans.span
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
    ), '[]'::jsonb),
    'online_margin', (
      SELECT jsonb_build_object(
        'revenue_net', round(revenue_net, 2),
        'fee_baht', round(fee_baht, 2),
        'fifo_ext_cost', round(fifo_ext_cost, 2),
        'profit', round(profit, 2),
        'margin_pct', CASE
          WHEN revenue_net = 0 THEN NULL
          ELSE round((profit / revenue_net) * 100, 2)
        END,
        'bill_count', bill_count,
        'fee_bill_count', fee_bill_count,
        'fifo_bill_count', fifo_bill_count,
        'fifo_partial_bill_count', fifo_partial_bill_count,
        'fifo_missing_bill_count', fifo_missing_bill_count,
        'by_platform', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'platform', platform,
            'revenue_net', round(revenue_net, 2),
            'fee_baht', round(fee_baht, 2),
            'fifo_ext_cost', round(fifo_ext_cost, 2),
            'profit', round(profit, 2),
            'bill_count', bill_count
          ) ORDER BY revenue_net DESC)
          FROM (
            SELECT
              platform,
              sum(revenue_net) AS revenue_net,
              sum(fee_baht) AS fee_baht,
              sum(fifo_ext_cost) AS fifo_ext_cost,
              sum(revenue_net) - sum(fee_baht) - sum(fifo_ext_cost) AS profit,
              count(*)::int AS bill_count
            FROM online_rows
            WHERE span = 'now'
            GROUP BY platform
          ) platform_rows
        ), '[]'::jsonb),
        'by_fee', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'fee_name', fee_name,
            'fee_baht', round(fee_baht, 2)
          ) ORDER BY fee_baht DESC)
          FROM (
            SELECT fn.fee_name, sum(-fn.amount) AS fee_baht
            FROM bill_fee_name fn
            JOIN online_now o ON o.bill_no = fn.billno
            GROUP BY fn.fee_name
            HAVING sum(-fn.amount) <> 0
          ) fee_rows
        ), '[]'::jsonb),
        'trend_daily', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'period', period,
            'revenue_net', round(revenue_net, 2),
            'fee_baht', round(fee_baht, 2),
            'fifo_ext_cost', round(fifo_ext_cost, 2),
            'profit', round(profit, 2),
            'bill_count', bill_count
          ) ORDER BY period)
          FROM (
            SELECT
              bill_date::text AS period,
              sum(revenue_net) AS revenue_net,
              sum(fee_baht) AS fee_baht,
              sum(fifo_ext_cost) AS fifo_ext_cost,
              sum(revenue_net) - sum(fee_baht) - sum(fifo_ext_cost) AS profit,
              count(*)::int AS bill_count
            FROM online_rows
            WHERE span = 'now'
            GROUP BY bill_date
          ) day_rows
        ), '[]'::jsonb),
        'trend_monthly', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'period', period,
            'revenue_net', round(revenue_net, 2),
            'fee_baht', round(fee_baht, 2),
            'fifo_ext_cost', round(fifo_ext_cost, 2),
            'profit', round(profit, 2),
            'bill_count', bill_count
          ) ORDER BY period)
          FROM (
            SELECT
              to_char(date_trunc('month', bill_date), 'YYYY-MM') AS period,
              sum(revenue_net) AS revenue_net,
              sum(fee_baht) AS fee_baht,
              sum(fifo_ext_cost) AS fifo_ext_cost,
              sum(revenue_net) - sum(fee_baht) - sum(fifo_ext_cost) AS profit,
              count(*)::int AS bill_count
            FROM online_rows
            WHERE span = 'now'
            GROUP BY 1
          ) month_rows
        ), '[]'::jsonb)
      )
      FROM online_summary
      WHERE span = 'now'
    ),
    'previous_online_margin', (
      SELECT jsonb_build_object(
        'revenue_net', round(revenue_net, 2),
        'fee_baht', round(fee_baht, 2),
        'fifo_ext_cost', round(fifo_ext_cost, 2),
        'profit', round(profit, 2),
        'margin_pct', CASE
          WHEN revenue_net = 0 THEN NULL
          ELSE round((profit / revenue_net) * 100, 2)
        END,
        'bill_count', bill_count,
        'fee_bill_count', fee_bill_count,
        'fifo_bill_count', fifo_bill_count,
        'fifo_partial_bill_count', fifo_partial_bill_count,
        'fifo_missing_bill_count', fifo_missing_bill_count
      )
      FROM online_summary
      WHERE span = 'prev'
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.fn_bi_sales_overview(date, date, text) IS
  'Sales BI overview: net BEFORETAX; reporting_branch HQ/SYP/ONLINE (TAD/CNTAD not in HQ). Online margin adds statement fees linked to each bill and daily FIFO cost.';

GRANT EXECUTE ON FUNCTION public.fn_bi_sales_overview(date, date, text) TO service_role;

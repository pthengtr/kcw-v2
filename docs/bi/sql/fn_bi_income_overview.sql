-- Income BI overview: gross margin (line revenue − last-purchase COGS) − app opex.
-- See docs/bi/kcw-income-data-dictionary.md and sales dictionary §8.5 / §6.7.

CREATE OR REPLACE FUNCTION public.fn_bi_income_overview(
  p_from date,
  p_to date,
  p_branch text DEFAULT NULL,
  p_timezone text DEFAULT 'Asia/Bangkok'
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

  WITH bills AS (
    SELECT
      b."BRANCH" AS store_branch,
      b."BILLNO" AS bill_no,
      left(b."BILLDATE", 10)::date AS bill_date,
      CASE
        WHEN COALESCE(b."BILLTYPE_STD", '') = 'TAD' THEN 'ONLINE'
        WHEN COALESCE(b."BILLTYPE_STD", '') = 'CN'
          AND b."BILLNO" ~* '^CNTAD' THEN 'ONLINE'
        ELSE b."BRANCH"
      END AS reporting_branch,
      COALESCE(NULLIF(replace(b."AFTERTAX", ',', ''), '')::numeric, 0) AS aftertax
    FROM curated_kcw.fact_sales_bills_all b
    WHERE b."CANCELED" = 'N'
      AND b."JOURMODE" <> '0'
      AND COALESCE(b."BILLTYPE_STD", '') NOT IN ('TF', 'TFV', 'TAR')
      AND upper(btrim(b."BILLNO")) !~ '^(3)?SA'
      AND b."BILLDATE" >= p_from::text
      AND b."BILLDATE" < (p_to + 1)::text
  ),
  lines_raw AS (
    SELECT
      b.bill_date,
      b.reporting_branch,
      b.store_branch,
      b.bill_no,
      b.aftertax,
      l."ISVAT" AS isvat,
      l."TAXIC" AS taxic,
      COALESCE(
        NULLIF(replace(COALESCE(l."AMOUNT_NUM", l."AMOUNT"), ',', ''), '')::numeric,
        0
      ) AS amount_gross,
      COALESCE(NULLIF(replace(l."QTY", ',', ''), '')::numeric, 0)
        * COALESCE(
            NULLIF(
              COALESCE(NULLIF(replace(nullif(trim(l."MTP"), ''), ',', ''), '')::numeric, 0),
              0
            ),
            1
          ) AS qty_base,
      COALESCE(
        NULLIF(replace(nullif(btrim(l."LAST_PURCHASE_COST"), ''), ',', ''), '')::numeric,
        0
      ) AS unit_cost,
      CASE
        WHEN nullif(btrim(COALESCE(l."LAST_PURCHASE_COST", '')), '') IS NULL
          THEN 1
        ELSE 0
      END AS blank_cost_flag
    FROM curated_kcw.fact_sales_all l
    JOIN bills b
      ON b.store_branch = l."BRANCH"
     AND b.bill_no = l."BILLNO"
    WHERE l."IS_VALID" = 'True'
      AND l."CANCELED" = 'N'
      AND l."BILLDATE" >= p_from::text
      AND l."BILLDATE" < (p_to + 1)::text
  ),
  bill_line_sums AS (
    SELECT
      store_branch,
      bill_no,
      sum(amount_gross) AS line_gross_sum
    FROM lines_raw
    GROUP BY store_branch, bill_no
  ),
  sales_lines_all AS (
    SELECT
      r.bill_date,
      r.reporting_branch,
      r.store_branch,
      r.bill_no,
      r.blank_cost_flag,
      r.qty_base * r.unit_cost AS cogs,
      CASE
        WHEN r.isvat = 'Y' AND r.taxic = 'Y'
          THEN (
            r.amount_gross
            - CASE
                WHEN COALESCE(s.line_gross_sum, 0) = 0 THEN 0
                ELSE (s.line_gross_sum - r.aftertax) * (r.amount_gross / s.line_gross_sum)
              END
          ) / 1.07
        ELSE
          r.amount_gross
          - CASE
              WHEN COALESCE(s.line_gross_sum, 0) = 0 THEN 0
              ELSE (s.line_gross_sum - r.aftertax) * (r.amount_gross / s.line_gross_sum)
            END
      END AS revenue_net
    FROM lines_raw r
    JOIN bill_line_sums s
      ON s.store_branch = r.store_branch
     AND s.bill_no = r.bill_no
    WHERE p_branch IS NULL OR r.reporting_branch = p_branch
  ),
  -- Blank LAST_PURCHASE_COST lines are listed for drilldown but excluded from margin math
  sales_lines AS (
    SELECT *
    FROM sales_lines_all
    WHERE blank_cost_flag = 0
  ),
  blank_cost_summary AS (
    SELECT COALESCE(sum(blank_cost_flag), 0)::int AS blank_cost_line_count
    FROM sales_lines_all
  ),
  prev_bills AS (
    SELECT
      b."BRANCH" AS store_branch,
      b."BILLNO" AS bill_no,
      CASE
        WHEN COALESCE(b."BILLTYPE_STD", '') = 'TAD' THEN 'ONLINE'
        WHEN COALESCE(b."BILLTYPE_STD", '') = 'CN'
          AND b."BILLNO" ~* '^CNTAD' THEN 'ONLINE'
        ELSE b."BRANCH"
      END AS reporting_branch,
      COALESCE(NULLIF(replace(b."AFTERTAX", ',', ''), '')::numeric, 0) AS aftertax
    FROM curated_kcw.fact_sales_bills_all b
    WHERE b."CANCELED" = 'N'
      AND b."JOURMODE" <> '0'
      AND COALESCE(b."BILLTYPE_STD", '') NOT IN ('TF', 'TFV', 'TAR')
      AND upper(btrim(b."BILLNO")) !~ '^(3)?SA'
      AND b."BILLDATE" >= v_prev_from::text
      AND b."BILLDATE" < (v_prev_to + 1)::text
  ),
  prev_lines_raw AS (
    SELECT
      b.reporting_branch,
      b.store_branch,
      b.bill_no,
      b.aftertax,
      l."ISVAT" AS isvat,
      l."TAXIC" AS taxic,
      COALESCE(
        NULLIF(replace(COALESCE(l."AMOUNT_NUM", l."AMOUNT"), ',', ''), '')::numeric,
        0
      ) AS amount_gross,
      COALESCE(NULLIF(replace(l."QTY", ',', ''), '')::numeric, 0)
        * COALESCE(
            NULLIF(
              COALESCE(NULLIF(replace(nullif(trim(l."MTP"), ''), ',', ''), '')::numeric, 0),
              0
            ),
            1
          ) AS qty_base,
      COALESCE(
        NULLIF(replace(nullif(btrim(l."LAST_PURCHASE_COST"), ''), ',', ''), '')::numeric,
        0
      ) AS unit_cost,
      CASE
        WHEN nullif(btrim(COALESCE(l."LAST_PURCHASE_COST", '')), '') IS NULL
          THEN 1
        ELSE 0
      END AS blank_cost_flag
    FROM curated_kcw.fact_sales_all l
    JOIN prev_bills b
      ON b.store_branch = l."BRANCH"
     AND b.bill_no = l."BILLNO"
    WHERE l."IS_VALID" = 'True'
      AND l."CANCELED" = 'N'
      AND l."BILLDATE" >= v_prev_from::text
      AND l."BILLDATE" < (v_prev_to + 1)::text
  ),
  prev_bill_line_sums AS (
    SELECT store_branch, bill_no, sum(amount_gross) AS line_gross_sum
    FROM prev_lines_raw
    GROUP BY store_branch, bill_no
  ),
  prev_sales_lines AS (
    SELECT
      CASE
        WHEN r.isvat = 'Y' AND r.taxic = 'Y'
          THEN (
            r.amount_gross
            - CASE
                WHEN COALESCE(s.line_gross_sum, 0) = 0 THEN 0
                ELSE (s.line_gross_sum - r.aftertax) * (r.amount_gross / s.line_gross_sum)
              END
          ) / 1.07
        ELSE
          r.amount_gross
          - CASE
              WHEN COALESCE(s.line_gross_sum, 0) = 0 THEN 0
              ELSE (s.line_gross_sum - r.aftertax) * (r.amount_gross / s.line_gross_sum)
            END
      END AS revenue_net,
      r.qty_base * r.unit_cost AS cogs
    FROM prev_lines_raw r
    JOIN prev_bill_line_sums s
      ON s.store_branch = r.store_branch
     AND s.bill_no = r.bill_no
    WHERE (p_branch IS NULL OR r.reporting_branch = p_branch)
      AND r.blank_cost_flag = 0
  ),
  entry_base AS (
    SELECT
      e.entry_uuid,
      e.item_uuid,
      i.item_name,
      c.category_uuid,
      c.category_name,
      r.receipt_uuid,
      r.branch_uuid,
      br.branch_name,
      (r.receipt_date AT TIME ZONE p_timezone)::date AS expense_date,
      CASE WHEN COALESCE(r.signed_total, 0) < 0 THEN -1.0 ELSE 1.0 END AS sign_factor,
      GREATEST((e.entry_amount - e.discount), 0)::double precision AS entry_net,
      r.discount AS receipt_discount,
      (1 + ((r.vat - r.withholding) / 100.0))::double precision AS factor
    FROM public.expense_entry e
    JOIN public.expense_receipt r ON r.receipt_uuid = e.receipt_uuid
    JOIN public.expense_item i ON i.item_uuid = e.item_uuid
    JOIN public.expense_category c ON c.category_uuid = i.category_uuid
    JOIN public.branch br ON br.branch_uuid = r.branch_uuid
    WHERE (r.receipt_date AT TIME ZONE p_timezone)::date >= p_from
      AND (r.receipt_date AT TIME ZONE p_timezone)::date <= p_to
  ),
  entry_shares AS (
    SELECT
      entry_uuid,
      item_uuid,
      item_name,
      category_uuid,
      category_name,
      receipt_uuid,
      branch_uuid,
      branch_name,
      expense_date,
      sign_factor,
      entry_net,
      SUM(entry_net) OVER (PARTITION BY receipt_uuid) AS receipt_net_sum,
      receipt_discount,
      factor
    FROM entry_base
  ),
  entries_effective AS (
    SELECT
      expense_date,
      category_uuid,
      category_name,
      CASE
        WHEN btrim(category_name) = 'ออนไลน์' AND branch_name = 'สำนักงานใหญ่'
          THEN 'ONLINE'
        WHEN branch_name = 'สี่แยกพัฒนา' THEN 'SYP'
        WHEN branch_name = 'สำนักงานใหญ่' THEN 'HQ'
        ELSE 'OTHER'
      END AS reporting_branch,
      CASE
        WHEN receipt_net_sum > 0
          THEN sign_factor
            * (entry_net - (entry_net / receipt_net_sum) * receipt_discount)
            * factor
        ELSE 0
      END AS amount
    FROM entry_shares
  ),
  general_effective AS (
    SELECT
      (g.entry_date AT TIME ZONE p_timezone)::date AS expense_date,
      c.category_uuid,
      c.category_name,
      CASE
        WHEN btrim(c.category_name) = 'ออนไลน์' AND br.branch_name = 'สำนักงานใหญ่'
          THEN 'ONLINE'
        WHEN br.branch_name = 'สี่แยกพัฒนา' THEN 'SYP'
        WHEN br.branch_name = 'สำนักงานใหญ่' THEN 'HQ'
        ELSE 'OTHER'
      END AS reporting_branch,
      (g.unit_price * g.quantity)::double precision AS amount
    FROM public.expense_general g
    JOIN public.expense_item i ON i.item_uuid = g.item_uuid
    JOIN public.expense_category c ON c.category_uuid = i.category_uuid
    JOIN public.branch br ON br.branch_uuid = g.branch_uuid
    WHERE (g.entry_date AT TIME ZONE p_timezone)::date >= p_from
      AND (g.entry_date AT TIME ZONE p_timezone)::date <= p_to
  ),
  opex_rows AS (
    SELECT * FROM entries_effective
    UNION ALL
    SELECT * FROM general_effective
  ),
  opex_filtered AS (
    SELECT *
    FROM opex_rows
    WHERE p_branch IS NULL OR reporting_branch = p_branch
  ),
  prev_entry_base AS (
    SELECT
      e.entry_uuid,
      c.category_name,
      r.receipt_uuid,
      br.branch_name,
      CASE WHEN COALESCE(r.signed_total, 0) < 0 THEN -1.0 ELSE 1.0 END AS sign_factor,
      GREATEST((e.entry_amount - e.discount), 0)::double precision AS entry_net,
      r.discount AS receipt_discount,
      (1 + ((r.vat - r.withholding) / 100.0))::double precision AS factor
    FROM public.expense_entry e
    JOIN public.expense_receipt r ON r.receipt_uuid = e.receipt_uuid
    JOIN public.expense_item i ON i.item_uuid = e.item_uuid
    JOIN public.expense_category c ON c.category_uuid = i.category_uuid
    JOIN public.branch br ON br.branch_uuid = r.branch_uuid
    WHERE (r.receipt_date AT TIME ZONE p_timezone)::date >= v_prev_from
      AND (r.receipt_date AT TIME ZONE p_timezone)::date <= v_prev_to
  ),
  prev_entry_shares AS (
    SELECT
      entry_uuid,
      category_name,
      branch_name,
      sign_factor,
      entry_net,
      SUM(entry_net) OVER (PARTITION BY receipt_uuid) AS receipt_net_sum,
      receipt_discount,
      factor
    FROM prev_entry_base
  ),
  prev_entries_effective AS (
    SELECT
      CASE
        WHEN btrim(category_name) = 'ออนไลน์' AND branch_name = 'สำนักงานใหญ่'
          THEN 'ONLINE'
        WHEN branch_name = 'สี่แยกพัฒนา' THEN 'SYP'
        WHEN branch_name = 'สำนักงานใหญ่' THEN 'HQ'
        ELSE 'OTHER'
      END AS reporting_branch,
      CASE
        WHEN receipt_net_sum > 0
          THEN sign_factor
            * (entry_net - (entry_net / receipt_net_sum) * receipt_discount)
            * factor
        ELSE 0
      END AS amount
    FROM prev_entry_shares
  ),
  prev_general_effective AS (
    SELECT
      CASE
        WHEN btrim(c.category_name) = 'ออนไลน์' AND br.branch_name = 'สำนักงานใหญ่'
          THEN 'ONLINE'
        WHEN br.branch_name = 'สี่แยกพัฒนา' THEN 'SYP'
        WHEN br.branch_name = 'สำนักงานใหญ่' THEN 'HQ'
        ELSE 'OTHER'
      END AS reporting_branch,
      (g.unit_price * g.quantity)::double precision AS amount
    FROM public.expense_general g
    JOIN public.expense_item i ON i.item_uuid = g.item_uuid
    JOIN public.expense_category c ON c.category_uuid = i.category_uuid
    JOIN public.branch br ON br.branch_uuid = g.branch_uuid
    WHERE (g.entry_date AT TIME ZONE p_timezone)::date >= v_prev_from
      AND (g.entry_date AT TIME ZONE p_timezone)::date <= v_prev_to
  ),
  prev_opex_filtered AS (
    SELECT reporting_branch, amount
    FROM (
      SELECT * FROM prev_entries_effective
      UNION ALL
      SELECT * FROM prev_general_effective
    ) x
    WHERE p_branch IS NULL OR reporting_branch = p_branch
  ),
  sales_summary AS (
    SELECT
      COALESCE((SELECT sum(revenue_net) FROM sales_lines), 0) AS revenue_net,
      COALESCE((SELECT sum(cogs) FROM sales_lines), 0) AS cogs,
      COALESCE((SELECT count(*)::int FROM sales_lines), 0) AS line_count,
      COALESCE(
        (SELECT count(DISTINCT (store_branch, bill_no))::int FROM sales_lines),
        0
      ) AS bill_count,
      (SELECT blank_cost_line_count FROM blank_cost_summary) AS blank_cost_line_count
  ),
  opex_summary AS (
    SELECT COALESCE(sum(amount), 0)::numeric AS opex
    FROM opex_filtered
  ),
  prev_sales_summary AS (
    SELECT
      COALESCE(sum(revenue_net), 0) AS revenue_net,
      COALESCE(sum(cogs), 0) AS cogs
    FROM prev_sales_lines
  ),
  prev_opex_summary AS (
    SELECT COALESCE(sum(amount), 0)::numeric AS opex
    FROM prev_opex_filtered
  ),
  sales_by_branch AS (
    SELECT
      reporting_branch AS key,
      sum(revenue_net) AS revenue_net,
      sum(cogs) AS cogs,
      count(DISTINCT (store_branch, bill_no))::int AS bill_count
    FROM sales_lines
    GROUP BY reporting_branch
  ),
  opex_by_branch AS (
    SELECT
      reporting_branch AS key,
      sum(amount)::numeric AS opex
    FROM opex_filtered
    GROUP BY reporting_branch
  ),
  branch_keys AS (
    SELECT key FROM sales_by_branch
    UNION
    SELECT key FROM opex_by_branch
  ),
  by_branch AS (
    SELECT
      k.key,
      COALESCE(s.revenue_net, 0) AS revenue_net,
      COALESCE(s.cogs, 0) AS cogs,
      COALESCE(s.revenue_net, 0) - COALESCE(s.cogs, 0) AS gross_profit,
      COALESCE(o.opex, 0) AS opex,
      (COALESCE(s.revenue_net, 0) - COALESCE(s.cogs, 0)) - COALESCE(o.opex, 0) AS net_income,
      COALESCE(s.bill_count, 0) AS bill_count
    FROM branch_keys k
    LEFT JOIN sales_by_branch s ON s.key = k.key
    LEFT JOIN opex_by_branch o ON o.key = k.key
  ),
  opex_by_category AS (
    SELECT
      category_uuid::text AS key,
      max(btrim(category_name)) AS label,
      sum(amount)::numeric AS amount
    FROM opex_filtered
    GROUP BY category_uuid
  ),
  sales_daily AS (
    SELECT
      bill_date::text AS period,
      sum(revenue_net) AS revenue_net,
      sum(cogs) AS cogs
    FROM sales_lines
    GROUP BY bill_date
  ),
  opex_daily AS (
    SELECT
      expense_date::text AS period,
      sum(amount)::numeric AS opex
    FROM opex_filtered
    GROUP BY expense_date
  ),
  daily_keys AS (
    SELECT period FROM sales_daily
    UNION
    SELECT period FROM opex_daily
  ),
  trend_daily AS (
    SELECT
      k.period,
      COALESCE(s.revenue_net, 0) AS revenue_net,
      COALESCE(s.cogs, 0) AS cogs,
      COALESCE(s.revenue_net, 0) - COALESCE(s.cogs, 0) AS gross_profit,
      COALESCE(o.opex, 0) AS opex,
      (COALESCE(s.revenue_net, 0) - COALESCE(s.cogs, 0)) - COALESCE(o.opex, 0) AS net_income
    FROM daily_keys k
    LEFT JOIN sales_daily s ON s.period = k.period
    LEFT JOIN opex_daily o ON o.period = k.period
  ),
  sales_monthly AS (
    SELECT
      to_char(date_trunc('month', bill_date), 'YYYY-MM') AS period,
      sum(revenue_net) AS revenue_net,
      sum(cogs) AS cogs
    FROM sales_lines
    GROUP BY 1
  ),
  opex_monthly AS (
    SELECT
      to_char(date_trunc('month', expense_date), 'YYYY-MM') AS period,
      sum(amount)::numeric AS opex
    FROM opex_filtered
    GROUP BY 1
  ),
  monthly_keys AS (
    SELECT period FROM sales_monthly
    UNION
    SELECT period FROM opex_monthly
  ),
  trend_monthly AS (
    SELECT
      k.period,
      COALESCE(s.revenue_net, 0) AS revenue_net,
      COALESCE(s.cogs, 0) AS cogs,
      COALESCE(s.revenue_net, 0) - COALESCE(s.cogs, 0) AS gross_profit,
      COALESCE(o.opex, 0) AS opex,
      (COALESCE(s.revenue_net, 0) - COALESCE(s.cogs, 0)) - COALESCE(o.opex, 0) AS net_income
    FROM monthly_keys k
    LEFT JOIN sales_monthly s ON s.period = k.period
    LEFT JOIN opex_monthly o ON o.period = k.period
  )
  SELECT jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'branch', p_branch,
    'previous_from', v_prev_from,
    'previous_to', v_prev_to,
    'summary', (
      SELECT jsonb_build_object(
        'revenue_net', ss.revenue_net,
        'cogs', ss.cogs,
        'gross_profit', ss.revenue_net - ss.cogs,
        'gross_margin_pct', CASE
          WHEN ss.revenue_net = 0 THEN NULL
          ELSE ((ss.revenue_net - ss.cogs) / ss.revenue_net) * 100
        END,
        'opex', os.opex,
        'net_income', (ss.revenue_net - ss.cogs) - os.opex,
        'net_margin_pct', CASE
          WHEN ss.revenue_net = 0 THEN NULL
          ELSE (((ss.revenue_net - ss.cogs) - os.opex) / ss.revenue_net) * 100
        END,
        'bill_count', ss.bill_count,
        'line_count', ss.line_count,
        'blank_cost_line_count', ss.blank_cost_line_count
      )
      FROM sales_summary ss
      CROSS JOIN opex_summary os
    ),
    'previous_summary', (
      SELECT jsonb_build_object(
        'revenue_net', ps.revenue_net,
        'cogs', ps.cogs,
        'gross_profit', ps.revenue_net - ps.cogs,
        'gross_margin_pct', CASE
          WHEN ps.revenue_net = 0 THEN NULL
          ELSE ((ps.revenue_net - ps.cogs) / ps.revenue_net) * 100
        END,
        'opex', po.opex,
        'net_income', (ps.revenue_net - ps.cogs) - po.opex,
        'net_margin_pct', CASE
          WHEN ps.revenue_net = 0 THEN NULL
          ELSE (((ps.revenue_net - ps.cogs) - po.opex) / ps.revenue_net) * 100
        END
      )
      FROM prev_sales_summary ps
      CROSS JOIN prev_opex_summary po
    ),
    'by_branch', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', key,
        'revenue_net', revenue_net,
        'cogs', cogs,
        'gross_profit', gross_profit,
        'opex', opex,
        'net_income', net_income,
        'bill_count', bill_count
      ) ORDER BY key)
      FROM by_branch
    ), '[]'::jsonb),
    'opex_by_category', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', key,
        'label', label,
        'amount', amount
      ) ORDER BY amount DESC)
      FROM opex_by_category
    ), '[]'::jsonb),
    'trend_daily', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'period', period,
        'revenue_net', revenue_net,
        'cogs', cogs,
        'gross_profit', gross_profit,
        'opex', opex,
        'net_income', net_income
      ) ORDER BY period)
      FROM trend_daily
    ), '[]'::jsonb),
    'trend_monthly', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'period', period,
        'revenue_net', revenue_net,
        'cogs', cogs,
        'gross_profit', gross_profit,
        'opex', opex,
        'net_income', net_income
      ) ORDER BY period)
      FROM trend_monthly
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.fn_bi_income_overview(date, date, text, text) IS
  'Income BI: margin on lines with LAST_PURCHASE_COST only; blank-cost lines excluded from totals but counted for drilldown; − app opex; HQ ออนไลน์→ONLINE.';

GRANT EXECUTE ON FUNCTION public.fn_bi_income_overview(date, date, text, text) TO service_role;

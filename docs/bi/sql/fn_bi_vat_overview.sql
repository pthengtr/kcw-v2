-- VAT sales / purchase BI overview (Thai tax-book logic from kcw-analytics notebooks 30–32).
-- See docs/bi/kcw-vat-data-dictionary.md.
-- Sources: fact_sales_bills_all (TD/TAD/TR/CN), billgen.fin_* (TAR/CNTAR),
--          raw_hq_pidet + raw_hq_pimas (VAT purchases), vw_expense_entry_flat_tax.

CREATE OR REPLACE FUNCTION public.fn_bi_vat_overview(
  p_from date,
  p_to date,
  p_branch text DEFAULT NULL,
  p_as_of date DEFAULT NULL,
  p_timezone text DEFAULT 'Asia/Bangkok'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, curated_kcw, raw_kcw, billgen
AS $$
DECLARE
  v_result jsonb;
  v_prev_from date;
  v_prev_to date;
  v_span int;
  v_hist_from date;
  v_as_of date;
  v_today date;
  v_days_elapsed int;
  v_days_range int;
  v_forecast_factor numeric;
  v_forecast_enabled boolean;
  v_hq_branch_uuid uuid := 'c93efb5f-07c9-4229-b6b3-568ce1c0a9ab';
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'Invalid date range';
  END IF;

  IF p_branch IS NOT NULL AND p_branch NOT IN ('HQ', 'SYP') THEN
    RAISE EXCEPTION 'Invalid branch';
  END IF;

  v_span := (p_to - p_from);
  v_prev_to := p_from - 1;
  v_prev_from := v_prev_to - v_span;
  -- Load enough history for the 12-month trend chart.
  v_hist_from := LEAST(
    v_prev_from,
    (date_trunc('month', p_to) - interval '11 months')::date
  );

  v_today := (timezone(p_timezone, now()))::date;
  v_as_of := COALESCE(p_as_of, v_today);
  IF v_as_of > p_to THEN
    v_as_of := p_to;
  END IF;
  IF v_as_of < p_from THEN
    v_as_of := p_from;
  END IF;

  v_days_range := (p_to - p_from) + 1;
  v_days_elapsed := (v_as_of - p_from) + 1;
  v_forecast_enabled := v_as_of < p_to AND v_days_elapsed > 0;
  v_forecast_factor := CASE
    WHEN v_forecast_enabled THEN v_days_range::numeric / v_days_elapsed::numeric
    ELSE 1
  END;

  WITH
  -- ─── Sales docs from curated bills (TD / TAD / TR / CN / CNTAD) ─────────────
  sales_docs AS (
    SELECT
      left(b."BILLDATE", 10)::date AS bill_date,
      CASE
        WHEN b."BRANCH" = 'SYP' OR upper(btrim(b."BILLNO")) ~ '^3' THEN 'SYP'
        ELSE 'HQ'
      END AS branch,
      CASE
        WHEN upper(btrim(b."BILLNO")) ~ '^(3)?CNTAD' THEN 'CNTAD'
        WHEN COALESCE(b."BILLTYPE_STD", '') = 'CN'
          OR upper(btrim(b."BILLNO")) ~ '^3CN' THEN 'CN'
        WHEN COALESCE(b."BILLTYPE_STD", '') = 'TAD'
          OR upper(btrim(b."BILLNO")) ~ '^3TAD' THEN 'TAD'
        WHEN COALESCE(b."BILLTYPE_STD", '') = 'TD'
          OR upper(btrim(b."BILLNO")) ~ '^3TD' THEN 'TD'
        WHEN COALESCE(b."BILLTYPE_STD", '') = 'TR'
          OR upper(btrim(b."BILLNO")) ~ '^3TR' THEN 'TR'
        ELSE NULL
      END AS doc_type,
      COALESCE(NULLIF(replace(b."BEFORETAX", ',', ''), '')::numeric, 0) AS beforetax,
      COALESCE(NULLIF(replace(b."TAX", ',', ''), '')::numeric, 0) AS tax,
      COALESCE(NULLIF(replace(b."AFTERTAX", ',', ''), '')::numeric, 0) AS aftertax
    FROM curated_kcw.fact_sales_bills_all b
    WHERE b."CANCELED" = 'N'
      AND upper(COALESCE(b."BILLNO", '')) NOT LIKE '%TF%'
      AND b."BILLDATE" >= (v_hist_from)::text
      AND b."BILLDATE" < (p_to + 1)::text
      AND (
        COALESCE(b."BILLTYPE_STD", '') IN ('TD', 'TAD', 'TR', 'CN')
        OR upper(btrim(b."BILLNO")) ~ '^(3TD|3TAD|3TR|3CN)'
      )
  ),
  -- ─── TAR / CNTAR from billgen (always VAT-inclusive totals) ─────────────────
  tar_bills AS (
    SELECT
      t.billdate AS bill_date,
      'HQ'::text AS branch,
      'TAR'::text AS doc_type,
      t.billno AS bill_key,
      SUM(t.amount)::numeric AS total_incl
    FROM billgen.fin_tar_lines t
    WHERE t.billdate >= v_hist_from
      AND t.billdate <= p_to
    GROUP BY t.billdate, t.billno
  ),
  tar3_bills AS (
    SELECT
      t.billdate AS bill_date,
      'SYP'::text AS branch,
      '3TAR'::text AS doc_type,
      t.billno AS bill_key,
      SUM(t.amount)::numeric AS total_incl
    FROM billgen.fin_3tar_lines t
    WHERE t.billdate >= v_hist_from
      AND t.billdate <= p_to
    GROUP BY t.billdate, t.billno
  ),
  cntar_bills AS (
    SELECT
      t.billdate AS bill_date,
      'HQ'::text AS branch,
      'CNTAR'::text AS doc_type,
      COALESCE(NULLIF(btrim(t.new_billno), ''), t.billno) AS bill_key,
      SUM(t.amount)::numeric AS total_incl
    FROM billgen.fin_cntar_lines t
    WHERE t.billdate >= v_hist_from
      AND t.billdate <= p_to
    GROUP BY t.billdate, COALESCE(NULLIF(btrim(t.new_billno), ''), t.billno)
  ),
  cntar3_bills AS (
    SELECT
      t.billdate AS bill_date,
      'SYP'::text AS branch,
      '3CNTAR'::text AS doc_type,
      COALESCE(NULLIF(btrim(t.new_billno), ''), t.billno) AS bill_key,
      SUM(t.amount)::numeric AS total_incl
    FROM billgen.fin_3cntar_lines t
    WHERE t.billdate >= v_hist_from
      AND t.billdate <= p_to
    GROUP BY t.billdate, COALESCE(NULLIF(btrim(t.new_billno), ''), t.billno)
  ),
  tar_docs AS (
    SELECT
      bill_date,
      branch,
      doc_type,
      ROUND(total_incl / 1.07, 2) AS beforetax,
      ROUND(total_incl - ROUND(total_incl / 1.07, 2), 2) AS tax,
      ROUND(total_incl, 2) AS aftertax
    FROM (
      SELECT * FROM tar_bills
      UNION ALL SELECT * FROM tar3_bills
      UNION ALL SELECT * FROM cntar_bills
      UNION ALL SELECT * FROM cntar3_bills
    ) x
  ),
  all_sales AS (
    SELECT bill_date, branch, doc_type, beforetax, tax, aftertax
    FROM sales_docs
    WHERE doc_type IS NOT NULL
    UNION ALL
    SELECT bill_date, branch, doc_type, beforetax, tax, aftertax
    FROM tar_docs
  ),
  sales_filtered AS (
    SELECT *
    FROM all_sales
    WHERE p_branch IS NULL OR branch = p_branch
  ),
  -- ─── Purchase VAT (HQ PIDET ISVAT=Y + PIMAS header tax) ─────────────────────
  purchase_bills AS (
    SELECT DISTINCT ON (upper(btrim(d."BILLNO")))
      left(d."BILLDATE", 10)::date AS bill_date,
      'HQ'::text AS branch,
      CASE
        WHEN nullif(btrim(p."BOOKNO"), '') IN ('1', '1_0') THEN 'เครดิต'
        WHEN nullif(btrim(p."BOOKNO"), '') = '2' THEN 'สด'
        WHEN nullif(btrim(p."BOOKNO"), '') = '5' THEN 'ลดหนี้ซื้อ'
        WHEN nullif(btrim(p."BOOKNO"), '') = '6' THEN 'เพิ่มหนี้ซื้อ'
        ELSE 'Unknown'
      END AS book,
      COALESCE(NULLIF(replace(p."BEFORETAX", ',', ''), '')::numeric, 0) AS beforetax,
      COALESCE(NULLIF(replace(p."TAX", ',', ''), '')::numeric, 0) AS tax,
      COALESCE(NULLIF(replace(p."AFTERTAX", ',', ''), '')::numeric, 0) AS aftertax
    FROM raw_kcw.raw_hq_pidet_purchase_lines d
    JOIN raw_kcw.raw_hq_pimas_purchase_bills p
      ON upper(btrim(d."BILLNO")) = upper(btrim(p."BILLNO"))
    WHERE d."ISVAT" = 'Y'
      AND d."BILLDATE" >= (v_hist_from)::text
      AND d."BILLDATE" < (p_to + 1)::text
    ORDER BY upper(btrim(d."BILLNO")), d."BILLDATE"
  ),
  purchase_filtered AS (
    SELECT *
    FROM purchase_bills
    -- Purchases are HQ-only in PARTS9; hide when filtering SYP.
    WHERE p_branch IS NULL OR p_branch = 'HQ'
  ),
  -- ─── Expense VAT (app receipts with vat != 0) ───────────────────────────────
  expense_receipts AS (
    SELECT
      v.receipt_day AS bill_date,
      CASE
        WHEN v.branch_uuid = v_hq_branch_uuid THEN 'HQ'
        ELSE 'SYP'
      END AS branch,
      v.doc_type::text AS doc_type,
      v.receipt_uuid,
      SUM(v.signed_entry_amount)::numeric AS base_excl
    FROM public.vw_expense_entry_flat_tax v
    WHERE v.vat IS NOT NULL
      AND v.vat <> 0
      AND v.receipt_day >= v_hist_from
      AND v.receipt_day <= p_to
    GROUP BY v.receipt_day, v.branch_uuid, v.doc_type, v.receipt_uuid
  ),
  expense_docs AS (
    SELECT
      bill_date,
      branch,
      CASE
        WHEN doc_type = 'CREDIT_NOTE' THEN 'ลดหนี้ค่าใช้จ่าย'
        ELSE 'ค่าใช้จ่าย'
      END AS book,
      ROUND(base_excl, 2) AS beforetax,
      ROUND(base_excl * 0.07, 2) AS tax,
      ROUND(base_excl * 1.07, 2) AS aftertax
    FROM expense_receipts
  ),
  expense_filtered AS (
    SELECT *
    FROM expense_docs
    WHERE p_branch IS NULL OR branch = p_branch
  ),
  -- ─── Period helpers ─────────────────────────────────────────────────────────
  cur_sales AS (
    SELECT * FROM sales_filtered
    WHERE bill_date >= p_from AND bill_date <= p_to
  ),
  prev_sales AS (
    SELECT * FROM sales_filtered
    WHERE bill_date >= v_prev_from AND bill_date <= v_prev_to
  ),
  cur_purchase AS (
    SELECT * FROM purchase_filtered
    WHERE bill_date >= p_from AND bill_date <= p_to
  ),
  prev_purchase AS (
    SELECT * FROM purchase_filtered
    WHERE bill_date >= v_prev_from AND bill_date <= v_prev_to
  ),
  cur_expense AS (
    SELECT * FROM expense_filtered
    WHERE bill_date >= p_from AND bill_date <= p_to
  ),
  prev_expense AS (
    SELECT * FROM expense_filtered
    WHERE bill_date >= v_prev_from AND bill_date <= v_prev_to
  ),
  -- ─── Summaries ──────────────────────────────────────────────────────────────
  cur_summary AS (
    SELECT
      COALESCE((SELECT SUM(beforetax) FROM cur_sales), 0) AS sales_before,
      COALESCE((SELECT SUM(tax) FROM cur_sales), 0) AS sales_vat,
      COALESCE((SELECT COUNT(*) FROM cur_sales), 0)::int AS sales_bill_count,
      COALESCE((SELECT SUM(beforetax) FROM cur_purchase), 0) AS purchase_before,
      COALESCE((SELECT SUM(tax) FROM cur_purchase), 0) AS purchase_vat,
      COALESCE((SELECT COUNT(*) FROM cur_purchase), 0)::int AS purchase_bill_count,
      COALESCE((SELECT SUM(beforetax) FROM cur_expense), 0) AS expense_before,
      COALESCE((SELECT SUM(tax) FROM cur_expense), 0) AS expense_vat,
      COALESCE((SELECT COUNT(*) FROM cur_expense), 0)::int AS expense_bill_count
  ),
  prev_summary AS (
    SELECT
      COALESCE((SELECT SUM(beforetax) FROM prev_sales), 0) AS sales_before,
      COALESCE((SELECT SUM(tax) FROM prev_sales), 0) AS sales_vat,
      COALESCE((SELECT COUNT(*) FROM prev_sales), 0)::int AS sales_bill_count,
      COALESCE((SELECT SUM(beforetax) FROM prev_purchase), 0) AS purchase_before,
      COALESCE((SELECT SUM(tax) FROM prev_purchase), 0) AS purchase_vat,
      COALESCE((SELECT COUNT(*) FROM prev_purchase), 0)::int AS purchase_bill_count,
      COALESCE((SELECT SUM(beforetax) FROM prev_expense), 0) AS expense_before,
      COALESCE((SELECT SUM(tax) FROM prev_expense), 0) AS expense_vat,
      COALESCE((SELECT COUNT(*) FROM prev_expense), 0)::int AS expense_bill_count
  ),
  -- ─── Breakdowns ─────────────────────────────────────────────────────────────
  by_sales_doc AS (
    SELECT
      doc_type AS key,
      branch,
      COUNT(*)::int AS bill_count,
      ROUND(SUM(beforetax), 2) AS beforetax,
      ROUND(SUM(tax), 2) AS tax,
      ROUND(SUM(aftertax), 2) AS aftertax
    FROM cur_sales
    GROUP BY doc_type, branch
  ),
  by_purchase_book AS (
    SELECT
      book AS key,
      COUNT(*)::int AS bill_count,
      ROUND(SUM(beforetax), 2) AS beforetax,
      ROUND(SUM(tax), 2) AS tax,
      ROUND(SUM(aftertax), 2) AS aftertax
    FROM cur_purchase
    GROUP BY book
  ),
  by_expense_doc AS (
    SELECT
      book AS key,
      branch,
      COUNT(*)::int AS bill_count,
      ROUND(SUM(beforetax), 2) AS beforetax,
      ROUND(SUM(tax), 2) AS tax,
      ROUND(SUM(aftertax), 2) AS aftertax
    FROM cur_expense
    GROUP BY book, branch
  ),
  by_branch AS (
    SELECT
      b.branch AS key,
      ROUND(COALESCE(s.sales_vat, 0), 2) AS sales_vat,
      ROUND(COALESCE(s.sales_before, 0), 2) AS sales_before,
      ROUND(COALESCE(p.purchase_vat, 0), 2) AS purchase_vat,
      ROUND(COALESCE(p.purchase_before, 0), 2) AS purchase_before,
      ROUND(COALESCE(e.expense_vat, 0), 2) AS expense_vat,
      ROUND(COALESCE(e.expense_before, 0), 2) AS expense_before,
      ROUND(
        COALESCE(s.sales_vat, 0)
        - COALESCE(p.purchase_vat, 0)
        - COALESCE(e.expense_vat, 0),
        2
      ) AS net_vat
    FROM (VALUES ('HQ'), ('SYP')) AS b(branch)
    LEFT JOIN (
      SELECT branch, SUM(tax) AS sales_vat, SUM(beforetax) AS sales_before
      FROM cur_sales GROUP BY branch
    ) s ON s.branch = b.branch
    LEFT JOIN (
      SELECT branch, SUM(tax) AS purchase_vat, SUM(beforetax) AS purchase_before
      FROM cur_purchase GROUP BY branch
    ) p ON p.branch = b.branch
    LEFT JOIN (
      SELECT branch, SUM(tax) AS expense_vat, SUM(beforetax) AS expense_before
      FROM cur_expense GROUP BY branch
    ) e ON e.branch = b.branch
  ),
  -- ─── Trends ─────────────────────────────────────────────────────────────────
  daily_union AS (
    SELECT bill_date, 'sales'::text AS kind, tax FROM cur_sales
    UNION ALL
    SELECT bill_date, 'purchase', tax FROM cur_purchase
    UNION ALL
    SELECT bill_date, 'expense', tax FROM cur_expense
  ),
  trend_daily AS (
    SELECT
      to_char(d.day, 'YYYY-MM-DD') AS period,
      ROUND(COALESCE(SUM(CASE WHEN u.kind = 'sales' THEN u.tax END), 0), 2) AS sales_vat,
      ROUND(COALESCE(SUM(CASE WHEN u.kind = 'purchase' THEN u.tax END), 0), 2) AS purchase_vat,
      ROUND(COALESCE(SUM(CASE WHEN u.kind = 'expense' THEN u.tax END), 0), 2) AS expense_vat,
      ROUND(
        COALESCE(SUM(CASE WHEN u.kind = 'sales' THEN u.tax END), 0)
        - COALESCE(SUM(CASE WHEN u.kind = 'purchase' THEN u.tax END), 0)
        - COALESCE(SUM(CASE WHEN u.kind = 'expense' THEN u.tax END), 0),
        2
      ) AS net_vat
    FROM generate_series(p_from, p_to, '1 day'::interval) AS d(day)
    LEFT JOIN daily_union u ON u.bill_date = d.day::date
    GROUP BY d.day
    ORDER BY d.day
  ),
  month_sales AS (
    SELECT date_trunc('month', bill_date)::date AS month_start, SUM(tax) AS sales_vat
    FROM sales_filtered
    WHERE bill_date >= (date_trunc('month', p_to) - interval '11 months')::date
    GROUP BY 1
  ),
  month_purchase AS (
    SELECT date_trunc('month', bill_date)::date AS month_start, SUM(tax) AS purchase_vat
    FROM purchase_filtered
    WHERE bill_date >= (date_trunc('month', p_to) - interval '11 months')::date
    GROUP BY 1
  ),
  month_expense AS (
    SELECT date_trunc('month', bill_date)::date AS month_start, SUM(tax) AS expense_vat
    FROM expense_filtered
    WHERE bill_date >= (date_trunc('month', p_to) - interval '11 months')::date
    GROUP BY 1
  ),
  trend_monthly AS (
    SELECT
      to_char(m.month_start, 'YYYY-MM') AS period,
      ROUND(COALESCE(s.sales_vat, 0), 2) AS sales_vat,
      ROUND(COALESCE(p.purchase_vat, 0), 2) AS purchase_vat,
      ROUND(COALESCE(e.expense_vat, 0), 2) AS expense_vat,
      ROUND(
        COALESCE(s.sales_vat, 0)
        - COALESCE(p.purchase_vat, 0)
        - COALESCE(e.expense_vat, 0),
        2
      ) AS net_vat
    FROM generate_series(
      (date_trunc('month', p_to) - interval '11 months')::date,
      date_trunc('month', p_to)::date,
      '1 month'::interval
    ) AS m(month_start)
    LEFT JOIN month_sales s ON s.month_start = m.month_start::date
    LEFT JOIN month_purchase p ON p.month_start = m.month_start::date
    LEFT JOIN month_expense e ON e.month_start = m.month_start::date
    ORDER BY m.month_start
  )
  SELECT jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'branch', p_branch,
    'previous_from', v_prev_from,
    'previous_to', v_prev_to,
    'as_of', v_as_of,
    'summary', (
      SELECT jsonb_build_object(
        'sales_before', ROUND(sales_before, 2),
        'sales_vat', ROUND(sales_vat, 2),
        'sales_bill_count', sales_bill_count,
        'purchase_before', ROUND(purchase_before, 2),
        'purchase_vat', ROUND(purchase_vat, 2),
        'purchase_bill_count', purchase_bill_count,
        'expense_before', ROUND(expense_before, 2),
        'expense_vat', ROUND(expense_vat, 2),
        'expense_bill_count', expense_bill_count,
        'net_vat', ROUND(sales_vat - purchase_vat - expense_vat, 2)
      )
      FROM cur_summary
    ),
    'previous_summary', (
      SELECT jsonb_build_object(
        'sales_before', ROUND(sales_before, 2),
        'sales_vat', ROUND(sales_vat, 2),
        'sales_bill_count', sales_bill_count,
        'purchase_before', ROUND(purchase_before, 2),
        'purchase_vat', ROUND(purchase_vat, 2),
        'purchase_bill_count', purchase_bill_count,
        'expense_before', ROUND(expense_before, 2),
        'expense_vat', ROUND(expense_vat, 2),
        'expense_bill_count', expense_bill_count,
        'net_vat', ROUND(sales_vat - purchase_vat - expense_vat, 2)
      )
      FROM prev_summary
    ),
    'forecast', (
      SELECT jsonb_build_object(
        'enabled', v_forecast_enabled,
        'as_of', v_as_of,
        'days_elapsed', v_days_elapsed,
        'days_in_range', v_days_range,
        'factor', ROUND(v_forecast_factor, 4),
        'sales_vat', ROUND(sales_vat * v_forecast_factor, 2),
        'purchase_vat', ROUND(purchase_vat * v_forecast_factor, 2),
        'expense_vat', ROUND(expense_vat * v_forecast_factor, 2),
        'net_vat', ROUND((sales_vat - purchase_vat - expense_vat) * v_forecast_factor, 2),
        'sales_before', ROUND(sales_before * v_forecast_factor, 2),
        'purchase_before', ROUND(purchase_before * v_forecast_factor, 2),
        'expense_before', ROUND(expense_before * v_forecast_factor, 2)
      )
      FROM cur_summary
    ),
    'by_sales_doc', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'key', key,
          'branch', branch,
          'bill_count', bill_count,
          'beforetax', beforetax,
          'tax', tax,
          'aftertax', aftertax
        )
        ORDER BY branch, key
      )
      FROM by_sales_doc
    ), '[]'::jsonb),
    'by_purchase_book', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'key', key,
          'bill_count', bill_count,
          'beforetax', beforetax,
          'tax', tax,
          'aftertax', aftertax
        )
        ORDER BY key
      )
      FROM by_purchase_book
    ), '[]'::jsonb),
    'by_expense_doc', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'key', key,
          'branch', branch,
          'bill_count', bill_count,
          'beforetax', beforetax,
          'tax', tax,
          'aftertax', aftertax
        )
        ORDER BY branch, key
      )
      FROM by_expense_doc
    ), '[]'::jsonb),
    'by_branch', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'key', key,
          'sales_vat', sales_vat,
          'sales_before', sales_before,
          'purchase_vat', purchase_vat,
          'purchase_before', purchase_before,
          'expense_vat', expense_vat,
          'expense_before', expense_before,
          'net_vat', net_vat
        )
        ORDER BY key
      )
      FROM by_branch
    ), '[]'::jsonb),
    'trend_daily', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'period', period,
          'sales_vat', sales_vat,
          'purchase_vat', purchase_vat,
          'expense_vat', expense_vat,
          'net_vat', net_vat
        )
        ORDER BY period
      )
      FROM trend_daily
    ), '[]'::jsonb),
    'trend_monthly', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'period', period,
          'sales_vat', sales_vat,
          'purchase_vat', purchase_vat,
          'expense_vat', expense_vat,
          'net_vat', net_vat
        )
        ORDER BY period
      )
      FROM trend_monthly
    ), '[]'::jsonb)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.fn_bi_vat_overview(date, date, text, date, text) IS
  'VAT sales/purchase/expense tax-book overview + mid-period run-rate forecast (kcw-analytics 31/32 logic).';

REVOKE ALL ON FUNCTION public.fn_bi_vat_overview(date, date, text, date, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_bi_vat_overview(date, date, text, date, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_bi_vat_overview(date, date, text, date, text) TO service_role;

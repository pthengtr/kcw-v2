-- Month-bounded VAT book lines. Date filters sit on the source tables so a
-- page does not scan every bill and every line.

CREATE OR REPLACE FUNCTION public.fn_vat_register(
  p_from date,
  p_to date,
  p_expense text DEFAULT 'receipt'
)
RETURNS TABLE (
  line_key text,
  report_month date,
  branch text,
  side text,
  sheet text,
  source text,
  source_ref text,
  bill_date date,
  bill_no text,
  display_bill_no text,
  party_name text,
  tax_id text,
  before_vat numeric,
  vat numeric,
  after_vat numeric,
  detail text,
  remark text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, curated_kcw, raw_kcw, billgen
AS $$
WITH sales_headers AS (
  SELECT
    CASE
      WHEN b."BRANCH" = 'SYP' OR upper(btrim(b."BILLNO")) ~ '^3' THEN 'SYP'
      ELSE 'HQ'
    END AS branch,
    upper(btrim(b."BILLNO")) AS bill_no,
    CASE
      WHEN left(b."BILLDATE", 10) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        THEN left(b."BILLDATE", 10)::date
      ELSE NULL
    END AS bill_date,
    CASE
      WHEN upper(btrim(b."BILLNO")) ~ '^3CNTAD' THEN '3CNTAD'
      WHEN upper(btrim(b."BILLNO")) ~ '^CNTAD' THEN 'CNTAD'
      WHEN upper(btrim(b."BILLNO")) ~ '^3CN' THEN '3CN'
      WHEN upper(btrim(b."BILLNO")) ~ '^CN' THEN 'CN'
      WHEN upper(btrim(b."BILLNO")) ~ '^3TAD' THEN '3TAD'
      WHEN upper(btrim(b."BILLNO")) ~ '^TAD' THEN 'TAD'
      WHEN upper(btrim(b."BILLNO")) ~ '^3TD' THEN '3TD'
      WHEN upper(btrim(b."BILLNO")) ~ '^TD' THEN 'TD'
      WHEN upper(btrim(b."BILLNO")) ~ '^3TR' THEN '3TR'
      WHEN upper(btrim(b."BILLNO")) ~ '^TR' THEN 'TR'
      ELSE NULL
    END AS sheet,
    nullif(btrim(b."ACCTNAME"), '') AS party_name,
    nullif(regexp_replace(coalesce(b."REMARKS", ''), '^##', ''), '') AS tax_id,
    curated_kcw.fn_vat_num(b."BEFORETAX") AS before_vat,
    curated_kcw.fn_vat_num(b."TAX") AS vat,
    curated_kcw.fn_vat_num(b."AFTERTAX") AS after_vat,
    nullif(btrim(b."PO"), '') AS remark
  FROM curated_kcw.fact_sales_bills_all b
  -- Notebook 30 drops transfer bills only. Canceled bills stay in the book.
  WHERE position('TF' IN upper(coalesce(b."BILLNO", ''))) = 0
    AND b."BILLDATE" >= p_from::text
    AND b."BILLDATE" < (p_to + 1)::text
),
sales_detail AS (
  SELECT DISTINCT ON (upper(btrim(s."BILLNO")))
    upper(btrim(s."BILLNO")) AS bill_no,
    nullif(btrim(s."DETAIL"), '') AS detail
  FROM raw_kcw.raw_hq_sidet_sales_lines s
  WHERE nullif(btrim(s."BILLNO"), '') IS NOT NULL
    AND s."BILLDATE" >= p_from::text
    AND s."BILLDATE" < (p_to + 1)::text
  ORDER BY
    upper(btrim(s."BILLNO")),
    abs(curated_kcw.fn_vat_num(s."AMOUNT")) DESC,
    s."LINE"
),
purchase_detail AS (
  SELECT DISTINCT ON (upper(btrim(d."BILLNO")))
    upper(btrim(d."BILLNO")) AS bill_no,
    nullif(btrim(d."DETAIL"), '') AS detail
  FROM raw_kcw.raw_hq_pidet_purchase_lines d
  WHERE upper(btrim(coalesce(d."ISVAT", ''))) = 'Y'
    AND nullif(btrim(d."BILLNO"), '') IS NOT NULL
    AND d."BILLDATE" >= p_from::text
    AND d."BILLDATE" < (p_to + 1)::text
  ORDER BY
    upper(btrim(d."BILLNO")),
    abs(curated_kcw.fn_vat_num(d."AMOUNT")) DESC,
    d."LINE"
),
purchase_one AS (
  SELECT DISTINCT ON (upper(btrim(p."BILLNO")))
    p.*
  FROM raw_kcw.raw_hq_pimas_purchase_bills p
  WHERE p."BILLDATE" >= p_from::text
    AND p."BILLDATE" < (p_to + 1)::text
  ORDER BY
    upper(btrim(p."BILLNO")),
    (curated_kcw.fn_vat_num(p."TAX") = 0),
    p._ingested_at DESC NULLS LAST
),
purchase_bills AS (
  SELECT
    'HQ'::text AS branch,
    upper(btrim(p."BILLNO")) AS bill_no,
    CASE
      WHEN left(p."BILLDATE", 10) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        THEN left(p."BILLDATE", 10)::date
      ELSE NULL
    END AS bill_date,
    CASE
      -- Notebook 31 loads BOOK_1_0, BOOK_2_0, BOOK_5_0, BOOK_6_0, and BOOK_UNKNOWN.
      -- A blank book number is Unknown. Other book numbers are not in the tax book.
      WHEN nullif(btrim(p."BOOKNO"), '') IS NULL THEN 'Unknown'
      WHEN regexp_replace(btrim(p."BOOKNO"), '\.0$', '') IN ('1', '1_0') THEN 'เครดิต'
      WHEN regexp_replace(btrim(p."BOOKNO"), '\.0$', '') IN ('2', '2_0') THEN 'สด'
      WHEN regexp_replace(btrim(p."BOOKNO"), '\.0$', '') IN ('5', '5_0') THEN 'ลดหนี้ซื้อ'
      WHEN regexp_replace(btrim(p."BOOKNO"), '\.0$', '') IN ('6', '6_0') THEN 'เพิ่มหนี้ซื้อ'
      ELSE NULL
    END AS sheet,
    nullif(btrim(p."ACCTNAME"), '') AS party_name,
    nullif(right(coalesce(p."REMARKS", ''), 13), '') AS tax_id,
    curated_kcw.fn_vat_num(p."BEFORETAX") AS before_vat,
    curated_kcw.fn_vat_num(p."TAX") AS vat,
    curated_kcw.fn_vat_num(p."AFTERTAX") AS after_vat,
    det.detail,
    nullif(btrim(p."PO"), '') AS remark
  FROM purchase_one p
  JOIN purchase_detail det
    ON det.bill_no = upper(btrim(p."BILLNO"))
),
tar_detail AS (
  SELECT DISTINCT ON (btrim(t.new_billno))
    btrim(t.new_billno) AS bill_no,
    nullif(btrim(t.detail), '') AS detail
  FROM billgen.fin_tar_lines t
  WHERE nullif(btrim(t.new_billno), '') IS NOT NULL
    AND t.billdate >= p_from
    AND t.billdate <= p_to
  ORDER BY btrim(t.new_billno), t.amount DESC NULLS LAST
),
tar_bills AS (
  SELECT
    'HQ'::text AS branch,
    'TAR'::text AS sheet,
    btrim(t.new_billno) AS bill_no,
    min(t.billdate) AS bill_date,
    round(sum(t.amount::numeric), 2) AS after_vat
  FROM billgen.fin_tar_lines t
  WHERE nullif(btrim(t.new_billno), '') IS NOT NULL
    AND t.billdate >= p_from
    AND t.billdate <= p_to
  GROUP BY btrim(t.new_billno)
),
tar3_detail AS (
  SELECT DISTINCT ON (btrim(t.new_billno))
    btrim(t.new_billno) AS bill_no,
    nullif(btrim(t.detail), '') AS detail
  FROM billgen.fin_3tar_lines t
  WHERE nullif(btrim(t.new_billno), '') IS NOT NULL
    AND t.billdate >= p_from
    AND t.billdate <= p_to
  ORDER BY btrim(t.new_billno), t.amount DESC NULLS LAST
),
tar3_bills AS (
  SELECT
    'SYP'::text AS branch,
    '3TAR'::text AS sheet,
    btrim(t.new_billno) AS bill_no,
    min(t.billdate) AS bill_date,
    round(sum(t.amount::numeric), 2) AS after_vat
  FROM billgen.fin_3tar_lines t
  WHERE nullif(btrim(t.new_billno), '') IS NOT NULL
    AND t.billdate >= p_from
    AND t.billdate <= p_to
  GROUP BY btrim(t.new_billno)
),
cntar_detail AS (
  SELECT DISTINCT ON (btrim(t.new_billno))
    btrim(t.new_billno) AS bill_no,
    nullif(btrim(t.detail), '') AS detail
  FROM billgen.fin_cntar_lines t
  WHERE nullif(btrim(t.new_billno), '') IS NOT NULL
    AND t.billdate >= p_from
    AND t.billdate <= p_to
  ORDER BY btrim(t.new_billno), t.amount ASC NULLS LAST
),
cntar_bills AS (
  SELECT
    'HQ'::text AS branch,
    'CNTAR'::text AS sheet,
    btrim(t.new_billno) AS bill_no,
    min(t.billdate) AS bill_date,
    min(nullif(btrim(t.ref_new_billno), '')) AS remark,
    round(sum(t.amount::numeric), 2) AS after_vat
  FROM billgen.fin_cntar_lines t
  WHERE nullif(btrim(t.new_billno), '') IS NOT NULL
    AND t.billdate >= p_from
    AND t.billdate <= p_to
  GROUP BY btrim(t.new_billno)
),
cntar3_detail AS (
  SELECT DISTINCT ON (btrim(t.new_billno))
    btrim(t.new_billno) AS bill_no,
    nullif(btrim(t.detail), '') AS detail
  FROM billgen.fin_3cntar_lines t
  WHERE nullif(btrim(t.new_billno), '') IS NOT NULL
    AND t.billdate >= p_from
    AND t.billdate <= p_to
  ORDER BY btrim(t.new_billno), t.amount ASC NULLS LAST
),
cntar3_bills AS (
  SELECT
    'SYP'::text AS branch,
    '3CNTAR'::text AS sheet,
    btrim(t.new_billno) AS bill_no,
    min(t.billdate) AS bill_date,
    min(nullif(btrim(t.ref_new_billno), '')) AS remark,
    round(sum(t.amount::numeric), 2) AS after_vat
  FROM billgen.fin_3cntar_lines t
  WHERE nullif(btrim(t.new_billno), '') IS NOT NULL
    AND t.billdate >= p_from
    AND t.billdate <= p_to
  GROUP BY btrim(t.new_billno)
),
expense_grouped AS (
  SELECT
    v.receipt_uuid::text AS source_ref,
    (array_agg(v.receipt_number ORDER BY v.signed_entry_amount DESC NULLS LAST))[1] AS bill_no,
    (array_agg(v.receipt_date ORDER BY v.signed_entry_amount DESC NULLS LAST))[1] AS receipt_date,
    (array_agg(v.party_name ORDER BY v.signed_entry_amount DESC NULLS LAST))[1] AS party_name,
    (array_agg(v.tax_payer_id ORDER BY v.signed_entry_amount DESC NULLS LAST))[1] AS tax_id,
    (array_agg(v.entry_detail ORDER BY v.signed_entry_amount DESC NULLS LAST))[1] AS detail,
    (array_agg(v.ref_receipt_number ORDER BY v.signed_entry_amount DESC NULLS LAST))[1] AS remark,
    (array_agg(v.doc_type::text ORDER BY v.signed_entry_amount DESC NULLS LAST))[1] AS doc_type,
    (array_agg(v.branch_uuid::text ORDER BY v.signed_entry_amount DESC NULLS LAST))[1] AS branch_uuid,
    min(v.created_at) AS created_at,
    sum(v.signed_entry_amount)::numeric AS base_excl
  FROM public.vw_expense_entry_flat_tax v
  WHERE v.vat IS NOT NULL
    AND v.vat <> 0
    AND v.doc_type::text IN ('RECEIPT', 'CREDIT_NOTE')
    AND (
      (
        p_expense = 'created'
        AND v.created_at >= (p_from + 9)
        AND v.created_at < ((p_to + 1) + 9)
      )
      OR (
        p_expense <> 'created'
        AND v.receipt_day >= p_from
        AND v.receipt_day <= p_to
      )
    )
  GROUP BY v.receipt_uuid
),
expense_one AS (
  SELECT DISTINCT ON (e.branch_uuid, e.doc_type, btrim(e.bill_no), e.receipt_date::date)
    e.*
  FROM expense_grouped e
  WHERE e.receipt_date IS NOT NULL
    AND nullif(btrim(e.bill_no), '') IS NOT NULL
  ORDER BY
    e.branch_uuid,
    e.doc_type,
    btrim(e.bill_no),
    e.receipt_date::date,
    e.source_ref
),
books AS (
  SELECT
    h.branch,
    'sales'::text AS side,
    h.sheet,
    'parts9'::text AS source,
    NULL::text AS source_ref,
    h.bill_date,
    date_trunc('month', h.bill_date)::date AS report_month,
    h.bill_no,
    CASE
      WHEN h.sheet IN ('TAD', '3TAD', 'CNTAD', '3CNTAD')
        AND position('lazada' IN lower(coalesce(h.party_name, ''))) > 0
        THEN 'คุณลูกค้าทั่วไป Lazada'
      WHEN h.sheet IN ('TAD', '3TAD', 'CNTAD', '3CNTAD')
        AND position('shopee' IN lower(coalesce(h.party_name, ''))) > 0
        THEN 'คุณลูกค้าทั่วไป Shopee'
      WHEN h.sheet IN ('TAD', '3TAD', 'CNTAD', '3CNTAD')
        AND position('tiktok' IN lower(coalesce(h.party_name, ''))) > 0
        THEN 'คุณลูกค้าทั่วไป Tiktok'
      ELSE h.party_name
    END AS party_name,
    h.tax_id,
    round(h.before_vat, 2) AS before_vat,
    round(h.vat, 2) AS vat,
    round(h.after_vat, 2) AS after_vat,
    d.detail,
    h.remark
  FROM sales_headers h
  LEFT JOIN sales_detail d ON d.bill_no = h.bill_no
  WHERE h.sheet IS NOT NULL
    AND h.bill_date IS NOT NULL
    AND h.bill_no <> ''

  UNION ALL

  SELECT
    p.branch,
    'purchase',
    p.sheet,
    'parts9',
    NULL,
    p.bill_date,
    date_trunc('month', p.bill_date)::date,
    p.bill_no,
    p.party_name,
    p.tax_id,
    round(p.before_vat, 2),
    round(p.vat, 2),
    round(p.after_vat, 2),
    p.detail,
    p.remark
  FROM purchase_bills p
  WHERE p.bill_date IS NOT NULL
    AND p.bill_no <> ''
    AND p.sheet IS NOT NULL

  UNION ALL

  SELECT
    t.branch,
    'sales',
    t.sheet,
    'tar',
    NULL,
    t.bill_date,
    date_trunc('month', t.bill_date)::date,
    t.bill_no,
    'คุณลูกค้าทั่วไป',
    '0000000000000',
    round(t.after_vat / 1.07, 2),
    round(t.after_vat - round(t.after_vat / 1.07, 2), 2),
    t.after_vat,
    d.detail,
    NULL
  FROM tar_bills t
  LEFT JOIN tar_detail d ON d.bill_no = t.bill_no
  WHERE t.bill_date IS NOT NULL

  UNION ALL

  SELECT
    t.branch,
    'sales',
    t.sheet,
    'tar',
    NULL,
    t.bill_date,
    date_trunc('month', t.bill_date)::date,
    t.bill_no,
    'คุณลูกค้าทั่วไป',
    '0000000000000',
    round(t.after_vat / 1.07, 2),
    round(t.after_vat - round(t.after_vat / 1.07, 2), 2),
    t.after_vat,
    d.detail,
    NULL
  FROM tar3_bills t
  LEFT JOIN tar3_detail d ON d.bill_no = t.bill_no
  WHERE t.bill_date IS NOT NULL

  UNION ALL

  SELECT
    t.branch,
    'sales',
    t.sheet,
    'tar',
    NULL,
    t.bill_date,
    date_trunc('month', t.bill_date)::date,
    t.bill_no,
    'คุณลูกค้าทั่วไป',
    '0000000000000',
    round(t.after_vat / 1.07, 2),
    round(t.after_vat - round(t.after_vat / 1.07, 2), 2),
    t.after_vat,
    d.detail,
    t.remark
  FROM cntar_bills t
  LEFT JOIN cntar_detail d ON d.bill_no = t.bill_no
  WHERE t.bill_date IS NOT NULL

  UNION ALL

  SELECT
    t.branch,
    'sales',
    t.sheet,
    'tar',
    NULL,
    t.bill_date,
    date_trunc('month', t.bill_date)::date,
    t.bill_no,
    'คุณลูกค้าทั่วไป',
    '0000000000000',
    round(t.after_vat / 1.07, 2),
    round(t.after_vat - round(t.after_vat / 1.07, 2), 2),
    t.after_vat,
    d.detail,
    t.remark
  FROM cntar3_bills t
  LEFT JOIN cntar3_detail d ON d.bill_no = t.bill_no
  WHERE t.bill_date IS NOT NULL

  UNION ALL

  SELECT
    CASE
      WHEN e.branch_uuid = 'c93efb5f-07c9-4229-b6b3-568ce1c0a9ab' THEN 'HQ'
      ELSE 'SYP'
    END AS branch,
    'purchase',
    CASE
      WHEN e.branch_uuid = 'c93efb5f-07c9-4229-b6b3-568ce1c0a9ab'
        AND e.doc_type = 'CREDIT_NOTE' THEN 'ลดหนี้ค่าใช้จ่าย'
      WHEN e.branch_uuid = 'c93efb5f-07c9-4229-b6b3-568ce1c0a9ab' THEN 'ค่าใช้จ่าย'
      WHEN e.doc_type = 'CREDIT_NOTE' THEN 'Expense Credit Note'
      ELSE 'Expense Receipt'
    END AS sheet,
    'expense',
    e.source_ref,
    e.receipt_date::date,
    date_trunc('month', e.created_at - interval '9 days')::date,
    btrim(e.bill_no),
    nullif(btrim(e.party_name), ''),
    nullif(btrim(e.tax_id), ''),
    round(e.base_excl, 2),
    round(e.base_excl * 0.07, 2),
    round(e.base_excl * 1.07, 2),
    nullif(btrim(e.detail), ''),
    nullif(btrim(e.remark), '')
  FROM expense_one e
)
SELECT
  md5(concat_ws(
    '|',
    branch,
    side,
    sheet,
    bill_no,
    bill_date::text,
    coalesce(source_ref, '')
  )) AS line_key,
  report_month,
  branch,
  side,
  sheet,
  source,
  source_ref,
  bill_date,
  bill_no,
  right(bill_no, 13) AS display_bill_no,
  party_name,
  tax_id,
  before_vat,
  vat,
  after_vat,
  detail,
  remark
FROM books

$$;

COMMENT ON FUNCTION public.fn_vat_register(date, date, text) IS
  'VAT book lines for a date window. p_expense=created uses the day-10 filing window.';

REVOKE ALL ON FUNCTION public.fn_vat_register(date, date, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_vat_register(date, date, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_vat_register(date, date, text) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_vat_register_json(
  p_from date,
  p_to date,
  p_branch text DEFAULT NULL,
  p_side text DEFAULT NULL,
  p_expense text DEFAULT 'created'
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, curated_kcw, raw_kcw, billgen, ops
AS $$
  SELECT coalesce(
    jsonb_agg(
      (
        to_jsonb(r) || jsonb_build_object(
          'paid_status', coalesce(e.paid_status, 'unpaid'),
          'paid_on', e.paid_on,
          'note', e.note,
          'invoice_count', coalesce(f.invoice_count, 0),
          'receipt_count', coalesce(f.receipt_count, 0)
        )
      )
      ORDER BY r.bill_date, r.bill_no
    ),
    '[]'::jsonb
  )
  FROM public.fn_vat_register(p_from, p_to, p_expense) r
  LEFT JOIN ops.vat_line_evidence e ON e.line_key = r.line_key
  LEFT JOIN (
    SELECT
      line_key,
      count(*) FILTER (WHERE kind = 'invoice')::int AS invoice_count,
      count(*) FILTER (WHERE kind = 'receipt')::int AS receipt_count
    FROM ops.vat_line_files
    GROUP BY line_key
  ) f ON f.line_key = r.line_key
  WHERE (p_branch IS NULL OR r.branch = p_branch)
    AND (p_side IS NULL OR r.side = p_side);
$$;

REVOKE ALL ON FUNCTION public.fn_vat_register_json(date, date, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_vat_register_json(date, date, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_vat_register_json(date, date, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_vat_register_line(
  p_from date,
  p_to date,
  p_line_key text,
  p_expense text DEFAULT 'created'
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, curated_kcw, raw_kcw, billgen
AS $$
  SELECT to_jsonb(r)
  FROM public.fn_vat_register(p_from, p_to, p_expense) r
  WHERE r.line_key = p_line_key
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.fn_vat_register_line(date, date, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_vat_register_line(date, date, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_vat_register_line(date, date, text, text) TO service_role;
-- VAT sales / purchase BI overview.
-- Line amounts and document classification come from public.fn_vat_register
-- (the sale and purchase tax books, limited to the chart window). This function only aggregates them.

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
  register AS (
    SELECT
      bill_date,
      branch,
      side,
      source,
      sheet,
      before_vat,
      vat AS vat_amount,
      after_vat
    FROM public.fn_vat_register(v_hist_from, p_to, 'receipt')
  ),
  sales_filtered AS (
    SELECT
      bill_date,
      branch,
      sheet AS doc_type,
      before_vat AS beforetax,
      vat_amount AS tax,
      after_vat AS aftertax
    FROM register
    WHERE side = 'sales'
      AND (p_branch IS NULL OR branch = p_branch)
  ),
  purchase_filtered AS (
    SELECT
      bill_date,
      branch,
      sheet AS book,
      before_vat AS beforetax,
      vat_amount AS tax,
      after_vat AS aftertax
    FROM register
    WHERE side = 'purchase'
      AND source = 'parts9'
      AND (p_branch IS NULL OR branch = p_branch)
  ),
  expense_filtered AS (
    SELECT
      bill_date,
      branch,
      sheet AS book,
      before_vat AS beforetax,
      vat_amount AS tax,
      after_vat AS aftertax
    FROM register
    WHERE side = 'purchase'
      AND source = 'expense'
      AND (p_branch IS NULL OR branch = p_branch)
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
  'VAT overview aggregated from public.fn_vat_register, plus a mid-period run-rate forecast.';

REVOKE ALL ON FUNCTION public.fn_bi_vat_overview(date, date, text, date, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_bi_vat_overview(date, date, text, date, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_bi_vat_overview(date, date, text, date, text) TO service_role;

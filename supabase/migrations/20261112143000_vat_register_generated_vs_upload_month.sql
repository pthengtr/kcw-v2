-- Accounting month:
--   1) explicit doc_month
--   2) generated sheets (TAR*/TO) and TAD with issued TO → bill_month (no −10 day rule)
--   3) evidence upload → Bangkok date − 10 days
-- DOC view still keys off the TAD line; TO follows TAD dates in the app layer.

CREATE OR REPLACE FUNCTION ops.vat_register_accounting_month(
  p_doc_month date,
  p_first_uploaded_at timestamptz,
  p_sheet text,
  p_bill_date date,
  p_has_issued_to boolean DEFAULT false
)
RETURNS date
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN p_doc_month IS NOT NULL THEN date_trunc('month', p_doc_month)::date
    WHEN upper(btrim(coalesce(p_sheet, ''))) IN ('TAR', '3TAR', 'CNTAR', '3CNTAR', 'TO')
      THEN date_trunc('month', p_bill_date)::date
    WHEN p_has_issued_to
      AND upper(btrim(coalesce(p_sheet, ''))) = 'TAD'
      THEN date_trunc('month', p_bill_date)::date
    WHEN p_first_uploaded_at IS NOT NULL THEN ops.vat_upload_doc_month(p_first_uploaded_at)
    ELSE NULL
  END;
$$;

COMMENT ON FUNCTION ops.vat_register_accounting_month(date, timestamptz, text, date, boolean) IS
  'VAT DOC-view month: doc_month, else bill month for generated/TAR/TO or TAD-with-issued-TO, else upload Bangkok−10 days.';

REVOKE ALL ON FUNCTION ops.vat_register_accounting_month(date, timestamptz, text, date, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ops.vat_register_accounting_month(date, timestamptz, text, date, boolean) TO service_role;

DROP VIEW IF EXISTS ops.vw_vat_register_accounting;

CREATE VIEW ops.vw_vat_register_accounting AS
WITH base AS MATERIALIZED (
  SELECT
    line_key,
    report_month,
    branch,
    side,
    sheet,
    source,
    source_ref,
    bill_date,
    date_trunc('month', bill_date)::date AS bill_month,
    bill_no,
    display_bill_no,
    party_name,
    tax_id,
    before_vat,
    vat,
    after_vat,
    detail,
    remark
  FROM curated_kcw.vw_vat_register
),
files AS MATERIALIZED (
  SELECT
    line_key,
    min(uploaded_at) AS first_uploaded_at,
    max(uploaded_at) AS last_uploaded_at,
    count(*) FILTER (WHERE kind = 'invoice')::int AS invoice_count,
    count(*) FILTER (WHERE kind = 'receipt')::int AS receipt_count
  FROM ops.vat_line_files
  GROUP BY line_key
),
issued_to AS MATERIALIZED (
  SELECT DISTINCT upper(btrim(tad_billno)) AS tad_billno
  FROM to_bill.invoices
  WHERE status = 'issued'
    AND upper(btrim(docno)) ~ '^TO[0-9]{4}-[0-9]{3,}$'
)
SELECT
  b.line_key,
  b.report_month,
  b.branch,
  b.side,
  b.sheet,
  b.source,
  b.source_ref,
  b.bill_date,
  b.bill_month,
  b.bill_no,
  b.display_bill_no,
  b.party_name,
  b.tax_id,
  coalesce(e.override_before_vat, b.before_vat) AS before_vat,
  coalesce(e.override_vat, b.vat) AS vat,
  coalesce(e.override_after_vat, b.after_vat) AS after_vat,
  b.detail,
  b.remark,
  e.paid_status,
  e.paid_on,
  e.accounting_unused,
  e.doc_month,
  ops.vat_register_accounting_month(
    e.doc_month,
    f.first_uploaded_at,
    b.sheet,
    b.bill_date,
    ito.tad_billno IS NOT NULL
  ) AS accounting_month,
  f.first_uploaded_at,
  f.last_uploaded_at,
  coalesce(f.invoice_count, 0) AS invoice_count,
  coalesce(f.receipt_count, 0) AS receipt_count,
  b.before_vat AS book_before_vat,
  b.vat AS book_vat,
  b.after_vat AS book_after_vat,
  (e.override_after_vat IS NOT NULL) AS amount_overridden
FROM base b
LEFT JOIN ops.vat_line_evidence e ON e.line_key = b.line_key
LEFT JOIN files f ON f.line_key = b.line_key
LEFT JOIN issued_to ito ON ito.tad_billno = upper(btrim(b.bill_no));

REVOKE ALL ON ops.vw_vat_register_accounting FROM PUBLIC;
GRANT SELECT ON ops.vw_vat_register_accounting TO service_role;

CREATE OR REPLACE FUNCTION public.fn_vat_register_accounting_json(
  p_month date,
  p_branch text DEFAULT NULL,
  p_side text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, curated_kcw, raw_kcw, billgen, ops, to_bill
SET statement_timeout = '60s'
AS $$
  WITH p AS (
    SELECT
      p_month AS month_start,
      (p_month + INTERVAL '1 month - 1 day')::date AS month_end
  ),
  files AS (
    SELECT
      line_key,
      min(uploaded_at) AS first_uploaded_at,
      max(uploaded_at) AS last_uploaded_at,
      count(*) FILTER (WHERE kind = 'invoice')::int AS invoice_count,
      count(*) FILTER (WHERE kind = 'receipt')::int AS receipt_count
    FROM ops.vat_line_files
    GROUP BY line_key
  ),
  issued_to AS (
    SELECT DISTINCT upper(btrim(tad_billno)) AS tad_billno
    FROM to_bill.invoices
    WHERE status = 'issued'
      AND upper(btrim(docno)) ~ '^TO[0-9]{4}-[0-9]{3,}$'
  ),
  -- Lines that belong to this accounting month but were billed in another month.
  out_keys AS (
    SELECT e.line_key, e.bill_date
    FROM ops.vat_line_evidence e
    LEFT JOIN files f ON f.line_key = e.line_key
    LEFT JOIN issued_to ito
      ON ito.tad_billno = upper(btrim(e.bill_no))
     AND upper(btrim(e.doc_type)) = 'TAD'
    CROSS JOIN p
    WHERE p.month_start IS NOT NULL
      AND e.bill_date IS NOT NULL
      AND (e.bill_date < p.month_start OR e.bill_date > p.month_end)
      AND ops.vat_register_accounting_month(
        e.doc_month,
        f.first_uploaded_at,
        e.doc_type,
        e.bill_date,
        ito.tad_billno IS NOT NULL
      ) = p.month_start
  ),
  bounds AS (
    SELECT
      CASE
        WHEN p.month_start IS NULL THEN DATE '1900-01-01'
        ELSE LEAST(
          p.month_start,
          coalesce((SELECT min(bill_date) FROM out_keys), p.month_start)
        )
      END AS d_from,
      CASE
        WHEN p.month_start IS NULL THEN CURRENT_DATE
        ELSE GREATEST(
          p.month_end,
          coalesce((SELECT max(bill_date) FROM out_keys), p.month_end)
        )
      END AS d_to
    FROM p
  ),
  books AS (
    SELECT r.*
    FROM bounds b
    CROSS JOIN LATERAL public.fn_vat_register(b.d_from, b.d_to, 'created') r
  ),
  rows AS (
    SELECT
      b.line_key,
      b.report_month,
      b.branch,
      b.side,
      b.sheet,
      b.source,
      b.source_ref,
      b.bill_date,
      date_trunc('month', b.bill_date)::date AS bill_month,
      b.bill_no,
      b.display_bill_no,
      b.party_name,
      b.tax_id,
      coalesce(e.override_before_vat, b.before_vat) AS before_vat,
      coalesce(e.override_vat, b.vat) AS vat,
      coalesce(e.override_after_vat, b.after_vat) AS after_vat,
      b.before_vat AS book_before_vat,
      b.vat AS book_vat,
      b.after_vat AS book_after_vat,
      (e.override_after_vat IS NOT NULL) AS amount_overridden,
      b.detail,
      b.remark,
      e.paid_status,
      e.paid_on,
      e.accounting_unused,
      e.doc_month,
      ops.vat_register_accounting_month(
        e.doc_month,
        f.first_uploaded_at,
        b.sheet,
        b.bill_date,
        ito.tad_billno IS NOT NULL
      ) AS accounting_month,
      f.first_uploaded_at,
      f.last_uploaded_at,
      coalesce(f.invoice_count, 0) AS invoice_count,
      coalesce(f.receipt_count, 0) AS receipt_count
    FROM books b
    LEFT JOIN ops.vat_line_evidence e ON e.line_key = b.line_key
    LEFT JOIN files f ON f.line_key = b.line_key
    LEFT JOIN issued_to ito
      ON ito.tad_billno = upper(btrim(b.bill_no))
     AND upper(btrim(b.sheet)) = 'TAD'
    CROSS JOIN p
    WHERE (p.month_start IS NULL OR ops.vat_register_accounting_month(
        e.doc_month,
        f.first_uploaded_at,
        b.sheet,
        b.bill_date,
        ito.tad_billno IS NOT NULL
      ) = p.month_start)
      AND (p_branch IS NULL OR b.branch = p_branch)
      AND (p_side IS NULL OR b.side = p_side)
  )
  SELECT coalesce(
    jsonb_agg(to_jsonb(r) ORDER BY r.bill_date, r.bill_no),
    '[]'::jsonb
  )
  FROM rows r;
$$;

REVOKE ALL ON FUNCTION public.fn_vat_register_accounting_json(date, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_vat_register_accounting_json(date, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_vat_register_accounting_json(date, text, text) TO service_role;

COMMENT ON FUNCTION public.fn_vat_register_accounting_json(date, text, text) IS
  'VAT book lines for accounting by document month. Generated TAR/TO and TAD-with-issued-TO use bill month; uploads use Bangkok − 10 days.';

-- Keep bill-month JSON in sync for accounting_month display on BOOK view.
DO $migrate$
DECLARE
  fn text;
  old_acct text := $old$'accounting_month', CASE
            WHEN e.doc_month IS NOT NULL THEN date_trunc('month', e.doc_month)::date
            WHEN f.first_uploaded_at IS NOT NULL THEN ops.vat_upload_doc_month(f.first_uploaded_at)
            ELSE NULL
          END$old$;
  new_acct text := $new$'accounting_month', ops.vat_register_accounting_month(
            e.doc_month,
            f.first_uploaded_at,
            b.sheet,
            b.bill_date,
            false
          )$new$;
  -- Older shape still had TAR bill_month fallback inline.
  old_acct_tar text := $old$'accounting_month', CASE
            WHEN e.doc_month IS NOT NULL THEN date_trunc('month', e.doc_month)::date
            WHEN f.first_uploaded_at IS NOT NULL THEN ops.vat_upload_doc_month(f.first_uploaded_at)
            WHEN b.sheet IN ('TAR', '3TAR', 'CNTAR', '3CNTAR') THEN date_trunc('month', b.bill_date)::date
            ELSE NULL
          END$old$;
BEGIN
  fn := pg_get_functiondef('public.fn_vat_register_json(date,date,text,text,text)'::regprocedure);
  IF position('ops.vat_register_accounting_month(' IN fn) > 0 THEN
    RETURN;
  END IF;

  IF position(old_acct_tar IN fn) > 0 THEN
    fn := replace(fn, old_acct_tar, new_acct);
  ELSIF position(old_acct IN fn) > 0 THEN
    fn := replace(fn, old_acct, new_acct);
  ELSE
    RAISE NOTICE 'fn_vat_register_json accounting_month block not recognized; skip patch';
    RETURN;
  END IF;

  EXECUTE fn;
END
$migrate$;

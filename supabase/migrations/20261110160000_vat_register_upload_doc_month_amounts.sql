-- Doc-month view: upload-based accounting month uses Bangkok date − 10 days
-- (same rule as vatReportingMonth: upload on 1–10 Nov → October doc month).
-- Purchase lines can override book amounts to match the paper document.

CREATE OR REPLACE FUNCTION ops.vat_upload_doc_month(p_uploaded_at timestamptz)
RETURNS date
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN p_uploaded_at IS NULL THEN NULL
    ELSE date_trunc(
      'month',
      ((p_uploaded_at AT TIME ZONE 'Asia/Bangkok')::date - 10)
    )::date
  END;
$$;

COMMENT ON FUNCTION ops.vat_upload_doc_month(timestamptz) IS
  'Accounting document month from an evidence upload: Asia/Bangkok calendar date minus 10 days, truncated to month start.';

REVOKE ALL ON FUNCTION ops.vat_upload_doc_month(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ops.vat_upload_doc_month(timestamptz) TO service_role;

ALTER TABLE ops.vat_line_evidence
  ADD COLUMN IF NOT EXISTS override_before_vat numeric,
  ADD COLUMN IF NOT EXISTS override_vat numeric,
  ADD COLUMN IF NOT EXISTS override_after_vat numeric;

COMMENT ON COLUMN ops.vat_line_evidence.override_before_vat IS
  'Optional before-VAT amount that replaces the book figure for VAT reporting.';
COMMENT ON COLUMN ops.vat_line_evidence.override_vat IS
  'Optional VAT amount that replaces the book figure for VAT reporting.';
COMMENT ON COLUMN ops.vat_line_evidence.override_after_vat IS
  'Optional after-VAT (total) amount that replaces the book figure for VAT reporting.';

-- CREATE OR REPLACE cannot rename/reorder middle columns; drop then recreate.
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
  CASE
    WHEN e.doc_month IS NOT NULL THEN date_trunc('month', e.doc_month)::date
    WHEN f.first_uploaded_at IS NOT NULL THEN ops.vat_upload_doc_month(f.first_uploaded_at)
    WHEN b.sheet IN ('TAR', '3TAR', 'CNTAR', '3CNTAR') THEN b.bill_month
    ELSE NULL
  END AS accounting_month,
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
LEFT JOIN files f ON f.line_key = b.line_key;

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
SET search_path = public, curated_kcw, raw_kcw, billgen, ops
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
  -- Lines that belong to this accounting month but were billed in another month.
  out_keys AS (
    SELECT e.line_key, e.bill_date
    FROM ops.vat_line_evidence e
    LEFT JOIN files f ON f.line_key = e.line_key
    CROSS JOIN p
    WHERE p.month_start IS NOT NULL
      AND e.bill_date IS NOT NULL
      AND (e.bill_date < p.month_start OR e.bill_date > p.month_end)
      AND CASE
        WHEN e.doc_month IS NOT NULL THEN date_trunc('month', e.doc_month)::date
        WHEN f.first_uploaded_at IS NOT NULL THEN ops.vat_upload_doc_month(f.first_uploaded_at)
        ELSE NULL
      END = p.month_start
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
      CASE
        WHEN e.doc_month IS NOT NULL THEN date_trunc('month', e.doc_month)::date
        WHEN f.first_uploaded_at IS NOT NULL THEN ops.vat_upload_doc_month(f.first_uploaded_at)
        WHEN b.sheet IN ('TAR', '3TAR', 'CNTAR', '3CNTAR') THEN date_trunc('month', b.bill_date)::date
        ELSE NULL
      END AS accounting_month,
      f.first_uploaded_at,
      f.last_uploaded_at,
      coalesce(f.invoice_count, 0) AS invoice_count,
      coalesce(f.receipt_count, 0) AS receipt_count
    FROM books b
    LEFT JOIN ops.vat_line_evidence e ON e.line_key = b.line_key
    LEFT JOIN files f ON f.line_key = b.line_key
    CROSS JOIN p
    WHERE (p.month_start IS NULL OR CASE
        WHEN e.doc_month IS NOT NULL THEN date_trunc('month', e.doc_month)::date
        WHEN f.first_uploaded_at IS NOT NULL THEN ops.vat_upload_doc_month(f.first_uploaded_at)
        WHEN b.sheet IN ('TAR', '3TAR', 'CNTAR', '3CNTAR') THEN date_trunc('month', b.bill_date)::date
        ELSE NULL
      END = p.month_start)
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
  'VAT book lines for accounting by document month. Upload month is Bangkok date − 10 days; optional purchase amount overrides apply.';

-- Patch bill-month JSON so accounting_month / upload dates / amount overrides apply.
-- Live fn_vat_register_json may still be the pre-doc-month shape (counts only).
DO $migrate$
DECLARE
  fn text;
  old_files text := $old$files AS MATERIALIZED (
    SELECT
      line_key,
      count(*) FILTER (WHERE kind = 'invoice')::int AS invoice_count,
      count(*) FILTER (WHERE kind = 'receipt')::int AS receipt_count
    FROM ops.vat_line_files
    GROUP BY line_key
  )$old$;
  new_files text := $new$files AS MATERIALIZED (
    SELECT
      line_key,
      min(uploaded_at) AS first_uploaded_at,
      max(uploaded_at) AS last_uploaded_at,
      count(*) FILTER (WHERE kind = 'invoice')::int AS invoice_count,
      count(*) FILTER (WHERE kind = 'receipt')::int AS receipt_count
    FROM ops.vat_line_files
    GROUP BY line_key
  )$new$;
  old_meta text := $old$'accounting_unused', coalesce(e.accounting_unused, false),
          'invoice_count', coalesce(f.invoice_count, 0),
          'receipt_count', coalesce(f.receipt_count, 0)$old$;
  new_meta text := $new$'accounting_unused', coalesce(e.accounting_unused, false),
          'doc_month', e.doc_month,
          'first_uploaded_at', f.first_uploaded_at,
          'last_uploaded_at', f.last_uploaded_at,
          'before_vat', coalesce(e.override_before_vat, b.before_vat),
          'vat', coalesce(e.override_vat, b.vat),
          'after_vat', coalesce(e.override_after_vat, b.after_vat),
          'book_before_vat', b.before_vat,
          'book_vat', b.vat,
          'book_after_vat', b.after_vat,
          'amount_overridden', e.override_after_vat IS NOT NULL,
          'accounting_month', CASE
            WHEN e.doc_month IS NOT NULL THEN date_trunc('month', e.doc_month)::date
            WHEN f.first_uploaded_at IS NOT NULL THEN ops.vat_upload_doc_month(f.first_uploaded_at)
            ELSE NULL
          END,
          'invoice_count', coalesce(f.invoice_count, 0),
          'receipt_count', coalesce(f.receipt_count, 0)$new$;
  -- Already had doc_month calendar-month upload rule from an earlier migration.
  old_acct text := $old$'accounting_month', CASE
            WHEN e.doc_month IS NOT NULL THEN date_trunc('month', e.doc_month)::date
            WHEN f.first_uploaded_at IS NOT NULL THEN date_trunc('month', f.first_uploaded_at)::date
            ELSE NULL
          END,
          'invoice_count', coalesce(f.invoice_count, 0),
          'receipt_count', coalesce(f.receipt_count, 0)$old$;
  new_acct text := $new$'before_vat', coalesce(e.override_before_vat, b.before_vat),
          'vat', coalesce(e.override_vat, b.vat),
          'after_vat', coalesce(e.override_after_vat, b.after_vat),
          'book_before_vat', b.before_vat,
          'book_vat', b.vat,
          'book_after_vat', b.after_vat,
          'amount_overridden', e.override_after_vat IS NOT NULL,
          'accounting_month', CASE
            WHEN e.doc_month IS NOT NULL THEN date_trunc('month', e.doc_month)::date
            WHEN f.first_uploaded_at IS NOT NULL THEN ops.vat_upload_doc_month(f.first_uploaded_at)
            ELSE NULL
          END,
          'invoice_count', coalesce(f.invoice_count, 0),
          'receipt_count', coalesce(f.receipt_count, 0)$new$;
BEGIN
  fn := pg_get_functiondef('public.fn_vat_register_json(date,date,text,text,text)'::regprocedure);
  IF position('ops.vat_upload_doc_month(f.first_uploaded_at)' IN fn) > 0 THEN
    RETURN;
  END IF;

  IF position(old_files IN fn) > 0 THEN
    fn := replace(fn, old_files, new_files);
  END IF;

  IF position(old_meta IN fn) > 0 THEN
    fn := replace(fn, old_meta, new_meta);
  ELSIF position(old_acct IN fn) > 0 THEN
    fn := replace(fn, old_acct, new_acct);
  ELSE
    RAISE EXCEPTION 'fn_vat_register_json metadata block not recognized';
  END IF;

  EXECUTE fn;
END
$migrate$;

-- Keep doc-month VAT register under authenticator statement_timeout (8s).
-- Old path scanned curated_kcw.vw_vat_register in full via MATERIALIZED CTEs (~7s+).
-- New path uses month-bounded fn_vat_register, and only widens the window when
-- evidence/upload lines for the accounting month have bill dates outside it.

CREATE INDEX IF NOT EXISTS vat_line_files_line_key_uploaded_idx
  ON ops.vat_line_files (line_key, uploaded_at);

CREATE INDEX IF NOT EXISTS vat_line_evidence_doc_month_idx
  ON ops.vat_line_evidence (doc_month);

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
        WHEN f.first_uploaded_at IS NOT NULL THEN date_trunc('month', f.first_uploaded_at)::date
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
      b.before_vat,
      b.vat,
      b.after_vat,
      b.detail,
      b.remark,
      e.paid_status,
      e.paid_on,
      e.accounting_unused,
      e.doc_month,
      CASE
        WHEN e.doc_month IS NOT NULL THEN date_trunc('month', e.doc_month)::date
        WHEN f.first_uploaded_at IS NOT NULL THEN date_trunc('month', f.first_uploaded_at)::date
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
        WHEN f.first_uploaded_at IS NOT NULL THEN date_trunc('month', f.first_uploaded_at)::date
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
  'VAT book lines for accounting by document month. Month-bounded via fn_vat_register; widens only for cross-month evidence/upload lines.';

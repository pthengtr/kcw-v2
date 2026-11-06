-- VAT accounting view: include TAR / CNTAR books in doc-month view via bill_month fallback.

CREATE OR REPLACE VIEW ops.vw_vat_register_accounting AS
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
    WHEN b.sheet IN ('TAR', '3TAR', 'CNTAR', '3CNTAR') THEN b.bill_month
    ELSE NULL
  END AS accounting_month,
  f.first_uploaded_at,
  f.last_uploaded_at,
  coalesce(f.invoice_count, 0) AS invoice_count,
  coalesce(f.receipt_count, 0) AS receipt_count
FROM base b
LEFT JOIN ops.vat_line_evidence e ON e.line_key = b.line_key
LEFT JOIN files f ON f.line_key = b.line_key;

REVOKE ALL ON ops.vw_vat_register_accounting FROM PUBLIC;
GRANT SELECT ON ops.vw_vat_register_accounting TO service_role;


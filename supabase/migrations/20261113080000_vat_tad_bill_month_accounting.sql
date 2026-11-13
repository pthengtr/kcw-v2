-- TAD* abbreviated tax invoices: DOC-view month follows bill_date (like TAR/TO),
-- not evidence upload Bangkok − 10 days. Explicit doc_month still wins.

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
    WHEN upper(btrim(coalesce(p_sheet, ''))) IN (
      'TAR', '3TAR', 'CNTAR', '3CNTAR', 'TO',
      'TAD', '3TAD', 'CNTAD', '3CNTAD'
    )
      THEN date_trunc('month', p_bill_date)::date
    -- p_has_issued_to kept for signature compatibility; TAD* already uses bill month.
    WHEN p_has_issued_to
      AND upper(btrim(coalesce(p_sheet, ''))) = 'TAD'
      THEN date_trunc('month', p_bill_date)::date
    WHEN p_first_uploaded_at IS NOT NULL THEN ops.vat_upload_doc_month(p_first_uploaded_at)
    ELSE NULL
  END;
$$;

COMMENT ON FUNCTION ops.vat_register_accounting_month(date, timestamptz, text, date, boolean) IS
  'VAT DOC-view month: doc_month, else bill month for TAR*/TO/TAD*, else upload Bangkok−10 days.';

COMMENT ON FUNCTION public.fn_vat_register_accounting_json(date, text, text) IS
  'VAT book lines for accounting by document month. TAR*/TO/TAD* use bill month; other uploads use Bangkok − 10 days.';

-- Shared sales-revenue inclusion rules for BI RPCs.
-- See docs/bi/kcw-sales-data-dictionary.md §6.2 / §6.2.1 / §8.

CREATE OR REPLACE FUNCTION public.fn_bi_sales_bill_excluded_from_revenue(
  p_billno text,
  p_billtype_std text DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT
    COALESCE(p_billtype_std, '') IN ('TF', 'TFV', 'TAR', 'CNTF', '3CNTF')
    OR COALESCE(p_billno, '') ~* '^(3)?CNTF'
$$;

COMMENT ON FUNCTION public.fn_bi_sales_bill_excluded_from_revenue(text, text) IS
  'True when a sales bill must be excluded from revenue KPIs (TF/TFV/TAR family + CNTF/3CNTF transfer credit notes by billno prefix or future BILLTYPE_STD).';

GRANT EXECUTE ON FUNCTION public.fn_bi_sales_bill_excluded_from_revenue(text, text) TO service_role;

-- Line-grain sales for one BCODE (shared by fn_bi_product_sales).
-- Not called from the app; execute granted to service_role only.

CREATE OR REPLACE FUNCTION public.fn_bi_product_sales_lines(
  p_bcode text,
  p_from date,
  p_to date,
  p_branch text DEFAULT NULL
)
RETURNS TABLE (
  bill_date date,
  reporting_branch text,
  store_branch text,
  bill_no text,
  billtype_std text,
  detail text,
  revenue_net numeric,
  base_qty numeric,
  unit_cost numeric,
  blank_cost_flag integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, curated_kcw
AS $$
  SELECT
    b.bill_date,
    b.reporting_branch,
    b.store_branch,
    b.bill_no,
    b.billtype_std,
    COALESCE(nullif(btrim(l."DETAIL"), ''), '') AS detail,
    CASE
      WHEN l."ISVAT" = 'Y' AND l."TAXIC" = 'Y'
        THEN COALESCE(NULLIF(replace(COALESCE(l."AMOUNT_NUM", l."AMOUNT"), ',', ''), '')::numeric, 0) / 1.07
      ELSE COALESCE(NULLIF(replace(COALESCE(l."AMOUNT_NUM", l."AMOUNT"), ',', ''), '')::numeric, 0)
    END AS revenue_net,
    COALESCE(NULLIF(replace(l."QTY", ',', ''), '')::numeric, 0)
      * COALESCE(
          NULLIF(
            COALESCE(NULLIF(replace(nullif(trim(l."MTP"), ''), ',', ''), '')::numeric, 0),
            0
          ),
          1
        ) AS base_qty,
    COALESCE(
      NULLIF(replace(nullif(btrim(l."LAST_PURCHASE_COST"), ''), ',', ''), '')::numeric,
      0
    ) AS unit_cost,
    CASE
      WHEN nullif(btrim(COALESCE(l."LAST_PURCHASE_COST", '')), '') IS NULL THEN 1
      ELSE 0
    END AS blank_cost_flag
  FROM curated_kcw.fact_sales_all l
  JOIN (
    SELECT
      hb."BRANCH" AS store_branch,
      hb."BILLNO" AS bill_no,
      left(hb."BILLDATE", 10)::date AS bill_date,
      COALESCE(NULLIF(hb."BILLTYPE_STD", ''), 'UNKNOWN') AS billtype_std,
      CASE
        WHEN COALESCE(hb."BILLTYPE_STD", '') = 'TAD' THEN 'ONLINE'
        WHEN COALESCE(hb."BILLTYPE_STD", '') = 'CN'
          AND hb."BILLNO" ~* '^CNTAD' THEN 'ONLINE'
        ELSE hb."BRANCH"
      END AS reporting_branch
    FROM curated_kcw.fact_sales_bills_all hb
    WHERE hb."CANCELED" = 'N'
      AND hb."JOURMODE" <> '0'
      AND NOT public.fn_bi_sales_bill_excluded_from_revenue(hb."BILLNO", hb."BILLTYPE_STD")
      AND upper(btrim(hb."BILLNO")) !~ '^(3)?SA'
      AND hb."BILLDATE" >= p_from::text
      AND hb."BILLDATE" < (p_to + 1)::text
  ) b
    ON b.store_branch = l."BRANCH"
   AND b.bill_no = l."BILLNO"
  WHERE l."IS_VALID" = 'True'
    AND l."CANCELED" = 'N'
    AND nullif(btrim(l."BCODE"), '') = p_bcode
    AND l."BILLDATE" >= p_from::text
    AND l."BILLDATE" < (p_to + 1)::text
    AND (p_branch IS NULL OR b.reporting_branch = p_branch);
$$;

COMMENT ON FUNCTION public.fn_bi_product_sales_lines(text, date, date, text) IS
  'Internal: revenue-filtered sales lines for one BCODE in a date range.';

REVOKE ALL ON FUNCTION public.fn_bi_product_sales_lines(text, date, date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_bi_product_sales_lines(text, date, date, text) TO service_role;

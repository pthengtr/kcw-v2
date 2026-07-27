-- Blank LAST_PURCHASE_COST lines for income BI drilldown.
-- Same sales filters / reporting_branch as fn_bi_income_overview.
-- See docs/bi/kcw-income-data-dictionary.md.

CREATE OR REPLACE FUNCTION public.fn_bi_income_blank_costs(
  p_from date,
  p_to date,
  p_branch text DEFAULT NULL,
  p_limit integer DEFAULT 500
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, curated_kcw
AS $$
DECLARE
  v_limit int;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'Invalid date range';
  END IF;

  IF p_branch IS NOT NULL AND p_branch NOT IN ('HQ', 'SYP', 'ONLINE') THEN
    RAISE EXCEPTION 'Invalid branch';
  END IF;

  v_limit := GREATEST(1, LEAST(COALESCE(p_limit, 500), 2000));

  RETURN (
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
        END AS reporting_branch
      FROM curated_kcw.fact_sales_bills_all b
      WHERE b."CANCELED" = 'N'
        AND b."JOURMODE" <> '0'
        AND COALESCE(b."BILLTYPE_STD", '') NOT IN ('TF', 'TFV', 'TAR')
        AND b."BILLDATE" >= p_from::text
        AND b."BILLDATE" < (p_to + 1)::text
    ),
    blank_lines AS (
      SELECT
        b.bill_date,
        b.store_branch,
        b.reporting_branch,
        b.bill_no,
        COALESCE(l."BCODE", '') AS bcode,
        COALESCE(l."DETAIL", '') AS detail,
        COALESCE(NULLIF(replace(l."QTY", ',', ''), '')::numeric, 0) AS qty,
        COALESCE(
          NULLIF(
            COALESCE(NULLIF(replace(nullif(trim(l."MTP"), ''), ',', ''), '')::numeric, 0),
            0
          ),
          1
        ) AS mtp,
        COALESCE(
          NULLIF(replace(COALESCE(l."AMOUNT_NUM", l."AMOUNT"), ',', ''), '')::numeric,
          0
        ) AS amount_gross,
        COALESCE(l."COST_STATUS", '') AS cost_status
      FROM curated_kcw.fact_sales_all l
      JOIN bills b
        ON b.store_branch = l."BRANCH"
       AND b.bill_no = l."BILLNO"
      WHERE l."IS_VALID" = 'True'
        AND l."CANCELED" = 'N'
        AND l."BILLDATE" >= p_from::text
        AND l."BILLDATE" < (p_to + 1)::text
        AND nullif(btrim(COALESCE(l."LAST_PURCHASE_COST", '')), '') IS NULL
        AND (p_branch IS NULL OR b.reporting_branch = p_branch)
    ),
    counted AS (
      SELECT count(*)::int AS total_count FROM blank_lines
    ),
    limited AS (
      SELECT *
      FROM blank_lines
      ORDER BY bill_date DESC, store_branch, bill_no, bcode
      LIMIT v_limit
    )
    SELECT jsonb_build_object(
      'from', p_from,
      'to', p_to,
      'branch', p_branch,
      'limit', v_limit,
      'total_count', (SELECT total_count FROM counted),
      'returned_count', (SELECT count(*)::int FROM limited),
      'truncated', (SELECT total_count FROM counted) > v_limit,
      'lines', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'bill_date', bill_date,
          'store_branch', store_branch,
          'reporting_branch', reporting_branch,
          'bill_no', bill_no,
          'bcode', bcode,
          'detail', detail,
          'qty', qty,
          'mtp', mtp,
          'amount_gross', amount_gross,
          'cost_status', cost_status
        ) ORDER BY bill_date DESC, store_branch, bill_no, bcode)
        FROM limited
      ), '[]'::jsonb)
    )
  );
END;
$$;

COMMENT ON FUNCTION public.fn_bi_income_blank_costs(date, date, text, integer) IS
  'Income BI drilldown: sales lines with blank LAST_PURCHASE_COST (COGS treated as 0).';

GRANT EXECUTE ON FUNCTION public.fn_bi_income_blank_costs(date, date, text, integer) TO service_role;

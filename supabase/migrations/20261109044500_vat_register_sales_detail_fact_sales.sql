-- VAT รายการสินค้า for SYP sales (3TR / 3TAD / …) was blank: sales_detail only
-- read raw_hq_sidet_sales_lines, which has no SYP bill lines. Notebook 30 uses
-- both HQ and SYP SIDET; curated fact_sales_all already unions both branches and
-- has a longer history than the truncated HQ SIDET feed.

DO $migrate$
DECLARE
  fn text;
  vw text;
  old_fn text := $old$FROM raw_kcw.raw_hq_sidet_sales_lines s
  WHERE nullif(btrim(s."BILLNO"), '') IS NOT NULL
    AND s."BILLDATE" >= p_from::text
    AND s."BILLDATE" < (p_to + 1)::text
  ORDER BY
    upper(btrim(s."BILLNO")),
    abs(curated_kcw.fn_vat_num(s."AMOUNT")) DESC,
    s."LINE"$old$;
  new_fn text := $new$FROM curated_kcw.fact_sales_all s
  WHERE nullif(btrim(s."BILLNO"), '') IS NOT NULL
    AND s."BILLDATE" >= p_from::text
    AND s."BILLDATE" < (p_to + 1)::text
  ORDER BY
    upper(btrim(s."BILLNO")),
    abs(curated_kcw.fn_vat_num(coalesce(nullif(btrim(s."AMOUNT_NUM"), ''), s."AMOUNT"))) DESC,
    CASE
      WHEN btrim(coalesce(s."ROW_ID", '')) ~ '^[0-9]+$' THEN btrim(s."ROW_ID")::bigint
      ELSE 0
    END$new$;
BEGIN
  fn := pg_get_functiondef('public.fn_vat_register(date,date,text)'::regprocedure);
  IF position('curated_kcw.fact_sales_all s' IN fn) = 0 THEN
    IF position(old_fn IN fn) = 0 THEN
      RAISE EXCEPTION 'sales_detail source missing from fn_vat_register';
    END IF;
    EXECUTE replace(fn, old_fn, new_fn);
  END IF;

  vw := pg_get_viewdef('curated_kcw.vw_vat_register'::regclass, true);
  vw := regexp_replace(vw, ';\s*$', '');
  IF position('curated_kcw.fact_sales_all s' IN vw) = 0 THEN
    IF position('raw_kcw.raw_hq_sidet_sales_lines s' IN vw) = 0 THEN
      RAISE EXCEPTION 'sales_detail source missing from vw_vat_register';
    END IF;
    vw := replace(vw, 'raw_kcw.raw_hq_sidet_sales_lines s', 'curated_kcw.fact_sales_all s');
    -- Tie-break on ROW_ID; fact_sales_all has no LINE column.
    vw := regexp_replace(
      vw,
      'abs\(curated_kcw\.fn_vat_num\(s\."AMOUNT"\)\)\) DESC, s\."LINE"',
      $r$abs(curated_kcw.fn_vat_num(COALESCE(NULLIF(btrim(s."AMOUNT_NUM"), ''::text), s."AMOUNT")))) DESC,
            CASE
              WHEN btrim(COALESCE(s."ROW_ID", ''::text)) ~ '^[0-9]+$'::text THEN btrim(s."ROW_ID")::bigint
              ELSE 0::bigint
            END$r$
    );
    EXECUTE 'CREATE OR REPLACE VIEW curated_kcw.vw_vat_register AS ' || vw;
  END IF;
END
$migrate$;

COMMENT ON FUNCTION public.fn_vat_register(date, date, text) IS
  'Month-bounded VAT book lines. Sales DETAIL comes from fact_sales_all (HQ + SYP).';

-- Wire CNTF/3CNTF exclusion into live BI revenue RPCs via existing helper
-- public.fn_bi_sales_bill_excluded_from_revenue, without dropping SA/3SA filters.

DO $migration$
DECLARE
  r record;
  src text;
  updated text;
  fns text[] := ARRAY[
    'fn_bi_sales_overview',
    'fn_bi_customer_overview',
    'fn_bi_income_overview',
    'fn_bi_income_blank_costs',
    'fn_bi_product_overview',
    'fn_bi_product_movement'
  ];
  fname text;
  old_filter text := $f$AND COALESCE(b."BILLTYPE_STD", '') NOT IN ('TF', 'TFV', 'TAR')$f$;
  new_filter text := $f$AND NOT public.fn_bi_sales_bill_excluded_from_revenue(b."BILLNO", b."BILLTYPE_STD")$f$;
BEGIN
  FOREACH fname IN ARRAY fns LOOP
    FOR r IN
      SELECT p.oid
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fname
    LOOP
      src := pg_get_functiondef(r.oid);
      IF src IS NULL THEN
        CONTINUE;
      END IF;
      IF src ILIKE '%fn_bi_sales_bill_excluded_from_revenue%' THEN
        RAISE NOTICE '% already uses helper', fname;
        CONTINUE;
      END IF;
      updated := replace(src, old_filter, new_filter);
      IF updated = src THEN
        RAISE EXCEPTION 'Could not patch filter in %', fname;
      END IF;
      EXECUTE updated;
      RAISE NOTICE 'Patched %', fname;
    END LOOP;
  END LOOP;
END
$migration$;

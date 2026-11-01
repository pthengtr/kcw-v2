-- Taxpayer id on the VAT books is only the 13 digits after #.
-- TR / 3TR remarks look like โอน##0105524009949.
-- Purchase remarks look like 13/8/69##0105495000551.
-- A remark with no 13-digit id stays blank.

CREATE OR REPLACE FUNCTION curated_kcw.fn_vat_tax_id(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT substring(
    regexp_replace(split_part(coalesce(p_text, ''), '#', -1), '[^0-9]', '', 'g')
    from '^[0-9]{13}$'
  );
$$;

COMMENT ON FUNCTION curated_kcw.fn_vat_tax_id(text) IS
  '13-digit taxpayer id after the last # in a VAT remark. Blank when absent.';

REVOKE ALL ON FUNCTION curated_kcw.fn_vat_tax_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION curated_kcw.fn_vat_tax_id(text) TO service_role;

DO $migrate$
DECLARE
  fn text;
  vw text;
BEGIN
  fn := pg_get_functiondef('public.fn_vat_register(date,date,text)'::regprocedure);
  IF position('curated_kcw.fn_vat_tax_id(b."REMARKS")' IN fn) = 0 THEN
    IF position($s$nullif(regexp_replace(coalesce(b."REMARKS", ''), '^##', ''), '') AS tax_id$s$ IN fn) = 0 THEN
      RAISE EXCEPTION 'sales tax_id expression missing from fn_vat_register';
    END IF;
    fn := replace(
      fn,
      $s$nullif(regexp_replace(coalesce(b."REMARKS", ''), '^##', ''), '') AS tax_id$s$,
      'curated_kcw.fn_vat_tax_id(b."REMARKS") AS tax_id'
    );
  END IF;
  IF position('curated_kcw.fn_vat_tax_id(p."REMARKS")' IN fn) = 0 THEN
    IF position($s$nullif(right(coalesce(p."REMARKS", ''), 13), '') AS tax_id$s$ IN fn) = 0 THEN
      RAISE EXCEPTION 'purchase tax_id expression missing from fn_vat_register';
    END IF;
    fn := replace(
      fn,
      $s$nullif(right(coalesce(p."REMARKS", ''), 13), '') AS tax_id$s$,
      'curated_kcw.fn_vat_tax_id(p."REMARKS") AS tax_id'
    );
  END IF;
  EXECUTE fn;

  vw := pg_get_viewdef('curated_kcw.vw_vat_register'::regclass, false);
  vw := regexp_replace(vw, ';\s*$', '');
  IF position('fn_vat_tax_id' IN vw) = 0 THEN
    IF position($s$NULLIF(regexp_replace(COALESCE(b."REMARKS", ''::text), '^##'::text, ''::text), ''::text) AS tax_id$s$ IN vw) = 0 THEN
      RAISE EXCEPTION 'sales tax_id expression missing from vw_vat_register';
    END IF;
    IF position($s$NULLIF("right"(COALESCE(p."REMARKS", ''::text), 13), ''::text) AS tax_id$s$ IN vw) = 0 THEN
      RAISE EXCEPTION 'purchase tax_id expression missing from vw_vat_register';
    END IF;
    vw := replace(
      vw,
      $s$NULLIF(regexp_replace(COALESCE(b."REMARKS", ''::text), '^##'::text, ''::text), ''::text) AS tax_id$s$,
      'curated_kcw.fn_vat_tax_id(b."REMARKS") AS tax_id'
    );
    vw := replace(
      vw,
      $s$NULLIF("right"(COALESCE(p."REMARKS", ''::text), 13), ''::text) AS tax_id$s$,
      'curated_kcw.fn_vat_tax_id(p."REMARKS") AS tax_id'
    );
    EXECUTE 'CREATE OR REPLACE VIEW curated_kcw.vw_vat_register AS ' || vw;
  END IF;
END
$migrate$;

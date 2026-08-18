-- Product catalog search for /bi/product-sales picker.
-- ICMAS HQ master: BCODE / DESCR / BRAND / MODEL / PCODE / MCODE.

CREATE OR REPLACE FUNCTION public.fn_bi_product_search(
  p_q text,
  p_limit integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, raw_kcw
AS $$
DECLARE
  v_q text;
  v_limit int;
BEGIN
  v_q := btrim(COALESCE(p_q, ''));
  v_limit := GREATEST(1, LEAST(COALESCE(p_limit, 20), 50));

  IF v_q = '' THEN
    RETURN jsonb_build_object('products', '[]'::jsonb);
  END IF;

  -- Strip LIKE wildcards so user input cannot broaden the match.
  v_q := replace(replace(v_q, '%', ''), '_', '');
  IF v_q = '' THEN
    RETURN jsonb_build_object('products', '[]'::jsonb);
  END IF;

  RETURN (
    WITH src AS (
      SELECT
        nullif(btrim(i."BCODE"), '') AS bcode,
        COALESCE(nullif(btrim(i."DESCR"), ''), '') AS detail,
        nullif(btrim(i."BRAND"), '') AS brand,
        nullif(btrim(i."MODEL"), '') AS model,
        nullif(btrim(i."PCODE"), '') AS pcode,
        nullif(btrim(i."MCODE"), '') AS mcode,
        lpad(left(nullif(btrim(i."BCODE"), ''), 2), 2, '0') AS category_code,
        COALESCE(NULLIF(replace(nullif(btrim(i."QTYOH2"), ''), ',', ''), '')::numeric, 0) AS on_hand_qty
      FROM raw_kcw.raw_hq_icmas_products i
      WHERE nullif(btrim(i."BCODE"), '') IS NOT NULL
        AND (
          i."BCODE" ILIKE '%' || v_q || '%'
          OR COALESCE(i."DESCR", '') ILIKE '%' || v_q || '%'
          OR COALESCE(i."BRAND", '') ILIKE '%' || v_q || '%'
          OR COALESCE(i."MODEL", '') ILIKE '%' || v_q || '%'
          OR COALESCE(i."PCODE", '') ILIKE '%' || v_q || '%'
          OR COALESCE(i."MCODE", '') ILIKE '%' || v_q || '%'
        )
    )
    SELECT jsonb_build_object(
      'products',
      COALESCE(
        (
          SELECT jsonb_agg(jsonb_build_object(
            'bcode', bcode,
            'detail', detail,
            'brand', brand,
            'model', model,
            'pcode', pcode,
            'mcode', mcode,
            'category_code', category_code,
            'on_hand_qty', on_hand_qty
          ) ORDER BY
            CASE WHEN bcode = v_q THEN 0 WHEN bcode ILIKE v_q || '%' THEN 1 ELSE 2 END,
            bcode
          )
          FROM (
            SELECT *
            FROM src
            ORDER BY
              CASE WHEN bcode = v_q THEN 0 WHEN bcode ILIKE v_q || '%' THEN 1 ELSE 2 END,
              bcode
            LIMIT v_limit
          ) t
        ),
        '[]'::jsonb
      )
    )
  );
END;
$$;

COMMENT ON FUNCTION public.fn_bi_product_search(text, integer) IS
  'BI product picker: ICMAS search by BCODE/DESCR/BRAND/MODEL/PCODE/MCODE.';

REVOKE ALL ON FUNCTION public.fn_bi_product_search(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_bi_product_search(text, integer) TO service_role;

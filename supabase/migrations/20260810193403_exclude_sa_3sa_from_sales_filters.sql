-- Exclude stock-check adjustment bills (BILLNO SA… / 3SA…) from sales/BI filters.
-- Rule: upper(btrim(BILLNO)) !~ '^(3)?SA' alongside TF/TFV/TAR.

-- >>> from docs/bi/sql/fn_bi_sales_overview.sql
-- Applied via Supabase migration: fn_bi_sales_overview (+ ONLINE branch + trend splits)
-- Sales BI overview: bill-grain net revenue (BEFORETAX) with confirmed filters.
-- See docs/bi/kcw-sales-data-dictionary.md §8.
-- Reporting branch: TAD/CNTAD count as ONLINE (not HQ store).

CREATE OR REPLACE FUNCTION public.fn_bi_sales_overview(
  p_from date,
  p_to date,
  p_branch text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, curated_kcw
AS $$
DECLARE
  v_result jsonb;
  v_prev_from date;
  v_prev_to date;
  v_span int;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'Invalid date range';
  END IF;

  IF p_branch IS NOT NULL AND p_branch NOT IN ('HQ', 'SYP', 'ONLINE') THEN
    RAISE EXCEPTION 'Invalid branch';
  END IF;

  v_span := (p_to - p_from);
  v_prev_to := p_from - 1;
  v_prev_from := v_prev_to - v_span;

  WITH base AS (
    SELECT
      left(b."BILLDATE", 10)::date AS bill_date,
      -- BI reporting branch: TAD/CNTAD are ONLINE, not HQ store
      CASE
        WHEN COALESCE(b."BILLTYPE_STD", '') = 'TAD' THEN 'ONLINE'
        WHEN COALESCE(b."BILLTYPE_STD", '') = 'CN'
          AND b."BILLNO" ~* '^CNTAD' THEN 'ONLINE'
        ELSE b."BRANCH"
      END AS branch,
      b."BILLNO" AS bill_no,
      COALESCE(NULLIF(b."BILLTYPE_STD", ''), 'UNKNOWN') AS billtype_std,
      CASE
        WHEN COALESCE(b."BILLTYPE_STD", '') = 'TAD' THEN 'ONLINE'
        WHEN COALESCE(b."BILLTYPE_STD", '') = 'CN'
          AND b."BILLNO" ~* '^CNTAD' THEN 'ONLINE'
        ELSE 'COUNTER'
      END AS channel,
      CASE
        WHEN COALESCE(b."BILLTYPE_STD", '') IN ('TAD', 'TD', 'TR') THEN 'VAT'
        WHEN COALESCE(b."BILLTYPE_STD", '') IN ('CN', 'DN')
          AND COALESCE(NULLIF(replace(b."TAX", ',', ''), '')::numeric, 0) <> 0 THEN 'VAT'
        WHEN COALESCE(b."BILLTYPE_STD", '') = 'UNKNOWN'
          AND b."BILLNO" ~* '^(IV|TA)' THEN 'VAT'
        ELSE 'NON_VAT'
      END AS sales_type,
      COALESCE(NULLIF(replace(b."BEFORETAX", ',', ''), '')::numeric, 0) AS revenue_net,
      COALESCE(NULLIF(replace(b."TAX", ',', ''), '')::numeric, 0) AS vat_baht
    FROM curated_kcw.fact_sales_bills_all b
    WHERE b."CANCELED" = 'N'
      AND b."JOURMODE" <> '0'
      AND COALESCE(b."BILLTYPE_STD", '') NOT IN ('TF', 'TFV', 'TAR')
      AND upper(btrim(b."BILLNO")) !~ '^(3)?SA'
      AND b."BILLDATE" >= p_from::text
      AND b."BILLDATE" < (p_to + 1)::text
  ),
  filtered AS (
    SELECT * FROM base
    WHERE p_branch IS NULL OR branch = p_branch
  ),
  prev_base AS (
    SELECT
      CASE
        WHEN COALESCE(b."BILLTYPE_STD", '') = 'TAD' THEN 'ONLINE'
        WHEN COALESCE(b."BILLTYPE_STD", '') = 'CN'
          AND b."BILLNO" ~* '^CNTAD' THEN 'ONLINE'
        ELSE b."BRANCH"
      END AS branch,
      COALESCE(NULLIF(replace(b."BEFORETAX", ',', ''), '')::numeric, 0) AS revenue_net,
      COALESCE(NULLIF(replace(b."TAX", ',', ''), '')::numeric, 0) AS vat_baht
    FROM curated_kcw.fact_sales_bills_all b
    WHERE b."CANCELED" = 'N'
      AND b."JOURMODE" <> '0'
      AND COALESCE(b."BILLTYPE_STD", '') NOT IN ('TF', 'TFV', 'TAR')
      AND upper(btrim(b."BILLNO")) !~ '^(3)?SA'
      AND b."BILLDATE" >= v_prev_from::text
      AND b."BILLDATE" < (v_prev_to + 1)::text
  ),
  prev AS (
    SELECT revenue_net, vat_baht
    FROM prev_base
    WHERE p_branch IS NULL OR branch = p_branch
  ),
  summary AS (
    SELECT
      COALESCE(sum(revenue_net), 0) AS revenue_net,
      COALESCE(sum(vat_baht), 0) AS vat_baht,
      count(*)::int AS bill_count,
      CASE WHEN count(*) > 0
        THEN COALESCE(sum(revenue_net), 0) / count(*)
        ELSE 0
      END AS avg_bill
    FROM filtered
  ),
  prev_summary AS (
    SELECT
      COALESCE(sum(revenue_net), 0) AS revenue_net,
      COALESCE(sum(vat_baht), 0) AS vat_baht,
      count(*)::int AS bill_count
    FROM prev
  ),
  by_sales_type AS (
    SELECT sales_type AS key, sum(revenue_net) AS revenue_net, count(*)::int AS bill_count
    FROM filtered
    GROUP BY 1
  ),
  by_branch AS (
    SELECT branch AS key, sum(revenue_net) AS revenue_net, count(*)::int AS bill_count
    FROM filtered
    GROUP BY 1
  ),
  by_channel AS (
    SELECT channel AS key, sum(revenue_net) AS revenue_net, count(*)::int AS bill_count
    FROM filtered
    GROUP BY 1
  ),
  by_billtype AS (
    SELECT billtype_std AS key, sum(revenue_net) AS revenue_net, count(*)::int AS bill_count
    FROM filtered
    GROUP BY 1
  ),
  daily AS (
    SELECT
      bill_date::text AS period,
      sum(revenue_net) AS revenue_net,
      count(*)::int AS bill_count,
      COALESCE(sum(revenue_net) FILTER (WHERE branch = 'HQ'), 0) AS hq_revenue_net,
      COALESCE(sum(revenue_net) FILTER (WHERE branch = 'SYP'), 0) AS syp_revenue_net,
      COALESCE(sum(revenue_net) FILTER (WHERE branch = 'ONLINE'), 0) AS online_revenue_net
    FROM filtered
    GROUP BY 1
    ORDER BY 1
  ),
  monthly AS (
    SELECT
      to_char(date_trunc('month', bill_date), 'YYYY-MM') AS period,
      sum(revenue_net) AS revenue_net,
      count(*)::int AS bill_count,
      COALESCE(sum(revenue_net) FILTER (WHERE branch = 'HQ'), 0) AS hq_revenue_net,
      COALESCE(sum(revenue_net) FILTER (WHERE branch = 'SYP'), 0) AS syp_revenue_net,
      COALESCE(sum(revenue_net) FILTER (WHERE branch = 'ONLINE'), 0) AS online_revenue_net
    FROM filtered
    GROUP BY 1
    ORDER BY 1
  )
  SELECT jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'branch', p_branch,
    'previous_from', v_prev_from,
    'previous_to', v_prev_to,
    'summary', (
      SELECT jsonb_build_object(
        'revenue_net', revenue_net,
        'vat_baht', vat_baht,
        'bill_count', bill_count,
        'avg_bill', avg_bill
      ) FROM summary
    ),
    'previous_summary', (
      SELECT jsonb_build_object(
        'revenue_net', revenue_net,
        'vat_baht', vat_baht,
        'bill_count', bill_count
      ) FROM prev_summary
    ),
    'by_sales_type', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', key, 'revenue_net', revenue_net, 'bill_count', bill_count
      ) ORDER BY key)
      FROM by_sales_type
    ), '[]'::jsonb),
    'by_branch', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', key, 'revenue_net', revenue_net, 'bill_count', bill_count
      ) ORDER BY key)
      FROM by_branch
    ), '[]'::jsonb),
    'by_channel', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', key, 'revenue_net', revenue_net, 'bill_count', bill_count
      ) ORDER BY key)
      FROM by_channel
    ), '[]'::jsonb),
    'by_billtype', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', key, 'revenue_net', revenue_net, 'bill_count', bill_count
      ) ORDER BY revenue_net DESC)
      FROM by_billtype
    ), '[]'::jsonb),
    'trend_daily', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'period', period,
        'revenue_net', revenue_net,
        'bill_count', bill_count,
        'hq_revenue_net', hq_revenue_net,
        'syp_revenue_net', syp_revenue_net,
        'online_revenue_net', online_revenue_net
      ) ORDER BY period)
      FROM daily
    ), '[]'::jsonb),
    'trend_monthly', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'period', period,
        'revenue_net', revenue_net,
        'bill_count', bill_count,
        'hq_revenue_net', hq_revenue_net,
        'syp_revenue_net', syp_revenue_net,
        'online_revenue_net', online_revenue_net
      ) ORDER BY period)
      FROM monthly
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.fn_bi_sales_overview(date, date, text) IS
  'Sales BI overview: net BEFORETAX; reporting_branch HQ/SYP/ONLINE (TAD/CNTAD not in HQ).';

GRANT EXECUTE ON FUNCTION public.fn_bi_sales_overview(date, date, text) TO service_role;\n\n-- >>> from docs/bi/sql/fn_bi_product_overview.sql\n-- Product BI overview: line-grain net revenue ranked by BCODE.
-- Filters match sales revenue rules; reporting_branch HQ/SYP/ONLINE (TAD/CNTAD).
-- See docs/bi/kcw-sales-data-dictionary.md §8 and kcw-icmas-data-dictionary.md.

CREATE INDEX IF NOT EXISTS fact_sales_all_billdate_idx
  ON curated_kcw.fact_sales_all ("BILLDATE");

CREATE INDEX IF NOT EXISTS fact_sales_all_branch_billno_idx
  ON curated_kcw.fact_sales_all ("BRANCH", "BILLNO");

CREATE OR REPLACE FUNCTION public.fn_bi_product_overview(
  p_from date,
  p_to date,
  p_branch text DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, curated_kcw, raw_kcw
AS $$
DECLARE
  v_result jsonb;
  v_prev_from date;
  v_prev_to date;
  v_span int;
  v_limit int;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'Invalid date range';
  END IF;

  IF p_branch IS NOT NULL AND p_branch NOT IN ('HQ', 'SYP', 'ONLINE') THEN
    RAISE EXCEPTION 'Invalid branch';
  END IF;

  v_limit := GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
  v_span := (p_to - p_from);
  v_prev_to := p_from - 1;
  v_prev_from := v_prev_to - v_span;

  WITH bills AS (
    SELECT
      b."BRANCH" AS store_branch,
      b."BILLNO" AS bill_no,
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
      AND upper(btrim(b."BILLNO")) !~ '^(3)?SA'
      AND b."BILLDATE" >= p_from::text
      AND b."BILLDATE" < (p_to + 1)::text
  ),
  prev_bills AS (
    SELECT
      b."BRANCH" AS store_branch,
      b."BILLNO" AS bill_no,
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
      AND upper(btrim(b."BILLNO")) !~ '^(3)?SA'
      AND b."BILLDATE" >= v_prev_from::text
      AND b."BILLDATE" < (v_prev_to + 1)::text
  ),
  line_base AS (
    SELECT
      l."BCODE" AS bcode,
      l."DETAIL" AS detail,
      lpad(left(COALESCE(l."BCODE", ''), 2), 2, '0') AS category_code,
      b.reporting_branch,
      CASE
        WHEN l."ISVAT" = 'Y' AND l."TAXIC" = 'Y'
          THEN COALESCE(NULLIF(replace(l."AMOUNT_NUM", ',', ''), '')::numeric, 0) / 1.07
        ELSE COALESCE(NULLIF(replace(l."AMOUNT_NUM", ',', ''), '')::numeric, 0)
      END AS revenue_net,
      COALESCE(NULLIF(replace(l."QTY", ',', ''), '')::numeric, 0)
        * COALESCE(
            NULLIF(
              COALESCE(NULLIF(replace(nullif(trim(l."MTP"), ''), ',', ''), '')::numeric, 0),
              0
            ),
            1
          ) AS base_qty,
      l."BRANCH" AS store_branch,
      l."BILLNO" AS bill_no
    FROM curated_kcw.fact_sales_all l
    JOIN bills b
      ON b.store_branch = l."BRANCH"
     AND b.bill_no = l."BILLNO"
    WHERE l."IS_VALID" = 'True'
      AND l."CANCELED" = 'N'
      AND l."BILLDATE" >= p_from::text
      AND l."BILLDATE" < (p_to + 1)::text
      AND (p_branch IS NULL OR b.reporting_branch = p_branch)
  ),
  prev_lines AS (
    SELECT
      CASE
        WHEN l."ISVAT" = 'Y' AND l."TAXIC" = 'Y'
          THEN COALESCE(NULLIF(replace(l."AMOUNT_NUM", ',', ''), '')::numeric, 0) / 1.07
        ELSE COALESCE(NULLIF(replace(l."AMOUNT_NUM", ',', ''), '')::numeric, 0)
      END AS revenue_net,
      COALESCE(NULLIF(replace(l."QTY", ',', ''), '')::numeric, 0)
        * COALESCE(
            NULLIF(
              COALESCE(NULLIF(replace(nullif(trim(l."MTP"), ''), ',', ''), '')::numeric, 0),
              0
            ),
            1
          ) AS base_qty,
      l."BCODE" AS bcode
    FROM curated_kcw.fact_sales_all l
    JOIN prev_bills b
      ON b.store_branch = l."BRANCH"
     AND b.bill_no = l."BILLNO"
    WHERE l."IS_VALID" = 'True'
      AND l."CANCELED" = 'N'
      AND l."BILLDATE" >= v_prev_from::text
      AND l."BILLDATE" < (v_prev_to + 1)::text
      AND (p_branch IS NULL OR b.reporting_branch = p_branch)
  ),
  product_agg AS (
    SELECT
      bcode,
      max(detail) AS detail,
      max(category_code) AS category_code,
      sum(revenue_net) AS revenue_net,
      sum(base_qty) AS base_qty,
      count(*)::int AS line_count,
      count(DISTINCT (store_branch, bill_no))::int AS bill_count,
      COALESCE(sum(revenue_net) FILTER (WHERE reporting_branch = 'HQ'), 0) AS hq_revenue_net,
      COALESCE(sum(revenue_net) FILTER (WHERE reporting_branch = 'SYP'), 0) AS syp_revenue_net,
      COALESCE(sum(revenue_net) FILTER (WHERE reporting_branch = 'ONLINE'), 0) AS online_revenue_net
    FROM line_base
    GROUP BY bcode
  ),
  icmas AS (
    SELECT
      p."BCODE" AS bcode,
      nullif(trim(p."DESCR"), '') AS descr,
      upper(trim(p."CODE1")) AS code1,
      COALESCE(NULLIF(replace(nullif(trim(p."QTYOH2"), ''), ',', ''), '')::numeric, 0) AS on_hand_qty,
      nullif(trim(p."PCODE"), '') AS pcode,
      nullif(trim(p."MCODE"), '') AS mcode,
      nullif(trim(p."BRAND"), '') AS brand
    FROM raw_kcw.raw_hq_icmas_products p
  ),
  category_dim AS (
    SELECT * FROM (VALUES
      ('01', 'TX จิ๊ป แลนด์'),
      ('02', 'I/S JCM FV FXZ DECA TX บรรทุก 10 ล้อ'),
      ('03', 'I/S KBZ TFR D-MAX กระบะ'),
      ('04', 'I/S ELF-KS NPR NKR NQR บรรทุก 4-6 ล้อ'),
      ('05', 'NISSAN (D/S) กระบะ เก๋ง'),
      ('06', 'NISSAN UD CW CMA บรรทุก 6-10 ล้อ'),
      ('07', 'MAZDA FORD กระบะ เก๋ง'),
      ('08', 'TOYOTA กระบะ เก๋ง'),
      ('09', 'HINO'),
      ('10', 'FUSO'),
      ('11', 'MITSUBISHI กระบะ เก๋ง'),
      ('12', 'รถไถ FORD JOHNDEERE'),
      ('13', 'ทั่วไป โช้คอัพ ไฟ ยาง'),
      ('14', 'เครื่องเหล็ก เครื่องมือ'),
      ('15', 'ลูกปืน'),
      ('16', 'HONDA รถญี่ปุ่น เกาหลี ทั่วไป'),
      ('17', 'สกรู MIC ดำ'),
      ('18', 'สกรู NF ละเอียด'),
      ('19', 'สกรู NC หยาบ'),
      ('20', 'สกรู MIC ขาว'),
      ('21', 'แบตเตอรี่ น้ำกรด น้ำกลั่น'),
      ('22', 'น้ำมัน จารบี น้ำยา'),
      ('23', 'รถยุโรป BENZ BMW'),
      ('24', 'อะไหล่เก่า เชียงกง'),
      ('25', 'ยางโอริง'),
      ('26', 'สายอ่อน'),
      ('27', 'บัส'),
      ('28', 'พ่วง เทลเลอร์ ดั๊ม'),
      ('29', 'ประดับยนต์'),
      ('30', 'รถไถ KUBOTA'),
      ('31', 'รถไถ MASSEY (แมสซี่ย์)'),
      ('32', 'แม็คโคร'),
      ('33', 'อัดสายไฮดรอลิค'),
      ('34', 'โฟคลิฟ รถยก'),
      ('35', 'รถไถ ยันม่าร์ อิเซกิ ฮิโนโมโต้ แชมป์'),
      ('40', 'ค่าแรง'),
      ('70', 'ค่าใช้จ่าย เทิร์นแบตเก่า'),
      ('91', 'โปรโมชั่น / พิเศษ')
    ) AS t(category_code, category_name)
  ),
  code1_dim AS (
    SELECT * FROM (VALUES
      ('A', 'ถ่าน'),
      ('C', 'ซีล'),
      ('D', 'บู๊ช'),
      ('E', 'ลูกปืนเข็ม/กรงนก'),
      ('F', 'ไส้กรองอากาศ'),
      ('G', 'ยอยกากบาท'),
      ('I', 'ลูกปืนตลับ / ลูกปืน'),
      ('K', 'จานคลัช'),
      ('L', 'สายอ่อน'),
      ('O', 'โอริง'),
      ('P', 'ไส้กรองน้ำมันเครื่อง'),
      ('Q', 'ลูกหมาก'),
      ('R', 'ลูกยาง')
    ) AS t(code1, code1_name)
  ),
  enriched AS (
    SELECT
      a.bcode,
      COALESCE(i.descr, a.detail, a.bcode) AS detail,
      a.category_code,
      COALESCE(cd.category_name, a.category_code) AS category_name,
      CASE
        WHEN i.code1 ~ '^[A-Z]$' THEN i.code1
        ELSE NULL
      END AS code1,
      c1.code1_name,
      a.revenue_net,
      a.base_qty,
      a.line_count,
      a.bill_count,
      a.hq_revenue_net,
      a.syp_revenue_net,
      a.online_revenue_net,
      COALESCE(i.on_hand_qty, 0) AS on_hand_qty,
      i.pcode,
      i.mcode,
      i.brand
    FROM product_agg a
    LEFT JOIN icmas i ON i.bcode = a.bcode
    LEFT JOIN category_dim cd ON cd.category_code = a.category_code
    LEFT JOIN code1_dim c1 ON c1.code1 = CASE WHEN i.code1 ~ '^[A-Z]$' THEN i.code1 END
  ),
  summary AS (
    SELECT
      COALESCE(sum(revenue_net), 0) AS revenue_net,
      COALESCE(sum(base_qty), 0) AS base_qty,
      count(*)::int AS sku_count,
      COALESCE(sum(line_count), 0)::int AS line_count,
      COALESCE(sum(bill_count), 0)::int AS bill_count
    FROM enriched
  ),
  prev_summary AS (
    SELECT
      COALESCE(sum(revenue_net), 0) AS revenue_net,
      COALESCE(sum(base_qty), 0) AS base_qty,
      count(DISTINCT bcode)::int AS sku_count
    FROM prev_lines
  ),
  by_category AS (
    SELECT
      category_code AS key,
      max(category_name) AS label,
      sum(revenue_net) AS revenue_net,
      sum(base_qty) AS base_qty,
      count(*)::int AS sku_count
    FROM enriched
    GROUP BY category_code
  ),
  by_code1 AS (
    SELECT
      COALESCE(code1, 'OTHER') AS key,
      COALESCE(max(code1_name), 'อื่นๆ / ไม่ระบุ') AS label,
      sum(revenue_net) AS revenue_net,
      sum(base_qty) AS base_qty,
      count(*)::int AS sku_count
    FROM enriched
    GROUP BY COALESCE(code1, 'OTHER')
  ),
  by_branch AS (
    SELECT reporting_branch AS key,
           sum(revenue_net) AS revenue_net,
           count(*)::int AS line_count
    FROM line_base
    GROUP BY 1
  ),
  top_products AS (
    SELECT *
    FROM enriched
    ORDER BY revenue_net DESC, base_qty DESC, bcode
    LIMIT v_limit
  )
  SELECT jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'branch', p_branch,
    'limit', v_limit,
    'previous_from', v_prev_from,
    'previous_to', v_prev_to,
    'summary', (
      SELECT jsonb_build_object(
        'revenue_net', revenue_net,
        'base_qty', base_qty,
        'sku_count', sku_count,
        'line_count', line_count,
        'bill_count', bill_count
      ) FROM summary
    ),
    'previous_summary', (
      SELECT jsonb_build_object(
        'revenue_net', revenue_net,
        'base_qty', base_qty,
        'sku_count', sku_count
      ) FROM prev_summary
    ),
    'by_category', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', key,
        'label', label,
        'revenue_net', revenue_net,
        'base_qty', base_qty,
        'sku_count', sku_count
      ) ORDER BY revenue_net DESC)
      FROM by_category
    ), '[]'::jsonb),
    'by_code1', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', key,
        'label', label,
        'revenue_net', revenue_net,
        'base_qty', base_qty,
        'sku_count', sku_count
      ) ORDER BY revenue_net DESC)
      FROM by_code1
    ), '[]'::jsonb),
    'by_branch', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', key,
        'revenue_net', revenue_net,
        'bill_count', line_count
      ) ORDER BY key)
      FROM by_branch
    ), '[]'::jsonb),
    'top_products', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'bcode', bcode,
        'detail', detail,
        'category_code', category_code,
        'category_name', category_name,
        'code1', code1,
        'code1_name', code1_name,
        'revenue_net', revenue_net,
        'base_qty', base_qty,
        'line_count', line_count,
        'bill_count', bill_count,
        'hq_revenue_net', hq_revenue_net,
        'syp_revenue_net', syp_revenue_net,
        'online_revenue_net', online_revenue_net,
        'on_hand_qty', on_hand_qty,
        'pcode', pcode,
        'mcode', mcode,
        'brand', brand
      ) ORDER BY revenue_net DESC, base_qty DESC, bcode)
      FROM top_products
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.fn_bi_product_overview(date, date, text, integer) IS
  'Product BI: line net revenue ranking by BCODE with category/CODE1 splits; ICMAS enrich.';

GRANT EXECUTE ON FUNCTION public.fn_bi_product_overview(date, date, text, integer) TO service_role;\n\n-- >>> from docs/bi/sql/fn_bi_product_movement.sql\n-- Product movement BI: stock-more (sell qty rank) + dead-stock aging from last HQ buy.
-- See docs/bi/kcw-product-movement-data-dictionary.md and kcw-purchase-data-dictionary.md.
--
-- p_mode:
--   stock_more — period sell rank only (no dead scan)
--   dead       — as-of dead list only (no period sell rank)
--   both       — full payload (heavier; avoid in UI)

DROP FUNCTION IF EXISTS public.fn_bi_product_movement(date, date, text, integer, integer);
DROP FUNCTION IF EXISTS public.fn_bi_product_movement(date, date, text, integer, integer, integer);
DROP FUNCTION IF EXISTS public.fn_bi_product_movement(date, date, text, integer, integer, integer, text);
DROP FUNCTION IF EXISTS public.fn_bi_product_movement(date, date, text, integer, integer, integer, text, text);
DROP FUNCTION IF EXISTS public.fn_bi_product_movement(date, date, text, integer, integer, integer, text, text, text, text);

CREATE OR REPLACE FUNCTION public.fn_bi_product_movement(
  p_from date,
  p_to date,
  p_branch text DEFAULT NULL,
  p_stock_limit integer DEFAULT 50,
  p_dead_limit integer DEFAULT 100,
  p_dead_offset integer DEFAULT 0,
  p_dead_sort text DEFAULT 'deep',
  p_mode text DEFAULT 'both',
  p_dead_tier text DEFAULT NULL,
  p_category text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, curated_kcw, raw_kcw
SET statement_timeout = '60s'
AS $$
DECLARE
  v_stock_limit int;
  v_dead_limit int;
  v_dead_offset int;
  v_dead_sort text;
  v_mode text;
  v_want_stock boolean;
  v_want_dead boolean;
  v_dead_tier text;
  v_category text;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'Invalid date range';
  END IF;

  IF p_branch IS NOT NULL AND p_branch NOT IN ('HQ', 'SYP', 'ONLINE') THEN
    RAISE EXCEPTION 'Invalid branch';
  END IF;

  v_stock_limit := GREATEST(1, LEAST(COALESCE(p_stock_limit, 50), 200));
  v_dead_limit := GREATEST(1, LEAST(COALESCE(p_dead_limit, 100), 500));
  v_dead_offset := GREATEST(0, COALESCE(p_dead_offset, 0));
  v_dead_sort := lower(COALESCE(p_dead_sort, 'deep'));
  IF v_dead_sort NOT IN (
    'deep', 'recent', 'value_desc', 'value_asc', 'qty_desc', 'cost_desc'
  ) THEN
    v_dead_sort := 'deep';
  END IF;
  v_mode := lower(COALESCE(p_mode, 'both'));
  IF v_mode NOT IN ('stock_more', 'dead', 'both') THEN
    RAISE EXCEPTION 'Invalid mode';
  END IF;
  v_want_stock := v_mode IN ('stock_more', 'both');
  v_want_dead := v_mode IN ('dead', 'both');

  v_dead_tier := lower(nullif(btrim(COALESCE(p_dead_tier, '')), ''));
  IF v_dead_tier IS NOT NULL AND v_dead_tier NOT IN ('yellow', 'orange', 'red') THEN
    RAISE EXCEPTION 'Invalid dead_tier';
  END IF;

  IF p_category IS NULL OR btrim(p_category) = '' THEN
    v_category := NULL;
  ELSE
    v_category := lpad(left(btrim(p_category), 2), 2, '0');
  END IF;

  RETURN (
    WITH
    -- Period bills only (stock-more / period KPIs)
    sales_bills_period AS (
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
      WHERE v_want_stock
        AND b."CANCELED" = 'N'
        AND b."JOURMODE" <> '0'
        AND COALESCE(b."BILLTYPE_STD", '') NOT IN ('TF', 'TFV', 'TAR')
      AND upper(btrim(b."BILLNO")) !~ '^(3)?SA'
        AND b."BILLDATE" >= p_from::text
        AND b."BILLDATE" < (p_to + 1)::text
    ),
    sales_period AS (
      SELECT
        nullif(btrim(l."BCODE"), '') AS bcode,
        max(COALESCE(l."DETAIL", '')) AS detail,
        sum(
          COALESCE(NULLIF(replace(l."QTY", ',', ''), '')::numeric, 0)
          * COALESCE(
              NULLIF(
                COALESCE(NULLIF(replace(nullif(trim(l."MTP"), ''), ',', ''), '')::numeric, 0),
                0
              ),
              1
            )
        ) AS sell_qty,
        count(DISTINCT (b.store_branch, b.bill_no))::int AS sell_bills,
        count(DISTINCT b.bill_date)::int AS sell_days
      FROM curated_kcw.fact_sales_all l
      JOIN sales_bills_period b
        ON b.store_branch = l."BRANCH"
       AND b.bill_no = l."BILLNO"
      WHERE v_want_stock
        AND l."IS_VALID" = 'True'
        AND l."CANCELED" = 'N'
        AND nullif(btrim(l."BCODE"), '') IS NOT NULL
        AND (p_branch IS NULL OR b.reporting_branch = p_branch)
      GROUP BY 1
    ),
    -- Light last-sale dates (no QTY×MTP) — only for dead aging
    last_sale AS (
      SELECT
        nullif(btrim(l."BCODE"), '') AS bcode,
        max(left(l."BILLDATE", 10)::date) AS last_sale_date
      FROM curated_kcw.fact_sales_all l
      JOIN curated_kcw.fact_sales_bills_all b
        ON b."BRANCH" = l."BRANCH"
       AND b."BILLNO" = l."BILLNO"
      WHERE v_want_dead
        AND l."IS_VALID" = 'True'
        AND l."CANCELED" = 'N'
        AND b."CANCELED" = 'N'
        AND b."JOURMODE" <> '0'
        AND COALESCE(b."BILLTYPE_STD", '') NOT IN ('TF', 'TFV', 'TAR')
      AND upper(btrim(b."BILLNO")) !~ '^(3)?SA'
        AND l."BILLDATE" < (p_to + 1)::text
        AND nullif(btrim(l."BCODE"), '') IS NOT NULL
        AND (
          v_category IS NULL
          OR lpad(left(nullif(btrim(l."BCODE"), ''), 2), 2, '0') = v_category
        )
      GROUP BY 1
    ),
    purchase_product AS (
      SELECT
        nullif(btrim(p."BCODE"), '') AS bcode,
        COALESCE(p."DETAIL", '') AS detail,
        p."BILLTYPE" AS billtype,
        left(p."BILLDATE", 10)::date AS bill_date,
        p."BILLNO" AS bill_no,
        COALESCE(NULLIF(replace(p."QTY", ',', ''), '')::numeric, 0)
          * COALESCE(
              NULLIF(
                COALESCE(NULLIF(replace(nullif(trim(p."MTP"), ''), ',', ''), '')::numeric, 0),
                0
              ),
              1
            ) AS base_qty
      FROM raw_kcw.raw_hq_pidet_purchase_lines p
      WHERE (v_want_dead OR v_want_stock)
        AND COALESCE(p."JOURMODE", '') IN ('1', '2')
        AND COALESCE(p."BILLTYPE", '') IN ('1', '2', '3')
        AND nullif(btrim(p."BCODE"), '') IS NOT NULL
        AND p."BILLDATE" < (p_to + 1)::text
        AND (
          v_want_dead
          OR (
            left(p."BILLDATE", 10)::date >= p_from
            AND left(p."BILLDATE", 10)::date <= p_to
          )
        )
        AND (
          NOT v_want_dead
          OR v_category IS NULL
          OR lpad(left(nullif(btrim(p."BCODE"), ''), 2), 2, '0') = v_category
        )
    ),
    purchase_period AS (
      SELECT
        bcode,
        max(detail) AS detail,
        sum(base_qty) AS buy_qty,
        count(DISTINCT bill_no)::int AS buy_bills
      FROM purchase_product
      WHERE v_want_stock
        AND bill_date >= p_from
        AND bill_date <= p_to
      GROUP BY bcode
    ),
    last_purchase AS (
      SELECT
        bcode,
        max(detail) AS detail,
        max(bill_date) AS last_purchase_date
      FROM purchase_product
      WHERE v_want_dead
        AND billtype = '1'
      GROUP BY bcode
    ),
    icmas AS (
      SELECT
        nullif(btrim(i."BCODE"), '') AS bcode,
        max(COALESCE(i."DESCR", '')) AS descr,
        max(COALESCE(i."CODE1", '')) AS code1,
        max(
          COALESCE(NULLIF(replace(nullif(btrim(i."QTYOH2"), ''), ',', ''), '')::numeric, 0)
        ) AS on_hand_qty,
        max(
          NULLIF(replace(nullif(btrim(i."COSTLAST"), ''), ',', ''), '')::numeric
        ) AS unit_cost
      FROM raw_kcw.raw_hq_icmas_products i
      WHERE nullif(btrim(i."BCODE"), '') IS NOT NULL
      GROUP BY 1
    ),
    dead_scored AS (
      SELECT
        lp.bcode,
        COALESCE(NULLIF(i.descr, ''), NULLIF(lp.detail, ''), lp.bcode) AS detail,
        lpad(left(lp.bcode, 2), 2, '0') AS category_code,
        nullif(btrim(COALESCE(i.code1, '')), '') AS code1,
        COALESCE(i.on_hand_qty, 0) AS on_hand_qty,
        i.unit_cost,
        COALESCE(i.on_hand_qty, 0) * COALESCE(i.unit_cost, 0) AS stock_value,
        lp.last_purchase_date,
        ls.last_sale_date,
        (p_to - lp.last_purchase_date) AS days_since_purchase,
        CASE
          WHEN ls.last_sale_date IS NULL THEN NULL
          ELSE (p_to - ls.last_sale_date)
        END AS days_since_sale,
        true AS no_move_since_purchase,
        CASE
          WHEN (p_to - lp.last_purchase_date) >= 730 THEN 'red'
          WHEN (p_to - lp.last_purchase_date) >= 365 THEN 'orange'
          WHEN (p_to - lp.last_purchase_date) >= 180 THEN 'yellow'
          ELSE NULL
        END AS dead_tier
      FROM last_purchase lp
      LEFT JOIN last_sale ls ON ls.bcode = lp.bcode
      LEFT JOIN icmas i ON i.bcode = lp.bcode
      WHERE v_want_dead
        AND COALESCE(i.on_hand_qty, 0) > 0
        AND (ls.last_sale_date IS NULL OR ls.last_sale_date < lp.last_purchase_date)
        AND (p_to - lp.last_purchase_date) >= 180
        AND (
          v_category IS NULL
          OR lpad(left(lp.bcode, 2), 2, '0') = v_category
        )
    ),
    -- Tier counts within current category (before tier chip filter)
    dead_filtered AS (
      SELECT *
      FROM dead_scored
      WHERE dead_tier IS NOT NULL
    ),
    dead_list_source AS (
      SELECT *
      FROM dead_filtered
      WHERE v_dead_tier IS NULL OR dead_tier = v_dead_tier
    ),
    stock_more AS (
      SELECT
        s.bcode,
        COALESCE(NULLIF(i.descr, ''), NULLIF(s.detail, ''), s.bcode) AS detail,
        lpad(left(s.bcode, 2), 2, '0') AS category_code,
        nullif(btrim(COALESCE(i.code1, '')), '') AS code1,
        s.sell_qty,
        s.sell_bills,
        s.sell_days,
        COALESCE(p.buy_qty, 0) AS buy_qty,
        COALESCE(p.buy_bills, 0) AS buy_bills,
        COALESCE(i.on_hand_qty, 0) AS on_hand_qty,
        ls.last_sale_date,
        lp.last_purchase_date
      FROM sales_period s
      LEFT JOIN purchase_period p ON p.bcode = s.bcode
      LEFT JOIN icmas i ON i.bcode = s.bcode
      LEFT JOIN last_sale ls ON ls.bcode = s.bcode
      LEFT JOIN last_purchase lp ON lp.bcode = s.bcode
      WHERE v_want_stock
      ORDER BY s.sell_qty DESC, s.sell_bills DESC, s.bcode
      LIMIT v_stock_limit
    ),
    dead_list AS (
      SELECT
        d.bcode,
        d.detail,
        d.category_code,
        d.code1,
        d.on_hand_qty,
        d.unit_cost,
        d.stock_value,
        d.last_purchase_date,
        d.last_sale_date,
        d.days_since_purchase,
        d.days_since_sale,
        d.no_move_since_purchase,
        d.dead_tier,
        0::numeric AS sell_qty_period,
        0::numeric AS buy_qty_period
      FROM dead_list_source d
      WHERE v_want_dead
      ORDER BY
        CASE
          WHEN v_dead_sort = 'deep' THEN
            CASE d.dead_tier
              WHEN 'red' THEN 1
              WHEN 'orange' THEN 2
              WHEN 'yellow' THEN 3
              ELSE 4
            END
          WHEN v_dead_sort = 'recent' THEN
            CASE d.dead_tier
              WHEN 'yellow' THEN 1
              WHEN 'orange' THEN 2
              WHEN 'red' THEN 3
              ELSE 4
            END
          ELSE 0
        END,
        CASE WHEN v_dead_sort = 'deep' THEN d.days_since_purchase END DESC NULLS LAST,
        CASE WHEN v_dead_sort = 'recent' THEN d.days_since_purchase END ASC NULLS LAST,
        CASE WHEN v_dead_sort = 'value_desc' THEN d.stock_value END DESC NULLS LAST,
        CASE WHEN v_dead_sort = 'value_asc' THEN d.stock_value END ASC NULLS LAST,
        CASE WHEN v_dead_sort = 'qty_desc' THEN d.on_hand_qty END DESC NULLS LAST,
        CASE WHEN v_dead_sort = 'cost_desc' THEN d.unit_cost END DESC NULLS LAST,
        d.bcode
      OFFSET v_dead_offset
      LIMIT CASE WHEN v_want_dead THEN v_dead_limit ELSE 0 END
    ),
    summary AS (
      SELECT
        CASE WHEN v_want_stock THEN (SELECT count(*)::int FROM sales_period) ELSE 0 END AS sold_sku_count,
        CASE WHEN v_want_stock THEN (SELECT COALESCE(sum(sell_qty), 0) FROM sales_period) ELSE 0 END AS sell_qty,
        CASE WHEN v_want_stock THEN (SELECT count(*)::int FROM purchase_period) ELSE 0 END AS bought_sku_count,
        CASE WHEN v_want_stock THEN (SELECT COALESCE(sum(buy_qty), 0) FROM purchase_period) ELSE 0 END AS buy_qty,
        CASE WHEN v_want_dead THEN (SELECT count(*)::int FROM dead_filtered WHERE dead_tier = 'yellow') ELSE 0 END AS dead_yellow_count,
        CASE WHEN v_want_dead THEN (SELECT count(*)::int FROM dead_filtered WHERE dead_tier = 'orange') ELSE 0 END AS dead_orange_count,
        CASE WHEN v_want_dead THEN (SELECT count(*)::int FROM dead_filtered WHERE dead_tier = 'red') ELSE 0 END AS dead_red_count,
        CASE WHEN v_want_dead THEN (SELECT count(*)::int FROM dead_list_source) ELSE 0 END AS dead_total_count,
        CASE WHEN v_want_dead THEN (SELECT count(*)::int FROM dead_filtered) ELSE 0 END AS dead_category_total,
        CASE WHEN v_want_dead THEN (
          SELECT COALESCE(sum(stock_value), 0) FROM dead_list_source
        ) ELSE 0 END AS dead_stock_value,
        CASE WHEN v_want_dead THEN (
          SELECT COALESCE(sum(stock_value), 0) FROM dead_filtered
        ) ELSE 0 END AS dead_category_stock_value
    )
    SELECT jsonb_build_object(
      'from', p_from,
      'to', p_to,
      'branch', p_branch,
      'mode', v_mode,
      'stock_limit', v_stock_limit,
      'dead_limit', v_dead_limit,
      'dead_offset', v_dead_offset,
      'dead_sort', v_dead_sort,
      'dead_tier', v_dead_tier,
      'dead_category', v_category,
      'dead_returned_count', (SELECT count(*)::int FROM dead_list),
      'dead_has_more', (
        v_want_dead
        AND (v_dead_offset + (SELECT count(*)::int FROM dead_list))
          < (SELECT dead_total_count FROM summary)
      ),
      'summary', (SELECT jsonb_build_object(
        'sold_sku_count', sold_sku_count,
        'sell_qty', sell_qty,
        'bought_sku_count', bought_sku_count,
        'buy_qty', buy_qty,
        'dead_yellow_count', dead_yellow_count,
        'dead_orange_count', dead_orange_count,
        'dead_red_count', dead_red_count,
        'dead_total_count', dead_total_count,
        'dead_category_total', dead_category_total,
        'dead_stock_value', dead_stock_value,
        'dead_category_stock_value', dead_category_stock_value
      ) FROM summary),
      'stock_more', CASE WHEN NOT v_want_stock THEN '[]'::jsonb ELSE COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'bcode', sm.bcode,
          'detail', sm.detail,
          'category_code', sm.category_code,
          'category_name', sm.category_code,
          'code1', sm.code1,
          'code1_name', sm.code1,
          'sell_qty', sm.sell_qty,
          'sell_bills', sm.sell_bills,
          'sell_days', sm.sell_days,
          'buy_qty', sm.buy_qty,
          'buy_bills', sm.buy_bills,
          'on_hand_qty', sm.on_hand_qty,
          'last_sale_date', sm.last_sale_date,
          'last_purchase_date', sm.last_purchase_date
        ) ORDER BY sm.sell_qty DESC, sm.sell_bills DESC, sm.bcode)
        FROM stock_more sm
      ), '[]'::jsonb) END,
      'dead_stock', CASE WHEN NOT v_want_dead THEN '[]'::jsonb ELSE COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'bcode', dl.bcode,
          'detail', dl.detail,
          'category_code', dl.category_code,
          'category_name', dl.category_code,
          'code1', dl.code1,
          'code1_name', dl.code1,
          'on_hand_qty', dl.on_hand_qty,
          'unit_cost', dl.unit_cost,
          'stock_value', dl.stock_value,
          'last_purchase_date', dl.last_purchase_date,
          'last_sale_date', dl.last_sale_date,
          'days_since_purchase', dl.days_since_purchase,
          'days_since_sale', dl.days_since_sale,
          'no_move_since_purchase', dl.no_move_since_purchase,
          'dead_tier', dl.dead_tier,
          'sell_qty_period', dl.sell_qty_period,
          'buy_qty_period', dl.buy_qty_period
        ) ORDER BY
          CASE
            WHEN v_dead_sort = 'deep' THEN
              CASE dl.dead_tier
                WHEN 'red' THEN 1
                WHEN 'orange' THEN 2
                WHEN 'yellow' THEN 3
                ELSE 4
              END
            WHEN v_dead_sort = 'recent' THEN
              CASE dl.dead_tier
                WHEN 'yellow' THEN 1
                WHEN 'orange' THEN 2
                WHEN 'red' THEN 3
                ELSE 4
              END
            ELSE 0
          END,
          CASE WHEN v_dead_sort = 'deep' THEN dl.days_since_purchase END DESC NULLS LAST,
          CASE WHEN v_dead_sort = 'recent' THEN dl.days_since_purchase END ASC NULLS LAST,
          CASE WHEN v_dead_sort = 'value_desc' THEN dl.stock_value END DESC NULLS LAST,
          CASE WHEN v_dead_sort = 'value_asc' THEN dl.stock_value END ASC NULLS LAST,
          CASE WHEN v_dead_sort = 'qty_desc' THEN dl.on_hand_qty END DESC NULLS LAST,
          CASE WHEN v_dead_sort = 'cost_desc' THEN dl.unit_cost END DESC NULLS LAST,
          dl.bcode
        )
        FROM dead_list dl
      ), '[]'::jsonb) END
    )
  );
END;
$$;

COMMENT ON FUNCTION public.fn_bi_product_movement(date, date, text, integer, integer, integer, text, text, text, text) IS
  'Product movement BI; dead cost/value + sort modes; statement_timeout 60s; buys always HQ.';

GRANT EXECUTE ON FUNCTION public.fn_bi_product_movement(date, date, text, integer, integer, integer, text, text, text, text) TO service_role;\n\n-- >>> from docs/bi/sql/fn_bi_customer_overview.sql\n-- Customer BI overview: bill-grain net revenue ranked by bill ACCTNO (AR customer).
-- Blank ACCTNO excluded (walk-in / cash).
-- Display name: public.party → raw_kcw ARMAS → blank (only when both missing).
-- See docs/bi/kcw-sales-data-dictionary.md §6.9 / §8.7 and kcw-ar-ap-data-dictionary.md.

CREATE OR REPLACE FUNCTION public.fn_bi_customer_overview(
  p_from date,
  p_to date,
  p_branch text DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, curated_kcw, raw_kcw
AS $$
DECLARE
  v_result jsonb;
  v_prev_from date;
  v_prev_to date;
  v_span int;
  v_limit int;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'Invalid date range';
  END IF;

  IF p_branch IS NOT NULL AND p_branch NOT IN ('HQ', 'SYP', 'ONLINE') THEN
    RAISE EXCEPTION 'Invalid branch';
  END IF;

  v_limit := GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
  v_span := (p_to - p_from);
  v_prev_to := p_from - 1;
  v_prev_from := v_prev_to - v_span;

  WITH base AS (
    SELECT
      left(b."BILLDATE", 10)::date AS bill_date,
      CASE
        WHEN COALESCE(b."BILLTYPE_STD", '') = 'TAD' THEN 'ONLINE'
        WHEN COALESCE(b."BILLTYPE_STD", '') = 'CN'
          AND b."BILLNO" ~* '^CNTAD' THEN 'ONLINE'
        ELSE b."BRANCH"
      END AS reporting_branch,
      b."BILLNO" AS bill_no,
      nullif(btrim(COALESCE(b."ACCTNO"::text, '')), '') AS acctno,
      nullif(btrim(COALESCE(b."ACCTNAME"::text, '')), '') AS bill_acctname,
      COALESCE(NULLIF(replace(b."BEFORETAX", ',', ''), '')::numeric, 0) AS revenue_net
    FROM curated_kcw.fact_sales_bills_all b
    WHERE b."CANCELED" = 'N'
      AND b."JOURMODE" <> '0'
      AND COALESCE(b."BILLTYPE_STD", '') NOT IN ('TF', 'TFV', 'TAR')
      AND upper(btrim(b."BILLNO")) !~ '^(3)?SA'
      AND b."BILLDATE" >= p_from::text
      AND b."BILLDATE" < (p_to + 1)::text
  ),
  filtered AS (
    SELECT * FROM base
    WHERE p_branch IS NULL OR reporting_branch = p_branch
  ),
  ranked AS (
    SELECT * FROM filtered
    WHERE acctno IS NOT NULL
  ),
  walkin AS (
    SELECT * FROM filtered
    WHERE acctno IS NULL
  ),
  prev_base AS (
    SELECT
      CASE
        WHEN COALESCE(b."BILLTYPE_STD", '') = 'TAD' THEN 'ONLINE'
        WHEN COALESCE(b."BILLTYPE_STD", '') = 'CN'
          AND b."BILLNO" ~* '^CNTAD' THEN 'ONLINE'
        ELSE b."BRANCH"
      END AS reporting_branch,
      nullif(btrim(COALESCE(b."ACCTNO"::text, '')), '') AS acctno,
      COALESCE(NULLIF(replace(b."BEFORETAX", ',', ''), '')::numeric, 0) AS revenue_net
    FROM curated_kcw.fact_sales_bills_all b
    WHERE b."CANCELED" = 'N'
      AND b."JOURMODE" <> '0'
      AND COALESCE(b."BILLTYPE_STD", '') NOT IN ('TF', 'TFV', 'TAR')
      AND upper(btrim(b."BILLNO")) !~ '^(3)?SA'
      AND b."BILLDATE" >= v_prev_from::text
      AND b."BILLDATE" < (v_prev_to + 1)::text
  ),
  prev_ranked AS (
    SELECT *
    FROM prev_base
    WHERE acctno IS NOT NULL
      AND (p_branch IS NULL OR reporting_branch = p_branch)
  ),
  customer_agg AS (
    SELECT
      acctno,
      max(bill_acctname) AS bill_acctname,
      sum(revenue_net) AS revenue_net,
      count(*)::int AS bill_count,
      CASE WHEN count(*) > 0
        THEN sum(revenue_net) / count(*)
        ELSE 0
      END AS avg_bill,
      COALESCE(sum(revenue_net) FILTER (WHERE reporting_branch = 'HQ'), 0) AS hq_revenue_net,
      COALESCE(sum(revenue_net) FILTER (WHERE reporting_branch = 'SYP'), 0) AS syp_revenue_net,
      COALESCE(sum(revenue_net) FILTER (WHERE reporting_branch = 'ONLINE'), 0) AS online_revenue_net
    FROM ranked
    GROUP BY acctno
  ),
  armas AS (
    SELECT DISTINCT ON (nullif(btrim(COALESCE(a."ACCTNO"::text, '')), ''))
      nullif(btrim(COALESCE(a."ACCTNO"::text, '')), '') AS acctno,
      nullif(btrim(COALESCE(a."ACCTNAME"::text, '')), '') AS armas_name
    FROM raw_kcw.raw_hq_armas_receivable a
    WHERE nullif(btrim(COALESCE(a."ACCTNO"::text, '')), '') IS NOT NULL
      AND COALESCE(a."CANCELED", 'N') <> 'Y'
    ORDER BY
      nullif(btrim(COALESCE(a."ACCTNO"::text, '')), ''),
      CASE WHEN nullif(btrim(COALESCE(a."ACCTNAME"::text, '')), '') IS NOT NULL
        THEN 0 ELSE 1 END
  ),
  enriched AS (
    SELECT
      a.acctno,
      CASE
        WHEN nullif(btrim(COALESCE(p.party_name, '')), '') IS NOT NULL
          THEN btrim(p.party_name)
        WHEN nullif(btrim(COALESCE(ar.armas_name, '')), '') IS NOT NULL
          THEN btrim(ar.armas_name)
        ELSE NULL
      END AS customer_name,
      CASE
        WHEN nullif(btrim(COALESCE(p.party_name, '')), '') IS NOT NULL THEN 'party'
        WHEN nullif(btrim(COALESCE(ar.armas_name, '')), '') IS NOT NULL THEN 'armas'
        ELSE 'none'
      END AS name_source,
      a.bill_acctname,
      (p.party_code IS NOT NULL) AS in_party,
      (ar.acctno IS NOT NULL) AS in_armas,
      p.kind AS party_kind,
      a.revenue_net,
      a.bill_count,
      a.avg_bill,
      a.hq_revenue_net,
      a.syp_revenue_net,
      a.online_revenue_net
    FROM customer_agg a
    LEFT JOIN public.party p ON p.party_code = a.acctno
    LEFT JOIN armas ar ON ar.acctno = a.acctno
  ),
  summary AS (
    SELECT
      COALESCE(sum(revenue_net), 0) AS revenue_net,
      count(*)::int AS customer_count,
      COALESCE(sum(bill_count), 0)::int AS bill_count,
      CASE WHEN COALESCE(sum(bill_count), 0) > 0
        THEN COALESCE(sum(revenue_net), 0) / sum(bill_count)
        ELSE 0
      END AS avg_bill,
      count(*) FILTER (WHERE in_party)::int AS matched_customer_count,
      count(*) FILTER (WHERE NOT in_party)::int AS unmatched_customer_count
    FROM enriched
  ),
  walkin_summary AS (
    SELECT
      COALESCE(sum(revenue_net), 0) AS revenue_net,
      count(*)::int AS bill_count
    FROM walkin
  ),
  prev_summary AS (
    SELECT
      COALESCE(sum(revenue_net), 0) AS revenue_net,
      count(DISTINCT acctno)::int AS customer_count,
      count(*)::int AS bill_count
    FROM prev_ranked
  ),
  by_branch AS (
    SELECT
      reporting_branch AS key,
      sum(revenue_net) AS revenue_net,
      count(*)::int AS bill_count
    FROM ranked
    GROUP BY 1
  ),
  top_customers AS (
    SELECT *
    FROM enriched
    ORDER BY revenue_net DESC, bill_count DESC, acctno
    LIMIT v_limit
  ),
  unmatched_customers AS (
    SELECT *
    FROM enriched
    WHERE NOT in_party
    ORDER BY revenue_net DESC, bill_count DESC, acctno
  )
  SELECT jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'branch', p_branch,
    'limit', v_limit,
    'previous_from', v_prev_from,
    'previous_to', v_prev_to,
    'summary', (
      SELECT jsonb_build_object(
        'revenue_net', revenue_net,
        'customer_count', customer_count,
        'bill_count', bill_count,
        'avg_bill', avg_bill,
        'matched_customer_count', matched_customer_count,
        'unmatched_customer_count', unmatched_customer_count
      ) FROM summary
    ),
    'walkin_summary', (
      SELECT jsonb_build_object(
        'revenue_net', revenue_net,
        'bill_count', bill_count
      ) FROM walkin_summary
    ),
    'previous_summary', (
      SELECT jsonb_build_object(
        'revenue_net', revenue_net,
        'customer_count', customer_count,
        'bill_count', bill_count
      ) FROM prev_summary
    ),
    'by_branch', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', key,
        'revenue_net', revenue_net,
        'bill_count', bill_count
      ) ORDER BY key)
      FROM by_branch
    ), '[]'::jsonb),
    'top_customers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'acctno', acctno,
        'customer_name', customer_name,
        'name_source', name_source,
        'bill_acctname', bill_acctname,
        'in_party', in_party,
        'in_armas', in_armas,
        'party_kind', party_kind,
        'revenue_net', revenue_net,
        'bill_count', bill_count,
        'avg_bill', avg_bill,
        'hq_revenue_net', hq_revenue_net,
        'syp_revenue_net', syp_revenue_net,
        'online_revenue_net', online_revenue_net
      ) ORDER BY revenue_net DESC, bill_count DESC, acctno)
      FROM top_customers
    ), '[]'::jsonb),
    'unmatched_customers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'acctno', acctno,
        'customer_name', customer_name,
        'name_source', name_source,
        'bill_acctname', bill_acctname,
        'in_party', in_party,
        'in_armas', in_armas,
        'party_kind', party_kind,
        'revenue_net', revenue_net,
        'bill_count', bill_count,
        'avg_bill', avg_bill,
        'hq_revenue_net', hq_revenue_net,
        'syp_revenue_net', syp_revenue_net,
        'online_revenue_net', online_revenue_net
      ) ORDER BY revenue_net DESC, bill_count DESC, acctno)
      FROM unmatched_customers
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.fn_bi_customer_overview(date, date, text, integer) IS
  'Customer BI: bill BEFORETAX ranking by ACCTNO; name = party → ARMAS → blank; expose name_source.';

GRANT EXECUTE ON FUNCTION public.fn_bi_customer_overview(date, date, text, integer) TO service_role;\n\n-- >>> from docs/bi/sql/fn_bi_income_overview.sql\n-- Income BI overview: gross margin (line revenue − last-purchase COGS) − app opex.
-- See docs/bi/kcw-income-data-dictionary.md and sales dictionary §8.5 / §6.7.

CREATE OR REPLACE FUNCTION public.fn_bi_income_overview(
  p_from date,
  p_to date,
  p_branch text DEFAULT NULL,
  p_timezone text DEFAULT 'Asia/Bangkok'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, curated_kcw
AS $$
DECLARE
  v_result jsonb;
  v_prev_from date;
  v_prev_to date;
  v_span int;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'Invalid date range';
  END IF;

  IF p_branch IS NOT NULL AND p_branch NOT IN ('HQ', 'SYP', 'ONLINE') THEN
    RAISE EXCEPTION 'Invalid branch';
  END IF;

  v_span := (p_to - p_from);
  v_prev_to := p_from - 1;
  v_prev_from := v_prev_to - v_span;

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
      END AS reporting_branch,
      COALESCE(NULLIF(replace(b."AFTERTAX", ',', ''), '')::numeric, 0) AS aftertax
    FROM curated_kcw.fact_sales_bills_all b
    WHERE b."CANCELED" = 'N'
      AND b."JOURMODE" <> '0'
      AND COALESCE(b."BILLTYPE_STD", '') NOT IN ('TF', 'TFV', 'TAR')
      AND upper(btrim(b."BILLNO")) !~ '^(3)?SA'
      AND b."BILLDATE" >= p_from::text
      AND b."BILLDATE" < (p_to + 1)::text
  ),
  lines_raw AS (
    SELECT
      b.bill_date,
      b.reporting_branch,
      b.store_branch,
      b.bill_no,
      b.aftertax,
      l."ISVAT" AS isvat,
      l."TAXIC" AS taxic,
      COALESCE(
        NULLIF(replace(COALESCE(l."AMOUNT_NUM", l."AMOUNT"), ',', ''), '')::numeric,
        0
      ) AS amount_gross,
      COALESCE(NULLIF(replace(l."QTY", ',', ''), '')::numeric, 0)
        * COALESCE(
            NULLIF(
              COALESCE(NULLIF(replace(nullif(trim(l."MTP"), ''), ',', ''), '')::numeric, 0),
              0
            ),
            1
          ) AS qty_base,
      COALESCE(
        NULLIF(replace(nullif(btrim(l."LAST_PURCHASE_COST"), ''), ',', ''), '')::numeric,
        0
      ) AS unit_cost,
      CASE
        WHEN nullif(btrim(COALESCE(l."LAST_PURCHASE_COST", '')), '') IS NULL
          THEN 1
        ELSE 0
      END AS blank_cost_flag
    FROM curated_kcw.fact_sales_all l
    JOIN bills b
      ON b.store_branch = l."BRANCH"
     AND b.bill_no = l."BILLNO"
    WHERE l."IS_VALID" = 'True'
      AND l."CANCELED" = 'N'
      AND l."BILLDATE" >= p_from::text
      AND l."BILLDATE" < (p_to + 1)::text
  ),
  bill_line_sums AS (
    SELECT
      store_branch,
      bill_no,
      sum(amount_gross) AS line_gross_sum
    FROM lines_raw
    GROUP BY store_branch, bill_no
  ),
  sales_lines_all AS (
    SELECT
      r.bill_date,
      r.reporting_branch,
      r.store_branch,
      r.bill_no,
      r.blank_cost_flag,
      r.qty_base * r.unit_cost AS cogs,
      CASE
        WHEN r.isvat = 'Y' AND r.taxic = 'Y'
          THEN (
            r.amount_gross
            - CASE
                WHEN COALESCE(s.line_gross_sum, 0) = 0 THEN 0
                ELSE (s.line_gross_sum - r.aftertax) * (r.amount_gross / s.line_gross_sum)
              END
          ) / 1.07
        ELSE
          r.amount_gross
          - CASE
              WHEN COALESCE(s.line_gross_sum, 0) = 0 THEN 0
              ELSE (s.line_gross_sum - r.aftertax) * (r.amount_gross / s.line_gross_sum)
            END
      END AS revenue_net
    FROM lines_raw r
    JOIN bill_line_sums s
      ON s.store_branch = r.store_branch
     AND s.bill_no = r.bill_no
    WHERE p_branch IS NULL OR r.reporting_branch = p_branch
  ),
  -- Blank LAST_PURCHASE_COST lines are listed for drilldown but excluded from margin math
  sales_lines AS (
    SELECT *
    FROM sales_lines_all
    WHERE blank_cost_flag = 0
  ),
  blank_cost_summary AS (
    SELECT COALESCE(sum(blank_cost_flag), 0)::int AS blank_cost_line_count
    FROM sales_lines_all
  ),
  prev_bills AS (
    SELECT
      b."BRANCH" AS store_branch,
      b."BILLNO" AS bill_no,
      CASE
        WHEN COALESCE(b."BILLTYPE_STD", '') = 'TAD' THEN 'ONLINE'
        WHEN COALESCE(b."BILLTYPE_STD", '') = 'CN'
          AND b."BILLNO" ~* '^CNTAD' THEN 'ONLINE'
        ELSE b."BRANCH"
      END AS reporting_branch,
      COALESCE(NULLIF(replace(b."AFTERTAX", ',', ''), '')::numeric, 0) AS aftertax
    FROM curated_kcw.fact_sales_bills_all b
    WHERE b."CANCELED" = 'N'
      AND b."JOURMODE" <> '0'
      AND COALESCE(b."BILLTYPE_STD", '') NOT IN ('TF', 'TFV', 'TAR')
      AND upper(btrim(b."BILLNO")) !~ '^(3)?SA'
      AND b."BILLDATE" >= v_prev_from::text
      AND b."BILLDATE" < (v_prev_to + 1)::text
  ),
  prev_lines_raw AS (
    SELECT
      b.reporting_branch,
      b.store_branch,
      b.bill_no,
      b.aftertax,
      l."ISVAT" AS isvat,
      l."TAXIC" AS taxic,
      COALESCE(
        NULLIF(replace(COALESCE(l."AMOUNT_NUM", l."AMOUNT"), ',', ''), '')::numeric,
        0
      ) AS amount_gross,
      COALESCE(NULLIF(replace(l."QTY", ',', ''), '')::numeric, 0)
        * COALESCE(
            NULLIF(
              COALESCE(NULLIF(replace(nullif(trim(l."MTP"), ''), ',', ''), '')::numeric, 0),
              0
            ),
            1
          ) AS qty_base,
      COALESCE(
        NULLIF(replace(nullif(btrim(l."LAST_PURCHASE_COST"), ''), ',', ''), '')::numeric,
        0
      ) AS unit_cost,
      CASE
        WHEN nullif(btrim(COALESCE(l."LAST_PURCHASE_COST", '')), '') IS NULL
          THEN 1
        ELSE 0
      END AS blank_cost_flag
    FROM curated_kcw.fact_sales_all l
    JOIN prev_bills b
      ON b.store_branch = l."BRANCH"
     AND b.bill_no = l."BILLNO"
    WHERE l."IS_VALID" = 'True'
      AND l."CANCELED" = 'N'
      AND l."BILLDATE" >= v_prev_from::text
      AND l."BILLDATE" < (v_prev_to + 1)::text
  ),
  prev_bill_line_sums AS (
    SELECT store_branch, bill_no, sum(amount_gross) AS line_gross_sum
    FROM prev_lines_raw
    GROUP BY store_branch, bill_no
  ),
  prev_sales_lines AS (
    SELECT
      CASE
        WHEN r.isvat = 'Y' AND r.taxic = 'Y'
          THEN (
            r.amount_gross
            - CASE
                WHEN COALESCE(s.line_gross_sum, 0) = 0 THEN 0
                ELSE (s.line_gross_sum - r.aftertax) * (r.amount_gross / s.line_gross_sum)
              END
          ) / 1.07
        ELSE
          r.amount_gross
          - CASE
              WHEN COALESCE(s.line_gross_sum, 0) = 0 THEN 0
              ELSE (s.line_gross_sum - r.aftertax) * (r.amount_gross / s.line_gross_sum)
            END
      END AS revenue_net,
      r.qty_base * r.unit_cost AS cogs
    FROM prev_lines_raw r
    JOIN prev_bill_line_sums s
      ON s.store_branch = r.store_branch
     AND s.bill_no = r.bill_no
    WHERE (p_branch IS NULL OR r.reporting_branch = p_branch)
      AND r.blank_cost_flag = 0
  ),
  entry_base AS (
    SELECT
      e.entry_uuid,
      e.item_uuid,
      i.item_name,
      c.category_uuid,
      c.category_name,
      r.receipt_uuid,
      r.branch_uuid,
      br.branch_name,
      (r.receipt_date AT TIME ZONE p_timezone)::date AS expense_date,
      CASE WHEN COALESCE(r.signed_total, 0) < 0 THEN -1.0 ELSE 1.0 END AS sign_factor,
      GREATEST((e.entry_amount - e.discount), 0)::double precision AS entry_net,
      r.discount AS receipt_discount,
      (1 + ((r.vat - r.withholding) / 100.0))::double precision AS factor
    FROM public.expense_entry e
    JOIN public.expense_receipt r ON r.receipt_uuid = e.receipt_uuid
    JOIN public.expense_item i ON i.item_uuid = e.item_uuid
    JOIN public.expense_category c ON c.category_uuid = i.category_uuid
    JOIN public.branch br ON br.branch_uuid = r.branch_uuid
    WHERE (r.receipt_date AT TIME ZONE p_timezone)::date >= p_from
      AND (r.receipt_date AT TIME ZONE p_timezone)::date <= p_to
  ),
  entry_shares AS (
    SELECT
      entry_uuid,
      item_uuid,
      item_name,
      category_uuid,
      category_name,
      receipt_uuid,
      branch_uuid,
      branch_name,
      expense_date,
      sign_factor,
      entry_net,
      SUM(entry_net) OVER (PARTITION BY receipt_uuid) AS receipt_net_sum,
      receipt_discount,
      factor
    FROM entry_base
  ),
  entries_effective AS (
    SELECT
      expense_date,
      category_uuid,
      category_name,
      CASE
        WHEN btrim(category_name) = 'ออนไลน์' AND branch_name = 'สำนักงานใหญ่'
          THEN 'ONLINE'
        WHEN branch_name = 'สี่แยกพัฒนา' THEN 'SYP'
        WHEN branch_name = 'สำนักงานใหญ่' THEN 'HQ'
        ELSE 'OTHER'
      END AS reporting_branch,
      CASE
        WHEN receipt_net_sum > 0
          THEN sign_factor
            * (entry_net - (entry_net / receipt_net_sum) * receipt_discount)
            * factor
        ELSE 0
      END AS amount
    FROM entry_shares
  ),
  general_effective AS (
    SELECT
      (g.entry_date AT TIME ZONE p_timezone)::date AS expense_date,
      c.category_uuid,
      c.category_name,
      CASE
        WHEN btrim(c.category_name) = 'ออนไลน์' AND br.branch_name = 'สำนักงานใหญ่'
          THEN 'ONLINE'
        WHEN br.branch_name = 'สี่แยกพัฒนา' THEN 'SYP'
        WHEN br.branch_name = 'สำนักงานใหญ่' THEN 'HQ'
        ELSE 'OTHER'
      END AS reporting_branch,
      (g.unit_price * g.quantity)::double precision AS amount
    FROM public.expense_general g
    JOIN public.expense_item i ON i.item_uuid = g.item_uuid
    JOIN public.expense_category c ON c.category_uuid = i.category_uuid
    JOIN public.branch br ON br.branch_uuid = g.branch_uuid
    WHERE (g.entry_date AT TIME ZONE p_timezone)::date >= p_from
      AND (g.entry_date AT TIME ZONE p_timezone)::date <= p_to
  ),
  opex_rows AS (
    SELECT * FROM entries_effective
    UNION ALL
    SELECT * FROM general_effective
  ),
  opex_filtered AS (
    SELECT *
    FROM opex_rows
    WHERE p_branch IS NULL OR reporting_branch = p_branch
  ),
  prev_entry_base AS (
    SELECT
      e.entry_uuid,
      c.category_name,
      r.receipt_uuid,
      br.branch_name,
      CASE WHEN COALESCE(r.signed_total, 0) < 0 THEN -1.0 ELSE 1.0 END AS sign_factor,
      GREATEST((e.entry_amount - e.discount), 0)::double precision AS entry_net,
      r.discount AS receipt_discount,
      (1 + ((r.vat - r.withholding) / 100.0))::double precision AS factor
    FROM public.expense_entry e
    JOIN public.expense_receipt r ON r.receipt_uuid = e.receipt_uuid
    JOIN public.expense_item i ON i.item_uuid = e.item_uuid
    JOIN public.expense_category c ON c.category_uuid = i.category_uuid
    JOIN public.branch br ON br.branch_uuid = r.branch_uuid
    WHERE (r.receipt_date AT TIME ZONE p_timezone)::date >= v_prev_from
      AND (r.receipt_date AT TIME ZONE p_timezone)::date <= v_prev_to
  ),
  prev_entry_shares AS (
    SELECT
      entry_uuid,
      category_name,
      branch_name,
      sign_factor,
      entry_net,
      SUM(entry_net) OVER (PARTITION BY receipt_uuid) AS receipt_net_sum,
      receipt_discount,
      factor
    FROM prev_entry_base
  ),
  prev_entries_effective AS (
    SELECT
      CASE
        WHEN btrim(category_name) = 'ออนไลน์' AND branch_name = 'สำนักงานใหญ่'
          THEN 'ONLINE'
        WHEN branch_name = 'สี่แยกพัฒนา' THEN 'SYP'
        WHEN branch_name = 'สำนักงานใหญ่' THEN 'HQ'
        ELSE 'OTHER'
      END AS reporting_branch,
      CASE
        WHEN receipt_net_sum > 0
          THEN sign_factor
            * (entry_net - (entry_net / receipt_net_sum) * receipt_discount)
            * factor
        ELSE 0
      END AS amount
    FROM prev_entry_shares
  ),
  prev_general_effective AS (
    SELECT
      CASE
        WHEN btrim(c.category_name) = 'ออนไลน์' AND br.branch_name = 'สำนักงานใหญ่'
          THEN 'ONLINE'
        WHEN br.branch_name = 'สี่แยกพัฒนา' THEN 'SYP'
        WHEN br.branch_name = 'สำนักงานใหญ่' THEN 'HQ'
        ELSE 'OTHER'
      END AS reporting_branch,
      (g.unit_price * g.quantity)::double precision AS amount
    FROM public.expense_general g
    JOIN public.expense_item i ON i.item_uuid = g.item_uuid
    JOIN public.expense_category c ON c.category_uuid = i.category_uuid
    JOIN public.branch br ON br.branch_uuid = g.branch_uuid
    WHERE (g.entry_date AT TIME ZONE p_timezone)::date >= v_prev_from
      AND (g.entry_date AT TIME ZONE p_timezone)::date <= v_prev_to
  ),
  prev_opex_filtered AS (
    SELECT reporting_branch, amount
    FROM (
      SELECT * FROM prev_entries_effective
      UNION ALL
      SELECT * FROM prev_general_effective
    ) x
    WHERE p_branch IS NULL OR reporting_branch = p_branch
  ),
  sales_summary AS (
    SELECT
      COALESCE((SELECT sum(revenue_net) FROM sales_lines), 0) AS revenue_net,
      COALESCE((SELECT sum(cogs) FROM sales_lines), 0) AS cogs,
      COALESCE((SELECT count(*)::int FROM sales_lines), 0) AS line_count,
      COALESCE(
        (SELECT count(DISTINCT (store_branch, bill_no))::int FROM sales_lines),
        0
      ) AS bill_count,
      (SELECT blank_cost_line_count FROM blank_cost_summary) AS blank_cost_line_count
  ),
  opex_summary AS (
    SELECT COALESCE(sum(amount), 0)::numeric AS opex
    FROM opex_filtered
  ),
  prev_sales_summary AS (
    SELECT
      COALESCE(sum(revenue_net), 0) AS revenue_net,
      COALESCE(sum(cogs), 0) AS cogs
    FROM prev_sales_lines
  ),
  prev_opex_summary AS (
    SELECT COALESCE(sum(amount), 0)::numeric AS opex
    FROM prev_opex_filtered
  ),
  sales_by_branch AS (
    SELECT
      reporting_branch AS key,
      sum(revenue_net) AS revenue_net,
      sum(cogs) AS cogs,
      count(DISTINCT (store_branch, bill_no))::int AS bill_count
    FROM sales_lines
    GROUP BY reporting_branch
  ),
  opex_by_branch AS (
    SELECT
      reporting_branch AS key,
      sum(amount)::numeric AS opex
    FROM opex_filtered
    GROUP BY reporting_branch
  ),
  branch_keys AS (
    SELECT key FROM sales_by_branch
    UNION
    SELECT key FROM opex_by_branch
  ),
  by_branch AS (
    SELECT
      k.key,
      COALESCE(s.revenue_net, 0) AS revenue_net,
      COALESCE(s.cogs, 0) AS cogs,
      COALESCE(s.revenue_net, 0) - COALESCE(s.cogs, 0) AS gross_profit,
      COALESCE(o.opex, 0) AS opex,
      (COALESCE(s.revenue_net, 0) - COALESCE(s.cogs, 0)) - COALESCE(o.opex, 0) AS net_income,
      COALESCE(s.bill_count, 0) AS bill_count
    FROM branch_keys k
    LEFT JOIN sales_by_branch s ON s.key = k.key
    LEFT JOIN opex_by_branch o ON o.key = k.key
  ),
  opex_by_category AS (
    SELECT
      category_uuid::text AS key,
      max(btrim(category_name)) AS label,
      sum(amount)::numeric AS amount
    FROM opex_filtered
    GROUP BY category_uuid
  ),
  sales_daily AS (
    SELECT
      bill_date::text AS period,
      sum(revenue_net) AS revenue_net,
      sum(cogs) AS cogs
    FROM sales_lines
    GROUP BY bill_date
  ),
  opex_daily AS (
    SELECT
      expense_date::text AS period,
      sum(amount)::numeric AS opex
    FROM opex_filtered
    GROUP BY expense_date
  ),
  daily_keys AS (
    SELECT period FROM sales_daily
    UNION
    SELECT period FROM opex_daily
  ),
  trend_daily AS (
    SELECT
      k.period,
      COALESCE(s.revenue_net, 0) AS revenue_net,
      COALESCE(s.cogs, 0) AS cogs,
      COALESCE(s.revenue_net, 0) - COALESCE(s.cogs, 0) AS gross_profit,
      COALESCE(o.opex, 0) AS opex,
      (COALESCE(s.revenue_net, 0) - COALESCE(s.cogs, 0)) - COALESCE(o.opex, 0) AS net_income
    FROM daily_keys k
    LEFT JOIN sales_daily s ON s.period = k.period
    LEFT JOIN opex_daily o ON o.period = k.period
  ),
  sales_monthly AS (
    SELECT
      to_char(date_trunc('month', bill_date), 'YYYY-MM') AS period,
      sum(revenue_net) AS revenue_net,
      sum(cogs) AS cogs
    FROM sales_lines
    GROUP BY 1
  ),
  opex_monthly AS (
    SELECT
      to_char(date_trunc('month', expense_date), 'YYYY-MM') AS period,
      sum(amount)::numeric AS opex
    FROM opex_filtered
    GROUP BY 1
  ),
  monthly_keys AS (
    SELECT period FROM sales_monthly
    UNION
    SELECT period FROM opex_monthly
  ),
  trend_monthly AS (
    SELECT
      k.period,
      COALESCE(s.revenue_net, 0) AS revenue_net,
      COALESCE(s.cogs, 0) AS cogs,
      COALESCE(s.revenue_net, 0) - COALESCE(s.cogs, 0) AS gross_profit,
      COALESCE(o.opex, 0) AS opex,
      (COALESCE(s.revenue_net, 0) - COALESCE(s.cogs, 0)) - COALESCE(o.opex, 0) AS net_income
    FROM monthly_keys k
    LEFT JOIN sales_monthly s ON s.period = k.period
    LEFT JOIN opex_monthly o ON o.period = k.period
  )
  SELECT jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'branch', p_branch,
    'previous_from', v_prev_from,
    'previous_to', v_prev_to,
    'summary', (
      SELECT jsonb_build_object(
        'revenue_net', ss.revenue_net,
        'cogs', ss.cogs,
        'gross_profit', ss.revenue_net - ss.cogs,
        'gross_margin_pct', CASE
          WHEN ss.revenue_net = 0 THEN NULL
          ELSE ((ss.revenue_net - ss.cogs) / ss.revenue_net) * 100
        END,
        'opex', os.opex,
        'net_income', (ss.revenue_net - ss.cogs) - os.opex,
        'net_margin_pct', CASE
          WHEN ss.revenue_net = 0 THEN NULL
          ELSE (((ss.revenue_net - ss.cogs) - os.opex) / ss.revenue_net) * 100
        END,
        'bill_count', ss.bill_count,
        'line_count', ss.line_count,
        'blank_cost_line_count', ss.blank_cost_line_count
      )
      FROM sales_summary ss
      CROSS JOIN opex_summary os
    ),
    'previous_summary', (
      SELECT jsonb_build_object(
        'revenue_net', ps.revenue_net,
        'cogs', ps.cogs,
        'gross_profit', ps.revenue_net - ps.cogs,
        'gross_margin_pct', CASE
          WHEN ps.revenue_net = 0 THEN NULL
          ELSE ((ps.revenue_net - ps.cogs) / ps.revenue_net) * 100
        END,
        'opex', po.opex,
        'net_income', (ps.revenue_net - ps.cogs) - po.opex,
        'net_margin_pct', CASE
          WHEN ps.revenue_net = 0 THEN NULL
          ELSE (((ps.revenue_net - ps.cogs) - po.opex) / ps.revenue_net) * 100
        END
      )
      FROM prev_sales_summary ps
      CROSS JOIN prev_opex_summary po
    ),
    'by_branch', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', key,
        'revenue_net', revenue_net,
        'cogs', cogs,
        'gross_profit', gross_profit,
        'opex', opex,
        'net_income', net_income,
        'bill_count', bill_count
      ) ORDER BY key)
      FROM by_branch
    ), '[]'::jsonb),
    'opex_by_category', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', key,
        'label', label,
        'amount', amount
      ) ORDER BY amount DESC)
      FROM opex_by_category
    ), '[]'::jsonb),
    'trend_daily', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'period', period,
        'revenue_net', revenue_net,
        'cogs', cogs,
        'gross_profit', gross_profit,
        'opex', opex,
        'net_income', net_income
      ) ORDER BY period)
      FROM trend_daily
    ), '[]'::jsonb),
    'trend_monthly', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'period', period,
        'revenue_net', revenue_net,
        'cogs', cogs,
        'gross_profit', gross_profit,
        'opex', opex,
        'net_income', net_income
      ) ORDER BY period)
      FROM trend_monthly
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.fn_bi_income_overview(date, date, text, text) IS
  'Income BI: margin on lines with LAST_PURCHASE_COST only; blank-cost lines excluded from totals but counted for drilldown; − app opex; HQ ออนไลน์→ONLINE.';

GRANT EXECUTE ON FUNCTION public.fn_bi_income_overview(date, date, text, text) TO service_role;\n\n-- >>> from docs/bi/sql/fn_bi_income_blank_costs.sql\n-- Blank LAST_PURCHASE_COST lines for income BI drilldown.
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
        AND upper(btrim(b."BILLNO")) !~ '^(3)?SA'
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

GRANT EXECUTE ON FUNCTION public.fn_bi_income_blank_costs(date, date, text, integer) TO service_role;\n\n-- >>> from docs/bi/sql/fn_stock_audit_ops.sql\n-- Stock date-audit tracking for kcw-v2.
-- Domain tables live in schema `stock` (same pattern as bank / kb / ops),
-- not public. RPCs stay in public as service_role SECURITY DEFINER entrypoints.
--
-- App marks are the source of truth for "last audited".
-- POS ICMAS DATEAUDIT is stale/unreliable — shown as reference only, NOT used
-- for status buckets or pick priority.
--
-- Smart pick balances: never/stale app-audit + current-period sales velocity
-- (+ light on-hand qty), clustered by LOCATION1.

create schema if not exists stock;

revoke all on schema stock from public, anon, authenticated;
grant usage on schema stock to service_role;

-- Drop v1 public tables if they exist (empty / agent smoke data only).
drop table if exists public.stock_audit_batch_item cascade;
drop table if exists public.stock_audit_batch cascade;
drop table if exists public.stock_audit_event cascade;
drop table if exists public.stock_audit_status cascade;

create table if not exists stock.audit_status (
  branch text not null,
  bcode text not null,
  last_audited_at timestamptz not null,
  last_audited_by text not null,
  audit_count integer not null default 1,
  notes text,
  updated_at timestamptz not null default now(),
  constraint stock_audit_status_pkey primary key (branch, bcode),
  constraint stock_audit_status_branch_check check (branch in ('HQ', 'SYP')),
  constraint stock_audit_status_bcode_check check (bcode <> ''),
  constraint stock_audit_status_audit_count_check check (audit_count >= 1)
);

create table if not exists stock.audit_event (
  id bigserial primary key,
  branch text not null,
  bcode text not null,
  audited_at timestamptz not null default now(),
  audited_by text not null,
  source text not null,
  batch_id uuid,
  notes text,
  constraint stock_audit_event_branch_check check (branch in ('HQ', 'SYP')),
  constraint stock_audit_event_bcode_check check (bcode <> ''),
  constraint stock_audit_event_source_check
    check (source in ('batch', 'ondemand', 'manual'))
);

create table if not exists stock.audit_batch (
  id uuid primary key default gen_random_uuid(),
  branch text not null,
  created_at timestamptz not null default now(),
  created_by text not null,
  target_count integer not null,
  status text not null default 'open',
  filters jsonb not null default '{}'::jsonb,
  closed_at timestamptz,
  constraint stock_audit_batch_branch_check check (branch in ('HQ', 'SYP')),
  constraint stock_audit_batch_status_check check (status in ('open', 'closed')),
  constraint stock_audit_batch_target_count_check
    check (target_count >= 1 and target_count <= 500)
);

create table if not exists stock.audit_batch_item (
  batch_id uuid not null references stock.audit_batch (id) on delete cascade,
  bcode text not null,
  status text not null default 'pending',
  priority_score numeric not null default 0,
  pos_dateaudit date,
  app_dateaudit date,
  location1 text,
  descr text,
  qty numeric not null default 0,
  sell_qty_period numeric not null default 0,
  sell_revenue_period numeric not null default 0,
  done_at timestamptz,
  done_by text,
  constraint stock_audit_batch_item_pkey primary key (batch_id, bcode),
  constraint stock_audit_batch_item_status_check
    check (status in ('pending', 'done', 'skipped')),
  constraint stock_audit_batch_item_bcode_check check (bcode <> '')
);

create index if not exists stock_audit_status_last_audited_idx
  on stock.audit_status (branch, last_audited_at desc);

create index if not exists stock_audit_event_branch_bcode_idx
  on stock.audit_event (branch, bcode, audited_at desc);

create index if not exists stock_audit_batch_open_idx
  on stock.audit_batch (branch, created_at desc)
  where status = 'open';

create index if not exists stock_audit_batch_item_pending_idx
  on stock.audit_batch_item (batch_id, status)
  where status = 'pending';

alter table stock.audit_status enable row level security;
alter table stock.audit_event enable row level security;
alter table stock.audit_batch enable row level security;
alter table stock.audit_batch_item enable row level security;

revoke all on table stock.audit_status from public, anon, authenticated;
revoke all on table stock.audit_event from public, anon, authenticated;
revoke all on table stock.audit_batch from public, anon, authenticated;
revoke all on table stock.audit_batch_item from public, anon, authenticated;

grant select, insert, update, delete on table stock.audit_status to service_role;
grant select, insert, update, delete on table stock.audit_event to service_role;
grant select, insert, update, delete on table stock.audit_batch to service_role;
grant select, insert, update, delete on table stock.audit_batch_item to service_role;
grant usage, select on sequence stock.audit_event_id_seq to service_role;

comment on schema stock is
  'Stock / inventory ops owned by kcw-v2 (date-audit, future cycle-count helpers).';
comment on table stock.audit_status is
  'Latest app-recorded stock audit per branch+bcode. POS DATEAUDIT is not authoritative.';
comment on table stock.audit_event is
  'Append-only audit mark history.';
comment on table stock.audit_batch is
  'Daily / on-demand work set of bcodes for operators to audit.';
comment on table stock.audit_batch_item is
  'Items inside a stock audit batch (includes period sales snapshot used for ranking).';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public._stock_audit_parse_date(p_text text)
returns date
language sql
immutable
as $$
  select case
    when nullif(btrim(coalesce(p_text, '')), '') is null then null
    when btrim(p_text) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then btrim(p_text)::date
    else null
  end;
$$;

create or replace function public._stock_audit_parse_qty(p_text text)
returns numeric
language sql
immutable
as $$
  select coalesce(
    nullif(regexp_replace(coalesce(btrim(p_text), ''), '[^0-9.-]', '', 'g'), '')::numeric,
    0
  );
$$;

create or replace function public._stock_audit_is_canceled(p_canceled text)
returns boolean
language sql
immutable
as $$
  select coalesce(upper(btrim(coalesce(p_canceled, ''))), 'N') in ('Y', '1', 'T', 'TRUE');
$$;

-- Bangkok "today" and default sales window (last 30 days inclusive).
create or replace function public._stock_audit_bangkok_today()
returns date
language sql
stable
as $$
  select (timezone('Asia/Bangkok', now()))::date;
$$;

-- ---------------------------------------------------------------------------
-- Overview: buckets from APP audit only; POS date is reference on each row
-- ---------------------------------------------------------------------------

drop function if exists public.fn_stock_audit_overview(text, boolean);
drop function if exists public.fn_stock_audit_overview(text, boolean, text, integer, integer);

create or replace function public.fn_stock_audit_overview(
  p_branch text default 'HQ',
  p_with_stock_only boolean default true,
  p_bucket text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, stock, raw_kcw, curated_kcw
set statement_timeout = '60s'
as $$
declare
  v_branch text;
  v_bucket text;
  v_limit int;
  v_offset int;
  v_today date := public._stock_audit_bangkok_today();
  v_sales_from date;
begin
  v_branch := upper(coalesce(nullif(btrim(p_branch), ''), 'HQ'));
  if v_branch not in ('HQ', 'SYP') then
    raise exception 'Invalid branch';
  end if;

  v_bucket := lower(nullif(btrim(coalesce(p_bucket, '')), ''));
  if v_bucket is not null and v_bucket not in (
    'never', 'd30', 'd90', 'd180', 'd365', 'over_365'
  ) then
    raise exception 'Invalid bucket';
  end if;

  v_limit := greatest(1, least(coalesce(p_limit, 50), 200));
  v_offset := greatest(0, coalesce(p_offset, 0));
  v_sales_from := v_today - 29;

  return (
    with icmas as (
      select
        nullif(btrim(p."BCODE"), '') as bcode,
        coalesce(nullif(btrim(p."DESCR"), ''), '') as descr,
        coalesce(nullif(btrim(p."BRAND"), ''), '') as brand,
        coalesce(nullif(btrim(p."MODEL"), ''), '') as model,
        coalesce(nullif(btrim(p."LOCATION1"), ''), '') as location1,
        lpad(left(nullif(btrim(p."BCODE"), ''), 2), 2, '0') as category,
        public._stock_audit_parse_date(p."DATEAUDIT") as pos_dateaudit,
        public._stock_audit_parse_qty(p."QTYOH2") as qty_icmas
      from raw_kcw.raw_hq_icmas_products p
      where v_branch = 'HQ'
        and not public._stock_audit_is_canceled(p."CANCELED")
        and nullif(btrim(p."BCODE"), '') is not null
      union all
      select
        nullif(btrim(p."BCODE"), '') as bcode,
        coalesce(nullif(btrim(p."DESCR"), ''), '') as descr,
        coalesce(nullif(btrim(p."BRAND"), ''), '') as brand,
        coalesce(nullif(btrim(p."MODEL"), ''), '') as model,
        coalesce(nullif(btrim(p."LOCATION1"), ''), '') as location1,
        lpad(left(nullif(btrim(p."BCODE"), ''), 2), 2, '0') as category,
        public._stock_audit_parse_date(p."DATEAUDIT") as pos_dateaudit,
        public._stock_audit_parse_qty(p."QTYOH2") as qty_icmas
      from raw_kcw.raw_syp_icmas_products p
      where v_branch = 'SYP'
        and not public._stock_audit_is_canceled(p."CANCELED")
        and nullif(btrim(p."BCODE"), '') is not null
    ),
    inv as (
      select
        nullif(btrim(i.bcode), '') as bcode,
        coalesce(i.qty, 0)::numeric as qty
      from curated_kcw.inventory_qty_latest i
      where i.branch = v_branch
    ),
    sales_bills as (
      select
        b."BRANCH" as store_branch,
        b."BILLNO" as bill_no,
        case
          when coalesce(b."BILLTYPE_STD", '') = 'TAD' then 'ONLINE'
          when coalesce(b."BILLTYPE_STD", '') = 'CN'
            and b."BILLNO" ~* '^CNTAD' then 'ONLINE'
          else b."BRANCH"
        end as reporting_branch
      from curated_kcw.fact_sales_bills_all b
      where b."CANCELED" = 'N'
        and b."JOURMODE" <> '0'
        and coalesce(b."BILLTYPE_STD", '') not in ('TF', 'TFV', 'TAR')
        and upper(btrim(b."BILLNO")) !~ '^(3)?SA'
        and b."BILLDATE" >= v_sales_from::text
        and b."BILLDATE" < (v_today + 1)::text
    ),
    sales_period as (
      select
        nullif(btrim(l."BCODE"), '') as bcode,
        sum(
          coalesce(nullif(replace(l."QTY", ',', ''), '')::numeric, 0)
          * coalesce(
              nullif(
                coalesce(nullif(replace(nullif(trim(l."MTP"), ''), ',', ''), '')::numeric, 0),
                0
              ),
              1
            )
        ) as sell_qty,
        sum(coalesce(nullif(replace(l."AMOUNT", ',', ''), '')::numeric, 0)) as sell_revenue
      from curated_kcw.fact_sales_all l
      join sales_bills b
        on b.store_branch = l."BRANCH"
       and b.bill_no = l."BILLNO"
      where nullif(btrim(l."BCODE"), '') is not null
        and (
          v_branch = 'HQ' and b.reporting_branch in ('HQ', 'ONLINE')
          or v_branch = 'SYP' and b.reporting_branch = 'SYP'
        )
      group by 1
    ),
    joined as (
      select
        c.bcode,
        c.descr,
        c.brand,
        c.model,
        c.location1,
        c.category,
        c.pos_dateaudit,
        coalesce(i.qty, c.qty_icmas, 0) as qty,
        coalesce(sp.sell_qty, 0) as sell_qty_period,
        coalesce(sp.sell_revenue, 0) as sell_revenue_period,
        s.last_audited_at as app_audited_at,
        (s.last_audited_at at time zone 'Asia/Bangkok')::date as app_dateaudit,
        -- App-only effective date (POS is not trusted for status)
        (s.last_audited_at at time zone 'Asia/Bangkok')::date as effective_date
      from icmas c
      left join inv i on i.bcode = c.bcode
      left join sales_period sp on sp.bcode = c.bcode
      left join stock.audit_status s
        on s.branch = v_branch and s.bcode = c.bcode
    ),
    filtered as (
      select *
      from joined
      where not coalesce(p_with_stock_only, true) or qty > 0
    ),
    bucketed as (
      select
        f.*,
        case
          when f.effective_date is null then 'never'
          when f.effective_date >= (v_today - 30) then 'd30'
          when f.effective_date >= (v_today - 90) then 'd90'
          when f.effective_date >= (v_today - 180) then 'd180'
          when f.effective_date >= (v_today - 365) then 'd365'
          else 'over_365'
        end as bucket,
        case
          when f.effective_date is null then null
          else (v_today - f.effective_date)
        end as days_since
      from filtered f
    ),
    summary as (
      select
        count(*)::int as total,
        count(*) filter (where bucket = 'never')::int as never_count,
        count(*) filter (where bucket = 'd30')::int as d30_count,
        count(*) filter (where bucket = 'd90')::int as d90_count,
        count(*) filter (where bucket = 'd180')::int as d180_count,
        count(*) filter (where bucket = 'd365')::int as d365_count,
        count(*) filter (where bucket = 'over_365')::int as over_365_count,
        count(*) filter (where app_audited_at is not null)::int as app_marked_count,
        count(*) filter (
          where app_audited_at is not null
            and (app_audited_at at time zone 'Asia/Bangkok')::date = v_today
        )::int as marked_today_count,
        count(*) filter (
          where app_audited_at is not null
            and (app_audited_at at time zone 'Asia/Bangkok')::date >= (v_today - 6)
        )::int as marked_week_count
      from bucketed
    ),
    day_series as (
      select generate_series(v_today - 13, v_today, interval '1 day')::date as d
    ),
    daily_marks as (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'date', ds.d,
            'count', coalesce(e.n, 0)
          )
          order by ds.d
        ),
        '[]'::jsonb
      ) as series
      from day_series ds
      left join (
        select
          (audited_at at time zone 'Asia/Bangkok')::date as d,
          count(*)::int as n
        from stock.audit_event
        where branch = v_branch
          and (audited_at at time zone 'Asia/Bangkok')::date >= (v_today - 13)
        group by 1
      ) e on e.d = ds.d
    ),
    operator_marks as (
      select coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'name', x.name,
              'today_count', x.today_count,
              'week_count', x.week_count
            )
            order by x.today_count desc, x.week_count desc, x.name
          )
          from (
            select
              coalesce(
                nullif(btrim(split_part(audited_by, '|', 1)), ''),
                audited_by
              ) as name,
              count(*) filter (
                where (audited_at at time zone 'Asia/Bangkok')::date = v_today
              )::int as today_count,
              count(*)::int as week_count
            from stock.audit_event
            where branch = v_branch
              and (audited_at at time zone 'Asia/Bangkok')::date >= (v_today - 6)
            group by 1
          ) x
        ),
        '[]'::jsonb
      ) as series
    ),
    open_batches as (
      select
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', b.id,
              'created_at', b.created_at,
              'created_by', b.created_by,
              'target_count', b.target_count,
              'pending_count', (
                select count(*)::int
                from stock.audit_batch_item i
                where i.batch_id = b.id and i.status = 'pending'
              ),
              'done_count', (
                select count(*)::int
                from stock.audit_batch_item i
                where i.batch_id = b.id and i.status = 'done'
              )
            )
            order by b.created_at desc
          ),
          '[]'::jsonb
        ) as batches
      from stock.audit_batch b
      where b.branch = v_branch and b.status = 'open'
    ),
    list_rows as (
      select *
      from bucketed
      where v_bucket is null or bucket = v_bucket
      order by
        case bucket
          when 'never' then 0
          when 'over_365' then 1
          when 'd365' then 2
          when 'd180' then 3
          when 'd90' then 4
          else 5
        end,
        sell_qty_period desc,
        days_since desc nulls first,
        qty desc,
        bcode
      limit v_limit
      offset v_offset
    ),
    list_total as (
      select count(*)::int as n
      from bucketed
      where v_bucket is null or bucket = v_bucket
    )
    select jsonb_build_object(
      'branch', v_branch,
      'with_stock_only', coalesce(p_with_stock_only, true),
      'as_of', v_today,
      'sales_from', v_sales_from,
      'sales_to', v_today,
      'summary', to_jsonb(s),
      'daily_marks', dm.series,
      'operator_marks', om.series,
      'open_batches', ob.batches,
      'rows', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'bcode', r.bcode,
              'descr', r.descr,
              'brand', r.brand,
              'model', r.model,
              'location1', r.location1,
              'category', r.category,
              'qty', r.qty,
              'sell_qty_period', r.sell_qty_period,
              'sell_revenue_period', r.sell_revenue_period,
              'pos_dateaudit', r.pos_dateaudit,
              'app_dateaudit', r.app_dateaudit,
              'effective_date', r.effective_date,
              'days_since', r.days_since,
              'bucket', r.bucket
            )
          )
          from list_rows r
        ),
        '[]'::jsonb
      ),
      'row_total', lt.n,
      'limit', v_limit,
      'offset', v_offset,
      'bucket', v_bucket
    )
    from summary s
    cross join open_batches ob
    cross join list_total lt
    cross join daily_marks dm
    cross join operator_marks om
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Get batch
-- ---------------------------------------------------------------------------

drop function if exists public.fn_stock_audit_get_batch(uuid);

create or replace function public.fn_stock_audit_get_batch(p_batch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, stock
as $$
declare
  v_batch stock.audit_batch%rowtype;
begin
  if p_batch_id is null then
    raise exception 'batch_id required';
  end if;

  select * into v_batch
  from stock.audit_batch
  where id = p_batch_id;

  if not found then
    raise exception 'Batch not found';
  end if;

  return jsonb_build_object(
    'id', v_batch.id,
    'branch', v_batch.branch,
    'created_at', v_batch.created_at,
    'created_by', v_batch.created_by,
    'target_count', v_batch.target_count,
    'status', v_batch.status,
    'filters', v_batch.filters,
    'closed_at', v_batch.closed_at,
    'pending_count', (
      select count(*)::int from stock.audit_batch_item i
      where i.batch_id = v_batch.id and i.status = 'pending'
    ),
    'done_count', (
      select count(*)::int from stock.audit_batch_item i
      where i.batch_id = v_batch.id and i.status = 'done'
    ),
    'skipped_count', (
      select count(*)::int from stock.audit_batch_item i
      where i.batch_id = v_batch.id and i.status = 'skipped'
    ),
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'bcode', i.bcode,
            'status', i.status,
            'priority_score', i.priority_score,
            'pos_dateaudit', i.pos_dateaudit,
            'app_dateaudit', i.app_dateaudit,
            'location1', i.location1,
            'descr', i.descr,
            'qty', i.qty,
            'sell_qty_period', i.sell_qty_period,
            'sell_revenue_period', i.sell_revenue_period,
            'done_at', i.done_at,
            'done_by', i.done_by
          )
          order by
            case i.status when 'pending' then 0 when 'done' then 1 else 2 end,
            i.priority_score desc,
            i.location1,
            i.bcode
        )
        from stock.audit_batch_item i
        where i.batch_id = v_batch.id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Create smart batch (sales velocity + app-audit staleness)
-- ---------------------------------------------------------------------------

drop function if exists public.fn_stock_audit_create_batch(text, integer, text, boolean, text, text);

create or replace function public.fn_stock_audit_create_batch(
  p_branch text,
  p_count integer,
  p_created_by text,
  p_with_stock_only boolean default true,
  p_category text default null,
  p_location text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, stock, raw_kcw, curated_kcw
set statement_timeout = '60s'
as $$
declare
  v_branch text;
  v_count int;
  v_category text;
  v_location text;
  v_batch_id uuid;
  v_inserted int;
  v_today date := public._stock_audit_bangkok_today();
  v_sales_from date;
begin
  v_branch := upper(coalesce(nullif(btrim(p_branch), ''), 'HQ'));
  if v_branch not in ('HQ', 'SYP') then
    raise exception 'Invalid branch';
  end if;

  v_count := greatest(1, least(coalesce(p_count, 30), 200));
  v_category := nullif(btrim(coalesce(p_category, '')), '');
  if v_category is not null then
    v_category := lpad(left(v_category, 2), 2, '0');
  end if;
  v_location := nullif(btrim(coalesce(p_location, '')), '');
  v_sales_from := v_today - 29;

  if nullif(btrim(coalesce(p_created_by, '')), '') is null then
    raise exception 'created_by required';
  end if;

  insert into stock.audit_batch (
    branch, created_by, target_count, filters
  ) values (
    v_branch,
    btrim(p_created_by),
    v_count,
    jsonb_build_object(
      'with_stock_only', coalesce(p_with_stock_only, true),
      'category', v_category,
      'location', v_location,
      'sales_from', v_sales_from,
      'sales_to', v_today,
      'rank_mode', 'sales_x_app_staleness'
    )
  )
  returning id into v_batch_id;

  with pending as (
    select i.bcode
    from stock.audit_batch_item i
    join stock.audit_batch b on b.id = i.batch_id
    where b.branch = v_branch
      and b.status = 'open'
      and i.status = 'pending'
  ),
  icmas as (
    select
      nullif(btrim(p."BCODE"), '') as bcode,
      coalesce(nullif(btrim(p."DESCR"), ''), '') as descr,
      coalesce(nullif(btrim(p."LOCATION1"), ''), '') as location1,
      lpad(left(nullif(btrim(p."BCODE"), ''), 2), 2, '0') as category,
      public._stock_audit_parse_date(p."DATEAUDIT") as pos_dateaudit,
      public._stock_audit_parse_qty(p."QTYOH2") as qty_icmas
    from raw_kcw.raw_hq_icmas_products p
    where v_branch = 'HQ'
      and not public._stock_audit_is_canceled(p."CANCELED")
      and nullif(btrim(p."BCODE"), '') is not null
    union all
    select
      nullif(btrim(p."BCODE"), '') as bcode,
      coalesce(nullif(btrim(p."DESCR"), ''), '') as descr,
      coalesce(nullif(btrim(p."LOCATION1"), ''), '') as location1,
      lpad(left(nullif(btrim(p."BCODE"), ''), 2), 2, '0') as category,
      public._stock_audit_parse_date(p."DATEAUDIT") as pos_dateaudit,
      public._stock_audit_parse_qty(p."QTYOH2") as qty_icmas
    from raw_kcw.raw_syp_icmas_products p
    where v_branch = 'SYP'
      and not public._stock_audit_is_canceled(p."CANCELED")
      and nullif(btrim(p."BCODE"), '') is not null
  ),
  inv as (
    select nullif(btrim(i.bcode), '') as bcode, coalesce(i.qty, 0)::numeric as qty
    from curated_kcw.inventory_qty_latest i
    where i.branch = v_branch
  ),
  sales_bills as (
    select
      b."BRANCH" as store_branch,
      b."BILLNO" as bill_no,
      case
        when coalesce(b."BILLTYPE_STD", '') = 'TAD' then 'ONLINE'
        when coalesce(b."BILLTYPE_STD", '') = 'CN'
          and b."BILLNO" ~* '^CNTAD' then 'ONLINE'
        else b."BRANCH"
      end as reporting_branch
    from curated_kcw.fact_sales_bills_all b
    where b."CANCELED" = 'N'
      and b."JOURMODE" <> '0'
      and coalesce(b."BILLTYPE_STD", '') not in ('TF', 'TFV', 'TAR')
        and upper(btrim(b."BILLNO")) !~ '^(3)?SA'
      and b."BILLDATE" >= v_sales_from::text
      and b."BILLDATE" < (v_today + 1)::text
  ),
  sales_period as (
    select
      nullif(btrim(l."BCODE"), '') as bcode,
      sum(
        coalesce(nullif(replace(l."QTY", ',', ''), '')::numeric, 0)
        * coalesce(
            nullif(
              coalesce(nullif(replace(nullif(trim(l."MTP"), ''), ',', ''), '')::numeric, 0),
              0
            ),
            1
          )
      ) as sell_qty,
      sum(coalesce(nullif(replace(l."AMOUNT", ',', ''), '')::numeric, 0)) as sell_revenue
    from curated_kcw.fact_sales_all l
    join sales_bills b
      on b.store_branch = l."BRANCH"
     and b.bill_no = l."BILLNO"
    where nullif(btrim(l."BCODE"), '') is not null
      and (
        v_branch = 'HQ' and b.reporting_branch in ('HQ', 'ONLINE')
        or v_branch = 'SYP' and b.reporting_branch = 'SYP'
      )
    group by 1
  ),
  candidates as (
    select
      c.bcode,
      c.descr,
      c.location1,
      c.pos_dateaudit,
      coalesce(i.qty, c.qty_icmas, 0) as qty,
      coalesce(sp.sell_qty, 0) as sell_qty,
      coalesce(sp.sell_revenue, 0) as sell_revenue,
      (s.last_audited_at at time zone 'Asia/Bangkok')::date as app_dateaudit
    from icmas c
    left join inv i on i.bcode = c.bcode
    left join sales_period sp on sp.bcode = c.bcode
    left join stock.audit_status s
      on s.branch = v_branch and s.bcode = c.bcode
    where not exists (select 1 from pending p where p.bcode = c.bcode)
      and (not coalesce(p_with_stock_only, true) or coalesce(i.qty, c.qty_icmas, 0) > 0)
      and (v_category is null or c.category = v_category)
      and (v_location is null or c.location1 ilike '%' || v_location || '%')
      -- Skip only if APP-audited within 7 days (ignore POS DATEAUDIT)
      and (
        s.last_audited_at is null
        or (s.last_audited_at at time zone 'Asia/Bangkok')::date < (v_today - 7)
      )
  ),
  scored as (
    select
      c.*,
      (
        -- Sales velocity (best sellers first): log-scaled qty + light revenue
        least(ln(1 + greatest(c.sell_qty, 0)) * 120, 900)
        + least(ln(1 + greatest(c.sell_revenue, 0) / 1000.0) * 40, 200)
        -- App-audit staleness: never audited in app dominates
        + case
            when c.app_dateaudit is null then 500
            else least((v_today - c.app_dateaudit)::numeric * 1.5, 400)
          end
        -- Prefer items that still have stock
        + least(ln(1 + greatest(c.qty, 0)) * 8, 60)
      )::numeric as priority_score
    from candidates c
  ),
  loc_rank as (
    select
      location1,
      max(priority_score) as loc_score
    from scored
    group by location1
  ),
  ordered as (
    select
      s.*,
      row_number() over (
        order by
          s.priority_score desc,
          coalesce(lr.loc_score, 0) desc,
          s.location1,
          s.bcode
      ) as rn
    from scored s
    left join loc_rank lr on lr.location1 = s.location1
  ),
  picked as (
    select * from ordered where rn <= v_count
  ),
  ins as (
    insert into stock.audit_batch_item (
      batch_id, bcode, status, priority_score, pos_dateaudit, app_dateaudit,
      location1, descr, qty, sell_qty_period, sell_revenue_period
    )
    select
      v_batch_id,
      p.bcode,
      'pending',
      p.priority_score,
      p.pos_dateaudit,
      p.app_dateaudit,
      p.location1,
      p.descr,
      p.qty,
      p.sell_qty,
      p.sell_revenue
    from picked p
    returning 1
  )
  select count(*)::int into v_inserted from ins;

  if v_inserted = 0 then
    update stock.audit_batch
    set status = 'closed', closed_at = now()
    where id = v_batch_id;
  end if;

  return public.fn_stock_audit_get_batch(v_batch_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Mark audited
-- ---------------------------------------------------------------------------

drop function if exists public.fn_stock_audit_mark(text, text, text, text, uuid, text);

create or replace function public.fn_stock_audit_mark(
  p_branch text,
  p_bcode text,
  p_audited_by text,
  p_source text default 'ondemand',
  p_batch_id uuid default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, stock, raw_kcw
as $$
declare
  v_branch text;
  v_bcode text;
  v_source text;
  v_now timestamptz := now();
  v_exists boolean;
begin
  v_branch := upper(coalesce(nullif(btrim(p_branch), ''), 'HQ'));
  if v_branch not in ('HQ', 'SYP') then
    raise exception 'Invalid branch';
  end if;

  v_bcode := nullif(btrim(coalesce(p_bcode, '')), '');
  if v_bcode is null then
    raise exception 'bcode required';
  end if;

  v_source := lower(coalesce(nullif(btrim(p_source), ''), 'ondemand'));
  if v_source not in ('batch', 'ondemand', 'manual') then
    raise exception 'Invalid source';
  end if;

  if nullif(btrim(coalesce(p_audited_by, '')), '') is null then
    raise exception 'audited_by required';
  end if;

  if v_branch = 'HQ' then
    select exists(
      select 1 from raw_kcw.raw_hq_icmas_products p
      where nullif(btrim(p."BCODE"), '') = v_bcode
    ) into v_exists;
  else
    select exists(
      select 1 from raw_kcw.raw_syp_icmas_products p
      where nullif(btrim(p."BCODE"), '') = v_bcode
    ) into v_exists;
  end if;

  if not v_exists then
    raise exception 'Unknown bcode';
  end if;

  insert into stock.audit_event (
    branch, bcode, audited_at, audited_by, source, batch_id, notes
  ) values (
    v_branch, v_bcode, v_now, btrim(p_audited_by), v_source, p_batch_id,
    nullif(btrim(coalesce(p_notes, '')), '')
  );

  insert into stock.audit_status as s (
    branch, bcode, last_audited_at, last_audited_by, audit_count, notes, updated_at
  ) values (
    v_branch, v_bcode, v_now, btrim(p_audited_by), 1,
    nullif(btrim(coalesce(p_notes, '')), ''), v_now
  )
  on conflict (branch, bcode) do update set
    last_audited_at = excluded.last_audited_at,
    last_audited_by = excluded.last_audited_by,
    audit_count = s.audit_count + 1,
    notes = coalesce(excluded.notes, s.notes),
    updated_at = excluded.updated_at;

  if p_batch_id is not null then
    update stock.audit_batch_item
    set status = 'done', done_at = v_now, done_by = btrim(p_audited_by)
    where batch_id = p_batch_id
      and bcode = v_bcode
      and status = 'pending';

    if not exists (
      select 1 from stock.audit_batch_item
      where batch_id = p_batch_id and status = 'pending'
    ) then
      update stock.audit_batch
      set status = 'closed', closed_at = v_now
      where id = p_batch_id and status = 'open';
    end if;
  else
    update stock.audit_batch_item i
    set status = 'done', done_at = v_now, done_by = btrim(p_audited_by)
    from stock.audit_batch b
    where i.batch_id = b.id
      and b.branch = v_branch
      and b.status = 'open'
      and i.bcode = v_bcode
      and i.status = 'pending';

    update stock.audit_batch b
    set status = 'closed', closed_at = v_now
    where b.branch = v_branch
      and b.status = 'open'
      and not exists (
        select 1 from stock.audit_batch_item i
        where i.batch_id = b.id and i.status = 'pending'
      );
  end if;

  return jsonb_build_object(
    'branch', v_branch,
    'bcode', v_bcode,
    'audited_at', v_now,
    'audited_by', btrim(p_audited_by),
    'source', v_source,
    'batch_id', p_batch_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Skip item
-- ---------------------------------------------------------------------------

drop function if exists public.fn_stock_audit_skip_item(uuid, text, text);

create or replace function public.fn_stock_audit_skip_item(
  p_batch_id uuid,
  p_bcode text,
  p_by text
)
returns jsonb
language plpgsql
security definer
set search_path = public, stock
as $$
declare
  v_bcode text;
  v_now timestamptz := now();
begin
  if p_batch_id is null then
    raise exception 'batch_id required';
  end if;
  v_bcode := nullif(btrim(coalesce(p_bcode, '')), '');
  if v_bcode is null then
    raise exception 'bcode required';
  end if;

  update stock.audit_batch_item
  set status = 'skipped', done_at = v_now, done_by = nullif(btrim(coalesce(p_by, '')), '')
  where batch_id = p_batch_id and bcode = v_bcode and status = 'pending';

  if not found then
    raise exception 'Pending item not found';
  end if;

  if not exists (
    select 1 from stock.audit_batch_item
    where batch_id = p_batch_id and status = 'pending'
  ) then
    update stock.audit_batch
    set status = 'closed', closed_at = v_now
    where id = p_batch_id and status = 'open';
  end if;

  return public.fn_stock_audit_get_batch(p_batch_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Lookup
-- ---------------------------------------------------------------------------

drop function if exists public.fn_stock_audit_lookup(text, text);

create or replace function public.fn_stock_audit_lookup(
  p_branch text,
  p_bcode text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, stock, raw_kcw, curated_kcw
as $$
declare
  v_branch text;
  v_bcode text;
  v_row jsonb;
  v_today date := public._stock_audit_bangkok_today();
  v_sales_from date := v_today - 29;
begin
  v_branch := upper(coalesce(nullif(btrim(p_branch), ''), 'HQ'));
  if v_branch not in ('HQ', 'SYP') then
    raise exception 'Invalid branch';
  end if;
  v_bcode := nullif(btrim(coalesce(p_bcode, '')), '');
  if v_bcode is null then
    raise exception 'bcode required';
  end if;

  with icmas as (
    select
      nullif(btrim(p."BCODE"), '') as bcode,
      coalesce(nullif(btrim(p."DESCR"), ''), '') as descr,
      coalesce(nullif(btrim(p."BRAND"), ''), '') as brand,
      coalesce(nullif(btrim(p."MODEL"), ''), '') as model,
      coalesce(nullif(btrim(p."LOCATION1"), ''), '') as location1,
      public._stock_audit_parse_date(p."DATEAUDIT") as pos_dateaudit,
      public._stock_audit_parse_qty(p."QTYOH2") as qty_icmas
    from raw_kcw.raw_hq_icmas_products p
    where v_branch = 'HQ' and nullif(btrim(p."BCODE"), '') = v_bcode
    union all
    select
      nullif(btrim(p."BCODE"), '') as bcode,
      coalesce(nullif(btrim(p."DESCR"), ''), '') as descr,
      coalesce(nullif(btrim(p."BRAND"), ''), '') as brand,
      coalesce(nullif(btrim(p."MODEL"), ''), '') as model,
      coalesce(nullif(btrim(p."LOCATION1"), ''), '') as location1,
      public._stock_audit_parse_date(p."DATEAUDIT") as pos_dateaudit,
      public._stock_audit_parse_qty(p."QTYOH2") as qty_icmas
    from raw_kcw.raw_syp_icmas_products p
    where v_branch = 'SYP' and nullif(btrim(p."BCODE"), '') = v_bcode
  ),
  sales_bills as (
    select
      b."BRANCH" as store_branch,
      b."BILLNO" as bill_no,
      case
        when coalesce(b."BILLTYPE_STD", '') = 'TAD' then 'ONLINE'
        when coalesce(b."BILLTYPE_STD", '') = 'CN'
          and b."BILLNO" ~* '^CNTAD' then 'ONLINE'
        else b."BRANCH"
      end as reporting_branch
    from curated_kcw.fact_sales_bills_all b
    where b."CANCELED" = 'N'
      and b."JOURMODE" <> '0'
      and coalesce(b."BILLTYPE_STD", '') not in ('TF', 'TFV', 'TAR')
        and upper(btrim(b."BILLNO")) !~ '^(3)?SA'
      and b."BILLDATE" >= v_sales_from::text
      and b."BILLDATE" < (v_today + 1)::text
  ),
  sales_period as (
    select
      sum(
        coalesce(nullif(replace(l."QTY", ',', ''), '')::numeric, 0)
        * coalesce(
            nullif(
              coalesce(nullif(replace(nullif(trim(l."MTP"), ''), ',', ''), '')::numeric, 0),
              0
            ),
            1
          )
      ) as sell_qty,
      sum(coalesce(nullif(replace(l."AMOUNT", ',', ''), '')::numeric, 0)) as sell_revenue
    from curated_kcw.fact_sales_all l
    join sales_bills b
      on b.store_branch = l."BRANCH"
     and b.bill_no = l."BILLNO"
    where nullif(btrim(l."BCODE"), '') = v_bcode
      and (
        v_branch = 'HQ' and b.reporting_branch in ('HQ', 'ONLINE')
        or v_branch = 'SYP' and b.reporting_branch = 'SYP'
      )
  ),
  joined as (
    select
      c.*,
      coalesce(i.qty, c.qty_icmas, 0) as qty,
      coalesce(sp.sell_qty, 0) as sell_qty_period,
      coalesce(sp.sell_revenue, 0) as sell_revenue_period,
      s.last_audited_at as app_audited_at,
      (s.last_audited_at at time zone 'Asia/Bangkok')::date as app_dateaudit,
      s.last_audited_by as app_audited_by,
      s.audit_count,
      (s.last_audited_at at time zone 'Asia/Bangkok')::date as effective_date
    from icmas c
    left join curated_kcw.inventory_qty_latest i
      on i.branch = v_branch and nullif(btrim(i.bcode), '') = c.bcode
    left join stock.audit_status s
      on s.branch = v_branch and s.bcode = c.bcode
    cross join sales_period sp
  )
  select to_jsonb(j) into v_row from joined j limit 1;

  if v_row is null then
    return jsonb_build_object('found', false, 'branch', v_branch, 'bcode', v_bcode);
  end if;

  return jsonb_build_object('found', true, 'branch', v_branch) || v_row;
end;
$$;

revoke all on function public.fn_stock_audit_overview(text, boolean, text, integer, integer) from public, anon, authenticated;
revoke all on function public.fn_stock_audit_create_batch(text, integer, text, boolean, text, text) from public, anon, authenticated;
revoke all on function public.fn_stock_audit_get_batch(uuid) from public, anon, authenticated;
revoke all on function public.fn_stock_audit_mark(text, text, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.fn_stock_audit_skip_item(uuid, text, text) from public, anon, authenticated;
revoke all on function public.fn_stock_audit_lookup(text, text) from public, anon, authenticated;
revoke all on function public._stock_audit_parse_date(text) from public, anon, authenticated;
revoke all on function public._stock_audit_parse_qty(text) from public, anon, authenticated;
revoke all on function public._stock_audit_is_canceled(text) from public, anon, authenticated;
revoke all on function public._stock_audit_bangkok_today() from public, anon, authenticated;

grant execute on function public.fn_stock_audit_overview(text, boolean, text, integer, integer) to service_role;
grant execute on function public.fn_stock_audit_create_batch(text, integer, text, boolean, text, text) to service_role;
grant execute on function public.fn_stock_audit_get_batch(uuid) to service_role;
grant execute on function public.fn_stock_audit_mark(text, text, text, text, uuid, text) to service_role;
grant execute on function public.fn_stock_audit_skip_item(uuid, text, text) to service_role;
grant execute on function public.fn_stock_audit_lookup(text, text) to service_role;\n\n
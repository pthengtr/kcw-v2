-- >>> from docs/bi/sql/fn_bi_customer_overview.sql
-- Customer BI overview: bill-grain net revenue ranked by bill ACCTNO (AR customer).
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
  ),
  month_columns AS (
    SELECT to_char(d::date, 'YYYY-MM') AS period
    FROM generate_series(
      date_trunc('month', p_from::timestamp)::date,
      date_trunc('month', p_to::timestamp)::date,
      interval '1 month'
    ) AS d
  ),
  customer_month AS (
    SELECT
      acctno,
      to_char(bill_date, 'YYYY-MM') AS period,
      sum(revenue_net) AS revenue_net
    FROM ranked
    GROUP BY acctno, to_char(bill_date, 'YYYY-MM')
  ),
  by_customer_month AS (
    SELECT
      tc.acctno::text AS key,
      COALESCE(tc.customer_name, tc.acctno) AS label,
      tc.acctno AS sublabel,
      tc.revenue_net AS total,
      COALESCE(
        (
          SELECT jsonb_object_agg(cm.period, cm.revenue_net)
          FROM customer_month cm
          WHERE cm.acctno = tc.acctno
        ),
        '{}'::jsonb
      ) AS months
    FROM top_customers tc
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
    ), '[]'::jsonb),
    'month_columns', COALESCE((
      SELECT jsonb_agg(period ORDER BY period)
      FROM month_columns
    ), '[]'::jsonb),
    'by_customer_month', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', key,
        'label', label,
        'sublabel', sublabel,
        'total', total,
        'months', months
      ) ORDER BY total DESC, label)
      FROM by_customer_month
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.fn_bi_customer_overview(date, date, text, integer) IS
  'Customer BI: bill BEFORETAX ranking by ACCTNO; name = party → ARMAS → blank; expose name_source.';

GRANT EXECUTE ON FUNCTION public.fn_bi_customer_overview(date, date, text, integer) TO service_role;

-- >>> from docs/bi/sql/fn_bi_product_overview.sql
-- Product BI overview: line-grain net revenue ranked by BCODE.
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
      left(l."BILLDATE", 10)::date AS bill_date,
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
  ),
  month_columns AS (
    SELECT to_char(d::date, 'YYYY-MM') AS period
    FROM generate_series(
      date_trunc('month', p_from::timestamp)::date,
      date_trunc('month', p_to::timestamp)::date,
      interval '1 month'
    ) AS d
  ),
  product_month AS (
    SELECT
      bcode,
      to_char(bill_date, 'YYYY-MM') AS period,
      sum(revenue_net) AS revenue_net
    FROM line_base
    GROUP BY bcode, to_char(bill_date, 'YYYY-MM')
  ),
  by_product_month AS (
    SELECT
      tp.bcode::text AS key,
      tp.detail AS label,
      tp.category_name AS sublabel,
      tp.revenue_net AS total,
      COALESCE(
        (
          SELECT jsonb_object_agg(pm.period, pm.revenue_net)
          FROM product_month pm
          WHERE pm.bcode = tp.bcode
        ),
        '{}'::jsonb
      ) AS months
    FROM top_products tp
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
    ), '[]'::jsonb),
    'month_columns', COALESCE((
      SELECT jsonb_agg(period ORDER BY period)
      FROM month_columns
    ), '[]'::jsonb),
    'by_product_month', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', key,
        'label', label,
        'sublabel', sublabel,
        'total', total,
        'months', months
      ) ORDER BY total DESC, label)
      FROM by_product_month
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.fn_bi_product_overview(date, date, text, integer) IS
  'Product BI: line net revenue ranking by BCODE with category/CODE1 splits; ICMAS enrich.';

GRANT EXECUTE ON FUNCTION public.fn_bi_product_overview(date, date, text, integer) TO service_role;

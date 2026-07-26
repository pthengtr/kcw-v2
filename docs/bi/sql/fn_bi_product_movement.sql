-- Product movement BI: stock-more (sell qty rank) + dead-stock aging from last HQ buy.
-- See docs/bi/kcw-product-movement-data-dictionary.md and kcw-purchase-data-dictionary.md.

CREATE OR REPLACE FUNCTION public.fn_bi_product_movement(
  p_from date,
  p_to date,
  p_branch text DEFAULT NULL,
  p_stock_limit integer DEFAULT 50,
  p_dead_limit integer DEFAULT 200
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, curated_kcw, raw_kcw
AS $$
DECLARE
  v_stock_limit int;
  v_dead_limit int;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'Invalid date range';
  END IF;

  IF p_branch IS NOT NULL AND p_branch NOT IN ('HQ', 'SYP', 'ONLINE') THEN
    RAISE EXCEPTION 'Invalid branch';
  END IF;

  v_stock_limit := GREATEST(1, LEAST(COALESCE(p_stock_limit, 50), 200));
  v_dead_limit := GREATEST(1, LEAST(COALESCE(p_dead_limit, 200), 500));

  RETURN (
    WITH sales_bills AS (
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
        AND b."BILLDATE" < (p_to + 1)::text
    ),
    sales_lines_hist AS (
      SELECT
        nullif(btrim(l."BCODE"), '') AS bcode,
        COALESCE(l."DETAIL", '') AS detail,
        b.bill_date,
        b.bill_no,
        b.store_branch,
        b.reporting_branch,
        COALESCE(NULLIF(replace(l."QTY", ',', ''), '')::numeric, 0)
          * COALESCE(
              NULLIF(
                COALESCE(NULLIF(replace(nullif(trim(l."MTP"), ''), ',', ''), '')::numeric, 0),
                0
              ),
              1
            ) AS base_qty
      FROM curated_kcw.fact_sales_all l
      JOIN sales_bills b
        ON b.store_branch = l."BRANCH"
       AND b.bill_no = l."BILLNO"
      WHERE l."IS_VALID" = 'True'
        AND l."CANCELED" = 'N'
        AND l."BILLDATE" < (p_to + 1)::text
        AND nullif(btrim(l."BCODE"), '') IS NOT NULL
        AND (p_branch IS NULL OR b.reporting_branch = p_branch)
    ),
    sales_period AS (
      SELECT
        bcode,
        max(detail) AS detail,
        sum(base_qty) AS sell_qty,
        count(DISTINCT (store_branch, bill_no))::int AS sell_bills,
        count(DISTINCT bill_date)::int AS sell_days
      FROM sales_lines_hist
      WHERE bill_date >= p_from
        AND bill_date <= p_to
      GROUP BY bcode
    ),
    last_sale AS (
      SELECT
        bcode,
        max(bill_date) AS last_sale_date
      FROM sales_lines_hist
      GROUP BY bcode
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
      WHERE COALESCE(p."JOURMODE", '') IN ('1', '2')
        AND COALESCE(p."BILLTYPE", '') IN ('1', '2', '3')
        AND nullif(btrim(p."BCODE"), '') IS NOT NULL
        AND p."BILLDATE" < (p_to + 1)::text
    ),
    purchase_period AS (
      SELECT
        bcode,
        max(detail) AS detail,
        sum(base_qty) AS buy_qty,
        count(DISTINCT bill_no)::int AS buy_bills,
        count(DISTINCT bill_date)::int AS buy_days
      FROM purchase_product
      WHERE bill_date >= p_from
        AND bill_date <= p_to
      GROUP BY bcode
    ),
    last_purchase AS (
      SELECT
        bcode,
        max(detail) AS detail,
        max(bill_date) AS last_purchase_date
      FROM purchase_product
      WHERE billtype = '1'
      GROUP BY bcode
    ),
    icmas AS (
      SELECT
        nullif(btrim(i."BCODE"), '') AS bcode,
        max(COALESCE(i."DESCR", '')) AS descr,
        max(COALESCE(i."CODE1", '')) AS code1,
        max(
          COALESCE(NULLIF(replace(nullif(btrim(i."QTYOH2"), ''), ',', ''), '')::numeric, 0)
        ) AS on_hand_qty
      FROM raw_kcw.raw_hq_icmas_products i
      WHERE nullif(btrim(i."BCODE"), '') IS NOT NULL
      GROUP BY 1
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
    dead_base AS (
      SELECT
        lp.bcode,
        COALESCE(NULLIF(i.descr, ''), NULLIF(lp.detail, ''), lp.bcode) AS detail,
        lpad(left(lp.bcode, 2), 2, '0') AS category_code,
        nullif(btrim(COALESCE(i.code1, '')), '') AS code1,
        COALESCE(i.on_hand_qty, 0) AS on_hand_qty,
        lp.last_purchase_date,
        ls.last_sale_date,
        (p_to - lp.last_purchase_date) AS days_since_purchase,
        CASE
          WHEN ls.last_sale_date IS NULL THEN NULL
          ELSE (p_to - ls.last_sale_date)
        END AS days_since_sale,
        CASE
          WHEN ls.last_sale_date IS NULL THEN true
          WHEN ls.last_sale_date < lp.last_purchase_date THEN true
          ELSE false
        END AS no_move_since_purchase
      FROM last_purchase lp
      LEFT JOIN last_sale ls ON ls.bcode = lp.bcode
      LEFT JOIN icmas i ON i.bcode = lp.bcode
      WHERE COALESCE(i.on_hand_qty, 0) > 0
    ),
    dead_scored AS (
      SELECT
        d.*,
        CASE
          WHEN d.no_move_since_purchase AND d.days_since_purchase >= 365 THEN 'red'
          WHEN d.no_move_since_purchase AND d.days_since_purchase >= 180 THEN 'orange'
          WHEN d.no_move_since_purchase AND d.days_since_purchase >= 90 THEN 'yellow'
          ELSE NULL
        END AS purchase_dead_tier,
        CASE
          WHEN d.last_sale_date IS NULL OR d.days_since_sale >= 365 THEN 'red'
          WHEN d.days_since_sale >= 180 THEN 'orange'
          WHEN d.days_since_sale >= 90 THEN 'yellow'
          ELSE NULL
        END AS never_sold_tier
      FROM dead_base d
    ),
    dead_final AS (
      SELECT
        bcode,
        detail,
        category_code,
        code1,
        on_hand_qty,
        last_purchase_date,
        last_sale_date,
        days_since_purchase,
        days_since_sale,
        no_move_since_purchase,
        CASE
          WHEN purchase_dead_tier = 'red' OR never_sold_tier = 'red' THEN 'red'
          WHEN purchase_dead_tier = 'orange' OR never_sold_tier = 'orange' THEN 'orange'
          WHEN purchase_dead_tier = 'yellow' OR never_sold_tier = 'yellow' THEN 'yellow'
          ELSE NULL
        END AS dead_tier
      FROM dead_scored
    ),
    dead_filtered AS (
      SELECT *
      FROM dead_final
      WHERE dead_tier IS NOT NULL
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
        d.last_purchase_date,
        d.last_sale_date,
        d.days_since_purchase,
        d.days_since_sale,
        d.no_move_since_purchase,
        d.dead_tier,
        COALESCE(sp.sell_qty, 0) AS sell_qty_period,
        COALESCE(pp.buy_qty, 0) AS buy_qty_period
      FROM dead_filtered d
      LEFT JOIN sales_period sp ON sp.bcode = d.bcode
      LEFT JOIN purchase_period pp ON pp.bcode = d.bcode
      ORDER BY
        CASE d.dead_tier
          WHEN 'red' THEN 1
          WHEN 'orange' THEN 2
          WHEN 'yellow' THEN 3
          ELSE 4
        END,
        d.days_since_purchase DESC NULLS LAST,
        d.bcode
      LIMIT v_dead_limit
    ),
    summary AS (
      SELECT
        (SELECT count(*)::int FROM sales_period) AS sold_sku_count,
        (SELECT COALESCE(sum(sell_qty), 0) FROM sales_period) AS sell_qty,
        (SELECT count(*)::int FROM purchase_period) AS bought_sku_count,
        (SELECT COALESCE(sum(buy_qty), 0) FROM purchase_period) AS buy_qty,
        (SELECT count(*)::int FROM dead_filtered WHERE dead_tier = 'yellow') AS dead_yellow_count,
        (SELECT count(*)::int FROM dead_filtered WHERE dead_tier = 'orange') AS dead_orange_count,
        (SELECT count(*)::int FROM dead_filtered WHERE dead_tier = 'red') AS dead_red_count,
        (SELECT count(*)::int FROM dead_filtered) AS dead_total_count
    )
    SELECT jsonb_build_object(
      'from', p_from,
      'to', p_to,
      'branch', p_branch,
      'stock_limit', v_stock_limit,
      'dead_limit', v_dead_limit,
      'summary', (SELECT jsonb_build_object(
        'sold_sku_count', sold_sku_count,
        'sell_qty', sell_qty,
        'bought_sku_count', bought_sku_count,
        'buy_qty', buy_qty,
        'dead_yellow_count', dead_yellow_count,
        'dead_orange_count', dead_orange_count,
        'dead_red_count', dead_red_count,
        'dead_total_count', dead_total_count
      ) FROM summary),
      'stock_more', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'bcode', sm.bcode,
          'detail', sm.detail,
          'category_code', sm.category_code,
          'category_name', COALESCE(cd.category_name, sm.category_code),
          'code1', sm.code1,
          'code1_name', c1.code1_name,
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
        LEFT JOIN category_dim cd ON cd.category_code = sm.category_code
        LEFT JOIN code1_dim c1 ON c1.code1 = sm.code1
      ), '[]'::jsonb),
      'dead_stock', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'bcode', dl.bcode,
          'detail', dl.detail,
          'category_code', dl.category_code,
          'category_name', COALESCE(cd.category_name, dl.category_code),
          'code1', dl.code1,
          'code1_name', c1.code1_name,
          'on_hand_qty', dl.on_hand_qty,
          'last_purchase_date', dl.last_purchase_date,
          'last_sale_date', dl.last_sale_date,
          'days_since_purchase', dl.days_since_purchase,
          'days_since_sale', dl.days_since_sale,
          'no_move_since_purchase', dl.no_move_since_purchase,
          'dead_tier', dl.dead_tier,
          'sell_qty_period', dl.sell_qty_period,
          'buy_qty_period', dl.buy_qty_period
        ) ORDER BY
          CASE dl.dead_tier
            WHEN 'red' THEN 1
            WHEN 'orange' THEN 2
            WHEN 'yellow' THEN 3
            ELSE 4
          END,
          dl.days_since_purchase DESC NULLS LAST,
          dl.bcode
        )
        FROM dead_list dl
        LEFT JOIN category_dim cd ON cd.category_code = dl.category_code
        LEFT JOIN code1_dim c1 ON c1.code1 = dl.code1
      ), '[]'::jsonb)
    )
  );
END;
$$;

COMMENT ON FUNCTION public.fn_bi_product_movement(date, date, text, integer, integer) IS
  'Product movement: stock-more by sell_qty; dead stock 90/180/365 from last HQ buy + never sold; buys always HQ.';

GRANT EXECUTE ON FUNCTION public.fn_bi_product_movement(date, date, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_bi_product_movement(date, date, text, integer, integer) TO authenticated;

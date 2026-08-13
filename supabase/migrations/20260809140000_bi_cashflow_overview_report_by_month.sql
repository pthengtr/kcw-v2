-- Cash-flow BI overview from bank.statement_lines (imported bank statements).
-- Amounts are actual bank cash movements (not P&L).
-- match_status = ignored means operator exclude-from-report (e.g. cross-format
-- duplicates); excluded by default. Pass p_include_ignored := true to include.
-- Internal transfers are included in gross inflow/outflow but also reported separately
-- so the UI can show net cash excluding cross-account transfers.

CREATE OR REPLACE FUNCTION public.fn_bi_cashflow_overview(
  p_from date,
  p_to date,
  p_account_no text DEFAULT NULL,
  p_include_ignored boolean DEFAULT false,
  p_limit integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, bank
AS $$
DECLARE
  v_result jsonb;
  v_prev_from date;
  v_prev_to date;
  v_span int;
  v_limit int;
  v_account text;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'Invalid date range';
  END IF;

  v_account := NULLIF(btrim(COALESCE(p_account_no, '')), '');
  v_limit := GREATEST(1, LEAST(COALESCE(p_limit, 30), 200));
  v_span := (p_to - p_from);
  v_prev_to := p_from - 1;
  v_prev_from := v_prev_to - v_span;

  WITH base AS (
    SELECT
      s.id,
      s.account_no,
      COALESCE(NULLIF(btrim(s.bank_name), ''), '—') AS bank_name,
      s.txn_date,
      s.amount::double precision AS amount,
      s.direction,
      s.match_status,
      s.matched_ref_type,
      s.balance_after::double precision AS balance_after,
      s.source_row_number,
      s.created_at,
      CASE
        WHEN s.direction = 'in' THEN s.amount::double precision
        ELSE 0::double precision
      END AS inflow,
      CASE
        WHEN s.direction = 'out' THEN s.amount::double precision
        ELSE 0::double precision
      END AS outflow,
      CASE
        WHEN lower(btrim(COALESCE(s.matched_ref_type, ''))) = 'internal_transfer'
          THEN true
        ELSE false
      END AS is_internal_transfer,
      CASE
        WHEN lower(btrim(COALESCE(s.matched_ref_type, ''))) = 'internal_transfer'
          THEN 'internal'
        WHEN lower(btrim(COALESCE(s.matched_ref_type, ''))) IN (
          'tr_bill', 'tr_bundle', 'tr_remainder', '3tr_bill', 'rvmas', 'rvi'
        ) AND s.direction = 'in' THEN 'sales_in'
        WHEN lower(btrim(COALESCE(s.matched_ref_type, ''))) = 'tar_cntar_net'
          AND s.direction = 'in' THEN 'ar_in'
        WHEN lower(btrim(COALESCE(s.matched_ref_type, ''))) IN (
          'pvmas', 'pimas', 'pimas_possible_bundle', 'bank_cheque'
        ) AND s.direction = 'out' THEN 'supplier_out'
        WHEN lower(btrim(COALESCE(s.matched_ref_type, ''))) = 'expense_payroll'
          AND s.direction = 'out' THEN 'payroll_out'
        WHEN lower(btrim(COALESCE(s.matched_ref_type, ''))) IN (
          'expense_pv', 'employee_advance', 'withholding_tax'
        ) AND s.direction = 'out' THEN 'opex_out'
        ELSE 'other'
      END AS report_group,
      CASE
        WHEN s.match_status = 'ignored' THEN 'ignored'
        WHEN s.matched_ref_type IS NULL OR btrim(s.matched_ref_type) = '' THEN
          CASE s.match_status
            WHEN 'pending' THEN 'unclassified_pending'
            WHEN 'unmatched' THEN 'unclassified_unmatched'
            WHEN 'review' THEN 'unclassified_review'
            ELSE 'unclassified'
          END
        ELSE lower(btrim(s.matched_ref_type))
      END AS category_key
    FROM bank.statement_lines s
    WHERE s.txn_date >= p_from
      AND s.txn_date <= p_to
      AND (v_account IS NULL OR s.account_no = v_account)
      AND (COALESCE(p_include_ignored, false) OR s.match_status IS DISTINCT FROM 'ignored')
  ),
  prev_base AS (
    SELECT
      s.amount::double precision AS amount,
      s.direction,
      s.match_status,
      s.matched_ref_type,
      CASE
        WHEN s.direction = 'in' THEN s.amount::double precision
        ELSE 0::double precision
      END AS inflow,
      CASE
        WHEN s.direction = 'out' THEN s.amount::double precision
        ELSE 0::double precision
      END AS outflow,
      CASE
        WHEN lower(btrim(COALESCE(s.matched_ref_type, ''))) = 'internal_transfer'
          THEN true
        ELSE false
      END AS is_internal_transfer
    FROM bank.statement_lines s
    WHERE s.txn_date >= v_prev_from
      AND s.txn_date <= v_prev_to
      AND (v_account IS NULL OR s.account_no = v_account)
      AND (COALESCE(p_include_ignored, false) OR s.match_status IS DISTINCT FROM 'ignored')
  ),
  category_label AS (
    SELECT *
    FROM (
      VALUES
        ('tar_cntar_net', 'รับชำระลูกหนี้'),
        ('rvmas', 'ใบสำคัญรับ (RVMAS)'),
        ('rvi', 'รับเงินตลาดออนไลน์ (RVI)'),
        ('tr_bill', 'บิลโอน'),
        ('tr_bundle', 'บิลโอนรวม'),
        ('tr_remainder', 'บิลโอนส่วนต่าง'),
        ('3tr_bill', 'บิลโอน (3TR)'),
        ('pvmas', 'จ่ายเจ้าหนี้ (PVMAS)'),
        ('pimas', 'จ่ายซื้อสินค้า (PIMAS)'),
        ('pimas_possible_bundle', 'จ่ายซื้อสินค้า (bundle)'),
        ('expense_pv', 'ค่าใช้จ่าย'),
        ('expense_payroll', 'เงินเดือน'),
        ('internal_transfer', 'โอนระหว่างบัญชี'),
        ('interest_income', 'ดอกเบี้ยรับ'),
        ('withholding_tax', 'หัก ณ ที่จ่าย'),
        ('employee_advance', 'เบิกล่วงหน้า'),
        ('bank_cheque', 'เช็ค'),
        ('vendor_rebate', 'ส่วนลดผู้ขาย'),
        ('sales_adjustment', 'ปรับปรุงยอดขาย'),
        ('possible_duplicate', 'อาจเป็นแถวซ้ำ'),
        ('unclassified_inflow', 'รับเข้าไม่ระบุ'),
        ('unclassified_pending', 'ยังไม่จับคู่ (รอ agent)'),
        ('unclassified_unmatched', 'ยังไม่จับคู่'),
        ('unclassified_review', 'รอตรวจ'),
        ('unclassified', 'ยังไม่จัดประเภท'),
        ('ignored', 'ละเว้น')
    ) AS t(key, label)
  ),
  summary AS (
    SELECT
      COALESCE(SUM(inflow), 0) AS inflow,
      COALESCE(SUM(outflow), 0) AS outflow,
      COALESCE(SUM(inflow) - SUM(outflow), 0) AS net,
      COUNT(*)::int AS line_count,
      COUNT(*) FILTER (WHERE direction = 'in')::int AS inflow_count,
      COUNT(*) FILTER (WHERE direction = 'out')::int AS outflow_count,
      COALESCE(SUM(inflow) FILTER (WHERE is_internal_transfer), 0) AS internal_in,
      COALESCE(SUM(outflow) FILTER (WHERE is_internal_transfer), 0) AS internal_out,
      COALESCE(
        SUM(inflow) FILTER (WHERE NOT is_internal_transfer)
        - SUM(outflow) FILTER (WHERE NOT is_internal_transfer),
        0
      ) AS net_ex_internal,
      COUNT(*) FILTER (
        WHERE category_key LIKE 'unclassified%'
      )::int AS unclassified_count
    FROM base
  ),
  prev_summary AS (
    SELECT
      COALESCE(SUM(inflow), 0) AS inflow,
      COALESCE(SUM(outflow), 0) AS outflow,
      COALESCE(SUM(inflow) - SUM(outflow), 0) AS net,
      COUNT(*)::int AS line_count,
      COALESCE(
        SUM(inflow) FILTER (WHERE NOT is_internal_transfer)
        - SUM(outflow) FILTER (WHERE NOT is_internal_transfer),
        0
      ) AS net_ex_internal
    FROM prev_base
  ),
  ending_balances AS (
    SELECT DISTINCT ON (s.account_no)
      s.account_no,
      COALESCE(NULLIF(btrim(s.bank_name), ''), '—') AS bank_name,
      s.balance_after::double precision AS balance_after
    FROM bank.statement_lines s
    WHERE s.txn_date <= p_to
      AND s.balance_after IS NOT NULL
      AND (v_account IS NULL OR s.account_no = v_account)
    ORDER BY s.account_no, s.txn_date DESC, s.source_row_number DESC NULLS LAST, s.created_at DESC
  ),
  opening_balances AS (
    SELECT DISTINCT ON (s.account_no)
      s.account_no,
      s.balance_after::double precision AS balance_after
    FROM bank.statement_lines s
    WHERE s.txn_date < p_from
      AND s.balance_after IS NOT NULL
      AND (v_account IS NULL OR s.account_no = v_account)
    ORDER BY s.account_no, s.txn_date DESC, s.source_row_number DESC NULLS LAST, s.created_at DESC
  ),
  balance_summary AS (
    SELECT
      COALESCE((SELECT SUM(balance_after) FROM ending_balances), 0) AS ending_balance,
      COALESCE((SELECT SUM(balance_after) FROM opening_balances), 0) AS opening_balance,
      COALESCE((SELECT COUNT(*)::int FROM ending_balances), 0) AS account_count
  ),
  by_account AS (
    SELECT
      b.account_no AS key,
      MAX(b.bank_name) AS bank_name,
      (MAX(b.bank_name) || ' · ' || b.account_no) AS label,
      COALESCE(SUM(b.inflow), 0) AS inflow,
      COALESCE(SUM(b.outflow), 0) AS outflow,
      COALESCE(SUM(b.inflow) - SUM(b.outflow), 0) AS net,
      COUNT(*)::int AS line_count,
      COALESCE(MAX(eb.balance_after), 0) AS ending_balance
    FROM base b
    LEFT JOIN ending_balances eb ON eb.account_no = b.account_no
    GROUP BY b.account_no
  ),
  by_category AS (
    SELECT
      b.category_key AS key,
      COALESCE(cl.label, b.category_key) AS label,
      COALESCE(SUM(b.inflow), 0) AS inflow,
      COALESCE(SUM(b.outflow), 0) AS outflow,
      COALESCE(SUM(b.inflow) - SUM(b.outflow), 0) AS net,
      COUNT(*)::int AS line_count
    FROM base b
    LEFT JOIN category_label cl ON cl.key = b.category_key
    GROUP BY b.category_key, cl.label
  ),
  by_match_status AS (
    SELECT
      match_status AS key,
      COUNT(*)::int AS line_count,
      COALESCE(SUM(inflow), 0) AS inflow,
      COALESCE(SUM(outflow), 0) AS outflow
    FROM base
    GROUP BY match_status
  ),
  trend_daily AS (
    SELECT
      to_char(txn_date, 'YYYY-MM-DD') AS period,
      COALESCE(SUM(inflow), 0) AS inflow,
      COALESCE(SUM(outflow), 0) AS outflow,
      COALESCE(SUM(inflow) - SUM(outflow), 0) AS net,
      COUNT(*)::int AS line_count
    FROM base
    GROUP BY 1
  ),
  trend_monthly AS (
    SELECT
      to_char(txn_date, 'YYYY-MM') AS period,
      COALESCE(SUM(inflow), 0) AS inflow,
      COALESCE(SUM(outflow), 0) AS outflow,
      COALESCE(SUM(inflow) - SUM(outflow), 0) AS net,
      COUNT(*)::int AS line_count
    FROM base
    GROUP BY 1
  ),
  ranked_out AS (
    SELECT
      b.id,
      b.account_no,
      b.txn_date,
      b.category_key,
      b.amount,
      b.match_status,
      s.description,
      s.bank_reference,
      ROW_NUMBER() OVER (ORDER BY b.amount DESC, b.txn_date DESC) AS rn
    FROM base b
    JOIN bank.statement_lines s ON s.id = b.id
    WHERE b.direction = 'out'
  ),
  ranked_in AS (
    SELECT
      b.id,
      b.account_no,
      b.txn_date,
      b.category_key,
      b.amount,
      b.match_status,
      s.description,
      s.bank_reference,
      ROW_NUMBER() OVER (ORDER BY b.amount DESC, b.txn_date DESC) AS rn
    FROM base b
    JOIN bank.statement_lines s ON s.id = b.id
    WHERE b.direction = 'in'
  ),
  top_outflows AS (
    SELECT
      r.id::text AS key,
      COALESCE(NULLIF(btrim(r.description), ''), r.bank_reference, '(ไม่มีรายละเอียด)') AS label,
      r.account_no,
      r.txn_date::text AS txn_date,
      r.category_key,
      COALESCE(cl.label, r.category_key) AS category_label,
      r.amount AS outflow,
      r.match_status
    FROM ranked_out r
    LEFT JOIN category_label cl ON cl.key = r.category_key
    WHERE r.rn <= v_limit
  ),
  top_inflows AS (
    SELECT
      r.id::text AS key,
      COALESCE(NULLIF(btrim(r.description), ''), r.bank_reference, '(ไม่มีรายละเอียด)') AS label,
      r.account_no,
      r.txn_date::text AS txn_date,
      r.category_key,
      COALESCE(cl.label, r.category_key) AS category_label,
      r.amount AS inflow,
      r.match_status
    FROM ranked_in r
    LEFT JOIN category_label cl ON cl.key = r.category_key
    WHERE r.rn <= v_limit
  ),
  accounts AS (
    SELECT DISTINCT ON (s.account_no)
      s.account_no AS key,
      (COALESCE(NULLIF(btrim(s.bank_name), ''), '—') || ' · ' || s.account_no) AS label,
      COALESCE(NULLIF(btrim(s.bank_name), ''), '—') AS bank_name
    FROM bank.statement_lines s
    ORDER BY s.account_no, s.txn_date DESC
  ),
  report_amounts AS (
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE report_group = 'sales_in' AND direction = 'in'), 0) AS sales_in,
      COALESCE(SUM(amount) FILTER (WHERE report_group = 'ar_in' AND direction = 'in'), 0) AS ar_in,
      COALESCE(SUM(amount) FILTER (WHERE report_group = 'supplier_out' AND direction = 'out'), 0) AS supplier_out,
      COALESCE(SUM(amount) FILTER (WHERE report_group = 'payroll_out' AND direction = 'out'), 0) AS payroll_out,
      COALESCE(SUM(amount) FILTER (WHERE report_group = 'opex_out' AND direction = 'out'), 0) AS opex_out,
      COALESCE(SUM(amount) FILTER (WHERE report_group = 'other' AND direction = 'in'), 0) AS other_in,
      COALESCE(SUM(amount) FILTER (WHERE report_group = 'other' AND direction = 'out'), 0) AS other_out,
      COUNT(*) FILTER (WHERE report_group = 'other')::int AS other_count,
      COUNT(*) FILTER (WHERE report_group = 'sales_in')::int AS sales_in_count,
      COUNT(*) FILTER (WHERE report_group = 'ar_in')::int AS ar_in_count,
      COUNT(*) FILTER (WHERE report_group = 'supplier_out')::int AS supplier_out_count,
      COUNT(*) FILTER (WHERE report_group = 'payroll_out')::int AS payroll_out_count,
      COUNT(*) FILTER (WHERE report_group = 'opex_out')::int AS opex_out_count
    FROM base
  ),
  month_bounds AS (
    SELECT
      to_char(d::date, 'YYYY-MM') AS period,
      d::date AS month_start,
      LEAST(
        ((d::date + INTERVAL '1 month')::date - 1),
        p_to
      ) AS month_end
    FROM generate_series(
      date_trunc('month', p_from::timestamp)::date,
      date_trunc('month', p_to::timestamp)::date,
      INTERVAL '1 month'
    ) AS d
  ),
  month_opening AS (
    SELECT
      mb.period,
      COALESCE((
        SELECT SUM(x.balance_after)
        FROM (
          SELECT DISTINCT ON (s.account_no)
            s.balance_after::double precision AS balance_after
          FROM bank.statement_lines s
          WHERE s.txn_date < GREATEST(mb.month_start, p_from)
            AND s.balance_after IS NOT NULL
            AND (v_account IS NULL OR s.account_no = v_account)
          ORDER BY s.account_no, s.txn_date DESC, s.source_row_number DESC NULLS LAST, s.created_at DESC
        ) x
      ), 0) AS amount
    FROM month_bounds mb
  ),
  month_ending AS (
    SELECT
      mb.period,
      COALESCE((
        SELECT SUM(x.balance_after)
        FROM (
          SELECT DISTINCT ON (s.account_no)
            s.balance_after::double precision AS balance_after
          FROM bank.statement_lines s
          WHERE s.txn_date <= mb.month_end
            AND s.balance_after IS NOT NULL
            AND (v_account IS NULL OR s.account_no = v_account)
          ORDER BY s.account_no, s.txn_date DESC, s.source_row_number DESC NULLS LAST, s.created_at DESC
        ) x
      ), 0) AS amount
    FROM month_bounds mb
  ),
  report_group_month AS (
    SELECT
      to_char(txn_date, 'YYYY-MM') AS period,
      report_group AS key,
      COALESCE(SUM(amount), 0) AS amount
    FROM base
    WHERE report_group IN (
      'sales_in', 'ar_in', 'supplier_out', 'payroll_out', 'opex_out'
    )
      AND (
        (report_group IN ('sales_in', 'ar_in') AND direction = 'in')
        OR (
          report_group IN ('supplier_out', 'payroll_out', 'opex_out')
          AND direction = 'out'
        )
      )
    GROUP BY 1, 2
  ),
  report_line_defs AS (
    SELECT *
    FROM (
      VALUES
        ('opening_cash', 'เงินสดต้นงวด', 'balance', 1),
        ('sales_in', 'รับจากยอดขาย', 'in', 2),
        ('ar_in', 'รับเงินจากลูกหนี้', 'in', 3),
        ('supplier_out', 'จ่าย Supplier', 'out', 4),
        ('payroll_out', 'เงินเดือน', 'out', 5),
        ('opex_out', 'ค่าใช้จ่ายดำเนินงาน', 'out', 6),
        ('ending_cash', 'เงินสดคงเหลือ', 'balance', 7)
    ) AS t(key, label, kind, sort_order)
  ),
  report_by_month AS (
    SELECT
      d.key,
      d.label,
      d.kind,
      d.sort_order,
      CASE
        WHEN d.key = 'opening_cash' THEN COALESCE(
          (SELECT amount FROM month_opening ORDER BY period ASC LIMIT 1),
          0
        )
        WHEN d.key = 'ending_cash' THEN COALESCE(
          (SELECT amount FROM month_ending ORDER BY period DESC LIMIT 1),
          0
        )
        ELSE COALESCE(
          (SELECT SUM(r.amount) FROM report_group_month r WHERE r.key = d.key),
          0
        )
      END AS total,
      CASE
        WHEN d.key = 'opening_cash' THEN COALESCE(
          (
            SELECT jsonb_object_agg(period, amount ORDER BY period)
            FROM month_opening
          ),
          '{}'::jsonb
        )
        WHEN d.key = 'ending_cash' THEN COALESCE(
          (
            SELECT jsonb_object_agg(period, amount ORDER BY period)
            FROM month_ending
          ),
          '{}'::jsonb
        )
        ELSE COALESCE(
          (
            SELECT jsonb_object_agg(
              mb.period,
              COALESCE(rgm.amount, 0)
              ORDER BY mb.period
            )
            FROM month_bounds mb
            LEFT JOIN report_group_month rgm
              ON rgm.period = mb.period AND rgm.key = d.key
          ),
          '{}'::jsonb
        )
      END AS months
    FROM report_line_defs d
  )
  SELECT jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'account_no', v_account,
    'include_ignored', COALESCE(p_include_ignored, false),
    'limit', v_limit,
    'previous_from', v_prev_from,
    'previous_to', v_prev_to,
    'summary', (
      SELECT jsonb_build_object(
        'inflow', s.inflow,
        'outflow', s.outflow,
        'net', s.net,
        'line_count', s.line_count,
        'inflow_count', s.inflow_count,
        'outflow_count', s.outflow_count,
        'internal_in', s.internal_in,
        'internal_out', s.internal_out,
        'net_ex_internal', s.net_ex_internal,
        'unclassified_count', s.unclassified_count,
        'opening_balance', bs.opening_balance,
        'ending_balance', bs.ending_balance,
        'account_count', bs.account_count
      )
      FROM summary s
      CROSS JOIN balance_summary bs
    ),
    'previous_summary', (
      SELECT jsonb_build_object(
        'inflow', inflow,
        'outflow', outflow,
        'net', net,
        'line_count', line_count,
        'net_ex_internal', net_ex_internal
      )
      FROM prev_summary
    ),
    'report', (
      SELECT jsonb_build_object(
        'opening_cash', bs.opening_balance,
        'sales_in', ra.sales_in,
        'ar_in', ra.ar_in,
        'supplier_out', ra.supplier_out,
        'payroll_out', ra.payroll_out,
        'opex_out', ra.opex_out,
        'ending_cash', bs.ending_balance,
        'forecast_30d',
          bs.ending_balance
          + ((s.net_ex_internal / GREATEST(1, (p_to - p_from) + 1)) * 30.0),
        'forecast_daily_net',
          s.net_ex_internal / GREATEST(1, (p_to - p_from) + 1),
        'other_in', ra.other_in,
        'other_out', ra.other_out,
        'other_count', ra.other_count,
        'lines', jsonb_build_array(
          jsonb_build_object('key', 'opening_cash', 'label', 'เงินสดต้นงวด', 'amount', bs.opening_balance, 'kind', 'balance', 'line_count', NULL),
          jsonb_build_object('key', 'sales_in', 'label', 'รับจากยอดขาย', 'amount', ra.sales_in, 'kind', 'in', 'line_count', ra.sales_in_count),
          jsonb_build_object('key', 'ar_in', 'label', 'รับเงินจากลูกหนี้', 'amount', ra.ar_in, 'kind', 'in', 'line_count', ra.ar_in_count),
          jsonb_build_object('key', 'supplier_out', 'label', 'จ่าย Supplier', 'amount', ra.supplier_out, 'kind', 'out', 'line_count', ra.supplier_out_count),
          jsonb_build_object('key', 'payroll_out', 'label', 'เงินเดือน', 'amount', ra.payroll_out, 'kind', 'out', 'line_count', ra.payroll_out_count),
          jsonb_build_object('key', 'opex_out', 'label', 'ค่าใช้จ่ายดำเนินงาน', 'amount', ra.opex_out, 'kind', 'out', 'line_count', ra.opex_out_count),
          jsonb_build_object('key', 'ending_cash', 'label', 'เงินสดคงเหลือ', 'amount', bs.ending_balance, 'kind', 'balance', 'line_count', NULL),
          jsonb_build_object(
            'key', 'forecast_30d',
            'label', 'คาดการณ์เงินสด 30 วันข้างหน้า',
            'amount', bs.ending_balance + ((s.net_ex_internal / GREATEST(1, (p_to - p_from) + 1)) * 30.0),
            'kind', 'forecast',
            'line_count', NULL
          )
        )
      )
      FROM report_amounts ra
      CROSS JOIN balance_summary bs
      CROSS JOIN summary s
    ),
    'by_account', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', key,
        'label', label,
        'bank_name', bank_name,
        'inflow', inflow,
        'outflow', outflow,
        'net', net,
        'line_count', line_count,
        'ending_balance', ending_balance
      ) ORDER BY ABS(net) DESC, inflow DESC)
      FROM by_account
    ), '[]'::jsonb),
    'by_category', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', key,
        'label', label,
        'inflow', inflow,
        'outflow', outflow,
        'net', net,
        'line_count', line_count
      ) ORDER BY GREATEST(inflow, outflow) DESC, label)
      FROM by_category
    ), '[]'::jsonb),
    'by_match_status', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', key,
        'line_count', line_count,
        'inflow', inflow,
        'outflow', outflow
      ) ORDER BY line_count DESC)
      FROM by_match_status
    ), '[]'::jsonb),
    'trend_daily', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'period', period,
        'inflow', inflow,
        'outflow', outflow,
        'net', net,
        'line_count', line_count
      ) ORDER BY period)
      FROM trend_daily
    ), '[]'::jsonb),
    'trend_monthly', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'period', period,
        'inflow', inflow,
        'outflow', outflow,
        'net', net,
        'line_count', line_count
      ) ORDER BY period)
      FROM trend_monthly
    ), '[]'::jsonb),
    'top_inflows', '[]'::jsonb,
    'top_outflows', '[]'::jsonb,
    'accounts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', key,
        'label', label,
        'bank_name', bank_name
      ) ORDER BY label)
      FROM accounts
    ), '[]'::jsonb),
    'month_columns', COALESCE((
      SELECT jsonb_agg(period ORDER BY period)
      FROM month_bounds
    ), '[]'::jsonb),
    'report_by_month', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', key,
        'label', label,
        'kind', kind,
        'total', total,
        'months', months
      ) ORDER BY sort_order)
      FROM report_by_month
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.fn_bi_cashflow_overview(date, date, text, boolean, integer) IS
  'Cash-flow BI from bank.statement_lines: inflow/outflow/net, by account/category, balances, month_columns/report_by_month. Excludes match_status=ignored by default (p_include_ignored).';

REVOKE ALL ON FUNCTION public.fn_bi_cashflow_overview(date, date, text, boolean, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_bi_cashflow_overview(date, date, text, boolean, integer) TO service_role;

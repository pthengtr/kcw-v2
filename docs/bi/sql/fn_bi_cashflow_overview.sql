-- Cash-flow BI overview from bank.statement_lines (imported bank statements).
-- Amounts are actual bank cash movements (not P&L). Ignored lines excluded by default.
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
    'top_inflows', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', key,
        'label', label,
        'account_no', account_no,
        'txn_date', txn_date,
        'category_key', category_key,
        'category_label', category_label,
        'amount', inflow,
        'match_status', match_status
      ))
      FROM top_inflows
    ), '[]'::jsonb),
    'top_outflows', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', key,
        'label', label,
        'account_no', account_no,
        'txn_date', txn_date,
        'category_key', category_key,
        'category_label', category_label,
        'amount', outflow,
        'match_status', match_status
      ))
      FROM top_outflows
    ), '[]'::jsonb),
    'accounts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', key,
        'label', label,
        'bank_name', bank_name
      ) ORDER BY label)
      FROM accounts
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.fn_bi_cashflow_overview(date, date, text, boolean, integer) IS
  'Cash-flow BI from bank.statement_lines: inflow/outflow/net, by account/category, balances.';

REVOKE ALL ON FUNCTION public.fn_bi_cashflow_overview(date, date, text, boolean, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_bi_cashflow_overview(date, date, text, boolean, integer) TO service_role;

-- Cash Flow Dashboard: categories, ref map, bank account labels, view, RPCs.
-- Source facts remain bank.statement_lines (no duplicated transaction table).

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cashflow_categories (
  code text PRIMARY KEY,
  name text NOT NULL,
  name_th text NOT NULL,
  activity_type text NOT NULL CHECK (activity_type IN ('OPERATING', 'INVESTING', 'FINANCING')),
  direction text NOT NULL CHECK (direction IN ('INFLOW', 'OUTFLOW')),
  sort_order integer NOT NULL
);

CREATE TABLE IF NOT EXISTS public.cashflow_ref_map (
  matched_ref_type text PRIMARY KEY,
  cashflow_code text NOT NULL REFERENCES public.cashflow_categories (code),
  notes text
);

CREATE TABLE IF NOT EXISTS public.cashflow_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_no text NOT NULL UNIQUE,
  account_code text NOT NULL,
  account_name text NOT NULL,
  active boolean NOT NULL DEFAULT true
);

ALTER TABLE public.cashflow_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashflow_ref_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashflow_bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cashflow_categories_select_authenticated ON public.cashflow_categories;
CREATE POLICY cashflow_categories_select_authenticated
  ON public.cashflow_categories FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS cashflow_ref_map_select_authenticated ON public.cashflow_ref_map;
CREATE POLICY cashflow_ref_map_select_authenticated
  ON public.cashflow_ref_map FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS cashflow_bank_accounts_select_authenticated ON public.cashflow_bank_accounts;
CREATE POLICY cashflow_bank_accounts_select_authenticated
  ON public.cashflow_bank_accounts FOR SELECT TO authenticated USING (true);

INSERT INTO public.cashflow_categories (code, name, name_th, activity_type, direction, sort_order)
VALUES
  ('1001', 'Cash received from sales', 'เงินสดรับจากลูกค้า / ขาย', 'OPERATING', 'INFLOW', 10),
  ('1002', 'Cash paid for purchases', 'เงินสดจ่ายซื้อสินค้า', 'OPERATING', 'OUTFLOW', 20),
  ('1003', 'Operating expenses', 'ค่าใช้จ่ายดำเนินงาน', 'OPERATING', 'OUTFLOW', 30),
  ('1004', 'Interest and tax payments', 'ดอกเบี้ยและภาษีจ่าย', 'OPERATING', 'OUTFLOW', 40),
  ('2001', 'Cash from sale of assets', 'เงินสดรับจากการขายสินทรัพย์', 'INVESTING', 'INFLOW', 50),
  ('2002', 'Cash paid for asset purchases', 'เงินสดจ่ายซื้อสินทรัพย์', 'INVESTING', 'OUTFLOW', 60),
  ('3001', 'Investment / loans received', 'เงินลงทุน / กู้ยืมรับ', 'FINANCING', 'INFLOW', 70),
  ('3002', 'Dividends / loan repayments', 'เงินปันผล / ชำระเงินกู้', 'FINANCING', 'OUTFLOW', 80)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name_th = EXCLUDED.name_th,
  activity_type = EXCLUDED.activity_type,
  direction = EXCLUDED.direction,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.cashflow_ref_map (matched_ref_type, cashflow_code, notes)
VALUES
  ('tar_cntar_net', '1001', 'AR / customer receipts'),
  ('tr_bill', '1001', 'Transfer bill'),
  ('tr_bundle', '1001', 'Transfer bundle'),
  ('tr_remainder', '1001', 'Transfer remainder'),
  ('3tr_bill', '1001', '3TR bill'),
  ('rvmas', '1001', 'Receipt voucher'),
  ('rvi', '1001', 'Online marketplace settlement'),
  ('pvmas', '1002', 'Payment voucher / AP'),
  ('pimas', '1002', 'Purchase invoice payment'),
  ('pimas_possible_bundle', '1002', 'Purchase bundle'),
  ('bank_cheque', '1002', 'Cheque payment (supplier)'),
  ('expense_pv', '1003', 'Expense PV'),
  ('expense_payroll', '1003', 'Payroll'),
  ('employee_advance', '1003', 'Employee advance'),
  ('withholding_tax', '1004', 'WHT')
ON CONFLICT (matched_ref_type) DO UPDATE SET
  cashflow_code = EXCLUDED.cashflow_code,
  notes = EXCLUDED.notes;

INSERT INTO public.cashflow_bank_accounts (account_no, account_code, account_name)
VALUES
  ('064-8-91723-6', '7236', 'KBANK 7236'),
  ('248-0-42113-9', '1139', 'KTB 1139'),
  ('141-1-72355-7', '3557', 'KBANK 3557'),
  ('248-6-00618-4', '6184', 'KTB 6184'),
  ('064-8-92039-3', '0393', 'KBANK 0393'),
  ('233-1-18475-9', '4759', 'KBANK 4759')
ON CONFLICT (account_no) DO UPDATE SET
  account_code = EXCLUDED.account_code,
  account_name = EXCLUDED.account_name,
  active = true;

CREATE OR REPLACE VIEW public.v_cash_transactions
WITH (security_invoker = true)
AS
SELECT
  s.id,
  s.txn_date AS transaction_date,
  s.description,
  s.amount,
  s.direction,
  s.account_no,
  s.bank_name,
  s.bank_reference AS reference,
  s.match_status,
  s.matched_ref_type,
  s.matched_ref_id,
  s.balance_after,
  CASE
    WHEN lower(btrim(COALESCE(s.matched_ref_type, ''))) = 'internal_transfer'
      THEN NULL
    ELSE m.cashflow_code
  END AS cashflow_code,
  CASE
    WHEN lower(btrim(COALESCE(s.matched_ref_type, ''))) = 'internal_transfer'
      THEN true
    ELSE false
  END AS is_internal_transfer,
  CASE
    WHEN lower(btrim(COALESCE(s.matched_ref_type, ''))) = 'internal_transfer'
      THEN false
    WHEN m.cashflow_code IS NULL THEN true
    ELSE false
  END AS is_unclassified,
  'bank.statement_lines'::text AS source
FROM bank.statement_lines s
LEFT JOIN public.cashflow_ref_map m
  ON m.matched_ref_type = lower(btrim(COALESCE(s.matched_ref_type, '')));

COMMENT ON VIEW public.v_cash_transactions IS
  'Normalized cash transactions from bank.statement_lines with cashflow codes.';

-- ---------------------------------------------------------------------------
-- Dashboard RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_bi_cashflow_dashboard(
  p_year integer,
  p_through_month integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, bank
AS $$
DECLARE
  v_year int;
  v_through int;
  v_year_start date;
  v_year_end date;
  v_as_of date;
  v_prev_year int;
  v_result jsonb;
BEGIN
  v_year := p_year;
  IF v_year IS NULL OR v_year < 2000 OR v_year > 2100 THEN
    RAISE EXCEPTION 'Invalid year';
  END IF;

  v_through := COALESCE(p_through_month, 12);
  IF v_through < 1 OR v_through > 12 THEN
    RAISE EXCEPTION 'Invalid through month';
  END IF;

  v_year_start := make_date(v_year, 1, 1);
  v_year_end := make_date(v_year, 12, 31);
  v_as_of := (date_trunc('month', make_date(v_year, v_through, 1)) + interval '1 month - 1 day')::date;
  v_prev_year := v_year - 1;

  WITH months AS (
    SELECT gs AS month_num,
           to_char(make_date(v_year, gs, 1), 'YYYY-MM') AS period,
           make_date(v_year, gs, 1) AS month_start,
           (date_trunc('month', make_date(v_year, gs, 1)) + interval '1 month - 1 day')::date AS month_end
    FROM generate_series(1, 12) AS gs
  ),
  active_months AS (
    SELECT DISTINCT EXTRACT(MONTH FROM txn_date)::int AS month_num
    FROM bank.statement_lines
    WHERE txn_date >= v_year_start AND txn_date <= v_year_end
  ),
  classified AS (
    SELECT
      t.transaction_date,
      EXTRACT(MONTH FROM t.transaction_date)::int AS month_num,
      t.amount,
      t.direction,
      t.cashflow_code,
      t.is_internal_transfer,
      t.is_unclassified,
      t.account_no
    FROM public.v_cash_transactions t
    WHERE t.transaction_date >= v_year_start
      AND t.transaction_date <= v_as_of
  ),
  code_month AS (
    SELECT
      m.month_num,
      c.code,
      COALESCE(SUM(
        CASE
          WHEN cl.cashflow_code = c.code AND c.direction = 'INFLOW' AND cl.direction = 'in'
            THEN cl.amount
          WHEN cl.cashflow_code = c.code AND c.direction = 'OUTFLOW' AND cl.direction = 'out'
            THEN cl.amount
          ELSE 0
        END
      ), 0)::double precision AS amount,
      COUNT(*) FILTER (
        WHERE cl.cashflow_code = c.code
          AND (
            (c.direction = 'INFLOW' AND cl.direction = 'in')
            OR (c.direction = 'OUTFLOW' AND cl.direction = 'out')
          )
      )::int AS line_count,
      (m.month_num = ANY (SELECT month_num FROM active_months)) AS has_data
    FROM months m
    CROSS JOIN public.cashflow_categories c
    LEFT JOIN classified cl
      ON cl.month_num = m.month_num
     AND cl.cashflow_code = c.code
     AND NOT cl.is_internal_transfer
    GROUP BY m.month_num, c.code
  ),
  month_totals AS (
    SELECT
      month_num,
      bool_or(has_data) AS has_data,
      COALESCE(SUM(amount) FILTER (WHERE code = '1001'), 0) AS c1001,
      COALESCE(SUM(amount) FILTER (WHERE code = '1002'), 0) AS c1002,
      COALESCE(SUM(amount) FILTER (WHERE code = '1003'), 0) AS c1003,
      COALESCE(SUM(amount) FILTER (WHERE code = '1004'), 0) AS c1004,
      COALESCE(SUM(amount) FILTER (WHERE code = '2001'), 0) AS c2001,
      COALESCE(SUM(amount) FILTER (WHERE code = '2002'), 0) AS c2002,
      COALESCE(SUM(amount) FILTER (WHERE code = '3001'), 0) AS c3001,
      COALESCE(SUM(amount) FILTER (WHERE code = '3002'), 0) AS c3002
    FROM code_month
    GROUP BY month_num
  ),
  month_scf AS (
    SELECT
      month_num,
      has_data,
      c1001, c1002, c1003, c1004, c2001, c2002, c3001, c3002,
      (c1001 - c1002 - c1003 - c1004) AS operating,
      (c2001 - c2002) AS investing,
      (c3001 - c3002) AS financing,
      (c1001 - c1002 - c1003 - c1004 + c2001 - c2002 + c3001 - c3002) AS net_change,
      (c1001 + c2001 + c3001) AS cash_in,
      (c1002 + c1003 + c1004 + c2002 + c3002) AS cash_out
    FROM month_totals
  ),
  bal_open_year AS (
    SELECT COALESCE(SUM(balance_after), 0)::double precision AS opening
    FROM (
      SELECT DISTINCT ON (account_no) balance_after
      FROM bank.statement_lines
      WHERE txn_date < v_year_start
        AND balance_after IS NOT NULL
      ORDER BY account_no, txn_date DESC, source_row_number DESC NULLS LAST, created_at DESC
    ) x
  ),
  bal_by_month AS (
    SELECT
      m.month_num,
      COALESCE((
        SELECT SUM(b.balance_after)
        FROM (
          SELECT DISTINCT ON (s.account_no) s.balance_after
          FROM bank.statement_lines s
          WHERE s.txn_date < m.month_start
            AND s.balance_after IS NOT NULL
          ORDER BY s.account_no, s.txn_date DESC, s.source_row_number DESC NULLS LAST, s.created_at DESC
        ) b
      ), CASE WHEN m.month_num = 1 THEN (SELECT opening FROM bal_open_year) ELSE 0 END)::double precision AS opening_cash,
      COALESCE((
        SELECT SUM(b.balance_after)
        FROM (
          SELECT DISTINCT ON (s.account_no) s.balance_after
          FROM bank.statement_lines s
          WHERE s.txn_date <= m.month_end
            AND s.balance_after IS NOT NULL
          ORDER BY s.account_no, s.txn_date DESC, s.source_row_number DESC NULLS LAST, s.created_at DESC
        ) b
      ), 0)::double precision AS ending_cash
    FROM months m
  ),
  ytd AS (
    SELECT
      COALESCE(SUM(c1001), 0) AS c1001,
      COALESCE(SUM(c1002), 0) AS c1002,
      COALESCE(SUM(c1003), 0) AS c1003,
      COALESCE(SUM(c1004), 0) AS c1004,
      COALESCE(SUM(c2001), 0) AS c2001,
      COALESCE(SUM(c2002), 0) AS c2002,
      COALESCE(SUM(c3001), 0) AS c3001,
      COALESCE(SUM(c3002), 0) AS c3002,
      COALESCE(SUM(operating), 0) AS operating,
      COALESCE(SUM(investing), 0) AS investing,
      COALESCE(SUM(financing), 0) AS financing,
      COALESCE(SUM(net_change), 0) AS net_change,
      COALESCE(SUM(cash_in), 0) AS cash_in,
      COALESCE(SUM(cash_out), 0) AS cash_out
    FROM month_scf
    WHERE month_num <= v_through
  ),
  prev_ytd AS (
    SELECT
      COALESCE(SUM(
        CASE WHEN m.cashflow_code = '1001' AND t.direction = 'in' THEN t.amount ELSE 0 END
      ), 0)::double precision AS c1001,
      COALESCE(SUM(
        CASE WHEN m.cashflow_code = '1002' AND t.direction = 'out' THEN t.amount ELSE 0 END
      ), 0)::double precision AS c1002,
      COALESCE(SUM(
        CASE WHEN m.cashflow_code = '1003' AND t.direction = 'out' THEN t.amount ELSE 0 END
      ), 0)::double precision AS c1003,
      COALESCE(SUM(
        CASE WHEN m.cashflow_code = '1004' AND t.direction = 'out' THEN t.amount ELSE 0 END
      ), 0)::double precision AS c1004,
      COALESCE(SUM(
        CASE WHEN m.cashflow_code = '2001' AND t.direction = 'in' THEN t.amount ELSE 0 END
      ), 0)::double precision AS c2001,
      COALESCE(SUM(
        CASE WHEN m.cashflow_code = '2002' AND t.direction = 'out' THEN t.amount ELSE 0 END
      ), 0)::double precision AS c2002,
      COALESCE(SUM(
        CASE WHEN m.cashflow_code = '3001' AND t.direction = 'in' THEN t.amount ELSE 0 END
      ), 0)::double precision AS c3001,
      COALESCE(SUM(
        CASE WHEN m.cashflow_code = '3002' AND t.direction = 'out' THEN t.amount ELSE 0 END
      ), 0)::double precision AS c3002
    FROM bank.statement_lines t
    LEFT JOIN public.cashflow_ref_map m
      ON m.matched_ref_type = lower(btrim(COALESCE(t.matched_ref_type, '')))
    WHERE t.txn_date >= make_date(v_prev_year, 1, 1)
      AND t.txn_date <= (date_trunc('month', make_date(v_prev_year, v_through, 1)) + interval '1 month - 1 day')::date
      AND lower(btrim(COALESCE(t.matched_ref_type, ''))) IS DISTINCT FROM 'internal_transfer'
  ),
  prev_calc AS (
    SELECT
      c1001,
      (c1001 - c1002 - c1003 - c1004) AS operating,
      (c3001 - c3002) AS financing,
      (c1001 - c1002 - c1003 - c1004 + c2001 - c2002 + c3001 - c3002) AS net_change
    FROM prev_ytd
  ),
  unclassified AS (
    SELECT
      COUNT(*)::int AS line_count,
      COALESCE(SUM(amount) FILTER (WHERE direction = 'in'), 0)::double precision AS inflow,
      COALESCE(SUM(amount) FILTER (WHERE direction = 'out'), 0)::double precision AS outflow
    FROM classified
    WHERE is_unclassified
  ),
  -- Per-account roll-forward for operator completeness checks.
  -- Opening = last balance_after before the year, else inferred from the first
  -- line in-range (balance_after ∓ that line's amount) so variance ≈ 0 when the
  -- imported series is contiguous.
  account_keys AS (
    SELECT DISTINCT s.account_no
    FROM bank.statement_lines s
    WHERE s.txn_date <= v_as_of
  ),
  account_prior_open AS (
    SELECT DISTINCT ON (s.account_no)
      s.account_no,
      s.balance_after::double precision AS opening_balance,
      s.txn_date AS opening_as_of
    FROM bank.statement_lines s
    WHERE s.txn_date < v_year_start
      AND s.balance_after IS NOT NULL
    ORDER BY s.account_no, s.txn_date DESC, s.source_row_number DESC NULLS LAST, s.created_at DESC
  ),
  account_first_in_range AS (
    SELECT DISTINCT ON (s.account_no)
      s.account_no,
      s.txn_date AS first_txn_date,
      s.direction AS first_direction,
      s.amount::double precision AS first_amount,
      s.balance_after::double precision AS first_balance_after
    FROM bank.statement_lines s
    WHERE s.txn_date >= v_year_start
      AND s.txn_date <= v_as_of
      AND s.balance_after IS NOT NULL
    ORDER BY s.account_no, s.txn_date ASC, s.source_row_number ASC NULLS LAST, s.created_at ASC
  ),
  account_last_in_range AS (
    SELECT DISTINCT ON (s.account_no)
      s.account_no,
      s.txn_date AS last_txn_date,
      s.balance_after::double precision AS actual_balance
    FROM bank.statement_lines s
    WHERE s.txn_date >= v_year_start
      AND s.txn_date <= v_as_of
      AND s.balance_after IS NOT NULL
    ORDER BY s.account_no, s.txn_date DESC, s.source_row_number DESC NULLS LAST, s.created_at DESC
  ),
  account_period_sums AS (
    SELECT
      s.account_no,
      COALESCE(SUM(s.amount) FILTER (WHERE s.direction = 'in'), 0)::double precision AS cash_in,
      COALESCE(SUM(s.amount) FILTER (WHERE s.direction = 'out'), 0)::double precision AS cash_out,
      COUNT(*)::int AS line_count,
      MIN(s.txn_date) AS first_txn_date,
      MAX(s.txn_date) AS last_txn_date,
      MAX(NULLIF(btrim(s.bank_name), '')) AS bank_name
    FROM bank.statement_lines s
    WHERE s.txn_date >= v_year_start
      AND s.txn_date <= v_as_of
    GROUP BY s.account_no
  ),
  bank_recon AS (
    SELECT
      k.account_no AS key,
      COALESCE(a.account_code, right(replace(k.account_no, '-', ''), 4)) AS account_code,
      COALESCE(
        a.account_name,
        COALESCE(NULLIF(btrim(ps.bank_name), ''), '—') || ' · ' || k.account_no
      ) AS account_name,
      CASE
        WHEN po.opening_balance IS NOT NULL THEN po.opening_balance
        WHEN fi.first_balance_after IS NOT NULL AND fi.first_direction = 'in'
          THEN fi.first_balance_after - fi.first_amount
        WHEN fi.first_balance_after IS NOT NULL AND fi.first_direction = 'out'
          THEN fi.first_balance_after + fi.first_amount
        ELSE 0::double precision
      END AS opening_balance,
      CASE
        WHEN po.opening_balance IS NOT NULL THEN 'prior_statement'
        WHEN fi.first_balance_after IS NOT NULL THEN 'inferred'
        ELSE 'none'
      END AS opening_source,
      COALESCE(ps.cash_in, 0) AS cash_in,
      COALESCE(ps.cash_out, 0) AS cash_out,
      COALESCE(ps.line_count, 0) AS line_count,
      COALESCE(ps.first_txn_date, fi.first_txn_date) AS first_txn_date,
      COALESCE(ps.last_txn_date, la.last_txn_date) AS last_txn_date,
      (
        CASE
          WHEN po.opening_balance IS NOT NULL THEN po.opening_balance
          WHEN fi.first_balance_after IS NOT NULL AND fi.first_direction = 'in'
            THEN fi.first_balance_after - fi.first_amount
          WHEN fi.first_balance_after IS NOT NULL AND fi.first_direction = 'out'
            THEN fi.first_balance_after + fi.first_amount
          ELSE 0::double precision
        END
        + COALESCE(ps.cash_in, 0)
        - COALESCE(ps.cash_out, 0)
      ) AS calculated_closing,
      COALESCE(la.actual_balance, 0)::double precision AS actual_balance,
      (
        COALESCE(la.actual_balance, 0)
        - (
          CASE
            WHEN po.opening_balance IS NOT NULL THEN po.opening_balance
            WHEN fi.first_balance_after IS NOT NULL AND fi.first_direction = 'in'
              THEN fi.first_balance_after - fi.first_amount
            WHEN fi.first_balance_after IS NOT NULL AND fi.first_direction = 'out'
              THEN fi.first_balance_after + fi.first_amount
            ELSE 0::double precision
          END
          + COALESCE(ps.cash_in, 0)
          - COALESCE(ps.cash_out, 0)
        )
      ) AS variance
    FROM account_keys k
    LEFT JOIN public.cashflow_bank_accounts a ON a.account_no = k.account_no
    LEFT JOIN account_prior_open po ON po.account_no = k.account_no
    LEFT JOIN account_first_in_range fi ON fi.account_no = k.account_no
    LEFT JOIN account_last_in_range la ON la.account_no = k.account_no
    LEFT JOIN account_period_sums ps ON ps.account_no = k.account_no
    WHERE COALESCE(ps.line_count, 0) > 0
  ),
  opening_ytd AS (
    SELECT opening AS opening_cash FROM bal_open_year
  ),
  ending_ytd AS (
    SELECT ending_cash
    FROM bal_by_month
    WHERE month_num = v_through
  )
  SELECT jsonb_build_object(
    'year', v_year,
    'through_month', v_through,
    'as_of', v_as_of,
    'previous_year', v_prev_year,
    'summary', (
      SELECT jsonb_build_object(
        'ending_cash', (SELECT ending_cash FROM ending_ytd),
        'opening_cash', (SELECT opening_cash FROM opening_ytd),
        'sales_cash_in', y.c1001,
        'operating_cash_flow', y.operating,
        'investing_cash_flow', y.investing,
        'financing_cash_flow', y.financing,
        'net_cash_change', y.net_change,
        'cash_in', y.cash_in,
        'cash_out', y.cash_out,
        'unclassified_line_count', u.line_count,
        'unclassified_inflow', u.inflow,
        'unclassified_outflow', u.outflow
      )
      FROM ytd y CROSS JOIN unclassified u
    ),
    'previous_summary', (
      SELECT jsonb_build_object(
        'sales_cash_in', c1001,
        'operating_cash_flow', operating,
        'financing_cash_flow', financing,
        'net_cash_change', net_change
      )
      FROM prev_calc
    ),
    'monthly_movement', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'month', month_num,
        'period', to_char(make_date(v_year, month_num, 1), 'YYYY-MM'),
        'has_data', has_data,
        'cash_in', CASE WHEN has_data THEN cash_in ELSE NULL END,
        'cash_out', CASE WHEN has_data THEN cash_out ELSE NULL END,
        'net_change', CASE WHEN has_data THEN net_change ELSE NULL END
      ) ORDER BY month_num)
      FROM month_scf
    ), '[]'::jsonb),
    'balance_trend', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'month', b.month_num,
        'period', to_char(make_date(v_year, b.month_num, 1), 'YYYY-MM'),
        'has_data', COALESCE(s.has_data, false),
        'opening_cash', CASE WHEN COALESCE(s.has_data, false) THEN b.opening_cash ELSE NULL END,
        'ending_cash', CASE WHEN COALESCE(s.has_data, false) THEN b.ending_cash ELSE NULL END
      ) ORDER BY b.month_num)
      FROM bal_by_month b
      LEFT JOIN month_scf s ON s.month_num = b.month_num
    ), '[]'::jsonb),
    'statement_rows', (
      SELECT jsonb_build_array(
        jsonb_build_object('key', 'op_header', 'kind', 'section', 'label', 'Operating Activities', 'label_th', 'กิจกรรมดำเนินงาน'),
        jsonb_build_object('key', '1001', 'kind', 'line', 'code', '1001', 'label', 'Cash received from sales', 'label_th', 'เงินสดรับจากลูกค้า / ขาย', 'sign', 1,
          'months', (SELECT jsonb_object_agg(month_num::text, CASE WHEN has_data THEN c1001 ELSE NULL END) FROM month_scf),
          'ytd', (SELECT c1001 FROM ytd)),
        jsonb_build_object('key', '1002', 'kind', 'line', 'code', '1002', 'label', 'Cash paid for purchases', 'label_th', 'เงินสดจ่ายซื้อสินค้า', 'sign', -1,
          'months', (SELECT jsonb_object_agg(month_num::text, CASE WHEN has_data THEN c1002 ELSE NULL END) FROM month_scf),
          'ytd', (SELECT c1002 FROM ytd)),
        jsonb_build_object('key', '1003', 'kind', 'line', 'code', '1003', 'label', 'Operating expenses', 'label_th', 'ค่าใช้จ่ายดำเนินงาน', 'sign', -1,
          'months', (SELECT jsonb_object_agg(month_num::text, CASE WHEN has_data THEN c1003 ELSE NULL END) FROM month_scf),
          'ytd', (SELECT c1003 FROM ytd)),
        jsonb_build_object('key', '1004', 'kind', 'line', 'code', '1004', 'label', 'Interest and tax', 'label_th', 'ดอกเบี้ยและภาษีจ่าย', 'sign', -1,
          'months', (SELECT jsonb_object_agg(month_num::text, CASE WHEN has_data THEN c1004 ELSE NULL END) FROM month_scf),
          'ytd', (SELECT c1004 FROM ytd)),
        jsonb_build_object('key', 'op_net', 'kind', 'subtotal', 'label', 'Net Cash from Operating Activities', 'label_th', 'เงินสดสุทธิจากกิจกรรมดำเนินงาน',
          'months', (SELECT jsonb_object_agg(month_num::text, CASE WHEN has_data THEN operating ELSE NULL END) FROM month_scf),
          'ytd', (SELECT operating FROM ytd)),
        jsonb_build_object('key', 'inv_header', 'kind', 'section', 'label', 'Investing Activities', 'label_th', 'กิจกรรมลงทุน'),
        jsonb_build_object('key', '2001', 'kind', 'line', 'code', '2001', 'label', 'Asset sale receipts', 'label_th', 'เงินสดรับจากการขายสินทรัพย์', 'sign', 1,
          'months', (SELECT jsonb_object_agg(month_num::text, CASE WHEN has_data THEN c2001 ELSE NULL END) FROM month_scf),
          'ytd', (SELECT c2001 FROM ytd)),
        jsonb_build_object('key', '2002', 'kind', 'line', 'code', '2002', 'label', 'Asset purchases', 'label_th', 'เงินสดจ่ายซื้อสินทรัพย์', 'sign', -1,
          'months', (SELECT jsonb_object_agg(month_num::text, CASE WHEN has_data THEN c2002 ELSE NULL END) FROM month_scf),
          'ytd', (SELECT c2002 FROM ytd)),
        jsonb_build_object('key', 'inv_net', 'kind', 'subtotal', 'label', 'Net Cash from Investing Activities', 'label_th', 'เงินสดสุทธิจากกิจกรรมลงทุน',
          'months', (SELECT jsonb_object_agg(month_num::text, CASE WHEN has_data THEN investing ELSE NULL END) FROM month_scf),
          'ytd', (SELECT investing FROM ytd)),
        jsonb_build_object('key', 'fin_header', 'kind', 'section', 'label', 'Financing Activities', 'label_th', 'กิจกรรมจัดหาเงิน'),
        jsonb_build_object('key', '3001', 'kind', 'line', 'code', '3001', 'label', 'Investment / loan receipts', 'label_th', 'เงินลงทุน / กู้ยืมรับ', 'sign', 1,
          'months', (SELECT jsonb_object_agg(month_num::text, CASE WHEN has_data THEN c3001 ELSE NULL END) FROM month_scf),
          'ytd', (SELECT c3001 FROM ytd)),
        jsonb_build_object('key', '3002', 'kind', 'line', 'code', '3002', 'label', 'Dividend / loan repayment', 'label_th', 'เงินปันผล / ชำระเงินกู้', 'sign', -1,
          'months', (SELECT jsonb_object_agg(month_num::text, CASE WHEN has_data THEN c3002 ELSE NULL END) FROM month_scf),
          'ytd', (SELECT c3002 FROM ytd)),
        jsonb_build_object('key', 'fin_net', 'kind', 'subtotal', 'label', 'Net Cash from Financing Activities', 'label_th', 'เงินสดสุทธิจากกิจกรรมจัดหาเงิน',
          'months', (SELECT jsonb_object_agg(month_num::text, CASE WHEN has_data THEN financing ELSE NULL END) FROM month_scf),
          'ytd', (SELECT financing FROM ytd)),
        jsonb_build_object('key', 'net_change', 'kind', 'total', 'label', 'Net Increase / Decrease in Cash', 'label_th', 'เงินสดเพิ่มขึ้น (ลดลง) สุทธิ',
          'months', (SELECT jsonb_object_agg(month_num::text, CASE WHEN has_data THEN net_change ELSE NULL END) FROM month_scf),
          'ytd', (SELECT net_change FROM ytd)),
        jsonb_build_object('key', 'opening', 'kind', 'balance', 'label', 'Opening Cash', 'label_th', 'เงินสดต้นงวด',
          'months', (SELECT jsonb_object_agg(b.month_num::text, CASE WHEN COALESCE(s.has_data, false) THEN b.opening_cash ELSE NULL END)
                     FROM bal_by_month b LEFT JOIN month_scf s ON s.month_num = b.month_num),
          'ytd', (SELECT opening_cash FROM opening_ytd)),
        jsonb_build_object('key', 'ending', 'kind', 'balance', 'label', 'Ending Cash', 'label_th', 'เงินสดปลายงวด',
          'months', (SELECT jsonb_object_agg(b.month_num::text, CASE WHEN COALESCE(s.has_data, false) THEN b.ending_cash ELSE NULL END)
                     FROM bal_by_month b LEFT JOIN month_scf s ON s.month_num = b.month_num),
          'ytd', (SELECT ending_cash FROM ending_ytd))
      )
    ),
    'operating_breakdown', (
      SELECT jsonb_build_array(
        jsonb_build_object(
          'key', '1002', 'label', 'Inventory / purchases', 'label_th', 'ซื้อสินค้า',
          'amount', c1002,
          'share_of_sales', CASE WHEN c1001 > 0 THEN c1002 / c1001 ELSE NULL END
        ),
        jsonb_build_object(
          'key', '1003', 'label', 'Operating expenses', 'label_th', 'ค่าใช้จ่ายดำเนินงาน',
          'amount', c1003,
          'share_of_sales', CASE WHEN c1001 > 0 THEN c1003 / c1001 ELSE NULL END
        ),
        jsonb_build_object(
          'key', '1004', 'label', 'Tax and interest', 'label_th', 'ดอกเบี้ยและภาษี',
          'amount', c1004,
          'share_of_sales', CASE WHEN c1001 > 0 THEN c1004 / c1001 ELSE NULL END
        )
      )
      FROM ytd
    ),
    'bank_reconciliation', (
      SELECT jsonb_build_object(
        'total_actual_balance', COALESCE((SELECT SUM(actual_balance) FROM bank_recon), 0),
        'total_calculated_balance', COALESCE((SELECT SUM(calculated_closing) FROM bank_recon), 0),
        'difference', COALESCE((SELECT SUM(actual_balance) - SUM(calculated_closing) FROM bank_recon), 0),
        'accounts_ok', COALESCE((
          SELECT COUNT(*)::int FROM bank_recon WHERE ABS(variance) < 0.01
        ), 0),
        'accounts_gap', COALESCE((
          SELECT COUNT(*)::int FROM bank_recon WHERE ABS(variance) >= 0.01
        ), 0),
        'accounts', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'key', key,
            'account_code', account_code,
            'account_name', account_name,
            'opening_balance', opening_balance,
            'opening_source', opening_source,
            'cash_in', cash_in,
            'cash_out', cash_out,
            'line_count', line_count,
            'first_txn_date', first_txn_date,
            'last_txn_date', last_txn_date,
            'calculated_closing', calculated_closing,
            'actual_balance', actual_balance,
            'variance', variance,
            'is_complete', ABS(variance) < 0.01
          ) ORDER BY
            CASE WHEN ABS(variance) >= 0.01 THEN 0 ELSE 1 END,
            account_code,
            account_name)
          FROM bank_recon
        ), '[]'::jsonb)
      )
    ),
    'available_years', COALESCE((
      SELECT jsonb_agg(y ORDER BY y DESC)
      FROM (
        SELECT DISTINCT EXTRACT(YEAR FROM txn_date)::int AS y
        FROM bank.statement_lines
      ) yrs
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.fn_bi_cashflow_dashboard(integer, integer) IS
  'Cash Flow Dashboard: SCF by codes 1001-3002 from bank.statement_lines.';

REVOKE ALL ON FUNCTION public.fn_bi_cashflow_dashboard(integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_bi_cashflow_dashboard(integer, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- Drilldown RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_bi_cashflow_drilldown(
  p_year integer,
  p_month integer,
  p_code text,
  p_limit integer DEFAULT 200
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, bank
AS $$
DECLARE
  v_from date;
  v_to date;
  v_limit int;
  v_code text;
BEGIN
  IF p_year IS NULL OR p_month IS NULL OR p_month < 1 OR p_month > 12 THEN
    RAISE EXCEPTION 'Invalid year/month';
  END IF;
  v_code := NULLIF(btrim(COALESCE(p_code, '')), '');
  IF v_code IS NULL THEN
    RAISE EXCEPTION 'Invalid code';
  END IF;
  v_from := make_date(p_year, p_month, 1);
  v_to := (date_trunc('month', v_from) + interval '1 month - 1 day')::date;
  v_limit := GREATEST(1, LEAST(COALESCE(p_limit, 200), 500));

  RETURN (
    SELECT jsonb_build_object(
      'year', p_year,
      'month', p_month,
      'code', v_code,
      'from', v_from,
      'to', v_to,
      'lines', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', id,
          'transaction_date', transaction_date,
          'description', description,
          'account_no', account_no,
          'bank_name', bank_name,
          'amount', amount,
          'direction', direction,
          'cashflow_code', cashflow_code,
          'matched_ref_type', matched_ref_type,
          'reference', reference,
          'match_status', match_status
        ) ORDER BY amount DESC, transaction_date DESC)
        FROM (
          SELECT *
          FROM public.v_cash_transactions t
          WHERE t.transaction_date >= v_from
            AND t.transaction_date <= v_to
            AND t.cashflow_code = v_code
            AND NOT t.is_internal_transfer
          ORDER BY t.amount DESC, t.transaction_date DESC
          LIMIT v_limit
        ) x
      ), '[]'::jsonb)
    )
  );
END;
$$;

COMMENT ON FUNCTION public.fn_bi_cashflow_drilldown(integer, integer, text, integer) IS
  'Cash Flow Dashboard drilldown lines for a code/month.';

REVOKE ALL ON FUNCTION public.fn_bi_cashflow_drilldown(integer, integer, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_bi_cashflow_drilldown(integer, integer, text, integer) TO service_role;

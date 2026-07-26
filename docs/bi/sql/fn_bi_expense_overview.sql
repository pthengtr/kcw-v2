-- Expense BI overview from public app tables (not raw_kcw).
-- Amount rules match fn_item_year_summary_all / entries / general.
-- See docs/bi/kcw-expense-data-dictionary.md.

CREATE OR REPLACE FUNCTION public.fn_bi_expense_overview(
  p_from date,
  p_to date,
  p_branch uuid DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_limit integer DEFAULT 30,
  p_timezone text DEFAULT 'Asia/Bangkok'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_prev_from date;
  v_prev_to date;
  v_span int;
  v_limit int;
  v_source text;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'Invalid date range';
  END IF;

  v_source := NULLIF(upper(btrim(COALESCE(p_source, ''))), '');
  IF v_source IS NOT NULL AND v_source NOT IN ('ENTRIES', 'GENERAL') THEN
    RAISE EXCEPTION 'Invalid source';
  END IF;

  IF p_branch IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.branch b WHERE b.branch_uuid = p_branch
  ) THEN
    RAISE EXCEPTION 'Invalid branch';
  END IF;

  v_limit := GREATEST(1, LEAST(COALESCE(p_limit, 30), 200));
  v_span := (p_to - p_from);
  v_prev_to := p_from - 1;
  v_prev_from := v_prev_to - v_span;

  WITH entry_base AS (
    SELECT
      e.entry_uuid,
      e.item_uuid,
      i.item_name,
      c.category_uuid,
      c.category_name,
      r.receipt_uuid,
      r.branch_uuid,
      b.branch_name,
      (r.receipt_date AT TIME ZONE p_timezone)::date AS expense_date,
      CASE WHEN COALESCE(r.signed_total, 0) < 0 THEN -1.0 ELSE 1.0 END AS sign_factor,
      GREATEST((e.entry_amount - e.discount), 0)::double precision AS entry_net,
      r.discount AS receipt_discount,
      (1 + ((r.vat - r.withholding) / 100.0))::double precision AS factor
    FROM public.expense_entry e
    JOIN public.expense_receipt r ON r.receipt_uuid = e.receipt_uuid
    JOIN public.expense_item i ON i.item_uuid = e.item_uuid
    JOIN public.expense_category c ON c.category_uuid = i.category_uuid
    JOIN public.branch b ON b.branch_uuid = r.branch_uuid
    WHERE (r.receipt_date AT TIME ZONE p_timezone)::date >= p_from
      AND (r.receipt_date AT TIME ZONE p_timezone)::date <= p_to
      AND (p_branch IS NULL OR r.branch_uuid = p_branch)
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
      'ENTRIES'::text AS source,
      entry_uuid AS row_id,
      item_uuid,
      item_name,
      category_uuid,
      category_name,
      receipt_uuid,
      branch_uuid,
      branch_name,
      expense_date,
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
      'GENERAL'::text AS source,
      g.general_uuid AS row_id,
      i.item_uuid,
      i.item_name,
      c.category_uuid,
      c.category_name,
      NULL::uuid AS receipt_uuid,
      g.branch_uuid,
      b.branch_name,
      (g.entry_date AT TIME ZONE p_timezone)::date AS expense_date,
      (g.unit_price * g.quantity)::double precision AS amount
    FROM public.expense_general g
    JOIN public.expense_item i ON i.item_uuid = g.item_uuid
    JOIN public.expense_category c ON c.category_uuid = i.category_uuid
    JOIN public.branch b ON b.branch_uuid = g.branch_uuid
    WHERE (g.entry_date AT TIME ZONE p_timezone)::date >= p_from
      AND (g.entry_date AT TIME ZONE p_timezone)::date <= p_to
      AND (p_branch IS NULL OR g.branch_uuid = p_branch)
  ),
  combined AS (
    SELECT * FROM entries_effective
    WHERE v_source IS NULL OR v_source = 'ENTRIES'
    UNION ALL
    SELECT * FROM general_effective
    WHERE v_source IS NULL OR v_source = 'GENERAL'
  ),
  prev_entry_base AS (
    SELECT
      e.entry_uuid,
      e.item_uuid,
      r.receipt_uuid,
      CASE WHEN COALESCE(r.signed_total, 0) < 0 THEN -1.0 ELSE 1.0 END AS sign_factor,
      GREATEST((e.entry_amount - e.discount), 0)::double precision AS entry_net,
      r.discount AS receipt_discount,
      (1 + ((r.vat - r.withholding) / 100.0))::double precision AS factor
    FROM public.expense_entry e
    JOIN public.expense_receipt r ON r.receipt_uuid = e.receipt_uuid
    WHERE (r.receipt_date AT TIME ZONE p_timezone)::date >= v_prev_from
      AND (r.receipt_date AT TIME ZONE p_timezone)::date <= v_prev_to
      AND (p_branch IS NULL OR r.branch_uuid = p_branch)
  ),
  prev_entry_shares AS (
    SELECT
      entry_uuid,
      item_uuid,
      receipt_uuid,
      sign_factor,
      entry_net,
      SUM(entry_net) OVER (PARTITION BY receipt_uuid) AS receipt_net_sum,
      receipt_discount,
      factor
    FROM prev_entry_base
  ),
  prev_entries AS (
    SELECT
      'ENTRIES'::text AS source,
      item_uuid,
      CASE
        WHEN receipt_net_sum > 0
          THEN sign_factor
            * (entry_net - (entry_net / receipt_net_sum) * receipt_discount)
            * factor
        ELSE 0
      END AS amount
    FROM prev_entry_shares
  ),
  prev_general AS (
    SELECT
      'GENERAL'::text AS source,
      g.item_uuid,
      (g.unit_price * g.quantity)::double precision AS amount
    FROM public.expense_general g
    WHERE (g.entry_date AT TIME ZONE p_timezone)::date >= v_prev_from
      AND (g.entry_date AT TIME ZONE p_timezone)::date <= v_prev_to
      AND (p_branch IS NULL OR g.branch_uuid = p_branch)
  ),
  prev_combined AS (
    SELECT * FROM prev_entries
    WHERE v_source IS NULL OR v_source = 'ENTRIES'
    UNION ALL
    SELECT * FROM prev_general
    WHERE v_source IS NULL OR v_source = 'GENERAL'
  ),
  summary AS (
    SELECT
      COALESCE(SUM(amount), 0) AS amount,
      COUNT(*)::int AS line_count,
      COUNT(DISTINCT item_uuid)::int AS item_count,
      COUNT(DISTINCT receipt_uuid) FILTER (WHERE source = 'ENTRIES')::int AS receipt_count,
      COUNT(*) FILTER (WHERE source = 'GENERAL')::int AS general_count,
      COALESCE(SUM(amount) FILTER (WHERE source = 'ENTRIES'), 0) AS entries_amount,
      COALESCE(SUM(amount) FILTER (WHERE source = 'GENERAL'), 0) AS general_amount
    FROM combined
  ),
  prev_summary AS (
    SELECT
      COALESCE(SUM(amount), 0) AS amount,
      COUNT(*)::int AS line_count,
      COUNT(DISTINCT item_uuid)::int AS item_count
    FROM prev_combined
  ),
  by_source AS (
    SELECT
      source AS key,
      SUM(amount) AS amount,
      COUNT(*)::int AS line_count
    FROM combined
    GROUP BY 1
  ),
  by_branch AS (
    SELECT
      branch_uuid::text AS key,
      MAX(branch_name) AS label,
      SUM(amount) AS amount,
      COUNT(*)::int AS line_count
    FROM combined
    GROUP BY branch_uuid
  ),
  by_category AS (
    SELECT
      category_uuid::text AS key,
      MAX(category_name) AS label,
      SUM(amount) AS amount,
      COUNT(DISTINCT item_uuid)::int AS item_count,
      COUNT(*)::int AS line_count
    FROM combined
    GROUP BY category_uuid
  ),
  by_item AS (
    SELECT
      item_uuid::text AS key,
      MAX(item_name) AS label,
      MAX(category_name) AS category_name,
      SUM(amount) AS amount,
      COUNT(*)::int AS line_count,
      COALESCE(SUM(amount) FILTER (WHERE source = 'ENTRIES'), 0) AS entries_amount,
      COALESCE(SUM(amount) FILTER (WHERE source = 'GENERAL'), 0) AS general_amount
    FROM combined
    GROUP BY item_uuid
  ),
  top_items AS (
    SELECT *
    FROM by_item
    ORDER BY amount DESC, label
    LIMIT v_limit
  ),
  trend_monthly AS (
    SELECT
      to_char(expense_date, 'YYYY-MM') AS period,
      SUM(amount) AS amount,
      COUNT(*)::int AS line_count,
      COALESCE(SUM(amount) FILTER (WHERE source = 'ENTRIES'), 0) AS entries_amount,
      COALESCE(SUM(amount) FILTER (WHERE source = 'GENERAL'), 0) AS general_amount
    FROM combined
    GROUP BY 1
  ),
  branches AS (
    SELECT
      branch_uuid::text AS key,
      branch_name AS label
    FROM public.branch
    ORDER BY branch_name
  )
  SELECT jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'branch', p_branch,
    'source', v_source,
    'limit', v_limit,
    'previous_from', v_prev_from,
    'previous_to', v_prev_to,
    'summary', (
      SELECT jsonb_build_object(
        'amount', amount,
        'line_count', line_count,
        'item_count', item_count,
        'receipt_count', receipt_count,
        'general_count', general_count,
        'entries_amount', entries_amount,
        'general_amount', general_amount
      ) FROM summary
    ),
    'previous_summary', (
      SELECT jsonb_build_object(
        'amount', amount,
        'line_count', line_count,
        'item_count', item_count
      ) FROM prev_summary
    ),
    'by_source', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', key,
        'amount', amount,
        'line_count', line_count
      ) ORDER BY key)
      FROM by_source
    ), '[]'::jsonb),
    'by_branch', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', key,
        'label', label,
        'amount', amount,
        'line_count', line_count
      ) ORDER BY amount DESC)
      FROM by_branch
    ), '[]'::jsonb),
    'by_category', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', key,
        'label', label,
        'amount', amount,
        'item_count', item_count,
        'line_count', line_count
      ) ORDER BY amount DESC)
      FROM by_category
    ), '[]'::jsonb),
    'top_items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', key,
        'label', label,
        'category_name', category_name,
        'amount', amount,
        'line_count', line_count,
        'entries_amount', entries_amount,
        'general_amount', general_amount
      ) ORDER BY amount DESC, label)
      FROM top_items
    ), '[]'::jsonb),
    'trend_monthly', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'period', period,
        'amount', amount,
        'line_count', line_count,
        'entries_amount', entries_amount,
        'general_amount', general_amount
      ) ORDER BY period)
      FROM trend_monthly
    ), '[]'::jsonb),
    'branches', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', key,
        'label', label
      ) ORDER BY label)
      FROM branches
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.fn_bi_expense_overview(date, date, uuid, text, integer, text) IS
  'Expense BI from public.expense_*: company entries + general; same amount rules as year-summary RPCs.';

GRANT EXECUTE ON FUNCTION public.fn_bi_expense_overview(date, date, uuid, text, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_bi_expense_overview(date, date, uuid, text, integer, text) TO authenticated;

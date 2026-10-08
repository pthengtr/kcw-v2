-- Keep the VAT register page under the API statement timeout.
-- Reminder matching stays, but note lookups use the open month and one hash join.

CREATE OR REPLACE FUNCTION public.fn_vat_register_json(
  p_from date,
  p_to date,
  p_branch text DEFAULT NULL,
  p_side text DEFAULT NULL,
  p_expense text DEFAULT 'created'
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, curated_kcw, raw_kcw, billgen, ops
AS $$
  WITH books AS MATERIALIZED (
    SELECT r.*
    FROM public.fn_vat_register(p_from, p_to, p_expense) r
    WHERE (p_branch IS NULL OR r.branch = p_branch)
      AND (p_side IS NULL OR r.side = p_side)
  ),
  -- Same date window as the book. A bill number can exist in other years, and
  -- an unscoped lookup both times out and can attach the wrong note.
  purchase_notes AS MATERIALIZED (
    SELECT DISTINCT ON (upper(btrim(p."BILLNO")))
      upper(btrim(p."BILLNO")) AS bill_no,
      nullif(btrim(p."NOTENO"), '') AS noteno
    FROM raw_kcw.raw_hq_pimas_purchase_bills p
    WHERE p."BILLDATE" >= p_from::text
      AND p."BILLDATE" < (p_to + 1)::text
      AND nullif(btrim(p."BILLNO"), '') IS NOT NULL
    ORDER BY
      upper(btrim(p."BILLNO")),
      (curated_kcw.fn_vat_num(p."TAX") = 0),
      p._ingested_at DESC NULLS LAST
  ),
  sales_notes AS MATERIALIZED (
    SELECT DISTINCT ON (upper(btrim(s."BILLNO")))
      upper(btrim(s."BILLNO")) AS bill_no,
      nullif(btrim(s."NOTENO"), '') AS noteno
    FROM curated_kcw.fact_sales_bills_all s
    WHERE s."BILLDATE" >= p_from::text
      AND s."BILLDATE" < (p_to + 1)::text
      AND nullif(btrim(s."BILLNO"), '') IS NOT NULL
      AND nullif(btrim(s."NOTENO"), '') IS NOT NULL
    ORDER BY upper(btrim(s."BILLNO"))
  ),
  reminder_keys AS MATERIALIZED (
    SELECT lower(btrim(note_id)) AS note_key, count(*)::int AS note_count
    FROM public.payment_reminder
    WHERE nullif(btrim(note_id), '') IS NOT NULL
    GROUP BY 1
  ),
  paid_reminders AS MATERIALIZED (
    SELECT
      lower(btrim(r.note_id)) AS note_key,
      nullif(lower(btrim(py.party_name)), '') AS party_key,
      r.payment_date,
      k.note_count
    FROM public.payment_reminder r
    JOIN reminder_keys k ON k.note_key = lower(btrim(r.note_id))
    LEFT JOIN public.party py ON py.party_uuid = r.party_uuid
    WHERE r.payment_date IS NOT NULL
      AND nullif(btrim(r.note_id), '') IS NOT NULL
  ),
  line_keys AS MATERIALIZED (
    SELECT
      b.line_key,
      lower(b.bill_no) AS note_key,
      nullif(lower(btrim(b.party_name)), '') AS party_key
    FROM books b
    WHERE nullif(btrim(b.bill_no), '') IS NOT NULL

    UNION ALL

    SELECT
      b.line_key,
      lower(pn.noteno),
      nullif(lower(btrim(b.party_name)), '')
    FROM books b
    JOIN purchase_notes pn
      ON b.side = 'purchase'
     AND b.source = 'parts9'
     AND pn.bill_no = b.bill_no
    WHERE pn.noteno IS NOT NULL

    UNION ALL

    SELECT
      b.line_key,
      lower(sn.noteno),
      nullif(lower(btrim(b.party_name)), '')
    FROM books b
    JOIN sales_notes sn
      ON b.side = 'sales'
     AND b.source = 'parts9'
     AND sn.bill_no = b.bill_no
    WHERE sn.noteno IS NOT NULL

    UNION ALL

    SELECT
      b.line_key,
      lower(b.remark),
      nullif(lower(btrim(b.party_name)), '')
    FROM books b
    WHERE b.source = 'expense'
      AND nullif(btrim(b.remark), '') IS NOT NULL
  ),
  matched AS MATERIALIZED (
    SELECT DISTINCT ON (k.line_key)
      k.line_key,
      pr.payment_date
    FROM line_keys k
    JOIN paid_reminders pr ON pr.note_key = k.note_key
    WHERE pr.note_count = 1
       OR (
         k.party_key IS NOT NULL
         AND pr.party_key = k.party_key
       )
    ORDER BY k.line_key, pr.payment_date DESC
  ),
  files AS MATERIALIZED (
    SELECT
      line_key,
      count(*) FILTER (WHERE kind = 'invoice')::int AS invoice_count,
      count(*) FILTER (WHERE kind = 'receipt')::int AS receipt_count
    FROM ops.vat_line_files
    GROUP BY line_key
  )
  SELECT coalesce(
    jsonb_agg(
      (
        to_jsonb(b) || jsonb_build_object(
          'paid_status', CASE
            WHEN e.paid_status = 'paid' OR rem.payment_date IS NOT NULL THEN 'paid'
            ELSE 'unpaid'
          END,
          'paid_on', CASE
            WHEN e.paid_status = 'paid' AND e.paid_on IS NOT NULL THEN e.paid_on
            WHEN rem.payment_date IS NOT NULL THEN rem.payment_date::date
            ELSE e.paid_on
          END,
          'paid_from_reminder', rem.payment_date IS NOT NULL,
          'note', e.note,
          'invoice_count', coalesce(f.invoice_count, 0),
          'receipt_count', coalesce(f.receipt_count, 0)
        )
      )
      ORDER BY b.bill_date, b.bill_no
    ),
    '[]'::jsonb
  )
  FROM books b
  LEFT JOIN ops.vat_line_evidence e ON e.line_key = b.line_key
  LEFT JOIN files f ON f.line_key = b.line_key
  LEFT JOIN matched rem ON rem.line_key = b.line_key;
$$;

REVOKE ALL ON FUNCTION public.fn_vat_register_json(date, date, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_vat_register_json(date, date, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_vat_register_json(date, date, text, text, text) TO service_role;

COMMENT ON FUNCTION public.fn_vat_register_json(date, date, text, text, text) IS
  'VAT book lines plus evidence counts. paid_from_reminder matches a paid payment reminder inside the same date window.';

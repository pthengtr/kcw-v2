-- Mark VAT book lines paid when a payment reminder with the same document number is already paid.

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
  WITH books AS (
    SELECT r.*
    FROM public.fn_vat_register(p_from, p_to, p_expense) r
    WHERE (p_branch IS NULL OR r.branch = p_branch)
      AND (p_side IS NULL OR r.side = p_side)
  ),
  purchase_notes AS (
    SELECT DISTINCT ON (upper(btrim(p."BILLNO")))
      upper(btrim(p."BILLNO")) AS bill_no,
      nullif(btrim(p."NOTENO"), '') AS noteno
    FROM raw_kcw.raw_hq_pimas_purchase_bills p
    WHERE upper(btrim(p."BILLNO")) IN (
      SELECT b.bill_no FROM books b WHERE b.side = 'purchase' AND b.source = 'parts9'
    )
    ORDER BY upper(btrim(p."BILLNO")), p._ingested_at DESC NULLS LAST
  ),
  sales_notes AS (
    SELECT DISTINCT ON (upper(btrim(s."BILLNO")))
      upper(btrim(s."BILLNO")) AS bill_no,
      nullif(btrim(s."NOTENO"), '') AS noteno
    FROM curated_kcw.fact_sales_bills_all s
    WHERE upper(btrim(s."BILLNO")) IN (
      SELECT b.bill_no FROM books b WHERE b.side = 'sales' AND b.source = 'parts9'
    )
      AND nullif(btrim(s."NOTENO"), '') IS NOT NULL
    ORDER BY upper(btrim(s."BILLNO"))
  ),
  reminder_keys AS (
    SELECT lower(btrim(note_id)) AS note_key, count(*)::int AS note_count
    FROM public.payment_reminder
    WHERE nullif(btrim(note_id), '') IS NOT NULL
    GROUP BY 1
  ),
  paid_reminders AS (
    SELECT
      lower(btrim(r.note_id)) AS note_key,
      nullif(lower(btrim(py.party_name)), '') AS party_key,
      r.payment_date,
      k.note_count
    FROM public.payment_reminder r
    JOIN reminder_keys k ON k.note_key = lower(btrim(r.note_id))
    LEFT JOIN public.party py ON py.party_uuid = r.party_uuid
    WHERE r.payment_date IS NOT NULL
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
  LEFT JOIN purchase_notes pn
    ON b.side = 'purchase' AND b.source = 'parts9' AND pn.bill_no = b.bill_no
  LEFT JOIN sales_notes sn
    ON b.side = 'sales' AND b.source = 'parts9' AND sn.bill_no = b.bill_no
  LEFT JOIN ops.vat_line_evidence e ON e.line_key = b.line_key
  LEFT JOIN (
    SELECT
      line_key,
      count(*) FILTER (WHERE kind = 'invoice')::int AS invoice_count,
      count(*) FILTER (WHERE kind = 'receipt')::int AS receipt_count
    FROM ops.vat_line_files
    GROUP BY line_key
  ) f ON f.line_key = b.line_key
  LEFT JOIN LATERAL (
    SELECT pr.payment_date
    FROM paid_reminders pr
    WHERE pr.note_key = ANY (ARRAY[
      lower(b.bill_no),
      lower(coalesce(pn.noteno, '')),
      lower(coalesce(sn.noteno, '')),
      CASE
        WHEN b.source = 'expense' THEN lower(coalesce(b.remark, ''))
        ELSE ''
      END
    ])
      AND pr.note_key <> ''
      AND (
        pr.note_count = 1
        OR (
          nullif(lower(btrim(coalesce(b.party_name, ''))), '') IS NOT NULL
          AND pr.party_key = lower(btrim(b.party_name))
        )
      )
    ORDER BY pr.payment_date DESC
    LIMIT 1
  ) rem ON true;
$$;

REVOKE ALL ON FUNCTION public.fn_vat_register_json(date, date, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_vat_register_json(date, date, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_vat_register_json(date, date, text, text, text) TO service_role;

COMMENT ON FUNCTION public.fn_vat_register_json(date, date, text, text, text) IS
  'VAT book lines plus evidence counts. paid_from_reminder is true when note_id matches a paid payment reminder.';

-- Personal-offset helpers for expense_general.ref_receipt_uuid.
-- Offset rows are negative general expenses linked to a company RECEIPT.
-- VAT BI / taxed P&L ignore general; overall BI includes them.

ALTER TABLE public.expense_general
  ADD COLUMN IF NOT EXISTS ref_receipt_uuid uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'expense_general_ref_receipt_uuid_fkey'
  ) THEN
    ALTER TABLE public.expense_general
      ADD CONSTRAINT expense_general_ref_receipt_uuid_fkey
      FOREIGN KEY (ref_receipt_uuid)
      REFERENCES public.expense_receipt (receipt_uuid)
      ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS expense_general_ref_receipt_uuid_idx
  ON public.expense_general (ref_receipt_uuid)
  WHERE ref_receipt_uuid IS NOT NULL;

INSERT INTO public.expense_category (category_name)
SELECT 'หักส่วนตัวจากบิลบริษัท'
WHERE NOT EXISTS (
  SELECT 1 FROM public.expense_category WHERE category_name = 'หักส่วนตัวจากบิลบริษัท'
);

INSERT INTO public.expense_item (item_name, category_uuid)
SELECT 'หักส่วนตัวจากบิลบริษัท', c.category_uuid
FROM public.expense_category c
WHERE c.category_name = 'หักส่วนตัวจากบิลบริษัท'
  AND NOT EXISTS (
    SELECT 1 FROM public.expense_item WHERE item_name = 'หักส่วนตัวจากบิลบริษัท'
  );

CREATE OR REPLACE FUNCTION public.fn_expense_receipt_opex(p_receipt uuid)
RETURNS double precision
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH entry_base AS (
    SELECT
      CASE WHEN COALESCE(r.signed_total, 0) < 0 THEN -1.0 ELSE 1.0 END AS sign_factor,
      GREATEST((e.entry_amount - e.discount), 0)::double precision AS entry_net,
      r.discount AS receipt_discount,
      (1 + ((r.vat - r.withholding) / 100.0))::double precision AS factor
    FROM public.expense_entry e
    JOIN public.expense_receipt r ON r.receipt_uuid = e.receipt_uuid
    WHERE r.receipt_uuid = p_receipt
  ),
  shares AS (
    SELECT
      sign_factor,
      entry_net,
      receipt_discount,
      factor,
      SUM(entry_net) OVER () AS receipt_net_sum
    FROM entry_base
  )
  SELECT COALESCE(SUM(
    CASE
      WHEN receipt_net_sum > 0
        THEN sign_factor
          * (entry_net - (entry_net / receipt_net_sum) * receipt_discount)
          * factor
      ELSE 0
    END
  ), 0)::double precision
  FROM shares;
$$;

COMMENT ON FUNCTION public.fn_expense_receipt_opex(uuid) IS
  'Company-bill OpEx amount using the same formula as fn_bi_expense_overview ENTRIES.';

CREATE OR REPLACE FUNCTION public.fn_expense_receipt_offset_summary(
  p_receipt uuid,
  p_exclude uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claimed double precision;
  v_cn double precision;
  v_already double precision;
BEGIN
  IF p_receipt IS NULL THEN
    RAISE EXCEPTION 'Missing receipt';
  END IF;

  v_claimed := public.fn_expense_receipt_opex(p_receipt);

  SELECT COALESCE(SUM(public.fn_expense_receipt_opex(r.receipt_uuid)), 0)
    INTO v_cn
    FROM public.expense_receipt r
   WHERE r.ref_receipt_uuid = p_receipt
     AND r.doc_type = 'CREDIT_NOTE';

  SELECT COALESCE(SUM(g.unit_price * g.quantity), 0)
    INTO v_already
    FROM public.expense_general g
   WHERE g.ref_receipt_uuid = p_receipt
     AND (p_exclude IS NULL OR g.general_uuid <> p_exclude);

  RETURN jsonb_build_object(
    'claimed_opex', ROUND(v_claimed::numeric, 2),
    'cn_opex', ROUND(v_cn::numeric, 2),
    'already_offset', ROUND(v_already::numeric, 2),
    'remaining', ROUND((v_claimed + v_cn + v_already)::numeric, 2)
  );
END;
$$;

COMMENT ON FUNCTION public.fn_expense_receipt_offset_summary(uuid, uuid) IS
  'Claimed OpEx vs linked personal offsets for a company RECEIPT. remaining is how much can still be offset.';

CREATE OR REPLACE FUNCTION public.fn_expense_general_offset_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_claimed double precision;
  v_cn double precision;
  v_other_offsets double precision;
  v_new_amount double precision;
BEGIN
  IF NEW.ref_receipt_uuid IS NULL THEN
    RETURN NEW;
  END IF;

  v_new_amount := NEW.unit_price * NEW.quantity;

  IF v_new_amount >= 0 THEN
    RAISE EXCEPTION 'รายการหักจากบิลบริษัทต้องมียอดติดลบ';
  END IF;

  SELECT receipt_uuid, doc_type, branch_uuid
    INTO rec
    FROM public.expense_receipt
   WHERE receipt_uuid = NEW.ref_receipt_uuid;

  IF NOT FOUND OR rec.doc_type <> 'RECEIPT' THEN
    RAISE EXCEPTION 'ต้องอ้างอิงบิลค่าใช้จ่ายบริษัท (RECEIPT)';
  END IF;

  IF rec.branch_uuid IS DISTINCT FROM NEW.branch_uuid THEN
    RAISE EXCEPTION 'สาขาของรายการหักต้องตรงกับบิลบริษัท';
  END IF;

  v_claimed := public.fn_expense_receipt_opex(NEW.ref_receipt_uuid);

  SELECT COALESCE(SUM(public.fn_expense_receipt_opex(r.receipt_uuid)), 0)
    INTO v_cn
    FROM public.expense_receipt r
   WHERE r.ref_receipt_uuid = NEW.ref_receipt_uuid
     AND r.doc_type = 'CREDIT_NOTE';

  SELECT COALESCE(SUM(g.unit_price * g.quantity), 0)
    INTO v_other_offsets
    FROM public.expense_general g
   WHERE g.ref_receipt_uuid = NEW.ref_receipt_uuid
     AND g.general_uuid IS DISTINCT FROM NEW.general_uuid;

  IF (v_claimed + v_cn + v_other_offsets + v_new_amount) < -0.05 THEN
    RAISE EXCEPTION 'ยอดหักเกินยอดค่าใช้จ่ายของบิลที่อ้างอิง';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_expense_general_offset_guard ON public.expense_general;
CREATE TRIGGER trg_expense_general_offset_guard
  BEFORE INSERT OR UPDATE ON public.expense_general
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_expense_general_offset_guard();

REVOKE ALL ON FUNCTION public.fn_expense_receipt_opex(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_expense_receipt_opex(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_expense_receipt_offset_summary(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_expense_receipt_offset_summary(uuid, uuid) TO authenticated, service_role;

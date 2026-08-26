-- SYP prepare: compare TF QTY to PODET QTY in order units (not QTY×MTP).
-- Warehouse TF lines usually use MTP=1 and either:
--   (a) copy the PO order qty, or
--   (b) expand packs into base pieces (qty = order×mtp).
-- Comparing QTY×MTP made (a) look "partial" while the UI showed TF == ordered
-- (e.g. 1PO6906-419 / 32050254: PO 10×MTP5 vs TF 10×MTP1).
-- Align with fn_po_syp_tf_prepare_by_bcode() which already uses raw QTY.

create or replace function public.fn_po_syp_tf_prepare_status()
returns table (
  docno text,
  prepare_status text,
  prepared boolean,
  tf_billnos text
)
language sql
stable
security definer
set search_path = raw_kcw, public
as $$
  with tf_bill_po as (
    select
      s."BILLNO",
      (regexp_match(s."REMARKS", public.fn_po_syp_docno_pattern(), 'i'))[1] as po_docno
    from raw_kcw.raw_hq_simas_sales_bills s
    where coalesce(s."CANCELED", '') <> 'Y'
      and public.fn_po_is_tf_transfer_bill(s."BILLNO")
      and coalesce(s."REMARKS", '') ~* public.fn_po_syp_docno_pattern()
  ),
  tf_qty as (
    select
      b.po_docno,
      nullif(btrim(d."BCODE"), '') as bcode,
      sum(coalesce(d."QTY"::numeric, 0)) as tf_qty
    from tf_bill_po b
    join raw_kcw.raw_hq_sidet_sales_lines d
      on d."BILLNO" = b."BILLNO"
    where coalesce(d."CANCELED", '') <> 'Y'
      and nullif(btrim(d."BCODE"), '') is not null
    group by b.po_docno, nullif(btrim(d."BCODE"), '')
  ),
  po_line_qty as (
    select
      d."DOCNO" as docno,
      nullif(btrim(d."BCODE"), '') as bcode,
      sum(coalesce(d."QTY"::numeric, 0)) as ordered_qty
    from raw_kcw.raw_syp_podet_purchase_order_lines d
    where nullif(btrim(d."BCODE"), '') is not null
    group by d."DOCNO", nullif(btrim(d."BCODE"), '')
  ),
  po_prepare as (
    select
      pl.docno,
      count(*) filter (where pl.ordered_qty > 0)::int as line_count,
      count(*) filter (
        where pl.ordered_qty > 0
          and coalesce(tf.tf_qty, 0) >= pl.ordered_qty
      )::int as prepared_line_count,
      count(*) filter (
        where pl.ordered_qty > 0 and coalesce(tf.tf_qty, 0) > 0
      )::int as any_tf_line_count
    from po_line_qty pl
    left join tf_qty tf
      on tf.po_docno = pl.docno and tf.bcode = pl.bcode
    group by pl.docno
  ),
  po_tf_bills as (
    select
      b.po_docno as docno,
      string_agg(distinct b."BILLNO", ', ' order by b."BILLNO") as tf_billnos
    from tf_bill_po b
    group by b.po_docno
  )
  select
    p.docno,
    case
      when p.line_count = 0 or p.any_tf_line_count = 0 then 'not_prepared'
      when p.prepared_line_count >= p.line_count then 'prepared'
      else 'partially_prepared'
    end as prepare_status,
    (p.prepared_line_count >= p.line_count and p.line_count > 0) as prepared,
    tb.tf_billnos
  from po_prepare p
  left join po_tf_bills tb on tb.docno = p.docno;
$$;

create or replace function public.fn_po_syp_lines(p_docno text)
returns jsonb
language plpgsql
stable
security definer
set search_path = raw_kcw, curated_kcw, public
as $fn$
declare
  v_docno text := btrim(coalesce(p_docno, ''));
  v_rows jsonb;
  v_tf_billnos text;
begin
  if v_docno = '' then
    raise exception 'missing docno';
  end if;

  select string_agg(distinct b."BILLNO", ', ' order by b."BILLNO")
  into v_tf_billnos
  from raw_kcw.raw_hq_simas_sales_bills b
  where coalesce(b."CANCELED", '') <> 'Y'
    and public.fn_po_is_tf_transfer_bill(b."BILLNO")
    and coalesce(b."REMARKS", '') ~* ('\m' || regexp_replace(v_docno, '([.^$|*+?(){}\[\]\\-])', '\\\1', 'g') || '\M');

  with tf_qty as (
    select
      nullif(btrim(d."BCODE"), '') as bcode,
      sum(coalesce(d."QTY"::numeric, 0)) as tf_qty
    from raw_kcw.raw_hq_simas_sales_bills s
    join raw_kcw.raw_hq_sidet_sales_lines d
      on d."BILLNO" = s."BILLNO"
    where coalesce(s."CANCELED", '') <> 'Y'
      and public.fn_po_is_tf_transfer_bill(s."BILLNO")
      and coalesce(s."REMARKS", '') ~* ('\m' || regexp_replace(v_docno, '([.^$|*+?(){}\[\]\\-])', '\\\1', 'g') || '\M')
      and coalesce(d."CANCELED", '') <> 'Y'
      and nullif(btrim(d."BCODE"), '') is not null
    group by nullif(btrim(d."BCODE"), '')
  )
  select coalesce(jsonb_agg(to_jsonb(x) order by x.line_sort nulls last, x.line), '[]'::jsonb)
  into v_rows
  from (
    select
      d."DOCNO" as docno,
      d."LINE" as line,
      nullif(regexp_replace(coalesce(d."LINE", ''), '[^0-9]', '', 'g'), '')::bigint as line_sort,
      d."ITEMNO" as itemno,
      d."BCODE" as bcode,
      d."DETAIL" as detail,
      d."MCODE" as mcode,
      d."QTY" as qty,
      d."UI" as ui,
      d."MTP" as mtp,
      d."PRICE" as price,
      d."AMOUNT" as amount,
      i."LOCATION1" as hq_location1,
      i."LOCATION2" as hq_location2,
      inv.qty as hq_qty,
      inv.updated_at as hq_qty_updated_at,
      (
        coalesce(tf.tf_qty, 0) > 0
        and coalesce(tf.tf_qty, 0) >= coalesce(d."QTY"::numeric, 0)
      ) as prepared,
      case
        when coalesce(tf.tf_qty, 0) <= 0 then 'not_prepared'
        when coalesce(tf.tf_qty, 0) >= coalesce(d."QTY"::numeric, 0)
          and coalesce(d."QTY"::numeric, 0) > 0
          then 'prepared'
        else 'partially_prepared'
      end as prepare_line_status,
      coalesce(tf.tf_qty, 0) as tf_qty
    from raw_kcw.raw_syp_podet_purchase_order_lines d
    left join raw_kcw.raw_hq_icmas_products i
      on i."BCODE" = d."BCODE"
    left join curated_kcw.inventory_qty_latest inv
      on inv.branch = 'HQ' and inv.bcode = d."BCODE"
    left join tf_qty tf
      on tf.bcode = nullif(btrim(d."BCODE"), '')
    where d."DOCNO" = v_docno
  ) x;

  return jsonb_build_object(
    'docno', v_docno,
    'lines', coalesce(v_rows, '[]'::jsonb),
    'tf_billnos', v_tf_billnos
  );
end;
$fn$;

revoke all on function public.fn_po_syp_tf_prepare_status() from public, anon, authenticated;
grant execute on function public.fn_po_syp_tf_prepare_status() to service_role;
revoke all on function public.fn_po_syp_lines(text) from public, anon, authenticated;
grant execute on function public.fn_po_syp_lines(text) to service_role;

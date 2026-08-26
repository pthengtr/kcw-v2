-- SYP prepare status + lines: compare TF QTY to PODET QTY in order units
-- (not QTY×MTP). See migration 20260826110000_po_syp_prepare_compare_raw_qty.sql.

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

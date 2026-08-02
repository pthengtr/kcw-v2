-- SYP POMAS.DOCNO uses a leading digit prefix (e.g. 1PO6906-412), often mirrored in
-- SIMas.REMARKS as "1PO6906-412##tax-id". Prior regex PO[0-9]{4}-[0-9]+ extracted
-- PO6906-412 and failed to join to POMAS.DOCNO.

create or replace function public.fn_po_syp_docno_pattern()
returns text
language sql
immutable
as $$
  select '[0-9]*PO[0-9]{4}-[0-9]+';
$$;

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
      sum(
        coalesce(d."QTY"::numeric, 0)
        * coalesce(nullif(nullif(btrim(d."MTP"), '')::numeric, 0), 1)
      ) as tf_qty
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
      sum(
        coalesce(d."QTY"::numeric, 0)
        * coalesce(nullif(nullif(btrim(d."MTP"), '')::numeric, 0), 1)
      ) as ordered_qty
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

revoke all on function public.fn_po_syp_docno_pattern() from public, anon, authenticated;
grant execute on function public.fn_po_syp_docno_pattern() to service_role;
revoke all on function public.fn_po_syp_tf_prepare_status() from public, anon, authenticated;
grant execute on function public.fn_po_syp_tf_prepare_status() to service_role;

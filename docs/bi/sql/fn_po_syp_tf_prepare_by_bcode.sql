-- Per-BCODE prepare qty from HQ TF/TFV REMARKS (fn_po_syp_tf_bills_by_docno).

create or replace function public.fn_po_syp_tf_prepare_by_bcode()
returns table (
  docno text,
  bcode text,
  prepared_qty numeric,
  tf_billnos text
)
language sql
stable
security definer
set search_path = raw_kcw, public
as $$
  select
    t.docno,
    nullif(btrim(d."BCODE"), '') as bcode,
    sum(coalesce(d."QTY"::numeric, 0)) as prepared_qty,
    string_agg(
      distinct btrim(t.billno::text),
      ', ' order by btrim(t.billno::text)
    ) as tf_billnos
  from public.fn_po_syp_tf_bills_by_docno() t
  join raw_kcw.raw_hq_sidet_sales_lines d
    on d."BILLNO" = t.billno
  where coalesce(d."CANCELED", '') <> 'Y'
    and coalesce(d."BILLTYPE", '') in ('1', '2', '3')
    and nullif(btrim(d."BCODE"), '') is not null
  group by t.docno, nullif(btrim(d."BCODE"), '');
$$;

revoke all on function public.fn_po_syp_tf_prepare_by_bcode() from public, anon, authenticated;
grant execute on function public.fn_po_syp_tf_prepare_by_bcode() to service_role;


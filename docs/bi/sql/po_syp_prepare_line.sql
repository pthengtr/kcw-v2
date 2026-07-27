-- SYP PO line prepare overlay + lines RPC with HQ ICMAS locations.

create table if not exists public.po_syp_prepare_line (
  docno text not null,
  line text not null,
  prepared boolean not null default false,
  prepared_at timestamptz,
  prepared_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (docno, line)
);

create index if not exists po_syp_prepare_line_docno_idx
  on public.po_syp_prepare_line (docno);

create index if not exists po_syp_prepare_line_prepared_idx
  on public.po_syp_prepare_line (docno)
  where prepared = true;

alter table public.po_syp_prepare_line enable row level security;
revoke all on table public.po_syp_prepare_line from anon, authenticated;
grant select, insert, update, delete on table public.po_syp_prepare_line to service_role;

create or replace function public.fn_po_syp_lines(p_docno text)
returns jsonb
language plpgsql
stable
security definer
set search_path = raw_kcw, public
as $$
declare
  v_docno text := btrim(coalesce(p_docno, ''));
  v_rows jsonb;
begin
  if v_docno = '' then
    raise exception 'missing docno';
  end if;

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
      d."QTY" as qty,
      d."UI" as ui,
      d."MTP" as mtp,
      d."PRICE" as price,
      d."AMOUNT" as amount,
      i."LOCATION1" as hq_location1,
      i."LOCATION2" as hq_location2,
      coalesce(pl.prepared, false) as prepared,
      pl.prepared_at,
      pl.prepared_by::text as prepared_by
    from raw_kcw.raw_syp_podet_purchase_order_lines d
    left join raw_kcw.raw_hq_icmas_products i
      on i."BCODE" = d."BCODE"
    left join public.po_syp_prepare_line pl
      on pl.docno = d."DOCNO" and pl.line = d."LINE"
    where d."DOCNO" = v_docno
  ) x;

  return jsonb_build_object('docno', v_docno, 'lines', coalesce(v_rows, '[]'::jsonb));
end;
$$;

revoke all on function public.fn_po_syp_lines(text) from public, anon, authenticated;
grant execute on function public.fn_po_syp_lines(text) to service_role;

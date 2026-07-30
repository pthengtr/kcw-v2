-- HQ pending-receive lines (ทดลองใช้): PODET qty minus linked PIDET qty by BCODE.
-- Link = single-PO PIMAS.PO (optional PO prefix, no slash) OR POMAS.BILLNO = PIMAS.BILLNO.

create index if not exists raw_hq_pimas_po_idx
  on raw_kcw.raw_hq_pimas_purchase_bills ("PO")
  where coalesce("CANCELED", '') <> 'Y'
    and nullif(btrim("PO"), '') is not null
    and position('/' in "PO") = 0;

create index if not exists raw_hq_pimas_billno_idx
  on raw_kcw.raw_hq_pimas_purchase_bills ("BILLNO")
  where coalesce("CANCELED", '') <> 'Y';

create index if not exists raw_hq_pidet_bill_bcode_idx
  on raw_kcw.raw_hq_pidet_purchase_lines ("BILLNO", "BILLDATE", "BCODE")
  where coalesce("CANCELED", '') <> 'Y';

create index if not exists raw_hq_podet_docno_docdate_idx
  on raw_kcw.raw_hq_podet_purchase_order_lines ("DOCNO", "DOCDATE", "LINE");

create or replace function public.fn_po_pending_receive(
  p_q text default null,
  p_acctno text default null,
  p_from text default null,
  p_to text default null,
  p_months integer default 12,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = raw_kcw, public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_q text := nullif(btrim(coalesce(p_q, '')), '');
  v_acctno text := nullif(btrim(coalesce(p_acctno, '')), '');
  v_from text := nullif(btrim(coalesce(p_from, '')), '');
  v_to text := nullif(btrim(coalesce(p_to, '')), '');
  v_months integer := greatest(1, least(coalesce(p_months, 12), 60));
  v_cutoff text := to_char((current_date - make_interval(months => v_months)), 'YYYY-MM-DD');
  v_result jsonb;
begin
  if v_from is not null and v_from !~ '^\d{4}-\d{2}-\d{2}' then
    raise exception 'invalid p_from: %', v_from;
  end if;
  if v_to is not null and v_to !~ '^\d{4}-\d{2}-\d{2}' then
    raise exception 'invalid p_to: %', v_to;
  end if;

  with headers as (
    select
      h."DOCNO" as docno,
      h."DOCDATE" as docdate,
      h."ACCTNO" as acctno,
      h."ACCTNAME" as acctname,
      h."BILLED" as billed,
      h."BILLNO" as billno
    from raw_kcw.raw_hq_pomas_purchase_orders h
    where coalesce(h."CANCELED", '') <> 'Y'
      and (
        case
          when v_from is not null then left(h."DOCDATE"::text, 10) >= v_from
          else left(h."DOCDATE"::text, 10) >= v_cutoff
        end
      )
      and (v_to is null or left(h."DOCDATE"::text, 10) <= v_to)
      and (v_acctno is null or coalesce(h."ACCTNO", '') = v_acctno)
      and (
        v_q is null
        or h."DOCNO" ilike '%' || v_q || '%'
        or coalesce(h."ACCTNAME", '') ilike '%' || v_q || '%'
        or coalesce(h."ACCTNO", '') ilike '%' || v_q || '%'
        or exists (
          select 1
          from raw_kcw.raw_hq_podet_purchase_order_lines d0
          where d0."DOCNO" = h."DOCNO"
            and d0."DOCDATE" = h."DOCDATE"
            and coalesce(d0."CANCELED", '') <> 'Y'
            and (
              coalesce(d0."BCODE", '') ilike '%' || v_q || '%'
              or coalesce(d0."DETAIL", '') ilike '%' || v_q || '%'
            )
        )
      )
  ),
  -- Match PIs from PIMAS side (scan once) + BILLNO path; UNION dedupes
  linked_pi as (
    select x.docno, x.billno, x.billdate
    from (
      select
        h.docno,
        i."BILLNO" as billno,
        i."BILLDATE" as billdate
      from headers h
      join raw_kcw.raw_hq_pimas_purchase_bills i
        on i."BILLNO" = h.billno
       and coalesce(i."CANCELED", '') <> 'Y'
      where nullif(btrim(coalesce(h.billno, '')), '') is not null

      union

      select
        case
          when btrim(i."PO") ~* '^po' then btrim(i."PO")
          else 'PO' || btrim(i."PO")
        end as docno,
        i."BILLNO" as billno,
        i."BILLDATE" as billdate
      from raw_kcw.raw_hq_pimas_purchase_bills i
      where coalesce(i."CANCELED", '') <> 'Y'
        and position('/' in coalesce(i."PO", '')) = 0
        and nullif(btrim(coalesce(i."PO", '')), '') is not null
        and exists (
          select 1 from headers h
          where h.docno = case
            when btrim(i."PO") ~* '^po' then btrim(i."PO")
            else 'PO' || btrim(i."PO")
          end
        )
    ) x
  ),
  recv as (
    select
      lp.docno,
      btrim(p."BCODE") as bcode,
      sum(coalesce(p."QTY"::numeric, 0)) as recv_qty
    from linked_pi lp
    join raw_kcw.raw_hq_pidet_purchase_lines p
      on p."BILLNO" = lp.billno
     and p."BILLDATE" = lp.billdate
     and coalesce(p."CANCELED", '') <> 'Y'
     and coalesce(p."BILLTYPE", '') in ('1', '2', '3')
     and nullif(btrim(coalesce(p."BCODE", '')), '') is not null
    group by lp.docno, btrim(p."BCODE")
  ),
  pending as (
    select
      h.docno,
      h.docdate,
      h.acctno,
      h.acctname,
      h.billed,
      h.billno,
      d."LINE" as line,
      d."BCODE" as bcode,
      d."DETAIL" as detail,
      d."UI" as ui,
      coalesce(d."QTY"::numeric, 0) as po_qty,
      coalesce(r.recv_qty, 0) as recv_qty,
      coalesce(d."QTY"::numeric, 0) - coalesce(r.recv_qty, 0) as remaining
    from headers h
    join raw_kcw.raw_hq_podet_purchase_order_lines d
      on d."DOCNO" = h.docno
     and d."DOCDATE" = h.docdate
     and coalesce(d."CANCELED", '') <> 'Y'
    left join recv r
      on r.docno = h.docno
     and r.bcode = btrim(coalesce(d."BCODE", ''))
    where coalesce(d."QTY"::numeric, 0) - coalesce(r.recv_qty, 0) > 0
      and (
        v_q is null
        or h.docno ilike '%' || v_q || '%'
        or coalesce(h.acctname, '') ilike '%' || v_q || '%'
        or coalesce(h.acctno, '') ilike '%' || v_q || '%'
        or coalesce(d."BCODE", '') ilike '%' || v_q || '%'
        or coalesce(d."DETAIL", '') ilike '%' || v_q || '%'
      )
  )
  select jsonb_build_object(
    'count', (select count(*)::bigint from pending),
    'rows', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.docdate desc nulls last, p.docno, p.line)
      from (
        select *
        from pending
        order by docdate desc nulls last, docno, line
        offset v_offset
        limit v_limit
      ) p
    ), '[]'::jsonb)
  )
  into v_result;

  return coalesce(v_result, jsonb_build_object('rows', '[]'::jsonb, 'count', 0));
end;
$$;

revoke all on function public.fn_po_pending_receive(text, text, text, text, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.fn_po_pending_receive(text, text, text, text, integer, integer, integer)
  to service_role;

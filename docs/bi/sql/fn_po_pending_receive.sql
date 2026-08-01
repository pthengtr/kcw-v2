-- ICLOW-backed pending-receive list + partial PO detail for /po.
-- Source of truth: docs/bi/kcw-iclow-pending-receive-data-dictionary.md §6

drop function if exists public.fn_po_pending_receive(text, text, text, text, text, integer, integer, integer);
drop function if exists public.fn_po_pending_receive(text, text, text, text, text, text, integer, integer, integer);
drop function if exists public.fn_po_pending_receive_detail(text, text);

create or replace function public.fn_po_pending_receive(
  p_site text,
  p_status text default 'pending_receive',
  p_q text default null,
  p_vendor text default null,
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
  v_site text := upper(btrim(coalesce(p_site, '')));
  v_status text := lower(btrim(coalesce(p_status, 'pending_receive')));
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_q text := nullif(btrim(coalesce(p_q, '')), '');
  v_vendor text := nullif(btrim(coalesce(p_vendor, '')), '');
  v_from text := nullif(btrim(coalesce(p_from, '')), '');
  v_to text := nullif(btrim(coalesce(p_to, '')), '');
  v_months integer := greatest(1, least(coalesce(p_months, 12), 60));
  v_cutoff text := to_char((current_date - make_interval(months => v_months)), 'YYYY-MM-DD');
  v_result jsonb;
begin
  if v_site not in ('HQ', 'SYP') then
    raise exception 'invalid site: %', p_site;
  end if;
  if v_status not in (
    'to_be_ordered',
    'pending_receive',
    'partially_received',
    'complete'
  ) then
    raise exception 'invalid status: %', p_status;
  end if;
  if v_from is not null and v_from !~ '^\d{4}-\d{2}-\d{2}' then
    raise exception 'invalid p_from: %', v_from;
  end if;
  if v_to is not null and v_to !~ '^\d{4}-\d{2}-\d{2}' then
    raise exception 'invalid p_to: %', v_to;
  end if;

  if v_site = 'HQ' and v_status = 'partially_received' then
    with active as (
      select
        nullif(btrim(coalesce(i."DOCNO", '')), '') as docno,
        left(i."DOCDATE"::text, 10) as docdate,
        nullif(btrim(coalesce(i."VENDOR", '')), '') as vendor,
        coalesce(i."QTY"::numeric, 0) as qty,
        coalesce(i."RECEIVED", 'N') as received
      from raw_kcw.raw_hq_iclow_stock_orders i
      where coalesce(i."CANCELED", 'N') <> 'Y'
        and i."ORDERED" = 'Y'
        and nullif(btrim(coalesce(i."DOCNO", '')), '') is not null
    ),
    po as (
      select
        a.docno,
        max(a.docdate) as docdate,
        max(a.vendor) as vendor,
        count(*) filter (where a.received = 'N')::int as missing_count,
        count(*) filter (where a.received = 'Y')::int as received_count,
        coalesce(sum(a.qty) filter (where a.received = 'N'), 0) as missing_qty,
        coalesce(sum(a.qty) filter (where a.received = 'Y'), 0) as received_qty
      from active a
      group by a.docno
      having count(*) filter (where a.received = 'N') > 0
         and count(*) filter (where a.received = 'Y') > 0
    ),
    enriched as (
      select
        p.docno,
        p.docdate,
        p.vendor,
        nullif(btrim(coalesce(ap."ACCTNAME", '')), '') as acctname,
        p.missing_count,
        p.received_count,
        p.missing_qty,
        p.received_qty,
        'partially_received'::text as status,
        'docno'::text as grain
      from po p
      left join raw_kcw.raw_hq_apmas_payable ap on ap."ACCTNO" = p.vendor
    ),
    filtered as (
      select *
      from enriched e
      where (
          case
            when v_from is not null then coalesce(e.docdate, '') >= v_from
            else coalesce(e.docdate, '') >= v_cutoff
          end
          and (v_to is null or coalesce(e.docdate, '') <= v_to)
        )
        and (v_vendor is null or coalesce(e.vendor, '') = v_vendor)
        and (
          v_q is null
          or coalesce(e.docno, '') ilike '%' || v_q || '%'
          or coalesce(e.vendor, '') ilike '%' || v_q || '%'
          or coalesce(e.acctname, '') ilike '%' || v_q || '%'
        )
    )
    select jsonb_build_object(
      'count', (select count(*)::bigint from filtered),
      'grain', 'docno',
      'rows', coalesce((
        select jsonb_agg(to_jsonb(r) order by r.docdate desc nulls last, r.docno)
        from (
          select * from filtered
          order by docdate desc nulls last, docno
          offset v_offset limit v_limit
        ) r
      ), '[]'::jsonb)
    ) into v_result;

  elsif v_site = 'SYP' and v_status = 'partially_received' then
    with active as (
      select
        nullif(btrim(coalesce(i."DOCNO", '')), '') as docno,
        left(i."DOCDATE"::text, 10) as docdate,
        nullif(btrim(coalesce(i."VENDOR", '')), '') as vendor,
        coalesce(i."QTY"::numeric, 0) as qty,
        coalesce(i."RECEIVED", 'N') as received
      from raw_kcw.raw_syp_iclow_stock_orders i
      where coalesce(i."CANCELED", 'N') <> 'Y'
        and i."ORDERED" = 'Y'
        and nullif(btrim(coalesce(i."DOCNO", '')), '') is not null
    ),
    po as (
      select
        a.docno,
        max(a.docdate) as docdate,
        max(a.vendor) as vendor,
        count(*) filter (where a.received = 'N')::int as missing_count,
        count(*) filter (where a.received = 'Y')::int as received_count,
        coalesce(sum(a.qty) filter (where a.received = 'N'), 0) as missing_qty,
        coalesce(sum(a.qty) filter (where a.received = 'Y'), 0) as received_qty
      from active a
      group by a.docno
      having count(*) filter (where a.received = 'N') > 0
         and count(*) filter (where a.received = 'Y') > 0
    ),
    enriched as (
      select
        p.docno,
        p.docdate,
        p.vendor,
        nullif(btrim(coalesce(ap."ACCTNAME", '')), '') as acctname,
        p.missing_count,
        p.received_count,
        p.missing_qty,
        p.received_qty,
        'partially_received'::text as status,
        'docno'::text as grain
      from po p
      left join raw_kcw.raw_hq_apmas_payable ap on ap."ACCTNO" = p.vendor
    ),
    filtered as (
      select *
      from enriched e
      where (
          case
            when v_from is not null then coalesce(e.docdate, '') >= v_from
            else coalesce(e.docdate, '') >= v_cutoff
          end
          and (v_to is null or coalesce(e.docdate, '') <= v_to)
        )
        and (v_vendor is null or coalesce(e.vendor, '') = v_vendor)
        and (
          v_q is null
          or coalesce(e.docno, '') ilike '%' || v_q || '%'
          or coalesce(e.vendor, '') ilike '%' || v_q || '%'
          or coalesce(e.acctname, '') ilike '%' || v_q || '%'
        )
    )
    select jsonb_build_object(
      'count', (select count(*)::bigint from filtered),
      'grain', 'docno',
      'rows', coalesce((
        select jsonb_agg(to_jsonb(r) order by r.docdate desc nulls last, r.docno)
        from (
          select * from filtered
          order by docdate desc nulls last, docno
          offset v_offset limit v_limit
        ) r
      ), '[]'::jsonb)
    ) into v_result;

  elsif v_site = 'HQ' then
    with sibling_received as (
      select distinct nullif(btrim(coalesce(s."DOCNO", '')), '') as docno
      from raw_kcw.raw_hq_iclow_stock_orders s
      where s."ORDERED" = 'Y'
        and s."RECEIVED" = 'Y'
        and coalesce(s."CANCELED", 'N') <> 'Y'
        and nullif(btrim(coalesce(s."DOCNO", '')), '') is not null
    ),
    base as (
      select
        i."ID" as id,
        nullif(btrim(coalesce(i."DOCNO", '')), '') as docno,
        left(i."DOCDATE"::text, 10) as docdate,
        nullif(btrim(coalesce(i."VENDOR", '')), '') as vendor,
        nullif(btrim(coalesce(ap."ACCTNAME", '')), '') as acctname,
        nullif(btrim(coalesce(i."BCODE", '')), '') as bcode,
        nullif(btrim(coalesce(i."DESCR", '')), '') as descr,
        coalesce(i."QTY"::numeric, 0) as qty,
        nullif(btrim(coalesce(i."UI", '')), '') as ui,
        coalesce(i."ORDERED", 'N') as ordered,
        coalesce(i."RECEIVED", 'N') as received,
        left(i."RCVDDATE"::text, 10) as rcvddate,
        nullif(btrim(coalesce(i."RCVDNO", '')), '') as rcvdno,
        (sr.docno is not null) as has_received_sibling
      from raw_kcw.raw_hq_iclow_stock_orders i
      left join sibling_received sr
        on sr.docno = nullif(btrim(coalesce(i."DOCNO", '')), '')
      left join raw_kcw.raw_hq_apmas_payable ap on ap."ACCTNO" = i."VENDOR"
      where coalesce(i."CANCELED", 'N') <> 'Y'
        and coalesce(i."ORDERED", 'N') <> 'X'
    ),
    classified as (
      select
        b.*,
        case
          when coalesce(b.ordered, 'N') = 'N' then 'to_be_ordered'
          when b.ordered = 'Y' and b.received = 'Y' then 'complete'
          when b.ordered = 'Y' and b.received = 'N' and not b.has_received_sibling
            then 'pending_receive'
          else null
        end as status
      from base b
    ),
    filtered as (
      select
        c.id, c.docno, c.docdate, c.vendor, c.acctname, c.bcode, c.descr,
        c.qty, c.ui, c.ordered, c.received, c.rcvddate, c.rcvdno, c.status,
        'line'::text as grain
      from classified c
      where c.status = v_status
        and (
          v_status = 'to_be_ordered'
          or (
            case
              when v_from is not null then coalesce(c.docdate, '') >= v_from
              else coalesce(c.docdate, '') >= v_cutoff
            end
            and (v_to is null or coalesce(c.docdate, '') <= v_to)
          )
        )
        and (v_vendor is null or coalesce(c.vendor, '') = v_vendor)
        and (
          v_q is null
          or coalesce(c.docno, '') ilike '%' || v_q || '%'
          or coalesce(c.vendor, '') ilike '%' || v_q || '%'
          or coalesce(c.acctname, '') ilike '%' || v_q || '%'
          or coalesce(c.bcode, '') ilike '%' || v_q || '%'
          or coalesce(c.descr, '') ilike '%' || v_q || '%'
          or coalesce(c.rcvdno, '') ilike '%' || v_q || '%'
        )
    )
    select jsonb_build_object(
      'count', (select count(*)::bigint from filtered),
      'grain', 'line',
      'rows', coalesce((
        select jsonb_agg(to_jsonb(r) order by
          r.docdate desc nulls last, r.docno nulls last, r.vendor nulls last, r.bcode nulls last, r.id)
        from (
          select * from filtered
          order by docdate desc nulls last, docno nulls last, vendor nulls last, bcode nulls last, id
          offset v_offset limit v_limit
        ) r
      ), '[]'::jsonb)
    ) into v_result;

  else
    with sibling_received as (
      select distinct nullif(btrim(coalesce(s."DOCNO", '')), '') as docno
      from raw_kcw.raw_syp_iclow_stock_orders s
      where s."ORDERED" = 'Y'
        and s."RECEIVED" = 'Y'
        and coalesce(s."CANCELED", 'N') <> 'Y'
        and nullif(btrim(coalesce(s."DOCNO", '')), '') is not null
    ),
    base as (
      select
        i."ID" as id,
        nullif(btrim(coalesce(i."DOCNO", '')), '') as docno,
        left(i."DOCDATE"::text, 10) as docdate,
        nullif(btrim(coalesce(i."VENDOR", '')), '') as vendor,
        nullif(btrim(coalesce(ap."ACCTNAME", '')), '') as acctname,
        nullif(btrim(coalesce(i."BCODE", '')), '') as bcode,
        nullif(btrim(coalesce(i."DESCR", '')), '') as descr,
        coalesce(i."QTY"::numeric, 0) as qty,
        nullif(btrim(coalesce(i."UI", '')), '') as ui,
        coalesce(i."ORDERED", 'N') as ordered,
        coalesce(i."RECEIVED", 'N') as received,
        left(i."RCVDDATE"::text, 10) as rcvddate,
        nullif(btrim(coalesce(i."RCVDNO", '')), '') as rcvdno,
        (sr.docno is not null) as has_received_sibling
      from raw_kcw.raw_syp_iclow_stock_orders i
      left join sibling_received sr
        on sr.docno = nullif(btrim(coalesce(i."DOCNO", '')), '')
      left join raw_kcw.raw_hq_apmas_payable ap on ap."ACCTNO" = i."VENDOR"
      where coalesce(i."CANCELED", 'N') <> 'Y'
        and coalesce(i."ORDERED", 'N') <> 'X'
    ),
    classified as (
      select
        b.*,
        case
          when coalesce(b.ordered, 'N') = 'N' then 'to_be_ordered'
          when b.ordered = 'Y' and b.received = 'Y' then 'complete'
          when b.ordered = 'Y' and b.received = 'N' and not b.has_received_sibling
            then 'pending_receive'
          else null
        end as status
      from base b
    ),
    filtered as (
      select
        c.id, c.docno, c.docdate, c.vendor, c.acctname, c.bcode, c.descr,
        c.qty, c.ui, c.ordered, c.received, c.rcvddate, c.rcvdno, c.status,
        'line'::text as grain
      from classified c
      where c.status = v_status
        and (
          v_status = 'to_be_ordered'
          or (
            case
              when v_from is not null then coalesce(c.docdate, '') >= v_from
              else coalesce(c.docdate, '') >= v_cutoff
            end
            and (v_to is null or coalesce(c.docdate, '') <= v_to)
          )
        )
        and (v_vendor is null or coalesce(c.vendor, '') = v_vendor)
        and (
          v_q is null
          or coalesce(c.docno, '') ilike '%' || v_q || '%'
          or coalesce(c.vendor, '') ilike '%' || v_q || '%'
          or coalesce(c.acctname, '') ilike '%' || v_q || '%'
          or coalesce(c.bcode, '') ilike '%' || v_q || '%'
          or coalesce(c.descr, '') ilike '%' || v_q || '%'
          or coalesce(c.rcvdno, '') ilike '%' || v_q || '%'
        )
    )
    select jsonb_build_object(
      'count', (select count(*)::bigint from filtered),
      'grain', 'line',
      'rows', coalesce((
        select jsonb_agg(to_jsonb(r) order by
          r.docdate desc nulls last, r.docno nulls last, r.vendor nulls last, r.bcode nulls last, r.id)
        from (
          select * from filtered
          order by docdate desc nulls last, docno nulls last, vendor nulls last, bcode nulls last, id
          offset v_offset limit v_limit
        ) r
      ), '[]'::jsonb)
    ) into v_result;
  end if;

  return coalesce(v_result, jsonb_build_object('rows', '[]'::jsonb, 'count', 0, 'grain', 'line'));
end;
$$;

create or replace function public.fn_po_pending_receive_detail(
  p_site text,
  p_docno text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = raw_kcw, public
as $$
declare
  v_site text := upper(btrim(coalesce(p_site, '')));
  v_docno text := nullif(btrim(coalesce(p_docno, '')), '');
  v_result jsonb;
begin
  if v_site not in ('HQ', 'SYP') then
    raise exception 'invalid site: %', p_site;
  end if;
  if v_docno is null then
    raise exception 'docno required';
  end if;

  if v_site = 'HQ' then
    with ic as (
      select
        i."ID" as id,
        nullif(btrim(coalesce(i."DOCNO", '')), '') as docno,
        left(i."DOCDATE"::text, 10) as docdate,
        nullif(btrim(coalesce(i."VENDOR", '')), '') as vendor,
        nullif(btrim(coalesce(i."BCODE", '')), '') as bcode,
        nullif(btrim(coalesce(i."DESCR", '')), '') as descr,
        coalesce(i."QTY"::numeric, 0) as qty,
        nullif(btrim(coalesce(i."UI", '')), '') as ui,
        coalesce(i."ORDERED", 'N') as ordered,
        coalesce(i."RECEIVED", 'N') as received,
        left(i."RCVDDATE"::text, 10) as rcvddate,
        nullif(btrim(coalesce(i."RCVDNO", '')), '') as rcvdno
      from raw_kcw.raw_hq_iclow_stock_orders i
      where i."DOCNO" = v_docno
        and i."ORDERED" = 'Y'
        and coalesce(i."CANCELED", 'N') <> 'Y'
    ),
    missing as (
      select id, docno, docdate, vendor, bcode, descr, qty, ui,
             ordered, received, rcvddate, rcvdno
      from ic where received = 'N'
    ),
    bills as (
      select distinct rcvdno as billno, rcvddate as billdate
      from ic where received = 'Y' and rcvdno is not null
    ),
    pidet_recv as (
      select
        'pidet'::text as source,
        d."BILLNO" as billno,
        left(d."BILLDATE"::text, 10) as billdate,
        nullif(btrim(coalesce(d."BCODE", '')), '') as bcode,
        nullif(btrim(coalesce(d."DETAIL", '')), '') as descr,
        coalesce(d."QTY"::numeric, 0) as qty,
        nullif(btrim(coalesce(d."UI", '')), '') as ui,
        null::text as iclow_id
      from raw_kcw.raw_hq_pidet_purchase_lines d
      join bills b
        on b.billno = d."BILLNO"
       and b.billdate = left(d."BILLDATE"::text, 10)
      where coalesce(d."CANCELED", '') <> 'Y'
        and coalesce(d."BILLTYPE", '') in ('1', '2', '3')
        and nullif(btrim(coalesce(d."BCODE", '')), '') is not null
    ),
    orphan_iclow as (
      select
        'iclow'::text as source,
        i.rcvdno as billno,
        i.rcvddate as billdate,
        i.bcode,
        i.descr,
        i.qty,
        i.ui,
        i.id as iclow_id
      from ic i
      where i.received = 'Y'
        and i.rcvdno is not null
        and not exists (
          select 1 from raw_kcw.raw_hq_pimas_purchase_bills p
          where p."BILLNO" = i.rcvdno
        )
    ),
    received as (
      select * from pidet_recv
      union all
      select * from orphan_iclow
    ),
    header as (
      select
        v_docno as docno,
        (select max(docdate) from ic) as docdate,
        (select max(vendor) from ic) as vendor,
        nullif(btrim(coalesce((
          select a."ACCTNAME" from raw_kcw.raw_hq_apmas_payable a
          where a."ACCTNO" = (select max(vendor) from ic) limit 1
        ), '')), '') as acctname,
        (select count(*)::int from missing) as missing_count,
        (select count(*)::int from ic where received = 'Y') as received_iclow_count,
        (select count(*)::int from received) as received_display_count
    )
    select jsonb_build_object(
      'docno', h.docno,
      'docdate', h.docdate,
      'vendor', h.vendor,
      'acctname', h.acctname,
      'missing_count', h.missing_count,
      'received_iclow_count', h.received_iclow_count,
      'received_display_count', h.received_display_count,
      'missing', coalesce((
        select jsonb_agg(to_jsonb(m) order by m.bcode nulls last, m.id) from missing m
      ), '[]'::jsonb),
      'received', coalesce((
        select jsonb_agg(to_jsonb(r) order by r.billdate desc nulls last, r.billno, r.bcode)
        from received r
      ), '[]'::jsonb)
    ) into v_result
    from header h;
  else
    with ic as (
      select
        i."ID" as id,
        nullif(btrim(coalesce(i."DOCNO", '')), '') as docno,
        left(i."DOCDATE"::text, 10) as docdate,
        nullif(btrim(coalesce(i."VENDOR", '')), '') as vendor,
        nullif(btrim(coalesce(i."BCODE", '')), '') as bcode,
        nullif(btrim(coalesce(i."DESCR", '')), '') as descr,
        coalesce(i."QTY"::numeric, 0) as qty,
        nullif(btrim(coalesce(i."UI", '')), '') as ui,
        coalesce(i."ORDERED", 'N') as ordered,
        coalesce(i."RECEIVED", 'N') as received,
        left(i."RCVDDATE"::text, 10) as rcvddate,
        nullif(btrim(coalesce(i."RCVDNO", '')), '') as rcvdno
      from raw_kcw.raw_syp_iclow_stock_orders i
      where i."DOCNO" = v_docno
        and i."ORDERED" = 'Y'
        and coalesce(i."CANCELED", 'N') <> 'Y'
    ),
    missing as (
      select * from ic where received = 'N'
    ),
    received as (
      select
        'iclow'::text as source,
        rcvdno as billno,
        rcvddate as billdate,
        bcode, descr, qty, ui,
        id as iclow_id
      from ic where received = 'Y'
    ),
    header as (
      select
        v_docno as docno,
        (select max(docdate) from ic) as docdate,
        (select max(vendor) from ic) as vendor,
        nullif(btrim(coalesce((
          select a."ACCTNAME" from raw_kcw.raw_hq_apmas_payable a
          where a."ACCTNO" = (select max(vendor) from ic) limit 1
        ), '')), '') as acctname,
        (select count(*)::int from missing) as missing_count,
        (select count(*)::int from received) as received_iclow_count,
        (select count(*)::int from received) as received_display_count
    )
    select jsonb_build_object(
      'docno', h.docno,
      'docdate', h.docdate,
      'vendor', h.vendor,
      'acctname', h.acctname,
      'missing_count', h.missing_count,
      'received_iclow_count', h.received_iclow_count,
      'received_display_count', h.received_display_count,
      'missing', coalesce((
        select jsonb_agg(to_jsonb(m) order by m.bcode nulls last, m.id) from missing m
      ), '[]'::jsonb),
      'received', coalesce((
        select jsonb_agg(to_jsonb(r) order by r.billdate desc nulls last, r.billno, r.bcode)
        from received r
      ), '[]'::jsonb)
    ) into v_result
    from header h;
  end if;

  return coalesce(
    v_result,
    jsonb_build_object(
      'docno', v_docno,
      'missing', '[]'::jsonb,
      'received', '[]'::jsonb,
      'missing_count', 0,
      'received_iclow_count', 0,
      'received_display_count', 0
    )
  );
end;
$$;

revoke all on function public.fn_po_pending_receive(text, text, text, text, text, text, integer, integer, integer) from public;
grant execute on function public.fn_po_pending_receive(text, text, text, text, text, text, integer, integer, integer) to service_role;

revoke all on function public.fn_po_pending_receive_detail(text, text) from public;
grant execute on function public.fn_po_pending_receive_detail(text, text) to service_role;

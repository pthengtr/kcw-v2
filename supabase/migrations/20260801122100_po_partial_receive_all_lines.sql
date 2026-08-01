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

  if v_site = 'HQ' then
    with sibling_received as (
      select distinct nullif(btrim(coalesce(s."DOCNO", '')), '') as docno
      from raw_kcw.raw_hq_iclow_stock_orders s
      where s."ORDERED" = 'Y'
        and s."RECEIVED" = 'Y'
        and coalesce(s."CANCELED", 'N') <> 'Y'
        and nullif(btrim(coalesce(s."DOCNO", '')), '') is not null
    ),
    sibling_pending as (
      select distinct nullif(btrim(coalesce(s."DOCNO", '')), '') as docno
      from raw_kcw.raw_hq_iclow_stock_orders s
      where s."ORDERED" = 'Y'
        and coalesce(s."RECEIVED", 'N') = 'N'
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
        (sr.docno is not null) as has_received_sibling,
        (sp.docno is not null) as has_pending_sibling
      from raw_kcw.raw_hq_iclow_stock_orders i
      left join sibling_received sr
        on sr.docno = nullif(btrim(coalesce(i."DOCNO", '')), '')
      left join sibling_pending sp
        on sp.docno = nullif(btrim(coalesce(i."DOCNO", '')), '')
      left join raw_kcw.raw_hq_apmas_payable ap on ap."ACCTNO" = i."VENDOR"
      where coalesce(i."CANCELED", 'N') <> 'Y'
        and coalesce(i."ORDERED", 'N') <> 'X'
    ),
    classified as (
      select
        b.*,
        case
          when coalesce(b.ordered, 'N') = 'N' then 'to_be_ordered'
          when b.ordered = 'Y'
            and b.has_received_sibling
            and b.has_pending_sibling then 'partially_received'
          when b.ordered = 'Y' and b.received = 'N' then 'pending_receive'
          when b.ordered = 'Y' and b.received = 'Y' then 'complete'
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
    sibling_pending as (
      select distinct nullif(btrim(coalesce(s."DOCNO", '')), '') as docno
      from raw_kcw.raw_syp_iclow_stock_orders s
      where s."ORDERED" = 'Y'
        and coalesce(s."RECEIVED", 'N') = 'N'
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
        (sr.docno is not null) as has_received_sibling,
        (sp.docno is not null) as has_pending_sibling
      from raw_kcw.raw_syp_iclow_stock_orders i
      left join sibling_received sr
        on sr.docno = nullif(btrim(coalesce(i."DOCNO", '')), '')
      left join sibling_pending sp
        on sp.docno = nullif(btrim(coalesce(i."DOCNO", '')), '')
      left join raw_kcw.raw_hq_apmas_payable ap on ap."ACCTNO" = i."VENDOR"
      where coalesce(i."CANCELED", 'N') <> 'Y'
        and coalesce(i."ORDERED", 'N') <> 'X'
    ),
    classified as (
      select
        b.*,
        case
          when coalesce(b.ordered, 'N') = 'N' then 'to_be_ordered'
          when b.ordered = 'Y'
            and b.has_received_sibling
            and b.has_pending_sibling then 'partially_received'
          when b.ordered = 'Y' and b.received = 'N' then 'pending_receive'
          when b.ordered = 'Y' and b.received = 'Y' then 'complete'
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

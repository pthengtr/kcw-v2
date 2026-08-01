-- ICLOW-backed pending-receive list + partial PO detail for /po.
-- Source of truth: docs/bi/kcw-iclow-pending-receive-data-dictionary.md §6
--
-- Grain for ordered statuses: DOCNO + BCODE.
-- HQ received qty: sum(PIDET.QTY) via distinct ICLOW.RCVDNO → PIDET.BILLNO + BCODE
--   (do NOT use PIMAS.PO — unreliable).
-- Legacy PARTS9 ICLOW.RCVDNO is truncated to 12 chars while PIMAS.BILLNO can be longer:
--   match exact BILLNO = RCVDNO, else left(BILLNO,12) = RCVDNO when length(RCVDNO)=12.
-- RECEIVED='Y' means complete OR partial depending on PIDET qty vs ordered qty.

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

  -- รอสั่งซื้อ: ICLOW line grain (ORDERED=N)
  if v_status = 'to_be_ordered' then
    if v_site = 'HQ' then
      with base as (
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
          'to_be_ordered'::text as status,
          'line'::text as grain
        from raw_kcw.raw_hq_iclow_stock_orders i
        left join raw_kcw.raw_hq_apmas_payable ap on ap."ACCTNO" = i."VENDOR"
        where coalesce(i."CANCELED", 'N') <> 'Y'
          and coalesce(i."ORDERED", 'N') = 'N'
      ),
      filtered as (
        select *
        from base b
        where (v_vendor is null or coalesce(b.vendor, '') = v_vendor)
          and (
            v_q is null
            or coalesce(b.docno, '') ilike '%' || v_q || '%'
            or coalesce(b.vendor, '') ilike '%' || v_q || '%'
            or coalesce(b.acctname, '') ilike '%' || v_q || '%'
            or coalesce(b.bcode, '') ilike '%' || v_q || '%'
            or coalesce(b.descr, '') ilike '%' || v_q || '%'
          )
      )
      select jsonb_build_object(
        'count', (select count(*)::bigint from filtered),
        'grain', 'line',
        'rows', coalesce((
          select jsonb_agg(to_jsonb(r) order by
            r.docdate desc nulls last, r.vendor nulls last, r.bcode nulls last, r.id)
          from (
            select * from filtered
            order by docdate desc nulls last, vendor nulls last, bcode nulls last, id
            offset v_offset limit v_limit
          ) r
        ), '[]'::jsonb)
      ) into v_result;
    else
      with base as (
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
          'to_be_ordered'::text as status,
          'line'::text as grain
        from raw_kcw.raw_syp_iclow_stock_orders i
        left join raw_kcw.raw_hq_apmas_payable ap on ap."ACCTNO" = i."VENDOR"
        where coalesce(i."CANCELED", 'N') <> 'Y'
          and coalesce(i."ORDERED", 'N') = 'N'
      ),
      filtered as (
        select *
        from base b
        where (v_vendor is null or coalesce(b.vendor, '') = v_vendor)
          and (
            v_q is null
            or coalesce(b.docno, '') ilike '%' || v_q || '%'
            or coalesce(b.vendor, '') ilike '%' || v_q || '%'
            or coalesce(b.acctname, '') ilike '%' || v_q || '%'
            or coalesce(b.bcode, '') ilike '%' || v_q || '%'
            or coalesce(b.descr, '') ilike '%' || v_q || '%'
          )
      )
      select jsonb_build_object(
        'count', (select count(*)::bigint from filtered),
        'grain', 'line',
        'rows', coalesce((
          select jsonb_agg(to_jsonb(r) order by
            r.docdate desc nulls last, r.vendor nulls last, r.bcode nulls last, r.id)
          from (
            select * from filtered
            order by docdate desc nulls last, vendor nulls last, bcode nulls last, id
            offset v_offset limit v_limit
          ) r
        ), '[]'::jsonb)
      ) into v_result;
    end if;

  -- ค้างรับ / รับบางส่วน / รับแล้ว: DOCNO+BCODE grain
  elsif v_site = 'HQ' then
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
      where coalesce(i."CANCELED", 'N') <> 'Y'
        and i."ORDERED" = 'Y'
        and nullif(btrim(coalesce(i."DOCNO", '')), '') is not null
        and nullif(btrim(coalesce(i."BCODE", '')), '') is not null
    ),
    ordered as (
      select
        min(i.id) as id,
        i.docno,
        max(i.docdate) as docdate,
        max(i.vendor) as vendor,
        i.bcode,
        max(i.descr) as descr,
        sum(i.qty) as ordered_qty,
        max(i.ui) as ui,
        bool_or(i.received = 'Y') as any_received,
        max(i.rcvddate) filter (where i.received = 'Y') as rcvddate,
        string_agg(distinct i.rcvdno, ', ' order by i.rcvdno)
          filter (where i.rcvdno is not null) as rcvdnos
      from ic i
      group by i.docno, i.bcode
    ),
    rcvd_links as (
      select distinct i.docno, i.bcode, i.rcvdno
      from ic i
      where i.rcvdno is not null
    ),
    pidet_by_bill as (
      select
        nullif(btrim(coalesce(d."BILLNO", '')), '') as billno,
        nullif(btrim(coalesce(d."BCODE", '')), '') as bcode,
        sum(coalesce(d."QTY"::numeric, 0)) as qty
      from raw_kcw.raw_hq_pidet_purchase_lines d
      where coalesce(d."CANCELED", '') <> 'Y'
        and coalesce(d."BILLTYPE", '') in ('1', '2', '3')
        and nullif(btrim(coalesce(d."BCODE", '')), '') is not null
      group by 1, 2
    ),
    received as (
      select
        l.docno,
        l.bcode,
        sum(p.qty) as received_qty
      from rcvd_links l
      join pidet_by_bill p
        on p.bcode = l.bcode
       and (
          p.billno = l.rcvdno
          or (
            char_length(l.rcvdno) = 12
            and left(p.billno, 12) = l.rcvdno
            and char_length(p.billno) > 12
            and not exists (
              select 1
              from raw_kcw.raw_hq_pimas_purchase_bills px
              where px."BILLNO" = l.rcvdno
                and coalesce(px."CANCELED", '') <> 'Y'
            )
          )
        )
      group by l.docno, l.bcode
    ),
    pimas_link as (
      select
        l.docno,
        l.bcode,
        bool_or(
          not exists (
            select 1
            from raw_kcw.raw_hq_pimas_purchase_bills p
            where coalesce(p."CANCELED", '') <> 'Y'
              and (
                p."BILLNO" = l.rcvdno
                or (
                  char_length(l.rcvdno) = 12
                  and left(p."BILLNO", 12) = l.rcvdno
                  and char_length(btrim(p."BILLNO")) > 12
                )
              )
          )
        ) as pimas_link_missing
      from rcvd_links l
      group by l.docno, l.bcode
    ),
    classified as (
      select
        o.id,
        o.docno,
        o.docdate,
        o.vendor,
        nullif(btrim(coalesce(ap."ACCTNAME", '')), '') as acctname,
        o.bcode,
        o.descr,
        o.ordered_qty as qty,
        o.ordered_qty,
        coalesce(r.received_qty, 0) as received_qty,
        greatest(o.ordered_qty - coalesce(r.received_qty, 0), 0) as missing_qty,
        o.ui,
        case when o.any_received then 'Y' else 'N' end as received,
        o.rcvddate,
        o.rcvdnos as rcvdno,
        o.rcvdnos as billno,
        o.rcvddate as billdate,
        coalesce(pl.pimas_link_missing, false) as pimas_link_missing,
        case
          when not o.any_received then 'pending_receive'
          when coalesce(r.received_qty, 0) >= o.ordered_qty and o.ordered_qty > 0
            then 'complete'
          else 'partially_received'
        end as status,
        'bcode'::text as grain
      from ordered o
      left join received r
        on r.docno = o.docno and r.bcode = o.bcode
      left join pimas_link pl
        on pl.docno = o.docno and pl.bcode = o.bcode
      left join raw_kcw.raw_hq_apmas_payable ap on ap."ACCTNO" = o.vendor
    ),
    filtered as (
      select *
      from classified c
      where c.status = v_status
        and (
          case
            when v_from is not null then coalesce(c.docdate, '') >= v_from
            else coalesce(c.docdate, '') >= v_cutoff
          end
          and (v_to is null or coalesce(c.docdate, '') <= v_to)
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
          or coalesce(c.billno, '') ilike '%' || v_q || '%'
        )
    )
    select jsonb_build_object(
      'count', (select count(*)::bigint from filtered),
      'grain', 'bcode',
      'rows', coalesce((
        select jsonb_agg(to_jsonb(r) order by
          r.docdate desc nulls last, r.docno, r.bcode nulls last)
        from (
          select * from filtered
          order by docdate desc nulls last, docno, bcode nulls last
          offset v_offset limit v_limit
        ) r
      ), '[]'::jsonb)
    ) into v_result;

  else
    -- SYP: no local PIDET — received_qty = sum(ICLOW.QTY) where RECEIVED=Y
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
        coalesce(i."RECEIVED", 'N') as received,
        left(i."RCVDDATE"::text, 10) as rcvddate,
        nullif(btrim(coalesce(i."RCVDNO", '')), '') as rcvdno
      from raw_kcw.raw_syp_iclow_stock_orders i
      where coalesce(i."CANCELED", 'N') <> 'Y'
        and i."ORDERED" = 'Y'
        and nullif(btrim(coalesce(i."DOCNO", '')), '') is not null
        and nullif(btrim(coalesce(i."BCODE", '')), '') is not null
    ),
    aggregated as (
      select
        min(i.id) as id,
        i.docno,
        max(i.docdate) as docdate,
        max(i.vendor) as vendor,
        i.bcode,
        max(i.descr) as descr,
        sum(i.qty) as ordered_qty,
        coalesce(sum(i.qty) filter (where i.received = 'Y'), 0) as received_qty,
        max(i.ui) as ui,
        bool_or(i.received = 'Y') as any_received,
        max(i.rcvddate) filter (where i.received = 'Y') as rcvddate,
        string_agg(distinct i.rcvdno, ', ' order by i.rcvdno)
          filter (where i.rcvdno is not null) as rcvdnos
      from ic i
      group by i.docno, i.bcode
    ),
    classified as (
      select
        a.id,
        a.docno,
        a.docdate,
        a.vendor,
        nullif(btrim(coalesce(ap."ACCTNAME", '')), '') as acctname,
        a.bcode,
        a.descr,
        a.ordered_qty as qty,
        a.ordered_qty,
        a.received_qty,
        greatest(a.ordered_qty - a.received_qty, 0) as missing_qty,
        a.ui,
        case when a.any_received then 'Y' else 'N' end as received,
        a.rcvddate,
        a.rcvdnos as rcvdno,
        a.rcvdnos as billno,
        a.rcvddate as billdate,
        case
          when not a.any_received then 'pending_receive'
          when a.received_qty >= a.ordered_qty and a.ordered_qty > 0 then 'complete'
          else 'partially_received'
        end as status,
        'bcode'::text as grain
      from aggregated a
      left join raw_kcw.raw_hq_apmas_payable ap on ap."ACCTNO" = a.vendor
    ),
    filtered as (
      select *
      from classified c
      where c.status = v_status
        and (
          case
            when v_from is not null then coalesce(c.docdate, '') >= v_from
            else coalesce(c.docdate, '') >= v_cutoff
          end
          and (v_to is null or coalesce(c.docdate, '') <= v_to)
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
          or coalesce(c.billno, '') ilike '%' || v_q || '%'
        )
    )
    select jsonb_build_object(
      'count', (select count(*)::bigint from filtered),
      'grain', 'bcode',
      'rows', coalesce((
        select jsonb_agg(to_jsonb(r) order by
          r.docdate desc nulls last, r.docno, r.bcode nulls last)
        from (
          select * from filtered
          order by docdate desc nulls last, docno, bcode nulls last
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
    bcode_ordered as (
      select
        bcode,
        sum(qty) as ordered_qty,
        bool_or(received = 'Y') as any_received
      from ic
      where bcode is not null
      group by bcode
    ),
    rcvd_links as (
      select distinct bcode, rcvdno
      from ic
      where rcvdno is not null and bcode is not null
    ),
    pidet_by_bill as (
      select
        nullif(btrim(coalesce(d."BILLNO", '')), '') as billno,
        nullif(btrim(coalesce(d."BCODE", '')), '') as bcode,
        sum(coalesce(d."QTY"::numeric, 0)) as qty,
        max(left(d."BILLDATE"::text, 10)) as billdate,
        max(nullif(btrim(coalesce(d."DETAIL", '')), '')) as descr,
        max(nullif(btrim(coalesce(d."UI", '')), '')) as ui
      from raw_kcw.raw_hq_pidet_purchase_lines d
      where coalesce(d."CANCELED", '') <> 'Y'
        and coalesce(d."BILLTYPE", '') in ('1', '2', '3')
        and nullif(btrim(coalesce(d."BCODE", '')), '') is not null
      group by 1, 2
    ),
    bcode_received as (
      select
        l.bcode,
        sum(p.qty) as received_qty
      from rcvd_links l
      join pidet_by_bill p
        on p.bcode = l.bcode
       and (
          p.billno = l.rcvdno
          or (
            char_length(l.rcvdno) = 12
            and left(p.billno, 12) = l.rcvdno
            and char_length(p.billno) > 12
            and not exists (
              select 1
              from raw_kcw.raw_hq_pimas_purchase_bills px
              where px."BILLNO" = l.rcvdno
                and coalesce(px."CANCELED", '') <> 'Y'
            )
          )
        )
      group by l.bcode
    ),
    missing as (
      select
        o.bcode,
        null::text as id,
        v_docno as docno,
        (select max(docdate) from ic) as docdate,
        (select max(vendor) from ic) as vendor,
        (select max(descr) from ic i2 where i2.bcode = o.bcode) as descr,
        greatest(o.ordered_qty - coalesce(r.received_qty, 0), 0) as qty,
        (select max(ui) from ic i2 where i2.bcode = o.bcode) as ui,
        'Y'::text as ordered,
        case when o.any_received then 'Y' else 'N' end as received,
        null::text as rcvddate,
        null::text as rcvdno
      from bcode_ordered o
      left join bcode_received r on r.bcode = o.bcode
      where greatest(o.ordered_qty - coalesce(r.received_qty, 0), 0) > 0
    ),
    pidet_recv as (
      select
        'pidet'::text as source,
        p.billno,
        p.billdate,
        p.bcode,
        p.descr,
        p.qty,
        p.ui,
        null::text as iclow_id
      from rcvd_links l
      join pidet_by_bill p
        on p.bcode = l.bcode
       and (
          p.billno = l.rcvdno
          or (
            char_length(l.rcvdno) = 12
            and left(p.billno, 12) = l.rcvdno
            and char_length(p.billno) > 12
            and not exists (
              select 1
              from raw_kcw.raw_hq_pimas_purchase_bills px
              where px."BILLNO" = l.rcvdno
                and coalesce(px."CANCELED", '') <> 'Y'
            )
          )
        )
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
        i.id as iclow_id,
        not exists (
          select 1 from raw_kcw.raw_hq_pimas_purchase_bills p
          where coalesce(p."CANCELED", '') <> 'Y'
            and (
              p."BILLNO" = i.rcvdno
              or (
                char_length(i.rcvdno) = 12
                and left(p."BILLNO", 12) = i.rcvdno
                and char_length(btrim(p."BILLNO")) > 12
              )
            )
        ) as pimas_link_missing
      from ic i
      where i.received = 'Y'
        and i.rcvdno is not null
        and not exists (
          select 1 from raw_kcw.raw_hq_pidet_purchase_lines d
          where coalesce(d."CANCELED", '') <> 'Y'
            and coalesce(d."BILLTYPE", '') in ('1', '2', '3')
            and nullif(btrim(coalesce(d."BCODE", '')), '') = i.bcode
            and (
              d."BILLNO" = i.rcvdno
              or (
                char_length(i.rcvdno) = 12
                and left(d."BILLNO", 12) = i.rcvdno
                and char_length(btrim(d."BILLNO")) > 12
                and not exists (
                  select 1
                  from raw_kcw.raw_hq_pimas_purchase_bills px
                  where px."BILLNO" = i.rcvdno
                    and coalesce(px."CANCELED", '') <> 'Y'
                )
              )
            )
        )
    ),
    pidet_recv_flagged as (
      select
        source, billno, billdate, bcode, descr, qty, ui, iclow_id,
        false as pimas_link_missing
      from pidet_recv
    ),
    received as (
      select * from pidet_recv_flagged
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
        select jsonb_agg(to_jsonb(m) order by m.bcode nulls last) from missing m
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
        id as iclow_id,
        false as pimas_link_missing
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

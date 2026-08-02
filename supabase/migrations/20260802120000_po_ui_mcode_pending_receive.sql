-- ICLOW-backed pending-receive list + partial PO detail for /po.
-- Source of truth: docs/bi/kcw-iclow-pending-receive-data-dictionary.md §6
--
-- Grain for ordered statuses: DOCNO + BCODE.
-- HQ received qty: sum(PIDET.QTY) via distinct ICLOW.RCVDNO → PIDET.BILLNO + BCODE
--   (do NOT use PIMAS.PO — unreliable).
-- Legacy PARTS9 ICLOW.RCVDNO is truncated to 12 chars; PIMAS.BILLNO may be longer and/or
-- padded with spaces. Join key: left(btrim(BILLNO),12) = left(btrim(RCVDNO),12), then PIDET.
-- Perf: date-filter ICLOW early; skip PIDET for pending_receive; avoid correlated NOT EXISTS.
-- SYP received qty: ICLOW.RCVDNO → left(btrim,12) → HQ SIMas/SIDet (TF transfer bills).
-- Do NOT use PIMAS.PO or ICLOW RECEIVED qty alone for complete/partial split.

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
  -- Avoid temp-file spill on large DOCNO+BCODE aggregates / joins.
  perform set_config('work_mem', '64MB', true);
  perform set_config('plan_cache_mode', 'force_custom_plan', true);

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
          nullif(btrim(coalesce(i."MCODE", '')), '') as mcode,
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
            or coalesce(b.mcode, '') ilike '%' || v_q || '%'
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
          nullif(btrim(coalesce(i."MCODE", '')), '') as mcode,
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
            or coalesce(b.mcode, '') ilike '%' || v_q || '%'
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
  elsif v_site = 'HQ' and v_status = 'pending_receive' then
    -- Light path: no PIDET (pending = no RECEIVED=Y on the BCODE)
    with ic as materialized (
      select
        i."ID" as id,
        nullif(btrim(coalesce(i."DOCNO", '')), '') as docno,
        i."DOCDATE" as docdate,
        nullif(btrim(coalesce(i."VENDOR", '')), '') as vendor,
        nullif(btrim(coalesce(i."BCODE", '')), '') as bcode,
        nullif(btrim(coalesce(i."DESCR", '')), '') as descr,
          nullif(btrim(coalesce(i."MCODE", '')), '') as mcode,
        coalesce(i."QTY"::numeric, 0) as qty,
        nullif(btrim(coalesce(i."UI", '')), '') as ui,
        coalesce(i."RECEIVED", 'N') as received,
        nullif(btrim(coalesce(i."RCVDNO", '')), '') as rcvdno
      from raw_kcw.raw_hq_iclow_stock_orders i
      where coalesce(i."CANCELED", 'N') <> 'Y'
        and i."ORDERED" = 'Y'
        and nullif(btrim(coalesce(i."DOCNO", '')), '') is not null
        and nullif(btrim(coalesce(i."BCODE", '')), '') is not null
        and (
          case
            when v_from is not null then coalesce(i."DOCDATE", '') >= v_from
            else coalesce(i."DOCDATE", '') >= v_cutoff
          end
          and (v_to is null or coalesce(i."DOCDATE", '') <= v_to)
        )
        and (v_vendor is null or nullif(btrim(coalesce(i."VENDOR", '')), '') = v_vendor)
    ),
    aggregated as (
      select
        min(i.id) as id,
        i.docno,
        max(i.docdate) as docdate,
        max(i.vendor) as vendor,
        i.bcode,
        max(i.descr) as descr,
        max(i.mcode) as mcode,
        sum(i.qty) as ordered_qty,
        max(i.ui) as ui,
        max(i.rcvdno) as rcvdnos
      from ic i
      group by i.docno, i.bcode
      having bool_or(i.received = 'Y') = false
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
        a.mcode,
        a.ordered_qty as qty,
        a.ordered_qty,
        0::numeric as received_qty,
        a.ordered_qty as missing_qty,
        a.ui,
        'N'::text as received,
        null::text as rcvddate,
        a.rcvdnos as rcvdno,
        a.rcvdnos as billno,
        null::text as billdate,
        false as pimas_link_missing,
        'pending_receive'::text as status,
        'bcode'::text as grain
      from aggregated a
      left join raw_kcw.raw_hq_apmas_payable ap on ap."ACCTNO" = a.vendor
    ),
    filtered as materialized (
      select *
      from classified c
      where (
          v_q is null
          or coalesce(c.docno, '') ilike '%' || v_q || '%'
          or coalesce(c.vendor, '') ilike '%' || v_q || '%'
          or coalesce(c.acctname, '') ilike '%' || v_q || '%'
          or coalesce(c.bcode, '') ilike '%' || v_q || '%'
          or coalesce(c.descr, '') ilike '%' || v_q || '%'
          or coalesce(c.mcode, '') ilike '%' || v_q || '%'
          or coalesce(c.rcvdno, '') ilike '%' || v_q || '%'
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

  elsif v_site = 'HQ' then
    -- complete / partially_received: resolve RCVDNO→BILLNO once, then PIDET
    with ic as materialized (
      select
        i."ID" as id,
        nullif(btrim(coalesce(i."DOCNO", '')), '') as docno,
        i."DOCDATE" as docdate,
        nullif(btrim(coalesce(i."VENDOR", '')), '') as vendor,
        nullif(btrim(coalesce(i."BCODE", '')), '') as bcode,
        nullif(btrim(coalesce(i."DESCR", '')), '') as descr,
          nullif(btrim(coalesce(i."MCODE", '')), '') as mcode,
        coalesce(i."QTY"::numeric, 0) as qty,
        nullif(btrim(coalesce(i."UI", '')), '') as ui,
        coalesce(i."RECEIVED", 'N') as received,
        left(i."RCVDDATE"::text, 10) as rcvddate,
        nullif(btrim(coalesce(i."RCVDNO", '')), '') as rcvdno
      from raw_kcw.raw_hq_iclow_stock_orders i
      where coalesce(i."CANCELED", 'N') <> 'Y'
        and i."ORDERED" = 'Y'
        and nullif(btrim(coalesce(i."DOCNO", '')), '') is not null
        and nullif(btrim(coalesce(i."BCODE", '')), '') is not null
        and (
          case
            when v_from is not null then coalesce(i."DOCDATE", '') >= v_from
            else coalesce(i."DOCDATE", '') >= v_cutoff
          end
          and (v_to is null or coalesce(i."DOCDATE", '') <= v_to)
        )
        and (v_vendor is null or nullif(btrim(coalesce(i."VENDOR", '')), '') = v_vendor)
    ),
    ordered as materialized (
      select
        min(i.id) as id,
        i.docno,
        max(i.docdate) as docdate,
        max(i.vendor) as vendor,
        i.bcode,
        max(i.descr) as descr,
        max(i.mcode) as mcode,
        sum(i.qty) as ordered_qty,
        max(i.ui) as ui,
        bool_or(i.received = 'Y') as any_received,
        max(i.rcvddate) filter (where i.received = 'Y') as rcvddate,
        max(i.rcvdno) as rcvdnos
      from ic i
      group by i.docno, i.bcode
      having bool_or(i.received = 'Y')
    ),
    rcvdnos as materialized (
      select distinct i.rcvdno
      from ic i
      where i.rcvdno is not null
        and i.received = 'Y'
    ),
    -- Normalize BILLNO/RCVDNO: btrim + left(...,12) before join (PARTS9 pad/trunc).
    resolved as materialized (
      select distinct on (r.rcvdno)
        r.rcvdno,
        p."BILLNO" as billno
      from rcvdnos r
      join raw_kcw.raw_hq_pimas_purchase_bills p
        on left(btrim(p."BILLNO"), 12) = left(r.rcvdno, 12)
       and coalesce(p."CANCELED", '') <> 'Y'
      order by
        r.rcvdno,
        case when btrim(p."BILLNO") = r.rcvdno then 0 else 1 end,
        char_length(btrim(p."BILLNO")),
        p."BILLNO"
    ),
    rcvd_links as materialized (
      select distinct i.docno, i.bcode, i.rcvdno
      from ic i
      where i.rcvdno is not null
        and i.received = 'Y'
    ),
    received as materialized (
      select
        l.docno,
        l.bcode,
        sum(coalesce(d."QTY"::numeric, 0)) as received_qty
      from rcvd_links l
      join resolved r on r.rcvdno = l.rcvdno
      join raw_kcw.raw_hq_pidet_purchase_lines d
        on d."BILLNO" = r.billno
       and d."BCODE" = l.bcode
       and coalesce(d."CANCELED", '') <> 'Y'
       and coalesce(d."BILLTYPE", '') in ('1', '2', '3')
      group by l.docno, l.bcode
    ),
    resolved_rcvdnos as materialized (
      select distinct rcvdno from resolved
    ),
    pimas_link as materialized (
      select
        l.docno,
        l.bcode,
        bool_or(res.rcvdno is null) as pimas_link_missing
      from rcvd_links l
      left join resolved_rcvdnos res
        on res.rcvdno = l.rcvdno
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
        o.mcode,
        o.ordered_qty as qty,
        o.ordered_qty,
        coalesce(r.received_qty, 0) as received_qty,
        greatest(o.ordered_qty - coalesce(r.received_qty, 0), 0) as missing_qty,
        o.ui,
        'Y'::text as received,
        o.rcvddate,
        o.rcvdnos as rcvdno,
        o.rcvdnos as billno,
        o.rcvddate as billdate,
        coalesce(pl.pimas_link_missing, false) as pimas_link_missing,
        case
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
    filtered as materialized (
      select *
      from classified c
      where c.status = v_status
        and (
          v_q is null
          or coalesce(c.docno, '') ilike '%' || v_q || '%'
          or coalesce(c.vendor, '') ilike '%' || v_q || '%'
          or coalesce(c.acctname, '') ilike '%' || v_q || '%'
          or coalesce(c.bcode, '') ilike '%' || v_q || '%'
          or coalesce(c.descr, '') ilike '%' || v_q || '%'
          or coalesce(c.mcode, '') ilike '%' || v_q || '%'
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

  elsif v_site = 'SYP' and v_status = 'pending_receive' then
    with ic as (
      select
        i."ID" as id,
        nullif(btrim(coalesce(i."DOCNO", '')), '') as docno,
        left(i."DOCDATE"::text, 10) as docdate,
        nullif(btrim(coalesce(i."VENDOR", '')), '') as vendor,
        nullif(btrim(coalesce(i."BCODE", '')), '') as bcode,
        nullif(btrim(coalesce(i."DESCR", '')), '') as descr,
          nullif(btrim(coalesce(i."MCODE", '')), '') as mcode,
        coalesce(i."QTY"::numeric, 0) as qty,
        nullif(btrim(coalesce(i."UI", '')), '') as ui,
        coalesce(i."RECEIVED", 'N') as received,
        nullif(btrim(coalesce(i."RCVDNO", '')), '') as rcvdno
      from raw_kcw.raw_syp_iclow_stock_orders i
      where coalesce(i."CANCELED", 'N') <> 'Y'
        and i."ORDERED" = 'Y'
        and nullif(btrim(coalesce(i."DOCNO", '')), '') is not null
        and nullif(btrim(coalesce(i."BCODE", '')), '') is not null
        and (
          case
            when v_from is not null then coalesce(i."DOCDATE", '') >= v_from
            else coalesce(i."DOCDATE", '') >= v_cutoff
          end
          and (v_to is null or coalesce(i."DOCDATE", '') <= v_to)
        )
        and (v_vendor is null or nullif(btrim(coalesce(i."VENDOR", '')), '') = v_vendor)
    ),
    aggregated as (
      select
        min(i.id) as id,
        i.docno,
        max(i.docdate) as docdate,
        max(i.vendor) as vendor,
        i.bcode,
        max(i.descr) as descr,
        max(i.mcode) as mcode,
        sum(i.qty) as ordered_qty,
        max(i.ui) as ui,
        max(i.rcvdno) as rcvdnos
      from ic i
      group by i.docno, i.bcode
      having bool_or(i.received = 'Y') = false
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
        a.mcode,
        a.ordered_qty as qty,
        a.ordered_qty,
        0::numeric as received_qty,
        a.ordered_qty as missing_qty,
        a.ui,
        'N'::text as received,
        null::text as rcvddate,
        a.rcvdnos as rcvdno,
        a.rcvdnos as billno,
        null::text as billdate,
        false as pimas_link_missing,
        'pending_receive'::text as status,
        'bcode'::text as grain
      from aggregated a
      left join raw_kcw.raw_hq_apmas_payable ap on ap."ACCTNO" = a.vendor
    ),
    filtered as materialized (
      select *
      from classified c
      where (
          v_q is null
          or coalesce(c.docno, '') ilike '%' || v_q || '%'
          or coalesce(c.vendor, '') ilike '%' || v_q || '%'
          or coalesce(c.acctname, '') ilike '%' || v_q || '%'
          or coalesce(c.bcode, '') ilike '%' || v_q || '%'
          or coalesce(c.descr, '') ilike '%' || v_q || '%'
          or coalesce(c.mcode, '') ilike '%' || v_q || '%'
          or coalesce(c.rcvdno, '') ilike '%' || v_q || '%'
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

  elsif v_site = 'SYP' then
    -- complete / partially_received: RCVDNO → SIMas/SIDet (TF transfer bills at HQ)
    with ic as materialized (
      select
        i."ID" as id,
        nullif(btrim(coalesce(i."DOCNO", '')), '') as docno,
        left(i."DOCDATE"::text, 10) as docdate,
        nullif(btrim(coalesce(i."VENDOR", '')), '') as vendor,
        nullif(btrim(coalesce(i."BCODE", '')), '') as bcode,
        nullif(btrim(coalesce(i."DESCR", '')), '') as descr,
          nullif(btrim(coalesce(i."MCODE", '')), '') as mcode,
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
        and (
          case
            when v_from is not null then coalesce(i."DOCDATE", '') >= v_from
            else coalesce(i."DOCDATE", '') >= v_cutoff
          end
          and (v_to is null or coalesce(i."DOCDATE", '') <= v_to)
        )
        and (v_vendor is null or nullif(btrim(coalesce(i."VENDOR", '')), '') = v_vendor)
    ),
    ordered as materialized (
      select
        min(i.id) as id,
        i.docno,
        max(i.docdate) as docdate,
        max(i.vendor) as vendor,
        i.bcode,
        max(i.descr) as descr,
        max(i.mcode) as mcode,
        sum(i.qty) as ordered_qty,
        max(i.ui) as ui,
        max(i.rcvddate) filter (where i.received = 'Y') as rcvddate,
        max(i.rcvdno) as rcvdnos
      from ic i
      group by i.docno, i.bcode
      having bool_or(i.received = 'Y')
    ),
    rcvdnos as materialized (
      select distinct i.rcvdno
      from ic i
      where i.rcvdno is not null
        and i.received = 'Y'
    ),
    resolved as materialized (
      select distinct on (r.rcvdno)
        r.rcvdno,
        s."BILLNO" as billno
      from rcvdnos r
      join raw_kcw.raw_hq_simas_sales_bills s
        on left(btrim(s."BILLNO"), 12) = left(r.rcvdno, 12)
       and coalesce(s."CANCELED", '') <> 'Y'
      order by
        r.rcvdno,
        case when btrim(s."BILLNO") = r.rcvdno then 0 else 1 end,
        char_length(btrim(s."BILLNO")),
        s."BILLNO"
    ),
    rcvd_links as materialized (
      select distinct i.docno, i.bcode, i.rcvdno
      from ic i
      where i.rcvdno is not null
        and i.received = 'Y'
    ),
    received as materialized (
      select
        l.docno,
        l.bcode,
        sum(coalesce(d."QTY"::numeric, 0)) as received_qty
      from rcvd_links l
      join resolved r on r.rcvdno = l.rcvdno
      join raw_kcw.raw_hq_sidet_sales_lines d
        on d."BILLNO" = r.billno
       and d."BCODE" = l.bcode
       and coalesce(d."CANCELED", '') <> 'Y'
       and coalesce(d."BILLTYPE", '') in ('1', '2', '3')
      group by l.docno, l.bcode
    ),
    resolved_rcvdnos as materialized (
      select distinct rcvdno from resolved
    ),
    bill_link as materialized (
      select
        l.docno,
        l.bcode,
        bool_or(res.rcvdno is null) as pimas_link_missing
      from rcvd_links l
      left join resolved_rcvdnos res
        on res.rcvdno = l.rcvdno
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
        o.mcode,
        o.ordered_qty as qty,
        o.ordered_qty,
        coalesce(r.received_qty, 0) as received_qty,
        greatest(o.ordered_qty - coalesce(r.received_qty, 0), 0) as missing_qty,
        o.ui,
        'Y'::text as received,
        o.rcvddate,
        o.rcvdnos as rcvdno,
        o.rcvdnos as billno,
        o.rcvddate as billdate,
        coalesce(bl.pimas_link_missing, false) as pimas_link_missing,
        case
          when coalesce(r.received_qty, 0) >= o.ordered_qty and o.ordered_qty > 0
            then 'complete'
          else 'partially_received'
        end as status,
        'bcode'::text as grain
      from ordered o
      left join received r
        on r.docno = o.docno and r.bcode = o.bcode
      left join bill_link bl
        on bl.docno = o.docno and bl.bcode = o.bcode
      left join raw_kcw.raw_hq_apmas_payable ap on ap."ACCTNO" = o.vendor
    ),
    filtered as materialized (
      select *
      from classified c
      where c.status = v_status
        and (
          v_q is null
          or coalesce(c.docno, '') ilike '%' || v_q || '%'
          or coalesce(c.vendor, '') ilike '%' || v_q || '%'
          or coalesce(c.acctname, '') ilike '%' || v_q || '%'
          or coalesce(c.bcode, '') ilike '%' || v_q || '%'
          or coalesce(c.descr, '') ilike '%' || v_q || '%'
          or coalesce(c.mcode, '') ilike '%' || v_q || '%'
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
          nullif(btrim(coalesce(i."MCODE", '')), '') as mcode,
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
    rcvdnos as (
      select distinct rcvdno
      from ic
      where rcvdno is not null
    ),
    -- Normalize BILLNO/RCVDNO: btrim + left(...,12) before join (PARTS9 pad/trunc).
    resolved as (
      select distinct on (r.rcvdno)
        r.rcvdno,
        p."BILLNO" as billno
      from rcvdnos r
      join raw_kcw.raw_hq_pimas_purchase_bills p
        on left(btrim(p."BILLNO"), 12) = left(r.rcvdno, 12)
       and coalesce(p."CANCELED", '') <> 'Y'
      order by
        r.rcvdno,
        case when btrim(p."BILLNO") = r.rcvdno then 0 else 1 end,
        char_length(btrim(p."BILLNO")),
        p."BILLNO"
    ),
    rcvd_links as (
      select distinct bcode, rcvdno
      from ic
      where rcvdno is not null and bcode is not null
    ),
    bcode_received as (
      select
        l.bcode,
        sum(coalesce(d."QTY"::numeric, 0)) as received_qty
      from rcvd_links l
      join resolved r on r.rcvdno = l.rcvdno
      join raw_kcw.raw_hq_pidet_purchase_lines d
        on d."BILLNO" = r.billno
       and d."BCODE" = l.bcode
       and coalesce(d."CANCELED", '') <> 'Y'
       and coalesce(d."BILLTYPE", '') in ('1', '2', '3')
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
        (select max(mcode) from ic i2 where i2.bcode = o.bcode) as mcode,
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
        d."BILLNO" as billno,
        left(d."BILLDATE"::text, 10) as billdate,
        nullif(btrim(coalesce(d."BCODE", '')), '') as bcode,
        nullif(btrim(coalesce(d."DETAIL", '')), '') as descr,
        nullif(btrim(coalesce(d."MCODE", '')), '') as mcode,
        coalesce(d."QTY"::numeric, 0) as qty,
        nullif(btrim(coalesce(d."UI", '')), '') as ui,
        null::text as iclow_id,
        false as pimas_link_missing
      from rcvd_links l
      join resolved r on r.rcvdno = l.rcvdno
      join raw_kcw.raw_hq_pidet_purchase_lines d
        on d."BILLNO" = r.billno
       and d."BCODE" = l.bcode
       and coalesce(d."CANCELED", '') <> 'Y'
       and coalesce(d."BILLTYPE", '') in ('1', '2', '3')
    ),
    orphan_iclow as (
      select
        'iclow'::text as source,
        i.rcvdno as billno,
        i.rcvddate as billdate,
        i.bcode,
        i.descr,
        i.mcode,
        i.qty,
        i.ui,
        i.id as iclow_id,
        (res.rcvdno is null) as pimas_link_missing
      from ic i
      left join (select distinct rcvdno from resolved) res
        on res.rcvdno = i.rcvdno
      where i.received = 'Y'
        and i.rcvdno is not null
        and not exists (
          select 1
          from resolved r
          join raw_kcw.raw_hq_pidet_purchase_lines d
            on d."BILLNO" = r.billno
           and d."BCODE" = i.bcode
           and coalesce(d."CANCELED", '') <> 'Y'
           and coalesce(d."BILLTYPE", '') in ('1', '2', '3')
          where r.rcvdno = i.rcvdno
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
          nullif(btrim(coalesce(i."MCODE", '')), '') as mcode,
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
    bcode_ordered as (
      select
        bcode,
        sum(qty) as ordered_qty,
        bool_or(received = 'Y') as any_received
      from ic
      where bcode is not null
      group by bcode
    ),
    rcvdnos as (
      select distinct rcvdno
      from ic
      where rcvdno is not null
    ),
    resolved as (
      select distinct on (r.rcvdno)
        r.rcvdno,
        s."BILLNO" as billno
      from rcvdnos r
      join raw_kcw.raw_hq_simas_sales_bills s
        on left(btrim(s."BILLNO"), 12) = left(r.rcvdno, 12)
       and coalesce(s."CANCELED", '') <> 'Y'
      order by
        r.rcvdno,
        case when btrim(s."BILLNO") = r.rcvdno then 0 else 1 end,
        char_length(btrim(s."BILLNO")),
        s."BILLNO"
    ),
    rcvd_links as (
      select distinct bcode, rcvdno
      from ic
      where rcvdno is not null and bcode is not null
    ),
    bcode_received as (
      select
        l.bcode,
        sum(coalesce(d."QTY"::numeric, 0)) as received_qty
      from rcvd_links l
      join resolved r on r.rcvdno = l.rcvdno
      join raw_kcw.raw_hq_sidet_sales_lines d
        on d."BILLNO" = r.billno
       and d."BCODE" = l.bcode
       and coalesce(d."CANCELED", '') <> 'Y'
       and coalesce(d."BILLTYPE", '') in ('1', '2', '3')
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
        (select max(mcode) from ic i2 where i2.bcode = o.bcode) as mcode,
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
    sidet_recv as (
      select
        'sidet'::text as source,
        d."BILLNO" as billno,
        left(d."BILLDATE"::text, 10) as billdate,
        nullif(btrim(coalesce(d."BCODE", '')), '') as bcode,
        nullif(btrim(coalesce(d."DETAIL", '')), '') as descr,
        nullif(btrim(coalesce(d."MCODE", '')), '') as mcode,
        coalesce(d."QTY"::numeric, 0) as qty,
        nullif(btrim(coalesce(d."UI", '')), '') as ui,
        null::text as iclow_id,
        false as pimas_link_missing
      from rcvd_links l
      join resolved r on r.rcvdno = l.rcvdno
      join raw_kcw.raw_hq_sidet_sales_lines d
        on d."BILLNO" = r.billno
       and d."BCODE" = l.bcode
       and coalesce(d."CANCELED", '') <> 'Y'
       and coalesce(d."BILLTYPE", '') in ('1', '2', '3')
    ),
    orphan_iclow as (
      select
        'iclow'::text as source,
        i.rcvdno as billno,
        i.rcvddate as billdate,
        i.bcode,
        i.descr,
        i.mcode,
        i.qty,
        i.ui,
        i.id as iclow_id,
        (res.rcvdno is null) as pimas_link_missing
      from ic i
      left join (select distinct rcvdno from resolved) res
        on res.rcvdno = i.rcvdno
      where i.received = 'Y'
        and i.rcvdno is not null
        and not exists (
          select 1
          from resolved r
          join raw_kcw.raw_hq_sidet_sales_lines d
            on d."BILLNO" = r.billno
           and d."BCODE" = i.bcode
           and coalesce(d."CANCELED", '') <> 'Y'
           and coalesce(d."BILLTYPE", '') in ('1', '2', '3')
          where r.rcvdno = i.rcvdno
        )
    ),
    received as (
      select * from sidet_recv
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

-- PODET MCODE on SYP PO line detail
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
      sum(
        coalesce(d."QTY"::numeric, 0)
        * coalesce(nullif(nullif(btrim(d."MTP"), '')::numeric, 0), 1)
      ) as tf_qty
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
        and coalesce(tf.tf_qty, 0) >= (
          coalesce(d."QTY"::numeric, 0)
          * coalesce(nullif(nullif(btrim(d."MTP"), '')::numeric, 0), 1)
        )
      ) as prepared,
      case
        when coalesce(tf.tf_qty, 0) <= 0 then 'not_prepared'
        when coalesce(tf.tf_qty, 0) >= (
          coalesce(d."QTY"::numeric, 0)
          * coalesce(nullif(nullif(btrim(d."MTP"), '')::numeric, 0), 1)
        ) then 'prepared'
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

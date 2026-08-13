-- SYP ICLOW: BCODE-level prepare_status + prepared_qty (not PO header rollup).

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


drop function if exists public.fn_po_pending_receive(text, text, text, text, text, integer, integer, integer);
drop function if exists public.fn_po_pending_receive(text, text, text, text, text, text, integer, integer, integer);

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
          case
          when coalesce(pb.prepared_qty, 0) <= 0 then 'not_prepared'
          when coalesce(pb.prepared_qty, 0) >= (coalesce(i."QTY"::numeric, 0)) and (coalesce(i."QTY"::numeric, 0)) > 0 then 'prepared'
          else 'partially_prepared'
        end as prepare_status,
          coalesce(pb.prepared_qty, 0) as prepared_qty,
          pb.tf_billnos as prepare_tf_billnos,
          'to_be_ordered'::text as status,
          'line'::text as grain
        from raw_kcw.raw_syp_iclow_stock_orders i
        left join raw_kcw.raw_hq_apmas_payable ap on ap."ACCTNO" = i."VENDOR"
        left join public.fn_po_syp_tf_prepare_by_bcode() pb
          on pb.docno = nullif(btrim(coalesce(i."DOCNO", '')), '')
         and pb.bcode = nullif(btrim(coalesce(i."BCODE", '')), '')
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
    rcvd_links as materialized (
      select distinct i.docno, i.bcode, i.rcvdno
      from ic i
      where i.rcvdno is not null
        and i.received = 'Y'
    ),
    -- 1:1 / left-12 BILLNO match (PARTS9 pad/trunc).
    resolved_exact as materialized (
      select distinct on (r.rcvdno)
        r.rcvdno,
        p."BILLNO" as billno,
        'exact'::text as match_method
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
    -- Implied BILLNO: equal after stripping spaces (A219623 ↔ "A 219623"). Not 1:1.
    resolved_implied_billno as materialized (
      select distinct on (r.rcvdno)
        r.rcvdno,
        p."BILLNO" as billno,
        'pattern'::text as match_method
      from rcvdnos r
      join raw_kcw.raw_hq_pimas_purchase_bills p
        on replace(left(btrim(p."BILLNO"), 12), ' ', '')
         = replace(left(r.rcvdno, 12), ' ', '')
       and coalesce(p."CANCELED", '') <> 'Y'
      where not exists (
        select 1 from resolved_exact e where e.rcvdno = r.rcvdno
      )
        and replace(left(btrim(p."BILLNO"), 12), ' ', '')
          <> left(btrim(p."BILLNO"), 12)
      order by
        r.rcvdno,
        case
          when replace(btrim(p."BILLNO"), ' ', '') = replace(r.rcvdno, ' ', '') then 0
          else 1
        end,
        char_length(btrim(p."BILLNO")),
        p."BILLNO"
    ),
    -- RCVDNO+DOCNO still missing after exact/implied → pattern candidates (AP + PO key).
    unmatched_hdr as materialized (
      select
        l.rcvdno,
        l.docno,
        max(i.vendor) as vendor,
        max(i.rcvddate) as rcvddate
      from (select distinct rcvdno, docno from rcvd_links) l
      join ic i
        on i.rcvdno = l.rcvdno
       and i.docno = l.docno
       and i.received = 'Y'
      where not exists (
        select 1 from resolved_exact e where e.rcvdno = l.rcvdno
      )
        and not exists (
          select 1 from resolved_implied_billno e where e.rcvdno = l.rcvdno
        )
        and l.docno is not null
      group by l.rcvdno, l.docno
      having max(i.vendor) is not null
    ),
    ic_fp as materialized (
      select
        i.rcvdno,
        i.docno,
        i.bcode,
        sum(i.qty) as qty
      from ic i
      join unmatched_hdr u
        on u.rcvdno = i.rcvdno and u.docno = i.docno
      where i.received = 'Y'
        and i.rcvdno is not null
        and i.bcode is not null
      group by i.rcvdno, i.docno, i.bcode
    ),
    pattern_cand as materialized (
      select
        u.rcvdno,
        u.docno,
        u.vendor,
        u.rcvddate,
        p."BILLNO" as billno,
        left(p."BILLDATE"::text, 10) as billdate
      from unmatched_hdr u
      join raw_kcw.raw_hq_pimas_purchase_bills p
        on btrim(coalesce(p."ACCTNO", '')) = u.vendor
       and coalesce(p."CANCELED", '') <> 'Y'
       and (
         btrim(coalesce(p."PO", '')) = u.docno
         or public.fn_po_docno_key(p."PO") = public.fn_po_docno_key(u.docno)
         or btrim(coalesce(p."PO", '')) like u.docno || '/%'
         or btrim(coalesce(p."PO", '')) like '%/' || u.docno
         or btrim(coalesce(p."PO", '')) like '%/' || u.docno || '/%'
         or (
           public.fn_po_docno_key(u.docno) is not null
           and (
             btrim(coalesce(p."PO", '')) like public.fn_po_docno_key(u.docno) || '/%'
             or btrim(coalesce(p."PO", '')) like '%/' || public.fn_po_docno_key(u.docno)
             or btrim(coalesce(p."PO", '')) like '%/' || public.fn_po_docno_key(u.docno) || '/%'
           )
         )
       )
    ),
    pattern_score as materialized (
      select
        c.rcvdno,
        c.docno,
        c.billno,
        c.billdate,
        c.rcvddate,
        (
          select count(*)::int from ic_fp f
          where f.rcvdno = c.rcvdno and f.docno = c.docno
        ) as ic_n,
        (
          select count(*)::int
          from ic_fp f
          where f.rcvdno = c.rcvdno
            and f.docno = c.docno
            and (
              select coalesce(sum(d."QTY"::numeric), 0)
              from raw_kcw.raw_hq_pidet_purchase_lines d
              where d."BILLNO" = c.billno
                and d."BCODE" = f.bcode
                and coalesce(d."CANCELED", '') <> 'Y'
                and coalesce(d."BILLTYPE", '') in ('1', '2', '3')
            ) = f.qty
        ) as hit_n
      from pattern_cand c
    ),
    pattern_ranked as materialized (
      select
        s.*,
        rank() over (
          partition by s.rcvdno, s.docno
          order by
            abs(
              nullif(s.billdate, '')::date
              - nullif(s.rcvddate, '')::date
            ) nulls last,
            btrim(s.billno)
        ) as rk
      from pattern_score s
      where s.ic_n > 0
        and s.hit_n = s.ic_n
    ),
    -- Accept only a unique best candidate (pattern recognition, not 1:1 BILLNO).
    resolved_pattern as materialized (
      select
        r.rcvdno,
        r.docno,
        r.billno,
        'pattern'::text as match_method
      from pattern_ranked r
      where r.rk = 1
        and not exists (
          select 1
          from pattern_ranked r2
          where r2.rcvdno = r.rcvdno
            and r2.docno = r.docno
            and r2.rk = 1
            and btrim(r2.billno) <> btrim(r.billno)
        )
    ),
    -- Unified resolve at (rcvdno, docno): exact/implied billno apply to every DOCNO for that RCVDNO.
    resolved as materialized (
      select
        l.rcvdno,
        l.docno,
        e.billno,
        e.match_method
      from (select distinct rcvdno, docno from rcvd_links) l
      join resolved_exact e on e.rcvdno = l.rcvdno
      union all
      select
        l.rcvdno,
        l.docno,
        i.billno,
        i.match_method
      from (select distinct rcvdno, docno from rcvd_links) l
      join resolved_implied_billno i on i.rcvdno = l.rcvdno
      union all
      select
        p.rcvdno,
        p.docno,
        p.billno,
        p.match_method
      from resolved_pattern p
    ),
    received as materialized (
      select
        l.docno,
        l.bcode,
        sum(coalesce(d."QTY"::numeric, 0)) as received_qty
      from rcvd_links l
      join resolved r
        on r.rcvdno = l.rcvdno
       and r.docno = l.docno
      join raw_kcw.raw_hq_pidet_purchase_lines d
        on d."BILLNO" = r.billno
       and d."BCODE" = l.bcode
       and coalesce(d."CANCELED", '') <> 'Y'
       and coalesce(d."BILLTYPE", '') in ('1', '2', '3')
      group by l.docno, l.bcode
    ),
    pimas_link as materialized (
      select
        l.docno,
        l.bcode,
        bool_or(res.billno is null) as pimas_link_missing,
        bool_or(res.match_method = 'exact') as any_exact,
        bool_or(res.match_method = 'pattern') as any_pattern
      from rcvd_links l
      left join resolved res
        on res.rcvdno = l.rcvdno
       and res.docno = l.docno
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
          when coalesce(pl.pimas_link_missing, false) then null
          when coalesce(pl.any_pattern, false)
            and not coalesce(pl.any_exact, false) then 'pattern'
          when coalesce(pl.any_pattern, false)
            and coalesce(pl.any_exact, false) then 'mixed'
          else 'exact'
        end as pimas_match_method,
        nullif(btrim(coalesce(rd.billno, '')), '') as pimas_matched_billno,
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
      left join resolved rd
        on rd.rcvdno = o.rcvdnos
       and rd.docno = o.docno
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
          or coalesce(c.pimas_matched_billno, '') ilike '%' || v_q || '%'
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
        case
          when coalesce(pb.prepared_qty, 0) <= 0 then 'not_prepared'
          when coalesce(pb.prepared_qty, 0) >= (a.ordered_qty) and (a.ordered_qty) > 0 then 'prepared'
          else 'partially_prepared'
        end as prepare_status,
        coalesce(pb.prepared_qty, 0) as prepared_qty,
        pb.tf_billnos as prepare_tf_billnos,
        'pending_receive'::text as status,
        'bcode'::text as grain
      from aggregated a
      left join raw_kcw.raw_hq_apmas_payable ap on ap."ACCTNO" = a.vendor
      left join public.fn_po_syp_tf_prepare_by_bcode() pb
        on pb.docno = a.docno and pb.bcode = a.bcode
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
          or coalesce(c.prepare_tf_billnos, '') ilike '%' || v_q || '%'
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
    -- complete / partially_received: RCVDNO TF ∪ REMARKS-matched follow-up TF/TFV
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
    bill_from_rcvdno as materialized (
      select distinct
        l.docno,
        r.billno
      from rcvd_links l
      join resolved r on r.rcvdno = l.rcvdno
    ),
    bill_from_remarks as materialized (
      select distinct
        b.docno,
        b.billno
      from public.fn_po_syp_tf_bills_by_docno() b
      where exists (
        select 1 from ordered o where o.docno = b.docno
      )
    ),
    all_bills as materialized (
      select docno, billno from bill_from_rcvdno
      union
      select docno, billno from bill_from_remarks
    ),
    received as materialized (
      select
        o.docno,
        o.bcode,
        sum(coalesce(d."QTY"::numeric, 0)) as received_qty
      from ordered o
      join all_bills ab on ab.docno = o.docno
      join raw_kcw.raw_hq_sidet_sales_lines d
        on d."BILLNO" = ab.billno
       and d."BCODE" = o.bcode
       and coalesce(d."CANCELED", '') <> 'Y'
       and coalesce(d."BILLTYPE", '') in ('1', '2', '3')
      group by o.docno, o.bcode
    ),
    tf_bills as materialized (
      select
        o.docno,
        o.bcode,
        string_agg(
          distinct btrim(ab.billno::text),
          ', ' order by btrim(ab.billno::text)
        ) as tf_billnos
      from ordered o
      join all_bills ab on ab.docno = o.docno
      join raw_kcw.raw_hq_sidet_sales_lines d
        on d."BILLNO" = ab.billno
       and d."BCODE" = o.bcode
       and coalesce(d."CANCELED", '') <> 'Y'
       and coalesce(d."BILLTYPE", '') in ('1', '2', '3')
      group by o.docno, o.bcode
    ),
    bill_link as materialized (
      select
        o.docno,
        o.bcode,
        -- true when neither RCVDNO nor REMARKS TF yields SIDet qty for this BCODE
        (coalesce(r.received_qty, 0) = 0) as pimas_link_missing
      from ordered o
      left join received r
        on r.docno = o.docno and r.bcode = o.bcode
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
        tb.tf_billnos,
        coalesce(bl.pimas_link_missing, false) as pimas_link_missing,
        case
          when coalesce(pb.prepared_qty, 0) <= 0 then 'not_prepared'
          when coalesce(pb.prepared_qty, 0) >= (o.ordered_qty) and (o.ordered_qty) > 0 then 'prepared'
          else 'partially_prepared'
        end as prepare_status,
        coalesce(pb.prepared_qty, 0) as prepared_qty,
        pb.tf_billnos as prepare_tf_billnos,
        case
          when coalesce(r.received_qty, 0) >= o.ordered_qty and o.ordered_qty > 0
            then 'complete'
          else 'partially_received'
        end as status,
        'bcode'::text as grain
      from ordered o
      left join received r
        on r.docno = o.docno and r.bcode = o.bcode
      left join tf_bills tb
        on tb.docno = o.docno and tb.bcode = o.bcode
      left join bill_link bl
        on bl.docno = o.docno and bl.bcode = o.bcode
      left join raw_kcw.raw_hq_apmas_payable ap on ap."ACCTNO" = o.vendor
      left join public.fn_po_syp_tf_prepare_by_bcode() pb
        on pb.docno = o.docno and pb.bcode = o.bcode
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
          or coalesce(c.tf_billnos, '') ilike '%' || v_q || '%'
          or coalesce(c.prepare_tf_billnos, '') ilike '%' || v_q || '%'
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

revoke all on function public.fn_po_pending_receive(text, text, text, text, text, text, integer, integer, integer) from public;
grant execute on function public.fn_po_pending_receive(text, text, text, text, text, text, integer, integer, integer) to service_role;

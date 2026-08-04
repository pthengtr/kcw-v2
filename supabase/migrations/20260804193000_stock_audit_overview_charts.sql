-- Delta: overview adds marked_week_count + daily_marks for charts.
drop function if exists public.fn_stock_audit_overview(text, boolean);
drop function if exists public.fn_stock_audit_overview(text, boolean, text, integer, integer);

create or replace function public.fn_stock_audit_overview(
  p_branch text default 'HQ',
  p_with_stock_only boolean default true,
  p_bucket text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, stock, raw_kcw, curated_kcw
set statement_timeout = '60s'
as $$
declare
  v_branch text;
  v_bucket text;
  v_limit int;
  v_offset int;
  v_today date := public._stock_audit_bangkok_today();
  v_sales_from date;
begin
  v_branch := upper(coalesce(nullif(btrim(p_branch), ''), 'HQ'));
  if v_branch not in ('HQ', 'SYP') then
    raise exception 'Invalid branch';
  end if;

  v_bucket := lower(nullif(btrim(coalesce(p_bucket, '')), ''));
  if v_bucket is not null and v_bucket not in (
    'never', 'd30', 'd90', 'd180', 'd365', 'over_365'
  ) then
    raise exception 'Invalid bucket';
  end if;

  v_limit := greatest(1, least(coalesce(p_limit, 50), 200));
  v_offset := greatest(0, coalesce(p_offset, 0));
  v_sales_from := v_today - 29;

  return (
    with icmas as (
      select
        nullif(btrim(p."BCODE"), '') as bcode,
        coalesce(nullif(btrim(p."DESCR"), ''), '') as descr,
        coalesce(nullif(btrim(p."BRAND"), ''), '') as brand,
        coalesce(nullif(btrim(p."MODEL"), ''), '') as model,
        coalesce(nullif(btrim(p."LOCATION1"), ''), '') as location1,
        lpad(left(nullif(btrim(p."BCODE"), ''), 2), 2, '0') as category,
        public._stock_audit_parse_date(p."DATEAUDIT") as pos_dateaudit,
        public._stock_audit_parse_qty(p."QTYOH2") as qty_icmas
      from raw_kcw.raw_hq_icmas_products p
      where v_branch = 'HQ'
        and not public._stock_audit_is_canceled(p."CANCELED")
        and nullif(btrim(p."BCODE"), '') is not null
      union all
      select
        nullif(btrim(p."BCODE"), '') as bcode,
        coalesce(nullif(btrim(p."DESCR"), ''), '') as descr,
        coalesce(nullif(btrim(p."BRAND"), ''), '') as brand,
        coalesce(nullif(btrim(p."MODEL"), ''), '') as model,
        coalesce(nullif(btrim(p."LOCATION1"), ''), '') as location1,
        lpad(left(nullif(btrim(p."BCODE"), ''), 2), 2, '0') as category,
        public._stock_audit_parse_date(p."DATEAUDIT") as pos_dateaudit,
        public._stock_audit_parse_qty(p."QTYOH2") as qty_icmas
      from raw_kcw.raw_syp_icmas_products p
      where v_branch = 'SYP'
        and not public._stock_audit_is_canceled(p."CANCELED")
        and nullif(btrim(p."BCODE"), '') is not null
    ),
    inv as (
      select
        nullif(btrim(i.bcode), '') as bcode,
        coalesce(i.qty, 0)::numeric as qty
      from curated_kcw.inventory_qty_latest i
      where i.branch = v_branch
    ),
    sales_bills as (
      select
        b."BRANCH" as store_branch,
        b."BILLNO" as bill_no,
        case
          when coalesce(b."BILLTYPE_STD", '') = 'TAD' then 'ONLINE'
          when coalesce(b."BILLTYPE_STD", '') = 'CN'
            and b."BILLNO" ~* '^CNTAD' then 'ONLINE'
          else b."BRANCH"
        end as reporting_branch
      from curated_kcw.fact_sales_bills_all b
      where b."CANCELED" = 'N'
        and b."JOURMODE" <> '0'
        and coalesce(b."BILLTYPE_STD", '') not in ('TF', 'TFV', 'TAR')
        and b."BILLDATE" >= v_sales_from::text
        and b."BILLDATE" < (v_today + 1)::text
    ),
    sales_period as (
      select
        nullif(btrim(l."BCODE"), '') as bcode,
        sum(
          coalesce(nullif(replace(l."QTY", ',', ''), '')::numeric, 0)
          * coalesce(
              nullif(
                coalesce(nullif(replace(nullif(trim(l."MTP"), ''), ',', ''), '')::numeric, 0),
                0
              ),
              1
            )
        ) as sell_qty,
        sum(coalesce(nullif(replace(l."AMOUNT", ',', ''), '')::numeric, 0)) as sell_revenue
      from curated_kcw.fact_sales_all l
      join sales_bills b
        on b.store_branch = l."BRANCH"
       and b.bill_no = l."BILLNO"
      where nullif(btrim(l."BCODE"), '') is not null
        and (
          v_branch = 'HQ' and b.reporting_branch in ('HQ', 'ONLINE')
          or v_branch = 'SYP' and b.reporting_branch = 'SYP'
        )
      group by 1
    ),
    joined as (
      select
        c.bcode,
        c.descr,
        c.brand,
        c.model,
        c.location1,
        c.category,
        c.pos_dateaudit,
        coalesce(i.qty, c.qty_icmas, 0) as qty,
        coalesce(sp.sell_qty, 0) as sell_qty_period,
        coalesce(sp.sell_revenue, 0) as sell_revenue_period,
        s.last_audited_at as app_audited_at,
        (s.last_audited_at at time zone 'Asia/Bangkok')::date as app_dateaudit,
        -- App-only effective date (POS is not trusted for status)
        (s.last_audited_at at time zone 'Asia/Bangkok')::date as effective_date
      from icmas c
      left join inv i on i.bcode = c.bcode
      left join sales_period sp on sp.bcode = c.bcode
      left join stock.audit_status s
        on s.branch = v_branch and s.bcode = c.bcode
    ),
    filtered as (
      select *
      from joined
      where not coalesce(p_with_stock_only, true) or qty > 0
    ),
    bucketed as (
      select
        f.*,
        case
          when f.effective_date is null then 'never'
          when f.effective_date >= (v_today - 30) then 'd30'
          when f.effective_date >= (v_today - 90) then 'd90'
          when f.effective_date >= (v_today - 180) then 'd180'
          when f.effective_date >= (v_today - 365) then 'd365'
          else 'over_365'
        end as bucket,
        case
          when f.effective_date is null then null
          else (v_today - f.effective_date)
        end as days_since
      from filtered f
    ),
    summary as (
      select
        count(*)::int as total,
        count(*) filter (where bucket = 'never')::int as never_count,
        count(*) filter (where bucket = 'd30')::int as d30_count,
        count(*) filter (where bucket = 'd90')::int as d90_count,
        count(*) filter (where bucket = 'd180')::int as d180_count,
        count(*) filter (where bucket = 'd365')::int as d365_count,
        count(*) filter (where bucket = 'over_365')::int as over_365_count,
        count(*) filter (where app_audited_at is not null)::int as app_marked_count,
        count(*) filter (
          where app_audited_at is not null
            and (app_audited_at at time zone 'Asia/Bangkok')::date = v_today
        )::int as marked_today_count,
        count(*) filter (
          where app_audited_at is not null
            and (app_audited_at at time zone 'Asia/Bangkok')::date >= (v_today - 6)
        )::int as marked_week_count
      from bucketed
    ),
    day_series as (
      select generate_series(v_today - 13, v_today, interval '1 day')::date as d
    ),
    daily_marks as (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'date', ds.d,
            'count', coalesce(e.n, 0)
          )
          order by ds.d
        ),
        '[]'::jsonb
      ) as series
      from day_series ds
      left join (
        select
          (audited_at at time zone 'Asia/Bangkok')::date as d,
          count(*)::int as n
        from stock.audit_event
        where branch = v_branch
          and (audited_at at time zone 'Asia/Bangkok')::date >= (v_today - 13)
        group by 1
      ) e on e.d = ds.d
    ),
    open_batches as (
      select
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', b.id,
              'created_at', b.created_at,
              'created_by', b.created_by,
              'target_count', b.target_count,
              'pending_count', (
                select count(*)::int
                from stock.audit_batch_item i
                where i.batch_id = b.id and i.status = 'pending'
              ),
              'done_count', (
                select count(*)::int
                from stock.audit_batch_item i
                where i.batch_id = b.id and i.status = 'done'
              )
            )
            order by b.created_at desc
          ),
          '[]'::jsonb
        ) as batches
      from stock.audit_batch b
      where b.branch = v_branch and b.status = 'open'
    ),
    list_rows as (
      select *
      from bucketed
      where v_bucket is null or bucket = v_bucket
      order by
        case bucket
          when 'never' then 0
          when 'over_365' then 1
          when 'd365' then 2
          when 'd180' then 3
          when 'd90' then 4
          else 5
        end,
        sell_qty_period desc,
        days_since desc nulls first,
        qty desc,
        bcode
      limit v_limit
      offset v_offset
    ),
    list_total as (
      select count(*)::int as n
      from bucketed
      where v_bucket is null or bucket = v_bucket
    )
    select jsonb_build_object(
      'branch', v_branch,
      'with_stock_only', coalesce(p_with_stock_only, true),
      'as_of', v_today,
      'sales_from', v_sales_from,
      'sales_to', v_today,
      'summary', to_jsonb(s),
      'daily_marks', dm.series,
      'open_batches', ob.batches,
      'rows', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'bcode', r.bcode,
              'descr', r.descr,
              'brand', r.brand,
              'model', r.model,
              'location1', r.location1,
              'category', r.category,
              'qty', r.qty,
              'sell_qty_period', r.sell_qty_period,
              'sell_revenue_period', r.sell_revenue_period,
              'pos_dateaudit', r.pos_dateaudit,
              'app_dateaudit', r.app_dateaudit,
              'effective_date', r.effective_date,
              'days_since', r.days_since,
              'bucket', r.bucket
            )
          )
          from list_rows r
        ),
        '[]'::jsonb
      ),
      'row_total', lt.n,
      'limit', v_limit,
      'offset', v_offset,
      'bucket', v_bucket
    )
    from summary s
    cross join open_batches ob
    cross join list_total lt
    cross join daily_marks dm
  );
end;
$$;

-- ---------------------------------------------------------------------------

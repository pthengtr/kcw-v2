-- Stock date-audit tracking for kcw-v2.
-- Domain tables live in schema `stock` (same pattern as bank / kb / ops),
-- not public. RPCs stay in public as service_role SECURITY DEFINER entrypoints.
--
-- App marks are the source of truth for "last audited".
-- POS ICMAS DATEAUDIT is stale/unreliable — shown as reference only, NOT used
-- for status buckets or pick priority.
--
-- Smart pick balances: never/stale app-audit + current-period sales velocity
-- (+ light on-hand qty), clustered by LOCATION1.

create schema if not exists stock;

revoke all on schema stock from public, anon, authenticated;
grant usage on schema stock to service_role;

-- Drop v1 public tables if they exist (empty / agent smoke data only).
drop table if exists public.stock_audit_batch_item cascade;
drop table if exists public.stock_audit_batch cascade;
drop table if exists public.stock_audit_event cascade;
drop table if exists public.stock_audit_status cascade;

create table if not exists stock.audit_status (
  branch text not null,
  bcode text not null,
  last_audited_at timestamptz not null,
  last_audited_by text not null,
  audit_count integer not null default 1,
  notes text,
  updated_at timestamptz not null default now(),
  constraint stock_audit_status_pkey primary key (branch, bcode),
  constraint stock_audit_status_branch_check check (branch in ('HQ', 'SYP')),
  constraint stock_audit_status_bcode_check check (bcode <> ''),
  constraint stock_audit_status_audit_count_check check (audit_count >= 1)
);

create table if not exists stock.audit_event (
  id bigserial primary key,
  branch text not null,
  bcode text not null,
  audited_at timestamptz not null default now(),
  audited_by text not null,
  source text not null,
  batch_id uuid,
  notes text,
  constraint stock_audit_event_branch_check check (branch in ('HQ', 'SYP')),
  constraint stock_audit_event_bcode_check check (bcode <> ''),
  constraint stock_audit_event_source_check
    check (source in ('batch', 'ondemand', 'manual'))
);

create table if not exists stock.audit_batch (
  id uuid primary key default gen_random_uuid(),
  branch text not null,
  created_at timestamptz not null default now(),
  created_by text not null,
  target_count integer not null,
  status text not null default 'open',
  filters jsonb not null default '{}'::jsonb,
  closed_at timestamptz,
  constraint stock_audit_batch_branch_check check (branch in ('HQ', 'SYP')),
  constraint stock_audit_batch_status_check check (status in ('open', 'closed')),
  constraint stock_audit_batch_target_count_check
    check (target_count >= 1 and target_count <= 500)
);

create table if not exists stock.audit_batch_item (
  batch_id uuid not null references stock.audit_batch (id) on delete cascade,
  bcode text not null,
  status text not null default 'pending',
  priority_score numeric not null default 0,
  pos_dateaudit date,
  app_dateaudit date,
  location1 text,
  descr text,
  qty numeric not null default 0,
  sell_qty_period numeric not null default 0,
  sell_revenue_period numeric not null default 0,
  done_at timestamptz,
  done_by text,
  constraint stock_audit_batch_item_pkey primary key (batch_id, bcode),
  constraint stock_audit_batch_item_status_check
    check (status in ('pending', 'done', 'skipped')),
  constraint stock_audit_batch_item_bcode_check check (bcode <> '')
);

create index if not exists stock_audit_status_last_audited_idx
  on stock.audit_status (branch, last_audited_at desc);

create index if not exists stock_audit_event_branch_bcode_idx
  on stock.audit_event (branch, bcode, audited_at desc);

create index if not exists stock_audit_batch_open_idx
  on stock.audit_batch (branch, created_at desc)
  where status = 'open';

create index if not exists stock_audit_batch_item_pending_idx
  on stock.audit_batch_item (batch_id, status)
  where status = 'pending';

alter table stock.audit_status enable row level security;
alter table stock.audit_event enable row level security;
alter table stock.audit_batch enable row level security;
alter table stock.audit_batch_item enable row level security;

revoke all on table stock.audit_status from public, anon, authenticated;
revoke all on table stock.audit_event from public, anon, authenticated;
revoke all on table stock.audit_batch from public, anon, authenticated;
revoke all on table stock.audit_batch_item from public, anon, authenticated;

grant select, insert, update, delete on table stock.audit_status to service_role;
grant select, insert, update, delete on table stock.audit_event to service_role;
grant select, insert, update, delete on table stock.audit_batch to service_role;
grant select, insert, update, delete on table stock.audit_batch_item to service_role;
grant usage, select on sequence stock.audit_event_id_seq to service_role;

comment on schema stock is
  'Stock / inventory ops owned by kcw-v2 (date-audit, future cycle-count helpers).';
comment on table stock.audit_status is
  'Latest app-recorded stock audit per branch+bcode. POS DATEAUDIT is not authoritative.';
comment on table stock.audit_event is
  'Append-only audit mark history.';
comment on table stock.audit_batch is
  'Daily / on-demand work set of bcodes for operators to audit.';
comment on table stock.audit_batch_item is
  'Items inside a stock audit batch (includes period sales snapshot used for ranking).';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public._stock_audit_parse_date(p_text text)
returns date
language sql
immutable
as $$
  select case
    when nullif(btrim(coalesce(p_text, '')), '') is null then null
    when btrim(p_text) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then btrim(p_text)::date
    else null
  end;
$$;

create or replace function public._stock_audit_parse_qty(p_text text)
returns numeric
language sql
immutable
as $$
  select coalesce(
    nullif(regexp_replace(coalesce(btrim(p_text), ''), '[^0-9.-]', '', 'g'), '')::numeric,
    0
  );
$$;

create or replace function public._stock_audit_is_canceled(p_canceled text)
returns boolean
language sql
immutable
as $$
  select coalesce(upper(btrim(coalesce(p_canceled, ''))), 'N') in ('Y', '1', 'T', 'TRUE');
$$;

-- Bangkok "today" and default sales window (last 30 days inclusive).
create or replace function public._stock_audit_bangkok_today()
returns date
language sql
stable
as $$
  select (timezone('Asia/Bangkok', now()))::date;
$$;

-- ---------------------------------------------------------------------------
-- Overview: buckets from APP audit only; POS date is reference on each row
-- ---------------------------------------------------------------------------

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
        )::int as marked_today_count
      from bucketed
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
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Get batch
-- ---------------------------------------------------------------------------

drop function if exists public.fn_stock_audit_get_batch(uuid);

create or replace function public.fn_stock_audit_get_batch(p_batch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, stock
as $$
declare
  v_batch stock.audit_batch%rowtype;
begin
  if p_batch_id is null then
    raise exception 'batch_id required';
  end if;

  select * into v_batch
  from stock.audit_batch
  where id = p_batch_id;

  if not found then
    raise exception 'Batch not found';
  end if;

  return jsonb_build_object(
    'id', v_batch.id,
    'branch', v_batch.branch,
    'created_at', v_batch.created_at,
    'created_by', v_batch.created_by,
    'target_count', v_batch.target_count,
    'status', v_batch.status,
    'filters', v_batch.filters,
    'closed_at', v_batch.closed_at,
    'pending_count', (
      select count(*)::int from stock.audit_batch_item i
      where i.batch_id = v_batch.id and i.status = 'pending'
    ),
    'done_count', (
      select count(*)::int from stock.audit_batch_item i
      where i.batch_id = v_batch.id and i.status = 'done'
    ),
    'skipped_count', (
      select count(*)::int from stock.audit_batch_item i
      where i.batch_id = v_batch.id and i.status = 'skipped'
    ),
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'bcode', i.bcode,
            'status', i.status,
            'priority_score', i.priority_score,
            'pos_dateaudit', i.pos_dateaudit,
            'app_dateaudit', i.app_dateaudit,
            'location1', i.location1,
            'descr', i.descr,
            'qty', i.qty,
            'sell_qty_period', i.sell_qty_period,
            'sell_revenue_period', i.sell_revenue_period,
            'done_at', i.done_at,
            'done_by', i.done_by
          )
          order by
            case i.status when 'pending' then 0 when 'done' then 1 else 2 end,
            i.priority_score desc,
            i.location1,
            i.bcode
        )
        from stock.audit_batch_item i
        where i.batch_id = v_batch.id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Create smart batch (sales velocity + app-audit staleness)
-- ---------------------------------------------------------------------------

drop function if exists public.fn_stock_audit_create_batch(text, integer, text, boolean, text, text);

create or replace function public.fn_stock_audit_create_batch(
  p_branch text,
  p_count integer,
  p_created_by text,
  p_with_stock_only boolean default true,
  p_category text default null,
  p_location text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, stock, raw_kcw, curated_kcw
set statement_timeout = '60s'
as $$
declare
  v_branch text;
  v_count int;
  v_category text;
  v_location text;
  v_batch_id uuid;
  v_inserted int;
  v_today date := public._stock_audit_bangkok_today();
  v_sales_from date;
begin
  v_branch := upper(coalesce(nullif(btrim(p_branch), ''), 'HQ'));
  if v_branch not in ('HQ', 'SYP') then
    raise exception 'Invalid branch';
  end if;

  v_count := greatest(1, least(coalesce(p_count, 30), 200));
  v_category := nullif(btrim(coalesce(p_category, '')), '');
  if v_category is not null then
    v_category := lpad(left(v_category, 2), 2, '0');
  end if;
  v_location := nullif(btrim(coalesce(p_location, '')), '');
  v_sales_from := v_today - 29;

  if nullif(btrim(coalesce(p_created_by, '')), '') is null then
    raise exception 'created_by required';
  end if;

  insert into stock.audit_batch (
    branch, created_by, target_count, filters
  ) values (
    v_branch,
    btrim(p_created_by),
    v_count,
    jsonb_build_object(
      'with_stock_only', coalesce(p_with_stock_only, true),
      'category', v_category,
      'location', v_location,
      'sales_from', v_sales_from,
      'sales_to', v_today,
      'rank_mode', 'sales_x_app_staleness'
    )
  )
  returning id into v_batch_id;

  with pending as (
    select i.bcode
    from stock.audit_batch_item i
    join stock.audit_batch b on b.id = i.batch_id
    where b.branch = v_branch
      and b.status = 'open'
      and i.status = 'pending'
  ),
  icmas as (
    select
      nullif(btrim(p."BCODE"), '') as bcode,
      coalesce(nullif(btrim(p."DESCR"), ''), '') as descr,
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
    select nullif(btrim(i.bcode), '') as bcode, coalesce(i.qty, 0)::numeric as qty
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
  candidates as (
    select
      c.bcode,
      c.descr,
      c.location1,
      c.pos_dateaudit,
      coalesce(i.qty, c.qty_icmas, 0) as qty,
      coalesce(sp.sell_qty, 0) as sell_qty,
      coalesce(sp.sell_revenue, 0) as sell_revenue,
      (s.last_audited_at at time zone 'Asia/Bangkok')::date as app_dateaudit
    from icmas c
    left join inv i on i.bcode = c.bcode
    left join sales_period sp on sp.bcode = c.bcode
    left join stock.audit_status s
      on s.branch = v_branch and s.bcode = c.bcode
    where not exists (select 1 from pending p where p.bcode = c.bcode)
      and (not coalesce(p_with_stock_only, true) or coalesce(i.qty, c.qty_icmas, 0) > 0)
      and (v_category is null or c.category = v_category)
      and (v_location is null or c.location1 ilike '%' || v_location || '%')
      -- Skip only if APP-audited within 7 days (ignore POS DATEAUDIT)
      and (
        s.last_audited_at is null
        or (s.last_audited_at at time zone 'Asia/Bangkok')::date < (v_today - 7)
      )
  ),
  scored as (
    select
      c.*,
      (
        -- Sales velocity (best sellers first): log-scaled qty + light revenue
        least(ln(1 + greatest(c.sell_qty, 0)) * 120, 900)
        + least(ln(1 + greatest(c.sell_revenue, 0) / 1000.0) * 40, 200)
        -- App-audit staleness: never audited in app dominates
        + case
            when c.app_dateaudit is null then 500
            else least((v_today - c.app_dateaudit)::numeric * 1.5, 400)
          end
        -- Prefer items that still have stock
        + least(ln(1 + greatest(c.qty, 0)) * 8, 60)
      )::numeric as priority_score
    from candidates c
  ),
  loc_rank as (
    select
      location1,
      max(priority_score) as loc_score
    from scored
    group by location1
  ),
  ordered as (
    select
      s.*,
      row_number() over (
        order by
          s.priority_score desc,
          coalesce(lr.loc_score, 0) desc,
          s.location1,
          s.bcode
      ) as rn
    from scored s
    left join loc_rank lr on lr.location1 = s.location1
  ),
  picked as (
    select * from ordered where rn <= v_count
  ),
  ins as (
    insert into stock.audit_batch_item (
      batch_id, bcode, status, priority_score, pos_dateaudit, app_dateaudit,
      location1, descr, qty, sell_qty_period, sell_revenue_period
    )
    select
      v_batch_id,
      p.bcode,
      'pending',
      p.priority_score,
      p.pos_dateaudit,
      p.app_dateaudit,
      p.location1,
      p.descr,
      p.qty,
      p.sell_qty,
      p.sell_revenue
    from picked p
    returning 1
  )
  select count(*)::int into v_inserted from ins;

  if v_inserted = 0 then
    update stock.audit_batch
    set status = 'closed', closed_at = now()
    where id = v_batch_id;
  end if;

  return public.fn_stock_audit_get_batch(v_batch_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Mark audited
-- ---------------------------------------------------------------------------

drop function if exists public.fn_stock_audit_mark(text, text, text, text, uuid, text);

create or replace function public.fn_stock_audit_mark(
  p_branch text,
  p_bcode text,
  p_audited_by text,
  p_source text default 'ondemand',
  p_batch_id uuid default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, stock, raw_kcw
as $$
declare
  v_branch text;
  v_bcode text;
  v_source text;
  v_now timestamptz := now();
  v_exists boolean;
begin
  v_branch := upper(coalesce(nullif(btrim(p_branch), ''), 'HQ'));
  if v_branch not in ('HQ', 'SYP') then
    raise exception 'Invalid branch';
  end if;

  v_bcode := nullif(btrim(coalesce(p_bcode, '')), '');
  if v_bcode is null then
    raise exception 'bcode required';
  end if;

  v_source := lower(coalesce(nullif(btrim(p_source), ''), 'ondemand'));
  if v_source not in ('batch', 'ondemand', 'manual') then
    raise exception 'Invalid source';
  end if;

  if nullif(btrim(coalesce(p_audited_by, '')), '') is null then
    raise exception 'audited_by required';
  end if;

  if v_branch = 'HQ' then
    select exists(
      select 1 from raw_kcw.raw_hq_icmas_products p
      where nullif(btrim(p."BCODE"), '') = v_bcode
    ) into v_exists;
  else
    select exists(
      select 1 from raw_kcw.raw_syp_icmas_products p
      where nullif(btrim(p."BCODE"), '') = v_bcode
    ) into v_exists;
  end if;

  if not v_exists then
    raise exception 'Unknown bcode';
  end if;

  insert into stock.audit_event (
    branch, bcode, audited_at, audited_by, source, batch_id, notes
  ) values (
    v_branch, v_bcode, v_now, btrim(p_audited_by), v_source, p_batch_id,
    nullif(btrim(coalesce(p_notes, '')), '')
  );

  insert into stock.audit_status as s (
    branch, bcode, last_audited_at, last_audited_by, audit_count, notes, updated_at
  ) values (
    v_branch, v_bcode, v_now, btrim(p_audited_by), 1,
    nullif(btrim(coalesce(p_notes, '')), ''), v_now
  )
  on conflict (branch, bcode) do update set
    last_audited_at = excluded.last_audited_at,
    last_audited_by = excluded.last_audited_by,
    audit_count = s.audit_count + 1,
    notes = coalesce(excluded.notes, s.notes),
    updated_at = excluded.updated_at;

  if p_batch_id is not null then
    update stock.audit_batch_item
    set status = 'done', done_at = v_now, done_by = btrim(p_audited_by)
    where batch_id = p_batch_id
      and bcode = v_bcode
      and status = 'pending';

    if not exists (
      select 1 from stock.audit_batch_item
      where batch_id = p_batch_id and status = 'pending'
    ) then
      update stock.audit_batch
      set status = 'closed', closed_at = v_now
      where id = p_batch_id and status = 'open';
    end if;
  else
    update stock.audit_batch_item i
    set status = 'done', done_at = v_now, done_by = btrim(p_audited_by)
    from stock.audit_batch b
    where i.batch_id = b.id
      and b.branch = v_branch
      and b.status = 'open'
      and i.bcode = v_bcode
      and i.status = 'pending';

    update stock.audit_batch b
    set status = 'closed', closed_at = v_now
    where b.branch = v_branch
      and b.status = 'open'
      and not exists (
        select 1 from stock.audit_batch_item i
        where i.batch_id = b.id and i.status = 'pending'
      );
  end if;

  return jsonb_build_object(
    'branch', v_branch,
    'bcode', v_bcode,
    'audited_at', v_now,
    'audited_by', btrim(p_audited_by),
    'source', v_source,
    'batch_id', p_batch_id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Skip item
-- ---------------------------------------------------------------------------

drop function if exists public.fn_stock_audit_skip_item(uuid, text, text);

create or replace function public.fn_stock_audit_skip_item(
  p_batch_id uuid,
  p_bcode text,
  p_by text
)
returns jsonb
language plpgsql
security definer
set search_path = public, stock
as $$
declare
  v_bcode text;
  v_now timestamptz := now();
begin
  if p_batch_id is null then
    raise exception 'batch_id required';
  end if;
  v_bcode := nullif(btrim(coalesce(p_bcode, '')), '');
  if v_bcode is null then
    raise exception 'bcode required';
  end if;

  update stock.audit_batch_item
  set status = 'skipped', done_at = v_now, done_by = nullif(btrim(coalesce(p_by, '')), '')
  where batch_id = p_batch_id and bcode = v_bcode and status = 'pending';

  if not found then
    raise exception 'Pending item not found';
  end if;

  if not exists (
    select 1 from stock.audit_batch_item
    where batch_id = p_batch_id and status = 'pending'
  ) then
    update stock.audit_batch
    set status = 'closed', closed_at = v_now
    where id = p_batch_id and status = 'open';
  end if;

  return public.fn_stock_audit_get_batch(p_batch_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Lookup
-- ---------------------------------------------------------------------------

drop function if exists public.fn_stock_audit_lookup(text, text);

create or replace function public.fn_stock_audit_lookup(
  p_branch text,
  p_bcode text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, stock, raw_kcw, curated_kcw
as $$
declare
  v_branch text;
  v_bcode text;
  v_row jsonb;
  v_today date := public._stock_audit_bangkok_today();
  v_sales_from date := v_today - 29;
begin
  v_branch := upper(coalesce(nullif(btrim(p_branch), ''), 'HQ'));
  if v_branch not in ('HQ', 'SYP') then
    raise exception 'Invalid branch';
  end if;
  v_bcode := nullif(btrim(coalesce(p_bcode, '')), '');
  if v_bcode is null then
    raise exception 'bcode required';
  end if;

  with icmas as (
    select
      nullif(btrim(p."BCODE"), '') as bcode,
      coalesce(nullif(btrim(p."DESCR"), ''), '') as descr,
      coalesce(nullif(btrim(p."BRAND"), ''), '') as brand,
      coalesce(nullif(btrim(p."MODEL"), ''), '') as model,
      coalesce(nullif(btrim(p."LOCATION1"), ''), '') as location1,
      public._stock_audit_parse_date(p."DATEAUDIT") as pos_dateaudit,
      public._stock_audit_parse_qty(p."QTYOH2") as qty_icmas
    from raw_kcw.raw_hq_icmas_products p
    where v_branch = 'HQ' and nullif(btrim(p."BCODE"), '') = v_bcode
    union all
    select
      nullif(btrim(p."BCODE"), '') as bcode,
      coalesce(nullif(btrim(p."DESCR"), ''), '') as descr,
      coalesce(nullif(btrim(p."BRAND"), ''), '') as brand,
      coalesce(nullif(btrim(p."MODEL"), ''), '') as model,
      coalesce(nullif(btrim(p."LOCATION1"), ''), '') as location1,
      public._stock_audit_parse_date(p."DATEAUDIT") as pos_dateaudit,
      public._stock_audit_parse_qty(p."QTYOH2") as qty_icmas
    from raw_kcw.raw_syp_icmas_products p
    where v_branch = 'SYP' and nullif(btrim(p."BCODE"), '') = v_bcode
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
    where nullif(btrim(l."BCODE"), '') = v_bcode
      and (
        v_branch = 'HQ' and b.reporting_branch in ('HQ', 'ONLINE')
        or v_branch = 'SYP' and b.reporting_branch = 'SYP'
      )
  ),
  joined as (
    select
      c.*,
      coalesce(i.qty, c.qty_icmas, 0) as qty,
      coalesce(sp.sell_qty, 0) as sell_qty_period,
      coalesce(sp.sell_revenue, 0) as sell_revenue_period,
      s.last_audited_at as app_audited_at,
      (s.last_audited_at at time zone 'Asia/Bangkok')::date as app_dateaudit,
      s.last_audited_by as app_audited_by,
      s.audit_count,
      (s.last_audited_at at time zone 'Asia/Bangkok')::date as effective_date
    from icmas c
    left join curated_kcw.inventory_qty_latest i
      on i.branch = v_branch and nullif(btrim(i.bcode), '') = c.bcode
    left join stock.audit_status s
      on s.branch = v_branch and s.bcode = c.bcode
    cross join sales_period sp
  )
  select to_jsonb(j) into v_row from joined j limit 1;

  if v_row is null then
    return jsonb_build_object('found', false, 'branch', v_branch, 'bcode', v_bcode);
  end if;

  return jsonb_build_object('found', true, 'branch', v_branch) || v_row;
end;
$$;

revoke all on function public.fn_stock_audit_overview(text, boolean, text, integer, integer) from public, anon, authenticated;
revoke all on function public.fn_stock_audit_create_batch(text, integer, text, boolean, text, text) from public, anon, authenticated;
revoke all on function public.fn_stock_audit_get_batch(uuid) from public, anon, authenticated;
revoke all on function public.fn_stock_audit_mark(text, text, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.fn_stock_audit_skip_item(uuid, text, text) from public, anon, authenticated;
revoke all on function public.fn_stock_audit_lookup(text, text) from public, anon, authenticated;
revoke all on function public._stock_audit_parse_date(text) from public, anon, authenticated;
revoke all on function public._stock_audit_parse_qty(text) from public, anon, authenticated;
revoke all on function public._stock_audit_is_canceled(text) from public, anon, authenticated;
revoke all on function public._stock_audit_bangkok_today() from public, anon, authenticated;

grant execute on function public.fn_stock_audit_overview(text, boolean, text, integer, integer) to service_role;
grant execute on function public.fn_stock_audit_create_batch(text, integer, text, boolean, text, text) to service_role;
grant execute on function public.fn_stock_audit_get_batch(uuid) to service_role;
grant execute on function public.fn_stock_audit_mark(text, text, text, text, uuid, text) to service_role;
grant execute on function public.fn_stock_audit_skip_item(uuid, text, text) to service_role;
grant execute on function public.fn_stock_audit_lookup(text, text) to service_role;

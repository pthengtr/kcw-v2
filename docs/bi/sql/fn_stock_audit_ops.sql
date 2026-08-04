-- Stock date-audit tracking for kcw-v2.
-- App-owned source of truth for "when was this BCODE last audited".
-- Qty adjustments stay in legacy POS; operators only mark audit complete here.
-- Effective last-audit date = GREATEST(app mark, POS DATEAUDIT) when either exists.
-- Tables are service-role only (same pattern as bank_match_agent_locks).

create table if not exists public.stock_audit_status (
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

create table if not exists public.stock_audit_event (
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

create table if not exists public.stock_audit_batch (
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

create table if not exists public.stock_audit_batch_item (
  batch_id uuid not null references public.stock_audit_batch (id) on delete cascade,
  bcode text not null,
  status text not null default 'pending',
  priority_score numeric not null default 0,
  pos_dateaudit date,
  location1 text,
  descr text,
  qty numeric not null default 0,
  done_at timestamptz,
  done_by text,
  constraint stock_audit_batch_item_pkey primary key (batch_id, bcode),
  constraint stock_audit_batch_item_status_check
    check (status in ('pending', 'done', 'skipped')),
  constraint stock_audit_batch_item_bcode_check check (bcode <> '')
);

create index if not exists stock_audit_status_last_audited_idx
  on public.stock_audit_status (branch, last_audited_at desc);

create index if not exists stock_audit_event_branch_bcode_idx
  on public.stock_audit_event (branch, bcode, audited_at desc);

create index if not exists stock_audit_batch_open_idx
  on public.stock_audit_batch (branch, created_at desc)
  where status = 'open';

create index if not exists stock_audit_batch_item_pending_idx
  on public.stock_audit_batch_item (batch_id, status)
  where status = 'pending';

alter table public.stock_audit_status enable row level security;
alter table public.stock_audit_event enable row level security;
alter table public.stock_audit_batch enable row level security;
alter table public.stock_audit_batch_item enable row level security;

revoke all on table public.stock_audit_status from public, anon, authenticated;
revoke all on table public.stock_audit_event from public, anon, authenticated;
revoke all on table public.stock_audit_batch from public, anon, authenticated;
revoke all on table public.stock_audit_batch_item from public, anon, authenticated;

grant select, insert, update, delete on table public.stock_audit_status to service_role;
grant select, insert, update, delete on table public.stock_audit_event to service_role;
grant select, insert, update, delete on table public.stock_audit_batch to service_role;
grant select, insert, update, delete on table public.stock_audit_batch_item to service_role;
grant usage, select on sequence public.stock_audit_event_id_seq to service_role;

comment on table public.stock_audit_status is
  'Latest app-recorded stock audit per branch+bcode (qty adjust stays in legacy POS).';
comment on table public.stock_audit_event is
  'Append-only audit mark history.';
comment on table public.stock_audit_batch is
  'Daily / on-demand work set of bcodes for operators to audit.';
comment on table public.stock_audit_batch_item is
  'Items inside a stock audit batch.';

-- ---------------------------------------------------------------------------
-- Helpers (internal)
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

-- ---------------------------------------------------------------------------
-- Overview: age buckets for dashboard
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
set search_path = public, raw_kcw, curated_kcw
set statement_timeout = '60s'
as $$
declare
  v_branch text;
  v_bucket text;
  v_limit int;
  v_offset int;
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
        s.last_audited_at as app_audited_at,
        (s.last_audited_at at time zone 'Asia/Bangkok')::date as app_dateaudit,
        case
          when s.last_audited_at is null and c.pos_dateaudit is null then null
          when s.last_audited_at is null then c.pos_dateaudit
          when c.pos_dateaudit is null then (s.last_audited_at at time zone 'Asia/Bangkok')::date
          else greatest(
            (s.last_audited_at at time zone 'Asia/Bangkok')::date,
            c.pos_dateaudit
          )
        end as effective_date
      from icmas c
      left join inv i on i.bcode = c.bcode
      left join public.stock_audit_status s
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
          when f.effective_date >= (current_date - 30) then 'd30'
          when f.effective_date >= (current_date - 90) then 'd90'
          when f.effective_date >= (current_date - 180) then 'd180'
          when f.effective_date >= (current_date - 365) then 'd365'
          else 'over_365'
        end as bucket,
        case
          when f.effective_date is null then null
          else (current_date - f.effective_date)
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
            and (app_audited_at at time zone 'Asia/Bangkok')::date = current_date
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
                from public.stock_audit_batch_item i
                where i.batch_id = b.id and i.status = 'pending'
              ),
              'done_count', (
                select count(*)::int
                from public.stock_audit_batch_item i
                where i.batch_id = b.id and i.status = 'done'
              )
            )
            order by b.created_at desc
          ),
          '[]'::jsonb
        ) as batches
      from public.stock_audit_batch b
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
      'as_of', current_date,
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
-- Get one batch with items (defined before create_batch which returns it)
-- ---------------------------------------------------------------------------

drop function if exists public.fn_stock_audit_get_batch(uuid);

create or replace function public.fn_stock_audit_get_batch(p_batch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_batch public.stock_audit_batch%rowtype;
begin
  if p_batch_id is null then
    raise exception 'batch_id required';
  end if;

  select * into v_batch
  from public.stock_audit_batch
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
      select count(*)::int from public.stock_audit_batch_item i
      where i.batch_id = v_batch.id and i.status = 'pending'
    ),
    'done_count', (
      select count(*)::int from public.stock_audit_batch_item i
      where i.batch_id = v_batch.id and i.status = 'done'
    ),
    'skipped_count', (
      select count(*)::int from public.stock_audit_batch_item i
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
            'location1', i.location1,
            'descr', i.descr,
            'qty', i.qty,
            'done_at', i.done_at,
            'done_by', i.done_by
          )
          order by
            case i.status when 'pending' then 0 when 'done' then 1 else 2 end,
            i.location1,
            i.priority_score desc,
            i.bcode
        )
        from public.stock_audit_batch_item i
        where i.batch_id = v_batch.id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Create a smart daily / on-demand batch
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
set search_path = public, raw_kcw, curated_kcw
set statement_timeout = '60s'
as $$
declare
  v_branch text;
  v_count int;
  v_category text;
  v_location text;
  v_batch_id uuid;
  v_inserted int;
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

  if nullif(btrim(coalesce(p_created_by, '')), '') is null then
    raise exception 'created_by required';
  end if;

  insert into public.stock_audit_batch (
    branch, created_by, target_count, filters
  ) values (
    v_branch,
    btrim(p_created_by),
    v_count,
    jsonb_build_object(
      'with_stock_only', coalesce(p_with_stock_only, true),
      'category', v_category,
      'location', v_location
    )
  )
  returning id into v_batch_id;

  with pending as (
    select i.bcode
    from public.stock_audit_batch_item i
    join public.stock_audit_batch b on b.id = i.batch_id
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
  candidates as (
    select
      c.bcode,
      c.descr,
      c.location1,
      c.pos_dateaudit,
      coalesce(i.qty, c.qty_icmas, 0) as qty,
      case
        when s.last_audited_at is null and c.pos_dateaudit is null then null
        when s.last_audited_at is null then c.pos_dateaudit
        when c.pos_dateaudit is null then (s.last_audited_at at time zone 'Asia/Bangkok')::date
        else greatest(
          (s.last_audited_at at time zone 'Asia/Bangkok')::date,
          c.pos_dateaudit
        )
      end as effective_date
    from icmas c
    left join inv i on i.bcode = c.bcode
    left join public.stock_audit_status s
      on s.branch = v_branch and s.bcode = c.bcode
    where not exists (select 1 from pending p where p.bcode = c.bcode)
      and (not coalesce(p_with_stock_only, true) or coalesce(i.qty, c.qty_icmas, 0) > 0)
      and (v_category is null or c.category = v_category)
      and (v_location is null or c.location1 ilike '%' || v_location || '%')
  ),
  scored as (
    select
      c.*,
      (
        case when c.effective_date is null then 100000
             else greatest(0, (current_date - c.effective_date))
        end
        + least(ln(1 + greatest(c.qty, 0)) * 8, 80)
      )::numeric as priority_score
    from candidates c
    -- Skip items audited within the last 7 days (effective = app OR POS)
    where c.effective_date is null
       or c.effective_date < (current_date - 7)
  ),
  -- Prefer clustering by location: take top locations by max priority, then fill.
  loc_rank as (
    select
      location1,
      max(priority_score) as loc_score,
      count(*) as loc_n
    from scored
    group by location1
  ),
  ordered as (
    select
      s.*,
      row_number() over (
        order by
          coalesce(lr.loc_score, 0) desc,
          s.location1,
          s.priority_score desc,
          s.bcode
      ) as rn
    from scored s
    left join loc_rank lr on lr.location1 = s.location1
  ),
  picked as (
    select * from ordered where rn <= v_count
  ),
  ins as (
    insert into public.stock_audit_batch_item (
      batch_id, bcode, status, priority_score, pos_dateaudit, location1, descr, qty
    )
    select
      v_batch_id,
      p.bcode,
      'pending',
      p.priority_score,
      p.pos_dateaudit,
      p.location1,
      p.descr,
      p.qty
    from picked p
    returning 1
  )
  select count(*)::int into v_inserted from ins;

  if v_inserted = 0 then
    update public.stock_audit_batch
    set status = 'closed', closed_at = now()
    where id = v_batch_id;
  end if;

  return public.fn_stock_audit_get_batch(v_batch_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Mark audited (batch item or on-demand single bcode)
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
set search_path = public, raw_kcw
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

  insert into public.stock_audit_event (
    branch, bcode, audited_at, audited_by, source, batch_id, notes
  ) values (
    v_branch, v_bcode, v_now, btrim(p_audited_by), v_source, p_batch_id,
    nullif(btrim(coalesce(p_notes, '')), '')
  );

  insert into public.stock_audit_status as s (
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
    update public.stock_audit_batch_item
    set status = 'done', done_at = v_now, done_by = btrim(p_audited_by)
    where batch_id = p_batch_id
      and bcode = v_bcode
      and status = 'pending';

    -- Auto-close batch when no pending left
    if not exists (
      select 1 from public.stock_audit_batch_item
      where batch_id = p_batch_id and status = 'pending'
    ) then
      update public.stock_audit_batch
      set status = 'closed', closed_at = v_now
      where id = p_batch_id and status = 'open';
    end if;
  end if;

  -- Also mark matching pending items in any open batch for this branch/bcode
  if p_batch_id is null then
    update public.stock_audit_batch_item i
    set status = 'done', done_at = v_now, done_by = btrim(p_audited_by)
    from public.stock_audit_batch b
    where i.batch_id = b.id
      and b.branch = v_branch
      and b.status = 'open'
      and i.bcode = v_bcode
      and i.status = 'pending';

    update public.stock_audit_batch b
    set status = 'closed', closed_at = v_now
    where b.branch = v_branch
      and b.status = 'open'
      and not exists (
        select 1 from public.stock_audit_batch_item i
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
-- Skip a batch item (not counted as audited)
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
set search_path = public
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

  update public.stock_audit_batch_item
  set status = 'skipped', done_at = v_now, done_by = nullif(btrim(coalesce(p_by, '')), '')
  where batch_id = p_batch_id and bcode = v_bcode and status = 'pending';

  if not found then
    raise exception 'Pending item not found';
  end if;

  if not exists (
    select 1 from public.stock_audit_batch_item
    where batch_id = p_batch_id and status = 'pending'
  ) then
    update public.stock_audit_batch
    set status = 'closed', closed_at = v_now
    where id = p_batch_id and status = 'open';
  end if;

  return public.fn_stock_audit_get_batch(p_batch_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Lookup a single product for on-demand mark UI
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
set search_path = public, raw_kcw, curated_kcw
as $$
declare
  v_branch text;
  v_bcode text;
  v_row jsonb;
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
  joined as (
    select
      c.*,
      coalesce(i.qty, c.qty_icmas, 0) as qty,
      s.last_audited_at as app_audited_at,
      (s.last_audited_at at time zone 'Asia/Bangkok')::date as app_dateaudit,
      s.last_audited_by as app_audited_by,
      s.audit_count,
      case
        when s.last_audited_at is null and c.pos_dateaudit is null then null
        when s.last_audited_at is null then c.pos_dateaudit
        when c.pos_dateaudit is null then (s.last_audited_at at time zone 'Asia/Bangkok')::date
        else greatest(
          (s.last_audited_at at time zone 'Asia/Bangkok')::date,
          c.pos_dateaudit
        )
      end as effective_date
    from icmas c
    left join curated_kcw.inventory_qty_latest i
      on i.branch = v_branch and nullif(btrim(i.bcode), '') = c.bcode
    left join public.stock_audit_status s
      on s.branch = v_branch and s.bcode = c.bcode
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

grant execute on function public.fn_stock_audit_overview(text, boolean, text, integer, integer) to service_role;
grant execute on function public.fn_stock_audit_create_batch(text, integer, text, boolean, text, text) to service_role;
grant execute on function public.fn_stock_audit_get_batch(uuid) to service_role;
grant execute on function public.fn_stock_audit_mark(text, text, text, text, uuid, text) to service_role;
grant execute on function public.fn_stock_audit_skip_item(uuid, text, text) to service_role;
grant execute on function public.fn_stock_audit_lookup(text, text) to service_role;

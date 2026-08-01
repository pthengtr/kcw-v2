-- Service-role RPCs for ICLOW sync (ops schema is not exposed to PostgREST).
-- Reuses public.fn_po_worker_heartbeat / public.fn_po_get_job for heartbeat + poll by id.
-- One web action enqueues BOTH sites with shared batch_id (same shape as LINE/kcw-api).
-- Payload: { "task": "sync_iclow", "site": "HQ"|"SYP", "batch_id": "<uuid>" }

create or replace function public.fn_iclow_find_inflight_sync()
returns table (
  id bigint,
  job_type text,
  payload jsonb,
  status text,
  worker_name text,
  requested_by text,
  source text,
  requested_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  result_message text,
  error_message text
)
language sql
security definer
set search_path = ops, public
as $$
  select
    j.id, j.job_type, j.payload, j.status, j.worker_name, j.requested_by, j.source,
    j.requested_at, j.started_at, j.finished_at, j.result_message, j.error_message
  from ops.job_queue j
  where j.job_type = 'sync_iclow'
    and j.status in ('pending', 'running')
    and j.requested_at > now() - interval '30 minutes'
  order by j.requested_at desc;
$$;

create or replace function public.fn_iclow_enqueue_sync(p_requested_by text)
returns table (
  id bigint,
  job_type text,
  payload jsonb,
  status text,
  worker_name text,
  requested_by text,
  source text,
  requested_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  result_message text,
  error_message text
)
language plpgsql
security definer
set search_path = ops, public
as $$
declare
  v_batch_id text := gen_random_uuid()::text;
begin
  return query
  insert into ops.job_queue (
    job_type, payload, status, worker_name, requested_by, source
  ) values
    (
      'sync_iclow',
      jsonb_build_object('task', 'sync_iclow', 'site', 'HQ', 'batch_id', v_batch_id),
      'pending',
      'HQ-PC',
      p_requested_by,
      'web'
    ),
    (
      'sync_iclow',
      jsonb_build_object('task', 'sync_iclow', 'site', 'SYP', 'batch_id', v_batch_id),
      'pending',
      'SYP-PC',
      p_requested_by,
      'web'
    )
  returning
    job_queue.id, job_queue.job_type, job_queue.payload, job_queue.status,
    job_queue.worker_name, job_queue.requested_by, job_queue.source,
    job_queue.requested_at, job_queue.started_at, job_queue.finished_at,
    job_queue.result_message, job_queue.error_message;
end;
$$;

create or replace function public.fn_iclow_last_ingested_at(p_site text default 'HQ')
returns timestamptz
language plpgsql
stable
security definer
set search_path = raw_kcw, public
as $$
declare
  v_site text := upper(btrim(coalesce(p_site, 'HQ')));
  v_ts timestamptz;
begin
  if v_site = 'SYP' then
    select max(i."_ingested_at") into v_ts
    from raw_kcw.raw_syp_iclow_stock_orders i;
  else
    select max(i."_ingested_at") into v_ts
    from raw_kcw.raw_hq_iclow_stock_orders i;
  end if;
  return v_ts;
end;
$$;

revoke all on function public.fn_iclow_find_inflight_sync() from public, anon, authenticated;
revoke all on function public.fn_iclow_enqueue_sync(text) from public, anon, authenticated;
revoke all on function public.fn_iclow_last_ingested_at(text) from public, anon, authenticated;

grant execute on function public.fn_iclow_find_inflight_sync() to service_role;
grant execute on function public.fn_iclow_enqueue_sync(text) to service_role;
grant execute on function public.fn_iclow_last_ingested_at(text) to service_role;

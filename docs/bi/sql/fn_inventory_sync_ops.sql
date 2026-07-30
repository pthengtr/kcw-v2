-- Service-role RPCs for inventory sync (ops schema is not exposed to PostgREST).
-- Reuses public.fn_po_worker_heartbeat / public.fn_po_get_job for heartbeat + poll by id.
-- Job: sync_inventory with payload { "site": "HQ"|"SYP" }, worker HQ-PC / SYP-PC (2 jobs).

create or replace function public.fn_inventory_find_inflight_sync(p_site text)
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
  where j.job_type = 'sync_inventory'
    and j.status in ('pending', 'running')
    and j.payload->>'site' = p_site
  order by j.requested_at desc
  limit 1;
$$;

create or replace function public.fn_inventory_enqueue_sync(
  p_site text,
  p_worker_name text,
  p_requested_by text
)
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
  v_payload jsonb := jsonb_build_object('site', p_site);
begin
  if p_site is null or btrim(p_site) = '' then
    raise exception 'missing site';
  end if;
  if p_worker_name is null or btrim(p_worker_name) = '' then
    raise exception 'missing worker_name';
  end if;

  return query
  insert into ops.job_queue (
    job_type, payload, status, worker_name, requested_by, source
  ) values (
    'sync_inventory', v_payload, 'pending', p_worker_name, p_requested_by, 'web'
  )
  returning
    job_queue.id, job_queue.job_type, job_queue.payload, job_queue.status,
    job_queue.worker_name, job_queue.requested_by, job_queue.source,
    job_queue.requested_at, job_queue.started_at, job_queue.finished_at,
    job_queue.result_message, job_queue.error_message;
end;
$$;

create or replace function public.fn_inventory_last_updated_at(p_branch text default 'HQ')
returns timestamptz
language sql
stable
security definer
set search_path = curated_kcw, public
as $$
  select max(inv.updated_at)
  from curated_kcw.inventory_qty_latest inv
  where inv.branch = p_branch;
$$;

revoke all on function public.fn_inventory_find_inflight_sync(text) from public, anon, authenticated;
revoke all on function public.fn_inventory_enqueue_sync(text, text, text) from public, anon, authenticated;
revoke all on function public.fn_inventory_last_updated_at(text) from public, anon, authenticated;

grant execute on function public.fn_inventory_find_inflight_sync(text) to service_role;
grant execute on function public.fn_inventory_enqueue_sync(text, text, text) to service_role;
grant execute on function public.fn_inventory_last_updated_at(text) to service_role;

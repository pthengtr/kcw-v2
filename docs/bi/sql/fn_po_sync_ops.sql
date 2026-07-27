-- Service-role RPCs for PO sync (ops schema is not exposed to PostgREST).

create or replace function public.fn_po_worker_heartbeat(p_worker_name text)
returns table (
  worker_name text,
  last_seen timestamptz,
  status text
)
language sql
security definer
set search_path = ops, public
as $$
  select wh.worker_name, wh.last_seen, wh.status
  from ops.worker_heartbeat wh
  where wh.worker_name = p_worker_name
  limit 1;
$$;

create or replace function public.fn_po_find_inflight_sync(p_site text)
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
  where j.job_type = 'sync_pomas_podet'
    and j.status in ('pending', 'running')
    and j.payload->>'site' = p_site
  order by j.requested_at desc
  limit 1;
$$;

create or replace function public.fn_po_enqueue_sync(
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
  v_payload jsonb := jsonb_build_object('task', 'sync_pomas_podet', 'site', p_site);
begin
  return query
  insert into ops.job_queue (
    job_type, payload, status, worker_name, requested_by, source
  ) values (
    'sync_pomas_podet', v_payload, 'pending', p_worker_name, p_requested_by, 'web'
  )
  returning
    job_queue.id, job_queue.job_type, job_queue.payload, job_queue.status,
    job_queue.worker_name, job_queue.requested_by, job_queue.source,
    job_queue.requested_at, job_queue.started_at, job_queue.finished_at,
    job_queue.result_message, job_queue.error_message;
end;
$$;

create or replace function public.fn_po_get_job(p_job_id bigint)
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
  where j.id = p_job_id
  limit 1;
$$;

revoke all on function public.fn_po_worker_heartbeat(text) from public, anon, authenticated;
revoke all on function public.fn_po_find_inflight_sync(text) from public, anon, authenticated;
revoke all on function public.fn_po_enqueue_sync(text, text, text) from public, anon, authenticated;
revoke all on function public.fn_po_get_job(bigint) from public, anon, authenticated;

grant execute on function public.fn_po_worker_heartbeat(text) to service_role;
grant execute on function public.fn_po_find_inflight_sync(text) to service_role;
grant execute on function public.fn_po_enqueue_sync(text, text, text) to service_role;
grant execute on function public.fn_po_get_job(bigint) to service_role;

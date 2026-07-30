-- Service-role RPCs for inventory sync (ops schema is not exposed to PostgREST).
-- Reuses public.fn_po_worker_heartbeat / public.fn_po_get_job for heartbeat + poll by id.
-- One web action enqueues BOTH sites with shared batch_id (same shape as LINE/kcw-api).
-- Payload: { "site": "HQ"|"SYP", "batch_id": "<uuid>" }

-- Drop site-scoped overloads from the first revision.
drop function if exists public.fn_inventory_find_inflight_sync(text);
drop function if exists public.fn_inventory_enqueue_sync(text, text, text);

-- Recent pending/running inventory jobs only (ignore stuck ancient rows).
create or replace function public.fn_inventory_find_inflight_sync()
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
    and j.requested_at > now() - interval '30 minutes'
  order by j.requested_at desc;
$$;

-- Enqueue HQ + SYP as one batch (2 rows, shared batch_id).
create or replace function public.fn_inventory_enqueue_sync(p_requested_by text)
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
      'sync_inventory',
      jsonb_build_object('site', 'HQ', 'batch_id', v_batch_id),
      'pending',
      'HQ-PC',
      p_requested_by,
      'web'
    ),
    (
      'sync_inventory',
      jsonb_build_object('site', 'SYP', 'batch_id', v_batch_id),
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

revoke all on function public.fn_inventory_find_inflight_sync() from public, anon, authenticated;
revoke all on function public.fn_inventory_enqueue_sync(text) from public, anon, authenticated;
revoke all on function public.fn_inventory_last_updated_at(text) from public, anon, authenticated;

grant execute on function public.fn_inventory_find_inflight_sync() to service_role;
grant execute on function public.fn_inventory_enqueue_sync(text) to service_role;
grant execute on function public.fn_inventory_last_updated_at(text) to service_role;

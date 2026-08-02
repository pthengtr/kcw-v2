-- Combined PO-related sync for /po: one web action enqueues HQ-PC + SYP-PC.
-- Job type: sync_po_related
-- Payload: { "task": "sync_po_related", "site": "HQ"|"SYP", "batch_id": "<uuid>" }
-- Worker BAT should refresh PO-related tables for that site (POMAS/PODET, ICLOW, etc.).

create or replace function public.fn_po_related_find_inflight_sync()
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
  where j.job_type = 'sync_po_related'
    and j.status in ('pending', 'running')
    and j.requested_at > now() - interval '30 minutes'
  order by j.requested_at desc;
$$;

create or replace function public.fn_po_related_enqueue_sync(p_requested_by text)
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
      'sync_po_related',
      jsonb_build_object('task', 'sync_po_related', 'site', 'HQ', 'batch_id', v_batch_id),
      'pending',
      'HQ-PC',
      p_requested_by,
      'web'
    ),
    (
      'sync_po_related',
      jsonb_build_object('task', 'sync_po_related', 'site', 'SYP', 'batch_id', v_batch_id),
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

revoke all on function public.fn_po_related_find_inflight_sync() from public, anon, authenticated;
revoke all on function public.fn_po_related_enqueue_sync(text) from public, anon, authenticated;

grant execute on function public.fn_po_related_find_inflight_sync() to service_role;
grant execute on function public.fn_po_related_enqueue_sync(text) to service_role;

-- Service-role RPCs for bank statement import (ops schema is not exposed to PostgREST).
-- Reuses public.fn_po_worker_heartbeat / public.fn_po_get_job for heartbeat + poll by id.

create or replace function public.fn_bank_find_inflight_import()
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
  where j.job_type = 'bank_statement_import'
    and j.status in ('pending', 'running')
  order by j.requested_at desc
  limit 1;
$$;

create or replace function public.fn_bank_enqueue_import(p_requested_by text)
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
  v_payload jsonb := jsonb_build_object('task', 'bank_statement_import');
begin
  return query
  insert into ops.job_queue (
    job_type, payload, status, worker_name, requested_by, source
  ) values (
    'bank_statement_import', v_payload, 'pending', null, p_requested_by, 'web'
  )
  returning
    job_queue.id, job_queue.job_type, job_queue.payload, job_queue.status,
    job_queue.worker_name, job_queue.requested_by, job_queue.source,
    job_queue.requested_at, job_queue.started_at, job_queue.finished_at,
    job_queue.result_message, job_queue.error_message;
end;
$$;

revoke all on function public.fn_bank_find_inflight_import() from public, anon, authenticated;
revoke all on function public.fn_bank_enqueue_import(text) from public, anon, authenticated;

grant execute on function public.fn_bank_find_inflight_import() to service_role;
grant execute on function public.fn_bank_enqueue_import(text) to service_role;

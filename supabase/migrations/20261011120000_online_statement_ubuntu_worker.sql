-- link_online_statements runs only on the Linux HQ box (apply + openpyxl).
-- fn_pick_hq_worker() falls back to HQ-PC when the Ubuntu heartbeat is stale,
-- and HQ-PC never claims these jobs, so uploads stay pending.

create or replace function public.fn_online_statement_enqueue(p_requested_by text)
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
begin
  return query
  insert into ops.job_queue (
    job_type, payload, status, worker_name, requested_by, source
  ) values (
    'link_online_statements',
    jsonb_build_object('task', 'link_online_statements', 'site', 'HQ'),
    'pending',
    'HQ-UBUNTU-SERVER',
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

revoke all on function public.fn_online_statement_enqueue(text) from public, anon, authenticated;
grant execute on function public.fn_online_statement_enqueue(text) to service_role;

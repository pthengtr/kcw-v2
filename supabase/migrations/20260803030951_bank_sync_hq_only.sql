-- Bank statement import: pin to HQ-PC only (was worker_name=null / either PC).

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
    'bank_statement_import', v_payload, 'pending', 'HQ-PC', p_requested_by, 'web'
  )
  returning
    job_queue.id, job_queue.job_type, job_queue.payload, job_queue.status,
    job_queue.worker_name, job_queue.requested_by, job_queue.source,
    job_queue.requested_at, job_queue.started_at, job_queue.finished_at,
    job_queue.result_message, job_queue.error_message;
end;
$$;

revoke all on function public.fn_bank_enqueue_import(text) from public, anon, authenticated;
grant execute on function public.fn_bank_enqueue_import(text) to service_role;

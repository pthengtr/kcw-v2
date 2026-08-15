-- Prefer HQ-UBUNTU-SERVER when its heartbeat is live; else HQ-PC.

create or replace function public.fn_pick_hq_worker()
returns text
language plpgsql
stable
security definer
set search_path = ops, public
as $$
declare
  v_name text;
begin
  foreach v_name in array array['HQ-UBUNTU-SERVER', 'HQ-PC']
  loop
    if exists (
      select 1
      from ops.worker_heartbeat wh
      where wh.worker_name = v_name
        and wh.last_seen >= now() - interval '30 seconds'
    ) then
      return v_name;
    end if;
  end loop;
  return 'HQ-PC';
end;
$$;

revoke all on function public.fn_pick_hq_worker() from public, anon, authenticated;
grant execute on function public.fn_pick_hq_worker() to service_role;

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
  v_hq text := public.fn_pick_hq_worker();
begin
  return query
  insert into ops.job_queue (
    job_type, payload, status, worker_name, requested_by, source
  ) values
    (
      'sync_inventory',
      jsonb_build_object('site', 'HQ', 'batch_id', v_batch_id),
      'pending',
      v_hq,
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
  v_hq text := public.fn_pick_hq_worker();
begin
  return query
  insert into ops.job_queue (
    job_type, payload, status, worker_name, requested_by, source
  ) values
    (
      'sync_iclow',
      jsonb_build_object('task', 'sync_iclow', 'site', 'HQ', 'batch_id', v_batch_id),
      'pending',
      v_hq,
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
  v_hq text := public.fn_pick_hq_worker();
begin
  return query
  insert into ops.job_queue (
    job_type, payload, status, worker_name, requested_by, source
  ) values
    (
      'sync_po_related',
      jsonb_build_object('task', 'sync_po_related', 'site', 'HQ', 'batch_id', v_batch_id),
      'pending',
      v_hq,
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
  v_hq text := public.fn_pick_hq_worker();
begin
  return query
  insert into ops.job_queue (
    job_type, payload, status, worker_name, requested_by, source
  ) values (
    'bank_statement_import', v_payload, 'pending', v_hq, p_requested_by, 'web'
  )
  returning
    job_queue.id, job_queue.job_type, job_queue.payload, job_queue.status,
    job_queue.worker_name, job_queue.requested_by, job_queue.source,
    job_queue.requested_at, job_queue.started_at, job_queue.finished_at,
    job_queue.result_message, job_queue.error_message;
end;
$$;

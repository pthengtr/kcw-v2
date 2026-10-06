-- Marketplace settlement payouts linked to PARTS9 TAD bills.
-- Filled by kcw-analytic `link-online-statements` on the HQ worker.

create table if not exists curated_kcw.online_payouts (
  payout_key text primary key,
  platform text not null,
  shop text not null,
  payout_at timestamptz,
  amount numeric not null,
  currency text not null default 'THB',
  reference text,
  status text not null,
  source_file text,
  note text,
  order_count int not null default 0,
  expense_amount numeric not null default 0,
  component_net numeric not null default 0,
  matched_order_count int not null default 0,
  built_at timestamptz not null default now()
);

create index if not exists online_payouts_platform_at_idx
  on curated_kcw.online_payouts (platform, payout_at desc);

create table if not exists curated_kcw.online_payout_lines (
  payout_key text not null references curated_kcw.online_payouts (payout_key) on delete cascade,
  line_no int not null,
  line_kind text not null,
  order_id text,
  fee_name text,
  detail text,
  gross_amount numeric,
  expense_amount numeric,
  net_amount numeric not null,
  fees jsonb not null default '[]'::jsonb,
  txn_at timestamptz,
  primary key (payout_key, line_no)
);

create index if not exists online_payout_lines_order_idx
  on curated_kcw.online_payout_lines (order_id);

create table if not exists curated_kcw.online_order_bills (
  payout_key text not null references curated_kcw.online_payouts (payout_key) on delete cascade,
  platform text not null,
  order_id text not null,
  billno text not null,
  po text,
  match_method text,
  bill_date date,
  aftertax numeric,
  acctname text,
  canceled boolean not null default false,
  primary key (payout_key, order_id, billno)
);

create index if not exists online_order_bills_billno_idx
  on curated_kcw.online_order_bills (billno);

alter table curated_kcw.online_payouts enable row level security;
alter table curated_kcw.online_payout_lines enable row level security;
alter table curated_kcw.online_order_bills enable row level security;

grant select, insert, update, delete on curated_kcw.online_payouts to service_role;
grant select, insert, update, delete on curated_kcw.online_payout_lines to service_role;
grant select, insert, update, delete on curated_kcw.online_order_bills to service_role;

insert into public.kcw_role_page_permissions (role_key, page_key)
select role_key, 'online_statements'
from public.kcw_role_page_permissions
where page_key = 'bank_statement_sync'
on conflict do nothing;

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
declare
  v_hq text := public.fn_pick_hq_worker();
begin
  return query
  insert into ops.job_queue (
    job_type, payload, status, worker_name, requested_by, source
  ) values (
    'link_online_statements',
    jsonb_build_object('task', 'link_online_statements', 'site', 'HQ'),
    'pending',
    v_hq,
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

create or replace function public.fn_online_statement_latest_job()
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
stable
security definer
set search_path = ops, public
as $$
  select
    j.id, j.job_type, j.payload, j.status, j.worker_name, j.requested_by, j.source,
    j.requested_at, j.started_at, j.finished_at, j.result_message, j.error_message
  from ops.job_queue j
  where j.job_type = 'link_online_statements'
  order by j.id desc
  limit 1;
$$;

revoke all on function public.fn_online_statement_enqueue(text) from public, anon, authenticated;
revoke all on function public.fn_online_statement_latest_job() from public, anon, authenticated;
grant execute on function public.fn_online_statement_enqueue(text) to service_role;
grant execute on function public.fn_online_statement_latest_job() to service_role;

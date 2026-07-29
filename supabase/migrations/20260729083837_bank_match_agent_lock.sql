-- One durable, global lock for bank statement matching agents.
-- Only the service-role-backed API can read or mutate this table.

create table public.bank_match_agent_locks (
  lock_key text primary key,
  lock_token uuid not null unique,
  state text not null,
  account_no text not null,
  date_from date not null,
  date_to date not null,
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  agent_id text,
  run_id text,
  agent_url text,
  run_status text,
  constraint bank_match_agent_locks_singleton_check
    check (lock_key = 'global'),
  constraint bank_match_agent_locks_state_check
    check (state in ('launching', 'running')),
  constraint bank_match_agent_locks_date_range_check
    check (date_from <= date_to),
  constraint bank_match_agent_locks_running_details_check
    check (
      state = 'launching'
      or (
        agent_id is not null
        and run_id is not null
        and agent_url is not null
        and run_status is not null
      )
    )
);

alter table public.bank_match_agent_locks enable row level security;

revoke all on table public.bank_match_agent_locks
  from public, anon, authenticated;
grant select, insert, update, delete on table public.bank_match_agent_locks
  to service_role;

comment on table public.bank_match_agent_locks is
  'Singleton server-side lock preventing concurrent bank statement match agents.';

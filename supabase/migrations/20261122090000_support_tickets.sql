-- Support request tickets (requester-private + admin).
-- Tables live in public so PostgREST (user JWT) can reach them with RLS.

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('bug', 'improvement')),
  target_source text not null check (target_source in ('kcw-api', 'kcw-v2')),
  target_id text not null,
  target_label text not null,
  target_meta jsonb not null default '{}'::jsonb,
  title text not null,
  body text not null default '',
  attachment_paths text[] not null default '{}'::text[],
  status text not null default 'pending'
    check (status in ('pending', 'running', 'waiting', 'done', 'failed')),
  agent_session_id text,
  pr_url text,
  merge_sha text,
  error_message text,
  reopen_count int not null default 0,
  claimed_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_created_by_created_at_idx
  on public.support_tickets (created_by, created_at desc);

create index if not exists support_tickets_status_created_at_idx
  on public.support_tickets (status, created_at);

create table if not exists public.support_ticket_events (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  event_type text not null,
  actor_id uuid references auth.users (id) on delete set null,
  comment text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists support_ticket_events_ticket_id_created_at_idx
  on public.support_ticket_events (ticket_id, created_at);

create or replace function public.support_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_support_tickets_updated_at on public.support_tickets;
create trigger trg_support_tickets_updated_at
  before update on public.support_tickets
  for each row
  execute function public.support_set_updated_at();

create or replace function public.support_is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.kcw_user_roles ur
    where ur.user_id = uid
      and ur.role_key = 'admin'
  );
$$;

create or replace function public.support_claim_next_ticket(
  p_worker text default 'hq-ubuntu-server'
)
returns public.support_tickets
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.support_tickets;
begin
  with next_ticket as (
    select id
    from public.support_tickets
    where status = 'pending'
    order by created_at
    for update skip locked
    limit 1
  )
  update public.support_tickets t
  set
    status = 'running',
    claimed_at = now(),
    error_message = null,
    finished_at = null
  from next_ticket n
  where t.id = n.id
  returning t.* into claimed;

  if claimed.id is not null then
    insert into public.support_ticket_events (ticket_id, event_type, comment, meta)
    values (
      claimed.id,
      'claimed',
      null,
      jsonb_build_object(
        'worker',
        coalesce(nullif(trim(p_worker), ''), 'hq-ubuntu-server')
      )
    );
  end if;

  return claimed;
end;
$$;

revoke all on function public.support_claim_next_ticket(text) from public;
grant execute on function public.support_claim_next_ticket(text) to service_role;

alter table public.support_tickets enable row level security;
alter table public.support_ticket_events enable row level security;

drop policy if exists support_tickets_select_own_or_admin on public.support_tickets;
create policy support_tickets_select_own_or_admin
  on public.support_tickets
  for select
  to authenticated
  using (created_by = auth.uid() or public.support_is_admin(auth.uid()));

drop policy if exists support_tickets_insert_own on public.support_tickets;
create policy support_tickets_insert_own
  on public.support_tickets
  for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists support_tickets_update_own_or_admin on public.support_tickets;
create policy support_tickets_update_own_or_admin
  on public.support_tickets
  for update
  to authenticated
  using (created_by = auth.uid() or public.support_is_admin(auth.uid()))
  with check (created_by = auth.uid() or public.support_is_admin(auth.uid()));

drop policy if exists support_ticket_events_select_own_or_admin on public.support_ticket_events;
create policy support_ticket_events_select_own_or_admin
  on public.support_ticket_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.support_tickets t
      where t.id = ticket_id
        and (t.created_by = auth.uid() or public.support_is_admin(auth.uid()))
    )
  );

drop policy if exists support_ticket_events_insert_own_or_admin on public.support_ticket_events;
create policy support_ticket_events_insert_own_or_admin
  on public.support_ticket_events
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.support_tickets t
      where t.id = ticket_id
        and (t.created_by = auth.uid() or public.support_is_admin(auth.uid()))
    )
  );

grant select, insert, update on public.support_tickets to authenticated, service_role;
grant select, insert on public.support_ticket_events to authenticated, service_role;
grant usage, select on sequence public.support_ticket_events_id_seq to authenticated, service_role;

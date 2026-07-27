-- RBAC initial setup: roles, membership, page permissions.
-- Replaces binary kcw_admin checks for page access.
-- Admin users bypass page permission checks in app code.

create table if not exists public.kcw_roles (
  role_key text primary key,
  title text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.kcw_user_roles (
  user_id uuid not null,
  role_key text not null references public.kcw_roles(role_key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, role_key)
);

create table if not exists public.kcw_role_page_permissions (
  role_key text not null references public.kcw_roles(role_key) on delete cascade,
  page_key text not null,
  created_at timestamptz not null default now(),
  primary key (role_key, page_key)
);

alter table public.kcw_roles enable row level security;
alter table public.kcw_user_roles enable row level security;
alter table public.kcw_role_page_permissions enable row level security;

-- Read own membership / role catalog. Writes go through service-role admin APIs.
drop policy if exists "roles_select_authenticated" on public.kcw_roles;
create policy "roles_select_authenticated"
  on public.kcw_roles
  for select
  to authenticated
  using (true);

drop policy if exists "user_roles_select_own" on public.kcw_user_roles;
create policy "user_roles_select_own"
  on public.kcw_user_roles
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "role_page_permissions_select_by_roles" on public.kcw_role_page_permissions;
create policy "role_page_permissions_select_by_roles"
  on public.kcw_role_page_permissions
  for select
  to authenticated
  using (
    role_key in (
      select ur.role_key
      from public.kcw_user_roles ur
      where ur.user_id = auth.uid()
    )
  );

insert into public.kcw_roles (role_key, title, description)
values
  ('admin', 'Admin', 'Full access'),
  ('normal', 'Normal', 'Default role; no protected pages unless granted')
on conflict (role_key) do nothing;

insert into public.kcw_user_roles (user_id, role_key)
select au.id, 'admin'
from auth.users au
where au.email in ('pthengtr@gmail.com', 'narumon.wit@gmail.com')
on conflict (user_id, role_key) do nothing;

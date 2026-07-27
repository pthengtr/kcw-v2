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

-- Harden BI RPCs: only service_role may execute (app routes use admin client after permission check).
revoke execute on function public.fn_bi_sales_overview(date, date, text) from authenticated, anon, public;
revoke execute on function public.fn_bi_customer_overview(date, date, text, integer) from authenticated, anon, public;
revoke execute on function public.fn_bi_product_overview(date, date, text, integer) from authenticated, anon, public;
revoke execute on function public.fn_bi_product_movement(date, date, text, integer, integer, integer, text, text, text, text) from authenticated, anon, public;
revoke execute on function public.fn_bi_expense_overview(date, date, uuid, text, integer, text) from authenticated, anon, public;
revoke execute on function public.fn_bi_income_overview(date, date, text, text) from authenticated, anon, public;
revoke execute on function public.fn_bi_income_blank_costs(date, date, text, integer) from authenticated, anon, public;

grant execute on function public.fn_bi_sales_overview(date, date, text) to service_role;
grant execute on function public.fn_bi_customer_overview(date, date, text, integer) to service_role;
grant execute on function public.fn_bi_product_overview(date, date, text, integer) to service_role;
grant execute on function public.fn_bi_product_movement(date, date, text, integer, integer, integer, text, text, text, text) to service_role;
grant execute on function public.fn_bi_expense_overview(date, date, uuid, text, integer, text) to service_role;
grant execute on function public.fn_bi_income_overview(date, date, text, text) to service_role;
grant execute on function public.fn_bi_income_blank_costs(date, date, text, integer) to service_role;

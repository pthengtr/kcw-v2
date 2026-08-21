-- RBAC initial setup: roles, membership, page permissions.
-- Replaces binary kcw_admin checks for page access.
-- Admin users bypass page permission checks in app code.
--
-- User directory approach (app expects ≤ ~30 Auth users):
-- - Membership is stored as user_id in kcw_user_roles (Auth remains source of truth).
-- - Role detail loads resolve emails with auth.admin.getUserById for those ids only.
-- - Saves map emails → ids with one small auth.admin.listUsers page (≤50).
-- - Do not add a separate mirrored users table unless Auth user count grows a lot.

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

-- Default: every existing auth user without a role becomes normal.
insert into public.kcw_user_roles (user_id, role_key)
select au.id, 'normal'
from auth.users au
where not exists (
  select 1 from public.kcw_user_roles ur where ur.user_id = au.id
)
on conflict (user_id, role_key) do nothing;

-- Auto-assign normal on new signup (layer-1 membership).
create or replace function public.fn_kcw_assign_default_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.kcw_user_roles (user_id, role_key)
  values (new.id, 'normal')
  on conflict (user_id, role_key) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_kcw_assign_default_role on auth.users;
create trigger trg_kcw_assign_default_role
after insert on auth.users
for each row
execute function public.fn_kcw_assign_default_role();

revoke all on function public.fn_kcw_assign_default_role() from public;
grant execute on function public.fn_kcw_assign_default_role() to service_role;

-- Harden BI RPCs: only service_role may execute (app routes use admin client after permission check).
revoke execute on function public.fn_bi_sales_overview(date, date, text) from authenticated, anon, public;
revoke execute on function public.fn_bi_customer_overview(date, date, text, integer) from authenticated, anon, public;
revoke execute on function public.fn_bi_product_overview(date, date, text, integer, text, text[]) from authenticated, anon, public;
revoke execute on function public.fn_bi_product_movement(date, date, text, integer, integer, integer, text, text, text, text) from authenticated, anon, public;
revoke execute on function public.fn_bi_product_search(text, integer) from authenticated, anon, public;
revoke execute on function public.fn_bi_product_sales_lines(text, date, date, text) from authenticated, anon, public;
revoke execute on function public.fn_bi_product_sales(text, date, date, text, integer) from authenticated, anon, public;
revoke execute on function public.fn_bi_expense_overview(date, date, uuid, text, integer, text) from authenticated, anon, public;
revoke execute on function public.fn_bi_income_overview(date, date, text, text) from authenticated, anon, public;
revoke execute on function public.fn_bi_income_blank_costs(date, date, text, integer) from authenticated, anon, public;
revoke execute on function public.fn_bi_vat_overview(date, date, text, date, text) from authenticated, anon, public;

grant execute on function public.fn_bi_sales_overview(date, date, text) to service_role;
grant execute on function public.fn_bi_customer_overview(date, date, text, integer) to service_role;
grant execute on function public.fn_bi_product_overview(date, date, text, integer, text, text[]) to service_role;
grant execute on function public.fn_bi_product_movement(date, date, text, integer, integer, integer, text, text, text, text) to service_role;
grant execute on function public.fn_bi_product_search(text, integer) to service_role;
grant execute on function public.fn_bi_product_sales_lines(text, date, date, text) to service_role;
grant execute on function public.fn_bi_product_sales(text, date, date, text, integer) to service_role;
grant execute on function public.fn_bi_expense_overview(date, date, uuid, text, integer, text) to service_role;
grant execute on function public.fn_bi_income_overview(date, date, text, text) to service_role;
grant execute on function public.fn_bi_income_blank_costs(date, date, text, integer) to service_role;
grant execute on function public.fn_bi_vat_overview(date, date, text, date, text) to service_role;

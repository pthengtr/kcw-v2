-- Cashbox withdrawal requests (LINE เบิกเงิน → admin approve → Tiger QR).
-- Separate from expense_receipt / expense_general bookkeeping.

create table if not exists public.expense_cash_request (
  id uuid primary key default gen_random_uuid(),
  short_code bigint generated always as identity,
  requester_line_user_id text not null,
  requester_name text,
  reason text not null default '',
  extra_reason text,
  amount numeric(18, 2) not null
    check (amount > 0),
  status text not null default 'pending'
    check (status in (
      'pending',
      'needs_info',
      'approved',
      'rejected',
      'cancelled',
      'paid'
    )),
  admin_note text,
  reviewed_by text,
  reviewed_by_name text,
  reviewed_at timestamptz,
  voucher_attempt_id text,
  qr_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists expense_cash_request_short_code_uidx
  on public.expense_cash_request (short_code);

create index if not exists expense_cash_request_status_created_at_idx
  on public.expense_cash_request (status, created_at desc);

create index if not exists expense_cash_request_requester_created_at_idx
  on public.expense_cash_request (requester_line_user_id, created_at desc);

create index if not exists expense_cash_request_voucher_attempt_id_idx
  on public.expense_cash_request (voucher_attempt_id)
  where voucher_attempt_id is not null;

create or replace function public.expense_cash_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_expense_cash_request_updated_at
  on public.expense_cash_request;
create trigger trg_expense_cash_request_updated_at
  before update on public.expense_cash_request
  for each row
  execute function public.expense_cash_set_updated_at();

alter table public.expense_cash_request enable row level security;

-- Reuse support_is_admin(uid) when present; otherwise inline admin check.
drop policy if exists expense_cash_request_admin_select
  on public.expense_cash_request;
create policy expense_cash_request_admin_select
  on public.expense_cash_request
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.kcw_user_roles ur
      where ur.user_id = auth.uid()
        and ur.role_key = 'admin'
    )
  );

drop policy if exists expense_cash_request_admin_update
  on public.expense_cash_request;
create policy expense_cash_request_admin_update
  on public.expense_cash_request
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.kcw_user_roles ur
      where ur.user_id = auth.uid()
        and ur.role_key = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.kcw_user_roles ur
      where ur.user_id = auth.uid()
        and ur.role_key = 'admin'
    )
  );

-- Inserts come from LINE bot (service_role). No authenticated insert.
grant select, update on public.expense_cash_request to authenticated;
grant select, insert, update on public.expense_cash_request to service_role;
grant usage, select on sequence public.expense_cash_request_short_code_seq
  to authenticated, service_role;

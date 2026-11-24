-- Accounting / bookkeeping flags for cashbox withdrawal requests.
-- Branch + paid_at support list filters; accounting_* tracks "ลงค่าใช้จ่าย".

alter table public.expense_cash_request
  add column if not exists branch text default 'HQ'
    check (branch is null or branch in ('HQ', 'SYP')),
  add column if not exists paid_at timestamptz,
  add column if not exists accounting_status text not null default 'pending'
    check (accounting_status in ('pending', 'recorded')),
  add column if not exists accounting_by text,
  add column if not exists accounting_by_name text,
  add column if not exists accounting_at timestamptz;

-- Existing paid rows: treat updated_at as withdrawal time when paid_at is missing.
update public.expense_cash_request
set paid_at = updated_at
where status = 'paid'
  and paid_at is null;

-- Default branch to HQ when still unset (current Tiger cashbox is HQ shop_code=1).
update public.expense_cash_request
set branch = 'HQ'
where branch is null;

create index if not exists expense_cash_request_paid_at_idx
  on public.expense_cash_request (paid_at desc nulls last);

create index if not exists expense_cash_request_accounting_status_idx
  on public.expense_cash_request (accounting_status, status);

create index if not exists expense_cash_request_branch_idx
  on public.expense_cash_request (branch);

-- When kcw-api flips status to paid, stamp paid_at if missing.
create or replace function public.expense_cash_set_paid_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'paid'
     and (old.status is distinct from 'paid')
     and new.paid_at is null then
    new.paid_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_expense_cash_request_paid_at
  on public.expense_cash_request;
create trigger trg_expense_cash_request_paid_at
  before update on public.expense_cash_request
  for each row
  execute function public.expense_cash_set_paid_at();

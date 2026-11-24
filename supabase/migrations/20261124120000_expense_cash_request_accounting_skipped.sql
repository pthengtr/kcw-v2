-- Allow marking paid cash requests as "ไม่ลงค่าใช้จ่าย" (skipped) with a reason.
-- Does not change Tiger withdrawal amounts or voucher history.

alter table public.expense_cash_request
  drop constraint if exists expense_cash_request_accounting_status_check;

alter table public.expense_cash_request
  add constraint expense_cash_request_accounting_status_check
  check (accounting_status in ('pending', 'recorded', 'skipped'));

alter table public.expense_cash_request
  add column if not exists accounting_skip_reason text
    check (
      accounting_skip_reason is null
      or accounting_skip_reason in ('system_test', 'refunded', 'other')
    ),
  add column if not exists accounting_skip_note text;

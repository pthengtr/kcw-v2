-- Persist CNTAD credit-note reason so VAT/reprint can recover after backfill.
alter table online_sale.bill_sheets
  add column if not exists reason text;

comment on column online_sale.bill_sheets.reason is
  'CNTAD credit-note reason snapshotted at post; reused on reprint when ?reason= is omitted.';

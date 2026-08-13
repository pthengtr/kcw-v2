-- Operator remark for the monthly bank statement Excel หมายเหตุ column.
-- Distinct from match_reason / match_notes (matching audit); preserved on requeue.

alter table bank.statement_lines
  add column if not exists report_remark text;

comment on column bank.statement_lines.report_remark is
  'Operator remark for the monthly Excel หมายเหตุ column';

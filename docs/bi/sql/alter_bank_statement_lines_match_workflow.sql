-- Operator/agent match workflow statuses for bank.statement_lines.
-- Agent may only write rows in match_status = 'pending'.
-- Operators finish review → resolved, unmatched leftovers → manual.

alter table bank.statement_lines
  drop constraint if exists statement_lines_match_status_check;

-- Backfill: untouched leftovers become pending (agent queue).
-- Rows that already have agent/operator audit stay unmatched.
update bank.statement_lines
set match_status = 'pending'
where match_status = 'unmatched'
  and matched_by is null
  and match_reason is null
  and match_notes is null
  and matched_ref_type is null
  and matched_ref_id is null
  and matched_at is null;

alter table bank.statement_lines
  alter column match_status set default 'pending';

alter table bank.statement_lines
  add constraint statement_lines_match_status_check
  check (
    match_status in (
      'pending',
      'matched',
      'review',
      'resolved',
      'unmatched',
      'manual',
      'ignored'
    )
  );

create index if not exists statement_lines_pending_queue_idx
  on bank.statement_lines (account_no, txn_date desc)
  where match_status = 'pending';

create index if not exists statement_lines_unmatched_queue_idx
  on bank.statement_lines (account_no, txn_date desc)
  where match_status = 'unmatched';

create index if not exists statement_lines_resolved_manual_idx
  on bank.statement_lines (account_no, match_status, txn_date desc)
  where match_status in ('resolved', 'manual');

comment on column bank.statement_lines.match_status is
  'pending=awaiting agent; matched/review/unmatched=agent; ignored=operator exclude-from-report; resolved/manual=operator';

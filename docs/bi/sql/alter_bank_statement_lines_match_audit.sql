-- Match-audit fields for bank.statement_lines.
-- Operators use match_status = 'review' as the manual audit queue.
-- Matching agents should write reason/confidence/notes when updating a row.

alter table bank.statement_lines
  add column if not exists match_reason text,
  add column if not exists match_confidence numeric(4,3),
  add column if not exists matched_ref_type text,
  add column if not exists matched_ref_id text,
  add column if not exists match_notes text,
  add column if not exists matched_at timestamptz,
  add column if not exists matched_by text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'statement_lines_match_confidence_check'
      and conrelid = 'bank.statement_lines'::regclass
  ) then
    alter table bank.statement_lines
      add constraint statement_lines_match_confidence_check
      check (
        match_confidence is null
        or (match_confidence >= 0 and match_confidence <= 1)
      );
  end if;
end $$;

create index if not exists statement_lines_review_queue_idx
  on bank.statement_lines (match_status, txn_date desc)
  where match_status = 'review';

comment on column bank.statement_lines.match_reason is
  'Short machine/human reason for the current match decision';
comment on column bank.statement_lines.match_confidence is
  'Matcher confidence from 0 to 1; low values should prefer review';
comment on column bank.statement_lines.matched_ref_type is
  'Matched entity type such as invoice, tiger_pay, or manual';
comment on column bank.statement_lines.matched_ref_id is
  'Matched entity identifier';
comment on column bank.statement_lines.match_notes is
  'Operator-facing free text explaining ambiguity or decision context';
comment on column bank.statement_lines.matched_at is
  'When the current match decision was last written';
comment on column bank.statement_lines.matched_by is
  'Who wrote the decision, e.g. agent:name or operator email';

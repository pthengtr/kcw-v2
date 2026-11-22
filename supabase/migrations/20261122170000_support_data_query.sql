-- Add data_query ticket kind + hq-data target source for HQ data-agent questions.

alter table public.support_tickets
  drop constraint if exists support_tickets_kind_check;

alter table public.support_tickets
  add constraint support_tickets_kind_check
  check (kind in ('bug', 'improvement', 'data_query'));

alter table public.support_tickets
  drop constraint if exists support_tickets_target_source_check;

alter table public.support_tickets
  add constraint support_tickets_target_source_check
  check (target_source in ('kcw-api', 'kcw-v2', 'hq-data'));

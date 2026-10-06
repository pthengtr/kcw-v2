-- Bank credit -> the marketplace statement days that sum to that credit.
-- Does not change bank.statement_lines match_status. The accounting match stays as it is.

create table if not exists curated_kcw.online_bank_deposits (
  statement_line_id uuid primary key,
  platform text not null,
  shop text not null,
  bank_date date not null,
  amount numeric not null,
  period_from date not null,
  period_to date not null,
  payout_count int not null,
  built_at timestamptz not null default now()
);

create index if not exists online_bank_deposits_bank_date_idx
  on curated_kcw.online_bank_deposits (bank_date desc);

create table if not exists curated_kcw.online_bank_deposit_payouts (
  statement_line_id uuid not null
    references curated_kcw.online_bank_deposits (statement_line_id) on delete cascade,
  payout_key text not null,
  primary key (statement_line_id, payout_key)
);

alter table curated_kcw.online_bank_deposits enable row level security;
alter table curated_kcw.online_bank_deposit_payouts enable row level security;

grant select, insert, update, delete on curated_kcw.online_bank_deposits to service_role;
grant select, insert, update, delete on curated_kcw.online_bank_deposit_payouts to service_role;

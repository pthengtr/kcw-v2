-- Peak receipt numbers (เลขที่เอกสาร RT-...) for marketplace order ids.

create table if not exists curated_kcw.online_peak_receipts (
  platform text not null,
  order_id text not null,
  receipt_no text,
  receipt_date date,
  receipt_status text,
  receipt_amount numeric,
  order_status text,
  order_amount numeric,
  shop_name text,
  source_file text,
  built_at timestamptz not null default now(),
  primary key (platform, order_id)
);

create index if not exists online_peak_receipts_receipt_idx
  on curated_kcw.online_peak_receipts (receipt_no);

alter table curated_kcw.online_peak_receipts enable row level security;

grant select, insert, update, delete on curated_kcw.online_peak_receipts to service_role;

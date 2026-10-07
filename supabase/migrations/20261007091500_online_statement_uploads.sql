-- Files uploaded from เงินเข้าออนไลน์. The HQ worker copies pending rows
-- into statement/online on Drive, then the link job rebuilds the tables.

create table if not exists curated_kcw.online_statement_uploads (
  id uuid primary key,
  format text not null,
  shop text,
  original_filename text not null,
  storage_path text not null,
  status text not null default 'pending',
  row_count int,
  error_message text,
  uploaded_by text,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);

create index if not exists online_statement_uploads_status_idx
  on curated_kcw.online_statement_uploads (status, created_at);

alter table curated_kcw.online_statement_uploads enable row level security;

grant select, insert, update, delete on curated_kcw.online_statement_uploads to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'online-statements',
  'online-statements',
  false,
  15728640,
  array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']::text[]
)
on conflict (id) do nothing;

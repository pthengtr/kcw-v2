-- SYP PO prepare overlay (app-owned). PARTS9 BILLED stays in raw_kcw via sync_pomas_podet.

create table if not exists public.po_syp_prepare (
  docno text primary key,
  prepared boolean not null default false,
  prepared_at timestamptz,
  prepared_by uuid references auth.users(id) on delete set null,
  note text,
  updated_at timestamptz not null default now()
);

create index if not exists po_syp_prepare_prepared_idx
  on public.po_syp_prepare (prepared);

alter table public.po_syp_prepare enable row level security;

-- No anon/authenticated policies: app uses service-role after requirePermission.
revoke all on table public.po_syp_prepare from anon, authenticated;
grant select, insert, update, delete on table public.po_syp_prepare to service_role;

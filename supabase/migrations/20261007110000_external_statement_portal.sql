-- View-only portal role. Write keys (bank_statement_sync, online_statements) stay internal.

insert into public.kcw_roles (role_key, title, description)
values (
  'external',
  'External',
  'View-only Bank Statement and online statement portal'
)
on conflict (role_key) do nothing;

insert into public.kcw_role_page_permissions (role_key, page_key)
values
  ('external', 'bank_statement_view'),
  ('external', 'online_statements_view')
on conflict do nothing;

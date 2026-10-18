-- Page grant for the VAT inventory report. Tables and functions are created
-- by kcw-analytic migration 20261018120000_vat_inventory.sql on the same database.

insert into public.kcw_role_page_permissions (role_key, page_key)
select role_key, 'bi_vat_inventory'
from public.kcw_role_page_permissions
where page_key = 'bi_vat'
on conflict do nothing;

insert into public.kcw_role_page_permissions (role_key, page_key)
values ('external', 'bi_vat_inventory')
on conflict do nothing;

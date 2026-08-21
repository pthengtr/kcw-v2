-- Remap a leftover RBAC key so Normal grants match the current sales page.
-- bi_product_sales was stored for Normal but the app gates /bi/sales with bi_sales.

update public.kcw_role_page_permissions as src
set page_key = 'bi_sales'
where src.page_key = 'bi_product_sales'
  and not exists (
    select 1
    from public.kcw_role_page_permissions existing
    where existing.role_key = src.role_key
      and existing.page_key = 'bi_sales'
  );

delete from public.kcw_role_page_permissions
where page_key = 'bi_product_sales';

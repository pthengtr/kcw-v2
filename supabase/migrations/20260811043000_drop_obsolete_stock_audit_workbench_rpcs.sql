-- Drop obsolete stock-audit workbench RPCs (counting moved to branch LINE stock-check).
drop function if exists public.fn_stock_audit_create_batch(text, integer, text, boolean, text, text);
drop function if exists public.fn_stock_audit_get_batch(uuid);
drop function if exists public.fn_stock_audit_mark(text, text, text, text, uuid, text);
drop function if exists public.fn_stock_audit_skip_item(uuid, text, text);

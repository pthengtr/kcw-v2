-- Fix _stock_audit_parse_qty: preserve scientific notation (e.g. 1.13e-13).
-- The previous regex stripped "e", turning "1.13686837721616e-13" into invalid "1.13686837721616-13"
-- and breaking fn_stock_audit_overview on /stock-audit.

create or replace function public._stock_audit_parse_qty(p_text text)
returns numeric
language sql
immutable
as $$
  select coalesce(
    nullif(
      regexp_replace(
        regexp_replace(coalesce(btrim(p_text), ''), ',', '', 'g'),
        '[^0-9.eE+-]',
        '',
        'g'
      ),
      ''
    )::numeric,
    0
  );
$$;

-- Bill list for a TAR daily payout. Called from the statement page when an
-- operator opens a row already matched as tar_cntar_net. Does not write
-- statement match fields.

create or replace function bank.fn_tar_day_bills(p_billdate date, p_series text)
returns table (
  doc_type text,
  billno text,
  amount numeric
)
language plpgsql
stable
security definer
set search_path = billgen, pg_temp
as $$
begin
  if p_billdate is null or p_series not in ('hq', 'syp') then
    raise exception 'invalid tar day query';
  end if;

  if p_series = 'hq' then
    return query
    select bills.doc_type, bills.billno, bills.amount
    from (
      select
        'TAR'::text as doc_type,
        coalesce(nullif(btrim(t.new_billno), ''), t.billno) as billno,
        coalesce(sum(t.amount), 0)::numeric as amount
      from billgen.fin_tar_lines t
      where t.billdate = p_billdate
      group by coalesce(nullif(btrim(t.new_billno), ''), t.billno)
      union all
      select
        'CNTAR'::text,
        coalesce(nullif(btrim(t.new_billno), ''), t.billno),
        coalesce(sum(t.amount), 0)::numeric
      from billgen.fin_cntar_lines t
      where t.billdate = p_billdate
      group by coalesce(nullif(btrim(t.new_billno), ''), t.billno)
    ) bills
    order by case bills.doc_type when 'TAR' then 0 else 1 end, bills.billno;
  else
    return query
    select bills.doc_type, bills.billno, bills.amount
    from (
      select
        '3TAR'::text as doc_type,
        coalesce(nullif(btrim(t.new_billno), ''), t.billno) as billno,
        coalesce(sum(t.amount), 0)::numeric as amount
      from billgen.fin_3tar_lines t
      where t.billdate = p_billdate
      group by coalesce(nullif(btrim(t.new_billno), ''), t.billno)
      union all
      select
        '3CNTAR'::text,
        coalesce(nullif(btrim(t.new_billno), ''), t.billno),
        coalesce(sum(t.amount), 0)::numeric
      from billgen.fin_3cntar_lines t
      where t.billdate = p_billdate
      group by coalesce(nullif(btrim(t.new_billno), ''), t.billno)
    ) bills
    order by case bills.doc_type when '3TAR' then 0 else 1 end, bills.billno;
  end if;
end;
$$;

revoke all on function bank.fn_tar_day_bills(date, text) from public, anon, authenticated;
grant execute on function bank.fn_tar_day_bills(date, text) to service_role;

create index if not exists idx_fin_tar_billdate
  on billgen.fin_tar_lines (billdate);
create index if not exists idx_fin_cntar_billdate
  on billgen.fin_cntar_lines (billdate);
create index if not exists idx_fin_3tar_billdate
  on billgen.fin_3tar_lines (billdate);
create index if not exists idx_fin_3cntar_billdate
  on billgen.fin_3cntar_lines (billdate);

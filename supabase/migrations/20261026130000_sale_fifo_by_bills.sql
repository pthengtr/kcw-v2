-- Bill-level FIFO cost for statement margin.
-- Reads the daily fifo.sale_cost build (and the PI bills it consumed).
-- TAR / 3TAR numbers are the renumbered bill. Cost stays on the source sale bill.
-- Does not write fifo or statement match fields.

create index if not exists fifo_sale_cost_billno_idx
  on fifo.sale_cost (sale_billno);

create or replace function public.fn_sale_fifo_by_bills(
  p_billnos text[],
  p_site text default null
)
returns jsonb
language sql
stable
security definer
set search_path = pg_temp
as $$
  with wanted as (
    select distinct btrim(bill) as billno
    from unnest(coalesce(p_billnos, array[]::text[])) as bill
    where btrim(coalesce(bill, '')) <> ''
  ),
  site_ok as (
    select lower(btrim(coalesce(p_site, ''))) as site
  ),
  direct as (
    select
      c.sale_billno as billno,
      lower(c.site) as site,
      sum(coalesce(c.fifo_ext_cost, 0))::numeric as fifo_ext_cost,
      sum(c.units)::numeric as units,
      count(*)::int as line_count,
      count(*) filter (where c.status = 'UNCOSTED')::int as uncosted_lines,
      count(*) filter (where c.status = 'PARTIAL')::int as partial_lines,
      count(*) filter (where c.status = 'OK')::int as ok_lines
    from fifo.sale_cost c
    join wanted w on w.billno = c.sale_billno
    cross join site_ok s
    where c.sale_billno is not null
      and (s.site = '' or lower(c.site) = s.site)
    group by c.sale_billno, lower(c.site)
  ),
  unresolved as (
    select w.billno
    from wanted w
    where not exists (
      select 1 from direct d where d.billno = w.billno
    )
  ),
  tar_lines as (
    select
      u.billno as asked,
      btrim(t.billno) as src_bill,
      btrim(t.bcode) as bcode,
      sum(t.qty)::numeric as qty,
      'hq'::text as site
    from unresolved u
    join billgen.fin_tar_lines t on t.new_billno = u.billno
    cross join site_ok s
    where s.site in ('', 'hq')
    group by u.billno, btrim(t.billno), btrim(t.bcode)
    union all
    select
      u.billno,
      btrim(t.billno),
      btrim(t.bcode),
      sum(t.qty)::numeric,
      'syp'::text
    from unresolved u
    join billgen.fin_3tar_lines t on t.new_billno = u.billno
    cross join site_ok s
    where s.site in ('', 'syp')
    group by u.billno, btrim(t.billno), btrim(t.bcode)
  ),
  src_cost as (
    select
      c.site as site_raw,
      lower(c.site) as site,
      c.sale_billno as src_bill,
      btrim(c.bcode) as bcode,
      c.sidet_id,
      coalesce(c.fifo_ext_cost, 0)::numeric as fifo_ext_cost,
      c.units::numeric as units,
      c.status
    from fifo.sale_cost c
    join (
      select distinct src_bill, bcode, site from tar_lines
    ) k
      on k.src_bill = c.sale_billno
     and k.bcode = btrim(c.bcode)
     and k.site = lower(c.site)
  ),
  src_totals as (
    select
      site,
      src_bill,
      bcode,
      sum(fifo_ext_cost) as fifo_ext_cost,
      sum(units) as units,
      count(*)::int as line_count,
      count(*) filter (where status = 'UNCOSTED')::int as uncosted_lines,
      count(*) filter (where status = 'PARTIAL')::int as partial_lines,
      count(*) filter (where status = 'OK')::int as ok_lines
    from src_cost
    group by site, src_bill, bcode
  ),
  tar_share as (
    select
      m.asked,
      m.site,
      m.src_bill,
      m.bcode,
      case
        when coalesce(s.units, 0) > 0 then least(m.qty, s.units) / s.units
        else 0
      end as ratio,
      coalesce(s.fifo_ext_cost, 0) as fifo_ext_cost,
      coalesce(s.units, 0) as units,
      coalesce(s.line_count, 0) as line_count,
      coalesce(s.uncosted_lines, 0) as uncosted_lines,
      coalesce(s.partial_lines, 0) as partial_lines,
      coalesce(s.ok_lines, 0) as ok_lines,
      s.bcode is null as missing
    from tar_lines m
    left join src_totals s
      on s.site = m.site
     and s.src_bill = m.src_bill
     and s.bcode = m.bcode
  ),
  tar_costs as (
    select
      asked as billno,
      site,
      sum(fifo_ext_cost * ratio)::numeric as fifo_ext_cost,
      sum(case when units > 0 then least(units * ratio, units) else 0 end)::numeric as units,
      sum(line_count)::int as line_count,
      (sum(uncosted_lines) + count(*) filter (where missing))::int as uncosted_lines,
      sum(partial_lines)::int as partial_lines,
      sum(ok_lines)::int as ok_lines
    from tar_share
    group by asked, site
  ),
  costs as (
    select * from direct
    union all
    select * from tar_costs
  ),
  direct_alloc as (
    select
      c.sale_billno as billno,
      lower(c.site) as site,
      nullif(btrim(a.pi_billno), '') as pi_billno,
      a.pi_billdate,
      sum(a.qty)::numeric as qty,
      sum(a.qty * a.unit_cost)::numeric as ext_cost
    from fifo.sale_cost c
    join fifo.sale_cost_alloc a
      on a.site = c.site
     and a.sidet_id = c.sidet_id
    join wanted w on w.billno = c.sale_billno
    cross join site_ok s
    where c.sale_billno is not null
      and (s.site = '' or lower(c.site) = s.site)
    group by c.sale_billno, lower(c.site), nullif(btrim(a.pi_billno), ''), a.pi_billdate
  ),
  tar_alloc as (
    select
      m.asked as billno,
      m.site,
      nullif(btrim(a.pi_billno), '') as pi_billno,
      a.pi_billdate,
      sum(a.qty * m.ratio)::numeric as qty,
      sum(a.qty * a.unit_cost * m.ratio)::numeric as ext_cost
    from tar_share m
    join src_cost c
      on c.site = m.site
     and c.src_bill = m.src_bill
     and c.bcode = m.bcode
    join fifo.sale_cost_alloc a
      on a.site = c.site_raw
     and a.sidet_id = c.sidet_id
    where not m.missing
    group by m.asked, m.site, nullif(btrim(a.pi_billno), ''), a.pi_billdate
  ),
  alloc as (
    select * from direct_alloc
    union all
    select * from tar_alloc
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'billno', costs.billno,
        'site', costs.site,
        'fifo_ext_cost', round(costs.fifo_ext_cost, 2),
        'units', costs.units,
        'line_count', costs.line_count,
        'uncosted_lines', costs.uncosted_lines,
        'partial_lines', costs.partial_lines,
        'status', case
          when costs.line_count = 0 and costs.uncosted_lines > 0 then 'UNCOSTED'
          when costs.uncosted_lines > 0
           and costs.ok_lines = 0
           and costs.partial_lines = 0 then 'UNCOSTED'
          when costs.uncosted_lines > 0 or costs.partial_lines > 0 then 'PARTIAL'
          else 'OK'
        end,
        'pi_bills', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'pi_billno', alloc.pi_billno,
              'pi_billdate', alloc.pi_billdate,
              'qty', alloc.qty,
              'ext_cost', round(alloc.ext_cost, 2)
            )
            order by alloc.pi_billdate, alloc.pi_billno
          )
          from alloc
          where alloc.billno = costs.billno
            and alloc.site = costs.site
            and alloc.pi_billno is not null
        ), '[]'::jsonb)
      )
      order by costs.billno, costs.site
    ),
    '[]'::jsonb
  )
  from costs;
$$;

comment on function public.fn_sale_fifo_by_bills(text[], text) is
  'FIFO extended cost and PI bill refs for sale bill numbers. TAR/3TAR numbers resolve to the source sale bills. p_site is hq or syp; null searches both.';

revoke all on function public.fn_sale_fifo_by_bills(text[], text) from public, anon, authenticated;
grant execute on function public.fn_sale_fifo_by_bills(text[], text) to service_role;

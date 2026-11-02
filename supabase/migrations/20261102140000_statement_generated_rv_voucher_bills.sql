-- Generated ใบสำคัญรับเงิน (billgen.fin_rv_lines / fin_3rv_lines) are not
-- posted to PARTS9 RVMAS. Open them from the statement voucher link.

create or replace function public.fn_voucher_bills(p_voucher_no text)
returns table (
  source text,
  doc_type text,
  billno text,
  bill_date text,
  acctname text,
  amount numeric,
  canceled boolean
)
language sql
stable
security definer
set search_path = public, curated_kcw, raw_kcw, billgen, pg_temp
as $$
  with voucher as (
    select btrim(coalesce(p_voucher_no, '')) as voucher_no
  ),
  discount as (
    select coalesce((
      select round(
        coalesce(nullif(replace(btrim(v."DISCOUNT"), ',', ''), '')::numeric, 0),
        2
      )
      from (
        select "DISCOUNT", "CANCELED"
        from raw_kcw.raw_hq_pvmas_notes_vouchers
        where btrim(coalesce("VOUCNO", '')) = (select voucher_no from voucher)
        union all
        select "DISCOUNT", "CANCELED"
        from raw_kcw.raw_hq_rvmas_notes_vouchers
        where btrim(coalesce("VOUCNO", '')) = (select voucher_no from voucher)
      ) v
      order by case when coalesce(v."CANCELED", 'N') = 'Y' then 1 else 0 end
      limit 1
    ), 0) as amount
  ),
  generated as (
    select
      btrim(l.billno) as billno,
      to_char(min(l.billdate), 'YYYY-MM-DD') as bill_date,
      round(sum(l.amount), 2) as amount
    from (
      select billno, billdate, amount, new_billno from billgen.fin_rv_lines
      union all
      select billno, billdate, amount, new_billno from billgen.fin_3rv_lines
    ) l
    cross join voucher v
    where v.voucher_no <> ''
      and btrim(coalesce(l.new_billno, '')) = v.voucher_no
      and btrim(coalesce(l.billno, '')) <> ''
    group by btrim(l.billno)
  )
  select
    q.source,
    q.doc_type,
    q.billno,
    q.bill_date,
    q.acctname,
    q.amount,
    q.canceled
  from (
    select
      'sales'::text as source,
      coalesce(nullif(btrim(b."BILLTYPE_STD"), ''), 'TAD') as doc_type,
      btrim(b."BILLNO") as billno,
      left(b."BILLDATE", 10) as bill_date,
      nullif(btrim(b."ACCTNAME"), '') as acctname,
      coalesce(nullif(replace(b."AFTERTAX", ',', ''), '')::numeric, 0) as amount,
      b."CANCELED" = 'Y' as canceled
    from curated_kcw.fact_sales_bills_all b
    cross join voucher v
    where v.voucher_no <> ''
      and btrim(coalesce(b."VOUCNO2", '')) = v.voucher_no
    union all
    select
      'purchase'::text,
      'PIMAS'::text,
      btrim(p."BILLNO"),
      left(p."BILLDATE", 10),
      (
        select nullif(btrim(a."ACCTNAME"), '')
        from raw_kcw.raw_hq_apmas_payable a
        where a."ACCTNO" = p."ACCTNO"
        limit 1
      ),
      coalesce(nullif(replace(p."AFTERTAX", ',', ''), '')::numeric, 0),
      p."CANCELED" = 'Y'
    from raw_kcw.raw_hq_pimas_purchase_bills p
    cross join voucher v
    where v.voucher_no <> ''
      and btrim(coalesce(p."VOUCNO2", '')) = v.voucher_no
    union all
    select
      'sales'::text,
      case
        when g.billno ~* '^3' and coalesce(nullif(btrim(b."BILLTYPE_STD"), ''), 'TR') in
          ('TR', 'TAD', 'TD', 'TAR', 'CNTAR', 'CN', 'CNTAD')
          then '3' || coalesce(nullif(btrim(b."BILLTYPE_STD"), ''), 'TR')
        else coalesce(nullif(btrim(b."BILLTYPE_STD"), ''), 'TR')
      end,
      g.billno,
      g.bill_date,
      nullif(btrim(b."ACCTNAME"), ''),
      g.amount,
      coalesce(b."CANCELED" = 'Y', false)
    from generated g
    left join lateral (
      select s."BILLTYPE_STD", s."ACCTNAME", s."CANCELED"
      from curated_kcw.fact_sales_bills_all s
      where btrim(s."BILLNO") = g.billno
      limit 1
    ) b on true
    union all
    select
      'discount'::text,
      'ส่วนลด'::text,
      'ส่วนลด'::text,
      null::text,
      null::text,
      -1 * d.amount,
      false
    from discount d
    where d.amount <> 0
  ) q
  where q.billno <> ''
  order by
    case when q.source = 'discount' then 1 else 0 end,
    q.bill_date nulls last,
    q.billno;
$$;

comment on function public.fn_voucher_bills(text) is
  'Sales and purchase bills settled by one RVMAS or PVMAS voucher, plus generated RV/3RV source bills and the voucher discount.';

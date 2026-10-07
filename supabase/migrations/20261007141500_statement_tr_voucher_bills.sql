-- Accept TR / CN / TD on the sales bill lookup, and list the bills a
-- receipt or payment voucher settles.

create or replace function public.fn_sales_bill_detail(p_doc_type text, p_billno text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, curated_kcw, billgen, pg_temp
as $$
declare
  v_billno text;
  v_doc text;
  v_table text;
  v_billdate text;
  v_acctname text;
  v_po text;
  v_beforetax numeric;
  v_tax numeric;
  v_aftertax numeric;
  v_canceled boolean := false;
  v_branch text;
  v_lines jsonb;
  v_doc_label text;
begin
  v_billno := btrim(coalesce(p_billno, ''));
  if v_billno = '' then
    return null;
  end if;

  v_doc := upper(btrim(coalesce(p_doc_type, '')));
  if v_doc not in (
    'TAR', '3TAR', 'CNTAR', '3CNTAR',
    'TAD', '3TAD', 'CNTAD', '3CNTAD',
    'TR', '3TR', 'TD', '3TD', 'CN', '3CN'
  ) then
    v_doc := case
      when upper(v_billno) like '3CNTAR%' then '3CNTAR'
      when upper(v_billno) like 'CNTAR%' then 'CNTAR'
      when upper(v_billno) like '3TAR%' then '3TAR'
      when upper(v_billno) like 'TAR%' then 'TAR'
      when upper(v_billno) like '3CNTAD%' then '3CNTAD'
      when upper(v_billno) like 'CNTAD%' then 'CNTAD'
      when upper(v_billno) like '3TAD%' then '3TAD'
      when upper(v_billno) like '3TR%' then '3TR'
      when upper(v_billno) like 'TR%' then 'TR'
      when upper(v_billno) like '3TD%' then '3TD'
      when upper(v_billno) like 'TD%' then 'TD'
      when upper(v_billno) like '3CN%' then '3CN'
      when upper(v_billno) like 'CN%' then 'CN'
      else 'TAD'
    end;
  end if;

  v_table := case v_doc
    when 'TAR' then 'billgen.fin_tar_lines'
    when '3TAR' then 'billgen.fin_3tar_lines'
    when 'CNTAR' then 'billgen.fin_cntar_lines'
    when '3CNTAR' then 'billgen.fin_3cntar_lines'
    else null
  end;

  if v_table is not null then
    execute format($sql$
      select min(t.billdate)::text
      from %s t
      where t.new_billno = $1
         or (btrim(coalesce(t.new_billno, '')) = '' and t.billno = $1)
    $sql$, v_table)
    into v_billdate
    using v_billno;

    if v_billdate is null then
      return null;
    end if;

    execute format($sql$
      select
        round(coalesce(sum(t.amount), 0), 2),
        %s
      from %s t
      where t.new_billno = $1
         or (btrim(coalesce(t.new_billno, '')) = '' and t.billno = $1)
    $sql$,
      case
        when v_doc in ('CNTAR', '3CNTAR')
          then '(array_agg(nullif(btrim(t.po), '''') order by t.id))[1]'
        else 'null::text'
      end,
      v_table)
    into v_aftertax, v_po
    using v_billno;

    v_beforetax := round(coalesce(v_aftertax, 0) / 1.07, 2);
    v_tax := round(coalesce(v_aftertax, 0) - v_beforetax, 2);
    v_doc_label := v_doc;

    execute format($sql$
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'bcode', s.bcode,
            'detail', s.detail,
            'qty', s.qty,
            'ui', s.ui,
            'price', s.price,
            'amount', s.amount
          )
          order by s.line_id
        ),
        '[]'::jsonb
      )
      from (
        select
          t.id as line_id,
          nullif(btrim(t.bcode), '') as bcode,
          nullif(btrim(t.detail), '') as detail,
          t.qty,
          nullif(btrim(t.ui), '') as ui,
          t.price,
          t.amount
        from %s t
        where t.new_billno = $1
           or (btrim(coalesce(t.new_billno, '')) = '' and t.billno = $1)
      ) s
    $sql$, v_table)
    into v_lines
    using v_billno;

    select nullif(btrim(b."ACCTNAME"), '')
    into v_acctname
    from curated_kcw.fact_sales_bills_all b
    where btrim(b."BILLNO") = v_billno
    order by case when b."CANCELED" = 'N' then 0 else 1 end
    limit 1;

    if v_po is null then
      select nullif(btrim(b."PO"), '')
      into v_po
      from curated_kcw.fact_sales_bills_all b
      where btrim(b."BILLNO") = v_billno
      order by case when b."CANCELED" = 'N' then 0 else 1 end
      limit 1;
    end if;
  else
    select
      coalesce(nullif(btrim(b."BILLTYPE_STD"), ''), v_doc),
      left(b."BILLDATE", 10),
      nullif(btrim(b."ACCTNAME"), ''),
      nullif(btrim(b."PO"), ''),
      coalesce(nullif(replace(b."BEFORETAX", ',', ''), '')::numeric, 0),
      coalesce(nullif(replace(b."TAX", ',', ''), '')::numeric, 0),
      coalesce(nullif(replace(b."AFTERTAX", ',', ''), '')::numeric, 0),
      b."CANCELED" = 'Y',
      b."BRANCH"
    into v_doc_label, v_billdate, v_acctname, v_po, v_beforetax, v_tax, v_aftertax, v_canceled, v_branch
    from curated_kcw.fact_sales_bills_all b
    where btrim(b."BILLNO") = v_billno
    order by
      case when b."CANCELED" = 'N' then 0 else 1 end,
      case
        when left(v_doc, 1) = '3' and b."BRANCH" = 'SYP' then 0
        when left(v_doc, 1) <> '3' and b."BRANCH" = 'HQ' then 0
        else 1
      end
    limit 1;

    if not found then
      return null;
    end if;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'bcode', s.bcode,
          'detail', s.detail,
          'qty', s.qty,
          'ui', s.ui,
          'price', s.price,
          'amount', s.amount
        )
        order by s.ord
      ),
      '[]'::jsonb
    )
    into v_lines
    from (
      select
        nullif(btrim(l."BCODE"), '') as bcode,
        nullif(btrim(l."DETAIL"), '') as detail,
        coalesce(nullif(replace(coalesce(l."QTY", ''), ',', ''), '')::numeric, 0) as qty,
        nullif(btrim(l."UI"), '') as ui,
        coalesce(nullif(replace(coalesce(l."PRICE_NUM", l."PRICE", ''), ',', ''), '')::numeric, 0) as price,
        coalesce(nullif(replace(coalesce(l."AMOUNT_NUM", l."AMOUNT", ''), ',', ''), '')::numeric, 0) as amount,
        case
          when btrim(coalesce(l."ROW_ID", '')) ~ '^[0-9]+$' then btrim(l."ROW_ID")::bigint
          else 0
        end as ord
      from curated_kcw.fact_sales_all l
      where l."BRANCH" = v_branch
        and btrim(l."BILLNO") = v_billno
        and (
          l."CANCELED" = 'N'
          or not exists (
            select 1
            from curated_kcw.fact_sales_all x
            where x."BRANCH" = v_branch
              and btrim(x."BILLNO") = v_billno
              and x."CANCELED" = 'N'
          )
        )
    ) s;
  end if;

  return jsonb_build_object(
    'doc_type', v_doc_label,
    'billno', v_billno,
    'bill_date', v_billdate,
    'acctname', v_acctname,
    'po', v_po,
    'beforetax', coalesce(v_beforetax, 0),
    'tax', coalesce(v_tax, 0),
    'aftertax', coalesce(v_aftertax, 0),
    'canceled', coalesce(v_canceled, false),
    'lines', coalesce(v_lines, '[]'::jsonb)
  );
end;
$$;

comment on function public.fn_sales_bill_detail(text, text) is
  'Header and lines for one sales bill (fact_sales) or TAR/CNTAR (billgen).';

revoke all on function public.fn_sales_bill_detail(text, text) from public, anon, authenticated;
grant execute on function public.fn_sales_bill_detail(text, text) to service_role;

create index if not exists fact_sales_bills_billno_btrim_idx
  on curated_kcw.fact_sales_bills_all (btrim("BILLNO"));

create index if not exists fact_sales_lines_billno_btrim_idx
  on curated_kcw.fact_sales_all (btrim("BILLNO"));

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
set search_path = public, curated_kcw, raw_kcw, pg_temp
as $$
  with voucher as (
    select btrim(coalesce(p_voucher_no, '')) as voucher_no
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
  ) q
  where q.billno <> ''
  order by q.bill_date nulls last, q.billno;
$$;

comment on function public.fn_voucher_bills(text) is
  'Sales and purchase bills settled by one RVMAS or PVMAS voucher number.';

revoke all on function public.fn_voucher_bills(text) from public, anon, authenticated;
grant execute on function public.fn_voucher_bills(text) to service_role;

create index if not exists fact_sales_bills_voucno2_btrim_idx
  on curated_kcw.fact_sales_bills_all (btrim("VOUCNO2"))
  where coalesce(btrim("VOUCNO2"), '') <> '';

create index if not exists raw_hq_pimas_voucno2_btrim_idx
  on raw_kcw.raw_hq_pimas_purchase_bills (btrim("VOUCNO2"))
  where coalesce(btrim("VOUCNO2"), '') <> '';

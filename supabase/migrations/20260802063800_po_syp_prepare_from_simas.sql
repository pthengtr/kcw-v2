-- SYP PO prepare status derived from HQ TF/TFV transfer bills (SIMas/SIDet).
-- Link: SIMas.REMARKS contains SYP POMAS.DOCNO (e.g. PO6907-927).
-- Replaces manual public.po_syp_prepare overlay for list/detail display.

create or replace function public.fn_po_is_tf_transfer_bill(p_billno text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_billno, '') <> ''
    and (
      upper(p_billno) like 'TFV%'
      or (
        upper(p_billno) like 'TF%'
        and upper(p_billno) not like 'TFV%'
      )
    );
$$;

create or replace function public.fn_simas_last_ingested_at()
returns timestamptz
language sql
stable
security definer
set search_path = raw_kcw, public
as $$
  select max(s._ingested_at)
  from raw_kcw.raw_hq_simas_sales_bills s;
$$;

create or replace function public.fn_po_syp_tf_prepare_status()
returns table (
  docno text,
  prepare_status text,
  prepared boolean,
  tf_billnos text
)
language sql
stable
security definer
set search_path = raw_kcw, public
as $$
  with tf_bill_po as (
    select
      s."BILLNO",
      (regexp_match(s."REMARKS", 'PO[0-9]{4}-[0-9]+', 'i'))[1] as po_docno
    from raw_kcw.raw_hq_simas_sales_bills s
    where coalesce(s."CANCELED", '') <> 'Y'
      and public.fn_po_is_tf_transfer_bill(s."BILLNO")
      and coalesce(s."REMARKS", '') ~* 'PO[0-9]{4}-[0-9]+'
  ),
  tf_qty as (
    select
      b.po_docno,
      nullif(btrim(d."BCODE"), '') as bcode,
      sum(
        coalesce(d."QTY"::numeric, 0)
        * coalesce(nullif(nullif(btrim(d."MTP"), '')::numeric, 0), 1)
      ) as tf_qty
    from tf_bill_po b
    join raw_kcw.raw_hq_sidet_sales_lines d
      on d."BILLNO" = b."BILLNO"
    where coalesce(d."CANCELED", '') <> 'Y'
      and nullif(btrim(d."BCODE"), '') is not null
    group by b.po_docno, nullif(btrim(d."BCODE"), '')
  ),
  po_line_qty as (
    select
      d."DOCNO" as docno,
      nullif(btrim(d."BCODE"), '') as bcode,
      sum(
        coalesce(d."QTY"::numeric, 0)
        * coalesce(nullif(nullif(btrim(d."MTP"), '')::numeric, 0), 1)
      ) as ordered_qty
    from raw_kcw.raw_syp_podet_purchase_order_lines d
    where nullif(btrim(d."BCODE"), '') is not null
    group by d."DOCNO", nullif(btrim(d."BCODE"), '')
  ),
  po_prepare as (
    select
      pl.docno,
      count(*) filter (where pl.ordered_qty > 0)::int as line_count,
      count(*) filter (
        where pl.ordered_qty > 0
          and coalesce(tf.tf_qty, 0) >= pl.ordered_qty
      )::int as prepared_line_count,
      count(*) filter (
        where pl.ordered_qty > 0 and coalesce(tf.tf_qty, 0) > 0
      )::int as any_tf_line_count
    from po_line_qty pl
    left join tf_qty tf
      on tf.po_docno = pl.docno and tf.bcode = pl.bcode
    group by pl.docno
  ),
  po_tf_bills as (
    select
      b.po_docno as docno,
      string_agg(distinct b."BILLNO", ', ' order by b."BILLNO") as tf_billnos
    from tf_bill_po b
    group by b.po_docno
  )
  select
    p.docno,
    case
      when p.line_count = 0 or p.any_tf_line_count = 0 then 'not_prepared'
      when p.prepared_line_count >= p.line_count then 'prepared'
      else 'partially_prepared'
    end as prepare_status,
    (p.prepared_line_count >= p.line_count and p.line_count > 0) as prepared,
    tb.tf_billnos
  from po_prepare p
  left join po_tf_bills tb on tb.docno = p.docno;
$$;

create or replace function public.fn_po_syp_lines(p_docno text)
returns jsonb
language plpgsql
stable
security definer
set search_path = raw_kcw, curated_kcw, public
as $$
declare
  v_docno text := btrim(coalesce(p_docno, ''));
  v_rows jsonb;
  v_tf_billnos text;
begin
  if v_docno = '' then
    raise exception 'missing docno';
  end if;

  select string_agg(distinct b."BILLNO", ', ' order by b."BILLNO")
  into v_tf_billnos
  from raw_kcw.raw_hq_simas_sales_bills b
  where coalesce(b."CANCELED", '') <> 'Y'
    and public.fn_po_is_tf_transfer_bill(b."BILLNO")
    and coalesce(b."REMARKS", '') ~* ('\m' || regexp_replace(v_docno, '([.^$|*+?(){}\[\]\\-])', '\\\1', 'g') || '\M');

  with tf_qty as (
    select
      nullif(btrim(d."BCODE"), '') as bcode,
      sum(
        coalesce(d."QTY"::numeric, 0)
        * coalesce(nullif(nullif(btrim(d."MTP"), '')::numeric, 0), 1)
      ) as tf_qty
    from raw_kcw.raw_hq_simas_sales_bills s
    join raw_kcw.raw_hq_sidet_sales_lines d
      on d."BILLNO" = s."BILLNO"
    where coalesce(s."CANCELED", '') <> 'Y'
      and public.fn_po_is_tf_transfer_bill(s."BILLNO")
      and coalesce(s."REMARKS", '') ~* ('\m' || regexp_replace(v_docno, '([.^$|*+?(){}\[\]\\-])', '\\\1', 'g') || '\M')
      and coalesce(d."CANCELED", '') <> 'Y'
      and nullif(btrim(d."BCODE"), '') is not null
    group by nullif(btrim(d."BCODE"), '')
  )
  select coalesce(jsonb_agg(to_jsonb(x) order by x.line_sort nulls last, x.line), '[]'::jsonb)
  into v_rows
  from (
    select
      d."DOCNO" as docno,
      d."LINE" as line,
      nullif(regexp_replace(coalesce(d."LINE", ''), '[^0-9]', '', 'g'), '')::bigint as line_sort,
      d."ITEMNO" as itemno,
      d."BCODE" as bcode,
      d."DETAIL" as detail,
      d."QTY" as qty,
      d."UI" as ui,
      d."MTP" as mtp,
      d."PRICE" as price,
      d."AMOUNT" as amount,
      i."LOCATION1" as hq_location1,
      i."LOCATION2" as hq_location2,
      inv.qty as hq_qty,
      inv.updated_at as hq_qty_updated_at,
      (
        coalesce(tf.tf_qty, 0) > 0
        and coalesce(tf.tf_qty, 0) >= (
          coalesce(d."QTY"::numeric, 0)
          * coalesce(nullif(nullif(btrim(d."MTP"), '')::numeric, 0), 1)
        )
      ) as prepared,
      case
        when coalesce(tf.tf_qty, 0) <= 0 then 'not_prepared'
        when coalesce(tf.tf_qty, 0) >= (
          coalesce(d."QTY"::numeric, 0)
          * coalesce(nullif(nullif(btrim(d."MTP"), '')::numeric, 0), 1)
        ) then 'prepared'
        else 'partially_prepared'
      end as prepare_line_status,
      coalesce(tf.tf_qty, 0) as tf_qty
    from raw_kcw.raw_syp_podet_purchase_order_lines d
    left join raw_kcw.raw_hq_icmas_products i
      on i."BCODE" = d."BCODE"
    left join curated_kcw.inventory_qty_latest inv
      on inv.branch = 'HQ' and inv.bcode = d."BCODE"
    left join tf_qty tf
      on tf.bcode = nullif(btrim(d."BCODE"), '')
    where d."DOCNO" = v_docno
  ) x;

  return jsonb_build_object(
    'docno', v_docno,
    'lines', coalesce(v_rows, '[]'::jsonb),
    'tf_billnos', v_tf_billnos
  );
end;
$$;

create or replace function public.fn_po_list(
  p_site text,
  p_status text default 'open',
  p_prepare text default 'all',
  p_q text default null,
  p_from text default null,
  p_to text default null,
  p_months integer default 1,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = raw_kcw, public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_q text := nullif(btrim(coalesce(p_q, '')), '');
  v_status text := coalesce(p_status, 'open');
  v_prepare text := coalesce(p_prepare, 'all');
  v_from text := nullif(btrim(coalesce(p_from, '')), '');
  v_to text := nullif(btrim(coalesce(p_to, '')), '');
  v_months integer := greatest(1, least(coalesce(p_months, 1), 60));
  v_cutoff text := to_char((current_date - make_interval(months => v_months)), 'YYYY-MM-DD');
  v_result jsonb;
begin
  if p_site not in ('HQ', 'SYP') then
    raise exception 'invalid site: %', p_site;
  end if;
  if v_status not in ('open', 'billed', 'all') then
    raise exception 'invalid status: %', v_status;
  end if;
  if v_prepare not in ('all', 'prepared', 'partially_prepared', 'not_prepared') then
    raise exception 'invalid prepare filter: %', v_prepare;
  end if;
  if v_from is not null and v_from !~ '^\d{4}-\d{2}-\d{2}' then
    raise exception 'invalid p_from: %', v_from;
  end if;
  if v_to is not null and v_to !~ '^\d{4}-\d{2}-\d{2}' then
    raise exception 'invalid p_to: %', v_to;
  end if;

  if p_site = 'HQ' then
    select jsonb_build_object(
      'count', c.total,
      'rows', coalesce((
        select jsonb_agg(to_jsonb(p) order by p.docdate desc nulls last, p.docno desc nulls last)
        from (
          select
            h."DOCNO" as docno,
            h."DOCDATE" as docdate,
            h."ACCTNO" as acctno,
            h."ACCTNAME" as acctname,
            h."BILLED" as billed,
            h."CANCELED" as canceled,
            h."BEFORETAX" as beforetax,
            h."TAX" as tax,
            h."AFTERTAX" as aftertax,
            h."BILLNO" as billno,
            h."BILLDATE" as billdate,
            h."REMARKS" as remarks,
            h._ingested_at as ingested_at
          from raw_kcw.raw_hq_pomas_purchase_orders h
          where
            (v_status = 'all'
              or (v_status = 'open' and h."BILLED" = 'N' and coalesce(h."CANCELED", '') <> 'Y')
              or (v_status = 'billed' and h."BILLED" = 'Y'))
            and (
              case
                when v_from is not null then coalesce(h."DOCDATE", '') >= v_from
                else coalesce(h."DOCDATE", '') >= v_cutoff
              end
              and (v_to is null or coalesce(h."DOCDATE", '') <= v_to)
            )
            and (
              v_q is null
              or h."DOCNO" ilike '%' || v_q || '%'
              or coalesce(h."ACCTNAME", '') ilike '%' || v_q || '%'
              or coalesce(h."ACCTNO", '') ilike '%' || v_q || '%'
            )
          order by h."DOCDATE" desc nulls last, h."DOCNO" desc nulls last
          offset v_offset
          limit v_limit
        ) p
      ), '[]'::jsonb)
    )
    into v_result
    from (
      select count(*)::bigint as total
      from raw_kcw.raw_hq_pomas_purchase_orders h
      where
        (v_status = 'all'
          or (v_status = 'open' and h."BILLED" = 'N' and coalesce(h."CANCELED", '') <> 'Y')
          or (v_status = 'billed' and h."BILLED" = 'Y'))
        and (
          case
            when v_from is not null then coalesce(h."DOCDATE", '') >= v_from
            else coalesce(h."DOCDATE", '') >= v_cutoff
          end
          and (v_to is null or coalesce(h."DOCDATE", '') <= v_to)
        )
        and (
          v_q is null
          or h."DOCNO" ilike '%' || v_q || '%'
          or coalesce(h."ACCTNAME", '') ilike '%' || v_q || '%'
          or coalesce(h."ACCTNO", '') ilike '%' || v_q || '%'
        )
    ) c;
  else
    select jsonb_build_object(
      'count', c.total,
      'rows', coalesce((
        select jsonb_agg(to_jsonb(p) order by p.docdate desc nulls last, p.docno desc nulls last)
        from (
          select
            h."DOCNO" as docno,
            h."DOCDATE" as docdate,
            h."ACCTNO" as acctno,
            h."ACCTNAME" as acctname,
            h."BILLED" as billed,
            h."CANCELED" as canceled,
            h."BEFORETAX" as beforetax,
            h."TAX" as tax,
            h."AFTERTAX" as aftertax,
            h."BILLNO" as billno,
            h."BILLDATE" as billdate,
            h."REMARKS" as remarks,
            h._ingested_at as ingested_at,
            coalesce(ps.prepared, false) as prepared,
            coalesce(ps.prepare_status, 'not_prepared') as prepare_status,
            ps.tf_billnos
          from raw_kcw.raw_syp_pomas_purchase_orders h
          left join public.fn_po_syp_tf_prepare_status() ps
            on ps.docno = h."DOCNO"
          where
            (v_status = 'all'
              or (v_status = 'open' and h."BILLED" = 'N' and coalesce(h."CANCELED", '') <> 'Y')
              or (v_status = 'billed' and h."BILLED" = 'Y'))
            and (
              v_prepare = 'all'
              or coalesce(ps.prepare_status, 'not_prepared') = v_prepare
            )
            and (
              case
                when v_from is not null then coalesce(h."DOCDATE", '') >= v_from
                else coalesce(h."DOCDATE", '') >= v_cutoff
              end
              and (v_to is null or coalesce(h."DOCDATE", '') <= v_to)
            )
            and (
              v_q is null
              or h."DOCNO" ilike '%' || v_q || '%'
              or coalesce(h."ACCTNAME", '') ilike '%' || v_q || '%'
              or coalesce(h."ACCTNO", '') ilike '%' || v_q || '%'
            )
          order by h."DOCDATE" desc nulls last, h."DOCNO" desc nulls last
          offset v_offset
          limit v_limit
        ) p
      ), '[]'::jsonb)
    )
    into v_result
    from (
      select count(*)::bigint as total
      from raw_kcw.raw_syp_pomas_purchase_orders h
      left join public.fn_po_syp_tf_prepare_status() ps
        on ps.docno = h."DOCNO"
      where
        (v_status = 'all'
          or (v_status = 'open' and h."BILLED" = 'N' and coalesce(h."CANCELED", '') <> 'Y')
          or (v_status = 'billed' and h."BILLED" = 'Y'))
        and (
          v_prepare = 'all'
          or coalesce(ps.prepare_status, 'not_prepared') = v_prepare
        )
        and (
          case
            when v_from is not null then coalesce(h."DOCDATE", '') >= v_from
            else coalesce(h."DOCDATE", '') >= v_cutoff
          end
          and (v_to is null or coalesce(h."DOCDATE", '') <= v_to)
        )
        and (
          v_q is null
          or h."DOCNO" ilike '%' || v_q || '%'
          or coalesce(h."ACCTNAME", '') ilike '%' || v_q || '%'
          or coalesce(h."ACCTNO", '') ilike '%' || v_q || '%'
        )
    ) c;
  end if;

  return coalesce(v_result, jsonb_build_object('rows', '[]'::jsonb, 'count', 0));
end;
$$;

revoke all on function public.fn_po_is_tf_transfer_bill(text) from public, anon, authenticated;
revoke all on function public.fn_simas_last_ingested_at() from public, anon, authenticated;
revoke all on function public.fn_po_syp_tf_prepare_status() from public, anon, authenticated;
revoke all on function public.fn_po_syp_lines(text) from public, anon, authenticated;
revoke all on function public.fn_po_list(text, text, text, text, text, text, integer, integer, integer) from public, anon, authenticated;

grant execute on function public.fn_po_is_tf_transfer_bill(text) to service_role;
grant execute on function public.fn_simas_last_ingested_at() to service_role;
grant execute on function public.fn_po_syp_tf_prepare_status() to service_role;
grant execute on function public.fn_po_syp_lines(text) to service_role;
grant execute on function public.fn_po_list(text, text, text, text, text, text, integer, integer, integer) to service_role;

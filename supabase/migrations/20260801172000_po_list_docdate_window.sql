-- Add optional DOCDATE window to fn_po_list (UI default: last 30 days).

drop function if exists public.fn_po_list(text, text, text, text, integer, integer);
drop function if exists public.fn_po_list(text, text, text, text, text, text, integer, integer, integer);

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
  if v_prepare not in ('all', 'prepared', 'not_prepared') then
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
            coalesce(pr.prepared, false) as prepared,
            pr.prepared_at,
            pr.prepared_by::text as prepared_by,
            pr.note
          from raw_kcw.raw_syp_pomas_purchase_orders h
          left join public.po_syp_prepare pr on pr.docno = h."DOCNO"
          where
            (v_status = 'all'
              or (v_status = 'open' and h."BILLED" = 'N' and coalesce(h."CANCELED", '') <> 'Y')
              or (v_status = 'billed' and h."BILLED" = 'Y'))
            and (
              v_prepare = 'all'
              or (v_prepare = 'prepared' and coalesce(pr.prepared, false) = true)
              or (v_prepare = 'not_prepared' and coalesce(pr.prepared, false) = false)
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
      left join public.po_syp_prepare pr on pr.docno = h."DOCNO"
      where
        (v_status = 'all'
          or (v_status = 'open' and h."BILLED" = 'N' and coalesce(h."CANCELED", '') <> 'Y')
          or (v_status = 'billed' and h."BILLED" = 'Y'))
        and (
          v_prepare = 'all'
          or (v_prepare = 'prepared' and coalesce(pr.prepared, false) = true)
          or (v_prepare = 'not_prepared' and coalesce(pr.prepared, false) = false)
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

revoke all on function public.fn_po_list(text, text, text, text, text, text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.fn_po_list(text, text, text, text, text, text, integer, integer, integer) to service_role;

-- Product image operator KPI from ops.product_image_event / product_image_kpi_daily.

create or replace function public.fn_product_image_kpi(
  p_from date default null,
  p_to date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, ops
set statement_timeout = '30s'
as $$
declare
  v_today date := (timezone('Asia/Bangkok', now()))::date;
  v_from date;
  v_to date;
begin
  v_to := coalesce(p_to, v_today);
  v_from := coalesce(p_from, v_to - 6);

  if v_from > v_to then
    raise exception 'Invalid date range';
  end if;

  return (
    with daily as (
      select
        d.work_date,
        d.line_user_id,
        d.display_name,
        d.uploads::int as uploads,
        d.replaces::int as replaces,
        d.deletes::int as deletes,
        d.total_actions::int as total_actions,
        d.unique_products::int as unique_products
      from ops.product_image_kpi_daily d
      where d.work_date between v_from and v_to
    ),
    summary_today as (
      select
        coalesce(sum(uploads), 0)::int as uploads,
        coalesce(sum(replaces), 0)::int as replaces,
        coalesce(sum(deletes), 0)::int as deletes,
        coalesce(sum(total_actions), 0)::int as total_actions,
        coalesce(sum(unique_products), 0)::int as unique_products
      from daily
      where work_date = v_today
    ),
    summary_range as (
      select
        coalesce(sum(uploads), 0)::int as uploads,
        coalesce(sum(replaces), 0)::int as replaces,
        coalesce(sum(deletes), 0)::int as deletes,
        coalesce(sum(total_actions), 0)::int as total_actions,
        coalesce(sum(unique_products), 0)::int as unique_products
      from daily
    ),
    operators as (
      select
        line_user_id,
        coalesce(nullif(max(display_name), ''), line_user_id) as display_name,
        coalesce(sum(uploads) filter (where work_date = v_today), 0)::int as uploads_today,
        coalesce(sum(replaces) filter (where work_date = v_today), 0)::int as replaces_today,
        coalesce(sum(deletes) filter (where work_date = v_today), 0)::int as deletes_today,
        coalesce(sum(total_actions) filter (where work_date = v_today), 0)::int as total_today,
        coalesce(sum(unique_products) filter (where work_date = v_today), 0)::int as unique_today,
        coalesce(sum(uploads), 0)::int as uploads,
        coalesce(sum(replaces), 0)::int as replaces,
        coalesce(sum(deletes), 0)::int as deletes,
        coalesce(sum(total_actions), 0)::int as total_actions,
        coalesce(sum(unique_products), 0)::int as unique_products
      from daily
      group by line_user_id
    ),
    activity as (
      select
        e.created_at,
        e.display_name,
        e.line_user_id,
        e.event_type,
        e.bcode,
        e.storage_path
      from ops.product_image_event e
      where (e.created_at at time zone 'Asia/Bangkok')::date between v_from and v_to
      order by e.created_at desc
      limit 100
    )
    select jsonb_build_object(
      'from', v_from,
      'to', v_to,
      'today', v_today,
      'as_of', timezone('Asia/Bangkok', now()),
      'summary_today', coalesce(
        (select to_jsonb(s) from summary_today s),
        jsonb_build_object(
          'uploads', 0,
          'replaces', 0,
          'deletes', 0,
          'total_actions', 0,
          'unique_products', 0
        )
      ),
      'summary_range', coalesce(
        (select to_jsonb(s) from summary_range s),
        jsonb_build_object(
          'uploads', 0,
          'replaces', 0,
          'deletes', 0,
          'total_actions', 0,
          'unique_products', 0
        )
      ),
      'operators', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'line_user_id', o.line_user_id,
              'display_name', o.display_name,
              'uploads_today', o.uploads_today,
              'replaces_today', o.replaces_today,
              'deletes_today', o.deletes_today,
              'total_today', o.total_today,
              'unique_today', o.unique_today,
              'uploads', o.uploads,
              'replaces', o.replaces,
              'deletes', o.deletes,
              'total_actions', o.total_actions,
              'unique_products', o.unique_products
            )
            order by o.total_today desc,
                     o.total_actions desc,
                     o.unique_products desc,
                     o.display_name
          )
          from operators o
        ),
        '[]'::jsonb
      ),
      'activity', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'created_at', a.created_at,
              'display_name', a.display_name,
              'line_user_id', a.line_user_id,
              'event_type', a.event_type,
              'bcode', a.bcode,
              'storage_path', a.storage_path
            )
            order by a.created_at desc
          )
          from activity a
        ),
        '[]'::jsonb
      )
    )
  );
end;
$$;

revoke all on function public.fn_product_image_kpi(date, date) from public, anon, authenticated;
grant execute on function public.fn_product_image_kpi(date, date) to service_role;

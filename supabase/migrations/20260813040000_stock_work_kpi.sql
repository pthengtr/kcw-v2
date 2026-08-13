-- Per-operator stock-check work KPI from stock.work_event (kcw-api).
-- Completed counts = count_correct + count_variance (daily target progress).

create or replace function public.fn_stock_work_kpi(
  p_branch text default 'HQ'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, stock
set statement_timeout = '30s'
as $$
declare
  v_branch text;
  v_today date := public._stock_audit_bangkok_today();
  v_week_start date;
begin
  v_branch := upper(coalesce(nullif(btrim(p_branch), ''), 'HQ'));
  if v_branch not in ('HQ', 'SYP') then
    raise exception 'Invalid branch';
  end if;

  v_week_start := v_today - 6;

  return (
    with events as (
      select
        e.line_user_id,
        e.display_name,
        e.event_type,
        (e.created_at at time zone 'Asia/Bangkok')::date as work_date
      from stock.work_event e
      where e.branch = v_branch
        and (e.created_at at time zone 'Asia/Bangkok')::date
          between (v_today - 13) and v_today
    ),
    type_counts as (
      select
        work_date,
        line_user_id,
        max(display_name) as display_name,
        count(*) filter (where event_type = 'count_correct')::int as count_correct,
        count(*) filter (where event_type = 'count_variance')::int as count_variance,
        count(*) filter (where event_type = 'count_edit')::int as count_edit,
        count(*) filter (where event_type = 'audit_approve')::int as audit_approve,
        count(*) filter (where event_type = 'audit_reject')::int as audit_reject,
        count(*)::int as total_actions
      from events
      group by work_date, line_user_id
    ),
    day_rollup as (
      select
        work_date,
        coalesce(sum(count_correct), 0)::int as count_correct,
        coalesce(sum(count_variance), 0)::int as count_variance,
        coalesce(sum(count_edit), 0)::int as count_edit,
        coalesce(sum(audit_approve), 0)::int as audit_approve,
        coalesce(sum(audit_reject), 0)::int as audit_reject,
        coalesce(sum(total_actions), 0)::int as total_actions,
        (
          coalesce(sum(count_correct), 0) + coalesce(sum(count_variance), 0)
        )::int as completed_counts
      from type_counts
      group by work_date
    ),
    calendar as (
      select (v_today - g.i)::date as work_date
      from generate_series(0, 13) as g(i)
    ),
    daily as (
      select
        c.work_date as date,
        coalesce(d.completed_counts, 0)::int as completed_counts,
        coalesce(d.total_actions, 0)::int as total_actions,
        coalesce(d.count_correct, 0)::int as count_correct,
        coalesce(d.count_variance, 0)::int as count_variance,
        coalesce(d.count_edit, 0)::int as count_edit,
        coalesce(d.audit_approve, 0)::int as audit_approve,
        coalesce(d.audit_reject, 0)::int as audit_reject
      from calendar c
      left join day_rollup d on d.work_date = c.work_date
      order by c.work_date
    ),
    summary_today as (
      select
        coalesce(sum(count_correct), 0)::int as count_correct,
        coalesce(sum(count_variance), 0)::int as count_variance,
        coalesce(sum(count_edit), 0)::int as count_edit,
        coalesce(sum(audit_approve), 0)::int as audit_approve,
        coalesce(sum(audit_reject), 0)::int as audit_reject,
        coalesce(sum(total_actions), 0)::int as total_actions,
        (
          coalesce(sum(count_correct), 0) + coalesce(sum(count_variance), 0)
        )::int as completed_counts
      from day_rollup
      where work_date = v_today
    ),
    summary_week as (
      select
        coalesce(sum(count_correct), 0)::int as count_correct,
        coalesce(sum(count_variance), 0)::int as count_variance,
        coalesce(sum(count_edit), 0)::int as count_edit,
        coalesce(sum(audit_approve), 0)::int as audit_approve,
        coalesce(sum(audit_reject), 0)::int as audit_reject,
        coalesce(sum(total_actions), 0)::int as total_actions,
        (
          coalesce(sum(count_correct), 0) + coalesce(sum(count_variance), 0)
        )::int as completed_counts
      from day_rollup
      where work_date between v_week_start and v_today
    ),
    operators as (
      select
        line_user_id,
        coalesce(
          nullif(max(display_name) filter (where work_date = v_today), ''),
          nullif(max(display_name), ''),
          line_user_id
        ) as display_name,
        jsonb_build_object(
          'count_correct', coalesce(sum(count_correct) filter (where work_date = v_today), 0)::int,
          'count_variance', coalesce(sum(count_variance) filter (where work_date = v_today), 0)::int,
          'count_edit', coalesce(sum(count_edit) filter (where work_date = v_today), 0)::int,
          'audit_approve', coalesce(sum(audit_approve) filter (where work_date = v_today), 0)::int,
          'audit_reject', coalesce(sum(audit_reject) filter (where work_date = v_today), 0)::int,
          'total_actions', coalesce(sum(total_actions) filter (where work_date = v_today), 0)::int,
          'completed_counts', (
            coalesce(sum(count_correct) filter (where work_date = v_today), 0)
            + coalesce(sum(count_variance) filter (where work_date = v_today), 0)
          )::int
        ) as today,
        jsonb_build_object(
          'count_correct', coalesce(sum(count_correct) filter (
            where work_date between v_week_start and v_today
          ), 0)::int,
          'count_variance', coalesce(sum(count_variance) filter (
            where work_date between v_week_start and v_today
          ), 0)::int,
          'count_edit', coalesce(sum(count_edit) filter (
            where work_date between v_week_start and v_today
          ), 0)::int,
          'audit_approve', coalesce(sum(audit_approve) filter (
            where work_date between v_week_start and v_today
          ), 0)::int,
          'audit_reject', coalesce(sum(audit_reject) filter (
            where work_date between v_week_start and v_today
          ), 0)::int,
          'total_actions', coalesce(sum(total_actions) filter (
            where work_date between v_week_start and v_today
          ), 0)::int,
          'completed_counts', (
            coalesce(sum(count_correct) filter (
              where work_date between v_week_start and v_today
            ), 0)
            + coalesce(sum(count_variance) filter (
              where work_date between v_week_start and v_today
            ), 0)
          )::int
        ) as week
      from type_counts
      where work_date between v_week_start and v_today
      group by line_user_id
    )
    select jsonb_build_object(
      'branch', v_branch,
      'as_of', timezone('Asia/Bangkok', now()),
      'today', v_today,
      'summary_today', coalesce(
        (select to_jsonb(s) from summary_today s),
        jsonb_build_object(
          'count_correct', 0,
          'count_variance', 0,
          'count_edit', 0,
          'audit_approve', 0,
          'audit_reject', 0,
          'total_actions', 0,
          'completed_counts', 0
        )
      ),
      'summary_week', coalesce(
        (select to_jsonb(s) from summary_week s),
        jsonb_build_object(
          'count_correct', 0,
          'count_variance', 0,
          'count_edit', 0,
          'audit_approve', 0,
          'audit_reject', 0,
          'total_actions', 0,
          'completed_counts', 0
        )
      ),
      'daily', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'date', d.date,
              'completed_counts', d.completed_counts,
              'total_actions', d.total_actions,
              'count_correct', d.count_correct,
              'count_variance', d.count_variance,
              'count_edit', d.count_edit,
              'audit_approve', d.audit_approve,
              'audit_reject', d.audit_reject
            )
            order by d.date
          )
          from daily d
        ),
        '[]'::jsonb
      ),
      'operators', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'line_user_id', o.line_user_id,
              'display_name', o.display_name,
              'today', o.today,
              'week', o.week
            )
            order by (o.today->>'completed_counts')::int desc,
                     (o.week->>'completed_counts')::int desc,
                     o.display_name
          )
          from operators o
        ),
        '[]'::jsonb
      )
    )
  );
end;
$$;

revoke all on function public.fn_stock_work_kpi(text) from public, anon, authenticated;
grant execute on function public.fn_stock_work_kpi(text) to service_role;

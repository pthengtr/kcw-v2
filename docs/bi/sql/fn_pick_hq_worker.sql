-- Prefer HQ-UBUNTU-SERVER when its heartbeat is live; else HQ-PC.
-- Applied via supabase/migrations/20260815093000_pick_hq_worker.sql

create or replace function public.fn_pick_hq_worker()
returns text
language plpgsql
stable
security definer
set search_path = ops, public
as $$
declare
  v_name text;
begin
  foreach v_name in array array['HQ-UBUNTU-SERVER', 'HQ-PC']
  loop
    if exists (
      select 1
      from ops.worker_heartbeat wh
      where wh.worker_name = v_name
        and wh.last_seen >= now() - interval '30 seconds'
    ) then
      return v_name;
    end if;
  end loop;
  return 'HQ-PC';
end;
$$;

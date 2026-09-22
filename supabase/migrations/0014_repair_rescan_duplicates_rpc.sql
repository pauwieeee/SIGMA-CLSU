-- Repair migration for deployments where 0009_rescan_duplicates.sql was
-- not applied or PostgREST has not refreshed its schema cache.

create table if not exists public.cron_run_logs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  ran_at timestamptz not null default now(),
  records_affected integer not null default 0,
  detail text
);

alter table public.cron_run_logs enable row level security;

drop policy if exists "cron_run_logs_select_authenticated" on public.cron_run_logs;
create policy "cron_run_logs_select_authenticated" on public.cron_run_logs
  for select to authenticated
  using (true);

create or replace function public.rescan_all_duplicates()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student record;
  v_flags_before integer;
  v_flags_after integer;
begin
  select count(*) into v_flags_before from public.duplicate_flags;

  for v_student in
    select id from public.students where archived_at is null
  loop
    perform public.detect_duplicates_for_student(v_student.id);
  end loop;

  select count(*) into v_flags_after from public.duplicate_flags;

  insert into public.cron_run_logs (job_name, records_affected, detail)
  values (
    'rescan_all_duplicates',
    v_flags_after - v_flags_before,
    (v_flags_after - v_flags_before) || ' new duplicate flag(s) found'
  );

  return v_flags_after - v_flags_before;
end;
$$;

revoke all on function public.rescan_all_duplicates() from public;
grant execute on function public.rescan_all_duplicates() to authenticated;

-- Tell the Supabase REST API to discover the repaired function immediately.
notify pgrst, 'reload schema';

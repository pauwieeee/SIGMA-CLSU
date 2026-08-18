-- SIGMA: admin-triggered full duplicate re-scan.
-- The existing detect_duplicates_for_student trigger only fires on
-- insert/update of a single student_scholarships row, so bulk-imported or
-- manually-edited data that bypassed those triggers (e.g. seeded directly
-- via SQL) could contain undetected duplicates. This lets an admin re-run
-- detection against every student on demand.

create or replace function rescan_all_duplicates()
returns integer as $$
declare
  v_student record;
  v_flags_before integer;
  v_flags_after integer;
begin
  select count(*) into v_flags_before from duplicate_flags;

  for v_student in select id from students where archived_at is null loop
    perform detect_duplicates_for_student(v_student.id);
  end loop;

  select count(*) into v_flags_after from duplicate_flags;

  insert into cron_run_logs (job_name, records_affected, detail)
  values ('rescan_all_duplicates', v_flags_after - v_flags_before,
    (v_flags_after - v_flags_before) || ' new duplicate flag(s) found');

  return v_flags_after - v_flags_before;
end;
$$ language plpgsql security definer;

grant execute on function rescan_all_duplicates() to authenticated;

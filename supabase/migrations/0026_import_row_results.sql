-- Return one durable outcome per attempted import row. Each loop iteration is
-- an exception block (a PostgreSQL subtransaction), so one bad row rolls back
-- only its own student/assignment writes and does not discard successful rows.

alter table public.import_batches
  add column if not exists successful_rows integer not null default 0,
  add column if not exists failed_rows integer not null default 0,
  add column if not exists skipped_rows integer not null default 0;

alter table public.import_batches alter column imported_by set default auth.uid();
alter table public.import_batches drop constraint if exists import_batches_status_check;
alter table public.import_batches add constraint import_batches_status_check
  check (status in ('Processing', 'Completed', 'Completed with Errors', 'Failed'));

create or replace function public.import_student_records_with_results(p_rows jsonb)
returns table (
  source_row integer,
  result_status text,
  error_type text,
  result_message text,
  student_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  v_student_id uuid;
  v_inserted integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'Import rows must be a JSON array'; end if;

  for item in select value from jsonb_array_elements(p_rows) loop
    source_row := nullif(item->>'source_row', '')::integer;
    student_id := null;
    begin
      select id into v_student_id
      from public.students
      where student_number = item->>'student_number';

      if v_student_id is null then
        insert into public.students (
          student_number, last_name, first_name, middle_initial, program_id,
          yr_level, address, contact_number, email
        ) values (
          item->>'student_number', item->>'last_name', item->>'first_name',
          nullif(item->>'middle_initial', ''), (item->>'program_id')::uuid,
          item->>'yr_level', nullif(item->>'address', ''),
          nullif(item->>'contact_number', ''), nullif(item->>'email', '')
        ) returning id into v_student_id;
      end if;

      insert into public.student_scholarships (
        student_id, scholarship_id, academic_year, semester, status
      ) values (
        v_student_id, (item->>'scholarship_id')::uuid,
        item->>'academic_year', item->>'semester', item->>'status'
      ) on conflict (student_id, scholarship_id, academic_year, semester) do nothing;
      get diagnostics v_inserted = row_count;

      student_id := v_student_id;
      if v_inserted = 1 then
        result_status := 'Success';
        error_type := null;
        result_message := 'Student scholarship record imported successfully.';
      else
        result_status := 'Skipped';
        error_type := 'Duplicate Record';
        result_message := 'This student scholarship already exists for the selected academic year and semester.';
      end if;
      return next;
    exception when others then
      student_id := null;
      result_status := 'Failed';
      error_type := case
        when sqlstate = '23505' then 'Duplicate Record'
        when sqlstate = '23503' then 'Invalid Reference'
        when sqlstate = '23514' then 'Invalid Value'
        when sqlstate = '23502' then 'Missing Required Field'
        else 'Database Error'
      end;
      result_message := sqlerrm;
      return next;
    end;
  end loop;
end;
$$;

revoke all on function public.import_student_records_with_results(jsonb) from public;
grant execute on function public.import_student_records_with_results(jsonb) to authenticated;
notify pgrst, 'reload schema';

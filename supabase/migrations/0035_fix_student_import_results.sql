-- Fix ambiguous PL/pgSQL references in the row-by-row student importer.
-- The returned column named student_id is a PL/pgSQL output variable, so an
-- ON CONFLICT column list containing student_id can be parsed ambiguously.

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
  v_existing boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'Import rows must be a JSON array'; end if;

  for item in select element.value from jsonb_array_elements(p_rows) as element(value) loop
    source_row := nullif(item ->> 'source_row', '')::integer;
    student_id := null;

    begin
      select s.id
      into v_student_id
      from public.students as s
      where s.student_number = item ->> 'student_number';
      v_existing := found;

      if not v_existing then
        insert into public.students as s (
          student_number, last_name, first_name, middle_initial, program_id,
          yr_level, address, contact_number, email
        ) values (
          item ->> 'student_number', item ->> 'last_name', item ->> 'first_name',
          nullif(item ->> 'middle_initial', ''), (item ->> 'program_id')::uuid,
          item ->> 'yr_level', nullif(item ->> 'address', ''),
          nullif(item ->> 'contact_number', ''), nullif(item ->> 'email', '')
        ) returning s.id into v_student_id;
      else
        update public.students as s
        set program_id = (item ->> 'program_id')::uuid,
            yr_level = item ->> 'yr_level',
            address = coalesce(nullif(item ->> 'address', ''), s.address),
            contact_number = coalesce(nullif(item ->> 'contact_number', ''), s.contact_number),
            email = coalesce(nullif(item ->> 'email', ''), s.email),
            updated_at = now()
        where s.id = v_student_id;
      end if;

      insert into public.student_scholarships as ss (
        student_id, scholarship_id, academic_year, semester, status
      ) values (
        v_student_id, (item ->> 'scholarship_id')::uuid,
        item ->> 'academic_year', item ->> 'semester', item ->> 'status'
      ) on conflict do nothing;
      get diagnostics v_inserted = row_count;

      student_id := v_student_id;
      if v_inserted = 1 then
        result_status := case when v_existing then 'Updated' else 'Success' end;
        error_type := null;
        result_message := case when v_existing
          then 'Existing student updated and scholarship assignment added.'
          else 'New student and scholarship assignment imported successfully.' end;
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

create or replace function public.import_student_records(p_rows jsonb)
returns table (added integer, skipped integer)
language plpgsql security definer set search_path = public as $$
declare item jsonb; v_student_id uuid; v_inserted integer; v_added integer := 0; v_skipped integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  for item in select value from jsonb_array_elements(p_rows) loop
    select id into v_student_id from students where student_number = item->>'student_number';
    if v_student_id is null then
      insert into students (student_number,last_name,first_name,middle_initial,program_id,yr_level,address,contact_number,email)
      values (item->>'student_number',item->>'last_name',item->>'first_name',nullif(item->>'middle_initial',''),(item->>'program_id')::uuid,item->>'yr_level',nullif(item->>'address',''),nullif(item->>'contact_number',''),nullif(item->>'email',''))
      returning id into v_student_id;
    end if;
    insert into student_scholarships (student_id,scholarship_id,academic_year,semester,status)
    values (v_student_id,(item->>'scholarship_id')::uuid,item->>'academic_year',item->>'semester',item->>'status')
    on conflict (student_id,scholarship_id,academic_year,semester) do nothing;
    get diagnostics v_inserted = row_count;
    if v_inserted = 1 then v_added := v_added + 1; else v_skipped := v_skipped + 1; end if;
  end loop;
  return query select v_added, v_skipped;
end; $$;
revoke all on function public.import_student_records(jsonb) from public;
grant execute on function public.import_student_records(jsonb) to authenticated;
notify pgrst, 'reload schema';

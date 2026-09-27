-- Existing students/assignments are updated; only repeated spreadsheet rows
-- are skipped by the client. Report newly created review flags per import row.
drop function if exists public.import_student_records_with_results(jsonb);

create function public.import_student_records_with_results(p_rows jsonb)
returns table (source_row integer, result_status text, error_type text,
  result_message text, student_id uuid, duplicate_flag_created boolean)
language plpgsql security definer set search_path = public as $$
declare
  item jsonb; v_student_id uuid; v_assignment_id uuid;
  v_existing_student boolean; v_existing_assignment boolean;
  v_flags_before integer; v_flags_after integer; v_actor_name text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'Import rows must be a JSON array'; end if;
  v_actor_name := coalesce(nullif(auth.jwt()->'user_metadata'->>'preferred_username',''),
    nullif(auth.jwt()->'user_metadata'->>'full_name',''), nullif(auth.jwt()->>'email',''), 'Admin');

  for item in select element.value from jsonb_array_elements(p_rows) as element(value) loop
    source_row := nullif(item->>'source_row','')::integer;
    student_id := null; duplicate_flag_created := false;
    begin
      select s.id into v_student_id from public.students s
      where s.student_number = item->>'student_number' for update;
      v_existing_student := found;
      if not v_existing_student then
        insert into public.students as s (student_number,last_name,first_name,middle_initial,
          program_id,yr_level,address,contact_number,email)
        values (item->>'student_number',item->>'last_name',item->>'first_name',
          nullif(item->>'middle_initial',''),(item->>'program_id')::uuid,item->>'yr_level',
          nullif(item->>'address',''),nullif(item->>'contact_number',''),nullif(item->>'email',''))
        returning s.id into v_student_id;
      else
        update public.students s set program_id=(item->>'program_id')::uuid,
          yr_level=item->>'yr_level', address=coalesce(nullif(item->>'address',''),s.address),
          contact_number=coalesce(nullif(item->>'contact_number',''),s.contact_number),
          email=coalesce(nullif(item->>'email',''),s.email), updated_at=now()
        where s.id=v_student_id;
      end if;

      select count(*) into v_flags_before from public.duplicate_flags df
      where df.student_id=v_student_id and df.status in ('Open','Under Review');
      select ss.id into v_assignment_id from public.student_scholarships ss
      where ss.student_id=v_student_id and ss.scholarship_id=(item->>'scholarship_id')::uuid
        and ss.academic_year=item->>'academic_year' and ss.semester=item->>'semester' for update;
      v_existing_assignment := found;
      if v_existing_assignment then
        update public.student_scholarships ss set status=item->>'status', archived_at=null, updated_at=now()
        where ss.id=v_assignment_id;
      else
        insert into public.student_scholarships as ss
          (student_id,scholarship_id,academic_year,semester,status)
        values (v_student_id,(item->>'scholarship_id')::uuid,item->>'academic_year',
          item->>'semester',item->>'status') returning ss.id into v_assignment_id;
      end if;

      perform public.detect_duplicates_for_student(v_student_id);
      select count(*) into v_flags_after from public.duplicate_flags df
      where df.student_id=v_student_id and df.status in ('Open','Under Review');
      duplicate_flag_created := v_flags_after > v_flags_before;
      student_id := v_student_id;
      result_status := case when v_existing_student or v_existing_assignment then 'Updated' else 'Success' end;
      error_type := null;
      result_message := case
        when duplicate_flag_created then 'Imported successfully. Duplicate flag created for review.'
        when v_existing_assignment then 'Existing student and scholarship assignment updated.'
        when v_existing_student then 'Existing student updated and scholarship assignment added.'
        else 'New student and scholarship assignment imported successfully.' end;
      if duplicate_flag_created then
        insert into public.activity_logs (actor_id,actor_name,actor_email,actor_role,
          action,entity_type,entity_id,description)
        values (auth.uid(),v_actor_name,auth.jwt()->>'email','Admin','import','student',v_student_id,
          'Imported student '||(item->>'student_number')||' — Duplicate scholarship flag created for review.');
      end if;
      return next;
    exception when others then
      student_id:=v_student_id; duplicate_flag_created:=false; result_status:='Failed';
      error_type:=case when sqlstate='23505' then 'Duplicate Record'
        when sqlstate='23503' then 'Invalid Reference' when sqlstate='23514' then 'Invalid Value'
        when sqlstate='23502' then 'Missing Required Field' else 'Database Error' end;
      result_message:=sqlerrm; return next;
    end;
  end loop;
end; $$;

revoke all on function public.import_student_records_with_results(jsonb) from public;
grant execute on function public.import_student_records_with_results(jsonb) to authenticated;
notify pgrst, 'reload schema';

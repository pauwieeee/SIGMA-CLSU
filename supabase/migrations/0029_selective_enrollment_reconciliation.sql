-- Apply only enrollment decisions explicitly confirmed by an administrator.
-- Each result is returned to the UI so failed or stale records are never
-- reported as successfully updated.

create or replace function public.apply_selective_enrollment_updates(p_updates jsonb)
returns table (
  assignment_id uuid,
  student_number text,
  student_name text,
  requested_enrollment boolean,
  result_status text,
  result_message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  v_id uuid;
  v_requested boolean;
  v_expected boolean;
  v_current boolean;
  v_student_number text;
  v_student_name text;
  v_updated integer;
  v_success integer := 0;
  v_failed integer := 0;
  v_actor_name text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_updates) <> 'array' then raise exception 'Enrollment updates must be a JSON array'; end if;

  for item in select value from jsonb_array_elements(p_updates) loop
    v_id := null;
    v_requested := null;
    v_expected := null;
    assignment_id := null;
    student_number := null;
    student_name := null;
    requested_enrollment := null;
    result_status := null;
    result_message := null;

    begin
      v_id := nullif(item ->> 'assignment_id', '')::uuid;
      v_requested := (item ->> 'is_enrolled')::boolean;
      v_expected := case when item ? 'expected_is_enrolled' and item ->> 'expected_is_enrolled' is not null
        then (item ->> 'expected_is_enrolled')::boolean else null end;

      select ss.is_enrolled, s.student_number,
             concat_ws(' ', s.first_name, nullif(s.middle_name, ''), s.last_name)
      into v_current, v_student_number, v_student_name
      from public.student_scholarships ss
      join public.students s on s.id = ss.student_id
      join public.scholarships scholarship on scholarship.id = ss.scholarship_id
      where ss.id = v_id
        and ss.archived_at is null
        and ss.term_closed_at is null
        and ss.status = 'Active'
        and scholarship.archived_at is null
        and scholarship.status in ('Active', 'Expiring Soon')
      for update of ss;

      assignment_id := v_id;
      student_number := v_student_number;
      student_name := v_student_name;
      requested_enrollment := v_requested;

      if not found then
        result_status := 'Failed';
        result_message := 'The scholarship assignment is no longer active or available.';
        v_failed := v_failed + 1;
        return next;
        continue;
      end if;

      if v_current is distinct from v_expected then
        result_status := 'Failed';
        result_message := 'Enrollment status changed after preview. Refresh and review this record again.';
        v_failed := v_failed + 1;
        return next;
        continue;
      end if;

      if v_current is not distinct from v_requested then
        result_status := 'Unchanged';
        result_message := 'The record already has the requested enrollment status.';
        return next;
        continue;
      end if;

      update public.student_scholarships
      set is_enrolled = v_requested,
          enrollment_verified_at = now(),
          updated_at = now()
      where id = v_id;
      get diagnostics v_updated = row_count;

      if v_updated = 1 then
        result_status := 'Success';
        result_message := case when v_requested then 'Marked Enrolled.' else 'Marked Not Enrolled.' end;
        v_success := v_success + 1;
      else
        result_status := 'Failed';
        result_message := 'The record could not be updated.';
        v_failed := v_failed + 1;
      end if;
      return next;
    exception when others then
      assignment_id := v_id;
      requested_enrollment := v_requested;
      result_status := 'Failed';
      result_message := sqlerrm;
      v_failed := v_failed + 1;
      return next;
    end;
  end loop;

  v_actor_name := coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'preferred_username', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''),
    nullif(auth.jwt() ->> 'email', ''), 'Admin'
  );

  insert into public.activity_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, entity_type, description
  ) values (
    auth.uid(), v_actor_name, auth.jwt() ->> 'email', 'Admin',
    'verify_enrollment', 'student_scholarship',
    v_actor_name || ' applied selective enrollment verification: ' ||
    v_success || ' updated, ' || v_failed || ' failed.'
  );
end;
$$;

revoke all on function public.apply_selective_enrollment_updates(jsonb) from public;
grant execute on function public.apply_selective_enrollment_updates(jsonb) to authenticated;

notify pgrst, 'reload schema';

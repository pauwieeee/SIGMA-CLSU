-- Allow administrators to explicitly verify selected scholarship assignments
-- without treating an uploaded list as the complete enrollment roster.

create or replace function public.set_selected_enrollment_statuses(p_updates jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer := 0;
  v_requested integer := 0;
  v_actor_name text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_updates) <> 'array' then raise exception 'Enrollment updates must be a JSON array'; end if;

  select count(*) into v_requested
  from jsonb_to_recordset(p_updates) as item(assignment_id uuid, is_enrolled boolean)
  where item.assignment_id is not null and item.is_enrolled is not null;

  if v_requested = 0 then raise exception 'Select at least one enrollment status'; end if;

  with requested as (
    select distinct item.assignment_id, item.is_enrolled
    from jsonb_to_recordset(p_updates) as item(assignment_id uuid, is_enrolled boolean)
    where item.assignment_id is not null and item.is_enrolled is not null
  ), changed as (
    update public.student_scholarships ss
    set is_enrolled = requested.is_enrolled,
        enrollment_verified_at = now(),
        updated_at = now()
    from requested
    where ss.id = requested.assignment_id
      and ss.archived_at is null
      and ss.term_closed_at is null
      and ss.status = 'Active'
    returning ss.id
  )
  select count(*) into v_updated from changed;

  if v_updated <> v_requested then
    raise exception 'One or more selected scholarship records are unavailable or no longer active';
  end if;

  v_actor_name := coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'preferred_username', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''),
    nullif(auth.jwt() ->> 'email', ''),
    'Admin'
  );

  insert into public.activity_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, entity_type, description
  ) values (
    auth.uid(), v_actor_name, auth.jwt() ->> 'email', 'Admin',
    'verify_enrollment', 'student_scholarship',
    v_actor_name || ' manually verified enrollment for ' || v_updated || ' selected scholarship record(s).'
  );

  return v_updated;
end;
$$;

revoke all on function public.set_selected_enrollment_statuses(jsonb) from public;
grant execute on function public.set_selected_enrollment_statuses(jsonb) to authenticated;

notify pgrst, 'reload schema';

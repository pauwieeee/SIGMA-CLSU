-- Guarantee core audit records at the database layer for every authenticated
-- admin and device. Frontend refresh/subscription code only displays these
-- durable rows; it is no longer the sole source of the audit trail.

create or replace function public.write_admin_audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_name text;
  v_action text;
  v_entity_type text;
  v_entity_id uuid;
  v_description text;
  v_student_name text;
  v_scholarship_name text;
begin
  -- Scheduled/system maintenance has no authenticated admin and should not be
  -- presented as an action performed by a person.
  if auth.uid() is null then
    return null;
  end if;

  v_actor_name := coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'preferred_username', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''),
    nullif(auth.jwt() ->> 'email', ''),
    'Admin'
  );

  if tg_table_name = 'scholarships' then
    v_entity_type := 'scholarship';
    v_entity_id := coalesce(new.id, old.id);
    if tg_op = 'INSERT' then
      v_action := 'create';
      v_description := 'Added scholarship "' || new.name || '".';
    elsif tg_op = 'DELETE' then
      v_action := 'delete';
      v_description := 'Deleted scholarship "' || old.name || '".';
    elsif old.archived_at is null and new.archived_at is not null then
      v_action := 'archive';
      v_description := 'Archived scholarship "' || new.name || '".';
    elsif old.archived_at is not null and new.archived_at is null then
      v_action := 'restore';
      v_description := 'Restored scholarship "' || new.name || '".';
    elsif old.status is distinct from new.status then
      v_action := 'update';
      v_description := 'Changed scholarship "' || new.name || '" status from "' || old.status || '" to "' || new.status || '".';
    else
      v_action := 'update';
      v_description := 'Updated scholarship "' || new.name || '".';
    end if;

  elsif tg_table_name = 'students' then
    v_entity_type := 'student';
    v_entity_id := coalesce(new.id, old.id);
    v_student_name := btrim(coalesce(new.first_name, old.first_name, '') || ' ' || coalesce(new.last_name, old.last_name, ''));
    if tg_op = 'INSERT' then
      v_action := 'create';
      v_description := 'Added student ' || v_student_name || ' (' || new.student_number || ').';
    elsif tg_op = 'DELETE' then
      v_action := 'delete';
      v_description := 'Deleted student ' || v_student_name || ' (' || old.student_number || ').';
    elsif old.archived_at is null and new.archived_at is not null then
      v_action := 'archive';
      v_description := 'Archived student ' || v_student_name || ' (' || new.student_number || ').';
    elsif old.archived_at is not null and new.archived_at is null then
      v_action := 'restore';
      v_description := 'Restored student ' || v_student_name || ' (' || new.student_number || ').';
    else
      v_action := 'update';
      v_description := 'Updated student ' || v_student_name || ' (' || new.student_number || ').';
    end if;

  elsif tg_table_name = 'student_scholarships' then
    v_entity_type := 'student_scholarship';
    -- Enrollment verification changes only is_enrolled and already writes one
    -- summary activity in apply_enrollment_verification; avoid dozens of rows.
    if tg_op = 'UPDATE' and old.status is not distinct from new.status
       and old.archived_at is not distinct from new.archived_at then
      return null;
    end if;

    v_entity_id := coalesce(new.id, old.id);
    select btrim(s.first_name || ' ' || s.last_name), scholarship.name
      into v_student_name, v_scholarship_name
    from public.students s
    join public.scholarships scholarship
      on scholarship.id = coalesce(new.scholarship_id, old.scholarship_id)
    where s.id = coalesce(new.student_id, old.student_id);

    if tg_op = 'INSERT' then
      v_action := 'create';
      v_description := 'Assigned "' || coalesce(v_scholarship_name, 'scholarship') || '" to ' || coalesce(v_student_name, 'a student') || '.';
    elsif tg_op = 'DELETE' then
      v_action := 'delete';
      v_description := 'Removed "' || coalesce(v_scholarship_name, 'scholarship') || '" from ' || coalesce(v_student_name, 'a student') || '.';
    elsif old.archived_at is null and new.archived_at is not null then
      v_action := 'archive';
      v_description := 'Archived the "' || coalesce(v_scholarship_name, 'scholarship') || '" record for ' || coalesce(v_student_name, 'a student') || '.';
    else
      v_action := 'update';
      v_description := 'Changed "' || coalesce(v_scholarship_name, 'scholarship') || '" status for ' || coalesce(v_student_name, 'a student') || ' from "' || old.status || '" to "' || new.status || '".';
    end if;

  elsif tg_table_name = 'duplicate_flags' then
    v_entity_type := 'duplicate_flag';
    if tg_op <> 'UPDATE' or old.status is not distinct from new.status then
      return null;
    end if;
    v_entity_id := new.id;
    v_action := case when new.status = 'Resolved' then 'resolve' else 'update' end;
    v_description := 'Changed duplicate case status from "' || old.status || '" to "' || new.status || '".';
  else
    return null;
  end if;

  insert into public.activity_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, entity_type, entity_id, description
  ) values (
    auth.uid(), v_actor_name, auth.jwt() ->> 'email', 'Admin',
    v_action, v_entity_type, v_entity_id, v_description
  );

  return null;
end;
$$;

drop trigger if exists trg_audit_scholarships on public.scholarships;
create trigger trg_audit_scholarships
  after insert or update or delete on public.scholarships
  for each row execute function public.write_admin_audit_trigger();

drop trigger if exists trg_audit_students on public.students;
create trigger trg_audit_students
  after insert or update or delete on public.students
  for each row execute function public.write_admin_audit_trigger();

drop trigger if exists trg_audit_student_scholarships on public.student_scholarships;
create trigger trg_audit_student_scholarships
  after insert or update or delete on public.student_scholarships
  for each row execute function public.write_admin_audit_trigger();

drop trigger if exists trg_audit_duplicate_flags on public.duplicate_flags;
create trigger trg_audit_duplicate_flags
  after update on public.duplicate_flags
  for each row execute function public.write_admin_audit_trigger();

-- If the browser also submits its richer activity description immediately
-- after the trigger, enrich the trigger row instead of inserting a duplicate.
create or replace function public.record_activity(
  p_action text,
  p_entity_type text,
  p_description text,
  p_entity_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_id uuid;
  v_actor_name text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(p_action), '') is null or nullif(btrim(p_entity_type), '') is null
     or nullif(btrim(p_description), '') is null then
    raise exception 'Activity action, entity type, and description are required';
  end if;

  select id into v_log_id
  from public.activity_logs
  where actor_id = auth.uid()
    and action = btrim(p_action)
    and entity_type = btrim(p_entity_type)
    and entity_id is not distinct from p_entity_id
    and created_at >= now() - interval '15 seconds'
  order by created_at desc
  limit 1;

  if v_log_id is not null then
    update public.activity_logs set description = btrim(p_description) where id = v_log_id;
    return v_log_id;
  end if;

  v_actor_name := coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'preferred_username', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''),
    nullif(auth.jwt() ->> 'email', ''), 'Admin'
  );
  insert into public.activity_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, entity_type, entity_id, description
  ) values (
    auth.uid(), v_actor_name, auth.jwt() ->> 'email', 'Admin',
    btrim(p_action), btrim(p_entity_type), p_entity_id, btrim(p_description)
  ) returning id into v_log_id;
  return v_log_id;
end;
$$;

revoke all on function public.write_admin_audit_trigger() from public;
revoke all on function public.record_activity(text, text, text, uuid) from public;
grant execute on function public.record_activity(text, text, text, uuid) to authenticated;

notify pgrst, 'reload schema';

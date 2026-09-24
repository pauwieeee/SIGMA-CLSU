-- Auditable, reversible student archiving. Scholarship assignments and all
-- related history remain untouched.

-- Some existing deployments were created before the actor snapshot columns
-- were introduced. Ensure the actual activity_logs table supports the fields
-- used by record_activity and the Recent Activity UI before archive/restore
-- writes an audit event.
alter table public.activity_logs
  add column if not exists actor_email text,
  add column if not exists actor_name text,
  add column if not exists actor_role text not null default 'Admin';

create index if not exists idx_activity_logs_actor_id
  on public.activity_logs(actor_id);

alter table public.students
  add column if not exists status text not null default 'Active',
  add column if not exists archived_by uuid references auth.users(id) on delete set null,
  add column if not exists archived_by_name text,
  add column if not exists archived_by_email text,
  add column if not exists archive_reason text,
  add column if not exists restored_at timestamptz,
  add column if not exists restored_by uuid references auth.users(id) on delete set null,
  add column if not exists restored_by_name text,
  add column if not exists restored_by_email text;

update public.students
set status = case when archived_at is null then 'Active' else 'Archived' end
where status is distinct from case when archived_at is null then 'Active' else 'Archived' end;

alter table public.students drop constraint if exists students_status_check;
alter table public.students add constraint students_status_check
  check (status in ('Active', 'Archived'));

create index if not exists idx_students_status on public.students(status);

create or replace function public.archive_student(p_student_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_actor_name text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select concat_ws(' ', first_name, nullif(middle_name, ''), last_name)
  into v_name from public.students where id = p_student_id for update;
  if not found then raise exception 'Student record not found'; end if;

  v_actor_name := coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'preferred_username', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''),
    nullif(auth.jwt() ->> 'email', ''), 'Admin'
  );

  update public.students set
    status = 'Archived', archived_at = now(), archived_by = auth.uid(),
    archived_by_name = v_actor_name, archived_by_email = auth.jwt() ->> 'email',
    archive_reason = nullif(btrim(p_reason), ''), updated_at = now()
  where id = p_student_id and (status <> 'Archived' or archived_at is null);

  if found then
    perform public.record_activity(
      'archive', 'student',
      'Archived student ' || v_name ||
        case when nullif(btrim(p_reason), '') is null then '.' else '. Reason: ' || btrim(p_reason) end,
      p_student_id
    );
  end if;
end;
$$;

create or replace function public.restore_student(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_actor_name text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select concat_ws(' ', first_name, nullif(middle_name, ''), last_name)
  into v_name from public.students where id = p_student_id for update;
  if not found then raise exception 'Student record not found'; end if;

  v_actor_name := coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'preferred_username', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''),
    nullif(auth.jwt() ->> 'email', ''), 'Admin'
  );

  update public.students set
    status = 'Active', archived_at = null, restored_at = now(),
    restored_by = auth.uid(), restored_by_name = v_actor_name,
    restored_by_email = auth.jwt() ->> 'email', updated_at = now()
  where id = p_student_id and (status = 'Archived' or archived_at is not null);

  if found then
    perform public.record_activity('restore', 'student', 'Restored student ' || v_name || '.', p_student_id);
  end if;
end;
$$;

revoke all on function public.archive_student(uuid, text) from public;
revoke all on function public.restore_student(uuid) from public;
grant execute on function public.archive_student(uuid, text) to authenticated;
grant execute on function public.restore_student(uuid) to authenticated;

notify pgrst, 'reload schema';

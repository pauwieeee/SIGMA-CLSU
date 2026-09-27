-- Practical administrator workflows: student history, safe scholarship
-- renewal, richer duplicate reasons, and additional notification events.

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'expiring_soon', 'duplicate_flag', 'import_complete', 'import_failed',
    'enrollment_complete', 'duplicate_review'
  ));

create or replace function public.get_student_activity_timeline(p_student_id uuid)
returns table (
  id uuid,
  occurred_at timestamptz,
  action text,
  description text,
  actor_name text,
  actor_email text,
  actor_role text,
  entity_type text
)
language sql
security definer
set search_path = public
stable
as $$
  select al.id, al.created_at, al.action, al.description,
         al.actor_name, al.actor_email, al.actor_role, al.entity_type
  from public.activity_logs al
  where (al.entity_type = 'student' and al.entity_id = p_student_id)
     or (al.entity_type = 'student_scholarship' and al.entity_id in (
       select ss.id from public.student_scholarships ss where ss.student_id = p_student_id
     ))
     or (al.entity_type = 'duplicate_flag' and al.entity_id in (
       select df.id from public.duplicate_flags df where df.student_id = p_student_id
     ))
  order by al.created_at desc;
$$;

create or replace function public.renew_student_scholarship(
  p_assignment_id uuid,
  p_academic_year text,
  p_semester text,
  p_start_date date default null,
  p_end_date date default null,
  p_status text default 'Active'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.student_scholarships%rowtype;
  v_new_id uuid;
  v_student_name text;
  v_scholarship_name text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(p_academic_year), '') is null then raise exception 'Academic year is required'; end if;
  if nullif(btrim(p_semester), '') is null then raise exception 'Semester is required'; end if;

  select * into v_source from public.student_scholarships where id = p_assignment_id;
  if not found then raise exception 'Scholarship assignment not found'; end if;

  insert into public.student_scholarships (
    student_id, scholarship_id, academic_year, semester, status,
    start_date, end_date, is_enrolled
  ) values (
    v_source.student_id, v_source.scholarship_id, btrim(p_academic_year),
    btrim(p_semester), p_status, p_start_date, p_end_date, null
  ) returning id into v_new_id;

  select concat_ws(' ', s.first_name, nullif(s.middle_name, ''), s.last_name), sc.name
  into v_student_name, v_scholarship_name
  from public.students s cross join public.scholarships sc
  where s.id = v_source.student_id and sc.id = v_source.scholarship_id;

  perform public.record_activity(
    'renew', 'student_scholarship',
    'Renewed ' || coalesce(v_scholarship_name, 'scholarship') || ' for ' ||
    coalesce(v_student_name, 'student') || ' in ' || btrim(p_academic_year) ||
    ' • ' || btrim(p_semester) || '.',
    v_new_id
  );
  return v_new_id;
exception when unique_violation then
  raise exception 'This scholarship already exists for the selected academic year and semester';
end;
$$;

create or replace function public.detect_duplicates_for_student(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.duplicate_flags (
    student_id, student_scholarship_id_a, student_scholarship_id_b,
    conflict_type, reason
  )
  select a.student_id, a.id, b.id, 'Multiple Active Scholarships',
    'Same student has 2 Active scholarships in ' || a.academic_year || ' • ' || a.semester ||
    ': "' || coalesce(sa.name, 'Unknown scholarship') || '" and "' ||
    coalesce(sb.name, 'Unknown scholarship') || '". Review the providers and assignments.'
  from public.student_scholarships a
  join public.student_scholarships b
    on b.student_id = a.student_id
   and b.academic_year = a.academic_year
   and b.semester = a.semester
   and b.id > a.id
  left join public.scholarships sa on sa.id = a.scholarship_id
  left join public.scholarships sb on sb.id = b.scholarship_id
  where a.student_id = p_student_id
    and a.status = 'Active' and b.status = 'Active'
    and a.archived_at is null and b.archived_at is null
    and a.term_closed_at is null and b.term_closed_at is null
    and not exists (
      select 1 from public.duplicate_flags df
      where ((df.student_scholarship_id_a = a.id and df.student_scholarship_id_b = b.id)
          or (df.student_scholarship_id_a = b.id and df.student_scholarship_id_b = a.id))
        and (
          df.status in ('Open', 'Under Review', 'Confirmed Valid')
          or (df.status = 'Resolved'
              and df.resolution_type in ('Approved Exception', 'False Positive')
              and coalesce(df.resolution_notes, '') not like 'Automatically corrected:%')
        )
    );
end;
$$;

revoke all on function public.get_student_activity_timeline(uuid) from public;
revoke all on function public.renew_student_scholarship(uuid, text, text, date, date, text) from public;
grant execute on function public.get_student_activity_timeline(uuid) to authenticated;
grant execute on function public.renew_student_scholarship(uuid, text, text, date, date, text) to authenticated;

notify pgrst, 'reload schema';

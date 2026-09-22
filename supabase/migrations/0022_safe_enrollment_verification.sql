-- Apply enrollment verification atomically after the administrator reviews a preview.
-- Submitted IDs without an active scholarship record are deliberately ignored.

create or replace function public.apply_enrollment_verification(
  p_academic_year text,
  p_semester text,
  p_student_numbers text[],
  p_reconcile_complete_list boolean default false
)
returns table (
  matched_students integer,
  enrolled_records integer,
  not_enrolled_records integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_numbers text[];
  v_matched integer := 0;
  v_enrolled integer := 0;
  v_not_enrolled integer := 0;
  v_actor_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_academic_year !~ '^[0-9]{4}-[0-9]{4}$' then
    raise exception 'Invalid academic year';
  end if;
  if p_semester not in ('1st Semester', '2nd Semester', 'Summer') then
    raise exception 'Invalid semester';
  end if;

  select coalesce(array_agg(distinct cleaned), array[]::text[])
  into v_numbers
  from (
    select btrim(value) as cleaned
    from unnest(coalesce(p_student_numbers, array[]::text[])) as value
    where btrim(value) <> ''
  ) normalized;

  if cardinality(v_numbers) = 0 then
    raise exception 'At least one Student ID is required';
  end if;

  select count(distinct s.student_number)
  into v_matched
  from public.student_scholarships ss
  join public.students s on s.id = ss.student_id
  join public.scholarships scholarship on scholarship.id = ss.scholarship_id
  where ss.academic_year = p_academic_year
    and ss.semester = p_semester
    and ss.status = 'Active'
    and ss.archived_at is null
    and ss.term_closed_at is null
    and scholarship.archived_at is null
    and scholarship.status in ('Active', 'Expiring Soon')
    and s.student_number = any(v_numbers);

  update public.student_scholarships ss
  set is_enrolled = true,
      enrollment_verified_at = now(),
      updated_at = now()
  from public.students s, public.scholarships scholarship
  where s.id = ss.student_id
    and scholarship.id = ss.scholarship_id
    and ss.academic_year = p_academic_year
    and ss.semester = p_semester
    and ss.status = 'Active'
    and ss.archived_at is null
    and ss.term_closed_at is null
    and scholarship.archived_at is null
    and scholarship.status in ('Active', 'Expiring Soon')
    and s.student_number = any(v_numbers);
  get diagnostics v_enrolled = row_count;

  if p_reconcile_complete_list then
    update public.student_scholarships ss
    set is_enrolled = false,
        enrollment_verified_at = now(),
        updated_at = now()
    from public.students s, public.scholarships scholarship
    where s.id = ss.student_id
      and scholarship.id = ss.scholarship_id
      and ss.academic_year = p_academic_year
      and ss.semester = p_semester
      and ss.status = 'Active'
      and ss.archived_at is null
      and ss.term_closed_at is null
      and scholarship.archived_at is null
      and scholarship.status in ('Active', 'Expiring Soon')
      and not (s.student_number = any(v_numbers));
    get diagnostics v_not_enrolled = row_count;
  end if;

  v_actor_name := coalesce(
    auth.jwt() -> 'user_metadata' ->> 'preferred_username',
    auth.jwt() -> 'user_metadata' ->> 'full_name',
    auth.jwt() ->> 'email',
    'Admin'
  );

  insert into public.activity_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, entity_type, description
  ) values (
    auth.uid(), v_actor_name, auth.jwt() ->> 'email', 'Admin',
    case when p_reconcile_complete_list then 'reconcile_enrollment' else 'verify_enrollment' end,
    'student_scholarship',
    case when p_reconcile_complete_list then
      v_actor_name || ' reconciled the complete official enrollment list for ' ||
      p_academic_year || ' ' || p_semester || '. ' ||
      cardinality(v_numbers) || ' IDs submitted, ' || v_matched ||
      ' matched, ' || (cardinality(v_numbers) - v_matched) ||
      ' had no matching active scholarship record. ' || v_enrolled ||
      ' record(s) marked Enrolled and ' || v_not_enrolled ||
      ' record(s) marked Not Enrolled.'
    else
      v_actor_name || ' verified enrollment for ' || p_academic_year || ' ' ||
      p_semester || '. ' || cardinality(v_numbers) || ' IDs submitted, ' ||
      v_matched || ' matched, ' || (cardinality(v_numbers) - v_matched) ||
      ' had no matching active scholarship record. ' || v_enrolled ||
      ' record(s) marked Enrolled. No other records changed.'
    end
  );

  return query select v_matched, v_enrolled, v_not_enrolled;
end;
$$;

revoke all on function public.apply_enrollment_verification(text, text, text[], boolean) from public;
grant execute on function public.apply_enrollment_verification(text, text, text[], boolean) to authenticated;

notify pgrst, 'reload schema';

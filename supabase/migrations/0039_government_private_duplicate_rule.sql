-- Canonical SIGMA scholarship-conflict rule:
-- Flag only the same student holding an Active Government scholarship and an
-- Active Private scholarship in the same Academic Year and Semester.

create or replace function public.detect_duplicates_for_student(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.duplicate_flags (
    student_id, student_scholarship_id_a, student_scholarship_id_b,
    conflict_type, reason_code, reason
  )
  select
    a.student_id, a.id, b.id,
    'Government and Private Scholarship Conflict',
    'MULTIPLE_ACTIVE_SAME_TERM',
    'Student has an Active Government scholarship and an Active Private scholarship during ' ||
      a.academic_year || ' • ' || a.semester || ': "' ||
      coalesce(sa.name, 'Unknown scholarship') || '" and "' ||
      coalesce(sb.name, 'Unknown scholarship') || '".'
  from public.student_scholarships a
  join public.scholarships sa on sa.id = a.scholarship_id
  join public.scholarship_categories ca on ca.id = sa.category_id
  join public.student_scholarships b
    on b.student_id = a.student_id
   and b.academic_year = a.academic_year
   and b.semester = a.semester
   and b.id > a.id
  join public.scholarships sb on sb.id = b.scholarship_id
  join public.scholarship_categories cb on cb.id = sb.category_id
  where a.student_id = p_student_id
    and a.status = 'Active' and b.status = 'Active'
    and a.archived_at is null and b.archived_at is null
    and a.term_closed_at is null and b.term_closed_at is null
    and ((ca.name = 'Government' and cb.name = 'Private')
      or (ca.name = 'Private' and cb.name = 'Government'))
    and not exists (
      select 1 from public.duplicate_flags df
      where ((df.student_scholarship_id_a = a.id and df.student_scholarship_id_b = b.id)
          or (df.student_scholarship_id_a = b.id and df.student_scholarship_id_b = a.id))
        and (df.status in ('Open', 'Under Review', 'Confirmed Valid')
          or (df.status = 'Resolved'
            and df.resolution_type in ('Approved Exception', 'False Positive')
            and coalesce(df.resolution_notes, '') not like 'Automatically corrected:%'))
    );
end;
$$;

-- Preserve invalid existing cases as resolved audit history.
update public.duplicate_flags df
set status = 'Resolved',
    resolution_type = 'False Positive',
    resolution_notes = concat_ws(' ', nullif(df.resolution_notes, ''),
      'Automatically corrected: the case does not contain both an Active Government and an Active Private scholarship in the same academic year and semester.'),
    resolved_at = coalesce(df.resolved_at, now())
where df.status in ('Open', 'Under Review', 'Confirmed Valid')
  and not exists (
    select 1
    from public.student_scholarships a
    join public.scholarships sa on sa.id = a.scholarship_id
    join public.scholarship_categories ca on ca.id = sa.category_id
    join public.student_scholarships b on b.id = df.student_scholarship_id_b
    join public.scholarships sb on sb.id = b.scholarship_id
    join public.scholarship_categories cb on cb.id = sb.category_id
    where a.id = df.student_scholarship_id_a
      and a.student_id = df.student_id and b.student_id = df.student_id
      and a.academic_year = b.academic_year and a.semester = b.semester
      and a.status = 'Active' and b.status = 'Active'
      and a.archived_at is null and b.archived_at is null
      and a.term_closed_at is null and b.term_closed_at is null
      and ((ca.name = 'Government' and cb.name = 'Private')
        or (ca.name = 'Private' and cb.name = 'Government'))
  );

-- Include qualifying combinations that existed before this migration.
do $$
declare student_row record;
begin
  for student_row in select id from public.students where archived_at is null loop
    perform public.detect_duplicates_for_student(student_row.id);
  end loop;
end;
$$;

notify pgrst, 'reload schema';

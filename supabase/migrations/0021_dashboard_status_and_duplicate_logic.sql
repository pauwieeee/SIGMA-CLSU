-- Keep enrollment, scholarship status, and data-review state independent.
-- A logical duplicate is the same student + scholarship + academic year + semester.

create or replace function public.detect_duplicates_for_student(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.duplicate_flags (student_id, student_scholarship_id_a, student_scholarship_id_b, reason)
  select a.student_id, a.id, b.id,
    'Potential duplicate: same student, scholarship, academic year, and semester'
  from public.student_scholarships a
  join public.student_scholarships b
    on b.student_id = a.student_id
   and b.scholarship_id = a.scholarship_id
   and b.academic_year = a.academic_year
   and b.semester = a.semester
   and b.id > a.id
  where a.student_id = p_student_id
    and not exists (
      select 1 from public.duplicate_flags df
      where ((df.student_scholarship_id_a = a.id and df.student_scholarship_id_b = b.id)
          or (df.student_scholarship_id_a = b.id and df.student_scholarship_id_b = a.id))
        and (df.status = 'Open' or df.resolution_type in ('Approved Exception', 'False Positive'))
    );
end;
$$;

-- Preserve old category/exclusivity flags as resolved audit history rather
-- than deleting them. Different scholarship programs are not duplicates.
update public.duplicate_flags df
set status = 'Resolved', resolution_type = 'False Positive',
    resolution_notes = coalesce(df.resolution_notes || ' ', '') ||
      'Automatically corrected: different scholarship programs are not duplicates solely because they share a category or term.',
    resolved_at = coalesce(df.resolved_at, now())
where df.status = 'Open'
  and exists (
    select 1 from public.student_scholarships a
    join public.student_scholarships b on b.id = df.student_scholarship_id_b
    where a.id = df.student_scholarship_id_a and a.scholarship_id <> b.scholarship_id
  );

create or replace view public.dashboard_stats as
select
  (select count(*) from public.students
   where archived_at is null) as total_scholars,
  (select count(*) from public.scholarships
   where archived_at is null and status = 'Active') as active_scholarships,
  (select count(*) from public.duplicate_flags where status = 'Open') as duplicate_flags_open,
  (select count(*) from public.scholarships where archived_at is null
     and end_date between current_date and current_date + interval '30 days') as expiring_soon,
  (select count(*) from public.scholarships where archived_at is null
     and end_date < current_date) as expired_scholarships,
  (select count(distinct ss.student_id) from public.student_scholarships ss
   where ss.archived_at is null and ss.term_closed_at is null and ss.is_enrolled = true) as enrolled_students,
  (select count(distinct ss.student_id) from public.student_scholarships ss
   where ss.archived_at is null and ss.term_closed_at is null and ss.is_enrolled = false
     and not exists (
       select 1 from public.student_scholarships enrolled
       where enrolled.student_id = ss.student_id
         and enrolled.archived_at is null
         and enrolled.term_closed_at is null
         and enrolled.is_enrolled = true
     )) as not_enrolled_students;

create or replace view public.scholars_per_category as
select sc.name as category_name, count(distinct ss.student_id) as scholar_count
from public.student_scholarships ss
join public.scholarships s on s.id = ss.scholarship_id
join public.scholarship_categories sc on sc.id = s.category_id
where ss.status = 'Active' and ss.archived_at is null and ss.term_closed_at is null
  and s.archived_at is null and s.status in ('Active', 'Expiring Soon')
group by sc.name;

notify pgrst, 'reload schema';

-- SIGMA: teach duplicate detection the actual scholarship-combination policy
-- described by the Product Owner, instead of flagging every pair of active
-- scholarships in a term regardless of category:
--   - two scholarships in the SAME category (e.g. two Institutional) → always
--     flagged, same as before.
--   - Government + Private → explicitly disallowed → flagged.
--   - Institutional + Government, Institutional + Private → allowed by
--     default (donor/institutional exceptions are still handled by an admin
--     resolving the flag manually if one is ever raised) → NOT flagged.

create or replace function detect_duplicates_for_student(p_student_id uuid)
returns void as $$
declare
  rec_a record;
  rec_b record;
begin
  for rec_a in
    select ss.id, ss.academic_year, ss.semester, sc.name as category_name
    from student_scholarships ss
    join scholarships s on s.id = ss.scholarship_id
    join scholarship_categories sc on sc.id = s.category_id
    where ss.student_id = p_student_id
      and ss.status = 'Active'
      and ss.archived_at is null
  loop
    for rec_b in
      select ss.id, ss.academic_year, ss.semester, sc.name as category_name
      from student_scholarships ss
      join scholarships s on s.id = ss.scholarship_id
      join scholarship_categories sc on sc.id = s.category_id
      where ss.student_id = p_student_id
        and ss.status = 'Active'
        and ss.archived_at is null
        and ss.id <> rec_a.id
        and ss.academic_year = rec_a.academic_year
        and ss.semester = rec_a.semester
        and ss.id > rec_a.id -- avoid duplicate pairs (a,b) and (b,a)
    loop
      -- Only flag same-category pairs, or the specific Government+Private
      -- combination the office says is not allowed.
      if rec_a.category_name = rec_b.category_name
        or (rec_a.category_name in ('Government', 'Private') and rec_b.category_name in ('Government', 'Private'))
      then
        insert into duplicate_flags (student_id, student_scholarship_id_a, student_scholarship_id_b, reason)
        select p_student_id, rec_a.id, rec_b.id,
          case
            when rec_a.category_name = rec_b.category_name then
              'Two ' || rec_a.category_name || ' scholarships in ' || rec_a.academic_year || ' ' || rec_a.semester
            else
              'Government and Private scholarships together in ' || rec_a.academic_year || ' ' || rec_a.semester || ' — not allowed unless the donor grants an exception'
          end
        where not exists (
          select 1 from duplicate_flags
          where status = 'Open'
            and ((student_scholarship_id_a = rec_a.id and student_scholarship_id_b = rec_b.id)
              or (student_scholarship_id_a = rec_b.id and student_scholarship_id_b = rec_a.id))
        );
      end if;
    end loop;
  end loop;
end;
$$ language plpgsql security definer;

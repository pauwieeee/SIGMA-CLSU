-- SIGMA: Duplicate detection function + dashboard views

-- ------------------------------------------------------------
-- detect_duplicates_for_student(student_id)
-- Flags any pair of ACTIVE student_scholarships for the same student,
-- in the same academic_year + semester, that do not already have an
-- open duplicate_flag between them.
-- ------------------------------------------------------------
create or replace function detect_duplicates_for_student(p_student_id uuid)
returns void as $$
declare
  rec_a record;
  rec_b record;
begin
  for rec_a in
    select id, academic_year, semester
    from student_scholarships
    where student_id = p_student_id
      and status = 'Active'
      and archived_at is null
  loop
    for rec_b in
      select id, academic_year, semester
      from student_scholarships
      where student_id = p_student_id
        and status = 'Active'
        and archived_at is null
        and id <> rec_a.id
        and academic_year = rec_a.academic_year
        and semester = rec_a.semester
        and id > rec_a.id -- avoid duplicate pairs (a,b) and (b,a)
    loop
      insert into duplicate_flags (student_id, student_scholarship_id_a, student_scholarship_id_b, reason)
      select p_student_id, rec_a.id, rec_b.id,
        'Same student holds two active scholarships in ' || rec_a.academic_year || ' ' || rec_a.semester
      where not exists (
        select 1 from duplicate_flags
        where status = 'Open'
          and ((student_scholarship_id_a = rec_a.id and student_scholarship_id_b = rec_b.id)
            or (student_scholarship_id_a = rec_b.id and student_scholarship_id_b = rec_a.id))
      );
    end loop;
  end loop;
end;
$$ language plpgsql security definer;

-- Trigger: re-run detection whenever a student_scholarships row is inserted/updated
create or replace function trg_detect_duplicates()
returns trigger as $$
begin
  perform detect_duplicates_for_student(new.student_id);
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_student_scholarships_duplicate_check on student_scholarships;
create trigger trg_student_scholarships_duplicate_check
  after insert or update on student_scholarships
  for each row execute function trg_detect_duplicates();

-- ------------------------------------------------------------
-- Dashboard summary view
-- ------------------------------------------------------------
create or replace view dashboard_stats as
select
  (select count(*) from students where archived_at is null) as total_scholars,
  (select count(*) from scholarships where status = 'Active' and archived_at is null) as active_scholarships,
  (select count(*) from duplicate_flags where status = 'Open') as duplicate_flags_open,
  (select count(*) from scholarships
     where archived_at is null
       and status <> 'Archived'
       and end_date is not null
       and end_date between current_date and current_date + interval '30 days'
  ) as expiring_soon;

-- ------------------------------------------------------------
-- Scholars per category (for bar/pie charts)
-- ------------------------------------------------------------
create or replace view scholars_per_category as
select
  sc.name as category_name,
  count(distinct ss.student_id) as scholar_count
from student_scholarships ss
join scholarships s on s.id = ss.scholarship_id
join scholarship_categories sc on sc.id = s.category_id
where ss.status = 'Active' and ss.archived_at is null
group by sc.name;

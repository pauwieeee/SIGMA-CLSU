-- SIGMA sample data: additional student_scholarships records.
-- Builds on the 71 students already imported from sample-data/sigma-sample-students.csv
-- (each currently has exactly one scholarship record, all in A.Y. 2025-2026).
-- This adds:
--   1. A prior academic year (2024-2025, both semesters) for a subset of
--      students, reusing their existing scholarship — gives the Reports &
--      Analytics "Scholars Trend by Semester / A.Y." chart real data across
--      terms instead of a single flat point.
--   2. Three students with a second, DIFFERENT active scholarship in the
--      same current term (2025-2026, 1st Semester) — the existing
--      detect_duplicates_for_student trigger will fire on insert and create
--      real duplicate_flags rows, so the Dashboard/Reports duplicate counts
--      and the Student Records "Duplicate" status reflect live data instead
--      of always reading zero.
-- Safe to re-run (unique constraint + ON CONFLICT DO NOTHING skip repeats).

-- ============================================================
-- 1. Prior-year history: reuse each student's current scholarship for
--    A.Y. 2024-2025, both semesters, for every 3rd student (~24 students).
-- ============================================================
insert into student_scholarships (student_id, scholarship_id, academic_year, semester, status, start_date, end_date)
select ss.student_id, ss.scholarship_id, '2024-2025', '1st Semester', 'Active', null, null
from student_scholarships ss
join students s on s.id = ss.student_id
where ss.academic_year = '2025-2026'
  and (row_number() over (order by s.student_number)) % 3 = 0
on conflict (student_id, scholarship_id, academic_year, semester) do nothing;

insert into student_scholarships (student_id, scholarship_id, academic_year, semester, status, start_date, end_date)
select ss.student_id, ss.scholarship_id, '2024-2025', '2nd Semester', 'Active', null, null
from student_scholarships ss
join students s on s.id = ss.student_id
where ss.academic_year = '2025-2026'
  and (row_number() over (order by s.student_number)) % 3 = 0
on conflict (student_id, scholarship_id, academic_year, semester) do nothing;

-- ============================================================
-- 2. Intentional duplicates: give 3 real students a second active
--    scholarship in the current term so the duplicate-detection trigger
--    produces genuine flags to review/resolve in the UI.
-- ============================================================
insert into student_scholarships (student_id, scholarship_id, academic_year, semester, status)
select s.id, sch.id, '2025-2026', '1st Semester', 'Active'
from students s
join scholarships sch on sch.name = 'CLSU Bithay'
where s.student_number = '23-0121' -- Reyes, Miguel — already has Academic Scholarship - University Scholarship
on conflict (student_id, scholarship_id, academic_year, semester) do nothing;

insert into student_scholarships (student_id, scholarship_id, academic_year, semester, status)
select s.id, sch.id, '2025-2026', '1st Semester', 'Active'
from students s
join scholarships sch on sch.name = 'Iskolar ng LandBank'
where s.student_number = '24-0303' -- Padilla, Charmaine — already has DA-ATI
on conflict (student_id, scholarship_id, academic_year, semester) do nothing;

insert into student_scholarships (student_id, scholarship_id, academic_year, semester, status)
select s.id, sch.id, '2025-2026', '1st Semester', 'Active'
from students s
join scholarships sch on sch.name = 'GOKONGWEI BROTHERS'
where s.student_number = '23-0506' -- Ramos, Alyssa — already has Iskolar ng LandBank
on conflict (student_id, scholarship_id, academic_year, semester) do nothing;

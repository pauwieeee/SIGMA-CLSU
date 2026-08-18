-- SIGMA fix: use the official full college/program names. Corrects
-- previously-seeded rows (renaming preserves program_id, so existing
-- students/imports keep working) rather than inserting duplicates.
-- Safe to re-run.

-- ============================================================
-- College name correction
-- ============================================================
update colleges set name = 'College of Business Administration and Accountancy', code = 'CBAA'
  where name = 'College of Business and Accountancy';

-- ============================================================
-- Program name corrections (short code -> full official title)
-- ============================================================
update programs set name = 'Bachelor of Science in Agriculture' where name = 'BS Agriculture';
update programs set name = 'Bachelor of Science in Agricultural and Biosystems Engineering' where name = 'BS Agricultural and Biosystems Engineering';
update programs set name = 'Bachelor of Science in Fisheries' where name = 'BS Fisheries';
update programs set name = 'Bachelor of Science in Food Technology' where name = 'BS Food Technology';
update programs set name = 'Bachelor of Science in Hospitality Management' where name = 'BS Hospitality Management';
update programs set name = 'Bachelor of Science in Tourism Management' where name = 'BS Tourism Management';
update programs set name = 'Bachelor of Arts in Literature' where name = 'BA Literature';
update programs set name = 'Bachelor of Arts in Social Sciences' where name = 'BA Social Sciences';
update programs set name = 'Bachelor of Arts in Filipino' where name = 'BA Filipino';
update programs set name = 'Bachelor of Arts in International Studies – Global Sustainable Development' where name = 'BA International Studies - Global Sustainable Dev';
update programs set name = 'Bachelor of Science in Development Communication' where name = 'BS Development Communication';
update programs set name = 'Bachelor of Science in Psychology' where name = 'BS Psychology';
update programs set name = 'Bachelor of Science in Accountancy' where name = 'BS Accountancy';
update programs set name = 'Bachelor of Science in Business Administration – Marketing Management' where name = 'BS Business Administration - Marketing Management';
update programs set name = 'Bachelor of Science in Business Administration – Business Economics' where name = 'BS Business Administration - Business Economics';
update programs set name = 'Bachelor of Science in Business Administration – Human Resource Management' where name = 'BS Business Administration - Human Resource Mgt';
update programs set name = 'Bachelor of Science in Entrepreneurship' where name = 'BS Entrepreneurship';
update programs set name = 'Bachelor of Science in Management Accounting' where name = 'BS Management Accounting';
update programs set name = 'Bachelor of Secondary Education – Math' where name = 'Bachelor of Secondary Education - Math';
update programs set name = 'Bachelor of Secondary Education – Filipino' where name = 'Bachelor of Secondary Education - Filipino';
update programs set name = 'Bachelor of Secondary Education – Values Education' where name = 'Bachelor of Secondary Education - Values Education';
update programs set name = 'Bachelor of Secondary Education – English' where name = 'Bachelor of Secondary Education - English';
update programs set name = 'Bachelor of Secondary Education – Science' where name = 'Bachelor of Secondary Education - Science';
update programs set name = 'Bachelor of Science in Civil Engineering' where name = 'BS Civil Engineering';
update programs set name = 'Bachelor of Science in Information Technology' where name = 'BS Information Technology';
update programs set name = 'Bachelor of Science in Chemistry' where name = 'BS Chemistry';
update programs set name = 'Bachelor of Science in Meteorology' where name = 'BS Meteorology';
update programs set name = 'Bachelor of Science in Biology – Biotechnology' where name = 'BS Biology - Biotechnology';
update programs set name = 'Bachelor of Science in Biology – Zoology' where name = 'BS Biology - Zoology';
update programs set name = 'Bachelor of Science in Biology – Botany' where name = 'BS Biology - Botany';
update programs set name = 'Bachelor of Science in Biology – Microbiology' where name = 'BS Biology - Microbiology';
update programs set name = 'Bachelor of Science in Mathematics (Computer Application Track)' where name = 'BS Mathematics (Computer Application Track)';
update programs set name = 'Bachelor of Science in Mathematics (Biomathematics)' where name = 'BS Mathematics (Biomathematics)';
update programs set name = 'Bachelor of Science in Statistics' where name = 'BS Statistics';

-- ============================================================
-- Bachelor of Technology and Livelihood Education splits into 3
-- official tracks (Home Economics / Industrial Arts / Agri-Fishery Arts).
-- The existing single row becomes the HE track; IA and AFA are added new.
-- ============================================================
update programs set name = 'Bachelor of Technology and Livelihood Education – HE'
  where name = 'Bachelor of Technology and Livelihood Education';

insert into programs (college_id, name, code, degree_level)
select c.id, p.name, p.code, 'Undergraduate'
from (values
  ('Bachelor of Technology and Livelihood Education – IA', 'BTLE-IA'),
  ('Bachelor of Technology and Livelihood Education – AFA', 'BTLE-AFA')
) as p(name, code)
cross join (select id from colleges where name = 'College of Education') c
on conflict (college_id, name) do nothing;

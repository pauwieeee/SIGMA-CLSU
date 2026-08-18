-- SIGMA seed data: colleges, programs, scholarship categories/agencies/scholarships
-- Derived from the sample record sheet. College groupings are an inferred
-- mapping from the "Degree" column — confirm/correct via the UI once live.

-- ============================================================
-- COLLEGES
-- ============================================================
insert into colleges (name, code) values
  ('College of Agriculture', 'CA'),
  ('College of Arts and Social Sciences', 'CASS'),
  ('College of Business Administration and Accountancy', 'CBAA'),
  ('College of Education', 'COED'),
  ('College of Engineering', 'COE'),
  ('College of Fisheries', 'CF'),
  ('College of Home Science and Industry', 'CHSI'),
  ('College of Science', 'CS'),
  ('College of Veterinary Science and Medicine', 'CVSM')
on conflict (name) do nothing;

-- ============================================================
-- PROGRAMS — official full titles. Graduate programs (MBA, MS Education,
-- etc.) are additional programs referenced by the sample sheet's grad
-- students, kept under their subject college even though they don't
-- appear on the official undergraduate checklist.
-- ============================================================
insert into programs (college_id, name, code, degree_level)
select c.id, p.name, p.code, p.degree_level
from (values
  ('College of Agriculture', 'Bachelor of Science in Agriculture', 'BSA', 'Undergraduate'),

  ('College of Fisheries', 'Bachelor of Science in Fisheries', 'BSF', 'Undergraduate'),

  ('College of Home Science and Industry', 'Bachelor of Science in Food Technology', 'BSFT', 'Undergraduate'),
  ('College of Home Science and Industry', 'Bachelor of Science in Hospitality Management', 'BSHM', 'Undergraduate'),
  ('College of Home Science and Industry', 'Bachelor of Science in Tourism Management', 'BSTM', 'Undergraduate'),

  ('College of Arts and Social Sciences', 'Bachelor of Arts in Literature', 'BAL', 'Undergraduate'),
  ('College of Arts and Social Sciences', 'Bachelor of Arts in Social Sciences', 'BASS', 'Undergraduate'),
  ('College of Arts and Social Sciences', 'Bachelor of Arts in Filipino', 'BAF', 'Undergraduate'),
  ('College of Arts and Social Sciences', 'Bachelor of Arts in International Studies – Global Sustainable Development', 'BAIS', 'Undergraduate'),
  ('College of Arts and Social Sciences', 'Bachelor of Science in Development Communication', 'BSDC', 'Undergraduate'),
  ('College of Arts and Social Sciences', 'Bachelor of Science in Psychology', 'BSP', 'Undergraduate'),
  ('College of Arts and Social Sciences', 'MS Development Communication', 'MSDC', 'Graduate'),

  ('College of Business Administration and Accountancy', 'Bachelor of Science in Accountancy', 'BSAcc', 'Undergraduate'),
  ('College of Business Administration and Accountancy', 'Bachelor of Science in Business Administration – Marketing Management', 'BSBA-MM', 'Undergraduate'),
  ('College of Business Administration and Accountancy', 'Bachelor of Science in Business Administration – Business Economics', 'BSBA-BE', 'Undergraduate'),
  ('College of Business Administration and Accountancy', 'Bachelor of Science in Business Administration – Human Resource Management', 'BSBA-HRM', 'Undergraduate'),
  ('College of Business Administration and Accountancy', 'Bachelor of Science in Entrepreneurship', 'BSE', 'Undergraduate'),
  ('College of Business Administration and Accountancy', 'Bachelor of Science in Management Accounting', 'BSMA', 'Undergraduate'),
  ('College of Business Administration and Accountancy', 'Master in Business Administration', 'MBA', 'Graduate'),

  ('College of Education', 'Bachelor of Physical Education', 'BPE', 'Undergraduate'),
  ('College of Education', 'Bachelor of Secondary Education – Math', 'BSED-M', 'Undergraduate'),
  ('College of Education', 'Bachelor of Secondary Education – Filipino', 'BSED-F', 'Undergraduate'),
  ('College of Education', 'Bachelor of Secondary Education – Values Education', 'BSED-V', 'Undergraduate'),
  ('College of Education', 'Bachelor of Secondary Education – English', 'BSED-E', 'Undergraduate'),
  ('College of Education', 'Bachelor of Secondary Education – Science', 'BSED-S', 'Undergraduate'),
  ('College of Education', 'Bachelor of Elementary Education', 'BEED', 'Undergraduate'),
  ('College of Education', 'Bachelor of Culture and Arts Education', 'BCAE', 'Undergraduate'),
  ('College of Education', 'Bachelor of Early Childhood Education', 'BECE', 'Undergraduate'),
  ('College of Education', 'Bachelor of Technology and Livelihood Education – HE', 'BTLE-HE', 'Undergraduate'),
  ('College of Education', 'Bachelor of Technology and Livelihood Education – IA', 'BTLE-IA', 'Undergraduate'),
  ('College of Education', 'Bachelor of Technology and Livelihood Education – AFA', 'BTLE-AFA', 'Undergraduate'),
  ('College of Education', 'Master in Language & Literature', 'MLL', 'Graduate'),
  ('College of Education', 'Master in Agri-business', 'MAB', 'Graduate'),
  ('College of Education', 'MS Education', 'MSEd', 'Graduate'),

  ('College of Engineering', 'Bachelor of Science in Agricultural and Biosystems Engineering', 'BSABE', 'Undergraduate'),
  ('College of Engineering', 'Bachelor of Science in Civil Engineering', 'BSCE', 'Undergraduate'),
  ('College of Engineering', 'Bachelor of Science in Information Technology', 'BSIT', 'Undergraduate'),

  ('College of Science', 'Bachelor of Science in Chemistry', 'BSChem', 'Undergraduate'),
  ('College of Science', 'Bachelor of Science in Meteorology', 'BSMet', 'Undergraduate'),
  ('College of Science', 'Bachelor of Science in Biology – Biotechnology', 'BSBio-Biotech', 'Undergraduate'),
  ('College of Science', 'Bachelor of Science in Biology – Zoology', 'BSBio-Zoo', 'Undergraduate'),
  ('College of Science', 'Bachelor of Science in Biology – Botany', 'BSBio-Bot', 'Undergraduate'),
  ('College of Science', 'Bachelor of Science in Biology – Microbiology', 'BSBio-Micro', 'Undergraduate'),
  ('College of Science', 'Bachelor of Science in Mathematics (Computer Application Track)', 'BSMath-CAT', 'Undergraduate'),
  ('College of Science', 'Bachelor of Science in Mathematics (Biomathematics)', 'BSMath-Bio', 'Undergraduate'),
  ('College of Science', 'Bachelor of Science in Statistics', 'BSStat', 'Undergraduate'),
  ('College of Science', 'MS Animal Science', 'MSAS', 'Graduate'),
  ('College of Science', 'MS Agricultural Economics', 'MSAE', 'Graduate'),

  ('College of Veterinary Science and Medicine', 'Doctor of Veterinary Medicine', 'DVM', 'Graduate')
) as p(college_name, name, code, degree_level)
join colleges c on c.name = p.college_name
on conflict (college_id, name) do nothing;

-- ============================================================
-- SCHOLARSHIP CATEGORIES
-- ============================================================
insert into scholarship_categories (name) values
  ('Institutional'),
  ('Government'),
  ('Private')
on conflict (name) do nothing;

-- ============================================================
-- SCHOLARSHIP AGENCIES (Government agency groupings only)
-- ============================================================
insert into scholarship_agencies (category_id, name)
select sc.id, a.name
from (values
  ('Commission on Higher Education (CHED)'),
  ('Department of Science and Technology (DOST)')
) as a(name)
cross join (select id from scholarship_categories where name = 'Government') sc
on conflict (category_id, name) do nothing;

-- ============================================================
-- SCHOLARSHIPS
-- ============================================================

-- Institutional (standalone, no agency)
insert into scholarships (category_id, agency_id, name)
select sc.id, null, s.name
from (values
  ('Academic Scholarship - College Scholarship'),
  ('Academic Scholarship - University Scholarship'),
  ('CAT Top 20 Qualifiers (BR Res. No. 37-2002)'),
  ('Children of Staff Members'),
  ('CLSU Collegian Staffer'),
  ('CLSU Supreme Student Council'),
  ('ROTC Officers'),
  ('CLSU Bithay'),
  ('CLSU Maestro'),
  ('CLSU Tanglaw'),
  ('Full Scholarship - Varsity'),
  ('Training Pool - Varsity'),
  ('CLSU Faculty & Staff Development Program')
) as s(name)
cross join (select id from scholarship_categories where name = 'Institutional') sc
on conflict (category_id, name) do nothing;

-- Government - standalone (no agency group)
insert into scholarships (category_id, agency_id, name)
select sc.id, null, s.name
from (values
  ('BFAR Scholarship'),
  ('DA-ATI'),
  ('Iskolar ng LandBank'),
  ('GAD Financial Assistance Program')
) as s(name)
cross join (select id from scholarship_categories where name = 'Government') sc
on conflict (category_id, name) do nothing;

-- Government - CHED agency group (per official "List of Scholarships":
-- TDP, TES, ACEF-GIAHEP, and CHED-Estatiskolar are all CHED sub-programs)
insert into scholarships (category_id, agency_id, name)
select sc.id, ag.id, s.name
from (values
  ('CHED Tulong Dunong Program (TDP)'),
  ('CHED Tertiary Education Subsidy (TES)'),
  ('Agricultural Competitiveness Enhancement Fund - GIAHEP'),
  ('CHED-Estatiskolar'),
  ('CHED Sikap')
) as s(name)
cross join (select id from scholarship_categories where name = 'Government') sc
join scholarship_agencies ag on ag.name = 'Commission on Higher Education (CHED)' and ag.category_id = sc.id
on conflict (category_id, name) do nothing;

-- Government - DOST agency group (DOST-SEI undergrad is also a DOST sub-program)
insert into scholarships (category_id, agency_id, name)
select sc.id, ag.id, s.name
from (values
  ('DOST-SEI (undergrad)'),
  ('DOST-ASTHRDP-NSC'),
  ('DOST-SEI-CBPSME'),
  ('DOST-ERDT')
) as s(name)
cross join (select id from scholarship_categories where name = 'Government') sc
join scholarship_agencies ag on ag.name = 'Department of Science and Technology (DOST)' and ag.category_id = sc.id
on conflict (category_id, name) do nothing;

-- Private (standalone)
insert into scholarships (category_id, agency_id, name)
select sc.id, null, s.name
from (values
  ('Bounty Cares Foundation Inc.'),
  ('Crop Protection Association of the Philippines (CPAP)'),
  ('GOKONGWEI BROTHERS'),
  ('Pilipinas Shell Foundation Inc. (Medical Scholarship Program)'),
  ('Philchema Inc'),
  ('Philippine Development Foundation (PhilDev)'),
  ('SANTEH'),
  ('UNAHCO'),
  ('Vicente B Bello Scholarship'),
  ('ZOETIS')
) as s(name)
cross join (select id from scholarship_categories where name = 'Private') sc
on conflict (category_id, name) do nothing;

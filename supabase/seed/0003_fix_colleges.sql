-- SIGMA fix: align colleges with the official CLSU list (9 colleges).
-- Corrects names, adds the 2 missing colleges, and retires the invented
-- "Graduate School" college — graduate programs belong under their subject
-- college, not a separate one. Safe to re-run.

-- ============================================================
-- 1. Rename colleges to official names
-- ============================================================
update colleges set name = 'College of Arts and Social Sciences', code = 'CASS'
  where name = 'College of Arts and Sciences';

update colleges set name = 'College of Business and Accountancy', code = 'CBA'
  where name = 'College of Business Administration and Accountancy';

-- ============================================================
-- 2. Add the 2 missing colleges
-- ============================================================
insert into colleges (name, code) values
  ('College of Fisheries', 'CF'),
  ('College of Home Science and Industry', 'CHSI')
on conflict (name) do nothing;

-- ============================================================
-- 3. Move BS Fisheries into College of Fisheries
-- ============================================================
update programs p
set college_id = c.id
from colleges c
where c.name = 'College of Fisheries'
  and p.name = 'BS Fisheries';

-- ============================================================
-- 4. Move Food Technology / Hospitality / Tourism into
--    College of Home Science and Industry
-- ============================================================
update programs p
set college_id = c.id
from colleges c
where c.name = 'College of Home Science and Industry'
  and p.name in ('BS Food Technology', 'BS Hospitality Management', 'BS Tourism Management');

-- ============================================================
-- 5. Reassign every program still under the invented "Graduate School"
--    to its proper subject college, then remove that college.
-- ============================================================
update programs p
set college_id = c.id
from colleges c
where c.name = 'College of Business and Accountancy'
  and p.name = 'Master in Business Administration';

update programs p
set college_id = c.id
from colleges c
where c.name = 'College of Education'
  and p.name in ('Master in Language & Literature', 'Master in Agri-business', 'MS Education');

update programs p
set college_id = c.id
from colleges c
where c.name = 'College of Arts and Social Sciences'
  and p.name = 'MS Development Communication';

update programs p
set college_id = c.id
from colleges c
where c.name = 'College of Science'
  and p.name in ('MS Animal Science', 'MS Agricultural Economics');

delete from colleges where name = 'Graduate School';

-- SIGMA fix: Bachelor of Science in Agricultural and Biosystems Engineering
-- belongs under College of Engineering, not College of Agriculture, per the
-- official CLSU course list. Safe to re-run.

update programs p
set college_id = c.id
from colleges c
where c.name = 'College of Engineering'
  and p.name = 'Bachelor of Science in Agricultural and Biosystems Engineering';

-- SIGMA fix: ACEF-GIAHEP, CHED-Estatiskolar, and DOST-SEI (undergrad) were
-- seeded as standalone Government scholarships, but the official "List of
-- Scholarships" groups them under the CHED / DOST agencies. This corrects
-- rows already inserted by 0001_reference_data.sql. Safe to re-run.

update scholarships s
set agency_id = ag.id
from scholarship_agencies ag
where ag.name = 'Commission on Higher Education (CHED)'
  and s.category_id = ag.category_id
  and s.name in ('Agricultural Competitiveness Enhancement Fund - GIAHEP', 'CHED-Estatiskolar');

update scholarships s
set agency_id = ag.id
from scholarship_agencies ag
where ag.name = 'Department of Science and Technology (DOST)'
  and s.category_id = ag.category_id
  and s.name = 'DOST-SEI (undergrad)';

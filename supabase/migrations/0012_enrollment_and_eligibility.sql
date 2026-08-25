-- SIGMA: fields to replace two more manual steps described by the Product
-- Owner (see docs/ case study interview) — VLOOKUP-based enrollment
-- verification against the Registrar's list, and one-by-one manual GPA /
-- unit-load eligibility checking for academic scholarships.

alter table student_scholarships
  add column if not exists is_enrolled boolean,
  add column if not exists enrollment_verified_at timestamptz,
  add column if not exists units_enrolled integer;

alter table scholarships
  add column if not exists min_gwa numeric(3, 2),
  add column if not exists min_units integer;

comment on column student_scholarships.is_enrolled is
  'null = not yet verified this term; true/false set by the Verify Enrollment action.';

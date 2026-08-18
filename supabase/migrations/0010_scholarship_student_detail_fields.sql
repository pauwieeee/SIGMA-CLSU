-- SIGMA: fields that were designed in the high-fidelity mockups (Add/Edit
-- Scholarship record, Student profile) but never added to the schema.

alter table scholarships
  add column if not exists level text,
  add column if not exists qualifications text,
  add column if not exists application_requirements text,
  add column if not exists benefits_amount text,
  add column if not exists coverage_deadline text,
  add column if not exists contact_person text,
  add column if not exists contact_email text;

alter table students
  add column if not exists gwa numeric(3, 2),
  add column if not exists participation_org text;

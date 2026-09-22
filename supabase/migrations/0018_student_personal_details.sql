-- Optional personal details used by the individual Add Student workflow.
-- Existing imported records remain valid because every new column is nullable.

alter table students
  add column if not exists middle_name text,
  add column if not exists suffix text,
  add column if not exists date_of_birth date,
  add column if not exists sex text
    check (sex is null or sex in ('Female', 'Male', 'Prefer not to say'));


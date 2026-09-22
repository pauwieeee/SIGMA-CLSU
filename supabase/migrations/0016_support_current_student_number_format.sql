-- Accept both historical SIGMA IDs (YY-NNNN) and the current Registrar
-- export format (YYYY-NNNNN-AA, e.g. 2023-04512-MN).

alter table public.students
  drop constraint if exists students_student_number_check;

alter table public.students
  add constraint students_student_number_check
  check (
    student_number ~ '^([0-9]{2}-[0-9]{4}|[0-9]{4}-[0-9]{5}-[A-Z]{2})$'
  );

comment on column public.students.student_number is
  'Accepts historical YY-NNNN and current YYYY-NNNNN-AA CLSU formats.';

notify pgrst, 'reload schema';

-- Canonical system-wide totals. Student totals always count student profiles,
-- never joined scholarship-assignment rows, so multiple scholarships cannot
-- inflate the number shown by the application.
create or replace view public.system_counts as
select
  (select count(*) from public.students where archived_at is null) as active_students,
  (select count(*) from public.students where archived_at is not null) as archived_students,
  (select count(*) from public.students) as all_students,
  (select count(*) from public.student_scholarships where archived_at is null) as scholarship_assignments,
  (select count(*) from public.duplicate_flags where status in ('Open', 'Under Review')) as open_duplicate_flags;

grant select on public.system_counts to authenticated;
notify pgrst, 'reload schema';

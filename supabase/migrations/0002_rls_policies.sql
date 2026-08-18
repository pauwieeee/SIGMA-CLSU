-- SIGMA: Row Level Security
-- Single "admin" role for v1 — every authenticated user is a provisioned admin.
-- Accounts are created manually (Supabase dashboard / SQL), no public signup.
-- Policies are written per-table so adding Staff/Viewer roles later only
-- means tightening these conditions, not restructuring them.

alter table colleges enable row level security;
alter table programs enable row level security;
alter table students enable row level security;
alter table scholarship_categories enable row level security;
alter table scholarship_agencies enable row level security;
alter table scholarships enable row level security;
alter table student_scholarships enable row level security;
alter table duplicate_flags enable row level security;
alter table activity_logs enable row level security;
alter table notifications enable row level security;
alter table import_batches enable row level security;

-- Reference/lookup tables: readable and writable by any authenticated admin
create policy "colleges_all_authenticated" on colleges
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "programs_all_authenticated" on programs
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "scholarship_categories_all_authenticated" on scholarship_categories
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "scholarship_agencies_all_authenticated" on scholarship_agencies
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "scholarships_all_authenticated" on scholarships
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Core records
create policy "students_all_authenticated" on students
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "student_scholarships_all_authenticated" on student_scholarships
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "duplicate_flags_all_authenticated" on duplicate_flags
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Logs & notifications: readable by all admins, writes generally come from
-- server-side (Edge Functions / triggers) using the service role, but allow
-- authenticated inserts too since there is no separate backend for activity logging yet.
create policy "activity_logs_select_authenticated" on activity_logs
  for select using (auth.role() = 'authenticated');

create policy "activity_logs_insert_authenticated" on activity_logs
  for insert with check (auth.role() = 'authenticated');

create policy "notifications_all_authenticated" on notifications
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "import_batches_all_authenticated" on import_batches
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

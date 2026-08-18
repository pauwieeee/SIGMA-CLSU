-- SIGMA: Scholarship Information and Grants Management Analytics System
-- Initial schema

create extension if not exists "pgcrypto";

-- ============================================================
-- COLLEGES & PROGRAMS
-- ============================================================

create table colleges (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table programs (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references colleges(id) on delete restrict,
  name text not null,
  code text,
  degree_level text not null default 'Undergraduate'
    check (degree_level in ('Undergraduate', 'Graduate')),
  created_at timestamptz not null default now(),
  unique (college_id, name)
);

create index idx_programs_college_id on programs(college_id);

-- ============================================================
-- STUDENTS
-- ============================================================

create table students (
  id uuid primary key default gen_random_uuid(),
  student_number text not null unique
    check (student_number ~ '^[0-9]{2}-[0-9]{4}$'),
  last_name text not null,
  first_name text not null,
  middle_initial text,
  program_id uuid not null references programs(id) on delete restrict,
  yr_level text not null
    check (yr_level in ('1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', 'Graduate')),
  address text,
  contact_number text,
  email text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_students_program_id on students(program_id);
create index idx_students_last_name on students(last_name);
create index idx_students_archived_at on students(archived_at);

-- ============================================================
-- SCHOLARSHIP CATEGORIES, AGENCIES, SCHOLARSHIPS
-- ============================================================

create table scholarship_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
    check (name in ('Institutional', 'Government', 'Private')),
  created_at timestamptz not null default now()
);

create table scholarship_agencies (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references scholarship_categories(id) on delete restrict,
  name text not null,
  created_at timestamptz not null default now(),
  unique (category_id, name)
);

create index idx_agencies_category_id on scholarship_agencies(category_id);

create table scholarships (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references scholarship_categories(id) on delete restrict,
  agency_id uuid references scholarship_agencies(id) on delete set null,
  name text not null,
  code text,
  description text,
  status text not null default 'Active'
    check (status in ('Active', 'Expiring Soon', 'Inactive', 'Archived')),
  start_date date,
  end_date date,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, name)
);

create index idx_scholarships_category_id on scholarships(category_id);
create index idx_scholarships_agency_id on scholarships(agency_id);
create index idx_scholarships_status on scholarships(status);
create index idx_scholarships_end_date on scholarships(end_date);

-- ============================================================
-- STUDENT SCHOLARSHIPS (join table, term-scoped)
-- ============================================================

create table student_scholarships (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  scholarship_id uuid not null references scholarships(id) on delete restrict,
  academic_year text not null, -- e.g. '2025-2026'
  semester text not null
    check (semester in ('1st Semester', '2nd Semester', 'Summer')),
  status text not null default 'Active'
    check (status in ('Active', 'For Renewal', 'Documents Incomplete', 'Pending Verification', 'Inactive')),
  start_date date,
  end_date date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, scholarship_id, academic_year, semester)
);

create index idx_student_scholarships_student_id on student_scholarships(student_id);
create index idx_student_scholarships_scholarship_id on student_scholarships(scholarship_id);
create index idx_student_scholarships_term on student_scholarships(academic_year, semester);
create index idx_student_scholarships_status on student_scholarships(status);

-- ============================================================
-- DUPLICATE FLAGS
-- ============================================================

create table duplicate_flags (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  student_scholarship_id_a uuid not null references student_scholarships(id) on delete cascade,
  student_scholarship_id_b uuid not null references student_scholarships(id) on delete cascade,
  reason text not null,
  status text not null default 'Open'
    check (status in ('Open', 'Resolved')),
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (student_scholarship_id_a <> student_scholarship_id_b)
);

create index idx_duplicate_flags_student_id on duplicate_flags(student_id);
create index idx_duplicate_flags_status on duplicate_flags(status);

-- ============================================================
-- ACTIVITY LOGS & NOTIFICATIONS
-- ============================================================

create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  description text not null,
  created_at timestamptz not null default now()
);

create index idx_activity_logs_created_at on activity_logs(created_at desc);
create index idx_activity_logs_entity on activity_logs(entity_type, entity_id);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null
    check (type in ('expiring_soon', 'duplicate_flag', 'import_complete')),
  title text not null,
  message text not null,
  is_read boolean not null default false,
  related_entity_id uuid,
  created_at timestamptz not null default now()
);

create index idx_notifications_is_read on notifications(is_read);
create index idx_notifications_created_at on notifications(created_at desc);

-- ============================================================
-- IMPORT BATCHES
-- ============================================================

create table import_batches (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  imported_by uuid references auth.users(id),
  row_count integer not null default 0,
  error_count integer not null default 0,
  status text not null default 'Processing'
    check (status in ('Processing', 'Completed', 'Failed')),
  error_log jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- updated_at trigger helper
-- ============================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_students_updated_at before update on students
  for each row execute function set_updated_at();

create trigger trg_scholarships_updated_at before update on scholarships
  for each row execute function set_updated_at();

create trigger trg_student_scholarships_updated_at before update on student_scholarships
  for each row execute function set_updated_at();

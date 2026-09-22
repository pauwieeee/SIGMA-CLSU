-- Archive a completed academic term without deleting its scholarship history.

alter table public.duplicate_flags
  add column if not exists resolution_type text,
  add column if not exists resolution_notes text,
  add column if not exists resolved_by_email text;

alter table public.duplicate_flags
  drop constraint if exists duplicate_flags_resolution_type_check;

alter table public.duplicate_flags
  add constraint duplicate_flags_resolution_type_check
  check (
    resolution_type is null
    or resolution_type in (
      'Scholarship Deactivated',
      'Record Corrected',
      'Duplicate Entry Removed',
      'Approved Exception',
      'False Positive',
      'Semester Closed',
      'Other'
    )
  );

create table if not exists public.academic_term_closures (
  id uuid primary key default gen_random_uuid(),
  academic_year text not null,
  semester text not null,
  closed_by uuid references auth.users(id),
  closed_by_email text,
  assignments_archived integer not null default 0,
  duplicate_flags_resolved integer not null default 0,
  closed_at timestamptz not null default now(),
  unique (academic_year, semester)
);

alter table public.academic_term_closures enable row level security;

drop policy if exists "academic_term_closures_select_authenticated" on public.academic_term_closures;
create policy "academic_term_closures_select_authenticated"
  on public.academic_term_closures
  for select to authenticated
  using (true);

create or replace function public.close_academic_term(
  p_academic_year text,
  p_semester text
)
returns table (
  assignments_archived integer,
  duplicate_flags_resolved integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_archived integer := 0;
  v_resolved integer := 0;
begin
  if p_academic_year !~ '^[0-9]{4}-[0-9]{4}$' then
    raise exception 'Invalid academic year';
  end if;

  if p_semester not in ('1st Semester', '2nd Semester', 'Summer') then
    raise exception 'Invalid semester';
  end if;

  update public.duplicate_flags df
  set
    status = 'Resolved',
    resolution_type = 'Semester Closed',
    resolution_notes = 'Automatically resolved when ' || p_academic_year || ' ' || p_semester || ' was closed and archived.',
    resolved_by = auth.uid(),
    resolved_by_email = auth.jwt() ->> 'email',
    resolved_at = now()
  where df.status = 'Open'
    and exists (
      select 1
      from public.student_scholarships ss
      where ss.id in (df.student_scholarship_id_a, df.student_scholarship_id_b)
        and ss.academic_year = p_academic_year
        and ss.semester = p_semester
    );
  get diagnostics v_resolved = row_count;

  update public.student_scholarships
  set
    status = 'Inactive',
    archived_at = now(),
    updated_at = now()
  where academic_year = p_academic_year
    and semester = p_semester
    and archived_at is null;
  get diagnostics v_archived = row_count;

  insert into public.academic_term_closures (
    academic_year,
    semester,
    closed_by,
    closed_by_email,
    assignments_archived,
    duplicate_flags_resolved
  )
  values (
    p_academic_year,
    p_semester,
    auth.uid(),
    auth.jwt() ->> 'email',
    v_archived,
    v_resolved
  )
  on conflict (academic_year, semester) do update
  set
    closed_by = excluded.closed_by,
    closed_by_email = excluded.closed_by_email,
    assignments_archived = public.academic_term_closures.assignments_archived + excluded.assignments_archived,
    duplicate_flags_resolved = public.academic_term_closures.duplicate_flags_resolved + excluded.duplicate_flags_resolved,
    closed_at = now();

  return query select v_archived, v_resolved;
end;
$$;

revoke all on function public.close_academic_term(text, text) from public;
grant execute on function public.close_academic_term(text, text) to authenticated;

notify pgrst, 'reload schema';

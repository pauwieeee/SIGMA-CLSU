-- Flag every pair of active scholarship assignments held by one student in
-- the same academic term. A flag starts a review; it never changes or deletes
-- either scholarship automatically.

alter table public.duplicate_flags
  add column if not exists conflict_type text not null default 'Overlapping Grant',
  add column if not exists review_notes text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_by_email text,
  add column if not exists reviewed_at timestamptz;

alter table public.duplicate_flags drop constraint if exists duplicate_flags_status_check;
alter table public.duplicate_flags add constraint duplicate_flags_status_check
  check (status in ('Open', 'Under Review', 'Resolved', 'Confirmed Valid'));

create table if not exists public.duplicate_flag_reviews (
  id uuid primary key default gen_random_uuid(),
  duplicate_flag_id uuid not null references public.duplicate_flags(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  student_scholarship_id_a uuid not null references public.student_scholarships(id) on delete cascade,
  student_scholarship_id_b uuid not null references public.student_scholarships(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null,
  reviewer_email text,
  previous_status text not null,
  new_status text not null,
  decision text not null,
  notes text not null,
  created_at timestamptz not null default now()
);

alter table public.duplicate_flag_reviews enable row level security;
drop policy if exists duplicate_flag_reviews_all_authenticated on public.duplicate_flag_reviews;
create policy duplicate_flag_reviews_all_authenticated on public.duplicate_flag_reviews
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create index if not exists idx_duplicate_flag_reviews_flag
  on public.duplicate_flag_reviews(duplicate_flag_id, created_at desc);

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'duplicate_flags'
  ) then
    alter publication supabase_realtime add table public.duplicate_flags;
  end if;
end $$;

create or replace function public.detect_duplicates_for_student(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.duplicate_flags (
    student_id, student_scholarship_id_a, student_scholarship_id_b,
    conflict_type, reason
  )
  select
    a.student_id, a.id, b.id, 'Overlapping Grant',
    'Potential Scholarship Conflict: This student has multiple active scholarships in ' ||
      a.academic_year || ' ' || a.semester || '. Please review the records.'
  from public.student_scholarships a
  join public.student_scholarships b
    on b.student_id = a.student_id
   and b.academic_year = a.academic_year
   and b.semester = a.semester
   and b.id > a.id
  where a.student_id = p_student_id
    and a.status = 'Active' and b.status = 'Active'
    and a.archived_at is null and b.archived_at is null
    and a.term_closed_at is null and b.term_closed_at is null
    and not exists (
      select 1 from public.duplicate_flags df
      where ((df.student_scholarship_id_a = a.id and df.student_scholarship_id_b = b.id)
          or (df.student_scholarship_id_a = b.id and df.student_scholarship_id_b = a.id))
        and (
          df.status in ('Open', 'Under Review', 'Confirmed Valid')
          or (
            df.status = 'Resolved'
            and df.resolution_type in ('Approved Exception', 'False Positive')
            and coalesce(df.resolution_notes, '') not like 'Automatically corrected:%'
          )
        )
    );
end;
$$;

create or replace function public.review_duplicate_flag(
  p_flag_id uuid,
  p_new_status text,
  p_decision text,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_flag public.duplicate_flags%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_new_status not in ('Under Review', 'Resolved', 'Confirmed Valid') then raise exception 'Invalid review status'; end if;
  if nullif(btrim(p_decision), '') is null then raise exception 'Review decision is required'; end if;
  if nullif(btrim(p_notes), '') is null then raise exception 'Review notes are required'; end if;

  select * into v_flag from public.duplicate_flags where id = p_flag_id for update;
  if not found then raise exception 'Conflict record not found'; end if;

  insert into public.duplicate_flag_reviews (
    duplicate_flag_id, student_id, student_scholarship_id_a,
    student_scholarship_id_b, reviewer_id, reviewer_email,
    previous_status, new_status, decision, notes
  ) values (
    v_flag.id, v_flag.student_id, v_flag.student_scholarship_id_a,
    v_flag.student_scholarship_id_b, auth.uid(), auth.jwt() ->> 'email',
    v_flag.status, p_new_status, btrim(p_decision), btrim(p_notes)
  );

  update public.duplicate_flags set
    status = p_new_status,
    review_notes = btrim(p_notes), reviewed_by = auth.uid(),
    reviewed_by_email = auth.jwt() ->> 'email', reviewed_at = now(),
    resolution_type = case when p_new_status in ('Resolved', 'Confirmed Valid') then btrim(p_decision) else resolution_type end,
    resolution_notes = case when p_new_status in ('Resolved', 'Confirmed Valid') then btrim(p_notes) else resolution_notes end,
    resolved_by = case when p_new_status in ('Resolved', 'Confirmed Valid') then auth.uid() else resolved_by end,
    resolved_by_email = case when p_new_status in ('Resolved', 'Confirmed Valid') then auth.jwt() ->> 'email' else resolved_by_email end,
    resolved_at = case when p_new_status in ('Resolved', 'Confirmed Valid') then now() else resolved_at end
  where id = p_flag_id;

  perform public.record_activity(
    case when p_new_status = 'Resolved' then 'resolve' else 'update' end,
    'duplicate_flag',
    'Changed scholarship conflict from "' || v_flag.status || '" to "' || p_new_status || '": ' || btrim(p_decision) || '.',
    p_flag_id
  );
end;
$$;

revoke all on function public.review_duplicate_flag(uuid, text, text, text) from public;
grant execute on function public.review_duplicate_flag(uuid, text, text, text) to authenticated;

-- Find conflicts that existed before this migration.
do $$ declare student_row record; begin
  for student_row in select id from public.students where archived_at is null loop
    perform public.detect_duplicates_for_student(student_row.id);
  end loop;
end $$;

notify pgrst, 'reload schema';

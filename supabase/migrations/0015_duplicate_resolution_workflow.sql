-- Add an auditable resolution workflow for duplicate scholarship flags.

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
      'Other'
    )
  );

-- Replace duplicate detection so an approved exception or confirmed false
-- positive for the same pair is not reopened during a later full re-scan.
create or replace function public.detect_duplicates_for_student(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec_a record;
  rec_b record;
begin
  for rec_a in
    select ss.id, ss.academic_year, ss.semester, sc.name as category_name
    from public.student_scholarships ss
    join public.scholarships s on s.id = ss.scholarship_id
    join public.scholarship_categories sc on sc.id = s.category_id
    where ss.student_id = p_student_id
      and ss.status = 'Active'
      and ss.archived_at is null
  loop
    for rec_b in
      select ss.id, ss.academic_year, ss.semester, sc.name as category_name
      from public.student_scholarships ss
      join public.scholarships s on s.id = ss.scholarship_id
      join public.scholarship_categories sc on sc.id = s.category_id
      where ss.student_id = p_student_id
        and ss.status = 'Active'
        and ss.archived_at is null
        and ss.id <> rec_a.id
        and ss.academic_year = rec_a.academic_year
        and ss.semester = rec_a.semester
        and ss.id > rec_a.id
    loop
      if rec_a.category_name = rec_b.category_name
        or (
          rec_a.category_name in ('Government', 'Private')
          and rec_b.category_name in ('Government', 'Private')
        )
      then
        insert into public.duplicate_flags (
          student_id,
          student_scholarship_id_a,
          student_scholarship_id_b,
          reason
        )
        select
          p_student_id,
          rec_a.id,
          rec_b.id,
          case
            when rec_a.category_name = rec_b.category_name then
              'Two ' || rec_a.category_name || ' scholarships in ' || rec_a.academic_year || ' ' || rec_a.semester
            else
              'Government and Private scholarships together in ' || rec_a.academic_year || ' ' || rec_a.semester || ' — not allowed unless the donor grants an exception'
          end
        where not exists (
          select 1
          from public.duplicate_flags df
          where (
            (df.student_scholarship_id_a = rec_a.id and df.student_scholarship_id_b = rec_b.id)
            or (df.student_scholarship_id_a = rec_b.id and df.student_scholarship_id_b = rec_a.id)
          )
          and (
            df.status = 'Open'
            or (
              df.status = 'Resolved'
              and df.resolution_type in ('Approved Exception', 'False Positive')
            )
          )
        );
      end if;
    end loop;
  end loop;
end;
$$;

-- Keep the Reports comparison consistent with the large count: both now
-- measure open cases rather than mixing open and resolved history.
create or replace function public.get_duplicate_flag_trend()
returns table (
  current_term text,
  previous_term text,
  current_count bigint,
  previous_count bigint,
  diff bigint,
  has_previous boolean
)
language plpgsql
stable
set search_path = public
as $$
declare
  v_current_ay text;
  v_current_sem text;
  v_previous_ay text;
  v_previous_sem text;
  v_current_count bigint;
  v_previous_count bigint;
begin
  select ss.academic_year, ss.semester
  into v_current_ay, v_current_sem
  from public.duplicate_flags df
  join public.student_scholarships ss on ss.id = df.student_scholarship_id_a
  where df.status = 'Open'
  order by
    ss.academic_year desc,
    case ss.semester when 'Summer' then 3 when '2nd Semester' then 2 else 1 end desc
  limit 1;

  if v_current_ay is null then
    return query select null::text, null::text, 0::bigint, 0::bigint, 0::bigint, false;
    return;
  end if;

  select count(*) into v_current_count
  from public.duplicate_flags df
  join public.student_scholarships ss on ss.id = df.student_scholarship_id_a
  where df.status = 'Open'
    and ss.academic_year = v_current_ay
    and ss.semester = v_current_sem;

  select ss.academic_year, ss.semester
  into v_previous_ay, v_previous_sem
  from public.duplicate_flags df
  join public.student_scholarships ss on ss.id = df.student_scholarship_id_a
  where df.status = 'Open'
    and (
      ss.academic_year < v_current_ay
      or (
        ss.academic_year = v_current_ay
        and case ss.semester when 'Summer' then 3 when '2nd Semester' then 2 else 1 end
          < case v_current_sem when 'Summer' then 3 when '2nd Semester' then 2 else 1 end
      )
    )
  order by
    ss.academic_year desc,
    case ss.semester when 'Summer' then 3 when '2nd Semester' then 2 else 1 end desc
  limit 1;

  if v_previous_ay is null then
    return query select
      v_current_ay || ' ' || v_current_sem,
      null::text,
      v_current_count,
      0::bigint,
      0::bigint,
      false;
    return;
  end if;

  select count(*) into v_previous_count
  from public.duplicate_flags df
  join public.student_scholarships ss on ss.id = df.student_scholarship_id_a
  where df.status = 'Open'
    and ss.academic_year = v_previous_ay
    and ss.semester = v_previous_sem;

  return query select
    v_current_ay || ' ' || v_current_sem,
    v_previous_ay || ' ' || v_previous_sem,
    v_current_count,
    v_previous_count,
    v_current_count - v_previous_count,
    true;
end;
$$;

grant execute on function public.get_duplicate_flag_trend() to authenticated;

notify pgrst, 'reload schema';

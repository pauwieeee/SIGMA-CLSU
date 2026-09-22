-- Preserve semester history and expire scholarships only from their actual end date.

alter table public.student_scholarships
  add column if not exists term_closed_at timestamptz;

comment on column public.student_scholarships.term_closed_at is
  'Set when the academic term is closed. The assignment remains queryable and its status is preserved.';

alter table public.scholarships
  drop constraint if exists scholarships_status_check;

alter table public.scholarships
  add constraint scholarships_status_check
  check (status in ('Active', 'Expiring Soon', 'Expired', 'Inactive', 'Archived'));

-- This function is also called by the existing daily pg_cron job created in
-- migration 0008. Expiring Soon and Expired are based solely on end_date.
create or replace function public.flag_expiring_scholarships()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed integer := 0;
begin
  with changed as (
    update public.scholarships
    set
      status = case
        when end_date < current_date then 'Expired'
        when end_date <= current_date + interval '30 days' then 'Expiring Soon'
        when status in ('Expired', 'Expiring Soon') then 'Active'
        else status
      end,
      is_expiring_soon = end_date between current_date and current_date + interval '30 days',
      updated_at = now()
    where archived_at is null
      and status not in ('Archived', 'Inactive')
      and end_date is not null
      and (
        status is distinct from case
          when end_date < current_date then 'Expired'
          when end_date <= current_date + interval '30 days' then 'Expiring Soon'
          when status in ('Expired', 'Expiring Soon') then 'Active'
          else status
        end
        or is_expiring_soon is distinct from
          (end_date between current_date and current_date + interval '30 days')
      )
    returning id
  )
  select count(*) into v_changed from changed;

  update public.scholarships
  set is_expiring_soon = false, updated_at = now()
  where is_expiring_soon = true
    and (archived_at is not null or status in ('Archived', 'Inactive') or end_date is null);

  insert into public.cron_run_logs (job_name, records_affected, detail)
  values ('flag_expiring_scholarships', v_changed, v_changed || ' expiration status(es) refreshed');
end;
$$;

create or replace function public.refresh_scholarship_expiration_on_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.archived_at is null and new.status not in ('Archived', 'Inactive') and new.end_date is not null then
    if new.end_date < current_date then
      new.status := 'Expired';
      new.is_expiring_soon := false;
    elsif new.end_date <= current_date + interval '30 days' then
      new.status := 'Expiring Soon';
      new.is_expiring_soon := true;
    elsif new.status in ('Expired', 'Expiring Soon') then
      new.status := 'Active';
      new.is_expiring_soon := false;
    end if;
  elsif new.end_date is null then
    new.is_expiring_soon := false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_refresh_scholarship_expiration on public.scholarships;
create trigger trg_refresh_scholarship_expiration
  before insert or update of end_date, status, archived_at on public.scholarships
  for each row execute function public.refresh_scholarship_expiration_on_write();

-- Closing a semester records the closure without archiving, deleting, or
-- changing any scholarship assignment status. Cross-semester rows therefore
-- remain valid history and are not treated as duplicates.
drop function if exists public.close_academic_term(text, text);

create or replace function public.close_academic_term(
  p_academic_year text,
  p_semester text
)
returns table (
  assignments_closed integer,
  duplicate_flags_resolved integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_closed integer := 0;
  v_resolved integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_academic_year !~ '^[0-9]{4}-[0-9]{4}$' then raise exception 'Invalid academic year'; end if;
  if p_semester not in ('1st Semester', '2nd Semester', 'Summer') then raise exception 'Invalid semester'; end if;

  -- Closing a term does not prove that an open duplicate case was corrected.
  -- Keep those cases available for explicit administrator review.
  v_resolved := 0;

  update public.student_scholarships
  set term_closed_at = now(), updated_at = now()
  where academic_year = p_academic_year and semester = p_semester
    and term_closed_at is null;
  get diagnostics v_closed = row_count;

  insert into public.academic_term_closures (
    academic_year, semester, closed_by, closed_by_email,
    assignments_archived, duplicate_flags_resolved
  ) values (
    p_academic_year, p_semester, auth.uid(), auth.jwt() ->> 'email',
    v_closed, v_resolved
  )
  on conflict (academic_year, semester) do update set
    closed_by = excluded.closed_by,
    closed_by_email = excluded.closed_by_email,
    assignments_archived = public.academic_term_closures.assignments_archived + excluded.assignments_archived,
    duplicate_flags_resolved = public.academic_term_closures.duplicate_flags_resolved + excluded.duplicate_flags_resolved,
    closed_at = now();

  return query select v_closed, v_resolved;
end;
$$;

revoke all on function public.close_academic_term(text, text) from public;
grant execute on function public.close_academic_term(text, text) to authenticated;

create or replace view public.dashboard_stats as
select
  (select count(*) from public.students where archived_at is null) as total_scholars,
  (select count(*) from public.scholarships
    where archived_at is null and status in ('Active', 'Expiring Soon')) as active_scholarships,
  (select count(*) from public.duplicate_flags where status = 'Open') as duplicate_flags_open,
  (select count(*) from public.scholarships
    where archived_at is null and end_date between current_date and current_date + interval '30 days') as expiring_soon;

select public.flag_expiring_scholarships();
notify pgrst, 'reload schema';

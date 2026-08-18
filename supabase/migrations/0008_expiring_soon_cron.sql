-- SIGMA: automate "Expiring Soon" detection.
-- Previously a scholarship only showed as Expiring Soon if someone manually
-- edited its `status` column. This adds a dedicated computed flag (kept
-- separate from `status` so it never collides with manual Active/Inactive/
-- Archived edits) plus a daily pg_cron job that keeps it in sync with
-- `end_date`, and a log table for auditability.

alter table scholarships add column if not exists is_expiring_soon boolean not null default false;
create index if not exists idx_scholarships_is_expiring_soon on scholarships(is_expiring_soon);

create table if not exists cron_run_logs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  ran_at timestamptz not null default now(),
  records_affected integer not null default 0,
  detail text
);

alter table cron_run_logs enable row level security;
create policy "cron_run_logs_select_authenticated" on cron_run_logs
  for select using (auth.role() = 'authenticated');

-- ------------------------------------------------------------
-- flag_expiring_scholarships()
-- Sets is_expiring_soon = true for any non-archived, non-inactive
-- scholarship whose end_date falls within the next 30 days; clears it for
-- everything else (so a scholarship whose end_date moves back out, or gets
-- archived/renewed, stops showing as expiring). Logs one row per run.
-- ------------------------------------------------------------
create or replace function flag_expiring_scholarships()
returns void as $$
declare
  v_flagged_count integer;
  v_cleared_count integer;
begin
  with flagged as (
    update scholarships
    set is_expiring_soon = true
    where archived_at is null
      and status not in ('Archived', 'Inactive')
      and end_date is not null
      and end_date between current_date and current_date + interval '30 days'
      and is_expiring_soon = false
    returning id
  )
  select count(*) into v_flagged_count from flagged;

  with cleared as (
    update scholarships
    set is_expiring_soon = false
    where is_expiring_soon = true
      and (
        archived_at is not null
        or status in ('Archived', 'Inactive')
        or end_date is null
        or end_date < current_date
        or end_date > current_date + interval '30 days'
      )
    returning id
  )
  select count(*) into v_cleared_count from cleared;

  insert into cron_run_logs (job_name, records_affected, detail)
  values ('flag_expiring_scholarships', v_flagged_count + v_cleared_count,
    v_flagged_count || ' flagged, ' || v_cleared_count || ' cleared');
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------
-- Schedule: daily at midnight. Requires the pg_cron extension, available
-- on Supabase's hosted Postgres (Database → Extensions → enable pg_cron
-- if this errors with "schema cron does not exist").
-- ------------------------------------------------------------
create extension if not exists pg_cron;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'flag-expiring-scholarships-daily') then
    perform cron.schedule(
      'flag-expiring-scholarships-daily',
      '0 0 * * *',
      $cron$select flag_expiring_scholarships()$cron$
    );
  end if;
end;
$$;

-- Run once immediately so the flag isn't empty until tomorrow's cron tick.
select flag_expiring_scholarships();

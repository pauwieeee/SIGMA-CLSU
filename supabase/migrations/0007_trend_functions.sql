-- SIGMA: real trend/comparison data for the Dashboard and Reports pages.
-- Replaces the previously-hardcoded "↑4.2% this A.Y." / "3 added this
-- month" / "↑3 vs last semester" placeholders with real Postgres functions,
-- shared by both pages so there is one source of truth.

-- ------------------------------------------------------------
-- get_scholar_trend()
-- Compares total distinct active scholars in the most recent academic_year
-- present in the data against the academic_year immediately before it
-- (by string/chronological order, since academic_year is 'YYYY-YYYY').
-- has_previous = false when there's no prior A.Y. to compare against.
-- ------------------------------------------------------------
create or replace function get_scholar_trend()
returns table (
  current_ay text,
  previous_ay text,
  current_count bigint,
  previous_count bigint,
  pct_change numeric,
  has_previous boolean
) as $$
declare
  v_current_ay text;
  v_previous_ay text;
  v_current_count bigint;
  v_previous_count bigint;
begin
  select academic_year into v_current_ay
  from student_scholarships
  where archived_at is null
  order by academic_year desc
  limit 1;

  if v_current_ay is null then
    return query select null::text, null::text, 0::bigint, 0::bigint, null::numeric, false;
    return;
  end if;

  select academic_year into v_previous_ay
  from student_scholarships
  where archived_at is null and academic_year < v_current_ay
  order by academic_year desc
  limit 1;

  select count(distinct student_id) into v_current_count
  from student_scholarships
  where archived_at is null and academic_year = v_current_ay and status = 'Active';

  if v_previous_ay is null then
    return query select v_current_ay, null::text, v_current_count, 0::bigint, null::numeric, false;
    return;
  end if;

  select count(distinct student_id) into v_previous_count
  from student_scholarships
  where archived_at is null and academic_year = v_previous_ay and status = 'Active';

  return query
    select
      v_current_ay,
      v_previous_ay,
      v_current_count,
      v_previous_count,
      case when v_previous_count = 0 then null
           else round(((v_current_count - v_previous_count)::numeric / v_previous_count) * 100, 1)
      end,
      true;
end;
$$ language plpgsql stable;

-- ------------------------------------------------------------
-- get_scholarships_added_this_month()
-- Count of scholarships (not archived) created within the current
-- calendar month.
-- ------------------------------------------------------------
create or replace function get_scholarships_added_this_month()
returns bigint as $$
  select count(*)
  from scholarships
  where archived_at is null
    and created_at >= date_trunc('month', now());
$$ language sql stable;

-- ------------------------------------------------------------
-- get_duplicate_flag_trend()
-- Compares open duplicate_flags created in the most recent academic_year +
-- semester (derived from the flagged student_scholarships row) against the
-- immediately preceding term. has_previous = false when there's no prior
-- term's flags to compare against.
-- ------------------------------------------------------------
create or replace function get_duplicate_flag_trend()
returns table (
  current_term text,
  previous_term text,
  current_count bigint,
  previous_count bigint,
  diff bigint,
  has_previous boolean
) as $$
declare
  v_current_ay text;
  v_current_sem text;
  v_previous_ay text;
  v_previous_sem text;
  v_current_count bigint;
  v_previous_count bigint;
begin
  select ss.academic_year, ss.semester into v_current_ay, v_current_sem
  from duplicate_flags df
  join student_scholarships ss on ss.id = df.student_scholarship_id_a
  order by ss.academic_year desc, ss.semester desc
  limit 1;

  if v_current_ay is null then
    return query select null::text, null::text, 0::bigint, 0::bigint, 0::bigint, false;
    return;
  end if;

  select count(*) into v_current_count
  from duplicate_flags df
  join student_scholarships ss on ss.id = df.student_scholarship_id_a
  where ss.academic_year = v_current_ay and ss.semester = v_current_sem;

  select ss.academic_year, ss.semester into v_previous_ay, v_previous_sem
  from duplicate_flags df
  join student_scholarships ss on ss.id = df.student_scholarship_id_a
  where (ss.academic_year, ss.semester) < (v_current_ay, v_current_sem)
  order by ss.academic_year desc, ss.semester desc
  limit 1;

  if v_previous_ay is null then
    return query select
      (v_current_ay || ' ' || v_current_sem), null::text, v_current_count, 0::bigint, 0::bigint, false;
    return;
  end if;

  select count(*) into v_previous_count
  from duplicate_flags df
  join student_scholarships ss on ss.id = df.student_scholarship_id_a
  where ss.academic_year = v_previous_ay and ss.semester = v_previous_sem;

  return query select
    (v_current_ay || ' ' || v_current_sem),
    (v_previous_ay || ' ' || v_previous_sem),
    v_current_count,
    v_previous_count,
    v_current_count - v_previous_count,
    true;
end;
$$ language plpgsql stable;

grant execute on function get_scholar_trend() to authenticated;
grant execute on function get_scholarships_added_this_month() to authenticated;
grant execute on function get_duplicate_flag_trend() to authenticated;

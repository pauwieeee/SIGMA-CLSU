-- Structured duplicate analytics and complete notification lifecycle.

alter table public.duplicate_flags
  add column if not exists reason_code text not null default 'MULTIPLE_ACTIVE_SAME_TERM';

alter table public.duplicate_flags drop constraint if exists duplicate_flags_reason_code_check;
alter table public.duplicate_flags add constraint duplicate_flags_reason_code_check
  check (reason_code in (
    'MULTIPLE_ACTIVE_SAME_TERM', 'DUPLICATE_ASSIGNMENT',
    'STUDENT_ID_NAME_MISMATCH', 'APPROVED_EXCEPTION'
  ));

alter table public.notifications
  add column if not exists related_student_id uuid references public.students(id) on delete set null,
  add column if not exists dismissed_at timestamptz,
  add column if not exists archived_at timestamptz;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'expiring_soon', 'duplicate_flag', 'duplicate_review', 'import_complete',
    'import_failed', 'enrollment_complete', 'save_failed'
  ));

create index if not exists idx_notifications_visible
  on public.notifications(archived_at, dismissed_at, created_at desc);

create or replace function public.log_duplicate_flag_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_actor_name text;
begin
  v_actor_name := coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'preferred_username', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''),
    nullif(auth.jwt() ->> 'email', ''), 'System'
  );
  insert into public.activity_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, entity_type, entity_id, description
  ) values (
    auth.uid(), v_actor_name, auth.jwt() ->> 'email',
    case when auth.uid() is null then 'System' else 'Admin' end,
    'create', 'duplicate_flag', new.id,
    'Duplicate flag created: ' || new.reason
  );
  return new;
end;
$$;

drop trigger if exists trg_log_duplicate_flag_created on public.duplicate_flags;
create trigger trg_log_duplicate_flag_created
  after insert on public.duplicate_flags
  for each row execute function public.log_duplicate_flag_created();

create or replace function public.log_student_enrollment_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_actor_name text;
begin
  if old.is_enrolled is not distinct from new.is_enrolled then return new; end if;
  v_actor_name := coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'preferred_username', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''),
    nullif(auth.jwt() ->> 'email', ''), 'System'
  );
  insert into public.activity_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, entity_type, entity_id, description
  ) values (
    auth.uid(), v_actor_name, auth.jwt() ->> 'email',
    case when auth.uid() is null then 'System' else 'Admin' end,
    'verify_enrollment', 'student_scholarship', new.id,
    'Enrollment verified as ' || case when new.is_enrolled then 'Enrolled' else 'Not Enrolled' end ||
    ' for ' || new.academic_year || ' • ' || new.semester || '.'
  );
  return new;
end;
$$;

drop trigger if exists trg_log_student_enrollment_change on public.student_scholarships;
create trigger trg_log_student_enrollment_change
  after update of is_enrolled on public.student_scholarships
  for each row execute function public.log_student_enrollment_change();

create or replace function public.notify_duplicate_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_label text;
begin
  select last_name || ', ' || first_name || ' (' || student_number || ')'
  into v_student_label from public.students where id = new.student_id;

  insert into public.notifications (
    type, title, message, related_entity_id, related_student_id
  ) values (
    'duplicate_flag', 'New duplicate flag',
    coalesce(v_student_label, 'A student') || ' was flagged: ' || new.reason,
    new.id, new.student_id
  );
  insert into public.notifications (
    type, title, message, related_entity_id, related_student_id
  ) values (
    'duplicate_review', 'Duplicate case awaiting review',
    coalesce(v_student_label, 'A student') || ' requires administrator review.',
    new.id, new.student_id
  );
  return new;
end;
$$;

create or replace function public.import_student_records_with_results(p_rows jsonb)
returns table (
  source_row integer, result_status text, error_type text,
  result_message text, student_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  v_student_id uuid;
  v_inserted integer;
  v_existing boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'Import rows must be a JSON array'; end if;

  for item in select value from jsonb_array_elements(p_rows) loop
    source_row := nullif(item->>'source_row', '')::integer;
    student_id := null;
    begin
      select id into v_student_id from public.students
      where student_number = item->>'student_number';
      v_existing := found;

      if not v_existing then
        insert into public.students (
          student_number, last_name, first_name, middle_initial, program_id,
          yr_level, address, contact_number, email
        ) values (
          item->>'student_number', item->>'last_name', item->>'first_name',
          nullif(item->>'middle_initial', ''), (item->>'program_id')::uuid,
          item->>'yr_level', nullif(item->>'address', ''),
          nullif(item->>'contact_number', ''), nullif(item->>'email', '')
        ) returning id into v_student_id;
      else
        update public.students set
          program_id = (item->>'program_id')::uuid,
          yr_level = item->>'yr_level',
          address = coalesce(nullif(item->>'address', ''), address),
          contact_number = coalesce(nullif(item->>'contact_number', ''), contact_number),
          email = coalesce(nullif(item->>'email', ''), email),
          updated_at = now()
        where id = v_student_id;
      end if;

      insert into public.student_scholarships (
        student_id, scholarship_id, academic_year, semester, status
      ) values (
        v_student_id, (item->>'scholarship_id')::uuid,
        item->>'academic_year', item->>'semester', item->>'status'
      ) on conflict (student_id, scholarship_id, academic_year, semester) do nothing;
      get diagnostics v_inserted = row_count;

      student_id := v_student_id;
      if v_inserted = 1 then
        result_status := 'Success'; error_type := null;
        result_message := case when v_existing
          then 'Existing student updated and scholarship assignment added.'
          else 'New student and scholarship assignment imported successfully.' end;
      else
        result_status := 'Skipped'; error_type := 'Duplicate Record';
        result_message := 'This student scholarship already exists for the selected academic year and semester.';
      end if;
      return next;
    exception when others then
      student_id := null; result_status := 'Failed';
      error_type := case when sqlstate = '23505' then 'Duplicate Record'
        when sqlstate = '23503' then 'Invalid Reference'
        when sqlstate = '23514' then 'Invalid Value'
        when sqlstate = '23502' then 'Missing Required Field'
        else 'Database Error' end;
      result_message := sqlerrm;
      return next;
    end;
  end loop;
end;
$$;

create or replace function public.detect_duplicates_for_student(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.duplicate_flags (
    student_id, student_scholarship_id_a, student_scholarship_id_b,
    conflict_type, reason_code, reason
  )
  select a.student_id, a.id, b.id, 'Multiple Active Scholarships',
    'MULTIPLE_ACTIVE_SAME_TERM',
    'Student has multiple Active scholarships during ' || a.academic_year || ' • ' || a.semester ||
    ': "' || coalesce(sa.name, 'Unknown scholarship') || '" and "' ||
    coalesce(sb.name, 'Unknown scholarship') || '".'
  from public.student_scholarships a
  join public.student_scholarships b
    on b.student_id = a.student_id and b.academic_year = a.academic_year
   and b.semester = a.semester and b.id > a.id
  left join public.scholarships sa on sa.id = a.scholarship_id
  left join public.scholarships sb on sb.id = b.scholarship_id
  where a.student_id = p_student_id
    and a.status = 'Active' and b.status = 'Active'
    and a.archived_at is null and b.archived_at is null
    and a.term_closed_at is null and b.term_closed_at is null
    and not exists (
      select 1 from public.duplicate_flags df
      where ((df.student_scholarship_id_a = a.id and df.student_scholarship_id_b = b.id)
          or (df.student_scholarship_id_a = b.id and df.student_scholarship_id_b = a.id))
        and (df.status in ('Open', 'Under Review', 'Confirmed Valid')
          or (df.status = 'Resolved' and df.resolution_type in ('Approved Exception', 'False Positive')
            and coalesce(df.resolution_notes, '') not like 'Automatically corrected:%'))
    );
end;
$$;

notify pgrst, 'reload schema';

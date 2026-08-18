-- SIGMA: automatic notifications
-- Populates the notifications table for events the header bell should surface:
--   - a new duplicate flag is opened
--   - a scholarship transitions into "Expiring Soon"
--   - a CSV/Excel import batch completes
-- Note: expiring_soon notifications only fire on the moment a scholarship's
-- status is explicitly set to 'Expiring Soon' (e.g. via an edit or a future
-- scheduled job) — there is no cron job in this project computing that
-- transition automatically from end_date yet.

create or replace function notify_duplicate_flag()
returns trigger as $$
declare
  v_student_label text;
begin
  select last_name || ', ' || first_name || ' (' || student_number || ')'
    into v_student_label
    from students where id = new.student_id;

  insert into notifications (type, title, message, related_entity_id)
  values (
    'duplicate_flag',
    'New duplicate flag',
    coalesce(v_student_label, 'A student') || ' was flagged: ' || new.reason,
    new.id
  );
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_notify_duplicate_flag on duplicate_flags;
create trigger trg_notify_duplicate_flag
  after insert on duplicate_flags
  for each row execute function notify_duplicate_flag();

create or replace function notify_expiring_soon()
returns trigger as $$
begin
  if new.status = 'Expiring Soon' and (old.status is distinct from 'Expiring Soon') then
    insert into notifications (type, title, message, related_entity_id)
    values (
      'expiring_soon',
      'Scholarship expiring soon',
      new.name || ' is expiring soon' || case when new.end_date is not null then ' (' || new.end_date || ')' else '' end,
      new.id
    );
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_notify_expiring_soon on scholarships;
create trigger trg_notify_expiring_soon
  after update on scholarships
  for each row execute function notify_expiring_soon();

-- Enable Realtime so the notification bell updates live without polling.
alter publication supabase_realtime add table notifications;

-- Keep expiration notifications synchronized with the scholarship's current
-- end date. A notification is actionable only while the scholarship ends
-- between today and 30 days from today.

delete from public.notifications n
where n.type = 'expiring_soon'
  and not exists (
    select 1
    from public.scholarships s
    where s.id = n.related_entity_id
      and s.archived_at is null
      and s.status not in ('Archived', 'Inactive', 'Expired')
      and s.end_date between current_date and current_date + interval '30 days'
  );

create or replace function public.sync_expiring_soon_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_expiring boolean;
  v_was_expiring boolean := false;
begin
  v_is_expiring := new.archived_at is null
    and new.status not in ('Archived', 'Inactive', 'Expired')
    and new.end_date between current_date and current_date + interval '30 days';

  if tg_op = 'UPDATE' then
    v_was_expiring := old.archived_at is null
      and old.status not in ('Archived', 'Inactive', 'Expired')
      and old.end_date between current_date and current_date + interval '30 days';
  end if;

  if v_is_expiring and not v_was_expiring then
    insert into public.notifications (type, title, message, related_entity_id)
    values (
      'expiring_soon',
      'Scholarship expiring soon',
      new.name || ' is expiring soon (' || new.end_date || ')',
      new.id
    );
  elsif not v_is_expiring then
    delete from public.notifications
    where type = 'expiring_soon' and related_entity_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_expiring_soon on public.scholarships;
drop trigger if exists trg_sync_expiring_soon_notification on public.scholarships;
create trigger trg_sync_expiring_soon_notification
after insert or update of end_date, status, archived_at on public.scholarships
for each row execute function public.sync_expiring_soon_notification();

notify pgrst, 'reload schema';

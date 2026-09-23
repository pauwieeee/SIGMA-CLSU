-- Store audit events through the database so timestamps and actor identity
-- cannot be lost, stale, or supplied incorrectly by browser state.

create or replace function public.record_activity(
  p_action text,
  p_entity_type text,
  p_description text,
  p_entity_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_id uuid;
  v_actor_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if nullif(btrim(p_action), '') is null
     or nullif(btrim(p_entity_type), '') is null
     or nullif(btrim(p_description), '') is null then
    raise exception 'Activity action, entity type, and description are required';
  end if;

  v_actor_name := coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'preferred_username', ''),
    nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''),
    nullif(auth.jwt() ->> 'email', ''),
    'Admin'
  );

  insert into public.activity_logs (
    actor_id, actor_name, actor_email, actor_role,
    action, entity_type, entity_id, description
  ) values (
    auth.uid(), v_actor_name, auth.jwt() ->> 'email', 'Admin',
    btrim(p_action), btrim(p_entity_type), p_entity_id, btrim(p_description)
  )
  returning id into v_log_id;

  return v_log_id;
end;
$$;

revoke all on function public.record_activity(text, text, text, uuid) from public;
grant execute on function public.record_activity(text, text, text, uuid) to authenticated;

-- Realtime makes an already-open Dashboard refresh as soon as another admin
-- creates an audit event. The guard keeps this migration safe to re-run.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'activity_logs'
  ) then
    alter publication supabase_realtime add table public.activity_logs;
  end if;
end;
$$;

notify pgrst, 'reload schema';

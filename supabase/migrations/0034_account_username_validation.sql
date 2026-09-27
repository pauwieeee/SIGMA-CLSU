-- Authenticated users can validate preferred-username uniqueness without
-- exposing the auth.users table to the browser.
create or replace function public.is_preferred_username_available(p_username text)
returns boolean
language sql
security definer
set search_path = public, auth
stable
as $$
  select not exists (
    select 1 from auth.users
    where id <> auth.uid()
      and lower(btrim(raw_user_meta_data ->> 'preferred_username')) = lower(btrim(p_username))
  );
$$;

revoke all on function public.is_preferred_username_available(text) from public;
grant execute on function public.is_preferred_username_available(text) to authenticated;
notify pgrst, 'reload schema';

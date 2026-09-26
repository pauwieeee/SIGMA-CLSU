-- Per-account onboarding state. Existing accounts are treated as returning
-- users; accounts created after this migration receive an incomplete tour.
create table if not exists public.user_onboarding (
  user_id uuid primary key references auth.users(id) on delete cascade,
  has_completed_onboarding boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_onboarding enable row level security;

drop policy if exists "Users can view their onboarding state" on public.user_onboarding;
create policy "Users can view their onboarding state" on public.user_onboarding
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can update their onboarding state" on public.user_onboarding;
create policy "Users can update their onboarding state" on public.user_onboarding
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can insert their onboarding state" on public.user_onboarding;
create policy "Users can insert their onboarding state" on public.user_onboarding
  for insert to authenticated with check (auth.uid() = user_id);

insert into public.user_onboarding (user_id, has_completed_onboarding, completed_at)
select id, true, now() from auth.users
on conflict (user_id) do nothing;

create or replace function public.initialize_user_onboarding()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_onboarding (user_id, has_completed_onboarding)
  values (new.id, false)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists initialize_user_onboarding_after_signup on auth.users;
create trigger initialize_user_onboarding_after_signup
after insert on auth.users for each row execute function public.initialize_user_onboarding();

grant select, insert, update on public.user_onboarding to authenticated;
notify pgrst, 'reload schema';

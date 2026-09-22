-- Preserve who performed each administrative action at the time it occurred.
-- actor_id remains the authoritative Supabase Auth user reference; name,
-- email, and role are immutable display snapshots for the audit trail.

alter table public.activity_logs
  add column if not exists actor_name text,
  add column if not exists actor_role text not null default 'Admin';

create index if not exists idx_activity_logs_actor_id
  on public.activity_logs(actor_id);

notify pgrst, 'reload schema';

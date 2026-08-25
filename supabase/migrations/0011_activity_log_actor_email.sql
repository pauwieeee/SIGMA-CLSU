-- SIGMA: label Recent Activity entries with which admin performed them.
-- activity_logs.actor_id references auth.users, but auth.users isn't
-- queryable from the client via PostgREST, so the actor's email is
-- captured directly at insert time instead of joined later.

alter table activity_logs
  add column if not exists actor_email text;

-- Duplicate-case lifecycle belongs in Duplicate Flag History. The student
-- activity timeline is reserved for administrator actions on student and
-- scholarship records, so the same flag event is not shown twice.
create or replace function public.get_student_activity_timeline(p_student_id uuid)
returns table (
  id uuid, occurred_at timestamptz, action text, description text,
  actor_name text, actor_email text, actor_role text, entity_type text
)
language sql
security definer
set search_path = public
stable
as $$
  select al.id, al.created_at, al.action, al.description,
         al.actor_name, al.actor_email, al.actor_role, al.entity_type
  from public.activity_logs al
  where (al.entity_type = 'student' and al.entity_id = p_student_id)
     or (al.entity_type = 'student_scholarship' and al.entity_id in (
       select ss.id from public.student_scholarships ss where ss.student_id = p_student_id
     ))
  order by al.created_at desc;
$$;

revoke all on function public.get_student_activity_timeline(uuid) from public;
grant execute on function public.get_student_activity_timeline(uuid) to authenticated;
notify pgrst, 'reload schema';

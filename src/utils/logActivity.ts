import { supabase } from '@/lib/supabase'

// Writes to activity_logs, which powers the Dashboard's "Recent Activity"
// widget. Best-effort: a logging failure should never block the action that
// triggered it, so errors are swallowed (mirrors the .insert() calls this
// replaces elsewhere in the app, e.g. notifications inserts).
export async function logActivity(action: string, entityType: string, description: string, entityId?: string) {
  const { data } = await supabase.auth.getUser()
  await (supabase as any).from('activity_logs').insert({
    actor_id: data.user?.id ?? null,
    actor_email: data.user?.email ?? null,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    description,
  })
}

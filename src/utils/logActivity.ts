import { supabase } from '@/lib/supabase'
export const ACTIVITY_CREATED_EVENT = 'sigma:activity-created'

// The RPC records the authenticated actor and database timestamp server-side.
// Logging errors are deliberately surfaced: silently losing an audit event
// would make a successful administrative change unauditable.
export async function logActivity(action: string, entityType: string, description: string, entityId?: string) {
  const { error } = await (supabase as any).rpc('record_activity', {
    p_action: action,
    p_entity_type: entityType,
    p_description: description,
    p_entity_id: entityId ?? null,
  })
  if (error) throw new Error(`The change succeeded, but its activity log could not be saved: ${error.message}`)

  window.dispatchEvent(new CustomEvent(ACTIVITY_CREATED_EVENT))
}

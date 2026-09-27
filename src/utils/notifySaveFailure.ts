import { supabase } from '@/lib/supabase'

export function notifySaveFailure(operation: string, error: unknown, relatedStudentId?: string | null) {
  const message = error instanceof Error ? error.message : String(error)
  return (supabase as any).from('notifications').insert({
    type: 'save_failed',
    title: 'Database save/update failed',
    message: `${operation}: ${message}`,
    related_student_id: relatedStudentId ?? null,
  })
}

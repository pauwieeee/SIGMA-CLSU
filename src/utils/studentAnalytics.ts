import { supabase } from '@/lib/supabase'
export { countDistinctStudentIds, isGenericStudentTotalQuestion } from '@/utils/studentAnalyticsCore'

export interface CanonicalStudentCounts {
  activeStudents: number
  archivedStudents: number
  allStudents: number
}

/** Canonical unfiltered student-profile totals used across the application. */
export async function fetchCanonicalStudentCounts(): Promise<CanonicalStudentCounts> {
  const { data, error } = await (supabase as any)
    .from('system_counts')
    .select('active_students, archived_students, all_students')
    .single()
  if (error) throw error
  return {
    activeStudents: Number(data?.active_students ?? 0),
    archivedStudents: Number(data?.archived_students ?? 0),
    allStudents: Number(data?.all_students ?? 0),
  }
}

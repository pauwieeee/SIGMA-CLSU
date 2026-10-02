import { supabase } from '@/lib/supabase'
export { countDistinctStudentIds, isGenericStudentTotalQuestion, studentProfileCountScope } from '@/utils/studentAnalyticsCore'

export interface CanonicalStudentCounts {
  activeStudents: number
  archivedStudents: number
  allStudents: number
}

/** Canonical unfiltered student-profile totals used across the application. */
export async function fetchCanonicalStudentCounts(): Promise<CanonicalStudentCounts> {
  // Read the same student-profile rows used by Student Records. A previous
  // head-only count request could return a null count in production even when
  // normal student queries were available, silently rendering zero.
  const pageSize = 1000
  const rows: Array<{ id: string; archived_at: string | null }> = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('students')
      .select('id, archived_at')
      .order('id')
      .range(from, from + pageSize - 1)
    if (error) throw error
    const page = data ?? []
    rows.push(...page)
    if (page.length < pageSize) break
  }
  const activeStudents = rows.filter((student) => student.archived_at == null).length
  const archivedStudents = rows.length - activeStudents
  return {
    activeStudents,
    archivedStudents,
    allStudents: rows.length,
  }
}

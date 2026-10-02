import { supabase } from '@/lib/supabase'
export { countDistinctStudentIds, isGenericStudentTotalQuestion, studentProfileCountScope } from '@/utils/studentAnalyticsCore'

export interface CanonicalStudentCounts {
  activeStudents: number
  archivedStudents: number
  allStudents: number
}

/** Canonical unfiltered student-profile totals used across the application. */
export async function fetchCanonicalStudentCounts(): Promise<CanonicalStudentCounts> {
  const [viewResult, activeResult, archivedResult, allResult] = await Promise.all([
    (supabase as any).from('system_counts').select('active_students, archived_students, all_students').single(),
    supabase.from('students').select('id', { count: 'exact', head: true }).is('archived_at', null),
    supabase.from('students').select('id', { count: 'exact', head: true }).not('archived_at', 'is', null),
    supabase.from('students').select('id', { count: 'exact', head: true }),
  ])

  // Student profiles are authoritative. The canonical view remains a safe
  // fallback for deployments where direct count permissions differ, but a
  // missing/stale view can no longer turn a populated dashboard into zero.
  if (!activeResult.error && !archivedResult.error && !allResult.error) {
    return {
      activeStudents: activeResult.count ?? 0,
      archivedStudents: archivedResult.count ?? 0,
      allStudents: allResult.count ?? 0,
    }
  }

  if (viewResult.error) throw activeResult.error ?? archivedResult.error ?? allResult.error ?? viewResult.error
  return {
    activeStudents: Number(viewResult.data?.active_students ?? 0),
    archivedStudents: Number(viewResult.data?.archived_students ?? 0),
    allStudents: Number(viewResult.data?.all_students ?? 0),
  }
}

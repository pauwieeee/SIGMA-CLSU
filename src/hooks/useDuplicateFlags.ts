import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface DuplicateFlagRow {
  id: string
  student_id: string
  reason: string
  student_number: string
  student_name: string
  college: string
  program: string
  scholarship_a: string
  scholarship_b: string
  academic_year: string
  semester: string
  created_at: string
  status: 'Open' | 'Under Review' | 'Resolved' | 'Confirmed Valid'
  conflict_type: string
  review_notes: string | null
  scholarship_a_status: string
  scholarship_b_status: string
  resolution_type: string | null
  resolution_notes: string | null
  resolved_by_email: string | null
  resolved_at: string | null
}

export function useDuplicateFlags(status: 'Open' | 'Resolved' | 'Unresolved' | 'All' = 'Unresolved') {
  const [rows, setRows] = useState<DuplicateFlagRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('duplicate_flags')
      .select(
        `id, student_id, reason, conflict_type, status, created_at, review_notes, resolution_type, resolution_notes, resolved_by_email, resolved_at,
         students ( student_number, last_name, first_name, programs ( name, colleges ( name ) ) ),
         a:student_scholarship_id_a ( academic_year, semester, status, scholarships ( name ) ),
         b:student_scholarship_id_b ( academic_year, semester, status, scholarships ( name ) )`
      )
      .order('created_at', { ascending: false })
    if (status === 'Unresolved') query = query.in('status', ['Open', 'Under Review'])
    else if (status !== 'All') query = query.eq('status', status)
    const { data, error } = await query

    if (!error && data) {
      setRows(
        (data as any[]).map((r) => ({
          id: r.id,
          student_id: r.student_id,
          reason: r.reason,
          conflict_type: r.conflict_type ?? 'Overlapping Grant',
          review_notes: r.review_notes ?? null,
          student_number: r.students?.student_number ?? '—',
          student_name: r.students ? `${r.students.last_name}, ${r.students.first_name}` : '—',
          college: r.students?.programs?.colleges?.name ?? '—',
          program: r.students?.programs?.name ?? '—',
          scholarship_a: r.a?.scholarships?.name ?? '—',
          scholarship_b: r.b?.scholarships?.name ?? '—',
          academic_year: r.a?.academic_year ?? r.b?.academic_year ?? '—',
          semester: r.a?.semester ?? r.b?.semester ?? '—',
          created_at: r.created_at,
          status: r.status,
          scholarship_a_status: r.a?.status ?? '—',
          scholarship_b_status: r.b?.status ?? '—',
          resolution_type: r.resolution_type ?? null,
          resolution_notes: r.resolution_notes ?? null,
          resolved_by_email: r.resolved_by_email ?? null,
          resolved_at: r.resolved_at ?? null,
        }))
      )
    }
    setLoading(false)
  }, [status])

  useEffect(() => {
    void fetchRows()
    const refresh = () => void fetchRows()
    window.addEventListener('focus', refresh)
    const channel = supabase
      .channel(`duplicate-flags-${status}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'duplicate_flags' }, refresh)
      .subscribe()
    return () => {
      window.removeEventListener('focus', refresh)
      void supabase.removeChannel(channel)
    }
  }, [fetchRows, status])

  async function review(id: string, newStatus: 'Under Review' | 'Resolved' | 'Confirmed Valid', decision: string, notes: string) {
    const { error } = await (supabase as any)
      .rpc('review_duplicate_flag', {
        p_flag_id: id,
        p_new_status: newStatus,
        p_decision: decision,
        p_notes: notes,
      })
    if (error) throw error
    // The database RPC records the review and audit event atomically.
    await fetchRows()
  }

  async function resolve(id: string, resolutionType: string, resolutionNotes: string) {
    const confirmedValid = ['Approved Exception', 'False Positive'].includes(resolutionType)
    await review(id, confirmedValid ? 'Confirmed Valid' : 'Resolved', resolutionType, resolutionNotes)
  }

  async function markUnderReview(id: string, notes: string) {
    await review(id, 'Under Review', 'Further Verification Required', notes)
  }

  return { rows, loading, resolve, markUnderReview, refetch: fetchRows }
}

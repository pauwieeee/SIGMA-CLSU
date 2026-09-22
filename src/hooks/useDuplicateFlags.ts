import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'
import { logActivity } from '@/utils/logActivity'

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
}

export function useDuplicateFlags() {
  const { user } = useAuth()
  const [rows, setRows] = useState<DuplicateFlagRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('duplicate_flags')
      .select(
        `id, student_id, reason, created_at,
         students ( student_number, last_name, first_name, programs ( name, colleges ( name ) ) ),
         a:student_scholarship_id_a ( academic_year, semester, scholarships ( name ) ),
         b:student_scholarship_id_b ( academic_year, semester, scholarships ( name ) )`
      )
      .eq('status', 'Open')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setRows(
        (data as any[]).map((r) => ({
          id: r.id,
          student_id: r.student_id,
          reason: r.reason,
          student_number: r.students?.student_number ?? '—',
          student_name: r.students ? `${r.students.last_name}, ${r.students.first_name}` : '—',
          college: r.students?.programs?.colleges?.name ?? '—',
          program: r.students?.programs?.name ?? '—',
          scholarship_a: r.a?.scholarships?.name ?? '—',
          scholarship_b: r.b?.scholarships?.name ?? '—',
          academic_year: r.a?.academic_year ?? r.b?.academic_year ?? '—',
          semester: r.a?.semester ?? r.b?.semester ?? '—',
          created_at: r.created_at,
        }))
      )
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  async function resolve(id: string) {
    const row = rows.find((r) => r.id === id)
    const { error } = await (supabase as any)
      .from('duplicate_flags')
      .update({ status: 'Resolved', resolved_by: user?.id ?? null, resolved_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
    await logActivity(
      'resolve',
      'duplicate_flag',
      row ? `Resolved duplicate flag for ${row.student_name} (${row.student_number}).` : 'Resolved a duplicate flag.',
      id
    )
    await fetchRows()
  }

  return { rows, loading, resolve, refetch: fetchRows }
}

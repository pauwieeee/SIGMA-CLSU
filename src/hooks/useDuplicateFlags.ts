import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthProvider'
import { logActivity } from '@/utils/logActivity'

export interface DuplicateFlagRow {
  id: string
  reason: string
  student_number: string
  student_name: string
  scholarship_a: string
  scholarship_b: string
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
        `id, reason,
         students ( student_number, last_name, first_name ),
         a:student_scholarship_id_a ( scholarships ( name ) ),
         b:student_scholarship_id_b ( scholarships ( name ) )`
      )
      .eq('status', 'Open')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setRows(
        (data as any[]).map((r) => ({
          id: r.id,
          reason: r.reason,
          student_number: r.students?.student_number ?? '—',
          student_name: r.students ? `${r.students.last_name}, ${r.students.first_name}` : '—',
          scholarship_a: r.a?.scholarships?.name ?? '—',
          scholarship_b: r.b?.scholarships?.name ?? '—',
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
    await (supabase as any)
      .from('duplicate_flags')
      .update({ status: 'Resolved', resolved_by: user?.id ?? null, resolved_at: new Date().toISOString() })
      .eq('id', id)
    await logActivity(
      'resolve',
      'duplicate_flag',
      row ? `Resolved duplicate flag for ${row.student_name} (${row.student_number}).` : 'Resolved a duplicate flag.',
      id
    )
    fetchRows()
  }

  return { rows, loading, resolve, refetch: fetchRows }
}

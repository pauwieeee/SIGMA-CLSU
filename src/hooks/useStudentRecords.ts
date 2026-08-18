import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface StudentRecordRow {
  id: string
  student_number: string
  full_name: string
  college: string
  program: string
  yr_level: string
  scholarship: string | null
  category: string | null
  academic_year: string | null
  semester: string | null
  status: string | null
  hasDuplicate: boolean
  /** The specific student_scholarships row this table row is showing — the
   * target for batch status/term updates (a student may have several term
   * rows; this is the one currently displayed). */
  studentScholarshipId: string | null
}

interface Filters {
  search: string
  collegeId: string
  programId: string
  categoryId: string
  academicYear: string
  semester: string
  status: string
}

export function useStudentRecords(filters: Filters) {
  const [rows, setRows] = useState<StudentRecordRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)

    const [{ data, error }, { data: dupRows }] = await Promise.all([
      supabase
        .from('students')
        .select(
          `id, student_number, last_name, first_name, middle_initial, yr_level,
           programs ( name, colleges ( id, name ) ),
           student_scholarships ( id, academic_year, semester, status,
             scholarships ( name, scholarship_categories ( id, name ) ) )`
        )
        .is('archived_at', null)
        .order('last_name', { ascending: true }),
      supabase.from('duplicate_flags').select('student_id').eq('status', 'Open'),
    ])

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const duplicateStudentIds = new Set((dupRows ?? []).map((d: any) => d.student_id))

    const mapped: StudentRecordRow[] = (data ?? []).map((s: any) => {
      const latestScholarship = s.student_scholarships?.[0]
      return {
        id: s.id,
        student_number: s.student_number,
        full_name: `${s.last_name}, ${s.first_name}${s.middle_initial ? ' ' + s.middle_initial + '.' : ''}`,
        college: s.programs?.colleges?.name ?? '—',
        program: s.programs?.name ?? '—',
        yr_level: s.yr_level,
        scholarship: latestScholarship?.scholarships?.name ?? null,
        category: latestScholarship?.scholarships?.scholarship_categories?.name ?? null,
        academic_year: latestScholarship?.academic_year ?? null,
        semester: latestScholarship?.semester ?? null,
        status: latestScholarship?.status ?? null,
        hasDuplicate: duplicateStudentIds.has(s.id),
        studentScholarshipId: latestScholarship?.id ?? null,
      }
    })

    setRows(mapped)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase()

    return rows.filter((r) => {
      if (search) {
        const haystack = `${r.student_number} ${r.full_name} ${r.college} ${r.program}`.toLowerCase()
        if (!haystack.includes(search)) return false
      }
      if (filters.collegeId && r.college !== filters.collegeId) return false
      if (filters.programId && r.program !== filters.programId) return false
      if (filters.categoryId && r.category !== filters.categoryId) return false
      if (filters.academicYear && r.academic_year !== filters.academicYear) return false
      if (filters.semester && r.semester !== filters.semester) return false
      if (filters.status) {
        const displayStatus = r.hasDuplicate ? 'Duplicate' : r.status
        if (displayStatus !== filters.status) return false
      }
      return true
    })
  }, [rows, filters])

  return { rows: filtered, loading, error, refetch: load }
}

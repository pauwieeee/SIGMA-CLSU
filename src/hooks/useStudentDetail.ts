import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface StudentDetail {
  id: string
  student_number: string
  full_name: string
  college: string
  program: string
  yr_level: string
  address: string | null
  contact_number: string | null
  email: string | null
  gwa: number | null
  participation_org: string | null
  created_at: string
}

export interface ScholarshipHistoryRow {
  id: string
  scholarship_name: string
  category_name: string
  academic_year: string
  semester: string
  status: string
  start_date: string | null
  end_date: string | null
}

export interface DuplicateFlagDetail {
  id: string
  reason: string
  status: string
  created_at: string
  scholarship_a: string
  scholarship_b: string
}

export function useStudentDetail(studentId: string | null) {
  const [student, setStudent] = useState<StudentDetail | null>(null)
  const [history, setHistory] = useState<ScholarshipHistoryRow[]>([])
  const [flags, setFlags] = useState<DuplicateFlagDetail[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!studentId) return
    setLoading(true)

    const [{ data: s }, { data: h }, { data: f }] = await Promise.all([
      supabase
        .from('students')
        .select('id, student_number, last_name, first_name, middle_initial, yr_level, address, contact_number, email, gwa, participation_org, created_at, programs ( name, colleges ( name ) )')
        .eq('id', studentId)
        .single(),
      supabase
        .from('student_scholarships')
        .select('id, academic_year, semester, status, start_date, end_date, scholarships ( name, scholarship_categories ( name ) )')
        .eq('student_id', studentId)
        .order('academic_year', { ascending: false }),
      supabase
        .from('duplicate_flags')
        .select(
          `id, reason, status, created_at,
           a:student_scholarship_id_a ( scholarships ( name ) ),
           b:student_scholarship_id_b ( scholarships ( name ) )`
        )
        .eq('student_id', studentId)
        .order('created_at', { ascending: false }),
    ])

    if (s) {
      const row = s as any
      setStudent({
        id: row.id,
        student_number: row.student_number,
        full_name: `${row.last_name}, ${row.first_name}${row.middle_initial ? ' ' + row.middle_initial + '.' : ''}`,
        college: row.programs?.colleges?.name ?? '—',
        program: row.programs?.name ?? '—',
        yr_level: row.yr_level,
        address: row.address,
        contact_number: row.contact_number,
        email: row.email,
        gwa: row.gwa,
        participation_org: row.participation_org,
        created_at: row.created_at,
      })
    }

    setHistory(
      (h ?? []).map((r: any) => ({
        id: r.id,
        scholarship_name: r.scholarships?.name ?? '—',
        category_name: r.scholarships?.scholarship_categories?.name ?? '—',
        academic_year: r.academic_year,
        semester: r.semester,
        status: r.status,
        start_date: r.start_date,
        end_date: r.end_date,
      }))
    )

    setFlags(
      (f ?? []).map((r: any) => ({
        id: r.id,
        reason: r.reason,
        status: r.status,
        created_at: r.created_at,
        scholarship_a: r.a?.scholarships?.name ?? '—',
        scholarship_b: r.b?.scholarships?.name ?? '—',
      }))
    )
    setLoading(false)
  }, [studentId])

  useEffect(() => {
    load()
  }, [load])

  return { student, history, flags, loading, refetch: load }
}

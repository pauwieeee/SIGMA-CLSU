import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { studentSearchText } from '@/utils/workflowRules'
import { DATA_CHANGED_EVENT } from '@/utils/dataSync'
import { OPEN_DUPLICATE_STATUSES } from '@/utils/duplicateFlags'
import { effectiveStudentRecordStatus, matchesStudentRecordAssignment } from '@/utils/studentRecordFilters'

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
  isEnrolled: boolean | null
  hasDuplicate: boolean
  /** The specific student_scholarships row this table row is showing — the
   * target for batch status/term updates (a student may have several term
   * rows; this is the one currently displayed). */
  studentScholarshipId: string | null
  archiveReason: string | null
  archivedAt: string | null
  archivedBy: string | null
  email: string | null
  contactNumber: string | null
  assignmentHistory: StudentAssignmentSnapshot[]
}

interface StudentAssignmentSnapshot {
  id: string
  scholarship: string | null
  category: string | null
  academicYear: string | null
  semester: string | null
  status: string | null
  isEnrolled: boolean | null
}

interface Filters {
  search: string
  collegeId: string
  programId: string
  categoryId: string
  scholarship: string
  academicYear: string
  semester: string
  status: string
}

export function useStudentRecords(filters: Filters, showArchived = false) {
  const [rows, setRows] = useState<StudentRecordRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)

    let studentsQuery = supabase
      .from('students')
      .select(
        `id, student_number, last_name, first_name, middle_initial, middle_name, suffix, yr_level, email, contact_number,
         archived_at, archived_by_name, archived_by_email, archive_reason,
         programs ( name, colleges ( id, name ) ),
         student_scholarships ( id, academic_year, semester, status, is_enrolled, archived_at,
           scholarships ( name, status, archived_at, scholarship_categories ( id, name ) ) )`
      )
    studentsQuery = showArchived ? studentsQuery.not('archived_at', 'is', null) : studentsQuery.is('archived_at', null)

    const [{ data, error }, { data: dupRows }] = await Promise.all([
      studentsQuery.order('last_name', { ascending: true }),
      supabase.from('duplicate_flags').select('student_id').in('status', [...OPEN_DUPLICATE_STATUSES]),
    ])

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const duplicateStudentIds = new Set((dupRows ?? []).map((d: any) => d.student_id))

    const mapped: StudentRecordRow[] = (data ?? []).map((s: any) => {
      const semesterRank: Record<string, number> = { '1st Semester': 1, '2nd Semester': 2, Summer: 3 }
      const assignments: StudentAssignmentSnapshot[] = (s.student_scholarships ?? [])
        .filter((assignment: any) => !assignment.archived_at && !assignment.scholarships?.archived_at)
        .sort((a: any, b: any) =>
          b.academic_year.localeCompare(a.academic_year)
          || (semesterRank[b.semester] ?? 0) - (semesterRank[a.semester] ?? 0)
        )
        .map((assignment: any) => ({
          id: assignment.id,
          scholarship: assignment.scholarships?.name ?? null,
          category: assignment.scholarships?.scholarship_categories?.name ?? null,
          academicYear: assignment.academic_year ?? null,
          semester: assignment.semester ?? null,
          status: effectiveStudentRecordStatus(assignment.status, assignment.scholarships?.status),
          isEnrolled: assignment.is_enrolled ?? null,
        }))
      const latestScholarship = assignments[0]
      return {
        id: s.id,
        student_number: s.student_number,
        full_name: `${s.last_name}${s.suffix ? ' ' + s.suffix : ''}, ${s.first_name}${s.middle_name ? ' ' + s.middle_name : s.middle_initial ? ' ' + s.middle_initial + '.' : ''}`,
        college: s.programs?.colleges?.name ?? '—',
        program: s.programs?.name ?? '—',
        yr_level: s.yr_level,
        scholarship: latestScholarship?.scholarship ?? null,
        category: latestScholarship?.category ?? null,
        academic_year: latestScholarship?.academicYear ?? null,
        semester: latestScholarship?.semester ?? null,
        status: latestScholarship?.status ?? null,
        isEnrolled: latestScholarship?.isEnrolled ?? null,
        hasDuplicate: duplicateStudentIds.has(s.id),
        studentScholarshipId: latestScholarship?.id ?? null,
        archiveReason: s.archive_reason ?? null,
        archivedAt: s.archived_at ?? null,
        archivedBy: s.archived_by_name ?? s.archived_by_email ?? null,
        email: s.email ?? null,
        contactNumber: s.contact_number ?? null,
        assignmentHistory: assignments,
      }
    })

    setRows(mapped)
    setLoading(false)
  }, [showArchived])

  useEffect(() => {
    load()
    const refresh = () => void load()
    window.addEventListener(DATA_CHANGED_EVENT, refresh)
    window.addEventListener('focus', refresh)
    return () => {
      window.removeEventListener(DATA_CHANGED_EVENT, refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [load])

  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase()

    return rows.flatMap((r) => {
      if (search) {
        const assignmentText = r.assignmentHistory
          .map((assignment) => [assignment.scholarship, assignment.category, assignment.academicYear, assignment.semester, assignment.status].filter(Boolean).join(' '))
          .join(' ')
          .toLowerCase()
        const haystack = `${studentSearchText(r)} ${assignmentText}`
        if (!haystack.includes(search)) return []
      }
      if (filters.status === 'Needs Review' && !r.hasDuplicate) return []

      const hasAssignmentFilter = Boolean(filters.collegeId || filters.programId || filters.categoryId || filters.scholarship || filters.academicYear || filters.semester || (filters.status && filters.status !== 'Needs Review'))
      const matchingAssignments = r.assignmentHistory.filter((assignment) => {
        return matchesStudentRecordAssignment({
          category: assignment.category,
          scholarship: assignment.scholarship,
          college: r.college,
          program: r.program,
          academicYear: assignment.academicYear,
          semester: assignment.semester,
          assignmentStatus: assignment.status,
        }, {
          category: filters.categoryId,
          scholarship: filters.scholarship,
          college: filters.collegeId,
          program: filters.programId,
          academicYear: filters.academicYear,
          semester: filters.semester,
          status: filters.status === 'Needs Review' ? null : filters.status,
        })
      })
      if (hasAssignmentFilter && matchingAssignments.length === 0) return []

      const displayedAssignment = hasAssignmentFilter ? matchingAssignments[0] : r.assignmentHistory[0]
      if (!displayedAssignment) return [r]
      return [{
        ...r,
        scholarship: displayedAssignment.scholarship,
        category: displayedAssignment.category,
        academic_year: displayedAssignment.academicYear,
        semester: displayedAssignment.semester,
        status: displayedAssignment.status,
        isEnrolled: displayedAssignment.isEnrolled,
        studentScholarshipId: displayedAssignment.id,
      }]
    })
  }, [rows, filters])

  return { rows: filtered, loading, error, refetch: load }
}

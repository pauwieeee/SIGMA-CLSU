import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ScholarshipCategoryName, ScholarsPerCategory } from '@/types/database'
import type { TrendPoint } from '@/hooks/useScholarsTrend'
import { DATA_CHANGED_EVENT } from '@/utils/dataSync'
import { countDistinctStudentIds, fetchCanonicalStudentCounts } from '@/utils/studentAnalytics'
import { effectiveStudentRecordStatus, matchesStudentRecordAssignment } from '@/utils/studentRecordFilters'

export interface ReportFilters {
  academicYear: string
  semester: string
  college: string
  program: string
  category: string
  scholarship: string
  status: string
  enrollment: string
}

interface ReportAssignment {
  id: string
  student_id: string
  academic_year: string
  semester: string
  status: string
  is_enrolled: boolean | null
  scholarships: { name: string; status: string; archived_at: string | null; scholarship_categories: { name: string } | null } | null
  students: { archived_at: string | null; programs: { name: string; colleges: { name: string } | null } | null } | null
}

interface AnalyticsDuplicateFlag {
  status: string
  a: ReportAssignment | null
}

interface ScholarshipOption {
  name: string
  scholarship_categories: { name: string } | null
}

function unique(values: (string | null | undefined)[]) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort()
}

export function useReportAnalytics(filters: ReportFilters) {
  const [rows, setRows] = useState<ReportAssignment[]>([])
  const [scholarshipOptions, setScholarshipOptions] = useState<ScholarshipOption[]>([])
  const [loading, setLoading] = useState(true)
  const [totalStudents, setTotalStudents] = useState(0)
  const [duplicateFlags, setDuplicateFlags] = useState<AnalyticsDuplicateFlag[]>([])
  const [scholarshipOptionsLoading, setScholarshipOptionsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scholarshipOptionsError, setScholarshipOptionsError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { error: expirationError } = await (supabase as any).rpc('flag_expiring_scholarships')
    if (expirationError) console.error('Scholarship expiration refresh failed:', expirationError)
    let canonicalCountError: string | null = null
    const canonicalCountRequest = fetchCanonicalStudentCounts().catch((countError: Error) => {
      canonicalCountError = countError.message
      console.error('Canonical student-profile count failed:', countError)
      return null
    })
    const [assignmentsResult, countResult, duplicateResult] = await Promise.all([
      supabase
      .from('student_scholarships')
      .select(`id, student_id, academic_year, semester, status, is_enrolled,
        scholarships!inner(name, status, archived_at, scholarship_categories!inner(name)),
        students!inner(archived_at, programs(name, colleges(name)))`)
        .is('archived_at', null)
        .is('scholarships.archived_at', null)
        .is('students.archived_at', null),
      canonicalCountRequest,
      supabase.from('duplicate_flags').select(`status,
        a:student_scholarship_id_a(
          id, student_id, academic_year, semester, status, is_enrolled,
          scholarships(name, status, archived_at, scholarship_categories(name)),
          students(archived_at, programs(name, colleges(name)))
        )`),
    ])
    const assignmentRows = assignmentsResult.error ? [] : (assignmentsResult.data as unknown as ReportAssignment[]) ?? []
    const assignmentStudentCount = countDistinctStudentIds(assignmentRows, (row) => row.student_id)
    const canonicalStudentCount = countResult?.activeStudents
    const inconsistentEmptyCount = canonicalStudentCount === 0 && assignmentStudentCount > 0
    if (inconsistentEmptyCount) {
      canonicalCountError = `Student profile count returned 0 while ${assignmentStudentCount} students were present in live scholarship records.`
      console.error(canonicalCountError)
    }
    setError(assignmentsResult.error?.message ?? duplicateResult.error?.message ?? canonicalCountError)
    setRows(assignmentRows)
    setTotalStudents(canonicalStudentCount == null || inconsistentEmptyCount ? assignmentStudentCount : canonicalStudentCount)
    setDuplicateFlags(duplicateResult.error ? [] : (duplicateResult.data as unknown as AnalyticsDuplicateFlag[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
    const refresh = () => void load()
    window.addEventListener(DATA_CHANGED_EVENT, refresh)
    window.addEventListener('focus', refresh)
    return () => {
      window.removeEventListener(DATA_CHANGED_EVENT, refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [load])

  useEffect(() => {
    let active = true
    setScholarshipOptions([])
    setScholarshipOptionsError(null)
    setScholarshipOptionsLoading(true)

    let query = supabase
      .from('scholarships')
      .select('name, scholarship_categories!inner(name)')
      .is('archived_at', null)
      .order('name')

    if (filters.category) {
      query = query.eq('scholarship_categories.name', filters.category)
    }

    query.then((result) => {
      if (!active) return
      setScholarshipOptionsError(result.error?.message ?? null)
      setScholarshipOptions(result.error ? [] : (result.data as unknown as ScholarshipOption[]) ?? [])
      setScholarshipOptionsLoading(false)
    })

    return () => { active = false }
  }, [filters.category])

  const options = useMemo(() => ({
    academicYears: unique(rows.map((row) => row.academic_year)).sort().reverse(),
    colleges: unique(rows.map((row) => row.students?.programs?.colleges?.name)),
    programs: unique(rows.map((row) => row.students?.programs?.name)),
    categories: unique(rows.map((row) => row.scholarships?.scholarship_categories?.name)),
    scholarships: unique(scholarshipOptions.map((option) => option.name)),
    statuses: unique(rows.map((row) => effectiveStudentRecordStatus(row.status, row.scholarships?.status))),
  }), [rows, scholarshipOptions])

  const filtered = useMemo(() => rows.filter((row) => {
    if (!matchesStudentRecordAssignment({
      category: row.scholarships?.scholarship_categories?.name,
      scholarship: row.scholarships?.name,
      college: row.students?.programs?.colleges?.name,
      program: row.students?.programs?.name,
      academicYear: row.academic_year,
      semester: row.semester,
      assignmentStatus: row.status,
      scholarshipStatus: row.scholarships?.status,
      isEnrolled: row.is_enrolled,
    }, {
      category: filters.category,
      scholarship: filters.scholarship,
      college: filters.college,
      program: filters.program,
      academicYear: filters.academicYear,
      semester: filters.semester,
      status: filters.status,
      enrollment: filters.enrollment,
    })) return false
    return true
  }), [filters, rows])

  const categoryData = useMemo<ScholarsPerCategory[]>(() => {
    const grouped = new Map<string, Set<string>>()
    for (const row of filtered) {
      const category = row.scholarships?.scholarship_categories?.name as ScholarshipCategoryName | undefined
      if (!category) continue
      if (!grouped.has(category)) grouped.set(category, new Set())
      grouped.get(category)!.add(row.student_id)
    }
    return [...grouped].map(([category_name, students]) => ({
      category_name: category_name as ScholarshipCategoryName,
      scholar_count: students.size,
    }))
  }, [filtered])

  const trendData = useMemo<TrendPoint[]>(() => {
    const grouped = new Map<string, Set<string>>()
    for (const row of filtered) {
      const term = `${row.academic_year} ${row.semester}`
      if (!grouped.has(term)) grouped.set(term, new Set())
      grouped.get(term)!.add(row.student_id)
    }
    return [...grouped]
      .map(([term, students]) => ({ term, scholar_count: students.size }))
      .sort((a, b) => a.term.localeCompare(b.term))
  }, [filtered])

  const matchingStudents = useMemo(() => countDistinctStudentIds(filtered, (row) => row.student_id), [filtered])
  const metrics = useMemo(() => {
    const effectiveStatus = (row: ReportAssignment) => effectiveStudentRecordStatus(row.status, row.scholarships?.status)
    const enrolled = new Set(filtered.filter((row) => row.is_enrolled === true).map((row) => row.student_id))
    const notEnrolled = new Set(filtered.filter((row) => row.is_enrolled === false && !enrolled.has(row.student_id)).map((row) => row.student_id))
    const scopedFlags = duplicateFlags.filter((flag) => {
      const row = flag.a
      if (!row || row.students?.archived_at || row.scholarships?.archived_at) return false
      if (filters.academicYear && row.academic_year !== filters.academicYear) return false
      if (filters.semester && row.semester !== filters.semester) return false
      if (filters.college && row.students?.programs?.colleges?.name !== filters.college) return false
      if (filters.program && row.students?.programs?.name !== filters.program) return false
      if (filters.category && row.scholarships?.scholarship_categories?.name !== filters.category) return false
      if (filters.scholarship && row.scholarships?.name !== filters.scholarship) return false
      if (filters.status && effectiveStatus(row) !== filters.status) return false
      if (filters.enrollment === 'Enrolled' && row.is_enrolled !== true) return false
      if (filters.enrollment === 'Not Enrolled' && row.is_enrolled !== false) return false
      if (filters.enrollment === 'Not Yet Verified' && row.is_enrolled !== null) return false
      return true
    })
    const hasAssignmentFilter = Object.values(filters).some(Boolean)
    return {
      totalStudents: hasAssignmentFilter ? matchingStudents : totalStudents,
      activeScholarships: filtered.filter((row) => effectiveStatus(row) === 'Active').length,
      expiringSoon: filtered.filter((row) => effectiveStatus(row) === 'Expiring Soon').length,
      expiredScholarships: filtered.filter((row) => effectiveStatus(row) === 'Expired').length,
      enrolledStudents: enrolled.size,
      notEnrolledStudents: notEnrolled.size,
      openDuplicateFlags: scopedFlags.filter((flag) => ['Open', 'Under Review'].includes(flag.status)).length,
      resolvedDuplicateFlags: scopedFlags.filter((flag) => ['Resolved', 'Confirmed Valid'].includes(flag.status)).length,
      totalDuplicateFlags: scopedFlags.length,
    }
  }, [duplicateFlags, filtered, filters, matchingStudents, totalStudents])
  return { categoryData, trendData, options, metrics, loading, error, scholarshipOptionsLoading, scholarshipOptionsError, totalStudents: metrics.totalStudents, matchingStudents, matchingAssignments: filtered.length, refetch: load }
}

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ScholarshipCategoryName, ScholarsPerCategory } from '@/types/database'
import type { TrendPoint } from '@/hooks/useScholarsTrend'

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
  student_id: string
  academic_year: string
  semester: string
  status: string
  is_enrolled: boolean | null
  scholarships: { name: string; status: string; scholarship_categories: { name: string } | null } | null
  students: { programs: { name: string; colleges: { name: string } | null } | null } | null
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
  const [scholarshipOptionsLoading, setScholarshipOptionsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scholarshipOptionsError, setScholarshipOptionsError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    supabase
      .from('student_scholarships')
      .select(`student_id, academic_year, semester, status, is_enrolled,
        scholarships!inner(name, status, scholarship_categories!inner(name)),
        students!inner(programs!inner(name, colleges!inner(name)))`)
      .then((assignmentsResult) => {
        if (!active) return
        setError(assignmentsResult.error?.message ?? null)
        setRows(assignmentsResult.error ? [] : (assignmentsResult.data as unknown as ReportAssignment[]) ?? [])
        setLoading(false)
      })
    return () => { active = false }
  }, [])

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
    statuses: unique(rows.map((row) => ['Expired', 'Expiring Soon'].includes(row.scholarships?.status ?? '') ? row.scholarships?.status : row.status)),
  }), [rows, scholarshipOptions])

  const filtered = useMemo(() => rows.filter((row) => {
    if (filters.academicYear && row.academic_year !== filters.academicYear) return false
    if (filters.semester && row.semester !== filters.semester) return false
    if (filters.college && row.students?.programs?.colleges?.name !== filters.college) return false
    if (filters.program && row.students?.programs?.name !== filters.program) return false
    if (filters.category && row.scholarships?.scholarship_categories?.name !== filters.category) return false
    if (filters.scholarship && row.scholarships?.name !== filters.scholarship) return false
    const effectiveStatus = ['Expired', 'Expiring Soon'].includes(row.scholarships?.status ?? '') ? row.scholarships?.status : row.status
    if (filters.status && effectiveStatus !== filters.status) return false
    if (filters.enrollment === 'Enrolled' && row.is_enrolled !== true) return false
    if (filters.enrollment === 'Not Enrolled' && row.is_enrolled !== false) return false
    if (filters.enrollment === 'Not Yet Verified' && row.is_enrolled !== null) return false
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

  return { categoryData, trendData, options, loading, error, scholarshipOptionsLoading, scholarshipOptionsError, matchingAssignments: filtered.length }
}

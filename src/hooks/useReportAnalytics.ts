import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ScholarshipCategoryName, ScholarsPerCategory } from '@/types/database'
import type { TrendPoint } from '@/hooks/useScholarsTrend'

export interface ReportFilters {
  academicYear: string
  semester: string
  college: string
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
  scholarships: { name: string; scholarship_categories: { name: string } | null } | null
  students: { programs: { colleges: { name: string } | null } | null } | null
}

function unique(values: (string | null | undefined)[]) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort()
}

export function useReportAnalytics(filters: ReportFilters) {
  const [rows, setRows] = useState<ReportAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    supabase
      .from('student_scholarships')
      .select(`student_id, academic_year, semester, status, is_enrolled,
        scholarships!inner(name, scholarship_categories!inner(name)),
        students!inner(programs!inner(colleges!inner(name)))`)
      .then(({ data, error }) => {
        if (!active) return
        setError(error?.message ?? null)
        setRows(error ? [] : (data as unknown as ReportAssignment[]) ?? [])
        setLoading(false)
      })
    return () => { active = false }
  }, [])

  const options = useMemo(() => ({
    academicYears: unique(rows.map((row) => row.academic_year)).sort().reverse(),
    colleges: unique(rows.map((row) => row.students?.programs?.colleges?.name)),
    categories: unique(rows.map((row) => row.scholarships?.scholarship_categories?.name)),
    scholarships: unique(rows.map((row) => row.scholarships?.name)),
    statuses: unique(rows.map((row) => row.status)),
  }), [rows])

  const filtered = useMemo(() => rows.filter((row) => {
    if (filters.academicYear && row.academic_year !== filters.academicYear) return false
    if (filters.semester && row.semester !== filters.semester) return false
    if (filters.college && row.students?.programs?.colleges?.name !== filters.college) return false
    if (filters.category && row.scholarships?.scholarship_categories?.name !== filters.category) return false
    if (filters.scholarship && row.scholarships?.name !== filters.scholarship) return false
    if (filters.status && row.status !== filters.status) return false
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

  return { categoryData, trendData, options, loading, error, matchingAssignments: filtered.length }
}

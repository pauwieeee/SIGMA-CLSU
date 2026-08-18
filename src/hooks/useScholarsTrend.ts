import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface TrendPoint {
  term: string
  scholar_count: number
}

export function useScholarsTrend() {
  const [data, setData] = useState<TrendPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)

    supabase
      .from('student_scholarships')
      .select('academic_year, semester, student_id')
      .eq('status', 'Active')
      .is('archived_at', null)
      .then(({ data: rows, error }) => {
        if (!active) return
        if (!error && rows) {
          const byTerm = new Map<string, Set<string>>()
          for (const r of rows as any[]) {
            const key = `${r.academic_year} ${r.semester}`
            if (!byTerm.has(key)) byTerm.set(key, new Set())
            byTerm.get(key)!.add(r.student_id)
          }
          const points = [...byTerm.entries()]
            .map(([term, students]) => ({ term, scholar_count: students.size }))
            .sort((a, b) => a.term.localeCompare(b.term))
          setData(points)
        }
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return { data, loading }
}

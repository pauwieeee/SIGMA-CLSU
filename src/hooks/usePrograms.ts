import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/** When collegeName is given, only returns programs under that college. */
export function usePrograms(collegeName?: string) {
  const [programs, setPrograms] = useState<string[]>([])

  useEffect(() => {
    let active = true
    setPrograms([])

    supabase
      .from('programs')
      .select('name, colleges ( name )')
      .order('name')
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setPrograms([])
          return
        }
        const rows = (data ?? []) as any[]
        const filtered = collegeName ? rows.filter((p) => p.colleges?.name === collegeName) : rows
        setPrograms(filtered.map((p) => p.name))
      })

    return () => { active = false }
  }, [collegeName])

  return programs
}

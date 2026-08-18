import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useColleges() {
  const [colleges, setColleges] = useState<string[]>([])

  useEffect(() => {
    supabase
      .from('colleges')
      .select('name')
      .order('name')
      .then(({ data }) => setColleges((data ?? []).map((c: any) => c.name)))
  }, [])

  return colleges
}

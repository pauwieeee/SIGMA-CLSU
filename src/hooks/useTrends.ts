import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface ScholarTrend {
  current_ay: string | null
  previous_ay: string | null
  current_count: number
  previous_count: number
  pct_change: number | null
  has_previous: boolean
}

export interface DuplicateFlagTrend {
  current_term: string | null
  previous_term: string | null
  current_count: number
  previous_count: number
  diff: number
  has_previous: boolean
}

export function useScholarTrend() {
  const [data, setData] = useState<ScholarTrend | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .rpc('get_scholar_trend')
      .single()
      .then(({ data, error }) => {
        if (!error) setData(data as unknown as ScholarTrend)
        setLoading(false)
      })
  }, [])

  return { data, loading }
}

export function useScholarshipsAddedThisMonth() {
  const [count, setCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .rpc('get_scholarships_added_this_month')
      .then(({ data, error }) => {
        if (!error) setCount(data as unknown as number)
        setLoading(false)
      })
  }, [])

  return { count, loading }
}

export function useDuplicateFlagTrend() {
  const [data, setData] = useState<DuplicateFlagTrend | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .rpc('get_duplicate_flag_trend')
      .single()
      .then(({ data, error }) => {
        if (!error) setData(data as unknown as DuplicateFlagTrend)
        setLoading(false)
      })
  }, [])

  return { data, loading }
}

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ActivityLog, DashboardStats, ScholarsPerCategory } from '@/types/database'

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('dashboard_stats').select('*').single()
    if (error) setError(error.message)
    setStats(data as DashboardStats | null)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { stats, loading, error, refetch: load }
}

export function useScholarsPerCategory() {
  const [data, setData] = useState<ScholarsPerCategory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase
      .from('scholars_per_category')
      .select('*')
      .then(({ data, error }) => {
        if (!active) return
        if (!error && data) setData(data as ScholarsPerCategory[])
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  return { data, loading }
}

export function useRecentActivity(limit = 6) {
  const [data, setData] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
      .then(({ data, error }) => {
        if (!active) return
        if (!error && data) setData(data as ActivityLog[])
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [limit])

  return { data, loading }
}

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ActivityLog, DashboardStats, ScholarsPerCategory } from '@/types/database'
import { ACTIVITY_CREATED_EVENT } from '@/utils/logActivity'
import { DATA_CHANGED_EVENT } from '@/utils/dataSync'

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    // Reconcile date-driven scholarship statuses before reading dashboard totals.
    // The database function is idempotent and remains the source of truth.
    const { error: expirationError } = await (supabase as any).rpc('flag_expiring_scholarships')
    if (expirationError) console.error('Scholarship expiration refresh failed:', expirationError)
    const [{ data, error }, studentCount] = await Promise.all([
      supabase.from('dashboard_stats').select('*').single(),
      supabase.from('students').select('id', { count: 'exact', head: true }).is('archived_at', null),
    ])
    if (error) setError(error.message)
    else if (studentCount.error) setError(studentCount.error.message)
    setStats(data ? { ...(data as DashboardStats), total_scholars: studentCount.count ?? 0 } : null)
    setLoading(false)
  }, [])

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

  return { stats, loading, error, refetch: load }
}

export function useScholarsPerCategory() {
  const [data, setData] = useState<ScholarsPerCategory[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    let active = true
    setLoading(true)
    supabase
      .from('scholars_per_category')
      .select('*')
      .then(({ data, error }) => {
        if (!active) return
        if (!error && data) setData(data as ScholarsPerCategory[])
        setLoading(false)
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let cleanup = load()
    const refresh = () => { cleanup(); cleanup = load() }
    window.addEventListener(DATA_CHANGED_EVENT, refresh)
    return () => { cleanup(); window.removeEventListener(DATA_CHANGED_EVENT, refresh) }
  }, [load])

  return { data, loading }
}

export function useRecentActivity(limit = 6) {
  const [data, setData] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)
    const result = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    setError(result.error?.message ?? null)
    if (!result.error && result.data) setData(result.data as ActivityLog[])
    setLoading(false)
  }, [limit])

  useEffect(() => {
    void load(true)
    const refresh = () => void load()
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener(ACTIVITY_CREATED_EVENT, refresh)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refreshWhenVisible)

    const channel = supabase
      .channel(`activity-logs-${limit}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, refresh)
      .subscribe()

    return () => {
      window.removeEventListener(ACTIVITY_CREATED_EVENT, refresh)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      void supabase.removeChannel(channel)
    }
  }, [limit, load])

  return { data, loading, error, refetch: load }
}

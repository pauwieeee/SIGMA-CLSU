import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ActivityLog } from '@/types/database'
import { ACTIVITY_CREATED_EVENT } from '@/utils/logActivity'

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

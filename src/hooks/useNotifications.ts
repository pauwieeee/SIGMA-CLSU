import { useCallback, useEffect, useId, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { AppNotification } from '@/types/database'

// limit governs how much history is loaded (and therefore how far the
// unread count and "see all" page can see) — it's independent of how many
// items the dropdown preview actually renders, which is capped separately.
export function useNotifications(limit = 50) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const instanceId = useId()

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    setNotifications((data ?? []) as AppNotification[])
    setLoading(false)
  }, [limit])

  useEffect(() => {
    load()

    // Channel names must be unique per subscription — multiple mounted
    // instances of this hook (e.g. the always-on NotificationBell plus the
    // full NotificationsPage) would otherwise fight over the same topic.
    const channel = supabase
      .channel(`notifications-changes-${instanceId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => load())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [load, instanceId])

  const unreadCount = notifications.filter((n) => !n.is_read).length

  async function markAllRead() {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id)
    if (unreadIds.length === 0) return
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    await (supabase as any).from('notifications').update({ is_read: true }).in('id', unreadIds)
  }

  async function markOneRead(id: string) {
    const target = notifications.find((n) => n.id === id)
    if (!target || target.is_read) return
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
    await (supabase as any).from('notifications').update({ is_read: true }).eq('id', id)
  }

  return { notifications, unreadCount, loading, markAllRead, markOneRead, refetch: load }
}
